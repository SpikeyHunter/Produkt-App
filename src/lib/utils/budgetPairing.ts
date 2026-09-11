/**
 * budgetPairing — keeps the income side and the expense side in step.
 *
 * The link icon on an income line means "this money only pays for its own
 * expense section". Rather than making you go and create that section by hand,
 * switching the link on creates it, names it after the line and locks the name
 * (`ownedBy`), so the two can never drift apart. Switching the link off gives
 * the section back: it is removed when nothing was booked against it, and
 * simply unlocked when it holds real costs.
 *
 * The same pairing exists one level up in a Custom budget: an income section
 * owns the expense category of the same name.
 *
 * Every function returns the STORE KEYS it touched, so the caller knows what
 * to save.
 */
import type { BudgetItem, BudgetSubsection, ExpenseCategory } from '$lib/types/budget';
import {
	blankSection,
	blankIncomeSection,
	itemsBudgetedTotal,
	itemsActualTotal
} from '$lib/utils/budgetUtils';
import { isCustomCat, customCatId, storeKeyFor } from '$lib/utils/budgetDnd';

const log = (...args: any[]) => console.log('[budget]', ...args);

/** The sections array of a category, or null when it has none (Artist Fee). */
export function subsOfCategory(state: any, catKey: string): BudgetSubsection[] | null {
	if (catKey === 'artist_fee') return null;
	if (isCustomCat(catKey)) {
		const cat = (state?.custom_expenses || []).find((c: ExpenseCategory) => c.id === customCatId(catKey));
		if (!cat) return null;
		if (!Array.isArray(cat.subsections)) cat.subsections = [];
		return cat.subsections;
	}
	if (!Array.isArray(state?.[catKey])) return null;
	return state[catKey];
}

/** Reassign the touched array so Svelte sees a new reference. */
function bump(state: any, catKey: string) {
	if (isCustomCat(catKey)) {
		state.custom_expenses = [...(state.custom_expenses || [])];
		return;
	}
	if (Array.isArray(state[catKey])) state[catKey] = [...state[catKey]];
}

const catKeyOf = (target: string | null | undefined) =>
	target && target.startsWith('cat:') ? target.slice(4) : null;

const secIdOf = (allocation: string | null | undefined) =>
	allocation && allocation.startsWith('sec:') ? allocation.slice(4) : null;

/** Can this income line own an expense section? Only inside a tied, sectioned category. */
export function canLinkLine(state: any, section: BudgetSubsection): boolean {
	const key = catKeyOf(section?.target);
	if (!key || !section?.fenced) return false;
	return subsOfCategory(state, key) !== null;
}

/** Find the expense section an income line owns (null when it has none yet). */
export function linkedSection(state: any, section: BudgetSubsection, line: BudgetItem) {
	const key = catKeyOf(section?.target);
	const id = secIdOf(line?.allocation);
	if (!key || !id) return null;
	const subs = subsOfCategory(state, key);
	const found = subs?.find((s) => s.id === id);
	return found ? { subs: subs!, section: found, catKey: key } : null;
}

/** Switch the link ON — creating the expense section if it doesn't exist. */
export function linkLine(state: any, section: BudgetSubsection, line: BudgetItem): string[] {
	const catKey = catKeyOf(section?.target);
	if (!catKey) return [];
	const subs = subsOfCategory(state, catKey);
	if (!subs) return [];

	const existing = linkedSection(state, section, line);
	if (existing) {
		existing.section.name = line.name || 'Budget line';
		existing.section.ownedBy = line.id;
	} else {
		const created = blankSection(line.name || 'Budget line');
		created.ownedBy = line.id;
		subs.push(created);
		line.allocation = `sec:${created.id}`;
		log('pairing: created expense section', created.name, 'in', catKey);
	}
	line.fenced = true;
	bump(state, catKey);
	return [storeKeyFor(catKey)];
}

/**
 * Switch the link OFF. An empty section it created is removed; one holding real
 * costs stays put and is handed back (name editable again).
 */
export function unlinkLine(state: any, section: BudgetSubsection, line: BudgetItem): string[] {
	line.fenced = false;
	const found = linkedSection(state, section, line);
	if (!found) return [];

	const empty =
		(found.section.items || []).length === 0 ||
		(itemsBudgetedTotal(found.section.items) === 0 && itemsActualTotal(found.section.items) === 0);

	if (empty) {
		const i = found.subs.indexOf(found.section);
		if (i >= 0) found.subs.splice(i, 1);
		line.allocation = null;
		log('pairing: removed the empty expense section it had created');
	} else {
		found.section.ownedBy = null; // real costs in there — keep them, unlock the name
	}
	bump(state, found.catKey);
	return [storeKeyFor(found.catKey)];
}

