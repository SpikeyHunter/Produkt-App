<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
	import BudgetIncomeSection from './BudgetIncomeSection.svelte';
	import BudgetTotals from './BudgetTotals.svelte';
	import PresetManager from './PresetManager.svelte';
	import BudgetPdfTemplate from './BudgetPdfTemplate.svelte';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	// We can likely remove this import if it is not used anywhere else in this file,
	// but keeping it is harmless.
	import { formatMoney } from '$lib/utils/budgetUtils';
	import { env } from '$env/dynamic/public';
	import { portal } from '$lib/utils/portalUtils';

	export let selectedEvent: any = null;
	export let budgetStore: Writable<any>;
	export let isExporting = false;

	const dispatch = createEventDispatcher();
	let savingState: 'idle' | 'saving' | 'saved' = 'idle';
	let saveTimeout: any;
	let isPresetModalOpen = false;
	let sheetContainer: HTMLDivElement;

	const budgetTypeOptions = ['Tour Prod', 'Internal Prod', 'Complete Prod'];

	function handleSave(key: string, value: any) {
		if (!$budgetStore) return;
		showSaving();
		dispatch('save', { key, data: value });
	}

	function handleBudgetTypeSelect(e: CustomEvent) {
		if (!$budgetStore) return;
		$budgetStore.budget_type = e.detail;
		handleSave('budget_type', e.detail);
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

	// Expenses Calculations
	function calculateCategoryTotal(subsections: any[]): number {
		if (!subsections || subsections.length === 0) return 0;
		return subsections.reduce((acc, subsection) => {
			if (!subsection.items || subsection.items.length === 0) return acc;
			return acc + subsection.items.reduce((itemAcc: number, item: any) => {
				const price = Number(item.price) || 0;
				const quantity = Number(item.quantity) || 1;
				return itemAcc + price * quantity;
			}, 0);
		}, 0);
	}

	function calculateSimpleCategoryTotal(items: any[]): number {
		if (!items || items.length === 0) return 0;
		return items.reduce((acc, item) => {
			const price = Number(item.price) || 0;
			const quantity = Number(item.quantity) || 1;
			return acc + price * quantity;
		}, 0);
	}

	// Variables
	$: budgetType = $budgetStore?.budget_type || 'Tour Prod';

	$: incomeTotalBudget = Number($budgetStore?.income_total_budget) || 0;
	$: incomeArtist = Number($budgetStore?.income_artist) || 0;
	$: incomeTechnical = Number($budgetStore?.income_technical) || 0;
	$: incomeHospitality = Number($budgetStore?.income_hospitality) || 0;
	$: incomeOther = Number($budgetStore?.income_other) || 0;

	// Total Budget (Income) Calculation
	$: totalIncome = (() => {
		if (budgetType === 'Internal Prod') return incomeTotalBudget;
		if (budgetType === 'Tour Prod') return incomeTechnical + incomeHospitality + incomeOther;
		// Complete Prod
		return incomeArtist + incomeTechnical + incomeHospitality + incomeOther;
	})();

	$: expenseArtist = calculateSimpleCategoryTotal($budgetStore?.artist_fee);
	$: expenseTechnical = calculateCategoryTotal($budgetStore?.technical);
	$: expenseHospitality = calculateCategoryTotal($budgetStore?.hospitality);
	$: expenseOther = calculateCategoryTotal($budgetStore?.other_expenses);

	// Total Expenses Calculation
	$: totalExpenses = (() => {
		const base = expenseTechnical + expenseHospitality + expenseOther;
		if (budgetType === 'Complete Prod') return base + expenseArtist;
		return base;
	})();

	$: netTotal = totalIncome - totalExpenses;

	// PDF Logic
	async function handleGeneratePdf() {
		if (!$budgetStore || !selectedEvent) return;
		isExporting = true;
		
		const sheetElement = sheetContainer?.querySelector('#budget-pdf-root');
		if (!sheetElement) {
			console.error('PDF Template not found');
			isExporting = false;
			return;
		}

		const htmlContent = sheetElement.outerHTML;
		const artistName = selectedEvent.event_name || 'Event';
		const eventDate = selectedEvent.event_date || new Date().toISOString().split('T')[0];
		const cleanFileName = `${eventDate} - ${artistName} - Budget.pdf`.replace(/[^\w\s.-]/g, '');

		try {
			const response = await fetch('/api/generate-advance-pdf', { 
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ htmlContent, artistName, eventDate, fileName: cleanFileName })
			});

			if (!response.ok) throw new Error('PDF Generation Failed');
			const result = await response.json();
			
			if (result.path) {
				const downloadUrl = `${env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${result.path}?download=${cleanFileName}`;
				const link = document.createElement('a');
				link.href = downloadUrl;
				link.setAttribute('download', cleanFileName); 
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		} catch (error) {
			console.error('Error generating PDF:', error);
			alert('Failed to generate PDF.');
		} finally {
			isExporting = false;
		}
	}
