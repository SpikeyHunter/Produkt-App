<!--
  MODIFIED:
  - Added 'calculateSimpleCategoryTotal' for the new Artist Fee structure.
  - Updated 'totalArtistFee' to use the simple calculator.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
	import BudgetIncomeSection from './BudgetIncomeSection.svelte';
	import BudgetTotals from './BudgetTotals.svelte';
	import PresetManager from './PresetManager.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let selectedEvent: any = null;
	export let budgetStore: Writable<any>;
	export let isExporting = false;

	const dispatch = createEventDispatcher();

	let savingState: 'idle' | 'saving' | 'saved' = 'idle';
	let saveTimeout: any;
	let isPresetModalOpen = false;

	function handleExport() {
		if (!selectedEvent) return;
		dispatch('export', { event: selectedEvent });
	}

	function handleSave(key: 'budget_production' | 'budget_other') {
		if (!$budgetStore) return;
		showSaving();
		const storeKey = key.replace('budget_', '');
		dispatch('save', { key, data: $budgetStore[storeKey] });
	}

	function handleIncomeUpdate() {
		if (!$budgetStore) return;
		$budgetStore = $budgetStore;
	}

	function showSaving() {
		savingState = 'saving';
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			savingState = 'saved';
			setTimeout(() => (savingState = 'idle'), 1500);
		}, 1000);
	}

	// Calculator for Subsections (Technical, Hospitality, etc.)
	function calculateCategoryTotal(subsections: any[]): number {
		if (!subsections || subsections.length === 0) return 0;
		return subsections.reduce((acc, subsection) => {
			if (!subsection.items || subsection.items.length === 0) return acc;
			const subsectionTotal = subsection.items.reduce((itemAcc: number, item: any) => {
				const price = Number(item.price) || 0;
				const quantity = Number(item.quantity) || 1;
				return itemAcc + price * quantity;
			}, 0);
			return acc + subsectionTotal;
		}, 0);
	}

	// NEW: Calculator for Simple Item List (Artist Fee)
	function calculateSimpleCategoryTotal(items: any[]): number {
		if (!items || items.length === 0) return 0;
		return items.reduce((acc, item) => {
			const price = Number(item.price) || 0;
			const quantity = Number(item.quantity) || 1;
			return acc + price * quantity;
		}, 0);
	}

	$: totalIncome = ($budgetStore?.production?.amount || 0) + ($budgetStore?.other?.amount || 0);

	// Artist Fee now uses the Simple calculator
	$: totalArtistFee = calculateSimpleCategoryTotal($budgetStore?.artist_fee);
	
	// Others use the Subsection calculator
	$: totalTechnical = calculateCategoryTotal($budgetStore?.technical);
	$: totalHospitality = calculateCategoryTotal($budgetStore?.hospitality);
	$: totalOtherExpenses = calculateCategoryTotal($budgetStore?.other_expenses);

	$: totalExpenses =
		totalArtistFee + totalTechnical + totalHospitality + totalOtherExpenses;

	$: netTotal = totalIncome - totalExpenses;
</script>

<div
	class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden export-details-container"
>
	{#if !selectedEvent}
		<div class="flex-1 flex flex-col items-center justify-center h-full text-center p-4">
			<svg
				class="w-12 h-12 text-gray2 mb-3"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
				<polyline points="14 2 14 8 20 8"></polyline>
				<line x1="12" y1="18" x2="12" y2="12"></line>
				<line x1="9" y1="15" x2="15" y2="15"></line>
			</svg>
			<p class="text-gray2 text-xs">Select an event to view its summary</p>
		</div>
	{:else}
		<div class="p-4 border-b border-gray1 flex-shrink-0">
			<div class="flex justify-between items-center mb-2">
				<h2 class="text-white text-xl font-bold truncate" title={selectedEvent.event_name}>
					{selectedEvent.event_name}
				</h2>
				<span
					class="text-xs transition-all flex-shrink-0 ml-2 {savingState === 'saved'
						? 'text-lime'
						: savingState === 'saving'
							? 'text-gray2'
							: 'text-transparent'}"
				>
					{savingState === 'saving' ? 'Saving...' : 'Saved!'}
				</span>
			</div>
			<button
				type="button"
				on:click={() => (isPresetModalOpen = true)}
				class="w-full px-3 py-1.5 bg-gray1 text-lime text-xs font-bold rounded hover:bg-gray2/20 cursor-pointer"
			>
				Manage Presets
			</button>
		</div>

		<div class="flex-1 flex flex-col justify-between overflow-y-auto custom-scroll p-4">
			<div class="space-y-4">
				<!-- (+) BUDGET / INCOME -->
				<div class="bg-gray1 rounded-lg p-4">
					<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">
						Budget / Income (+)
					</h3>
					<div class="grid grid-cols-1 gap-4">
						{#if $budgetStore}
							<BudgetIncomeSection
								bind:data={$budgetStore.production}
								on:update={handleIncomeUpdate}
								on:save={() => handleSave('budget_production')}
							/>
							<BudgetIncomeSection
								bind:data={$budgetStore.other}
								on:update={handleIncomeUpdate}
								on:save={() => handleSave('budget_other')}
							/>
						{/if}
					</div>
				</div>

				<!-- NET TOTALS -->
				<div class="bg-gray1 rounded-lg p-4">
					<BudgetTotals
						{totalIncome}
						{totalExpenses}
						{netTotal}
						{formatMoney}
					/>
				</div>
			</div>

			<!-- Export Button -->
			<div class="mt-4">
				<button
					type="button"
					on:click={handleExport}
					disabled={isExporting}
					class="w-full bg-lime text-black font-bold text-sm py-3 rounded-lg hover:bg-lime/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{#if isExporting}
						<span class="flex items-center justify-center gap-2">
							<div
								class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"
							></div>
							Exporting...
						</span>
					{:else}
						Export as PDF
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Preset Manager Modal -->
<div use:portal>
	<PresetManager bind:isOpen={isPresetModalOpen} on:close={() => (isPresetModalOpen = false)} />
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>