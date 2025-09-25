import { google } from 'googleapis';
import type { CalendarEntry, CalendarSyncResponse } from '$lib/types/GoogleCalendar';
import {
  GOOGLE_CALENDAR_ID,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN
} from '$env/static/private';

// Use OAuth2 client (like Google Apps Script) instead of service account
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'http://localhost' // Redirect URI (not used for refresh token flow)
);

// Set the refresh token to get access tokens automatically
oauth2Client.setCredentials({
  refresh_token: GOOGLE_REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Use the imported Calendar ID
const CALENDAR_ID = GOOGLE_CALENDAR_ID;

// Driver email mapping
const getGuestEmail = (driver: string): string => {
  const driverEmails: { [key: string]: string } = {
    Eddy: 'eddy_baptist@hotmail.ca',
    Reza: 'rezanarenji@gmail.com',
    Tarek: 'tarekali2000@hotmail.com',
    Charles: 'charles@produkt.ca',
  };
  return driverEmails[driver] || '';
};

// Format time like the Google Script (e.g., "3pm" or "3:30pm")
const formatTime = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;

  if (minutes === 0) {
    return `${displayHours}${ampm}`;
  }

  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHours}:${displayMinutes}${ampm}`;
};

// Round time up to nearest 15 minutes
const roundUp15 = (date: Date): Date => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const mod = minutes % 15;

  if (mod !== 0) {
    rounded.setTime(rounded.getTime() + (15 - mod) * 60000);
  }
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);

  return rounded;
};

// Combine date and time strings into a Date object
const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
};

// Build event title using same format as Google Script
const buildTitle = (
  type: string,
  driver: string,
  artistName: string,
  namesInCar: string,
  flights: string,
  pickupLoc: string,
  dropoffLoc: string,
  startTime: Date
): string => {
  let title = `*${driver} - ${type} ${artistName} (${namesInCar}) `;

  if (type === 'Arrival') {
    title += `${flights} ${dropoffLoc}`;
  } else if (type === 'Departure') {
    title += `${flights} Pickup ${formatTime(startTime)} ${pickupLoc}`;
  } else {
    title += `${pickupLoc} to ${dropoffLoc} ${formatTime(startTime)}`;
  }

  return title;
};

// Get reminder minutes based on event type
const getReminderMinutes = (type: string): number => {
  return type === 'Arrival' || type === 'Departure' ? 30 : 15;
};

// Find existing event by ID
const findEventById = async (eventId: string): Promise<any> => {
  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId: eventId,
    });
    return response.data;
  } catch {
    return null;
  }
};

// Check for existing events with same title and return the event ID if found
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
      singleEvents: true,
    });

    const events = response.data.items || [];
    const duplicate = events.find((event) => event.summary === title);
    return duplicate?.id || null;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return null;
  }
};

// Create or update calendar events - matches Google Apps Script behavior
// src/lib/services/GoogleCalendar.ts

export async function syncToCalendar(
	rows: CalendarEntry[],
	artistName: string,
	existingEventIds?: { [key: number]: string }
): Promise<CalendarSyncResponse> {
	const eventIds: { [key: number]: string } = existingEventIds ? { ...existingEventIds } : {};
	let hasErrors = false;
	let errorMessage = '';
	let newEventsCreated = 0;
	let eventsUpdated = 0;
	let duplicatesFound = 0;
	let eventsDeleted = 0;

	// Validate environment variables
	if (!GOOGLE_CALENDAR_ID || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
		console.error('Missing Google Calendar OAuth environment variables');
		return {
			success: false,
			eventIds: {},
			error: 'Google Calendar not configured - missing OAuth credentials'
		};
	}

	console.log('Starting calendar sync for', rows.length, 'rows');

	// Test authentication first
	try {
		await calendar.calendarList.list({ maxResults: 1 });
	} catch (authError: any) {
		console.error('❌ Authentication failed:', authError.message);
		return {
			success: false,
			eventIds: {},
			error: `Google Calendar authentication failed: ${authError.message}`
		};
	}

	// FIX: Correctly handle deleted rows using parseFloat
	if (existingEventIds) {
		const currentRowIds = new Set(rows.map((row) => row.id));
		const existingRowIdStrings = Object.keys(existingEventIds);

		for (const rowIdString of existingRowIdStrings) {
			const rowIdNumber = parseFloat(rowIdString); // Use parseFloat
			if (!currentRowIds.has(rowIdNumber)) {
				const eventIdToDelete = existingEventIds[rowIdNumber];
				if (eventIdToDelete) {
					try {
						await calendar.events.delete({
							calendarId: CALENDAR_ID,
							eventId: eventIdToDelete
						});
						console.log(`Deleted calendar event: ${eventIdToDelete}`);
						delete eventIds[rowIdNumber]; // Remove from the map to be returned
						eventsDeleted++;
					} catch (deleteError: any) {
						console.warn(`Could not delete event ${eventIdToDelete}:`, deleteError.message);
						// If an event is already deleted from Google Calendar manually, this might error.
						// We still remove it from our list.
						delete eventIds[rowIdNumber];
					}
				}
			}
		}
	}

	// Process current rows (create/update)
	for (const row of rows) {
		if (!row.type || !row.date || !row.pickupTime) {
			console.log('Skipping incomplete row:', row.id);
			continue;
		}

		try {
			const startTime = roundUp15(combineDateAndTime(row.date, row.pickupTime));
			const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour duration

			if (isNaN(startTime.getTime())) {
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
				startTime
			);

			const eventData = {
				summary: title,
				start: { dateTime: startTime.toISOString(), timeZone: 'America/Toronto' },
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
				// Update existing event
				await calendar.events.update({
					calendarId: CALENDAR_ID,
					eventId: existingEventId,
					requestBody: eventData,
					sendUpdates: 'all'
				});
				console.log(`Updated event: ${title}`);
				eventsUpdated++;
			} else {
				// Check for duplicates before creating a new one
				const duplicateEventId = await findDuplicateEventId(title, startTime, endTime);

				if (duplicateEventId) {
					eventIds[row.id] = duplicateEventId;
					console.log(`Found existing event ID for: ${title}`);
					duplicatesFound++;
				} else {
					// Create new event
					const response = await calendar.events.insert({
						calendarId: CALENDAR_ID,
						requestBody: eventData,
						sendUpdates: 'all'
					});

					if (response.data.id) {
						eventIds[row.id] = response.data.id;
						console.log(`Created event: ${title}`);
						newEventsCreated++;
					}
				}
			}
		} catch (rowError: any) {
			console.error(`Error processing row ${row.id}:`, rowError);
			hasErrors = true;
			const errorDetail = rowError.message || rowError.toString();
			errorMessage += `Failed to sync ${row.type || 'event'}: ${errorDetail}. `;
		}
	}

	const processedRows = rows.filter((row) => row.type && row.date && row.pickupTime);
	const hasAllEventIds = processedRows.every((row) => eventIds[row.id]);

	const success = !hasErrors && hasAllEventIds;
	
	// Construct a meaningful success message
	let messageParts = [];
	if (newEventsCreated > 0) messageParts.push(`${newEventsCreated} created`);
	if (eventsUpdated > 0) messageParts.push(`${eventsUpdated} updated`);
	if (eventsDeleted > 0) messageParts.push(`${eventsDeleted} deleted`);
	if (duplicatesFound > 0) messageParts.push(`${duplicatesFound} existing`);

	let message = `Synced calendar: ${messageParts.join(', ')}`;
	if (messageParts.length === 0) {
		message = "No calendar changes needed.";
	}


	return {
		success,
		eventIds,
		error: hasErrors ? errorMessage.trim() : undefined,
		message: hasErrors ? 'Some events synced with errors' : message
	};
}