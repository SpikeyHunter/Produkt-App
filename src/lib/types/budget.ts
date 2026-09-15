// Shape of Preset data + budget line items.
// NOTE: `price` is the BUDGETED amount (kept as-is so older budgets are untouched).
// `actual` is the new Actual $ column. `hidden` and `flagged` are per-row states.

export type Preset = {
	id: string;
	name: string;
	category: string;
	type: string | null;
	price: number | null;
	quantity: number | null;
	unit: string | null;
};

/**
 * Where an income line's money is fenced:
 *   'all'            -> general pool: covers any expense, anywhere
 *   'cat:<storeKey>' -> one whole expense category (technical, custom:<id>, ...)
 *   'sec:<uuid>'     -> one expense section (e.g. "Labour - Setup/Teardown")
 */
export type AllocationTarget = string;
export const POOL_TARGET = 'all';

export type BudgetItem = {
	id: string;
	name: string;
	/** Budgeted $ (legacy column name kept so existing budgets keep working) */
	price: number | null;
	/** Actual $ (new) */
	actual: number | null;
	quantity: number;
	unit: string;
	/** Excluded from totals + PDF when true */
	hidden: boolean;
	/** Line flagged "to be revised" (rendered in problem color) */
	flagged: boolean;
	/** Sub-items. When present, the parent's Budgeted/Actual are the sum of these. */
	children: BudgetItem[];
	/** Sub-items folded away in the UI (display only) */
	collapsed: boolean;
	/**
	 * INCOME lines only: the expense section this line owns (`sec:<id>`).
	 * Remembered even when unlinked, so the link icon can switch back on.
	 */
	allocation?: AllocationTarget | null;
	/** INCOME lines only: link on = spend it only on `allocation`. */
	fenced?: boolean;
	/** Free-text note (income lines: where the money comes from) */
	note?: string;
};

export type BudgetSubsection = {
	id: string;
	name: string;
	/** Whole section excluded from totals + PDF when true */
	hidden: boolean;
	items: BudgetItem[];
	/** INCOME sections only: the expense category this budget corresponds to. */
	target?: AllocationTarget | null;
	/** INCOME sections only: true = spend it only on `target`, false = anywhere. */
	fenced?: boolean;
	/** INCOME sections only: typed straight in, used while it has no lines. */
	amount?: number | null;
	/** EXPENSE sections: id of the income line that created it (name is locked). */
	ownedBy?: string | null;
};

/** A user-defined expense category (budget type "Custom"). */
export type ExpenseCategory = {
	id: string;
	name: string;
	hidden: boolean;
	subsections: BudgetSubsection[];
	/** id of the income section that created it (name is locked) */
	ownedBy?: string | null;
};

export type BudgetTypeName = 'Tour Prod' | 'Internal Prod' | 'Complete Prod' | 'Custom';

export const BUDGET_TYPES: BudgetTypeName[] = [
	'Tour Prod',
	'Internal Prod',
	'Complete Prod',
	'Custom'
];

export type AmountsMode = 'both' | 'budgeted' | 'actual';

export type ExportOptions = {
	amounts: AmountsMode;
	/** Keyed by store key ('technical', 'custom:<id>', ...). Missing = included. */
	sections: Record<string, boolean>;
	includeIncome: boolean;
	/** Print the "Budget allocation" breakdown block */
	includeAllocation: boolean;
	/** Print the Summary card at the end (default true) */
	includeSummary?: boolean;
};
