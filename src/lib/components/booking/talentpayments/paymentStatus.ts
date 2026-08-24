// $lib/components/booking/talentpayments/paymentStatus.ts
//
// Single source of truth for talent payment statuses, colours and date formatting.
// Every talent-payment component imports from here so filters, cards, rows and the
// side panel can never drift out of sync again.

export type PaymentStatus =
	| 'Draft'
	| 'Invoiced'
	| 'Submitted'
	| 'Ready for Pickup'
	| 'Paid'
	| 'Picked Up'
	| 'Mailed';

/** The linear part of the flow. */
export const PRIMARY_STATUSES: PaymentStatus[] = ['Draft', 'Invoiced', 'Submitted', 'Ready for Pickup'];

/** The terminal statuses — mutually exclusive, picked on the same line. */
export const FINAL_STATUSES: PaymentStatus[] = ['Paid', 'Picked Up', 'Mailed'];

export const ALL_STATUSES: PaymentStatus[] = [...PRIMARY_STATUSES, ...FINAL_STATUSES];

/**
 * Maps anything already sitting in the DB (including the retired
 * "Confirmed" / "Approved" statuses) onto the current set.
 */
const LEGACY_MAP: Record<string, PaymentStatus> = {
	draft: 'Draft',
	confirmed: 'Draft',
	pending: 'Draft',
	new: 'Draft',

	invoiced: 'Invoiced',
	invoice: 'Invoiced',

	approved: 'Submitted',
	submitted: 'Submitted',
	sent: 'Submitted',

	'ready for pickup': 'Ready for Pickup',
	'ready for pick up': 'Ready for Pickup',
	'ready for pick-up': 'Ready for Pickup',
	ready: 'Ready for Pickup',

	paid: 'Paid',

	'picked up': 'Picked Up',
	'picked-up': 'Picked Up',
	pickedup: 'Picked Up',

	mailed: 'Mailed',
	shipped: 'Mailed'
};

export function normalizeStatus(raw?: string | null): PaymentStatus {
	if (!raw) return 'Draft';
	const key = String(raw).trim().toLowerCase();
	return LEGACY_MAP[key] ?? 'Draft';
}

export function isFinalStatus(raw?: string | null): boolean {
	return FINAL_STATUSES.includes(normalizeStatus(raw));
}

/**
 * Colour tokens per status.
 * NOTE: these are literal Tailwind class strings so the JIT compiler picks them up.
 * Make sure `./src/**\/*.{svelte,ts,js}` is in your tailwind `content` array.
 */
type Theme = { text: string; border: string; bg: string; dot: string; solid: string };

const THEMES: Record<PaymentStatus, Theme> = {
	Draft: {
		text: 'text-gray2',
		border: 'border-gray2/40',
		bg: 'bg-gray2/10',
		dot: 'bg-gray2',
		solid: 'bg-gray1 text-white border-gray2'
	},
	Invoiced: {
		text: 'text-proposed',
		border: 'border-proposed/40',
		bg: 'bg-proposed/10',
		dot: 'bg-proposed',
		solid: 'bg-proposed/20 text-proposed border-proposed'
	},
	Submitted: {
		text: 'text-info',
		border: 'border-info/40',
		bg: 'bg-info/10',
		dot: 'bg-info',
		solid: 'bg-info/20 text-info border-info'
	},
	'Ready for Pickup': {
		text: 'text-question',
		border: 'border-question/40',
		bg: 'bg-question/10',
		dot: 'bg-question',
		solid: 'bg-question/20 text-question border-question'
	},
	// The three terminal statuses all live in the lime family — no other green
	// is used anywhere in this feature. They're told apart by how much lime
	// they carry, not by hue.
	Paid: {
		text: 'text-lime',
		border: 'border-lime',
		bg: 'bg-lime/20',
		dot: 'bg-lime',
		solid: 'bg-lime text-black border-lime'
	},
	'Picked Up': {
		text: 'text-lime',
		border: 'border-lime/50',
		bg: 'bg-lime/10',
		dot: 'bg-lime/80',
		solid: 'bg-lime/25 text-lime border-lime'
	},
	Mailed: {
		text: 'text-lime/70',
		border: 'border-lime/30',
		bg: 'bg-lime/5',
		dot: 'bg-lime/50',
		solid: 'bg-lime/10 text-lime border-lime/60'
	}
};

export function statusTheme(raw?: string | null): Theme {
	return THEMES[normalizeStatus(raw)];
}

/** Small read-only pill used on cards and list rows. */
export function statusPillClass(raw?: string | null): string {
	const t = statusTheme(raw);
	return `inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${t.text} ${t.bg} ${t.border}`;
}

export function statusDotClass(raw?: string | null): string {
	return `h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusTheme(raw).dot}`;
}

/** Clickable filter chip / selector button. */
export function statusChipClass(raw: string, active: boolean): string {
	const t = statusTheme(raw);
	const base =
		'rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap';
	return active
		? `${base} ${t.solid}`
		: `${base} bg-transparent ${t.text} ${t.border} opacity-70 hover:opacity-100`;
}

/* ---------------------------------------------------------------- dates ---- */

