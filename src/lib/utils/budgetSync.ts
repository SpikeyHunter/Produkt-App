// budgetSync.ts
// Single source of truth for the Show Budget page:
//  - loads a show_budget row into a store
//  - debounced, retried saves (real "Saving / Saved / Error" state)
//  - Supabase Realtime: other windows/users see changes instantly
//  - echo suppression so your own saves don't bounce back into your UI
//  - full undo / redo history (Cmd+Z / Shift+Cmd+Z)
//
// REQUIRED (once, in Supabase SQL editor) if not already enabled:
//   alter publication supabase_realtime add table show_budget;

import { writable, get, type Writable } from 'svelte/store';
import { supabase } from '$lib/supabase.js';
import { normalizeItems, normalizeSubsections } from '$lib/utils/budgetUtils';

export type SavingState = 'idle' | 'saving' | 'saved' | 'error';

// store key -> db column
const STORE_TO_DB: Record<string, string> = {
	artist_fee: 'expenses_artist_fee',
	technical: 'expenses_technical',
	hospitality: 'expenses_hospitality',
	other_expenses: 'expenses_other',
	income_artist: 'income_artist',
	income_technical: 'income_technical',
	income_hospitality: 'income_hospitality',
	income_other: 'income_other',
	income_total_budget: 'income_total_budget',
	budget_type: 'budget_type'
};
const DB_TO_STORE: Record<string, string> = Object.fromEntries(
	Object.entries(STORE_TO_DB).map(([k, v]) => [v, k])
);
const JSON_KEYS = new Set(['artist_fee', 'technical', 'hospitality', 'other_expenses']);
const SIMPLE_JSON_KEYS = new Set(['artist_fee']); // flat item lists (no subsections)

const SAVE_DEBOUNCE_MS = 500;
const MAX_HISTORY = 100;

/** Deterministic stringify (sorted keys) so echo comparison is order-independent. */
function stableStringify(value: any): string {
	if (value === null || value === undefined) return 'null';
	if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
	if (typeof value === 'object') {
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k]))
				.join(',') +
			'}'
		);
	}
	return JSON.stringify(value);
}

function normalizeStoreValue(key: string, value: any): any {
	if (JSON_KEYS.has(key)) {
		const parsed = typeof value === 'string' ? safeParse(value) : value;
		return SIMPLE_JSON_KEYS.has(key) ? normalizeItems(parsed) : normalizeSubsections(parsed);
	}
	if (key === 'budget_type') return value || 'Tour Prod';
	// numeric income columns (realtime delivers numerics as strings)
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	return isNaN(n) ? null : n;
}

function safeParse(input: any) {
	try {
		return JSON.parse(input);
	} catch {
		return [];
	}
}

