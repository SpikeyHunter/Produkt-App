// ============================================================
// TAB DEFINITIONS PER DATE TYPE + PROGRESS CALCULATION
// The right panel lists tabs for the selected date's type;
// the middle column stacks them (map always first).
// ============================================================

import type { SSTourData, TourDataTab, SSCrew, NotePriority } from '$lib/types/tour';
import {
	calculateEventDetailsProgress,
	calculateVenueInfoProgress,
	calculateProductionProgress,
	calculateMediaProgress,
	calculateImmigrationProgress
} from './progress';

export interface TabDef {
	id: TourDataTab;
	label: string;
	icon: string; // inline svg path(s)
	restricted?: boolean; // budget tabs
}

const ICONS = {
	event:
		'M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
	budget: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
	venue: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
	production:
		'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
	setlist: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
	logistics:
		'M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
	merch: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
	media:
		'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
	immigration:
		'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
	todo: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
	notes:
		'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
	travel:
		'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
	break: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3',
	pickup: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
};

const TOUR_DATE_TABS: TabDef[] = [
	{ id: 'event_details', label: 'Event Details', icon: ICONS.event },
	{ id: 'show_budget', label: 'Show Budget', icon: ICONS.budget, restricted: false },
	{ id: 'venue_info', label: 'Venue Info', icon: ICONS.venue },
	{ id: 'production', label: 'Production', icon: ICONS.production },
	{ id: 'set_list', label: 'Set List', icon: ICONS.setlist },
	{ id: 'logistics', label: 'Logistics', icon: ICONS.logistics },
	{ id: 'merch', label: 'Merch', icon: ICONS.merch },
	{ id: 'media', label: 'Media', icon: ICONS.media },
	{ id: 'immigration', label: 'Immigration', icon: ICONS.immigration },
	{ id: 'todos', label: 'To-Do List', icon: ICONS.todo },
	{ id: 'notes', label: 'Notes', icon: ICONS.notes }
];

export const TABS_BY_TYPE: Record<string, TabDef[]> = {
	'Tour Date': TOUR_DATE_TABS,
	'Travel Day': [
		{ id: 'travel', label: 'Travel Info', icon: ICONS.travel },
		{ id: 'todos', label: 'To-Do List', icon: ICONS.todo },
		{ id: 'notes', label: 'Notes', icon: ICONS.notes }
	],
	'Tour Break': [
		{ id: 'break_info', label: 'Break Info', icon: ICONS.break },
		{ id: 'notes', label: 'Notes', icon: ICONS.notes }
	],
	Pickup: [
		{ id: 'pickup_info', label: 'Pickup Notes', icon: ICONS.pickup },
		{ id: 'notes', label: 'Notes', icon: ICONS.notes }
	],
	Dropoff: [
		{ id: 'pickup_info', label: 'Dropoff Notes', icon: ICONS.pickup },
		{ id: 'notes', label: 'Notes', icon: ICONS.notes }
	],
	Other: [
		{ id: 'custom_info', label: 'Info', icon: ICONS.notes },
		{ id: 'notes', label: 'Notes', icon: ICONS.notes }
	]
};

export function tabsForType(type?: string): TabDef[] {
	return TABS_BY_TYPE[type || 'Tour Date'] || TABS_BY_TYPE['Other'];
}

// ============================================================
// NOTES — 4 fixed priority cards (Information / Question /
// Warning / Emergency). The tab-panel circle subdivides into
// however many of these 4 currently have text, one wedge per
// category, colored by the category's design-system color.
// ============================================================

// Order matches the 2x2 grid: top-left, top-right, bottom-left, bottom-right.
export const NOTE_PRIORITY_ORDER: NotePriority[] = ['info', 'question', 'warning', 'emergency'];

export const NOTE_PRIORITY_LABEL: Record<NotePriority, string> = {
	info: 'Information',
	question: 'Question',
	warning: 'Warning',
	emergency: 'Emergency'
};

// Maps each note priority to the existing design-system color token.
export const NOTE_PRIORITY_COLOR_VAR: Record<NotePriority, string> = {
	info: '--color-confirmed',
	question: '--color-question',
	warning: '--color-proposed',
	emergency: '--color-problem'
};

// Same mapping, as Tailwind text-color utility classes (for the tab-panel's
// SVG wedges, which use `class="text-X" stroke="currentColor"` like the
// rest of that component's rings) rather than the CSS custom-property form
// above (which SimpleNotesSection uses for its card styling).
export const NOTE_PRIORITY_TEXT_CLASS: Record<NotePriority, string> = {
	info: 'text-confirmed',
	question: 'text-question',
	warning: 'text-proposed',
	emergency: 'text-problem'
};

/**
 * Returns the priorities (in fixed display order) that currently have
 * non-empty note text. Length of this array (1-4) is how many wedges
 * the tab-panel circle should be divided into.
 */
export function notesActivePriorities(data: SSTourData): NotePriority[] {
	const items = data.notes?.items || [];
	return NOTE_PRIORITY_ORDER.filter((p) =>
		items.some((i) => i.priority === p && !!i.text?.trim())
	);
}

