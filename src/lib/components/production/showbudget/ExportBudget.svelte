<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import type { Writable, Readable } from 'svelte/store';
	import BudgetIncomeSection from './BudgetIncomeSection.svelte';
	import BudgetTotals from './BudgetTotals.svelte';
	import PresetManager from './PresetManager.svelte';
	import BudgetPdfTemplate from './BudgetPdfTemplate.svelte';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import {
		itemsBudgetedTotal,
		itemsActualTotal,
		itemsHaveActuals,
		subsBudgetedTotal,
		subsActualTotal,
		subsHaveActuals
	} from '$lib/utils/budgetUtils';
	import type { ExportOptions } from '$lib/types/budget';
	import { env } from '$env/dynamic/public';
	import { portal } from '$lib/utils/portalUtils';

	export let selectedEvent: any = null;
	export let budgetStore: Writable<any>;
	export let isExporting = false;
	// REAL saving state from the sync engine (not a fake timer anymore)
	export let savingState: Readable<'idle' | 'saving' | 'saved' | 'error'>;

	const dispatch = createEventDispatcher();
	let isPresetModalOpen = false;
	let sheetContainer: HTMLDivElement;
	let showExportOptions = false;

	const budgetTypeOptions = ['Tour Prod', 'Internal Prod', 'Complete Prod'];
	const amountOptions: { value: ExportOptions['amounts']; label: string }[] = [
		{ value: 'both', label: 'Budgeted + Actual' },
		{ value: 'budgeted', label: 'Budgeted only' },
		{ value: 'actual', label: 'Actual only' }
	];

	// Export options (hidden rows/sections are always excluded automatically)
	let exportOptions: ExportOptions = {
		amounts: 'both',
		sections: { artist_fee: true, technical: true, hospitality: true, other_expenses: true },
		includeIncome: true
	};

	function handleSave(key: string) {
		if (!$budgetStore) return;
		dispatch('save', { key });
	}

	function handleBudgetTypeSelect(e: CustomEvent) {
		if (!$budgetStore) return;
		$budgetStore.budget_type = e.detail;
		handleSave('budget_type');
	}

	function handleIncomeUpdate() {
		if (!$budgetStore) return;
		$budgetStore = $budgetStore;
	}

	// Variables
	$: budgetType = $budgetStore?.budget_type || 'Tour Prod';

	$: incomeTotalBudget = Number($budgetStore?.income_total_budget) || 0;
	$: incomeArtist = Number($budgetStore?.income_artist) || 0;
	$: incomeTechnical = Number($budgetStore?.income_technical) || 0;
	$: incomeHospitality = Number($budgetStore?.income_hospitality) || 0;
	$: incomeOther = Number($budgetStore?.income_other) || 0;

	$: totalIncome = (() => {
		if (budgetType === 'Internal Prod') return incomeTotalBudget;
		if (budgetType === 'Tour Prod') return incomeTechnical + incomeHospitality + incomeOther;
		return incomeArtist + incomeTechnical + incomeHospitality + incomeOther;
	})();

	// Budgeted expenses (hidden rows/sections excluded by the utils)
	$: expenseArtist = itemsBudgetedTotal($budgetStore?.artist_fee);
	$: expenseTechnical = subsBudgetedTotal($budgetStore?.technical);
	$: expenseHospitality = subsBudgetedTotal($budgetStore?.hospitality);
	$: expenseOther = subsBudgetedTotal($budgetStore?.other_expenses);

	$: totalExpenses = (() => {
		const base = expenseTechnical + expenseHospitality + expenseOther;
		if (budgetType === 'Complete Prod') return base + expenseArtist;
		return base;
	})();

	// Actual expenses (actual falls back to budgeted per line)
	$: actualArtist = itemsActualTotal($budgetStore?.artist_fee);
	$: actualTechnical = subsActualTotal($budgetStore?.technical);
	$: actualHospitality = subsActualTotal($budgetStore?.hospitality);
	$: actualOther = subsActualTotal($budgetStore?.other_expenses);

	$: actualExpenses = (() => {
		const base = actualTechnical + actualHospitality + actualOther;
		if (budgetType === 'Complete Prod') return base + actualArtist;
		return base;
	})();

	$: hasActuals =
		itemsHaveActuals($budgetStore?.artist_fee) ||
		subsHaveActuals($budgetStore?.technical) ||
		subsHaveActuals($budgetStore?.hospitality) ||
		subsHaveActuals($budgetStore?.other_expenses);

	$: netTotal = totalIncome - totalExpenses;
	$: actualNet = totalIncome - actualExpenses;

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
		<BudgetPdfTemplate budgetData={$budgetStore} event={selectedEvent} options={exportOptions} />
	{/if}
</div>

