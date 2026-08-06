// $lib/utils/localBacklineResolver.ts
//
// Single source of truth for "what backline does a Local artist get?".
//
// Rule (from the timetable, top to bottom):
//   A Local artist inherits the backline of the nearest NON-local artist
//   (Headliner / Support) that has an actual tech rider — searching FORWARD
//   through the timetable first, then BACKWARD if the forward search runs out.
//
// Locals are skipped while walking, so a chain of Local -> Local -> Headliner
// collapses onto the Headliner. Example (NCG, Aug 7 2026):
//
//   DOORS
//   Joss              (Local)      -> forward: Riendo (local, skip) -> Adventure Club  ✅
//   Riendo            (Local)      -> forward: Adventure Club                          ✅
//   Adventure Club    (Headliner)  -- source
//   AC B2B Local      (Local)      -> forward: Kat2Kat (local) -> CURFEW -> end
//                                     backward: Adventure Club                          ✅
//   Kat2Kat B2B MHoly (Local)      -> forward: end; backward: AC B2B Local (local, skip)
//                                     -> Adventure Club                                 ✅
//   CURFEW
//
// SFX is NEVER inherited by a Local. SFX lives in its own `sfx_rider` column,
// but free-text entries in `tech_rider.other` are filtered too, just in case
// someone typed "4x Sparks" in there.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TimetableEntry {
	id?: string;
	time?: string;
	notes?: string;
	artist: string;
	length?: string;
	status?: string;
}

export interface BacklineRider {
	selected_mixer?: string;
	equipment?: Record<string, { selected?: boolean; qty?: number; editableQty?: boolean }>;
	other?: Array<{ id?: string; text?: string }>;
	confirmed?: boolean;
	[key: string]: any;
}

export interface ResolvedBackline {
	/** The rider to use, already stripped of mics and SFX. Null when nothing usable exists. */
	rider: BacklineRider | null;
	/** Which artist the backline was copied from. */
	sourceArtist: string | null;
	/** Whether the source sits after or before the local in the timetable. */
	direction: 'after' | 'before' | 'fallback' | null;
	/** Slot names walked through to get there — handy for debugging. */
	chain: string[];
}

/* --------------------------------------------------------------- helpers -- */

/** Slots that are markers, not performers. */
const NON_ARTIST_SLOTS = new Set(['doors', 'curfew', 'open', 'close', 'opening', 'closing']);

/** Anything matching these never crosses over to a Local's backline. */
const SFX_KEYWORDS = [
	'spark',
	'co2',
	'cryo',
	'confetti',
	'streamer',
	'pyro',
	'flame',
	'smoke',
	'haze',
	'fog',
	'laser'
];

/** Mic lines are never inherited either — locals use the house mic setup. */
const EXCLUDED_EQUIPMENT = ['wireless mic', 'wired mic'];

export function parseMaybeJson<T = any>(value: any): T | null {
	if (!value) return null;
	if (typeof value === 'object') return value as T;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return null;
		}
	}
	return null;
}

/** "Kat2Kat B2B MHoly" -> ["Kat2Kat", "MHoly"] */
export function splitB2B(name: string): string[] {
	if (!name) return [];
	return name
		.split(/\s+B2B\s+/i)
		.map((n) => n.trim())
		.filter(Boolean);
}

export function isNonArtistSlot(name: string): boolean {
	return NON_ARTIST_SLOTS.has((name || '').trim().toLowerCase());
}

