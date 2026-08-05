<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetDetailsDisplay ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { registerDndContext } from '$lib/utils/budgetDnd';
	import BudgetExpenseCategory from './BudgetExpenseCategory.svelte';
	import BudgetSimpleCategory from './BudgetSimpleCategory.svelte';

	export let budgetStore: Writable<any>;
	export let presetRefreshTrigger = 0;

	const dispatch = createEventDispatcher();

	function handleUpdate() {
		if (!$budgetStore) return;
		$budgetStore = $budgetStore;
	}

	function createSaveHandler(
		dbColumnKey: 'expenses_artist_fee' | 'expenses_technical' | 'expenses_hospitality' | 'expenses_other'
	) {
		// The sync engine reads the store itself — we only tell it which column changed.
		return () => {
			if (!$budgetStore) return;
			dispatch('save', { key: dbColumnKey });
		};
	}

	// Drag & drop needs to move lines between components, so it works directly on
	// the store. Registered ONCE on mount (a `$:` here re-registered on every
	// store change because the closure references the store) and torn down on exit.
	onMount(() =>
		registerDndContext(budgetStore, (columns) => {
			budgetStore.update((s) => (s ? { ...s } : s));
			for (const key of columns) dispatch('save', { key });
		})
	);

	$: budgetType = $budgetStore?.budget_type || 'Tour Prod';
	$: showArtistFee = budgetType === 'Complete Prod';
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
			<div class="bg-gray1 rounded-lg p-3">
				<h3 class="text-white font-bold text-base mb-2 pb-2 border-b border-gray2/20">
					Expenses (-)
				</h3>
				<div class="space-y-3">
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
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_technical')}
					/>
					<BudgetExpenseCategory
						title="Hospitality"
						categoryKey="hospitality"
						storeKey="hospitality"
						bind:subsections={$budgetStore.hospitality}
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_hospitality')}
					/>
					<BudgetExpenseCategory
						title="Other Expenses"
						categoryKey="other"
						storeKey="other_expenses"
						bind:subsections={$budgetStore.other_expenses}
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_other')}
					/>
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
