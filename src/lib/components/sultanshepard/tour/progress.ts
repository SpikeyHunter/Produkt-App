import type {
	EventDetailsData,
	VenueInfoData,
	ProductionData,
	MediaData,
	ImmigrationData,
	SSCrew,
	CrewType
} from '$lib/types/tour';

// ============================================================
// PROGRESS ENGINE — generic, reusable across the whole app.
//
// The idea: every section/tab builds a list of ProgressElement
// (one entry per "thing that needs to be filled out"), then hands
// that list to aggregateProgress(). Adding/removing an element
// automatically reshuffles everyone else's share of the 100%.
//
// e.g. 4 elements → each worth 25%. Enable a 5th (Singers, Media...) →
// they instantly become 20% each, automatically, via aggregateProgress.
//
// To add progress for a new tab later, write a small
// calculateXProgress() function below (copy the Event Details one
// as a template), then call it from wherever that tab's progress
// is needed (tabs.ts, a section component, etc). Two small helpers
// below — countCrew() and subdividedCompletion() — cover the two
// patterns that show up again and again (crew-count requirements,
// and "1 element subdivided across N rows" requirements like Run of
// Show, Local Crew, Immigration rows, Guestlist, etc.) so future tabs
// don't need to re-derive that logic from scratch.
// ============================================================

export interface ProgressElement {
	/** Human readable label — handy for debugging/tooltips, not shown to users. */
	label: string;
	/** Relative weight against the other elements. Defaults to 1 (every element counts equally). */
	weight?: number;
	/**
	 * `true` / `false` for elements that are simply done or not.
	 * A number between 0 and 1 for elements that can be PARTIALLY done
	 * (e.g. "3 of 5 Run of Show lines filled in" → 0.6).
	 */
	completed: boolean | number;
}

/**
 * Reduces a list of ProgressElements into a single 0–100 percentage,
 * always scaled against 100% no matter how many elements exist.
 */
export function aggregateProgress(elements: ProgressElement[]): number {
	if (!elements.length) return 0;

	let totalWeight = 0;
	let doneWeight = 0;

	for (const el of elements) {
		const weight = el.weight ?? 1;
		const credit =
			typeof el.completed === 'boolean'
				? el.completed
					? 1
					: 0
				: Math.max(0, Math.min(1, el.completed));

		totalWeight += weight;
		doneWeight += credit * weight;
	}

	if (totalWeight === 0) return 0;
	return Math.round((doneWeight / totalWeight) * 100);
}

// ============================================================
// SHARED HELPERS — reusable by any future calculateXProgress()
// ============================================================

/**
 * Counts how many ids in `crewIds` resolve to a real crew member,
 * optionally excluding certain crew_types (e.g. 'artist', who's always
 * auto-assigned/present and shouldn't count toward "needs N more crew"
 * requirements). Use this any time a tab's progress depends on "X crew
 * assigned" so the artist-exclusion logic lives in exactly one place.
 */
export function countCrew(
	crewIds: string[] | undefined,
	allCrew: SSCrew[],
	opts: { exclude?: CrewType[] } = {}
): number {
	const excluded = new Set(opts.exclude ?? []);
	return (crewIds || [])
		.map((id) => allCrew.find((c) => c.id === id))
		.filter((c): c is SSCrew => !!c && !excluded.has(c.crew_type)).length;
}

/**
 * For a list of rows that should each be "complete" once some condition is
 * met (Run of Show lines, Local Crew rows, Immigration rows, Guestlist...),
 * returns the fraction (0–1) of rows that satisfy `isDone`. An empty list
 * counts as 0% (nothing filled in yet), not 100%.
 */
export function subdividedCompletion<T>(items: T[], isDone: (item: T) => boolean): number {
	if (!items.length) return 0;
	return items.filter(isDone).length / items.length;
}

