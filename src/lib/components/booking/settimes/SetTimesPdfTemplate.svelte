<script lang="ts">
	import type { TimetableEntry } from '$lib/services/eventsService';

	export let eventDate: string = '';
	export let headlinerName: string = 'TBA';
	export let eventType: string = 'Event';
	export let venue: string | null = null;
	/** Full override for the line above the set times. When empty, it is derived from the venue. */
	export let title: string = '';
	export let timetable: TimetableEntry[] = [];

	// ---------------------------------------------------------------
	// Page geometry (points — 72pt = 1in) so every measure matches the PDF
	// ---------------------------------------------------------------
	const PT = 72;
	const PAGE_W = 8.5 * PT;
	const PAGE_H = 11 * PT;
	const CONTENT_LEFT = 2.3 * PT; // matches left: 2.3in
	const CONTENT_RIGHT = 1 * PT; // matches right: 1in
	const CONTENT_TOP = 2.2 * PT; // matches top: 2.2in
	const BOTTOM_RESERVED = 1.7 * PT; // logo block + breathing room
	const CONTENT_W = PAGE_W - CONTENT_LEFT - CONTENT_RIGHT; // 374.4pt
	const CONTENT_H = PAGE_H - CONTENT_TOP - BOTTOM_RESERVED;

	const SAFETY = 6; // pt of slack so nothing kisses the right margin

	// Row typography bounds
	const ROW_FONT_MAX = 26;
	const ROW_FONT_MIN = 10;
	const TIME_COL_MIN_EM = 3.9; // time column width, expressed in em of the row font
	const TIME_GUTTER_EM = 0.55;
	const ROW_LINE_H = 1.2;
	const ROW_GAP_EM = 0.35;

	// Header typography bounds
	const HEADER_FONT_MAX = 30;
	const HEADER_FONT_MIN = 13;
	const HEADER_MARGIN_BOTTOM = 26; // pt

	// ---------------------------------------------------------------
	// Cheap but reliable text width estimator (Inter / Helvetica metrics)
	// Returns width in em units so it can be multiplied by any font size.
	// ---------------------------------------------------------------
	const WIDE_CHARS = 'mwMW@%—–';
	const NARROW_CHARS = "iljtfrI.,:;'`|!()[]{}/\\-";

	function charEm(ch: string, bold: boolean): number {
		let w: number;
		if (ch === ' ') w = 0.28;
		else if (WIDE_CHARS.includes(ch)) w = 0.88;
		else if (NARROW_CHARS.includes(ch)) w = 0.33;
		else if (ch >= '0' && ch <= '9') w = 0.6;
		else if (ch >= 'A' && ch <= 'Z') w = 0.7;
		else w = 0.56;
		return bold ? w * 1.06 : w;
	}

	function textEm(text: string, bold = false): number {
		if (!text) return 0;
		let total = 0;
		for (const ch of text) total += charEm(ch, bold);
		return total;
	}

	// ---------------------------------------------------------------
	// Formatting helpers
	// ---------------------------------------------------------------

	// Format date to "Friday February 20" (stripping out commas)
	$: formattedDate = (() => {
		if (!eventDate) return '';
		try {
			const date = new Date(eventDate);
			date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
			return date
				.toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				})
				.replace(/,/g, '');
		} catch (e) {
			return eventDate;
		}
	})();

	// Convert 10:00PM -> 22H00, 12:30AM -> 12H30
	function formatPromoterTime(timeStr: string) {
		if (!timeStr) return '';
		const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
		if (!match) return timeStr;
		let [_, hoursStr, minutes, ampm] = match;
		let hours = parseInt(hoursStr, 10);
		ampm = ampm.toUpperCase();

		if (ampm === 'PM' && hours < 12) hours += 12;
		if (ampm === 'AM' && hours === 12) hours = 12;

		return `${hours}H${minutes}`;
	}

	function isSpecial(entry: TimetableEntry) {
		return entry.artist === 'DOORS' || entry.artist === 'CURFEW';
	}

	function isBold(entry: TimetableEntry) {
		return entry.notes === 'Headliner';
	}

	// ---------------------------------------------------------------
	// Default title (venue driven) — overridden by the `title` prop
	// ---------------------------------------------------------------
	$: displayEventType = (eventType || 'Event').replace(/\s*Show$/i, '').trim() || 'Event';

	$: defaultTitle = (() => {
		const v = (venue || '').trim().toLowerCase();
		const artist = (headlinerName || 'TBA').trim();
		if (v.includes('new city gas') || v === 'ncg') return `Main Room - ${artist}`;
		if (v.includes('bazart')) return `Bazart Nuits - ${artist}`;
		return `${displayEventType} - ${artist}`;
	})();

	$: headerText = title && title.trim() ? title.trim() : defaultTitle;

	// Header shrinks until it fits on a single line
	$: headerFontSize = Math.max(
		HEADER_FONT_MIN,
		Math.min(HEADER_FONT_MAX, (CONTENT_W - SAFETY) / Math.max(textEm(headerText, true), 0.001))
	);

	// ---------------------------------------------------------------
	// Auto-fit for the whole set-times block (times AND artist names shrink together)
	// ---------------------------------------------------------------
	$: layout = (() => {
		const entries = timetable || [];
		if (entries.length === 0) {
			return { fontSize: ROW_FONT_MAX, timeColWidth: ROW_FONT_MAX * TIME_COL_MIN_EM, gap: 9 };
		}

		// Widest time string and widest artist string, in em
		const timeEm = Math.max(
			...entries.map((e) => textEm(formatPromoterTime(e.time || ''), isBold(e)))
		);
		const timeColEm = Math.max(TIME_COL_MIN_EM, timeEm + TIME_GUTTER_EM);
		const artistEm = Math.max(...entries.map((e) => textEm(e.artist || '', isBold(e))));

		// Constraint 1 — the longest single row must fit the content width
		const widthFit = (CONTENT_W - SAFETY) / (timeColEm + artistEm);

		// Constraint 2 — every row must fit vertically under the header
		const headerBlock = headerFontSize * 1.2 + HEADER_MARGIN_BOTTOM;
		const heightFit = (CONTENT_H - headerBlock) / (entries.length * (ROW_LINE_H + ROW_GAP_EM));

		const fontSize = Math.max(ROW_FONT_MIN, Math.min(ROW_FONT_MAX, widthFit, heightFit));

		return {
			fontSize,
			timeColWidth: fontSize * timeColEm,
			gap: fontSize * ROW_GAP_EM
		};
	})();