<div class="h-full flex flex-col bg-navbar border border-white/[0.07] rounded-xl overflow-hidden export-details-container">
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
			<div class="p-3 border-b border-gray1 shrink-0">
				<div class="flex justify-between items-center mb-3">
					<h2 class="text-white text-lg font-bold truncate">Budget Info</h2>
					<span
						class="text-xs transition-all shrink-0 ml-2
						{$savingState === 'saved' ? 'text-confirmed' : ''}
						{$savingState === 'saving' ? 'text-gray2' : ''}
						{$savingState === 'error' ? 'text-problem font-bold' : ''}
						{$savingState === 'idle' ? 'text-transparent' : ''}"
					>
						{#if $savingState === 'saving'}Saving...{:else if $savingState === 'saved'}Saved!{:else if $savingState === 'error'}Save failed — retrying on next edit{:else}.{/if}
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

			<div class="flex-1 flex flex-col justify-between overflow-y-auto custom-scroll p-3">
				<div class="space-y-3">
					<div class="bg-gray1 rounded-lg p-3">
						<h3 class="text-white font-bold text-base mb-2 pb-2 border-b border-gray2/20">
							Budget / Income (+)
						</h3>

						<div class="grid grid-cols-1 gap-3">
							{#if budgetType === 'Internal Prod'}
								<BudgetIncomeSection
									label="Total Budget"
									bind:amount={$budgetStore.income_total_budget}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_total_budget')}
								/>
							{:else}
								{#if budgetType === 'Complete Prod'}
									<BudgetIncomeSection
										label="Artist Fee"
										bind:amount={$budgetStore.income_artist}
										on:update={handleIncomeUpdate}
										on:save={() => handleSave('income_artist')}
									/>
								{/if}

								<BudgetIncomeSection
									label="Technical"
									bind:amount={$budgetStore.income_technical}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_technical')}
								/>
								<BudgetIncomeSection
									label="Hospitality"
									bind:amount={$budgetStore.income_hospitality}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_hospitality')}
								/>
								<BudgetIncomeSection
									label="Other Expenses"
									bind:amount={$budgetStore.income_other}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_other')}
								/>
							{/if}
						</div>
					</div>

					<div class="bg-gray1 rounded-lg p-3">
						<BudgetTotals
							{totalIncome}
							{totalExpenses}
							{netTotal}
							{actualExpenses}
							{actualNet}
							{hasActuals}
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

				<div class="mt-3">
					<!-- Export options -->
					<button
						type="button"
						on:click={() => (showExportOptions = !showExportOptions)}
						class="w-full text-center text-xs text-gray2 hover:text-white mb-2 transition-colors flex items-center justify-center gap-1 cursor-pointer"
					>
						Export Options
						<svg class="w-3 h-3 transform transition-transform {showExportOptions ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showExportOptions}
						<div transition:slide|local={{ duration: 150 }} class="bg-gray1 rounded-lg p-3 mb-2 space-y-3 text-xs">
							<div>
								<p class="text-gray2 uppercase tracking-wider mb-1.5">Amounts</p>
								<div class="flex flex-col gap-1">
									{#each amountOptions as opt}
										<label class="flex items-center gap-2 text-white cursor-pointer">
											<input type="radio" bind:group={exportOptions.amounts} value={opt.value} class="accent-[#e1ff00]" />
											{opt.label}
										</label>
									{/each}
								</div>
							</div>
							<div>
								<p class="text-gray2 uppercase tracking-wider mb-1.5">Sections</p>
								<div class="flex flex-col gap-1">
									{#if budgetType === 'Complete Prod'}
										<label class="flex items-center gap-2 text-white cursor-pointer">
											<input type="checkbox" bind:checked={exportOptions.sections.artist_fee} class="accent-[#e1ff00]" />
											Artist Fee
										</label>
									{/if}
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.technical} class="accent-[#e1ff00]" />
										Technical
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.hospitality} class="accent-[#e1ff00]" />
										Hospitality
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.other_expenses} class="accent-[#e1ff00]" />
										Other Expenses
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.includeIncome} class="accent-[#e1ff00]" />
										Income section
									</label>
								</div>
								<p class="text-gray2/70 mt-1.5">Hidden lines and hidden sections are always excluded.</p>
							</div>
						</div>
					{/if}

					<button type="button" on:click={handleGeneratePdf} disabled={isExporting} class="w-full bg-gray3 text-black font-bold text-sm py-2.5 rounded-3xl hover:bg-lime transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
						{#if isExporting}
							<span class="flex items-center justify-center gap-2">
								<div class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-3xl"></div>
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
	<PresetManager bind:isOpen={isPresetModalOpen} on:close={() => (isPresetModalOpen = false)} on:presetsChanged={() => dispatch('presetsChanged')} />
</div>

<style>
	.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
	.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
	.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.animate-spin { animation: spin 1s linear infinite; }
</style>