// ============================================================
// EVENT DETAILS
// ============================================================
//
// Every bullet below is ONE element (equal weight) unless noted.
//
//  - Artist entrance / accreditation field
//  - Contacts — ONE element PER contact line
//  - Load-in instructions
//  - Parking instructions
//  - Bus parking instructions — only counted if enabled (default: enabled)
//  - Main crew — needs 2+ crew OTHER than the artist (artist is always
//    auto-assigned/present, so they're excluded from the count entirely)
//  - Singers crew — only counted if the Singers toggle is ON, needs 1+
//  - Media crew — only counted if the Media toggle is ON, needs 1+
//  - Run of Show — ONE element, internally subdivided per-line: a line
//    only counts once it has BOTH a time and a description
// ============================================================

export function calculateEventDetailsProgress(
	data: EventDetailsData,
	allCrew: SSCrew[] = []
): number {
	if (!data) return 0;

	const elements: ProgressElement[] = [];

	// 1. Artist entrance / accreditation
	elements.push({
		label: 'Artist entrance / accreditation',
		completed: !!data.artist_entrance?.trim()
	});

	// 2. Contacts — 1 element per line. A contact line counts once it
	// has at least a role + a name.
	const contacts = data.contacts || [];
	contacts.forEach((c, i) => {
		elements.push({
			label: `Contact ${i + 1}`,
			completed: !!(c.role?.trim() && c.name?.trim())
		});
	});

	// 3. Load-in instructions
	elements.push({
		label: 'Load-in instructions',
		completed: !!data.load_in_instructions?.trim()
	});

	// 4. Parking instructions
	elements.push({
		label: 'Parking instructions',
		completed: !!data.parking_instructions?.trim()
	});

	// 5. Bus parking instructions — only counts if enabled (UI defaults to true)
	if (data.bus_parking_enabled ?? true) {
		elements.push({
			label: 'Bus parking instructions',
			completed: !!data.bus_parking_instructions?.trim()
		});
	}

	// 6. Main crew — needs 2+ crew besides the artist. The artist is excluded
	// entirely via countCrew(), since they're auto-assigned and always present.
	const nonArtistCrewCount = countCrew(data.crew_ids, allCrew, { exclude: ['artist'] });
	elements.push({
		label: 'Main crew (2+ non-artist)',
		completed: nonArtistCrewCount >= 2
	});

	// 7. Singers — only counted if enabled, needs 1+
	if (data.singers_enabled) {
		elements.push({
			label: 'Singers crew (1+)',
			completed: (data.singer_crew_ids || []).length >= 1
		});
	}

	// 8. Media crew — only counted if enabled, needs 1+
	if (data.media_crew_enabled) {
		elements.push({
			label: 'Media crew (1+)',
			completed: (data.media_crew || []).length >= 1
		});
	}

	// 9. Run of Show — ONE element, subdivided per-line internally.
	// A line only counts once it has BOTH a time AND a description.
	const setTimes = data.set_times || [];
	const runOfShowCompletion = subdividedCompletion(
		setTimes,
		(r) => !!(r.time?.trim() && r.label?.trim())
	);
	elements.push({ label: 'Run of show', completed: runOfShowCompletion });

	return aggregateProgress(elements);
}

// ============================================================
// VENUE INFO
// ============================================================

export function calculateVenueInfoProgress(data: VenueInfoData): number {
	if (!data) return 0;
	const elements: ProgressElement[] = [];

	// 1. Indoor/Outdoor
	elements.push({ label: 'Indoor/Outdoor', completed: !!data.indoor_outdoor });

	// 2. Venue Type (check custom input if "Other")
	const isOther = data.venue_type === 'Other';
	elements.push({
		label: 'Venue Type',
		completed: isOther ? !!data.venue_type_custom?.trim() : !!data.venue_type
	});

	// 3. WiFi (2 elements if enabled)
	if (data.wifi_enabled) {
		elements.push({ label: 'WiFi Login', completed: !!data.wifi_login?.trim() });
		elements.push({ label: 'WiFi Password', completed: !!data.wifi_password?.trim() });
	}

	// 4. Shower
	if (data.shower) {
		elements.push({ label: 'Shower', completed: true });
	}

	// 5. Green Rooms
	// (Reduces percentage implicitly if no crew assigned, since r.assigned.length = 0)
	if (data.green_room) {
		const rooms = data.green_rooms || [];
		rooms.forEach((r, i) => {
			elements.push({
				label: `Green Room ${i + 1}`,
				completed: !!(r.name?.trim() && r.assigned?.length > 0)
			});
		});
	}

	// 6. Venue Notes
	if (data.notes_enabled) {
		elements.push({ label: 'Venue Notes', completed: !!data.notes?.trim() });
	}

	return aggregateProgress(elements);
}

