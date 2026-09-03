export interface DailyCount {
	id: string;
	report_date: string;
	report_generated_at: string;
	event_id: number;
	ga: number;
	vip: number;
	total: number;
	ga_yesterday: number;
	vip_yesterday: number;
	total_yesterday: number;
}

export interface EventData {
	event_id: number;
	event_name: string;
	event_date: string;
	event_status: 'LIVE' | 'PAST';
	event_flyer: string;
	event_venue: string;
	stage_type?: any;
	color?: string;
	pinned?: boolean;
	// Another event whose tickets count towards this one (e.g. a 2-day pass).
	linked_event_id?: number | null;
	// Manually reported tickets added to the total (summary only, never the chart).
	reported_count?: number;
}

/** Latest count for an event once its linked event + reported tickets are folded in. */
export interface EffectiveCount {
	total: number;
	ga: number;
	vip: number;
	base: number; // the event's own latest total
	linked: number; // linked event's latest total
	linkedGa: number;
	linkedVip: number;
	reported: number;
}

/** "2026-04-16" -> "16-Apr-2026" */
export function formatEventDateShort(input: string | null | undefined): string {
	if (!input) return '';
	const d = new Date(input.length === 10 ? `${input}T12:00:00` : input);
	if (isNaN(d.getTime())) return String(input);
	const day = String(d.getDate()).padStart(2, '0');
	const month = d.toLocaleString('en-US', { month: 'short' });
	return `${day}-${month}-${d.getFullYear()}`;
}

/** Accent-insensitive "réservations" check (Réservations, reservation, ...). */
export function isReservationsEvent(name: string | null | undefined): boolean {
	const n = String(name || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
	return n.includes('reservation');
}
