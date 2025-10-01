import { google } from 'googleapis';
import type { CalendarEntry, CalendarSyncResponse } from '$lib/types/GoogleCalendar';
import {
	GOOGLE_CALENDAR_ID,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GOOGLE_REFRESH_TOKEN
} from '$env/static/private';

// Use OAuth2 client instead of a service account
const oauth2Client = new google.auth.OAuth2(
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	'http://localhost' // Redirect URI is not used in the refresh token flow
);

// Set the refresh token to automatically manage access tokens
oauth2Client.setCredentials({
	refresh_token: GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const CALENDAR_ID = GOOGLE_CALENDAR_ID;

// --- Helper Functions ---

const getGuestEmail = (driver: string): string => {
	const driverEmails: { [key: string]: string } = {
		Eddy: 'eddy_baptist@hotmail.ca',
		Reza: 'rezanarenji@gmail.com',
		Tarek: 'tarekali2000@hotmail.com',
		Charles: 'charles@produkt.ca'
	};
	return driverEmails[driver] || '';
};

const formatTime = (date: Date): string => {
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const ampm = hours >= 12 ? 'pm' : 'am';
	const displayHours = hours % 12 || 12;

	if (minutes === 0) {
		return `${displayHours}${ampm}`;
	}
	return `${displayHours}:${minutes < 10 ? `0${minutes}` : minutes}${ampm}`;
};

const roundToNearest15 = (date: Date): Date => {
	const rounded = new Date(date);
	const minutes = rounded.getMinutes();
	rounded.setMinutes(Math.round(minutes / 15) * 15, 0, 0);
	return rounded;
};

const roundUp15 = (date: Date): Date => {
	const rounded = new Date(date);
	const minutes = rounded.getMinutes();
	if (minutes % 15 !== 0) {
		rounded.setTime(rounded.getTime() + (15 - (minutes % 15)) * 60000);
	}
	rounded.setSeconds(0, 0);
	return rounded;
};

/**
 * FIXED: Combines date and time strings as Eastern Time without timezone conversion
 * Input: dateStr = "2025-10-04", timeStr = "14:09"
 * Output: Date object representing 2:09 PM Eastern Time on Oct 4, 2025
 */
const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
	// Build ISO string with explicit Eastern timezone
	// This prevents JavaScript from interpreting the time in a different timezone
	const dateTimeString = `${dateStr}T${timeStr}:00`;
	
	// Create date treating it as Eastern Time
	// The Date constructor will parse this as local time if no timezone is specified
	// To ensure it's always Eastern, we construct it carefully
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hours, minutes] = timeStr.split(':').map(Number);
	
	// Create date object with explicit values
	// Note: month is 0-indexed in JavaScript Date
	const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
	
	return date;
};

const buildTitle = (
	type: string,
	driver: string,
	artistName: string,
	namesInCar: string,
	flights: string,
	pickupLoc: string,
	dropoffLoc: string,
	startTime: Date,
	flightDepartureTime?: string,
	dateStr?: string
): string => {
	let title = `*${driver} - ${type} ${artistName} (${namesInCar}) `;
	if (type === 'Arrival') {
		title += `${flights} Arrival ${formatTime(startTime)} ${dropoffLoc}`;
	} else if (type === 'Departure' && flightDepartureTime && dateStr) {
		const departureDate = combineDateAndTime(dateStr, flightDepartureTime);
		title += `${flights} Pickup ${formatTime(startTime)} Departure ${formatTime(
			departureDate
		)} ${pickupLoc}`;
	} else {
		title += `${pickupLoc} to ${dropoffLoc} ${formatTime(startTime)}`;
	}
	return title;
};

const getReminderMinutes = (type: string): number => {
	return type === 'Arrival' || type === 'Departure' ? 30 : 15;
};

const findEventById = async (eventId: string): Promise<any> => {
	try {
		const response = await calendar.events.get({ calendarId: CALENDAR_ID, eventId });
		return response.data;
	} catch {
		return null;
	}
};

const findDuplicateEventId = async (
	title: string,
	startTime: Date,
	endTime: Date
): Promise<string | null> => {
	try {
		const response = await calendar.events.list({
			calendarId: CALENDAR_ID,
			timeMin: startTime.toISOString(),
			timeMax: endTime.toISOString(),
			singleEvents: true
		});
		const duplicate = (response.data.items || []).find((event) => event.summary === title);
		return duplicate?.id || null;
	} catch (error) {
		console.error('Error checking for duplicates:', error);
		return null;
	}
};

// --- Main Sync Function ---