</script>

<div
	id="set-times-print-container"
	style="background-color: white; width: 8.5in; height: 11in; padding: 0; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; position: relative; box-sizing: border-box; color: black; overflow: hidden;"
>
	<div
		style="position: absolute; top: 0.5in; bottom: 0.5in; left: 0.5in; width: 1.2in; background-color: black;"
	>
		<div
			style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); color: white; font-size: 30pt; font-weight: 400; white-space: nowrap; letter-spacing: 1px;"
		>
			{formattedDate}
		</div>
	</div>

	<div style="position: absolute; top: 0.8in; right: 1in; text-align: right;">
		<h1
			style="font-size: 40pt; font-weight: 800; margin: 0; color: black; line-height: 1; letter-spacing: -1px;"
		>
			SET TIMES
		</h1>
	</div>

	<div style="position: absolute; top: 2.2in; left: 2.3in; right: 1in; overflow: hidden;">
		<h2
			style="font-size: {headerFontSize}pt; font-weight: 700; margin: 0 0 {HEADER_MARGIN_BOTTOM}pt 0; color: black; line-height: 1.2; white-space: nowrap;"
		>
			{headerText}
		</h2>

		<div style="display: flex; flex-direction: column; gap: {layout.gap}pt;">
			{#each timetable as entry}
				<div
					style="display: flex; font-size: {layout.fontSize}pt; color: black; line-height: {ROW_LINE_H}; white-space: nowrap;"
				>
					<div
						style="width: {layout.timeColWidth}pt; flex-shrink: 0; font-weight: {isBold(entry)
							? '700'
							: '400'}; font-style: {isSpecial(entry) ? 'italic' : 'normal'};"
					>
						{formatPromoterTime(entry.time)}
					</div>
					<div
						style="font-weight: {isBold(entry) ? '700' : '400'}; font-style: {isSpecial(entry)
							? 'italic'
							: 'normal'}; white-space: nowrap;"
					>
						{entry.artist}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div style="position: absolute; bottom: 0.8in; right: 1in; text-align: right;">
		<img
			src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktXX_NOIR.png"
			alt="Produkt"
			style="height: 60px; width: auto;"
		/>
	</div>
</div>