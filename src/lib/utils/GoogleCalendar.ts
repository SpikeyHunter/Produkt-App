import { google } from 'googleapis';
import type { CalendarEntry, CalendarSyncResponse } from '$lib/types/GoogleCalendar';
import { isDaylightSavingTime } from '$lib/utils/timezoneUtils';
import {
	GOOGLE_CALENDAR_ID,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GOOGLE_REFRESH_TOKEN
} from '$env/static/private';

const oauth2Client = new google.auth.OAuth2(
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	'http://localhost'
);

oauth2Client.setCredentials({
	refresh_token: GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const CALENDAR_ID = GOOGLE_CALENDAR_ID;
const TIMEZONE = 'America/Montreal'; // Standardized timezone

// --- Helper Functions ---

const getGuestEmail = (driver: string): string => {
	const driverEmails: { [key: string]: string } = {
		Eddy: 'eddy_baptist@hotmail.ca',
		Reza: 'rezanarenji@gmail.com',
		Tony: 'tonytaitt@gmail.com',
		Charles: 'charles@produkt.ca'
	};
	return driverEmails[driver] || '';
};

const formatTime = (date: Date): string => {
	const formatted = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone: TIMEZONE
	}).format(date);

	return formatted.replace(' ', '').toLowerCase();
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

const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
	const testDate = new Date(dateStr + 'T12:00:00');
	const isDST = isDaylightSavingTime(testDate);
	const offset = isDST ? '-04:00' : '-05:00';

	const dateTimeString = `${dateStr}T${timeStr}:00${offset}`;
	return new Date(dateTimeString);
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
			const exactStartTime = combineDateAndTime(row.date, row.pickupTime);
			const roundedStartTime =
				row.type === 'Arrival' ? roundToNearest15(exactStartTime) : roundUp15(exactStartTime);
			const endTime = new Date(roundedStartTime.getTime() + 60 * 60000);

			if (isNaN(exactStartTime.getTime())) {
				console.warn(`Skipping row with invalid date/time:`, row);
				continue;
			}

			const title = buildTitle(
				row.type,
				row.driverName,
				artistName,
				row.paxNames,
				row.flightInfo,
				row.pickupLocation,
				row.dropoffLocation,
				exactStartTime,
				row.flightDepartureTime,
				row.date
			);

			const eventData = {
				summary: title,
				start: { dateTime: roundedStartTime.toISOString(), timeZone: TIMEZONE },
				end: { dateTime: endTime.toISOString(), timeZone: TIMEZONE },
				description: row.contact,
				extendedProperties: {
					private: { syncSource: 'produkt-ground-transport' }
				},
				attendees:
					row.driverName !== 'UBER'
						? (() => {
								const attendees = [];
								const driverEmail = getGuestEmail(row.driverName);

								// ADD THIS: Simply check if an email exists for the driver
								if (driverEmail) {
									attendees.push({ email: driverEmail, responseStatus: 'needsAction' });
								}

								// Keep your special logic for Reza/Eddy if you want Eddy notified for Reza's trips
								if (row.driverName === 'Reza') {
									const eddyEmail = getGuestEmail('Eddy');
									if (eddyEmail && eddyEmail !== driverEmail) {
										attendees.push({ email: eddyEmail, responseStatus: 'needsAction' });
									}
								}
								return attendees;
							})()
						: [],
				reminders: {
					useDefault: false,
					overrides: [{ method: 'popup', minutes: getReminderMinutes(row.type) }]
				}
			};

			const existingEventId = eventIds[row.id];

			if (existingEventId && (await findEventById(existingEventId))) {
				// Using PATCH instead of UPDATE to only alter changed fields natively
				await calendar.events.patch({
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
					await calendar.events.patch({
						calendarId: CALENDAR_ID,
						eventId: duplicateEventId,
						requestBody: eventData,
						sendUpdates: 'all'
					});
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
