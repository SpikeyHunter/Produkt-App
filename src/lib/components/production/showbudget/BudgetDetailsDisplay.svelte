<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetDetailsDisplay ui-v6 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { registerDndContext } from '$lib/utils/budgetDnd';
	import BudgetExpenseCategory from './BudgetExpenseCategory.svelte';
	import BudgetSimpleCategory from './BudgetSimpleCategory.svelte';
	import {
		computeAllocation,
		categoryFromBuiltIn,
		BUILT_IN_CATEGORIES,
		formatMoney,
		totalExpensesOf
	} from '$lib/utils/budgetUtils';
	import {
		syncCategoryOrder,
		createSectionForCategory,
		releaseCategory
	} from '$lib/utils/budgetPairing';
	import type { ExpenseCategory } from '$lib/types/budget';

	export let budgetStore: Writable<any>;
	export let presetRefreshTrigger = 0;
	/** DB columns the table is missing — the new features can't save without them */
	export let missingColumns: string[] = [];

	const dispatch = createEventDispatcher();

	function handleUpdate() {
		if (!$budgetStore) return;
		$budgetStore = $budgetStore;
	}

	function save(key: string) {
		if (!$budgetStore) return;
		dispatch('save', { key });
	}

	function createSaveHandler(dbColumnKey: string) {
		// The sync engine reads the store itself — we only tell it which column changed.
		return () => save(dbColumnKey);
	}

	// Drag & drop needs to move lines between components, so it works directly on
	// the store. Registered ONCE on mount (a `$:` here re-registered on every
	// store change because the closure references the store) and torn down on exit.
	onMount(() =>
		registerDndContext(budgetStore, (columns) => {
			const keys = [...columns];
			// Income sections were reordered: their expense categories follow.
			if (keys.includes('income_sections')) {
				for (const key of syncCategoryOrder($budgetStore)) {
					if (!keys.includes(key)) keys.push(key);
				}
			}
			budgetStore.update((s) => (s ? { ...s } : s));
			for (const key of keys) dispatch('save', { key });
		})
	);

	/* ------------------------------- custom categories ------------------------------- */

	let newCatName = '';

	function setCategories(next: ExpenseCategory[], keys: string[] = []) {
		$budgetStore.custom_expenses = next;
		handleUpdate();
		for (const key of new Set(['custom_expenses', ...keys])) save(key);
	}

	/** Every category gets its budget section, so both columns always match. */
	function addCategoryObject(cat: ExpenseCategory) {
		const next = [...customCats, cat];
		$budgetStore.custom_expenses = next;
		const keys = createSectionForCategory($budgetStore, cat);
		setCategories($budgetStore.custom_expenses, keys);
	}

	function addCategory(name = newCatName) {
		const clean = (name || '').trim();
		if (!clean) return;
		addCategoryObject({ id: crypto.randomUUID(), name: clean, hidden: false, subsections: [] });
		newCatName = '';
	}

	/** Pull in one of the standard categories — with whatever it already holds. */
	function addBuiltInCategory(key: string, label: string) {
		addCategoryObject(categoryFromBuiltIn($budgetStore, key, label));
	}

	function deleteCategory(id: string) {
		const cat = customCats.find((c) => c.id === id);
		const keys = cat ? releaseCategory($budgetStore, cat) : [];
		setCategories(
			($budgetStore.custom_expenses || []).filter((c: ExpenseCategory) => c.id !== id),
			keys
		);
	}

	$: budgetType = $budgetStore?.budget_type || 'Tour Prod';
	$: isCustom = budgetType === 'Custom';
	$: showArtistFee = budgetType === 'Complete Prod';
	$: customCats = ($budgetStore?.custom_expenses || []) as ExpenseCategory[];
	$: usedBuiltIns = new Set(customCats.map((c) => (c.name || '').trim().toLowerCase()));

	// Allocation badges are a Custom-budget feature; the standard types are
	// left exactly as they were.
	$: report = isCustom && $budgetStore ? computeAllocation($budgetStore) : null;
	$: catAlloc = new Map(
		(report?.rows || [])
			.filter((r) => r.kind === 'cat')
			.map((r) => [r.target.slice(4), { allocated: r.allocated, spent: r.spent }])
	);
	$: secAlloc = new Map(
		(report?.rows || [])
			.filter((r) => r.kind === 'sec')
			.map((r) => [r.target.slice(4), { allocated: r.allocated, spent: r.spent }])
	);
	$: totalExpenses = $budgetStore ? totalExpensesOf($budgetStore) : 0;
</script>

