export interface CompareEventData {
	event_id: number;
	name: string;
	event_date: string;
	status: 'LIVE' | 'PAST';
	flyer_url?: string | null;
}

export interface SalesStats {
	total_tickets: number;
	ga_tickets: number;
	vip_tickets: number;
	gross_revenue: number;
	net_revenue: number;
	door_sales: number;
	attendance: number;
}

// Default empty stats helper
export const initialStats: SalesStats = {
	total_tickets: 0,
	ga_tickets: 0,
	vip_tickets: 0,
	gross_revenue: 0,
	net_revenue: 0,
	door_sales: 0,
	attendance: 0
};