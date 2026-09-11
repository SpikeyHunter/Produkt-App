/**
 * budgetDnd — drag & drop for budget lines, sub-items and sections.
 *
 * Rows live in deeply nested components, so instead of bubbling events through
 * five layers this module keeps a small module-level "context" pointing at the
 * budget store. BudgetDetailsDisplay registers it on mount; every row simply
 * declares what it is (a path) and what it's hovering over.
 *
 * Supported moves:
 *   item  <-> item      (reorder, across sections, across categories)
 *   item  <-> sub-item  (promote a sub-item out, demote an item in)
 *   section            (reorder within a category, or move to another category)
 */
import { writable, get } from 'svelte/store';

const log = (...args: any[]) => console.log('[budget]', ...args);
import type { Writable } from 'svelte/store';

/**
 * Which list a thing lives in. Beyond the four built-in expense categories this
 * is also 'income' and, for custom budgets, 'custom:<category uuid>' — so it's
 * a plain string and the helpers below resolve it.
 */
export type StoreKey = string;

export const STORE_TO_DB: Record<string, string> = {
	artist_fee: 'expenses_artist_fee',
	technical: 'expenses_technical',
	hospitality: 'expenses_hospitality',
	other_expenses: 'expenses_other',
	income: 'income_sections'
};

export const isCustomCat = (cat: string) => cat.startsWith('custom:');
export const customCatId = (cat: string) => cat.slice('custom:'.length);

/** DB column a category writes to (every custom category shares one column). */
export function dbColumnFor(cat: StoreKey): string {
	return isCustomCat(cat) ? 'custom_expenses' : STORE_TO_DB[cat];
}

/** Store key a category writes to — what markDirty() expects. */
export function storeKeyFor(cat: StoreKey): string {
	return isCustomCat(cat) ? 'custom_expenses' : cat;
}

/** Income and expenses never mix, even though they share the row machinery. */
const sideOf = (cat: StoreKey) => (cat === 'income' ? 'income' : 'expense');

/** Where a thing lives. `sub` is -1 for flat categories (Artist Fee). */
export type DragPath = {
	cat: StoreKey;
	sub: number;
	item: number;
	child: number;
};

export type DragKind = 'section' | 'item' | 'child';

export type DragPayload = {
	kind: DragKind;
	path: DragPath;
	/** Shown in the drag preview */
	label: string;
	/** Items that already have sub-items can't be nested inside another item */
	hasKids: boolean;
};

export type DropKind =
	| 'section' // before/after an existing section
	| 'item' // before/after an existing item
	| 'child' // before/after an existing sub-item
	| 'items-end' // end of a section's item list (also: empty section)
	| 'children-end' // end of an item's sub-item list
	| 'sections-end'; // end of a category's section list

export type DropTarget = {
	kind: DropKind;
	path: DragPath;
	/** 'before' | 'after' — ignored by the *-end targets */
	edge?: 'before' | 'after';
};

/** Currently dragged thing (null when idle). Components read this to light up drop zones. */
export const dragging = writable<DragPayload | null>(null);

/* ---------------------------------------------------------------- context */

let ctxStore: Writable<any> | null = null;
let ctxSave: ((columns: string[]) => void) | null = null;

/** Called once by BudgetDetailsDisplay. Returns a teardown function. */
export function registerDndContext(store: Writable<any>, save: (columns: string[]) => void) {
	log('dnd: context registered');
	ctxStore = store;
	ctxSave = save;
	return () => {
		ctxStore = null;
		ctxSave = null;
	};
}

export function beginDrag(payload: DragPayload) {
	log('dnd: drag start —', payload.kind, JSON.stringify(payload.path), payload.label);
	dragging.set(payload);
}

export function endDrag() {
	dragging.set(null);
}

/* ------------------------------------------------------------ addressing */

function sectionsOf(state: any, cat: StoreKey): any[] | null {
	if (cat === 'artist_fee') return null; // flat category, no sections
	if (isCustomCat(cat)) {
		const id = customCatId(cat);
		const found = (state?.custom_expenses || []).find((c: any) => c?.id === id);
		if (!found) return null;
		if (!Array.isArray(found.subsections)) found.subsections = [];
		return found.subsections;
	}
	return Array.isArray(state?.[cat]) ? state[cat] : null;
}

function itemsOf(state: any, cat: StoreKey, sub: number): any[] | null {
	if (cat === 'artist_fee') return Array.isArray(state?.artist_fee) ? state.artist_fee : null;
	const subs = sectionsOf(state, cat);
	const s = subs?.[sub];
	if (!s) return null;
	if (!Array.isArray(s.items)) s.items = [];
	return s.items;
}

function childrenOf(state: any, cat: StoreKey, sub: number, item: number): any[] | null {
	const items = itemsOf(state, cat, sub);
	const parent = items?.[item];
	if (!parent) return null;
	if (!Array.isArray(parent.children)) parent.children = [];
	return parent.children;
}