<div class="h-full flex flex-col bg-navbar border border-white/[0.07] rounded-xl overflow-hidden budget-details-container">
	{#if !$budgetStore}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg class="w-16 h-16 text-gray2 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />
				</svg>
				<h3 class="text-white text-lg font-bold mb-2">No Event Selected</h3>
				<p class="text-gray2 text-sm">Select an event from the list to view its budget</p>
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto p-3 custom-scroll space-y-3">
			<!-- Only Custom budgets write these columns, so only they can be blocked. -->
			{#if isCustom && missingColumns.length > 0}
				<div class="bg-problem/15 border border-problem/40 rounded-lg p-3 text-xs">
					<p class="text-problem font-bold mb-1">Database update needed</p>
					<p class="text-gray3">
						A Custom budget stores its sections in <code>{missingColumns.join(', ')}</code>, which
						<code>show_budget</code> doesn't have yet — edits here can't be saved. Run this once in
						the Supabase SQL editor (the other budget types are unaffected):
					</p>
					<pre class="mt-2 p-2 bg-black/40 rounded text-gray3 overflow-x-auto">alter table public.show_budget
  add column if not exists income_sections jsonb,
  add column if not exists custom_expenses jsonb;</pre>
				</div>
			{/if}

			<div class="bg-gray1 rounded-lg p-3">
				<div class="flex items-baseline justify-between gap-2 mb-2 pb-2 border-b border-gray2/20">
					<h3 class="text-white font-bold text-base">Expenses (-)</h3>
					<span class="text-problem font-bold text-base">{formatMoney(totalExpenses)}</span>
				</div>

				<div class="space-y-3">
					{#if isCustom}
						{#each customCats as cat, ci (cat.id)}
							<BudgetExpenseCategory
								bind:title={$budgetStore.custom_expenses[ci].name}
								bind:hidden={$budgetStore.custom_expenses[ci].hidden}
								bind:subsections={$budgetStore.custom_expenses[ci].subsections}
								categoryKey="other"
								storeKey={`custom:${cat.id}`}
								editable
								owned={!!cat.ownedBy}
								allocation={catAlloc.get(`custom:${cat.id}`) || null}
								sectionAllocations={secAlloc}
								{presetRefreshTrigger}
								on:update={handleUpdate}
								on:save={createSaveHandler('custom_expenses')}
								on:deleteCategory={() => deleteCategory(cat.id)}
							/>
						{/each}

						<div class="pt-3 border-t border-gray1">
							<div class="flex gap-2">
								<input
									type="text"
									bind:value={newCatName}
									placeholder="New expense category name"
									on:keydown={(e) => e.key === 'Enter' && addCategory()}
									class="flex-1 bg-black/15 text-white rounded-2xl px-3 py-1 text-sm placeholder-gray3"
								/>
								<button
									type="button"
									on:click={() => addCategory()}
									disabled={newCatName.trim() === ''}
									class="px-3 py-1 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer disabled:opacity-50"
								>
									+ Add Category
								</button>
							</div>
							<div class="flex items-center gap-1.5 mt-2 flex-wrap">
								<span class="text-gray2 text-[10px] uppercase tracking-wider">Standard</span>
								{#each BUILT_IN_CATEGORIES as std}
									<button
										type="button"
										on:click={() => addBuiltInCategory(std.key, std.label)}
										disabled={usedBuiltIns.has(std.label.toLowerCase())}
										class="px-2 py-0.5 rounded-2xl border border-gray2/30 text-gray2 hover:text-black hover:bg-lime hover:border-lime text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray2"
										title={`Add ${std.label} — brings over whatever that section already contains`}
									>
										+ {std.label}
									</button>
								{/each}
							</div>
							{#if customCats.length === 0}
								<p class="text-gray2 text-xs mt-2">
									A custom budget starts empty: add the standard sections you need, or build
									your own from scratch.
								</p>
							{/if}
						</div>
					{:else}
						{#if showArtistFee}
							<BudgetSimpleCategory
								title="Artist Fee"
								categoryKey="artist_fee"
								storeKey="artist_fee"
								bind:items={$budgetStore.artist_fee}
								{presetRefreshTrigger}
								on:update={handleUpdate}
								on:save={createSaveHandler('expenses_artist_fee')}
							/>
						{/if}

						<BudgetExpenseCategory
							title="Technical"
							categoryKey="technical"
							storeKey="technical"
							bind:subsections={$budgetStore.technical}
							allocation={catAlloc.get('technical') || null}
							sectionAllocations={secAlloc}
							{presetRefreshTrigger}
							on:update={handleUpdate}
							on:save={createSaveHandler('expenses_technical')}
						/>
						<BudgetExpenseCategory
							title="Hospitality"
							categoryKey="hospitality"
							storeKey="hospitality"
							bind:subsections={$budgetStore.hospitality}
							allocation={catAlloc.get('hospitality') || null}
							sectionAllocations={secAlloc}
							{presetRefreshTrigger}
							on:update={handleUpdate}
							on:save={createSaveHandler('expenses_hospitality')}
						/>
						<BudgetExpenseCategory
							title="Other Expenses"
							categoryKey="other"
							storeKey="other_expenses"
							bind:subsections={$budgetStore.other_expenses}
							allocation={catAlloc.get('other_expenses') || null}
							sectionAllocations={secAlloc}
							{presetRefreshTrigger}
							on:update={handleUpdate}
							on:save={createSaveHandler('expenses_other')}
						/>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
	.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
	.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
</style>
