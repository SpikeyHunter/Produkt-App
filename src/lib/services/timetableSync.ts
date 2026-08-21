// timetableSync.ts
// -----------------
// ONE-WAY sync from the calendar side (calendar_events / calendar_data deals)
// into the linked show's run-of-show (`events.timetable`).
//
//   deal set times  --->  events.timetable      (never the other way)
//   event time      --->  DOORS / CURFEW rows   (never the other way)
//
// Matching order when a deal is applied to the timetable:
//   1. an entry previously written by this deal (entry.dealId === deal.id)
//   2. an entry with the same artist name (case-insensitive)
//   3. the role placeholder row (notes = Headliner/Support, artist empty or TBD)
//   4. otherwise a new row is inserted at its chronological position
//
// Every public function here is failsafe: it never throws, so a failed sync
// can never break deal saving or the confirm flow.

import { supabase } from '$lib/supabase';
import type { TimetableEntry } from '$lib/services/eventsService';

const DEFAULT_DOORS = '10:00PM';
const DEFAULT_SUPPORT = '11:30PM';
const DEFAULT_HEADLINER = '1:00AM';
const DEFAULT_CURFEW = '3:00AM';

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** "21:00" -> "9:00PM", "01:30" -> "1:30AM". Returns null for empty/invalid. */
export function formatTimetableTime(hhmm: string | null | undefined): string | null {
	if (!hhmm) return null;
	const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
	if (!m) return null;
	let hours = parseInt(m[1], 10);
	const minutes = parseInt(m[2], 10);
	if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) return null;
	const ampm = hours >= 12 ? 'PM' : 'AM';
	hours = hours % 12 || 12;
	return `${hours}:${String(minutes).padStart(2, '0')}${ampm}`;
}

/**
 * "11:30PM" -> minutes on a nightlife clock. Hours before 10AM are treated as
 * "after midnight" (same rule as SetTimesModal) so 1:00AM sorts after 11:30PM.
 */
export function parseTimetableClock(timeStr: string | null | undefined): number | null {
	const m = (timeStr || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (!m) return null;
	let hours = parseInt(m[1], 10);
	const minutes = parseInt(m[2], 10);
	const period = m[3].toUpperCase();
	if (period === 'PM' && hours !== 12) hours += 12;
	if (period === 'AM' && hours === 12) hours = 0;
	if (hours < 10) hours += 24;
	return hours * 60 + minutes;
}

function makeEntry(
	time: string,
	artist: string = '',
	notes: string = '',
	status: TimetableEntry['status'] = 'Default'
): TimetableEntry {
	return { id: Math.random().toString(36).substr(2, 9), time, artist, notes, status, length: '' };
}

/** The all-day sentinel saved by TimeSelector — carries no real show times. */
function isAllDay(start: string | null | undefined, end: string | null | undefined): boolean {
	return start === '00:00' && end === '23:59';
}

/**
 * Default run-of-show template, with DOORS/Local pinned to the event start
 * time and CURFEW pinned to the event end time (falling back to 10PM / 3AM).
 */
export function buildDefaultTimetable(
	start?: string | null,
	end?: string | null
): TimetableEntry[] {
	if (isAllDay(start, end)) {
		start = null;
		end = null;
	}
	const doors = formatTimetableTime(start) || DEFAULT_DOORS;
	const curfew = formatTimetableTime(end) || DEFAULT_CURFEW;
	return [
		makeEntry(doors, 'DOORS', '', 'Default'),
		makeEntry(doors, '', 'Local', 'Default'),
		makeEntry(DEFAULT_SUPPORT, '', 'Support', 'Default'),
		makeEntry(DEFAULT_HEADLINER, '', 'Headliner', 'Default'),
		makeEntry(curfew, 'CURFEW', '', 'Default')
	];
}

function isSpecialRow(entry: TimetableEntry): boolean {
	return entry.artist === 'DOORS' || entry.artist === 'CURFEW';
}

/** DOORS stays first, CURFEW stays last, everything else sorted chronologically. */
export function sortTimetable(entries: TimetableEntry[]): TimetableEntry[] {
	const doors = entries.filter((e) => e.artist === 'DOORS');
	const curfew = entries.filter((e) => e.artist === 'CURFEW');
	const middle = entries.filter((e) => !isSpecialRow(e));
	middle.sort((a, b) => (parseTimetableClock(a.time) ?? 0) - (parseTimetableClock(b.time) ?? 0));
	return [...doors, ...middle, ...curfew];
}

/** Recompute each row's set length from the gap to the next row (modal parity). */
export function computeTimetableLengths(entries: TimetableEntry[]): TimetableEntry[] {
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (i === entries.length - 1 || isSpecialRow(entry)) {
			entry.length = '';
			continue;
		}
		const current = parseTimetableClock(entry.time);
		const next = parseTimetableClock(entries[i + 1]?.time);
		if (current == null || next == null || next < current) {
			entry.length = '';
			continue;
		}
		const diff = next - current;
		const hours = Math.floor(diff / 60);
		const mins = diff % 60;
		if (hours > 0 && mins > 0) entry.length = `${hours}h ${mins}m`;
		else if (hours > 0) entry.length = `${hours}h`;
		else entry.length = `${mins}m`;
	}
	return entries;
}

