import type {
	BudgetItem,
	BudgetSubsection,
	ExpenseCategory,
	AllocationTarget
} from '$lib/types/budget';
import { POOL_TARGET } from '$lib/types/budget';

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

/** Compact money for badges: "6,400$" / "6,400.50$" */
export function formatShort(amount: number): string {
	const n = Number(amount) || 0;
	const frac = Math.abs(n % 1) > 0.004 ? 2 : 0;
	return `${n.toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: frac })}$`;
}

const num = (v: any) => {
	const n = Number(v);
	return isNaN(n) ? 0 : n;
};

/**
 * Ensure every item has the newer fields (actual / hidden / flagged / children)
 * so budgets saved before those existed still load cleanly.
 * `depth` guards against accidental nesting deeper than one level.
 */
export function normalizeItem(raw: any, depth = 0): BudgetItem {
	return {
		id: raw?.id || crypto.randomUUID(),
		name: raw?.name ?? '',
		price: raw?.price === null || raw?.price === undefined || raw?.price === '' ? null : Number(raw.price),
		actual: raw?.actual === null || raw?.actual === undefined || raw?.actual === '' ? null : Number(raw.actual),
		quantity: raw?.quantity === null || raw?.quantity === undefined ? 1 : Number(raw.quantity),
		unit: raw?.unit ?? '',
		hidden: !!raw?.hidden,
		flagged: !!raw?.flagged,
		children: depth === 0 && Array.isArray(raw?.children) ? raw.children.map((c: any) => normalizeItem(c, 1)) : [],
		collapsed: !!raw?.collapsed,
		// Income lines only — kept on every item so merge/undo round-trip cleanly.
		allocation: raw?.allocation ?? null,
		fenced: raw?.fenced === true,
		note: raw?.note ?? ''
	};
}

export function normalizeItems(raw: any, depth = 0): BudgetItem[] {
	if (!Array.isArray(raw)) return [];
	// NEVER `raw.map(normalizeItem)`: Array.map passes the index as the second
	// argument, which lands in `depth` and strips children from every item
	// after the first. (This exact bug ate sub-items once.)
	return raw.map((item) => normalizeItem(item, depth));
}

export function normalizeSubsections(raw: any): BudgetSubsection[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((sub: any) => ({
		id: sub?.id || crypto.randomUUID(),
		name: sub?.name ?? '',
		hidden: !!sub?.hidden,
		// Income sections only; harmless on expense sections.
		target: sub?.target ?? null,
		fenced: sub?.fenced === true,
		amount:
			sub?.amount === null || sub?.amount === undefined || sub?.amount === ''
				? null
				: Number(sub.amount),
		// Expense sections only: the income line that created it.
		ownedBy: sub?.ownedBy ?? null,
		items: normalizeItems(sub?.items)
	}));
}

/** Custom (user-defined) expense categories — budget type "Custom". */
export function normalizeExpenseCategories(raw: any): ExpenseCategory[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((cat: any) => ({
		id: cat?.id || crypto.randomUUID(),
		name: cat?.name ?? 'Expenses',
		hidden: !!cat?.hidden,
		ownedBy: cat?.ownedBy ?? null,
		subsections: normalizeSubsections(cat?.subsections)
	}));
}

/* ---------- Totals (hidden rows/sections are always excluded) ---------- */

/** True when the line is a "sub-item section" — its amounts come from its children. */
export function hasChildren(item: BudgetItem | null | undefined): boolean {
	return !!item && Array.isArray(item.children) && item.children.length > 0;
}

/** Budgeted unit price: typed in directly, or the sum of visible sub-items. */
export function itemBudgetedUnit(item: BudgetItem): number {
	if (hasChildren(item)) return itemsBudgetedTotal(item.children);
	return num(item.price);
}

/** Actual unit price: typed in directly, or the sum of visible sub-items.
 *  Independent from Budgeted — an empty Actual counts as 0, never as the
 *  budgeted price, so the two columns always total separately. */
export function itemActualUnit(item: BudgetItem): number {
	if (hasChildren(item)) return itemsActualTotal(item.children);
	return num(item.actual);
}

