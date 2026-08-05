/**
 * budgetMerge — three-way merge for budget columns.
 *
 * The budget stores each category as one jsonb column, so a naive save writes
 * the *whole* array. If two people edit the same category at the same time,
 * the last writer wins and the other person's lines silently disappear.
 *
 * Every line and section carries a stable uuid, so instead of overwriting we
 * merge by id against a common ancestor:
 *
 *   base   = what the server had when we started editing
 *   local  = what we have now
 *   remote = what the server has now (someone else may have changed it)
 *
 * Rule per field: if we changed it, ours wins; otherwise theirs does.
 * Rule per line: added stays added, deleted stays deleted, and a line edited
 * by us survives even if the other side deleted it (better to keep data than
 * to lose it silently).
 */
import type { BudgetItem, BudgetSubsection } from '$lib/types/budget';

/** Deterministic stringify so comparisons ignore key order. */
export function sig(value: any): string {
	if (value === null || value === undefined) return 'null';
	if (Array.isArray(value)) return '[' + value.map(sig).join(',') + ']';
	if (typeof value === 'object') {
		return (
			'{' +
			Object.keys(value)
				.sort()
				.map((k) => JSON.stringify(k) + ':' + sig(value[k]))
				.join(',') +
			'}'
		);
	}
	return JSON.stringify(value);
}

const byId = <T extends { id: string }>(arr: T[] | null | undefined) => {
	const m = new Map<string, T>();
	for (const x of arr || []) if (x?.id) m.set(x.id, x);
	return m;
};

/**
 * STRUCTURE RULE (v2): the save-path merge NEVER deletes a local row.
 * Inferring "the other person deleted this" from its absence in a read-back
 * proved fragile — any staleness or representation drift silently ate rows
 * the user just added. Deletions now propagate only through the clean
 * realtime path (applyRemote on a non-dirty column applies remote wholesale).
 * Worst case a concurrently-deleted row is resurrected by our save, which is
 * recoverable; a silently deleted row is not.
 */

/** Field-level pick: we changed it -> ours; we didn't -> theirs. */
function pick<T>(base: T, local: T, remote: T): T {
	return sig(local) !== sig(base) ? local : remote;
}

function mergeItem(base: BudgetItem | undefined, local: BudgetItem, remote: BudgetItem): BudgetItem {
	// No common ancestor means we can't tell who changed what — keep ours.
	if (!base) return local;
	return {
		...local,
		name: pick(base.name, local.name, remote.name),
		price: pick(base.price, local.price, remote.price),
		actual: pick(base.actual, local.actual, remote.actual),
		quantity: pick(base.quantity, local.quantity, remote.quantity),
		unit: pick(base.unit, local.unit, remote.unit),
		hidden: pick(base.hidden, local.hidden, remote.hidden),
		flagged: pick(base.flagged, local.flagged, remote.flagged),
		collapsed: local.collapsed, // display-only, always ours
		children: mergeItems(base.children, local.children, remote.children)
	};
}

export function mergeItems(
	base: BudgetItem[] | null | undefined,
	local: BudgetItem[] | null | undefined,
	remote: BudgetItem[] | null | undefined
): BudgetItem[] {
	const L = local || [];
	const R = remote || [];
	const baseMap = byId(base);
	const localMap = byId(L);
	const remoteMap = byId(R);

	const out: BudgetItem[] = [];
	for (const l of L) {
		const b = baseMap.get(l.id);
		const r = remoteMap.get(l.id);
		// Local rows always survive; merge fields when remote also has the row.
		out.push(r ? mergeItem(b, l, r) : l);
	}

	// Lines the other side added while we were editing (we've never seen them).
	R.forEach((r, idx) => {
		if (localMap.has(r.id) || baseMap.has(r.id)) return;
		out.splice(Math.min(idx, out.length), 0, r);
	});

	return out;
}

function mergeSection(
	base: BudgetSubsection | undefined,
	local: BudgetSubsection,
	remote: BudgetSubsection
): BudgetSubsection {
	if (!base) return local;
	return {
		...local,
		name: pick(base.name, local.name, remote.name),
		hidden: pick(base.hidden, local.hidden, remote.hidden),
		items: mergeItems(base.items, local.items, remote.items)
	};
}

export function mergeSections(
	base: BudgetSubsection[] | null | undefined,
	local: BudgetSubsection[] | null | undefined,
	remote: BudgetSubsection[] | null | undefined
): BudgetSubsection[] {
	const L = local || [];
	const R = remote || [];
	const baseMap = byId(base);
	const localMap = byId(L);
	const remoteMap = byId(R);

	const out: BudgetSubsection[] = [];
	for (const l of L) {
		const b = baseMap.get(l.id);
		const r = remoteMap.get(l.id);
		out.push(r ? mergeSection(b, l, r) : l);
	}

	R.forEach((r, idx) => {
		if (localMap.has(r.id) || baseMap.has(r.id)) return;
		out.splice(Math.min(idx, out.length), 0, r);
	});

	return out;
}

/** Merge one store column. Scalars fall back to the same "ours if changed" rule. */
export function mergeColumn(storeKey: string, base: any, local: any, remote: any): any {
	if (storeKey === 'artist_fee') return mergeItems(base, local, remote);
	if (storeKey === 'technical' || storeKey === 'hospitality' || storeKey === 'other_expenses') {
		return mergeSections(base, local, remote);
	}
	return pick(base, local, remote);
}