export function createBudgetSync() {
	const store: Writable<any> = writable(null);
	const savingState: Writable<SavingState> = writable('idle');
	const canUndo = writable(false);
	const canRedo = writable(false);

	let budgetId: number | null = null;
	let channel: ReturnType<typeof supabase.channel> | null = null;

	let dirty = new Set<string>(); // store keys with unsaved local changes
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveInFlight = false;
	let savedFlashTimer: ReturnType<typeof setTimeout> | null = null;

	// Last value we sent per DB column (for echo suppression)
	const lastSent: Record<string, string> = {};

	// Undo history: snapshots of the whole budget object
	let history: string[] = [];
	let hIndex = -1;

	function snapshotOf(state: any): string {
		return JSON.stringify(state);
	}

	function updateUndoFlags() {
		canUndo.set(hIndex > 0);
		canRedo.set(hIndex >= 0 && hIndex < history.length - 1);
	}

	function pushHistory() {
		const state = get(store);
		if (!state) return;
		const snap = snapshotOf(state);
		if (hIndex >= 0 && history[hIndex] === snap) return; // no change
		history = history.slice(0, hIndex + 1);
		history.push(snap);
		if (history.length > MAX_HISTORY) history.shift();
		hIndex = history.length - 1;
		updateUndoFlags();
	}

	function rowToState(data: any) {
		return {
			budget_type: data.budget_type || 'Tour Prod',
			// numerics normalized (supabase can return numeric columns as strings)
			income_total_budget: normalizeStoreValue('income_total_budget', data.income_total_budget),
			income_artist: normalizeStoreValue('income_artist', data.income_artist),
			income_technical: normalizeStoreValue('income_technical', data.income_technical),
			income_hospitality: normalizeStoreValue('income_hospitality', data.income_hospitality),
			income_other: normalizeStoreValue('income_other', data.income_other),
			artist_fee: normalizeItems(
				typeof data.expenses_artist_fee === 'string'
					? safeParse(data.expenses_artist_fee)
					: data.expenses_artist_fee
			),
			technical: normalizeSubsections(
				typeof data.expenses_technical === 'string'
					? safeParse(data.expenses_technical)
					: data.expenses_technical
			),
			hospitality: normalizeSubsections(
				typeof data.expenses_hospitality === 'string'
					? safeParse(data.expenses_hospitality)
					: data.expenses_hospitality
			),
			other_expenses: normalizeSubsections(
				typeof data.expenses_other === 'string' ? safeParse(data.expenses_other) : data.expenses_other
			)
		};
	}

	/* ------------------------------ Realtime ------------------------------ */

	function subscribe(id: number) {
		unsubscribe();
		channel = supabase
			.channel(`show_budget_row_${id}`)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'show_budget', filter: `id=eq.${id}` },
				(payload) => applyRemote(payload.new)
			)
			.subscribe();
	}

	function unsubscribe() {
		if (channel) {
			supabase.removeChannel(channel);
			channel = null;
		}
	}

	function applyRemote(row: any) {
		const state = get(store);
		if (!state || !row) return;

		let changed = false;
		for (const dbCol of Object.keys(row)) {
			const storeKey = DB_TO_STORE[dbCol];
			if (!storeKey) continue;

			const incoming = normalizeStoreValue(storeKey, row[dbCol]);
			const incomingStr = stableStringify(incoming);

			// 1) Echo of our own save -> ignore
			if (lastSent[dbCol] === incomingStr) continue;
			// 2) We have unsaved local edits on this column -> local wins (our flush overwrites)
			if (dirty.has(storeKey)) continue;
			// 3) Same as what we already have -> nothing to do
			if (stableStringify(state[storeKey]) === incomingStr) continue;

			state[storeKey] = incoming;
			changed = true;
		}

		if (changed) {
			store.set({ ...state });
			pushHistory();
		}
	}

	/* ------------------------------ Saving ------------------------------ */

	function markDirty(keys: string | string[]) {
		const arr = Array.isArray(keys) ? keys : [keys];
		for (const k of arr) {
			// accept either store keys or db column names
			const storeKey = DB_TO_STORE[k] || (STORE_TO_DB[k] ? k : null);
			if (storeKey) dirty.add(storeKey);
		}
		if (dirty.size === 0) return;
		savingState.set('saving');
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => flush(), SAVE_DEBOUNCE_MS);
	}

	async function flush(): Promise<boolean> {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (!budgetId || dirty.size === 0) return true;
		if (saveInFlight) {
			// a save is running; re-queue after it finishes
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => flush(), SAVE_DEBOUNCE_MS);
			return true;
		}

		const state = get(store);
		if (!state) return true;

		const keys = Array.from(dirty);
		dirty = new Set();

		const payload: Record<string, any> = {};
		for (const storeKey of keys) {
			const dbCol = STORE_TO_DB[storeKey];
			const value = state[storeKey] ?? (JSON_KEYS.has(storeKey) ? [] : null);
			payload[dbCol] = value;
			lastSent[dbCol] = stableStringify(normalizeStoreValue(storeKey, value));
		}

		saveInFlight = true;
		savingState.set('saving');

		let ok = false;
		for (let attempt = 0; attempt < 3 && !ok; attempt++) {
			const { error } = await supabase
				.from('show_budget')
				.update(payload)
				.eq('id', budgetId)
				.select('id')
				.single();
			if (!error) {
				ok = true;
			} else {
				console.error(`Budget save failed (attempt ${attempt + 1}):`, error);
				await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
			}
		}

		saveInFlight = false;

		if (!ok) {
			// put keys back so a retry can pick them up
			keys.forEach((k) => dirty.add(k));
			savingState.set('error');
			return false;
		}

		pushHistory();

		if (dirty.size > 0) {
			// edits happened while saving
			saveTimer = setTimeout(() => flush(), SAVE_DEBOUNCE_MS);
		} else {
			savingState.set('saved');
			if (savedFlashTimer) clearTimeout(savedFlashTimer);
			savedFlashTimer = setTimeout(() => {
				if (get(savingState) === 'saved') savingState.set('idle');
			}, 1500);
		}
		return true;
	}

	/* ------------------------------ Undo / Redo ------------------------------ */

	function restoreSnapshot(snap: string) {
		const state = JSON.parse(snap);
		store.set(state);
		// save everything back (a snapshot can differ on any column)
		Object.keys(STORE_TO_DB).forEach((k) => dirty.add(k));
		savingState.set('saving');
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => flush(), 150);
	}

	function undo() {
		if (!get(store)) return;
		pushHistory(); // capture any un-flushed typing as the newest step
		if (hIndex <= 0) return;
		hIndex--;
		restoreSnapshot(history[hIndex]);
		updateUndoFlags();
	}

	function redo() {
		if (!get(store)) return;
		if (hIndex < 0 || hIndex >= history.length - 1) return;
		hIndex++;
		restoreSnapshot(history[hIndex]);
		updateUndoFlags();
	}

	/* ------------------------------ Lifecycle ------------------------------ */

	async function load(id: number): Promise<boolean> {
		await flush(); // don't lose pending edits from the previous budget
		unsubscribe();

		budgetId = id;
		dirty = new Set();
		history = [];
		hIndex = -1;
		Object.keys(lastSent).forEach((k) => delete lastSent[k]);
		savingState.set('idle');

		const { data, error } = await supabase
			.from('show_budget')
			.select(
				`id, event_name, event_id, budget_type, income_total_budget,
				 income_artist, income_technical, income_hospitality, income_other,
				 expenses_artist_fee, expenses_technical, expenses_hospitality, expenses_other`
			)
			.eq('id', id)
			.single();

		if (error || !data) {
			console.error('Error loading budget details:', error);
			store.set(null);
			budgetId = null;
			updateUndoFlags();
			return false;
		}

		store.set(rowToState(data));
		pushHistory();
		subscribe(id);
		return true;
	}

	async function clear() {
		await flush();
		unsubscribe();
		budgetId = null;
		store.set(null);
		history = [];
		hIndex = -1;
		updateUndoFlags();
		savingState.set('idle');
	}

	function destroy() {
		flush();
		unsubscribe();
	}

	return { store, savingState, canUndo, canRedo, load, clear, markDirty, flush, undo, redo, destroy };
}

export type BudgetSync = ReturnType<typeof createBudgetSync>;