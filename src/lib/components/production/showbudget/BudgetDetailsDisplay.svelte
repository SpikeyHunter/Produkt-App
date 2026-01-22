<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
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
		return () => {
			if (!$budgetStore) return;
			
			// Map DB Column Key -> Store Property Key
			let storeKey = '';
			if (dbColumnKey === 'expenses_artist_fee') storeKey = 'artist_fee';
			else if (dbColumnKey === 'expenses_technical') storeKey = 'technical';
			else if (dbColumnKey === 'expenses_hospitality') storeKey = 'hospitality';
			else if (dbColumnKey === 'expenses_other') storeKey = 'other_expenses';

			dispatch('save', {
				key: dbColumnKey,
				data: $budgetStore[storeKey]
			});
		};
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden budget-details-container">
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
		<div class="flex-1 overflow-y-auto p-4 custom-scroll space-y-4">
			<div class="bg-gray1 rounded-lg p-4">
				<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">
					Expenses (-)
				</h3>
				<div class="space-y-4">
					<BudgetSimpleCategory
						title="Artist Fee"
						categoryKey="artist_fee"
						bind:items={$budgetStore.artist_fee}
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_artist_fee')}
					/>

					<BudgetExpenseCategory
						title="Technical"
						categoryKey="technical"
						bind:subsections={$budgetStore.technical}
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_technical')}
					/>
					<BudgetExpenseCategory
						title="Hospitality"
						categoryKey="hospitality"
						bind:subsections={$budgetStore.hospitality}
						{presetRefreshTrigger}
						on:update={handleUpdate}
						on:save={createSaveHandler('expenses_hospitality')}
					/>
					<BudgetExpenseCategory
						title="Other Expenses"
						categoryKey="other"
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
	.custom-scroll::-webkit-scrollbar { width: 6px; }
	.custom-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
	.custom-scroll::-webkit-scrollbar-thumb { background: #e1ff00; border-radius: 3px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: #f0ff4d; }
</style>