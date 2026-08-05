import type { BudgetItem, BudgetSubsection } from '$lib/types/budget';

/**
 * Formats a number as a currency string, e.g., "1,000,000.00$" or "(1,000,000.00$)"
 */
export function formatMoney(amount: number | null | undefined): string {
	const num = Number(amount) || 0;
	const options: Intl.NumberFormatOptions = {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	};

	const formatted = num.toLocaleString('en-US', options);

	if (num < 0) {
		return `(${formatted.replace('-', '')}$)`;
	}
	return `${formatted}$`;
}

/** "-1,000.00$" style (used by totals panel) */
export function formatDisplay(amount: number): string {
	const abs = Math.abs(Number(amount) || 0);
	const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return amount < 0 ? `-${str}$` : `${str}$`;
}

const num = (v: any) => {
	const n = Number(v);
	return isNaN(n) ? 0 : n;
};

/** Ensure every item has the new fields (actual / hidden / flagged) so old budgets load cleanly. */
export function normalizeItem(raw: any): BudgetItem {
	return {
		id: raw?.id || crypto.randomUUID(),
		name: raw?.name ?? '',
		price: raw?.price === null || raw?.price === undefined || raw?.price === '' ? null : Number(raw.price),
		actual: raw?.actual === null || raw?.actual === undefined || raw?.actual === '' ? null : Number(raw.actual),
		quantity: raw?.quantity === null || raw?.quantity === undefined ? 1 : Number(raw.quantity),
		unit: raw?.unit ?? '',
		hidden: !!raw?.hidden,
		flagged: !!raw?.flagged
	};
}

export function normalizeItems(raw: any): BudgetItem[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(normalizeItem);
}

export function normalizeSubsections(raw: any): BudgetSubsection[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((sub: any) => ({
		id: sub?.id || crypto.randomUUID(),
		name: sub?.name ?? '',
		hidden: !!sub?.hidden,
		items: normalizeItems(sub?.items)
	}));
}

/* ---------- Totals (hidden rows/sections are always excluded) ---------- */

export function itemBudgetedTotal(item: BudgetItem): number {
	return num(item.price) * (num(item.quantity) || 1);
}

/** Actual falls back to budgeted when not filled in, so partial actuals still make sense. */
export function itemActualTotal(item: BudgetItem): number {
	const base = item.actual === null || item.actual === undefined ? num(item.price) : num(item.actual);
	return base * (num(item.quantity) || 1);
}

export function itemsBudgetedTotal(items: BudgetItem[] | undefined | null): number {
	return (items || []).filter((i) => !i.hidden).reduce((acc, i) => acc + itemBudgetedTotal(i), 0);
}

export function itemsActualTotal(items: BudgetItem[] | undefined | null): number {
	return (items || []).filter((i) => !i.hidden).reduce((acc, i) => acc + itemActualTotal(i), 0);
}

export function itemsHaveActuals(items: BudgetItem[] | undefined | null): boolean {
	return (items || []).some((i) => !i.hidden && i.actual !== null && i.actual !== undefined);
}

export function subsBudgetedTotal(subs: BudgetSubsection[] | undefined | null): number {
	return (subs || []).filter((s) => !s.hidden).reduce((acc, s) => acc + itemsBudgetedTotal(s.items), 0);
}

export function subsActualTotal(subs: BudgetSubsection[] | undefined | null): number {
	return (subs || []).filter((s) => !s.hidden).reduce((acc, s) => acc + itemsActualTotal(s.items), 0);
}

export function subsHaveActuals(subs: BudgetSubsection[] | undefined | null): boolean {
	return (subs || []).some((s) => !s.hidden && itemsHaveActuals(s.items));
}

/** Total budget (income side) for a show_budget row, respecting budget_type. */
export function incomeTotalFor(row: any): number {
	const type = row?.budget_type || 'Tour Prod';
	if (type === 'Internal Prod') return num(row?.income_total_budget);
	const base = num(row?.income_technical) + num(row?.income_hospitality) + num(row?.income_other);
	if (type === 'Complete Prod') return base + num(row?.income_artist);
	return base;
}