// ============================================================
// PROGRESS — % complete per tab (drives ring in tab list)
// ============================================================

function pct(done: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round((done / total) * 100);
}

const filled = (v: unknown) => {
	if (v === undefined || v === null || v === '') return false;
	if (Array.isArray(v)) return v.length > 0;
	if (typeof v === 'object') return Object.keys(v as object).length > 0;
	return true;
};

// TodoSection stores items nested under columns (data.todos.columns[].items);
// the legacy flat data.todos.items is migrated away (set to undefined) as
// soon as the section mounts. Read both so progress is correct whether or
// not that migration has happened yet.
function allTodoItems(data: SSTourData) {
	const columns = data.todos?.columns || [];
	if (columns.length) {
		return columns.flatMap((c) => c.items || []);
	}
	return data.todos?.items || [];
}

export function tabProgress(tab: TourDataTab, data: SSTourData, crew: SSCrew[] = []): number {
	switch (tab) {
		case 'event_details':
			return calculateEventDetailsProgress(data.event_details, crew);
		case 'show_budget':
			return 0;

		case 'venue_info':
			return calculateVenueInfoProgress(data.venue_info);

		case 'production':
			return calculateProductionProgress(data.production);
		case 'set_list':
			return (data.set_list?.songs || []).some((s) => s.name?.trim()) ? 100 : 0;
		case 'logistics': {
			const d = data.logistics || {};
			// Hospitality: any role rider that has at least one selected item.
			const hospoHasItems = Object.values(d.hospo || {}).some(
				(role) =>
					!!role &&
					Object.values(role).some((cat) =>
						Object.values((cat as Record<string, { selected?: boolean }>) || {}).some(
							(it) => !!it?.selected
						)
					)
			);
			// Guestlist: any tier allocated a positive number, or any guest added.
			const allocHasValue = Object.values(d.guestlist_allocation || {}).some(
				(v) => (Number(v) || 0) > 0
			);
			const checks = [
				hospoHasItems,
				filled(d.meal_mode),
				(d.transports || []).length > 0,
				(d.guestlist || []).length > 0 || allocHasValue
			];
			return pct(checks.filter(Boolean).length, checks.length);
		}
		case 'merch': {
			const d = data.merch || {};
			// Off or untouched → 0 (the tab is grayed via isTabInactive, so this
			// never renders as a green "complete" checkmark).
			if (d.enabled !== true) return 0;
			const checks = [filled(d.seller_name), d.venue_pct !== undefined, filled(d.counts)];
			return pct(checks.filter(Boolean).length + 1, checks.length + 1);
		}
		case 'media':
			return calculateMediaProgress(data.media, data.event_details);
		case 'immigration':
			return calculateImmigrationProgress(data.immigration);
		case 'todos': {
			const items = allTodoItems(data);
			if (!items.length) return 0;
			return pct(items.filter((i) => i.done).length, items.length);
		}
		case 'notes': {
			// Kept as a numeric fallback (e.g. for any consumer that still wants a
			// single %). The tab panel itself should prefer notesActivePriorities()
			// to draw the subdivided, color-coded circle instead of this number.
			return pct(notesActivePriorities(data).length, NOTE_PRIORITY_ORDER.length);
		}
		case 'travel': {
			const people = data.travel?.people || [];
			if (!people.length) return 0;
			const done = people.filter(
				(p) => p.booked && p.hotel_status && p.hotel_status !== 'not_booked'
			).length;
			return pct(done, people.length);
		}
		case 'break_info': {
			const d = data.break_info || {};
			const checks = [filled(d.bus_location), filled(d.truck_location)];
			return pct(checks.filter(Boolean).length, checks.length);
		}
		case 'pickup_info':
			return filled(data.pickup_info?.notes) ? 100 : 0;
		case 'custom_info':
			return filled(data.custom_info?.notes) ? 100 : 0;
		default:
			return 0;
	}
}

// ============================================================
// INACTIVE / "N/A" TABS — rendered grayed out (no red 0%), because
// there's genuinely nothing to fill in yet.
// ============================================================

export function isTabInactive(tab: TourDataTab, data: SSTourData): boolean {
	switch (tab) {
		case 'media': {
			// Grayed out ONLY when there's no media on the crew. If there is media,
			// the tab is active and requires a brief (link received + link) and notes.
			const ed = data.event_details || {};
			const mediaCrew = ed.media_crew_enabled ? ed.media_crew || [] : [];
			return mediaCrew.length < 1;
		}
		case 'merch':
			// Grayed out whenever "Merch on this show" is not toggled on.
			return data.merch?.enabled !== true;
		case 'immigration':
			// Grayed out whenever "Immigration needed for this show" is not on.
			return data.immigration?.enabled !== true;
		case 'todos':
			// Grayed out until at least one task exists — nothing to be "0%" of yet.
			return allTodoItems(data).length < 1;
		default:
			return false;
	}
}