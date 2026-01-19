import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import type { RequestHandler } from './$types';
import { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '$env/static/private';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Initialize DayJS with Timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Montreal";

const CALENDARS = {
  NCG: "c_280a6fe805ed760d8258723fd98f10a7523c66c17e2ec165a717cbc41f2a6d25@group.calendar.google.com",
  BAZART: "c_ae6602cd10978c57d5b2ce6f28b96a6a947dd8d51204e54391d466338b3b4394@group.calendar.google.com",
  CORPO: "c_217ea3872706404045fb70101601a8c3bbdb4961227122b242735c64dde6310e@group.calendar.google.com",
};

const TYPE_MAP: Record<string, keyof typeof CALENDARS> = {
  "NCG Show": "NCG",
  "NCG 360": "NCG",
  "Tour Prod": "NCG",
  "DSTRKT": "NCG",
  "Bazart Nuits": "BAZART",
  "Moet City": "BAZART",
  "Corpo": "CORPO",
};

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Helper: Clean "NCG - Artist" to just "Artist"
function cleanArtistName(rawName: string): string {
    if (!rawName) return "Untitled";
    const parts = rawName.split('-');
    if (parts.length > 1) {
        return parts[1].trim();
    }
    return rawName.trim();
}

// Helper: Parse Times with Default Fallbacks (Montreal Time)
function calculateEventTimes(dateStr: string, timeStr: string, eventType: string) {
    let start: dayjs.Dayjs | null = null;
    let end: dayjs.Dayjs | null = null;

    // 1. Try to Parse "OPS HOURS" if they exist
    if (timeStr) {
        const parts = timeStr.split(/[-–]| to /i).map(s => s.trim());
        
        if (parts.length >= 2) {
            const parseSingleTime = (baseDate: string, t: string) => {
                const match = t.match(/^(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?$/i);
                if (!match) return null;

                let h = parseInt(match[1]);
                const m = match[2] ? parseInt(match[2]) : 0;
                const mer = match[3]?.toLowerCase();

                if (mer === 'pm' && h < 12) h += 12;
                if (mer === 'am' && h === 12) h = 0;

                return dayjs.tz(`${baseDate} ${h}:${m}`, "YYYY-MM-DD H:m", TIMEZONE);
            };

            const s = parseSingleTime(dateStr, parts[0]);
            const e = parseSingleTime(dateStr, parts[1]);

            if (s && e) {
                start = s;
                end = e;
                if (end.isBefore(start)) {
                    end = end.add(1, 'day');
                }
            }
        }
    }

    // 2. Defaults if parsing failed
    if (!start || !end) {
        const base = dayjs.tz(dateStr, "YYYY-MM-DD", TIMEZONE);
        
        if (eventType === 'Corpo') {
            start = base.hour(10).minute(0);
            end = base.hour(16).minute(0);
        } else if (eventType === 'Moet City') {
            start = base.hour(12).minute(0);
            end = base.hour(20).minute(0);
        } else {
            start = base.hour(22).minute(0);
            end = base.hour(3).minute(0).add(1, 'day');
        }
    }

    return { start, end };
}

// --- NEW: DUPLICATE CHECK HELPER ---
async function findExistingEvent(calendar: any, calendarId: string, summary: string, dateStr: string) {
    // Search window: The target date (00:00 to 23:59:59)
    const timeMin = dayjs.tz(dateStr, TIMEZONE).startOf('day').toISOString();
    const timeMax = dayjs.tz(dateStr, TIMEZONE).add(1, 'day').endOf('day').toISOString();

    try {
        const res = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            q: summary // Let Google filter by text match first
        });

        const events = res.data.items || [];
        // Double check exact summary match to avoid partial matches
        // e.g. "Artist A" matching "Artist A Soundcheck"
        return events.find((e: any) => e.summary === summary);
    } catch (e) {
        console.warn("Duplicate check failed, proceeding to insert:", e);
        return null;
    }
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { record, old_record, type } = await request.json();

    const privateKey = GOOGLE_PRIVATE_KEY.split(String.raw`\n`).join('\n');
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: SCOPES
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // 1. Determine Target Calendar
    const eventType = record?.type || old_record?.type;
    const targetKey = TYPE_MAP[eventType];

    if (!targetKey) {
       // Cleanup if type changed to untracked
       if (old_record?.calendar_event_id && old_record?.type && TYPE_MAP[old_record.type]) {
            const oldKey = TYPE_MAP[old_record.type];
            try {
                await calendar.events.delete({ 
                    calendarId: CALENDARS[oldKey], 
                    eventId: old_record.calendar_event_id 
                });
            } catch(e) {}
       }
       return json({ success: true, message: "Type ignored" });
    }

    const calendarId = CALENDARS[targetKey];
    let resultId = record.calendar_event_id;

    // 2. Handle DELETE
    if (type === 'DELETE') {
      if (old_record?.calendar_event_id) {
        try {
          const deleteKey = TYPE_MAP[old_record.type] || targetKey;
          await calendar.events.delete({ 
              calendarId: CALENDARS[deleteKey], 
              eventId: old_record.calendar_event_id 
          });
        } catch (e) {
          console.warn("Delete failed", e);
        }
      }
      return json({ success: true, action: "deleted" });
    }

    // 3. Handle TYPE CHANGE (Delete old, treat as new)
    if (type === 'UPDATE' && old_record && old_record.type !== record.type) {
        const oldKey = TYPE_MAP[old_record.type];
        if (oldKey && old_record.calendar_event_id) {
            try {
                await calendar.events.delete({
                    calendarId: CALENDARS[oldKey],
                    eventId: old_record.calendar_event_id
                });
            } catch(e) {}
        }
        resultId = null; 
    }

    // 4. Prepare Event Data
    const dateStr = record.date;
    const artistName = cleanArtistName(record.event_name);
    const { start, end } = calculateEventTimes(dateStr, record.op_hours, eventType);
    const summary = `${artistName} - ${eventType}`;

    const eventResource: any = {
        summary: summary,
        start: { dateTime: start.format() },
        end: { dateTime: end.format() },
        description: "",
    };

    const descLines = [
        `CREW CALL: ${record.crew_call || "TBC"}`,
        `LD: ${record.ld || "-"}`,
        `VIDEO: ${record.video || "-"}`,
        `VJ: ${record.vj || "-"}`,
        `SOUND: ${record.sound || "-"}`,
        `TECH SM: ${record.tech_sm || "-"}`,
        `DT: ${record.dt || "-"}`,
        `LIAISON: ${record.artist_liaison || "-"}`,
    ];
    if (record.op_hours) descLines.push(`OP HOURS: ${record.op_hours}`);
    if (record.notes) descLines.push(`\nNOTES: ${record.notes}`);
    
    eventResource.description = descLines.join("\n");

    // 5. INSERT / PATCH WITH DUPLICATE PREVENTION
    
    // A. Attempt Update if we have an ID
    if (resultId) {
        try {
            await calendar.events.patch({
                calendarId,
                eventId: resultId,
                requestBody: eventResource
            });
        } catch (e: any) {
            // If 404 (Not Found), it was deleted externally. Clear ID and fall to step B.
            if (e.code === 404 || e.code === 410) {
                console.warn(`Event ${resultId} not found, checking for duplicate...`);
                resultId = null; 
            } else {
                throw e; // Real error
            }
        }
    }

    // B. If ID is null (New or Recovered), check for duplicates before inserting
    if (!resultId) {
        // Search for existing event with same name on same day
        const duplicate = await findExistingEvent(calendar, calendarId, summary, dateStr);
        
        if (duplicate) {
            // FOUND DUPLICATE: Adopt its ID and update it
            console.log(`Duplicate found (${duplicate.id}). Updating instead of inserting.`);
            resultId = duplicate.id;
            await calendar.events.patch({
                calendarId,
                eventId: resultId,
                requestBody: eventResource
            });
        } else {
            // NO DUPLICATE: Insert new
            const res = await calendar.events.insert({ 
                calendarId, 
                requestBody: eventResource 
            });
            resultId = res.data.id;
        }
    }

    return json({ success: true, calendar_event_id: resultId });

  } catch (error: any) {
    console.error("Calendar Sync Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};