// ---------------------------------------------------------------------------
// Deal -> timetable application
// ---------------------------------------------------------------------------

interface DealForTimetable {
	id?: string;
	role?: string; // 'Headliner' | 'Support'
	artistName?: string;
	setTimes?: { enabled?: boolean; from?: string; to?: string };
}

function hasRealArtist(entry: TimetableEntry): boolean {
	const a = (entry.artist || '').trim();
	return a !== '' && a.toUpperCase() !== 'TBD' && !isSpecialRow(entry);
}

function insertBeforeCurfew(entries: TimetableEntry[], entry: TimetableEntry): void {
	// sortTimetable places it chronologically anyway; this just keeps raw order sane.
	const curfewIdx = entries.findIndex((e) => e.artist === 'CURFEW');
	if (curfewIdx === -1) entries.push(entry);
	else entries.splice(curfewIdx, 0, entry);
}

/**
 * Makes sure the artist's computed set LENGTH matches the deal (from -> to):
 * something must start exactly at the deal's end time. If nothing does, an
 * empty "Local" boundary line is inserted at the end time, tagged with
 * fillerForDealId so a later deal edit can move/remove it — and so a future
 * deal starting at that time can claim it as its own row.
 */
function syncDealEndBoundary(
	entries: TimetableEntry[],
	artistRow: TimetableEntry,
	deal: DealForTimetable,
	endTime: string | null
): void {
	// Boundary rows the user manually filled with an artist stop being managed.
	for (const e of entries) {
		if (!isSpecialRow(e) && e.fillerForDealId === deal.id && hasRealArtist(e)) {
			delete e.fillerForDealId;
		}
	}

	// Pull this deal's (still empty) boundary rows out while we re-evaluate.
	// There should be at most one; duplicates from any older bug get dropped.
	const fillers = entries.filter(
		(e) => !isSpecialRow(e) && !!deal.id && e.fillerForDealId === deal.id
	);
	for (const f of fillers) entries.splice(entries.indexOf(f), 1);

	const endMins = parseTimetableClock(endTime);
	if (endMins == null) return; // deal has no end time -> stale boundaries stay removed

	const sorted = sortTimetable(entries);
	const idx = sorted.indexOf(artistRow);
	const next = idx >= 0 ? sorted[idx + 1] : undefined;
	const nextMins = next ? parseTimetableClock(next.time) : null;

	// Something (artist line or CURFEW) already starts at the end time -> done.
	if (nextMins != null && nextMins === endMins) return;
	// The next row starts BEFORE the deal's end time -> overlapping set times.
	// Don't insert a line that would cut someone else's set short; the tab is
	// the place to resolve the conflict manually.
	if (nextMins != null && nextMins < endMins) return;

	// Gap (or nothing) after the set -> (re)insert the boundary line.
	const filler = fillers[0] || makeEntry(endTime!, '', 'Local', 'Default');
	filler.time = endTime!;
	filler.fillerForDealId = deal.id;
	insertBeforeCurfew(entries, filler);
}

/**
 * Applies one deal's suggested set time onto the entries array (mutates).
 * Returns true when the deal was applied. Only acts when set times are
 * enabled and a start time + artist name exist.
 */