// ============================================================
// PRODUCTION
// ============================================================

export function calculateProductionProgress(data: ProductionData): number {
	if (!data) return 0;
	const elements: ProgressElement[] = [];

	// 1. Artist Specs
	elements.push({ label: 'Artist Specs Status', completed: !!data.artist_specs_status });

	// 2. Power Confirmed
	elements.push({ label: 'Power Confirmed', completed: !!data.power_confirmed });

	// 3. Local Crew & Rate
	elements.push({ label: 'Local Crew Added', completed: (data.local_crew || []).length > 0 });
	elements.push({ label: 'Fixed Rate', completed: (data.stagehands_rate_total || 0) > 0 });

	// 4. Load In & Out Times
	elements.push({ label: 'Load In Time', completed: !!data.load_in_time });
	if (data.load_in_time) {
		elements.push({ label: 'Load In Confirmed', completed: !!data.load_in_confirmed });
	}

	elements.push({ label: 'Load Out Time', completed: !!data.load_out_time });
	if (data.load_out_time) {
		elements.push({ label: 'Load Out Confirmed', completed: !!data.load_out_confirmed });
	}

	// 5. Venue Specs
	elements.push({ label: 'Venue Specs File/Link', completed: !!data.venue_specs_link });
	elements.push({ label: 'Stage Height', completed: !!data.stage_height });
	elements.push({ label: 'Stage Width', completed: !!data.stage_width });
	elements.push({ label: 'Stage Depth', completed: !!data.stage_depth });

	// 6. LED Wall Details (Only counted if LED wall is checked)
	if (data.led_wall) {
		elements.push({ label: 'LED Width', completed: !!data.led_width });
		elements.push({ label: 'LED Height', completed: !!data.led_height });
		elements.push({ label: 'Pixel Map Link', completed: !!data.pixel_map_link });
	}

	return aggregateProgress(elements);
}

// ============================================================
// MEDIA
// ============================================================
//
// Gated by the media crew assigned in Event Details:
//  - If a Photographer is on the media crew, that brief is REQUIRED:
//      • Link — "link received" must be ON and a link pasted (off = missing)
//      • Notes — brief notes must be filled (empty = missing)
//  - Same for a Videographer.
//  - Interviews — only if the section is enabled; ONE element subdivided per
//    row. A row counts once it has name + time + length.
//  - Meet & Greet — only if enabled; per-row, counts once it has name + time +
//    length + a people count (# pax).
// With no media crew at all there are no elements → 0% (the tab is rendered
// "inactive/grayed" separately via isTabInactive()).
// ============================================================