export function itemBudgetedTotal(item: BudgetItem): number {
	// A line with sub-items is just their sum — its own Qty is N/A.
	if (hasChildren(item)) return itemBudgetedUnit(item);
	return itemBudgetedUnit(item) * (num(item.quantity) || 1);
}

/** Actual line total (0 when no Actual was entered). */
export function itemActualTotal(item: BudgetItem): number {
	if (hasChildren(item)) return itemActualUnit(item);
	return itemActualUnit(item) * (num(item.quantity) || 1);
}

/** Does this line (or any of its sub-items) have an Actual entered? */
export function itemHasActual(item: BudgetItem): boolean {
	if (hasChildren(item)) return itemsHaveActuals(item.children);
	return item.actual !== null && item.actual !== undefined;
}

export function itemsBudgetedTotal(items: BudgetItem[] | undefined | null): number {
	return (items || []).filter((i) => !i.hidden).reduce((acc, i) => acc + itemBudgetedTotal(i), 0);
}

export function itemsActualTotal(items: BudgetItem[] | undefined | null): number {
	return (items || []).filter((i) => !i.hidden).reduce((acc, i) => acc + itemActualTotal(i), 0);
}

export function itemsHaveActuals(items: BudgetItem[] | undefined | null): boolean {
	return (items || []).some(
		(i) =>
			!i.hidden &&
			((i.actual !== null && i.actual !== undefined) || itemsHaveActuals(i.children))
	);
}

/** A fresh blank line, with Unit pre-filled to "Item". */
export function blankItem(): BudgetItem {
	return {
		id: crypto.randomUUID(),
		name: '',
		price: null,
		actual: null,
		quantity: 1,
		unit: 'Item',
		hidden: false,
		flagged: false,
		children: [],
		collapsed: false,
		allocation: null,
		note: ''
	};
}

/** A fresh income line — unlinked, so it follows its income section. */
export function blankIncomeLine(allocation: AllocationTarget | null = null): BudgetItem {
	return { ...blankItem(), unit: '', allocation, fenced: !!allocation };
}

export function blankSection(name = ''): BudgetSubsection {
	return { id: crypto.randomUUID(), name, hidden: false, items: [], target: null, fenced: false };
}

/** A fresh income section, optionally tied to an expense category. */
export function blankIncomeSection(name = '', target: string | null = null): BudgetSubsection {
	return {
		id: crypto.randomUUID(),
		name,
		hidden: false,
		items: [],
		target,
		fenced: !!target,
		amount: null
	};
}

/**
 * What an income section is worth: the sum of its lines, or — while it has
 * none — the amount typed straight into the section.
 */
export function sectionIncomeTotal(sec: BudgetSubsection): number {
	const items = (sec?.items || []).filter((i) => !i.hidden);
	if (items.length) return itemsBudgetedTotal(items);
	return num(sec?.amount);
}