export function applyDealToTimetable(entries: TimetableEntry[], deal: DealForTimetable): boolean {
	const st = deal?.setTimes;
	if (!st?.enabled) return false;
	const time = formatTimetableTime(st.from);
	const name = (deal.artistName || '').trim();
	if (!time || !name || name === 'NULL') return false;
	const role = deal.role === 'Support' ? 'Support' : 'Headliner';

	// 1. Row previously written by this exact deal (survives artist renames).
	let target = deal.id ? entries.find((e) => !isSpecialRow(e) && e.dealId === deal.id) : undefined;

	// 2. Row already carrying this artist's name.
	if (!target) {
		target = entries.find(
			(e) => hasRealArtist(e) && e.artist.trim().toLowerCase() === name.toLowerCase()
		);
	}

	// 3. An empty/TBD row starting exactly at this deal's start time — e.g. the
	//    boundary line auto-inserted after another artist's set. Claim it instead
	//    of stacking a second row at the same time.
	if (!target) {
		const fromMins = parseTimetableClock(time);
		target = entries.find(
			(e) => !isSpecialRow(e) && !hasRealArtist(e) && parseTimetableClock(e.time) === fromMins
		);
	}

	// 4. The role's placeholder row (artist TBD or empty).
	if (!target) {
		target = entries.find(
			(e) => !isSpecialRow(e) && !hasRealArtist(e) && (e.notes || '').trim() === role
		);
	}

	if (target) {
		target.time = time;
		target.artist = name;
		target.dealId = deal.id;
		delete target.fillerForDealId; // a claimed boundary row becomes a real artist row
		// Only overwrite the note when it's empty or a generic template label.
		const note = (target.notes || '').trim();
		if (note === '' || note === 'Headliner' || note === 'Support' || note === 'Local') {
			target.notes = role;
		}
		if (target.status !== 'Confirmed') target.status = 'Proposed';
	} else {
		target = makeEntry(time, name, role, 'Proposed');
		target.dealId = deal.id;
		insertBeforeCurfew(entries, target);
	}

	// End boundary: make the artist's set actually end at the deal's "to" time.
	syncDealEndBoundary(entries, target, deal, formatTimetableTime(st.to));
	return true;
}

// ---------------------------------------------------------------------------
// DB plumbing
// ---------------------------------------------------------------------------

async function getLinkedTimetableEvent(
	groupId: string
): Promise<{ event_id: number; timetable: TimetableEntry[] | null } | null> {
	const { data, error } = await supabase
		.from('events')
		.select('event_id, timetable')
		.eq('calendar_link', groupId)
		.limit(1)
		.maybeSingle();
	if (error) {
		console.error('[timetableSync] getLinkedTimetableEvent failed:', error);
		return null;
	}
	return data;
}

/** Confirmed calendar date's time JSON ({start, end}) for a group, if any. */
async function fetchConfirmedEventTime(
	groupId: string
): Promise<{ start: string | null; end: string | null }> {
	const empty = { start: null, end: null };
	try {
		const { data } = await supabase
			.from('calendar_events')
			.select('time')
			.eq('group_id', groupId)
			.eq('status', 'CONFIRMED')
			.limit(1)
			.maybeSingle();
		let t: any = data?.time;
		if (typeof t === 'string') t = JSON.parse(t);
		if (!t || typeof t !== 'object') return empty;
		return { start: t.start || null, end: t.end || null };
	} catch (e) {
		return empty;
	}
}

/**
 * Parse the calendar_data.event_deal payload (keyed "headliner_..." and
 * "support_..." format, possibly double-JSON-encoded) into a flat deal list.
 */
export function parseDealsFromEventDealPayload(raw: any): DealForTimetable[] {
	let data = raw;
	try {
		if (typeof data === 'string') data = JSON.parse(data);
		if (typeof data === 'string') data = JSON.parse(data);
	} catch (e) {
		return [];
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) return [];

	const out: DealForTimetable[] = [];
	const roles: Array<['Headliner' | 'Support', string]> = [
		['Headliner', 'headliner'],
		['Support', 'support']
	];
	for (const [role, prefix] of roles) {
		let i = 1;
		while (true) {
			const sfx = i === 1 ? '' : `_${i}`;
			const nameKey = `${prefix}_name${sfx}`;
			if (!(nameKey in data)) break;
			const name = data[nameKey];
			const dealObj = data[`${prefix}_deal${sfx}`] || {};
			if (name && name !== 'NULL' && name !== 'null' && dealObj?.dealType) {
				out.push({
					id: dealObj.id,
					role,
					artistName: name,
					setTimes: dealObj?.description?.setTimes
				});
			}
			i++;
		}
	}
	return out;
}

/** All deals of the calendar group's ACTIVE version. */
async function fetchActiveDeals(groupId: string): Promise<DealForTimetable[]> {
	try {
		const { data: cal } = await supabase
			.from('calendar')
			.select('current_version')
			.eq('id', groupId)
			.maybeSingle();
		const version = cal?.current_version || 1;
		const { data: cd } = await supabase
			.from('calendar_data')
			.select('event_deal')
			.eq('calendar_id', groupId)
			.eq('version_number', version)
			.maybeSingle();
		return parseDealsFromEventDealPayload(cd?.event_deal);
	} catch (e) {
		console.error('[timetableSync] fetchActiveDeals failed:', e);
		return [];
	}
}