function sourceContainer(state: any, src: DragPayload): any[] | null {
	if (src.kind === 'section') return sectionsOf(state, src.path.cat);
	if (src.kind === 'item') return itemsOf(state, src.path.cat, src.path.sub);
	return childrenOf(state, src.path.cat, src.path.sub, src.path.item);
}

function sourceIndex(src: DragPayload): number {
	if (src.kind === 'section') return src.path.sub;
	if (src.kind === 'item') return src.path.item;
	return src.path.child;
}

function destContainer(state: any, dest: DropTarget): any[] | null {
	switch (dest.kind) {
		case 'section':
		case 'sections-end':
			return sectionsOf(state, dest.path.cat);
		case 'item':
		case 'items-end':
			return itemsOf(state, dest.path.cat, dest.path.sub);
		case 'child':
		case 'children-end':
			return childrenOf(state, dest.path.cat, dest.path.sub, dest.path.item);
	}
	return null;
}

function destIndex(dest: DropTarget, container: any[]): number {
	const after = dest.edge === 'after' ? 1 : 0;
	switch (dest.kind) {
		case 'section':
			return dest.path.sub + after;
		case 'item':
			return dest.path.item + after;
		case 'child':
			return dest.path.child + after;
		default:
			return container.length;
	}
}

/* -------------------------------------------------------------- validity */

const samePath = (a: DragPath, b: DragPath, upTo: 'sub' | 'item') =>
	a.cat === b.cat && a.sub === b.sub && (upTo === 'sub' || a.item === b.item);

/**
 * Pure check — components call this on dragover to decide whether to show an
 * insertion line, so an illegal drop never even looks possible.
 */
export function canDrop(src: DragPayload | null, dest: DropTarget): boolean {
	if (!src) return false;

	const sectionTarget = dest.kind === 'section' || dest.kind === 'sections-end';
	const childTarget = dest.kind === 'child' || dest.kind === 'children-end';

	// Income lines and expense lines are different things — never swap sides.
	if (sideOf(src.path.cat) !== sideOf(dest.path.cat)) return false;
	// An income line has no sub-items.
	if (src.path.cat === 'income' && childTarget) return false;

	// Sections only ever go where sections go, and vice versa.
	if (src.kind === 'section') {
		if (!sectionTarget) return false;
		if (dest.path.cat === 'artist_fee') return false; // flat category has no sections
		// dropping a section onto itself is a no-op
		if (dest.kind === 'section' && samePath(src.path, dest.path, 'sub')) return false;
		return true;
	}
	if (sectionTarget) return false;

	// Only one level of nesting: a line that already has sub-items stays top level.
	if (childTarget && src.hasKids) return false;

	// A line can't be dropped into its own sub-item list.
	if (childTarget && src.kind === 'item' && samePath(src.path, dest.path, 'item')) return false;

	// Dropping a sub-item onto itself is a no-op.
	if (dest.kind === 'child' && src.kind === 'child' && samePath(src.path, dest.path, 'item') && src.path.child === dest.path.child)
		return false;

	return true;
}

/* ------------------------------------------------------------------ move */

/** Performs the move and triggers a save of every column touched. */
export function dropOn(dest: DropTarget): void {
	const src = get(dragging);
	endDrag();
	if (!src) return;
	if (!ctxStore) {
		log('dnd: drop ignored — no context registered');
		return;
	}
	if (!canDrop(src, dest)) {
		log('dnd: drop rejected —', src.kind, '→', dest.kind);
		return;
	}
	log('dnd: drop —', src.kind, JSON.stringify(src.path), '→', dest.kind, JSON.stringify(dest.path), dest.edge || '');

	const state = get(ctxStore);
	if (!state) return;

	const from = sourceContainer(state, src);
	const fromIdx = sourceIndex(src);
	if (!from || fromIdx < 0 || fromIdx >= from.length) return;

	const to = destContainer(state, dest);
	if (!to) return;

	const node = from[fromIdx];
	if (!node) return;

	// A promoted sub-item becomes a normal line; a demoted line keeps no nesting.
	if (dest.kind === 'child' || dest.kind === 'children-end') node.children = [];

	let insertAt = destIndex(dest, to);
	from.splice(fromIdx, 1);
	if (to === from && fromIdx < insertAt) insertAt -= 1;
	insertAt = Math.max(0, Math.min(insertAt, to.length));
	to.splice(insertAt, 0, node);

	// Reassign the touched category arrays so Svelte sees new references.
	const cats: StoreKey[] = Array.from(new Set([src.path.cat, dest.path.cat]));
	const next = { ...state };
	for (const cat of cats) {
		const key = storeKeyFor(cat);
		if (Array.isArray(next[key])) next[key] = [...next[key]];
	}
	ctxStore.set(next);

	const columns = Array.from(new Set(cats.map((c) => dbColumnFor(c)).filter(Boolean)));
	log('dnd: moved, saving', columns.join(', '));
	ctxSave?.(columns);
}

/** Which half of the row the pointer is on — drives the insertion line. */
export function edgeFromEvent(e: DragEvent, el: HTMLElement): 'before' | 'after' {
	const rect = el.getBoundingClientRect();
	return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
}
