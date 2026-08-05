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
};

export type BudgetSubsection = {
	id: string;
	name: string;
	/** Whole section excluded from totals + PDF when true */
	hidden: boolean;
	items: BudgetItem[];
};

export type AmountsMode = 'both' | 'budgeted' | 'actual';

export type ExportOptions = {
	amounts: AmountsMode;
	sections: {
		artist_fee: boolean;
		technical: boolean;
		hospitality: boolean;
		other_expenses: boolean;
	};
	includeIncome: boolean;
};
