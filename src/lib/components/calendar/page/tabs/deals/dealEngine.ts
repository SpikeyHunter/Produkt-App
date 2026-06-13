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

// ---------------------------------------------------------------------------
// Shared event-cost calculation (fixed + variable + support).
// Used to compute the "after Costs" basis for Versus/Plus/Door deals and to
// display the calculated cost total in the deal creator. Mirrors the Prism
// settlement (verified to the cent).
// ---------------------------------------------------------------------------

export interface EventCostInput {
	fixedCosts?: any[];
	variableCosts?: any[];
}

export interface EventRevenueInput {
	tickets?: any[];
	financials?: { taxRate?: number; taxType?: string; facilityFee?: number };
}

export interface CostBreakdown {
	fixed: number;
	variable: number;
	support: number;
	total: number;
	// Revenue figures derived along the way (handy for callers).
	gross: number;
	netGross: number;
	paidTickets: number;
	totalAllotment: number;
}

/**
 * Compute total event costs from the raw cost + revenue JSON.
 *
 * @param useActual  true -> use sold/actualInternal/externalSettlement
 *                   false -> use sellable(allotment - comps - kills)/estimatedInternal
 * @param external   true -> fixed uses externalSettlement & variable uses externalAmount;
 *                   false -> fixed uses *Internal & variable uses internalAmount
 */
export function computeEventCosts(
	cost: EventCostInput | null | undefined,
	revenue: EventRevenueInput | null | undefined,
	support: number = 0,
	opts: { useActual?: boolean; external?: boolean } = {}
): CostBreakdown {
	const useActual = opts.useActual !== false; // default to actual
	const external = !!opts.external;

	const rev = revenue || {};
	const tickets: any[] = Array.isArray(rev.tickets) ? rev.tickets : [];
	const fin = rev.financials || {};
	const taxRate = Number(fin.taxRate) || 0;
	const taxType = fin.taxType || 'Divisor';
	const facilityFee = Number(fin.facilityFee) || 0;

	let gross = 0,
		paidTickets = 0,
		totalAllotment = 0,
		fees = 0;
	for (const t of tickets) {
		const allot = Number(t.allotment) || 0;
		const comps = Number(t.comps) || 0;
		const kills = Number(t.kills) || 0;
		const qty = useActual ? Number(t.sold) || 0 : allot - comps - kills;
		gross += qty * (Number(t.price) || 0);
		paidTickets += qty;
		totalAllotment += allot;
		fees += qty * (Number(t.ticketFees) || 0) + qty * facilityFee;
	}
	const taxable = gross - fees;
	const taxes =
		taxType === 'Multiplier' ? taxable * (taxRate / 100) : taxable - taxable / (1 + taxRate / 100);
	const netGross = gross - taxes - fees;

	const c = cost || {};
	let fixed = 0;
	(Array.isArray(c.fixedCosts) ? c.fixedCosts : []).forEach((g: any) => {
		(Array.isArray(g.costs) ? g.costs : []).forEach((line: any) => {
			if (useActual) {
				fixed += Number(external ? line.externalSettlement : line.actualInternal) || 0;
			} else {
				fixed += Number(line.estimatedInternal) || 0;
			}
		});
	});

	let variable = 0;
	(Array.isArray(c.variableCosts) ? c.variableCosts : []).forEach((v: any) => {
		const m = Number(external ? v.externalAmount : v.internalAmount) || 0;
		switch (v.type) {
			case 'Flat':
				variable +=
					Number(useActual ? (external ? v.externalSettlement : v.actualInternal) : m) || m;
				break;
			case '% of Gross':
				variable += (m / 100) * gross;
				break;
			case '% of Net Gross':
				variable += (m / 100) * netGross;
				break;
			case '$ per Paid Ticket':
			case '$ per Attendee':
				variable += m * paidTickets;
				break;
		}
	});

	const sup = Number(support) || 0;
	return {
		fixed,
		variable,
		support: sup,
		total: fixed + variable + sup,
		gross,
		netGross,
		paidTickets,
		totalAllotment
	};
}

// ---------------------------------------------------------------------------
// Summary string formatting.
// Used by both DealsTab (display) and DealCreator (save) so the wording stays
// consistent. Also patches legacy stored summaries that have "after Costs"
// literal so old saved deals show the actual cost figure too.
// ---------------------------------------------------------------------------

/**
 * Format a stored deal as its display string. Handles three patches:
 *   1. Replace "after Costs" -> "after <venueCurrency>$<computed costs>"
 *      (so legacy saved deals display the live cost figure)
 *   2. Prefix with the deal's currency code (USD or venueCurrency)
 *   3. Fallback for deals with no stored summaryText
 *
 * @param deal       the headliner deal object (has summaryText, dealType,
 *                   guaranteeAmount, dealCurrency, etc.)
 * @param computedCosts  the dollar amount to substitute for "Costs"
 * @param venueCurrency  e.g. 'CAD'
 */
export function formatDealSummary(
	deal: any,
	computedCosts: number,
	venueCurrency: string = 'CAD'
): string {
	const formatMoney = (v: number) =>
		Number(v || 0).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

	// Currency the guarantee is denominated in (defaults to USD for legacy deals).
	const dealCurrency = deal?.dealCurrency || 'USD';

	let summary: string = deal?.summaryText || '';

	// Fallback for deals without a stored summary.
	if (!summary) {
		if (deal?.dealType === 'Flat') {
			summary = `$${formatMoney(Number(deal?.guaranteeAmount) || 0)} Flat Deal`;
		} else {
			summary = `${deal?.dealType || ''} Deal`;
		}
	}

	// Legacy: replace literal "after Costs" with the dollar amount.
	const costsLabel = `${venueCurrency}$${formatMoney(computedCosts)}`;
	summary = summary.replace(/after Costs\b/g, `after ${costsLabel}`);

	// Prefix the currency code (USD/CAD). Only if not already prefixed.
	if (!/^(USD|CAD|EUR|GBP)\s/.test(summary)) {
		// If the summary starts with "$..." we insert "USD " or "CAD " before it.
		if (/^\$/.test(summary)) {
			summary = `${dealCurrency} ${summary}`;
		}
	}

	return summary;
}