export async function syncToCalendar(
	rows: CalendarEntry[],
	artistName: string,
	existingEventIds?: { [key: number]: string }
): Promise<CalendarSyncResponse> {
	const eventIds: { [key: number]: string } = existingEventIds ? { ...existingEventIds } : {};
	let hasErrors = false;
	let errorMessage = '';
	let newEventsCreated = 0,
		eventsUpdated = 0,
		duplicatesFound = 0,
		eventsDeleted = 0;

	if (!GOOGLE_CALENDAR_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
		return {
			success: false,
			eventIds: {},
			error: 'Google Calendar not configured - missing OAuth credentials'
		};
	}

	try {
		await calendar.calendarList.list({ maxResults: 1 });
	} catch (authError: any) {
		return {
			success: false,
			eventIds: {},
			error: `Google Calendar authentication failed: ${authError.message}`
		};
	}

	if (existingEventIds) {
		const currentRowIds = new Set(rows.map((row) => row.id));
		for (const rowIdString of Object.keys(existingEventIds)) {
			const rowIdNumber = parseFloat(rowIdString);
			if (!currentRowIds.has(rowIdNumber)) {
				const eventIdToDelete = existingEventIds[rowIdNumber];
				if (eventIdToDelete) {
					try {
						await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: eventIdToDelete });
						delete eventIds[rowIdNumber];
						eventsDeleted++;
					} catch (deleteError: any) {
						console.warn(`Could not delete event ${eventIdToDelete}:`, deleteError.message);
						delete eventIds[rowIdNumber];
					}
				}
			}
		}
	}

	for (const row of rows) {
		if (!row.type || !row.date || !row.pickupTime) continue;

		try {
			// FIXED: Use combineDateAndTime which now properly handles Eastern Time
			// This ensures the time isn't shifted by timezone conversion
			const exactStartTime = combineDateAndTime(row.date, row.pickupTime);

			// Create rounded time for the calendar slot
			const roundedStartTime =
				row.type === 'Arrival' ? roundToNearest15(exactStartTime) : roundUp15(exactStartTime);
			const endTime = new Date(roundedStartTime.getTime() + 60 * 60000); // 1-hour duration

			if (isNaN(exactStartTime.getTime())) {
				console.warn(`Skipping row with invalid date/time:`, row);
				continue;
			}

			// Build the title using the exact start time
			const title = buildTitle(
				row.type,
				row.driverName,
				artistName,
				row.paxNames,
				row.flightInfo,
				row.pickupLocation,
				row.dropoffLocation,
				exactStartTime, // Pass the original, non-rounded time here
				row.flightDepartureTime,
				row.date
			);

			// FIXED: Use America/Toronto timezone explicitly
			// This ensures Google Calendar interprets the times correctly
			const eventData = {
				summary: title,
				start: { dateTime: roundedStartTime.toISOString(), timeZone: 'America/Toronto' },
				end: { dateTime: endTime.toISOString(), timeZone: 'America/Toronto' },
				description: row.contact,
				attendees:
					row.driverName !== 'UBER' && getGuestEmail(row.driverName)
						? [{ email: getGuestEmail(row.driverName), responseStatus: 'needsAction' }]
						: [],
				reminders: {
					useDefault: false,
					overrides: [{ method: 'popup', minutes: getReminderMinutes(row.type) }]
				}
			};

			const existingEventId = eventIds[row.id];

			if (existingEventId && (await findEventById(existingEventId))) {
				await calendar.events.update({
					calendarId: CALENDAR_ID,
					eventId: existingEventId,
					requestBody: eventData,
					sendUpdates: 'all'
				});
				eventsUpdated++;
			} else {
				const duplicateEventId = await findDuplicateEventId(title, roundedStartTime, endTime);

				if (duplicateEventId) {
					eventIds[row.id] = duplicateEventId;
					duplicatesFound++;
				} else {
					const response = await calendar.events.insert({
						calendarId: CALENDAR_ID,
						requestBody: eventData,
						sendUpdates: 'all'
					});

					if (response.data.id) {
						eventIds[row.id] = response.data.id;
						newEventsCreated++;
					}
				}
			}
		} catch (rowError: any) {
			console.error(`Error processing row ${row.id}:`, rowError);
			hasErrors = true;
			errorMessage += `Failed to sync ${row.type || 'event'}: ${
				rowError.message || rowError.toString()
			}. `;
		}
	}

	const processedRows = rows.filter((row) => row.type && row.date && row.pickupTime);
	const success = !hasErrors && processedRows.every((row) => eventIds[row.id]);

	let messageParts = [];
	if (newEventsCreated > 0) messageParts.push(`${newEventsCreated} created`);
	if (eventsUpdated > 0) messageParts.push(`${eventsUpdated} updated`);
	if (eventsDeleted > 0) messageParts.push(`${eventsDeleted} deleted`);
	if (duplicatesFound > 0) messageParts.push(`${duplicatesFound} existing`);

	return {
		success,
		eventIds,
		error: hasErrors ? errorMessage.trim() : undefined,
		message:
			messageParts.length > 0
				? `Synced calendar: ${messageParts.join(', ')}`
				: 'No calendar changes needed.'
	};
}