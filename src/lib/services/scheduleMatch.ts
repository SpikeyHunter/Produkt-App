// src/lib/services/scheduleMatch.ts
//
// Finds the schedule_techs row that belongs to an event, so the crew can be
// pulled from it.
//
// Match order:
//   1. a row the user pinned by hand (email_data.schedule_row_id)
//   2. the exact calendar link: events.calendar_link === schedule_techs.group_id
//   3. the same DAY (year-month-day), keeping only show types for that venue
//      (Bazart -> Bazart Nuits · New City Gas -> Tour Prod / NCG Show / DSTRKT /
//      NCG 360) and never Corpo / Maintenance / Montage / Demontage / Canceled.
//      Rows with no type at all are ranked last, never dropped.
//
// When more than one row survives and nothing stands out, the answer is
// "ambiguous" and the caller shows the month's rows to pick from.

import { supabase } from '$lib/supabase';
import type { CrewAssignments, CrewMember } from '$lib/types/emailtech';

export interface ScheduleRow {
	id: number;
	date: string;
	year: number | null;
	type: string | null;
	event_name: string | null;
	crew_call: string | null;
	op_hours: string | null;
	ld: string | null;
	video: string | null;
	vj: string | null;
	sound: string | null;
	tech_sm: string | null;
	dt: string | null;
	artist_liaison: string | null;
	notes: string | null;
	group_id: string | null;
	calendar_event_id: string | null;
}

export type MatchStatus = 'pinned' | 'exact' | 'auto' | 'ambiguous' | 'none';

export interface ScheduleMatch {
	status: MatchStatus;
	row: ScheduleRow | null;
	/** same-day rows that qualified, best first */
	candidates: ScheduleRow[];
	/** every row of that month — what the pick modal shows */
	monthRows: ScheduleRow[];
	reason: string;
}

/** Types that are never a show. */
export const EXCLUDED_TYPES = ['corpo', 'maintenance', 'montage', 'demontage', 'canceled', 'cancelled', 'hold'];

/** Show types per venue (lower-case). Anything else is a mismatch. */
export const VENUE_TYPES: Record<string, string[]> = {
	bazart: ['bazart nuits', 'nuits bazart', 'bazart'],
	'new city gas': ['tour prod', 'ncg show', 'dstrkt', 'ncg 360', 'ncg360', 'moet city', 'other']
};