</script>

<div class="hidden" aria-hidden="true" bind:this={sheetContainer}>
	{#if $budgetStore && selectedEvent}
		<BudgetPdfTemplate budgetData={$budgetStore} event={selectedEvent} />
	{/if}
</div>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden export-details-container">
	{#if !selectedEvent}
		<div class="flex-1 flex flex-col items-center justify-center h-full text-center p-4">
			<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
				<polyline points="14 2 14 8 20 8"></polyline>
				<line x1="12" y1="18" x2="12" y2="12"></line>
				<line x1="9" y1="15" x2="15" y2="15"></line>
			</svg>
			<p class="text-gray2 text-xs">Select an event to view its summary</p>
		</div>
	{:else}
		{#if $budgetStore}
			<div class="p-4 border-b border-gray1 flex-shrink-0">
				<div class="flex justify-between items-center mb-4">
					<h2 class="text-white text-xl font-bold truncate">Budget Info</h2>
					<span class="text-xs transition-all flex-shrink-0 ml-2 {savingState === 'saved' ? 'text-confirmed' : savingState === 'saving' ? 'text-gray2' : 'text-transparent'}">
						{savingState === 'saving' ? 'Saving...' : 'Saved!'}
					</span>
				</div>
				
				<div class="mb-2">
					<DropdownButton
						value={$budgetStore.budget_type || 'Tour Prod'}
						options={budgetTypeOptions}
						on:select={handleBudgetTypeSelect}
						width="w-auto"
						buttonClass="bg-gray1 !text-white border border-gray2/20"
					/>
				</div>

				<button type="button" on:click={() => (isPresetModalOpen = true)} class="w-full px-3 py-1.5 bg-gray1 text-lime text-xs font-bold rounded hover:bg-gray2/20 cursor-pointer">
					Manage Presets
				</button>
			</div>

			<div class="flex-1 flex flex-col justify-between overflow-y-auto custom-scroll p-4">
				<div class="space-y-4">
					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">
							Budget / Income (+)
						</h3>
						
						<div class="grid grid-cols-1 gap-4">
							{#if budgetType === 'Internal Prod'}
								<BudgetIncomeSection
									label="Total Budget"
									bind:amount={$budgetStore.income_total_budget}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_total_budget', $budgetStore.income_total_budget)}
								/>
							{:else}
								{#if budgetType === 'Complete Prod'}
									<BudgetIncomeSection
										label="Artist Fee"
										bind:amount={$budgetStore.income_artist}
										on:update={handleIncomeUpdate}
										on:save={() => handleSave('income_artist', $budgetStore.income_artist)}
									/>
								{/if}

								<BudgetIncomeSection
									label="Technical"
									bind:amount={$budgetStore.income_technical}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_technical', $budgetStore.income_technical)}
								/>
								<BudgetIncomeSection
									label="Hospitality"
									bind:amount={$budgetStore.income_hospitality}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_hospitality', $budgetStore.income_hospitality)}
								/>
								<BudgetIncomeSection
									label="Other Expenses"
									bind:amount={$budgetStore.income_other}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_other', $budgetStore.income_other)}
								/>
							{/if}
						</div>
					</div>

					<div class="bg-gray1 rounded-lg p-4">
						<BudgetTotals
							{totalIncome}
							{totalExpenses}
							{netTotal}
							
							{incomeArtist}
							{expenseArtist}
							{incomeTechnical}
							{expenseTechnical}
							{incomeHospitality}
							{expenseHospitality}
							{incomeOther}
							{expenseOther}

							{budgetType}
							{incomeTotalBudget}
						/>
					</div>
				</div>

				<div class="mt-4">
					<button type="button" on:click={handleGeneratePdf} disabled={isExporting} class="w-full bg-lime text-black font-bold text-sm py-3 rounded-lg hover:bg-confirmed/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
						{#if isExporting}
							<span class="flex items-center justify-center gap-2">
								<div class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></div>
								Exporting...
							</span>
						{:else}
							Export as PDF
						{/if}
					</button>
				</div>
			</div>
		{:else}
			<div class="flex-1 flex flex-col items-center justify-center h-full text-center p-4">
				<div class="animate-spin w-8 h-8 border-2 border-lime border-t-transparent rounded-full mb-3"></div>
				<p class="text-gray2 text-xs">Loading budget...</p>
			</div>
		{/if}
	{/if}
</div>

<div use:portal>
	<PresetManager bind:isOpen={isPresetModalOpen} on:close={() => (isPresetModalOpen = false)} />
</div>

<style>
	.custom-scroll::-webkit-scrollbar { width: 6px; }
	.custom-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
	.custom-scroll::-webkit-scrollbar-thumb { background: #e1ff00; border-radius: 3px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: #f0ff4d; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.animate-spin { animation: spin 1s linear infinite; }
</style>