/** Parses YYYY-MM-DD without the UTC off-by-one-day shift. */
export function parseLocalDate(dateStr?: string | null): Date | null {
	if (!dateStr) return null;
	const clean = String(dateStr).split('T')[0].replace(/-/g, '/');
	const d = new Date(clean);
	return isNaN(d.getTime()) ? null : d;
}

/** "Aug 7, 2026" */
export function formatShortDate(dateStr?: string | null): string {
	const d = parseLocalDate(dateStr);
	if (!d) return '';
	return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Fri, Aug 7" */
export function formatCompactDate(dateStr?: string | null): string {
	const d = parseLocalDate(dateStr);
	if (!d) return '';
	return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Friday, August 7, 2026" */
export function formatLongDate(dateStr?: string | null): string {
	const d = parseLocalDate(dateStr);
	if (!d) return '';
	return d.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

/** "August 7th 2026" — used in email copy. */
export function formatOrdinalDate(dateStr?: string | null): string {
	const d = parseLocalDate(dateStr);
	if (!d) return '';
	const day = d.getDate();
	const suffix =
		day > 3 && day < 21
			? 'th'
			: day % 10 === 1
				? 'st'
				: day % 10 === 2
					? 'nd'
					: day % 10 === 3
						? 'rd'
						: 'th';
	return `${d.toLocaleDateString('en-US', { month: 'long' })} ${day}${suffix} ${d.getFullYear()}`;
}

export const moneyFormatter = new Intl.NumberFormat('en-CA', {
	style: 'currency',
	currency: 'CAD',
	maximumFractionDigits: 0
});

export function formatMoney(amount?: number | null): string {
	return moneyFormatter.format(amount ?? 0);
}

/* --------------------------------------------------------------- search ---- */
//
// Artist name only. Event names, dates, statuses and amounts are deliberately
// NOT searchable — typing "Karnavale" or "aug 7" returns nothing, so a query
// can only ever narrow the view down to artists.

/** Splits "max dean" into ['max', 'dean']. All tokens must match (AND). */
export function tokenizeQuery(query?: string | null): string[] {
	return String(query ?? '')
		.toLowerCase()
		.trim()
		.split(/\s+/)
		.filter(Boolean);
}

/** The one field a row can be found by. */
export function searchHaystack(artist: any): string {
	return String(artist?.artist_name ?? '').toLowerCase();
}

/** True when every token in the query appears in the artist name. */
export function matchesQuery(artist: any, query?: string | null): boolean {
	const tokens = tokenizeQuery(query);
	if (tokens.length === 0) return true;
	const name = searchHaystack(artist);
	if (!name) return false;
	return tokens.every((t) => name.includes(t));
}

/**
 * Ranking for the ⌘K palette:
 *   1. artist-name prefix hits, then anywhere-in-the-name hits
 *   2. upcoming before past
 *   3. soonest first (upcoming) / most recent first (past)
 *   4. alphabetical
 */
function matchRank(artist: any, tokens: string[]): number {
	if (tokens.length === 0) return 2;
	const name = searchHaystack(artist);
	if (tokens.some((t) => name.startsWith(t))) return 0;
	if (tokens.some((t) => name.includes(t))) return 1;
	return 2;
}

export function rankSearchResults<T = any>(list: T[], query?: string | null): T[] {
	const tokens = tokenizeQuery(query);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayTs = today.getTime();

	const ts = (a: any) => parseLocalDate(a?.eventDateDisplay)?.getTime() ?? 0;

	return [...list].sort((a: any, b: any) => {
		const rankDiff = matchRank(a, tokens) - matchRank(b, tokens);
		if (rankDiff !== 0) return rankDiff;

		const aTs = ts(a);
		const bTs = ts(b);
		const aUpcoming = aTs >= todayTs;
		const bUpcoming = bTs >= todayTs;
		if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
		if (aTs !== bTs) return aUpcoming ? aTs - bTs : bTs - aTs;

		return String(a?.artist_name ?? '').localeCompare(String(b?.artist_name ?? ''));
	});
}

/* ------------------------------------------------------------ highlight ---- */

export type HighlightSegment = { text: string; hit: boolean };

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a label into segments so components can wrap the matched parts in
 * <mark> without ever using {@html} on user data.
 */
export function highlightSegments(
	text?: string | null,
	query?: string | null
): HighlightSegment[] {
	const value = text === null || text === undefined ? '' : String(text);
	const tokens = tokenizeQuery(query);
	if (!value || tokens.length === 0) return [{ text: value, hit: false }];

	const pattern = tokens
		.slice()
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp)
		.join('|');

	const re = new RegExp(`(${pattern})`, 'ig');
	const out: HighlightSegment[] = [];
	let last = 0;

	for (const m of value.matchAll(re)) {
		const idx = m.index ?? 0;
		if (idx > last) out.push({ text: value.slice(last, idx), hit: false });
		out.push({ text: m[0], hit: true });
		last = idx + m[0].length;
	}
	if (last < value.length) out.push({ text: value.slice(last), hit: false });

	return out.length ? out : [{ text: value, hit: false }];
}

/** ⌘ on Mac, Ctrl everywhere else — used for the shortcut hint chips. */
export function shortcutSymbol(): string {
	if (typeof navigator === 'undefined') return '⌘';
	const ua = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
	return /mac|iphone|ipad|ipod/i.test(ua) ? '⌘' : 'Ctrl';
}