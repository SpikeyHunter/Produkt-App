import { json } from '@sveltejs/kit';
import { google } from 'googleapis';
import type { RequestHandler } from './$types';
import { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '$env/static/private';

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

// Helper: Parse "18:00 - 02:00" or "6pm - 2am"
function parseTimeRange(dateStr: string, timeStr: string) {
    if (!timeStr) return null;
    
    // Split by common separators: "-", "to", "–"
    const parts = timeStr.split(/[-–]| to /i).map(s => s.trim());
    if (parts.length < 2) return null; // Need start and end

    const parseTime = (baseDateStr: string, t: string) => {
        // Matches: 18:00, 18h00, 6pm, 6:30pm, 6
        const match = t.match(/^(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?$/i);
        if (!match) return null;

        let h = parseInt(match[1]);
        const m = match[2] ? parseInt(match[2]) : 0;
        const mer = match[3]?.toLowerCase();

        // 12h to 24h conversion
        if (mer === 'pm' && h < 12) h += 12;
        if (mer === 'am' && h === 12) h = 0;

        const d = new Date(`${baseDateStr}T00:00:00`);
        d.setHours(h, m, 0, 0);
        return d;
    };

    const start = parseTime(dateStr, parts[0]);
    if (!start) return null;

    let end = parseTime(dateStr, parts[1]);
    if (!end) return null;

    // Handle overnight events (e.g. 10pm - 3am)
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }

    return { start, end };
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
       // Clean up old event if type changed to something untracked
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

    // 2. Handle DELETE Action
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

    // 3. Handle TYPE CHANGE
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
        resultId = null; // Treat as new insert
    }

    // 4. Prepare Event Data (Hours Logic)
    const dateStr = record.date;
    const artistName = cleanArtistName(record.event_name);
    
    // --- NEW LOGIC START ---
    let eventResource: any = {
        summary: `${artistName} - ${eventType}`,
        description: "",
    };

    // Calculate Times
    if (targetKey === 'CORPO') {
        const parsed = parseTimeRange(dateStr, record.op_hours);
        
        if (parsed) {
            // Case A: Corpo with Valid Hours
            eventResource.start = { dateTime: parsed.start.toISOString() };
            eventResource.end = { dateTime: parsed.end.toISOString() };
        } else {
            // Case B: Corpo with NO hours (or invalid) -> All Day Event
            // Google All-Day: end date is exclusive (date + 1 day)
            const endDate = new Date(dateStr);
            endDate.setDate(endDate.getDate() + 1);
            const endDateStr = endDate.toISOString().split('T')[0];

            eventResource.start = { date: dateStr };
            eventResource.end = { date: endDateStr };
        }

    } else {
        // Case C: NCG or Bazart (Always 10pm - 3am next day)
        const start = new Date(`${dateStr}T22:00:00`);
        const end = new Date(`${dateStr}T03:00:00`);
        end.setDate(end.getDate() + 1);

        eventResource.start = { dateTime: start.toISOString() };
        eventResource.end = { dateTime: end.toISOString() };
    }
    // --- NEW LOGIC END ---

    // Build Description
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

    // 5. Insert or Patch
    if (resultId) {
        try {
            await calendar.events.patch({
                calendarId,
                eventId: resultId,
                requestBody: eventResource
            });
        } catch (e: any) {
            if (e.code === 404) {
                const res = await calendar.events.insert({ calendarId, requestBody: eventResource });
                resultId = res.data.id;
            } else {
                throw e;
            }
        }
    } else {
        const res = await calendar.events.insert({ calendarId, requestBody: eventResource });
        resultId = res.data.id;
    }

    return json({ success: true, calendar_event_id: resultId });

  } catch (error: any) {
    console.error("Calendar Sync Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};