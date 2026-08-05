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
import { mergeColumn } from '$lib/utils/budgetMerge';

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

// Minimal, greppable logs: filter the console on "[budget]".
// SYNC_VERSION prints at startup — if you don't see it, the old file is still
// being served (hard-refresh / restart dev server).
export const SYNC_VERSION = 'sync-v5';
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('[budget]', ...args);

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

function countSubs(subs: any[]): string {
	const s = subs || [];
	let items = 0;
	let kids = 0;
	for (const sec of s) {
		for (const it of sec.items || []) {
			items++;
			kids += it.children?.length || 0;
		}
	}
	return `${s.length} sections / ${items} items / ${kids} sub-items`;
}

export function createBudgetSync() {
	log('engine created —', SYNC_VERSION);
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

	// Recently-sent values per DB column (for echo suppression). A ring, not a
	// single value: two quick saves produce two echoes, and the older echo must
	// still be recognized as ours — applying it would briefly "delete" the
	// newest rows and the newer echo (suppressed) would never restore them.
	const lastSent: Record<string, string[]> = {};
	function rememberSent(dbCol: string, sig: string) {
		const ring = (lastSent[dbCol] ||= []);
		ring.push(sig);
		if (ring.length > 8) ring.shift();
	}
	function wasSentByUs(dbCol: string, sig: string): boolean {
		return (lastSent[dbCol] || []).includes(sig);
	}

	// Last known SERVER value per store key — the common ancestor used to merge
	// our edits with anyone else's instead of overwriting their work.
	let baseline: Record<string, any> = {};
	function setBaseline(state: any) {
		baseline = {};
		for (const k of Object.keys(STORE_TO_DB)) baseline[k] = clone(state?.[k]);
	}
	const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

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
			.subscribe((status) => log('realtime channel:', status));
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

			// 1) Echo of one of our own recent saves -> ignore
			if (wasSentByUs(dbCol, incomingStr)) {
				log('realtime: echo ignored for', storeKey);
				continue;
			}

			// 2) Unsaved local edits on this column: merge rather than pick a
			//    winner, so their new lines appear without dropping ours.
			if (dirty.has(storeKey)) {
				log('realtime: merging remote change into dirty column', storeKey);
				const merged = mergeColumn(storeKey, baseline[storeKey], state[storeKey], incoming);
				baseline[storeKey] = clone(incoming); // server truth moves forward
				if (stableStringify(state[storeKey]) !== stableStringify(merged)) {
					state[storeKey] = merged;
					changed = true;
				}
				continue;
			}

			// 3) Same as what we already have -> nothing to do
			baseline[storeKey] = clone(incoming);
			if (stableStringify(state[storeKey]) === incomingStr) continue;

			log('realtime: applied remote change to', storeKey);
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
		if (dirty.size === 0) {
			log('markDirty: called with unknown key(s)', arr, '— nothing queued');
			return;
		}
		log('markDirty:', arr.join(', '), '→ pending:', Array.from(dirty).join(', '));
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
			saveTimer = setTimeout(() => flush(), SAVE_DEBOUNCE_MS);
			return true;
		}

		saveInFlight = true;
		savingState.set('saving');
		const t0 = Date.now();

		// --- 1. Read current server state FIRST (all columns — it's one row).
		// Everything after this read is synchronous until the write, so edits
		// made during the read are naturally included instead of clobbered.
		let fresh: any = null;
		try {
			const { data, error: readErr } = await supabase
				.from('show_budget')
				.select(
					`id, budget_type, income_total_budget, income_artist, income_technical,
					 income_hospitality, income_other, expenses_artist_fee, expenses_technical,
					 expenses_hospitality, expenses_other`
				)
				.eq('id', budgetId)
				.single();
			if (readErr) log('pre-save read failed (writing local state):', readErr.message);
			else fresh = data;
		} catch (err) {
			log('pre-save read threw (writing local state):', err);
		}

		// --- 2. NOW capture local state + dirty keys (post-await, so nothing
		// typed or added during the read can be missed or overwritten).
		const state = get(store);
		if (!state) {
			saveInFlight = false;
			return true;
		}
		const keys = Array.from(dirty);
		dirty = new Set();
		if (keys.length === 0) {
			saveInFlight = false;
			return true;
		}

		// --- 3. Merge our columns into the server's current state.
		const payload: Record<string, any> = {};
		for (const storeKey of keys) {
			const dbCol = STORE_TO_DB[storeKey];
			// Normalize the local value first: what we compare, write, and keep as
			// baseline must be byte-identical to what the DB echoes back, otherwise
			// every save falsely looks like a concurrent remote change.
			let value = normalizeStoreValue(
				storeKey,
				state[storeKey] ?? (JSON_KEYS.has(storeKey) ? [] : null)
			);
			if (fresh) {
				const remote = normalizeStoreValue(storeKey, fresh[dbCol]);
				const mergedVal = mergeColumn(storeKey, baseline[storeKey], value, remote);
				if (stableStringify(mergedVal) !== stableStringify(value)) {
					log('flush: merged remote changes into', storeKey);
					value = mergedVal;
					// reflect the combined result in the UI (synchronous — no race)
					state[storeKey] = mergedVal;
					store.set({ ...state });
				}
			}
			payload[dbCol] = value;
			rememberSent(dbCol, stableStringify(normalizeStoreValue(storeKey, value)));
		}
		for (const storeKey of keys) {
			if (!JSON_KEYS.has(storeKey)) continue;
			const v = payload[STORE_TO_DB[storeKey]];
			log(
				'flush payload —',
				storeKey + ':',
				SIMPLE_JSON_KEYS.has(storeKey) ? `${(v || []).length} items` : countSubs(v)
			);
		}
		log('flush: saving', keys.join(', '));

		// --- 4. Write, with retries.
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
				log(`save failed (attempt ${attempt + 1}/3):`, error.message);
				await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
			}
		}

		saveInFlight = false;

		if (!ok) {
			// put keys back and keep retrying on a timer (don't wait for the next edit)
			keys.forEach((k) => dirty.add(k));
			savingState.set('error');
			if (saveTimer) clearTimeout(saveTimer);
			saveTimer = setTimeout(() => flush(), 5000);
			return false;
		}

		// The server now holds exactly what we wrote -> that's the new ancestor.
		for (const storeKey of keys) {
			baseline[storeKey] = clone(payload[STORE_TO_DB[storeKey]]);
		}
		log('flush: saved in', Date.now() - t0, 'ms');

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
		log('undo -> step', hIndex + 1, 'of', history.length);
		restoreSnapshot(history[hIndex]);
		updateUndoFlags();
	}

	function redo() {
		if (!get(store)) return;
		if (hIndex < 0 || hIndex >= history.length - 1) return;
		hIndex++;
		log('redo -> step', hIndex + 1, 'of', history.length);
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
		log('loading budget', id, '…');
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

		const loaded = rowToState(data);
		log(
			'load counts — technical:',
			countSubs(loaded.technical),
			'| hospitality:',
			countSubs(loaded.hospitality),
			'| other:',
			countSubs(loaded.other_expenses),
			'| artist_fee:',
			(loaded.artist_fee || []).length,
			'items'
		);
		store.set(loaded);
		setBaseline(loaded);
		pushHistory();
		subscribe(id);
		log('loaded budget', id, `(${data.event_name || 'unnamed'})`);
		return true;
	}

	async function clear() {
		log('clear');
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
		log('destroy');
		flush();
		unsubscribe();
	}

	return { store, savingState, canUndo, canRedo, load, clear, markDirty, flush, undo, redo, destroy };
}

export type BudgetSync = ReturnType<typeof createBudgetSync>;