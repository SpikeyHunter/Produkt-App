import { google } from 'googleapis';
import type { CalendarEntry } from '$lib/types/calendar';
import {
  GOOGLE_CALENDAR_ID,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY
} from '$env/static/private';

// Initialize Google Calendar API with explicit JWT client
const auth = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // 🔑 Fix newline issue
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

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

// Check for existing events with same title in time range
const checkForDuplicates = async (
  title: string,
  startTime: Date,
  endTime: Date
): Promise<boolean> => {
  try {
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
    });

    const events = response.data.items || [];
    return events.some((event) => event.summary === title);
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    throw error;
  }
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

// Create or update calendar events
export async function syncToCalendar(
  rows: CalendarEntry[],
  artistName: string,
  existingEventIds?: { [key: number]: string }
): Promise<{ success: boolean; eventIds: { [key: number]: string }; error?: string }> {
  const eventIds: { [key: number]: string } = existingEventIds || {};
  let hasErrors = false;
  let errorMessage = '';

  for (const row of rows) {
    if (!row.type || !row.date || !row.pickupTime) continue;

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
            ? [{ email: getGuestEmail(row.driverName) }]
            : [],
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: getReminderMinutes(row.type) }],
        },
      };

      const existingEventId = eventIds[row.id];
      if (existingEventId && (await findEventById(existingEventId))) {
        await calendar.events.update({
          calendarId: CALENDAR_ID,
          eventId: existingEventId,
          requestBody: eventData,
          sendUpdates: 'none',
        });
        console.log(`Updated event: ${title}`);
      } else {
        if (await checkForDuplicates(title, startTime, endTime)) {
          console.log(`Skipping duplicate: ${title}`);
          continue;
        }
        const response = await calendar.events.insert({
          calendarId: CALENDAR_ID,
          requestBody: eventData,
          sendUpdates: 'all',
        });
        if (response.data.id) {
          eventIds[row.id] = response.data.id;
          console.log(`Created event: ${title}`);
        }
      }
    } catch (rowError: any) {
      console.error(`Error processing row ${row.id}:`, rowError);
      hasErrors = true;
      errorMessage += `Failed to sync event for ${row.type || 'a row'}. Auth error. `;
    }
  }

  return {
    success: !hasErrors,
    eventIds,
    error: hasErrors ? errorMessage.trim() : undefined,
  };
}
