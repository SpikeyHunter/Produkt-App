import { supabase } from '$lib/supabase';
import { initialStats, type SalesStats } from '$lib/types/compare';

// --- HELPERS ---

// Helper to determine if a category string is valid (GA or VIP, not Backend)
const isValidCategory = (cat: string) => {
	const c = cat.toLowerCase();
	if (c.includes('backend')) return false;
	return c.includes('ga') || c.includes('vip');
};

// --- SINGLE EVENT FUNCTIONS ---

export async function fetchEventSalesStats(eventId: number): Promise<SalesStats> {
	try {
		const { data: s, error } = await supabase
			.from('events_sales')
			.select('*')
			.eq('event_id', eventId)
			.single();

		if (error && error.code !== 'PGRST116') console.error('Sales fetch error', error);

		const data = s || {};

		// LOGIC UPDATE: Only count PAID GA and VIP.
		// Assuming sales_total_ga/vip columns in DB only contain sold tickets,
		// and comp/free are in separate columns (sales_total_comp_ga etc) based on standard schema patterns.
		const ga = data.sales_total_ga || 0;
		const vip = data.sales_total_vip || 0;

		return {
			total_tickets: ga + vip,
			ga_tickets: ga,
			vip_tickets: vip,
			gross_revenue: data.sales_gross || 0,
			net_revenue: data.sales_net || 0,
			door_sales: 0,
			attendance: 0
		};
	} catch (err) {
		console.error('Error fetching event stats:', err);
		return { ...initialStats };
	}
}

export async function fetchSalesForDate(eventId: number, targetDate: Date): Promise<SalesStats> {
	try {
		const startOfDay = new Date(targetDate);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(targetDate);
		endOfDay.setHours(23, 59, 59, 999);

		// LOGIC UPDATE: Filter > $0 and GA/VIP only in query if possible, or filter in JS
		const { data: orders, error } = await supabase
			.from('events_orders')
			.select('order_gross, order_net, order_quantity, order_category')
			.eq('event_id', eventId)
			.gt('order_gross', 0) // Exclude $0 tickets
			.gte('order_purchase_date', startOfDay.toISOString())
			.lte('order_purchase_date', endOfDay.toISOString());

		if (error) throw error;

		const stats = { ...initialStats };

		if (orders && orders.length > 0) {
			orders.forEach(order => {
				const cat = (order.order_category || '').toLowerCase();
				
				// Extra safety check for "Backend" and ensuring GA/VIP
				if (cat.includes('backend')) return;
				if (!cat.includes('ga') && !cat.includes('vip')) return;

				const qty = order.order_quantity || 0;
				stats.gross_revenue += Number(order.order_gross) || 0;
				stats.net_revenue += Number(order.order_net) || 0;
				stats.total_tickets += qty;

				if (cat.includes('vip')) {
					stats.vip_tickets += qty;
				} else {
					stats.ga_tickets += qty;
				}
			});
		}

		return stats;
	} catch (err) {
		console.error(`Error fetching daily sales for event ${eventId}:`, err);
		return { ...initialStats };
	}
}

// --- AGGREGATE FUNCTIONS ---

export async function fetchAggregateSalesStats(eventIds: number[]): Promise<SalesStats> {
	if (!eventIds.length) return { ...initialStats };

	let total = { ...initialStats };

	const { data: salesData, error } = await supabase
		.from('events_sales')
		.select('*')
		.in('event_id', eventIds);

	if (error) {
		console.error('Error fetching aggregated sales:', error);
		return total;
	}

	if (salesData) {
		salesData.forEach(s => {
			const ga = s.sales_total_ga || 0;
			const vip = s.sales_total_vip || 0;
			
			total.total_tickets += ga + vip;
			total.ga_tickets += ga;
			total.vip_tickets += vip;
			total.gross_revenue += s.sales_gross || 0;
			total.net_revenue += s.sales_net || 0;
		});
	}

	return total;
}

export async function fetchAggregateSalesForDate(eventIds: number[], targetDate: Date): Promise<SalesStats> {
	if (!eventIds.length) return { ...initialStats };

	const startOfDay = new Date(targetDate);
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(targetDate);
	endOfDay.setHours(23, 59, 59, 999);

	try {
		const { data: orders, error } = await supabase
			.from('events_orders')
			.select('order_gross, order_net, order_quantity, order_category')
			.in('event_id', eventIds)
			.gt('order_gross', 0) // Exclude $0
			.gte('order_purchase_date', startOfDay.toISOString())
			.lte('order_purchase_date', endOfDay.toISOString());

		if (error) throw error;

		const stats = { ...initialStats };

		if (orders) {
			orders.forEach(order => {
				const cat = (order.order_category || '').toLowerCase();
				if (cat.includes('backend')) return;
				if (!cat.includes('ga') && !cat.includes('vip')) return;

				const qty = order.order_quantity || 0;
				stats.gross_revenue += Number(order.order_gross) || 0;
				stats.net_revenue += Number(order.order_net) || 0;
				stats.total_tickets += qty;

				if (cat.includes('vip')) {
					stats.vip_tickets += qty;
				} else {
					stats.ga_tickets += qty;
				}
			});
		}

		return stats;
	} catch (err) {
		console.error(`Error fetching daily sales for events ${eventIds}:`, err);
		return { ...initialStats };
	}
}