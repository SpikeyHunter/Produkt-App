<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorBudget from '$lib/components/production/showbudget/EventSelectorBudget.svelte';
	import BudgetDetailsDisplay from '$lib/components/production/showbudget/BudgetDetailsDisplay.svelte';
	import ExportBudget from '$lib/components/production/showbudget/ExportBudget.svelte';
	import { supabase } from '$lib/supabase.js';

	let selectedEvent: any = null;
	let isExporting = false;
	let mounted = false;
	let presetRefreshTrigger = 0;

	const budgetStore = writable<any>(null);

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
	});

	function safeJsonParse(input: any) {
		if (typeof input === 'string') {
			try {
				return JSON.parse(input);
			} catch (e) {
				console.warn('Failed to parse JSON:', input);
				return [];
			}
		}
		return input || [];
	}

	async function handleEventSelect(event: CustomEvent) {
		selectedEvent = event.detail;
		if (!selectedEvent) {
			budgetStore.set(null);
			return;
		}

		// CHANGED: Added budget_type and income_total_budget to query
		const { data, error } = await supabase
			.from('show_budget')
			.select(
				`id, 
				event_name, 
				event_id, 
				budget_type,
				income_total_budget,
				income_artist, 
				income_technical, 
				income_hospitality, 
				income_other, 
				expenses_artist_fee, 
				expenses_technical, 
				expenses_hospitality, 
				expenses_other`
			)
			.eq('id', selectedEvent.id)
			.single();

		if (error) {
			console.error('Error loading budget details:', error);
			budgetStore.set(null);
		} else {
			budgetStore.set({
				// New Fields
				budget_type: data.budget_type || 'Tour Prod',
				income_total_budget: data.income_total_budget ?? null,

				// Existing Fields
				income_artist: data.income_artist ?? null,
				income_technical: data.income_technical ?? null,
				income_hospitality: data.income_hospitality ?? null,
				income_other: data.income_other ?? null,

				// Expenses (Arrays)
				artist_fee: safeJsonParse(data.expenses_artist_fee),
				technical: safeJsonParse(data.expenses_technical),
				hospitality: safeJsonParse(data.expenses_hospitality),
				other_expenses: safeJsonParse(data.expenses_other)
			});
		}
	}

	async function handleExport(event: CustomEvent) {
		// Export logic handled in child component
	}

	async function handleSave(event: CustomEvent) {
		if (!selectedEvent) return;
		const { key, data } = event.detail;
		
		// Map store keys to DB columns if they differ
		let dbKey = key;
		// (No mapping needed for budget_type or income_total_budget as keys match DB)

		await supabase
			.from('show_budget')
			.update({ [dbKey]: data })
			.eq('id', selectedEvent.id);
	}
</script>

<svelte:head>
	<title>Show Budget - NCG</title>
</svelte:head>

<MainLayout pageTitle="Show Budget">
	<div class="h-full overflow-hidden p-6">
		<div class="liaison-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<EventSelectorBudget on:select={handleEventSelect} />
			</div>

			<div class="details-column">
				<BudgetDetailsDisplay 
					{budgetStore} 
					{presetRefreshTrigger}
					on:save={handleSave} 
				/>
			</div>

			<div class="export-column">
				<ExportBudget
					{budgetStore}
					{selectedEvent}
					{isExporting}
					on:export={handleExport}
					on:save={handleSave}
					on:presetsChanged={() => presetRefreshTrigger++}
				/>
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
	}
	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
	.liaison-container {
		display: grid;
		grid-template-columns: 320px 1fr 280px;
		gap: 16px;
		height: 100%;
	}
	.selector-column,
	.details-column,
	.export-column {
		height: 100%;
		overflow: hidden;
	}
	.selector-column {
		width: 320px;
		min-width: 320px;
		max-width: 320px;
	}
	.export-column {
		width: 280px;
		min-width: 280px;
		max-width: 280px;
	}
	.details-column {
		min-width: 0;
	}
	@media (max-width: 1400px) {
		.liaison-container { grid-template-columns: 280px 1fr 250px; }
		.selector-column { width: 280px; min-width: 280px; max-width: 280px; }
		.export-column { width: 250px; min-width: 250px; max-width: 250px; }
	}
	@media (max-width: 1200px) {
		.liaison-container { grid-template-columns: 260px 1fr 220px; gap: 12px; }
		.selector-column { width: 260px; min-width: 260px; max-width: 260px; }
		.export-column { width: 220px; min-width: 220px; max-width: 220px; }
	}
</style>