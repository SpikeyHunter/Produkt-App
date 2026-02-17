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

async function findExistingEvent(calendar: any, calendarId: string, summary: string, dateStr: string) {
    const timeMin = dayjs.tz(dateStr, TIMEZONE).startOf('day').toISOString();
    const timeMax = dayjs.tz(dateStr, TIMEZONE).add(1, 'day').endOf('day').toISOString();

    try {
        const res = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            q: summary
        });

        const events = res.data.items || [];
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

    const eventType = record?.type || old_record?.type;
    const targetKey = TYPE_MAP[eventType];

    if (!targetKey) {
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

    // 3. Handle TYPE CHANGE safely using MOVE or standard PATCH
    if (type === 'UPDATE' && old_record && old_record.type !== record.type) {
        const oldKey = TYPE_MAP[old_record.type];
        
        // If the event actually changes target calendars (e.g. NCG -> BAZART)
        if (oldKey && targetKey && oldKey !== targetKey && old_record.calendar_event_id) {
            try {
                await calendar.events.move({
                    calendarId: CALENDARS[oldKey],
                    eventId: old_record.calendar_event_id,
                    destination: CALENDARS[targetKey]
                });
                // The event ID remains identical after a move, preventing sync storms!
            } catch (e) {
                console.warn("Move failed, falling back to recreate", e);
                try {
                    await calendar.events.delete({ calendarId: CALENDARS[oldKey], eventId: old_record.calendar_event_id });
                } catch(delErr) {}
                resultId = null; // Force recreate if move fails
            }
        }
        // Note: If oldKey === targetKey (e.g. NCG Show -> NCG 360), we do nothing here. 
        // The PATCH command below will natively update the event title without deleting it.
    }

    // 4. Prepare Event Data
    const dateStr = record.date;
    const artistName = cleanArtistName(record.event_name);
    const { start, end } = calculateEventTimes(dateStr, record.op_hours, eventType);
    const summary = `${artistName} - ${eventType}`;

    const eventResource: any = {
        summary: summary,
        start: { dateTime: start.format(), timeZone: TIMEZONE },
        end: { dateTime: end.format(), timeZone: TIMEZONE },
        description: "",
        extendedProperties: {
            private: { syncSource: 'produkt-tech-schedule' }
        }
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
    if (resultId) {
        try {
            await calendar.events.patch({
                calendarId,
                eventId: resultId,
                requestBody: eventResource
            });
        } catch (e: any) {
            if (e.code === 404 || e.code === 410) {
                console.warn(`Event ${resultId} not found, checking for duplicate...`);
                resultId = null; 
            } else {
                throw e;
            }
        }
    }

    if (!resultId) {
        const duplicate = await findExistingEvent(calendar, calendarId, summary, dateStr);
        
        if (duplicate) {
            console.log(`Duplicate found (${duplicate.id}). Updating instead of inserting.`);
            resultId = duplicate.id;
            await calendar.events.patch({
                calendarId,
                eventId: resultId,
                requestBody: eventResource
            });
        } else {
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