async function saveTimetable(eventId: number, entries: TimetableEntry[]): Promise<void> {
	// Same normalization as SetTimesModal: empty artist rows are saved as
	// TBD / "Set Time Pending" (boundary lines included — hasRealArtist()
	// treats TBD as empty, so they can still be claimed by a later deal).
	const normalized = entries.map((entry) => {
		if (!entry.artist.trim() && entry.artist !== 'DOORS' && entry.artist !== 'CURFEW') {
			return { ...entry, artist: 'TBD', status: 'Tentative' as const };
		}
		return entry;
	});
	const finalEntries = sortTimetable(normalized);
	computeTimetableLengths(finalEntries);
	const { error } = await supabase
		.from('events')
		.update({ timetable: finalEntries })
		.eq('event_id', eventId);
	if (error) console.error('[timetableSync] saveTimetable failed:', error);
}

// ---------------------------------------------------------------------------
// Public sync entry points
// ---------------------------------------------------------------------------

/**
 * Deal saved/updated in the Deals tab -> push its suggested set time into the
 * linked show's timetable. Seeds the default template first if the show has
 * no timetable yet (also applying every other active deal for good measure).
 */
export async function syncDealSetTimesToTimetable(
	groupId: string | null | undefined,
	deal: DealForTimetable | null | undefined
): Promise<void> {
	try {
		if (!groupId || !deal) return;
		const st = (deal as any)?.description?.setTimes || deal.setTimes;
		const normalized: DealForTimetable = {
			id: deal.id,
			role: deal.role,
			artistName: deal.artistName,
			setTimes: st
		};
		if (!normalized.setTimes?.enabled || !normalized.setTimes?.from) return;

		const linked = await getLinkedTimetableEvent(groupId);
		if (!linked) return; // show not confirmed/linked yet — seeded on confirm instead

		let entries: TimetableEntry[];
		if (Array.isArray(linked.timetable) && linked.timetable.length > 0) {
			entries = linked.timetable.map((e) => ({ ...e }));
			applyDealToTimetable(entries, normalized);
		} else {
			const time = await fetchConfirmedEventTime(groupId);
			entries = buildDefaultTimetable(time.start, time.end);
			// Rebuild from every active deal so nothing saved earlier is lost.
			const allDeals = await fetchActiveDeals(groupId);
			for (const d of allDeals) applyDealToTimetable(entries, d);
			applyDealToTimetable(entries, normalized);
		}

		await saveTimetable(linked.event_id, entries);
	} catch (err) {
		console.error('[timetableSync] syncDealSetTimesToTimetable failed:', err);
	}
}

/**
 * Event time changed in the calendar header -> patch DOORS/CURFEW on the
 * linked show's timetable (seeding the template if the show has none yet).
 */
export async function syncEventTimeToTimetable(
	groupId: string | null | undefined,
	start: string | null,
	end: string | null
): Promise<void> {
	try {
		if (!groupId) return;
		const linked = await getLinkedTimetableEvent(groupId);
		if (!linked) return;

		if (!Array.isArray(linked.timetable) || linked.timetable.length === 0) {
			const entries = buildDefaultTimetable(start, end);
			const allDeals = await fetchActiveDeals(groupId);
			for (const d of allDeals) applyDealToTimetable(entries, d);
			await saveTimetable(linked.event_id, entries);
			return;
		}

		if (isAllDay(start, end)) return; // no real times to push

		const entries = linked.timetable.map((e) => ({ ...e }));
		let changed = false;
		const doorsTime = formatTimetableTime(start);
		const curfewTime = formatTimetableTime(end);
		for (const entry of entries) {
			if (entry.artist === 'DOORS' && doorsTime && entry.time !== doorsTime) {
				entry.time = doorsTime;
				changed = true;
			}
			if (entry.artist === 'CURFEW' && curfewTime && entry.time !== curfewTime) {
				entry.time = curfewTime;
				changed = true;
			}
		}
		if (changed) await saveTimetable(linked.event_id, entries);
	} catch (err) {
		console.error('[timetableSync] syncEventTimeToTimetable failed:', err);
	}
}

/**
 * Show confirmed in the calendar -> make sure the linked show has a timetable:
 * default template (adjusted to the confirmed event time) plus every active
 * deal's suggested set time. Never overwrites an existing timetable.
 */
export async function seedTimetableOnConfirm(groupId: string | null | undefined): Promise<void> {
	try {
		if (!groupId) return;
		const linked = await getLinkedTimetableEvent(groupId);
		if (!linked) return;
		if (Array.isArray(linked.timetable) && linked.timetable.length > 0) return;

		const time = await fetchConfirmedEventTime(groupId);
		const entries = buildDefaultTimetable(time.start, time.end);
		const allDeals = await fetchActiveDeals(groupId);
		for (const d of allDeals) applyDealToTimetable(entries, d);
		await saveTimetable(linked.event_id, entries);
	} catch (err) {
		console.error('[timetableSync] seedTimetableOnConfirm failed:', err);
	}
}