/** Keep the owned expense section's name in step with the line. */
export function syncLineName(state: any, section: BudgetSubsection, line: BudgetItem): string[] {
	if (!line.fenced) return [];
	const found = linkedSection(state, section, line);
	if (!found || found.section.name === (line.name || '')) return [];
	found.section.name = line.name || 'Budget line';
	bump(state, found.catKey);
	return [storeKeyFor(found.catKey)];
}

/** The line is gone — release the expense section it owned. */
export function releaseLine(state: any, section: BudgetSubsection, line: BudgetItem): string[] {
	const found = linkedSection(state, section, line);
	if (!found) return [];
	const empty = (found.section.items || []).length === 0;
	if (empty) {
		const i = found.subs.indexOf(found.section);
		if (i >= 0) found.subs.splice(i, 1);
	} else {
		found.section.ownedBy = null;
	}
	bump(state, found.catKey);
	return [storeKeyFor(found.catKey)];
}

/* ------------------------- Custom: section <-> category ------------------------- */

export function linkedCategory(state: any, section: BudgetSubsection): ExpenseCategory | null {
	const key = catKeyOf(section?.target);
	if (!key || !isCustomCat(key)) return null;
	return (state?.custom_expenses || []).find((c: ExpenseCategory) => c.id === customCatId(key)) || null;
}

/** A new Custom income section gets its own expense category. */
export function createCategoryFor(state: any, section: BudgetSubsection): string[] {
	if (!Array.isArray(state.custom_expenses)) state.custom_expenses = [];
	const cat: ExpenseCategory = {
		id: crypto.randomUUID(),
		name: section.name || 'Budget',
		hidden: false,
		ownedBy: section.id,
		subsections: []
	};
	state.custom_expenses = [...state.custom_expenses, cat];
	section.target = `cat:custom:${cat.id}`;
	section.fenced = true;
	log('pairing: created expense category', cat.name);
	return ['custom_expenses'];
}

/**
 * Reordering the income sections reorders the expense categories they own, so
 * the two columns always read in the same order. Categories nobody owns keep
 * the slots they already hold — only the owned ones are shuffled between them.
 */
export function syncCategoryOrder(state: any): string[] {
	const cats: ExpenseCategory[] = state?.custom_expenses || [];
	if (cats.length < 2) return [];

	const rank = new Map<string, number>();
	(state?.income || []).forEach((sec: BudgetSubsection, i: number) => rank.set(sec.id, i));

	const slots: number[] = [];
	cats.forEach((c, i) => {
		if (c.ownedBy && rank.has(c.ownedBy)) slots.push(i);
	});
	if (slots.length < 2) return [];

	const ordered = slots
		.map((i) => cats[i])
		.sort((a, b) => (rank.get(a.ownedBy!) ?? 0) - (rank.get(b.ownedBy!) ?? 0));

	const next = [...cats];
	slots.forEach((pos, k) => (next[pos] = ordered[k]));
	if (next.every((c, i) => c === cats[i])) return [];

	state.custom_expenses = next;
	log('pairing: expense categories reordered to match the income sections');
	return ['custom_expenses'];
}

/** The mirror of createCategoryFor: a new expense category gets its budget section. */
export function createSectionForCategory(state: any, cat: ExpenseCategory): string[] {
	if (!Array.isArray(state.income)) state.income = [];
	const section = blankIncomeSection(cat.name || 'Budget', `cat:custom:${cat.id}`);
	state.income = [...state.income, section];
	cat.ownedBy = section.id;
	log('pairing: created budget section', section.name);
	return ['income_sections'];
}

/** The category is gone — drop an empty budget section, pool a funded one. */
export function releaseCategory(state: any, cat: ExpenseCategory): string[] {
	if (!cat?.ownedBy) return [];
	const section = (state?.income || []).find((s: BudgetSubsection) => s.id === cat.ownedBy);
	if (!section) return [];

	const empty = (section.items || []).length === 0 && !Number(section.amount);
	if (empty) {
		state.income = (state.income || []).filter((s: BudgetSubsection) => s.id !== section.id);
	} else {
		// Keep the money, but it no longer has a category to be reserved for.
		section.target = null;
		section.fenced = false;
		state.income = [...(state.income || [])];
	}
	return ['income_sections'];
}

export function syncSectionName(state: any, section: BudgetSubsection): string[] {
	const cat = linkedCategory(state, section);
	if (!cat || cat.name === (section.name || '')) return [];
	cat.name = section.name || 'Budget';
	state.custom_expenses = [...(state.custom_expenses || [])];
	return ['custom_expenses'];
}

/** The income section is gone — drop an empty category, unlock a used one. */
export function releaseSection(state: any, section: BudgetSubsection): string[] {
	const cat = linkedCategory(state, section);
	if (!cat) return [];
	const empty = (cat.subsections || []).length === 0;
	if (empty) {
		state.custom_expenses = (state.custom_expenses || []).filter((c: ExpenseCategory) => c.id !== cat.id);
	} else {
		cat.ownedBy = null;
		state.custom_expenses = [...(state.custom_expenses || [])];
	}
	return ['custom_expenses'];
}
