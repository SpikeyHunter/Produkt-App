import { supabase } from '$lib/supabase';
import { seedTimetableOnConfirm } from '$lib/services/timetableSync';

/**
 * calendarEventLink
 * -----------------
 * Bridges the CALENDAR side (`calendar` / `calendar_events`) with the
 * ADVANCE/TIXR side (`events`) using the existing one-way link:
 *
 *      events.calendar_link  ===  calendar.id   (the group_id)
 *
 * The link lives entirely on the `events` table, so deleting an `events`
 * row never touches the calendar (the requested "not cross-compatible"
 * behaviour is guaranteed by design — there is no FK the other way).
 *
 * Behaviour:
 *  - On CONFIRM of a *show* type -> create ONE linked custom row in `events`
 *    (is_custom = true) if none exists yet. event_name is seeded from the
 *    calendar title ONCE and never overwritten again.
 *  - event_venue is derived from the TYPE (not the calendar venue).
 *  - event_date mirrors the confirmed calendar date.
 *  - Type change  -> update event_venue on the linked row.
 *  - Date change  -> update event_date on the linked row.
 *
 * Venue/date syncing only touches rows that are still is_custom = true.
 * Once you swap the row to a real Tixr event (via EventEditModal), Tixr
 * becomes the source of truth and the calendar stops overwriting it.
 * (If you'd rather always sync, delete the `existing.is_custom` guards.)
 */

// Stored type value for Bazart is "Bazart Nuits" (UI shows "Nuits Bazart").
export const SHOW_TYPES = ['Bazart Nuits', 'NCG Show', 'NCG 360', 'DSTRKT', 'Tour Prod'] as const;

export function isShowType(type?: string | null): boolean {
	return !!type && (SHOW_TYPES as readonly string[]).includes(type);
}

/** Maps an event TYPE to the venue string stored on `events.event_venue`. */
export function venueForType(type?: string | null): string {
	if (type === 'Bazart Nuits') return 'Bazart';
	if (type === 'NCG Show' || type === 'NCG 360' || type === 'DSTRKT' || type === 'Tour Prod') {
		return 'New City Gas';
	}
	return '';
}

/** Returns the single linked `events` row for a calendar group, if any. */
async function getLinkedEvent(groupId: string) {
	const { data, error } = await supabase
		.from('events')
		.select('event_id, is_custom, event_name')
		.eq('calendar_link', groupId)
		.limit(1) // tolerant of accidental duplicates
		.maybeSingle(); // avoids the 406 error when empty

	if (error) {
		console.error('[calendarEventLink] getLinkedEvent failed:', error);
		return null;
	}
	return data;
}

/**
 * Call this when a SHOW is confirmed in the calendar.
 * Creates the linked custom row if it doesn't exist; otherwise keeps the
 * custom row's date/venue in sync WITHOUT ever touching event_name.
 */
export async function syncConfirmedShowToEvents(params: {
	groupId: string | null | undefined;
	title: string | null | undefined;
	date: string | null | undefined;
	type: string | null | undefined;
}) {
	const { groupId, title, date, type } = params;

	// Only shows. Corpo / Moet City / Other / etc. are ignored entirely.
	if (!groupId || !date || !isShowType(type)) return;

	try {
		const existing = await getLinkedEvent(groupId);
		const venue = venueForType(type);

		if (existing) {
			// Already linked. Keep custom rows in sync; leave real Tixr rows alone.
			if (existing.is_custom) {
				await supabase
					.from('events')
					.update({ event_date: date, event_venue: venue })
					.eq('event_id', existing.event_id);
			}
			// Seed the run-of-show template if the linked show has none yet.
			await seedTimetableOnConfirm(groupId);
			return;
		}

		// Fresh linked custom event — mirrors CalendarLink.svelte's insert.
		const { error } = await supabase.from('events').insert([
			{
				event_name: (title || 'Untitled').trim(), // seeded once, from calendar title
				event_date: date,
				event_venue: venue,
				event_status: 'LIVE',
				is_custom: true,
				calendar_link: groupId
			}
		]);
		if (error) console.error('[calendarEventLink] insert failed:', error);
		else await seedTimetableOnConfirm(groupId);
	} catch (err) {
		console.error('[calendarEventLink] syncConfirmedShowToEvents failed:', err);
	}
}

/** Call this when the calendar event TYPE changes. Updates the linked venue. */
export async function updateLinkedShowVenue(
	groupId: string | null | undefined,
	newType: string | null | undefined
) {
	if (!groupId) return;
	try {
		const existing = await getLinkedEvent(groupId);
		if (!existing || !existing.is_custom) return; // don't overwrite real Tixr events

		const venue = venueForType(newType);
		if (!venue) return; // switched to a non-show type -> leave venue as-is

		await supabase
			.from('events')
			.update({ event_venue: venue })
			.eq('event_id', existing.event_id);
	} catch (err) {
		console.error('[calendarEventLink] updateLinkedShowVenue failed:', err);
	}
}

/**
 * Call this when calendar DATES change for a group.
 * Re-reads the calendar and pushes the confirmed date (fallback: earliest
 * non-hidden date) onto the linked custom row.
 */
export async function syncLinkedDateFromCalendar(groupId: string | null | undefined) {
	if (!groupId) return;
	try {
		const existing = await getLinkedEvent(groupId);
		if (!existing || !existing.is_custom) return;

		const { data: rows } = await supabase
			.from('calendar_events')
			.select('date, status')
			.eq('group_id', groupId)
			.neq('status', 'HIDDEN');

		if (!rows || rows.length === 0) return;

		const confirmed = rows.find((r) => r.status === 'CONFIRMED');
		const chosen = (confirmed ? confirmed : [...rows].sort((a, b) => a.date.localeCompare(b.date))[0])
			.date;

		await supabase
			.from('events')
			.update({ event_date: chosen })
			.eq('event_id', existing.event_id);
	} catch (err) {
		console.error('[calendarEventLink] syncLinkedDateFromCalendar failed:', err);
	}
}