export function incomeSectionsTotal(sections: BudgetSubsection[] | null | undefined): number {
	return (sections || []).filter((s) => !s.hidden).reduce((acc, s) => acc + sectionIncomeTotal(s), 0);
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

/* ------------------------------------------------------------------ */
/*  Categories — the four built-in ones, or a custom list              */
/* ------------------------------------------------------------------ */

/** One expense category, resolved for whatever budget type is in play. */
export type ResolvedCategory = {
	/** store key AND drag&drop cat key: 'technical' | 'custom:<uuid>' | ... */
	key: string;
	label: string;
	/** Artist Fee is a flat item list (no sections) */
	flat: boolean;
	hidden: boolean;
	subs: BudgetSubsection[];
	items: BudgetItem[];
	/** set on custom categories */
	customId?: string;
};

/** The four built-in categories, usable as quick-adds inside a Custom budget. */
export const BUILT_IN_CATEGORIES: { key: string; label: string; flat: boolean }[] = [
	{ key: 'artist_fee', label: 'Artist Fee', flat: true },
	{ key: 'technical', label: 'Technical', flat: false },
	{ key: 'hospitality', label: 'Hospitality', flat: false },
	{ key: 'other_expenses', label: 'Other Expenses', flat: false }
];

export const isCustomType = (state: any) => (state?.budget_type || 'Tour Prod') === 'Custom';

/** Every expense category this budget shows, in display order. */
export function expenseCategoriesOf(state: any): ResolvedCategory[] {
	const type = state?.budget_type || 'Tour Prod';

	if (type === 'Custom') {
		return (state?.custom_expenses || []).map((cat: ExpenseCategory) => ({
			key: `custom:${cat.id}`,
			label: cat.name || 'Untitled',
			flat: false,
			hidden: !!cat.hidden,
			subs: cat.subsections || [],
			items: [],
			customId: cat.id
		}));
	}

	const out: ResolvedCategory[] = [];
	if (type === 'Complete Prod') {
		out.push({
			key: 'artist_fee',
			label: 'Artist Fee',
			flat: true,
			hidden: false,
			subs: [],
			items: state?.artist_fee || []
		});
	}
	out.push({ key: 'technical', label: 'Technical', flat: false, hidden: false, subs: state?.technical || [], items: [] });
	out.push({ key: 'hospitality', label: 'Hospitality', flat: false, hidden: false, subs: state?.hospitality || [], items: [] });
	out.push({ key: 'other_expenses', label: 'Other Expenses', flat: false, hidden: false, subs: state?.other_expenses || [], items: [] });
	return out;
}

export function categoryBudgeted(cat: ResolvedCategory): number {
	return cat.flat ? itemsBudgetedTotal(cat.items) : subsBudgetedTotal(cat.subs);
}
export function categoryActual(cat: ResolvedCategory): number {
	return cat.flat ? itemsActualTotal(cat.items) : subsActualTotal(cat.subs);
}
export function categoryHasActuals(cat: ResolvedCategory): boolean {
	return cat.flat ? itemsHaveActuals(cat.items) : subsHaveActuals(cat.subs);
}

/** Budgeted expenses for the whole budget (hidden categories excluded). */
export function totalExpensesOf(state: any): number {
	return expenseCategoriesOf(state)
		.filter((c) => !c.hidden)
		.reduce((acc, c) => acc + categoryBudgeted(c), 0);
}

export function totalActualExpensesOf(state: any): number {
	return expenseCategoriesOf(state)
		.filter((c) => !c.hidden)
		.reduce((acc, c) => acc + categoryActual(c), 0);
}

export function hasAnyActuals(state: any): boolean {
	return expenseCategoriesOf(state).some((c) => !c.hidden && categoryHasActuals(c));
}

/** Build a custom category out of one of the built-in ones, content included. */
export function categoryFromBuiltIn(state: any, key: string, label: string): ExpenseCategory {
	const clone = (v: any) => JSON.parse(JSON.stringify(v ?? []));
	if (key === 'artist_fee') {
		const items = normalizeItems(clone(state?.artist_fee));
		return {
			id: crypto.randomUUID(),
			name: label,
			hidden: false,
			subsections: items.length ? [{ id: crypto.randomUUID(), name: label, hidden: false, items }] : []
		};
	}
	return {
		id: crypto.randomUUID(),
		name: label,
		hidden: false,
		subsections: normalizeSubsections(clone(state?.[key]))
	};
}

/* ------------------------------------------------------------------ */
/*  Income                                                             */
/* ------------------------------------------------------------------ */

/**
 * Income sections — the builder introduced with the Custom budget type.
 *
 * Tour / Internal / Complete keep the fixed income fields they have always
 * had (income_technical, income_hospitality, ...), so they return nothing here.
 */
export function incomeSectionViews(state: any): { section: BudgetSubsection; index: number }[] {
	if ((state?.budget_type || 'Tour Prod') !== 'Custom') return [];
	const all: BudgetSubsection[] = state?.income || [];
	return all.map((section, index) => ({ section, index }));
}

export function incomeSectionsOf(state: any): BudgetSubsection[] {
	return incomeSectionViews(state).map((v) => v.section);
}

/** The fixed income fields, respecting the per-source on/off switches. */
export function legacyIncomeTotal(row: any): number {
	const type = row?.budget_type || 'Tour Prod';
	if (type === 'Internal Prod') return num(row?.income_total_budget);

	let enabled: any = row?.income_enabled;
	if (typeof enabled === 'string') {
		try {
			enabled = JSON.parse(enabled);
		} catch {
			enabled = null;
		}
	}
	const on = (key: string) => enabled?.[key] !== false;

	let total = 0;
	if (on('technical')) total += num(row?.income_technical);
	if (on('hospitality')) total += num(row?.income_hospitality);
	if (on('other')) total += num(row?.income_other);
	if (type === 'Complete Prod' && on('artist')) total += num(row?.income_artist);
	return total;
}

/** Total budget of whatever model this budget type uses. */
export function totalIncomeOf(state: any): number {
	if ((state?.budget_type || 'Tour Prod') !== 'Custom') return legacyIncomeTotal(state);
	return incomeSectionsTotal(incomeSectionsOf(state));
}

/* ------------------------------------------------------------------ */
/*  Allocation — which money is fenced to which expenses               */
/* ------------------------------------------------------------------ */

export type AllocationRow = {
	target: AllocationTarget;
	label: string;
	kind: 'cat' | 'sec';
	allocated: number;
	spent: number;
	actualSpent: number;
	/** allocated − spent (negative = over budget) */
	remaining: number;
};

export type AllocationReport = {
	rows: AllocationRow[];
	pool: {
		allocated: number;
		/** unallocated spend + every overrun drawn from the pool */
		spent: number;
		remaining: number;
		unallocatedSpend: number;
		overruns: number;
	};
	/** money fenced to a section that was not spent there */
	unusedFenced: number;
	totalIncome: number;
	totalAllocated: number;
	totalExpenses: number;
};

/** target -> label, for every allocatable expense bucket. */
export function allocationLabels(state: any): Map<string, string> {
	const m = new Map<string, string>();
	for (const cat of expenseCategoriesOf(state)) {
		m.set(`cat:${cat.key}`, cat.label);
		for (const sub of cat.subs) {
			m.set(`sec:${sub.id}`, `${cat.label} · ${sub.name || 'Section'}`);
		}
	}
	m.set(POOL_TARGET, 'All expenses (pool)');
	return m;
}

/** The bucket one income line actually funds. */
export function lineTarget(section: BudgetSubsection, line: BudgetItem): string {
	if (line.fenced && line.allocation) return line.allocation;
	if (section?.fenced && section?.target) return section.target;
	return POOL_TARGET;
}

/** Sum of live income per target. */
export function allocationsOf(state: any): Map<string, number> {
	const m = new Map<string, number>();
	for (const sec of incomeSectionsOf(state)) {
		if (sec.hidden) continue;
		const own = sec.fenced && sec.target ? sec.target : POOL_TARGET;
		const lines = (sec.items || []).filter((l) => !l.hidden);
		// No lines yet: the amount typed on the section funds its own target.
		if (lines.length === 0) {
			const amount = num(sec.amount);
			if (amount) m.set(own, (m.get(own) || 0) + amount);
			continue;
		}
		for (const line of lines) {
			const t = lineTarget(sec, line);
			m.set(t, (m.get(t) || 0) + itemBudgetedTotal(line));
		}
	}
	return m;
}

/**
 * Full allocation picture.
 *
 * A section's spend belongs to the most specific bucket that has money fenced
 * to it (its own allocation, then its category); anything else is covered by
 * the pool. Overruns on a fenced bucket spill into the pool — that's the whole
 * point of pooled money: a section that goes over is topped up from it.
 */
export function computeAllocation(state: any): AllocationReport {
	const alloc = allocationsOf(state);
	const labels = allocationLabels(state);

	type Spend = { b: number; a: number };
	const spend = new Map<string, Spend>();
	const add = (target: string, b: number, a: number) => {
		const cur = spend.get(target) || { b: 0, a: 0 };
		cur.b += b;
		cur.a += a;
		spend.set(target, cur);
	};

	for (const cat of expenseCategoriesOf(state)) {
		if (cat.hidden) continue;
		const catTarget = `cat:${cat.key}`;
		if (cat.flat) {
			add(
				alloc.has(catTarget) ? catTarget : POOL_TARGET,
				itemsBudgetedTotal(cat.items),
				itemsActualTotal(cat.items)
			);
			continue;
		}
		for (const sub of cat.subs) {
			if (sub.hidden) continue;
			const secTarget = `sec:${sub.id}`;
			const owner = alloc.has(secTarget) ? secTarget : alloc.has(catTarget) ? catTarget : POOL_TARGET;
			add(owner, itemsBudgetedTotal(sub.items), itemsActualTotal(sub.items));
		}
	}

	const rows: AllocationRow[] = [];
	for (const [target, allocated] of alloc) {
		if (target === POOL_TARGET) continue;
		const s = spend.get(target) || { b: 0, a: 0 };
		rows.push({
			target,
			label: labels.get(target) || 'Removed section',
			kind: target.startsWith('sec:') ? 'sec' : 'cat',
			allocated,
			spent: s.b,
			actualSpent: s.a,
			remaining: allocated - s.b
		});
	}
	rows.sort((a, b) => a.label.localeCompare(b.label));

	const overruns = rows.reduce((acc, r) => acc + Math.max(0, -r.remaining), 0);
	const unusedFenced = rows.reduce((acc, r) => acc + Math.max(0, r.remaining), 0);
	const unallocatedSpend = (spend.get(POOL_TARGET) || { b: 0 }).b;
	const poolAllocated = alloc.get(POOL_TARGET) || 0;

	return {
		rows,
		pool: {
			allocated: poolAllocated,
			spent: unallocatedSpend + overruns,
			remaining: poolAllocated - unallocatedSpend - overruns,
			unallocatedSpend,
			overruns
		},
		unusedFenced,
		totalIncome: totalIncomeOf(state),
		totalAllocated: Array.from(alloc.values()).reduce((a, b) => a + b, 0) - poolAllocated,
		totalExpenses: totalExpensesOf(state)
	};
}

export type CategoryBreakdown = {
	key: string;
	label: string;
	/** income fenced to this category (its own + its sections') */
	budget: number;
	expenses: number;
	actual: number;
};

/** Per-category Budget vs Expenses, for the totals panel breakdown. */
export function categoryBreakdown(state: any): CategoryBreakdown[] {
	const alloc = allocationsOf(state);
	return expenseCategoriesOf(state)
		.filter((cat) => !cat.hidden)
		.map((cat) => {
			let budget = alloc.get(`cat:${cat.key}`) || 0;
			for (const sub of cat.subs) budget += alloc.get(`sec:${sub.id}`) || 0;
			return {
				key: cat.key,
				label: cat.label,
				budget,
				expenses: categoryBudgeted(cat),
				actual: categoryActual(cat)
			};
		});
}

/** Money fenced to one section (0 when it just draws from the pool). */
export function allocatedToSection(state: any, sectionId: string): number {
	return allocationsOf(state).get(`sec:${sectionId}`) || 0;
}

/** Money fenced to one category, ignoring what its sections fence themselves. */
export function allocatedToCategory(state: any, catKey: string): number {
	return allocationsOf(state).get(`cat:${catKey}`) || 0;
}

/* ---------- Legacy helpers (event list / cross-page totals) ---------- */

/** Total budget (income side) for a show_budget row — used by the event list. */
export function incomeTotalFor(row: any): number {
	if ((row?.budget_type || 'Tour Prod') !== 'Custom') return legacyIncomeTotal(row);

	let sections: any = row?.income ?? row?.income_sections;
	if (typeof sections === 'string') {
		try {
			sections = JSON.parse(sections);
		} catch {
			sections = null;
		}
	}
	return incomeSectionsTotal(normalizeSubsections(Array.isArray(sections) ? sections : []));
}