const norm = (s: string | null | undefined) =>
	String(s || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\[.*?\]/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

const tokens = (s: string | null | undefined) =>
	norm(s)
		.split(' ')
		.filter((t) => t.length > 2 && !['the', 'and', 'with', 'feat', 'b2b', 'live'].includes(t));

export function isExcludedType(type: string | null | undefined): boolean {
	const t = norm(type);
	if (!t) return false;
	return EXCLUDED_TYPES.some((x) => t.includes(x));
}

/** Also skips rows whose NAME says it is a build/strike day with no type set. */
function looksLikeNonShow(row: ScheduleRow): boolean {
	if (isExcludedType(row.type)) return true;
	const n = norm(row.event_name);
	return /\b(montage|demontage|maintenance|corpo)\b/.test(n) && !norm(row.type);
}

function venueScore(venue: string | null | undefined, type: string | null | undefined): number {
	const t = norm(type);
	const v = norm(venue);
	if (!t) return 0; // untyped: neutral, ranked last on ties
	for (const [venueKey, types] of Object.entries(VENUE_TYPES)) {
		if (v.includes(venueKey)) {
			return types.some((x) => t === x || t.includes(x)) ? 3 : -5;
		}
	}
	return 1; // unknown venue: any show type is fine
}

function nameScore(row: ScheduleRow, eventName: string, artistName: string): number {
	const rowT = new Set(tokens(row.event_name));
	if (rowT.size === 0) return 0;
	const want = new Set([...tokens(eventName), ...tokens(artistName)]);
	let hits = 0;
	for (const t of want) if (rowT.has(t)) hits++;
	if (hits === 0) return 0;
	return Math.min(3, hits);
}

/** Day and month bounds from "YYYY-MM-DD". */
function monthBounds(dateStr: string): { first: string; last: string } | null {
	const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const last = new Date(y, mo, 0).getDate();
	return { first: `${m[1]}-${m[2]}-01`, last: `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}` };
}

export async function findScheduleRow(opts: {
	eventDate: string;
	venue: string | null | undefined;
	eventName: string;
	artistName: string;
	calendarLink?: string | null;
	pinnedRowId?: number | null;
}): Promise<ScheduleMatch> {
	const day = String(opts.eventDate || '').slice(0, 10);
	const bounds = monthBounds(day);
	if (!bounds) return { status: 'none', row: null, candidates: [], monthRows: [], reason: 'No event date' };

	const { data, error } = await supabase
		.from('schedule_techs')
		.select(
			'id, date, year, type, event_name, crew_call, op_hours, ld, video, vj, sound, tech_sm, dt, artist_liaison, notes, group_id, calendar_event_id'
		)
		.gte('date', bounds.first)
		.lte('date', bounds.last)
		.order('date', { ascending: true })
		.order('sort_order', { ascending: true });

	if (error) {
		console.error('[schedule] read failed:', error.message);
		return { status: 'none', row: null, candidates: [], monthRows: [], reason: error.message };
	}
	const monthRows = (data || []) as ScheduleRow[];

	// 1. pinned by hand
	if (opts.pinnedRowId) {
		const pinned = monthRows.find((r) => r.id === opts.pinnedRowId);
		if (pinned) return { status: 'pinned', row: pinned, candidates: [pinned], monthRows, reason: 'Chosen manually' };
	}

	// 2. exact: calendar link
	if (opts.calendarLink) {
		const exact = monthRows.find((r) => r.group_id && r.group_id === opts.calendarLink);
		if (exact) return { status: 'exact', row: exact, candidates: [exact], monthRows, reason: 'Linked to the calendar event' };
	}

	// 3. same day, show types only
	const sameDay = monthRows.filter((r) => String(r.date).slice(0, 10) === day);
	const shows = sameDay.filter((r) => !looksLikeNonShow(r));
	if (shows.length === 0) {
		return {
			status: 'none',
			row: null,
			candidates: [],
			monthRows,
			reason: sameDay.length ? 'Only non-show rows that day' : 'No schedule row that day'
		};
	}

	const scored = shows
		.map((row) => ({
			row,
			score: venueScore(opts.venue, row.type) + nameScore(row, opts.eventName, opts.artistName)
		}))
		.filter((s) => s.score > -5) // a different venue's show is never it
		.sort((a, b) => b.score - a.score);

	if (scored.length === 0) {
		return { status: 'none', row: null, candidates: [], monthRows, reason: 'Shows that day belong to another venue' };
	}
	const candidates = scored.map((s) => s.row);
	if (scored.length === 1) {
		return { status: 'auto', row: candidates[0], candidates, monthRows, reason: 'Only show that day' };
	}
	const [top, second] = scored;
	if (top.score >= 3 && top.score - second.score >= 2) {
		return { status: 'auto', row: top.row, candidates, monthRows, reason: 'Best venue/name match' };
	}
	return { status: 'ambiguous', row: null, candidates, monthRows, reason: 'Several shows that day' };
}

/* ------------------------------------------------------- crew from a row */

function splitNames(raw: string | null): string[] {
	if (!raw) return [];
	const s = raw.trim();
	if (!s || /^n\/?a$/i.test(s)) return [];
	return s
		.split(/[+&,\/]/)
		.map((x) => x.trim())
		.filter((x) => x.length > 0 && !/^n\/?a$/i.test(x));
}

function findBestMatch(partial: string, allCrew: CrewMember[]): string | null {
	const search = norm(partial);
	if (!search) return null;
	const exact = allCrew.find((c) => norm(c.name) === search);
	if (exact) return exact.name;
	if (search.length < 2) return null;
	const starts = allCrew.find((c) => norm(c.name).startsWith(search));
	if (starts) return starts.name;
	const word = allCrew.find((c) => norm(c.name).split(' ').includes(search));
	if (word) return word.name;
	if (search.length > 3) {
		const inc = allCrew.find((c) => norm(c.name).includes(search));
		if (inc) return inc.name;
	}
	return null;
}

/** Map a schedule row's staff columns onto the crew slots. */
export function crewFromScheduleRow(row: ScheduleRow, allCrew: CrewMember[]): CrewAssignments {
	const out: CrewAssignments = {};
	const put = (field: string | null, role: string) => {
		const names = splitNames(field).map((raw) => findBestMatch(raw, allCrew) || raw);
		if (names.length) out[role] = Array.from(new Set(names));
	};
	put(row.ld, 'LD');
	put(row.video, 'VIDEO');
	put(row.vj, 'VJ');
	put(row.sound, 'SOUND');
	put(row.tech_sm, 'TECH');
	put(row.dt, 'DT');
	return out;
}

/** "8AM-6PM" / "18:30" -> "HH:MM" of the crew call start, when parseable. */
export function crewCallStartFromRow(row: ScheduleRow | null): string {
	const raw = String(row?.crew_call || '').trim();
	if (!raw) return '';
	const first = raw.split(/[-–]/)[0].trim();
	const ampm = first.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
	if (ampm) {
		let h = Number(ampm[1]) % 12;
		if (ampm[3].toUpperCase() === 'PM') h += 12;
		return `${String(h).padStart(2, '0')}:${ampm[2] || '00'}`;
	}
	const plain = first.match(/^(\d{1,2}):(\d{2})/);
	return plain ? `${plain[1].padStart(2, '0')}:${plain[2]}` : '';
}