export function calculateMediaProgress(data: MediaData, ed?: EventDetailsData): number {
	if (!data) return 0;

	const mediaCrew = ed?.media_crew_enabled ? ed?.media_crew || [] : [];
	const hasPhotographer = mediaCrew.some((m) => /photograph/i.test(m.role || ''));
	const hasVideographer = mediaCrew.some((m) => /videograph/i.test(m.role || ''));
	const hasAnyMedia = mediaCrew.length >= 1;

	const elements: ProgressElement[] = [];

	// A brief needs the link (received + pasted) AND notes. "Link received" off
	// counts as missing; empty notes count as missing.
	const linkDone = (b: { link_received?: boolean; link?: string } | undefined) =>
		!!(b?.link_received && b?.link?.trim());
	const notesDone = (b: { notes?: string } | undefined) => !!b?.notes?.trim();

	// Briefs are required whenever the matching role is on the media crew.
	if (hasPhotographer) {
		elements.push({ label: 'Photographer link', completed: linkDone(data.photographer) });
		elements.push({ label: 'Photographer notes', completed: notesDone(data.photographer) });
	}
	if (hasVideographer) {
		elements.push({ label: 'Videographer link', completed: linkDone(data.videographer) });
		elements.push({ label: 'Videographer notes', completed: notesDone(data.videographer) });
	}

	if (hasAnyMedia && data.interviews_enabled) {
		elements.push({
			label: 'Interviews',
			completed: subdividedCompletion(
				data.interviews || [],
				(r) => !!(r.name?.trim() && r.hours?.trim() && r.length?.trim())
			)
		});
	}

	if (hasAnyMedia && data.meet_greet_enabled) {
		elements.push({
			label: 'Meet & Greet',
			completed: subdividedCompletion(
				data.meet_greets || [],
				(r) => !!(r.name?.trim() && r.hours?.trim() && r.length?.trim() && (r.people || 0) > 0)
			)
		});
	}

	return aggregateProgress(elements);
}

// ============================================================
// IMMIGRATION
// ============================================================
//
// Only relevant when "Immigration needed for this show" is ON (otherwise the
// tab is rendered inactive/grayed via isTabInactive(), so this returns 0).
// One card per assigned crew member; each card contributes:
//   - Info sent to promoter
//   - Letter / visa received
//   - (once received) Document link/upload + Sent to crew
//   - (only if ETA required) ETA confirmed
// ============================================================

export function calculateImmigrationProgress(data: ImmigrationData): number {
	// Off / untouched → 0 (tab grayed via isTabInactive; no false checkmark).
	if (!data || data.enabled !== true) return 0;

	const rows = data.rows || [];
	if (!rows.length) return 0;

	const elements: ProgressElement[] = [];
	for (const r of rows) {
		elements.push({ label: 'Info to promoter', completed: !!r.info_sent_to_promoter });
		elements.push({ label: 'Letter/visa received', completed: !!r.letter_or_visa_received });
		if (r.letter_or_visa_received) {
			elements.push({ label: 'Document', completed: !!r.document_link?.trim() });
			elements.push({ label: 'Sent to crew', completed: !!r.sent_to_crew });
		}
		if (r.eta_required) {
			elements.push({ label: 'ETA confirmed', completed: !!r.eta_confirmed });
		}
	}

	return aggregateProgress(elements);
}

// ============================================================
// SHARED PROGRESS RING — used by TourTabsPanel + EventDetailsSection
// (and any future component) so the little circular progress
// indicator looks/behaves identically everywhere in the app.
// ============================================================

export const RING_RADIUS = 15;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 94.2

/** Floor so a tiny (1–9%) progress still shows a visible sliver on the ring. */
export const MIN_VISIBLE_RING_PERCENT = 10;

export function getRingColor(percent: number): string {
	return percent >= 100 ? '#86EFAC' : '#E1FF00';
}

/**
 * Tailwind text-color class for the progress ring + its label, by state:
 *   0%      → text-problem    (nothing done)
 *   1–99%   → text-proposed   (in progress)
 *   100%    → text-confirmed  (complete — shown as a checkmark)
 * Pair with stroke="currentColor" on the ring so it always tracks the app's
 * status tokens exactly, with no hardcoded hex to drift out of sync.
 */
export function getRingColorClass(percent: number): string {
	if (percent >= 100) return 'text-confirmed';
	if (percent > 0) return 'text-proposed';
	return 'text-problem';
}

/**
 * `stroke-dasharray` for the progress ring. The number shown INSIDE the
 * circle is always the real percentage (out of 100) — this only affects
 * how much of the ring visually fills in, so 0% still reads as a fully
 * empty ring, and anything above 0% is never an invisible hairline
 * (it always shows at least MIN_VISIBLE_RING_PERCENT worth of fill).
 */
export function getRingDashArray(percent: number): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const visual = clamped > 0 ? Math.max(clamped, MIN_VISIBLE_RING_PERCENT) : 0;
	return `${(visual / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
}