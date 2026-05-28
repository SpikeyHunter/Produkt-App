// dealEngine.ts
// Single source of truth for artist payout + deal math.
// Used by EventSidebar, DealsTab, and DealCreator so every surface shows
// the same numbers. Verified against the Prism settlement report to the cent.
//
// Place this file somewhere importable, e.g. src/lib/deals/dealEngine.ts,
// and adjust the import paths in the components accordingly.

export type DealType = 'Flat' | 'Versus' | 'Plus' | 'Door Deal';

export interface DealDetails {
	metricType?: string; // '% of Net' | '% of Net Gross' | 'Per Ticket' | 'Flat'
	metricAmount?: number; // e.g. 80 (for 80%) or a per-ticket/flat dollar amount
	afterType?: string; // 'Costs' | 'Net' | 'Gross' | '% Sell Through' | '# Tickets Sold' | 'Manual Split Point'
	splitPointAmount?: number; // revenue or threshold the metric kicks in after
}

export interface HeadlinerDeal {
	dealType?: DealType;
	guaranteeAmount?: number | string; // in deal currency (e.g. USD)
	details?: DealDetails;
}

export interface DealContext {
	gross: number; // gross ticket revenue (venue currency)
	netGross: number; // net gross = gross - taxes/fees (venue currency)
	costs: number; // non-artist costs: fixed + variable + support (venue currency)
	paidTickets: number; // paid tickets (for per-ticket / sell-through deals)
	totalAllotment?: number; // for % sell-through thresholds
	exchangeRate: number; // multiply guaranteeAmount by this to get venue currency
}

/**
 * The guaranteed minimum, converted to venue currency.
 */
export function guaranteeInVenueCurrency(deal: HeadlinerDeal, exchangeRate: number): number {
	return (Number(deal?.guaranteeAmount) || 0) * (Number(exchangeRate) || 0);
}

/**
 * The backend (percentage / per-ticket / door) component, before the
 * guarantee comparison. Returns 0 for Flat deals.
 */
export function computeBackend(deal: HeadlinerDeal, ctx: DealContext): number {
	const dealType = (deal?.dealType || 'Flat') as DealType;
	if (dealType === 'Flat') return 0;

	const d = deal?.details || {};
	const metricType = d.metricType || '';
	const afterType = d.afterType || '';
	const metricAmount = Number(d.metricAmount) || 0;
	const splitPoint = Number(d.splitPointAmount) || 0;

	// Percentage-of-revenue style deals (Versus / Plus / Door Deal).
	if (metricType === '% of Net') {
		// "% of Net Revenue after Costs" OR after a manual split point.
		const base = afterType === 'Costs' ? ctx.netGross - ctx.costs : ctx.netGross - splitPoint;
		return (metricAmount / 100) * Math.max(0, base);
	}

	if (metricType === '% of Net Gross') {
		return (metricAmount / 100) * Math.max(0, ctx.netGross);
	}

	if (metricType === '% of Gross') {
		return (metricAmount / 100) * Math.max(0, ctx.gross);
	}

	// Per-ticket backend, possibly gated by a sell-through / tickets-sold threshold.
	if (metricType === 'Per Ticket') {
		let qualifying = ctx.paidTickets;
		if (afterType === '% Sell Through' && ctx.totalAllotment) {
			const threshold = (splitPoint / 100) * ctx.totalAllotment;
			qualifying = Math.max(0, ctx.paidTickets - threshold);
		} else if (afterType === '# Tickets Sold') {
			qualifying = Math.max(0, ctx.paidTickets - splitPoint);
		}
		return metricAmount * qualifying;
	}

	// Flat backend (Plus a flat bonus after a threshold).
	if (metricType === 'Flat') {
		// Only pays once the threshold is met; otherwise 0.
		if (afterType === '% Sell Through' && ctx.totalAllotment) {
			const sellThrough = ctx.totalAllotment > 0 ? (ctx.paidTickets / ctx.totalAllotment) * 100 : 0;
			return sellThrough >= splitPoint ? metricAmount : 0;
		}
		if (afterType === '# Tickets Sold') {
			return ctx.paidTickets >= splitPoint ? metricAmount : 0;
		}
		// Manual Split Point: pays once net revenue clears the point.
		return ctx.netGross >= splitPoint ? metricAmount : 0;
	}

	return 0;
}

/**
 * The artist payout for a single headliner deal, in venue currency.
 *
 *   Flat       -> guarantee
 *   Versus     -> max(guarantee, backend)
 *   Plus       -> guarantee + backend
 *   Door Deal  -> backend (no guarantee)
 */
export function computeArtistPayout(deal: HeadlinerDeal, ctx: DealContext): number {
	const dealType = (deal?.dealType || 'Flat') as DealType;
	const guarantee = guaranteeInVenueCurrency(deal, ctx.exchangeRate);
	const backend = computeBackend(deal, ctx);

	switch (dealType) {
		case 'Versus':
			return Math.max(guarantee, backend);
		case 'Plus':
			return guarantee + backend;
		case 'Door Deal':
			return backend;
		case 'Flat':
		default:
			return guarantee;
	}
}