/** Loose comparison so "Kat2Kat" still matches the advance row "KAT2KATT". */
function normalizeName(name: string): string {
	return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function namesMatch(a: string, b: string): boolean {
	const na = normalizeName(a);
	const nb = normalizeName(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	// Tolerate small spelling drift between the timetable and events_advance.
	if (na.length >= 3 && nb.length >= 3) {
		return na.startsWith(nb) || nb.startsWith(na);
	}
	return false;
}

function isLocalType(artistType?: string | null): boolean {
	return (artistType || '').trim().toLowerCase() === 'local';
}

/* ------------------------------------------------------------ rider prep -- */

function looksLikeSfx(text: string): boolean {
	const lower = (text || '').toLowerCase();
	return SFX_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/** Removes mics and any SFX-sounding free text. Always run before handing a rider to a Local. */
export function stripLocalRider(rider: BacklineRider | null): BacklineRider | null {
	if (!rider) return null;

	const equipment: BacklineRider['equipment'] = {};
	for (const [key, item] of Object.entries(rider.equipment || {})) {
		if (EXCLUDED_EQUIPMENT.includes(key.trim().toLowerCase())) continue;
		equipment[key] = item;
	}

	const other = (Array.isArray(rider.other) ? rider.other : []).filter(
		(req) => req?.text?.trim() && !looksLikeSfx(req.text)
	);

	return { ...rider, equipment, other };
}

/** True when the rider actually has backline in it (an empty shell doesn't count). */
export function hasBacklineContent(rider: BacklineRider | null): boolean {
	if (!rider) return false;
	if (rider.selected_mixer && String(rider.selected_mixer).trim()) return true;
	if (Object.values(rider.equipment || {}).some((item) => item?.selected)) return true;
	if ((Array.isArray(rider.other) ? rider.other : []).some((req) => req?.text?.trim())) return true;
	return false;
}

/** ["1x DJM-A9", "4x CDJ-3000", ...] */
export function buildBacklineLines(rider: BacklineRider | null): string[] {
	if (!rider) return [];
	const lines: string[] = [];

	if (rider.selected_mixer && String(rider.selected_mixer).trim()) {
		lines.push(`1x ${String(rider.selected_mixer).trim()}`);
	}

	for (const [key, item] of Object.entries(rider.equipment || {})) {
		if (!item?.selected) continue;
		if (EXCLUDED_EQUIPMENT.includes(key.trim().toLowerCase())) continue;
		lines.push(`${item.qty ?? 1}x ${key}`);
	}

	for (const req of Array.isArray(rider.other) ? rider.other : []) {
		const text = req?.text?.trim();
		if (text && !looksLikeSfx(text)) lines.push(text);
	}

	return lines;
}

export function buildBacklineHtml(rider: BacklineRider | null): string {
	return buildBacklineLines(rider)
		.map((line) => `* ${line}<br>`)
		.join('');
}

export function buildBacklineText(rider: BacklineRider | null): string {
	return buildBacklineLines(rider)
		.map((line) => `* ${line}`)
		.join('\n');
}

/* ---------------------------------------------------------- the resolver -- */

interface AdvanceRow {
	artist_name: string;
	artist_type?: string | null;
	tech_rider?: any;
}

interface ResolveOptions {
	supabase: SupabaseClient;
	eventId: number | string;
	artistName: string;
	/** Pass it in if you already have it, otherwise it's fetched. */
	timetable?: TimetableEntry[] | string | null;
}

export async function resolveLocalBackline({
	supabase,
	eventId,
	artistName,
	timetable
}: ResolveOptions): Promise<ResolvedBackline> {
	const empty: ResolvedBackline = { rider: null, sourceArtist: null, direction: null, chain: [] };
	if (!eventId || !artistName) return empty;

	// ---- 1. Timetable -------------------------------------------------------
	let entries = parseMaybeJson<TimetableEntry[]>(timetable) || [];
	if (!Array.isArray(entries) || entries.length === 0) {
		const { data } = await supabase
			.from('events')
			.select('timetable')
			.eq('event_id', eventId)
			.single();
		entries = parseMaybeJson<TimetableEntry[]>(data?.timetable) || [];
	}
	if (!Array.isArray(entries)) entries = [];

	// ---- 2. Every advance row for this event -------------------------------
	const { data: advanceRows } = await supabase
		.from('events_advance')
		.select('artist_name, artist_type, tech_rider')
		.eq('event_id', eventId);

	const advances: AdvanceRow[] = advanceRows || [];

	/** Finds the advance row behind a timetable slot, handling B2B and spelling drift. */
	const findAdvance = (slotArtist: string): AdvanceRow | null => {
		const candidates = [slotArtist, ...splitB2B(slotArtist)];
		for (const candidate of candidates) {
			const match = advances.find((row) => namesMatch(row.artist_name, candidate));
			if (match) return match;
		}
		return null;
	};

	/** A slot can be a backline source only if it's a non-Local with real content. */
	const sourceFromSlot = (
		slotArtist: string,
		allowLocal = false
	): { rider: BacklineRider; artist: string } | null => {
		if (isNonArtistSlot(slotArtist)) return null;

		const candidates = [slotArtist, ...splitB2B(slotArtist)];
		for (const candidate of candidates) {
			const row = advances.find((r) => namesMatch(r.artist_name, candidate));
			if (!row) continue;
			if (!allowLocal && isLocalType(row.artist_type)) continue;

			const rider = parseMaybeJson<BacklineRider>(row.tech_rider);
			if (hasBacklineContent(rider)) {
				return { rider: rider as BacklineRider, artist: row.artist_name };
			}
		}
		return null;
	};

	// ---- 3. Where does this artist sit? ------------------------------------
	const currentIndex = entries.findIndex((entry) => {
		if (!entry?.artist) return false;
		if (namesMatch(entry.artist, artistName)) return true;
		return splitB2B(entry.artist).some((name) => namesMatch(name, artistName));
	});

	const chain: string[] = [];

	if (currentIndex !== -1) {
		// ---- 4a. Walk forward -----------------------------------------------
		for (let i = currentIndex + 1; i < entries.length; i++) {
			const slot = entries[i]?.artist;
			if (!slot || isNonArtistSlot(slot)) continue;
			chain.push(slot);
			const found = sourceFromSlot(slot);
			if (found) {
				return {
					rider: stripLocalRider(found.rider),
					sourceArtist: found.artist,
					direction: 'after',
					chain
				};
			}
		}

		// ---- 4b. Walk backward ----------------------------------------------
		for (let i = currentIndex - 1; i >= 0; i--) {
			const slot = entries[i]?.artist;
			if (!slot || isNonArtistSlot(slot)) continue;
			chain.push(slot);
			const found = sourceFromSlot(slot);
			if (found) {
				return {
					rider: stripLocalRider(found.rider),
					sourceArtist: found.artist,
					direction: 'before',
					chain
				};
			}
		}
	}

	// ---- 5. Fallbacks so the email always generates -------------------------
	// Not in the timetable, or an all-local lineup. Prefer Headliner, then
	// Support, then any non-local, then finally any local that has content.
	const byPriority = [...advances].sort((a, b) => {
		const rank = (row: AdvanceRow) => {
			const type = (row.artist_type || '').toLowerCase();
			if (type === 'headliner') return 0;
			if (type === 'support') return 1;
			if (type === 'local') return 3;
			return 2;
		};
		return rank(a) - rank(b);
	});

	for (const row of byPriority) {
		if (namesMatch(row.artist_name, artistName)) continue; // never inherit from yourself
		const rider = parseMaybeJson<BacklineRider>(row.tech_rider);
		if (hasBacklineContent(rider)) {
			return {
				rider: stripLocalRider(rider),
				sourceArtist: row.artist_name,
				direction: 'fallback',
				chain
			};
		}
	}

	return { ...empty, chain };
}