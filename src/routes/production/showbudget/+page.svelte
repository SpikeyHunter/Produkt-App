<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorBudget from '$lib/components/production/showbudget/EventSelectorBudget.svelte';
	import BudgetDetailsDisplay from '$lib/components/production/showbudget/BudgetDetailsDisplay.svelte';
	import ExportBudget from '$lib/components/production/showbudget/ExportBudget.svelte';
	import { createBudgetSync } from '$lib/utils/budgetSync';
	import {
		subsBudgetedTotal,
		itemsBudgetedTotal,
		incomeTotalFor
	} from '$lib/utils/budgetUtils';

	let selectedEvent: any = null;
	let isExporting = false;
	let mounted = false;
	let presetRefreshTrigger = 0;

	// All loading / saving / realtime / undo lives here now
	const sync = createBudgetSync();
	const budgetStore = sync.store;
	const savingState = sync.savingState;

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
	});

	onDestroy(() => {
		sync.destroy();
	});

	async function handleEventSelect(event: CustomEvent) {
		selectedEvent = event.detail;
		if (!selectedEvent) {
			await sync.clear();
			return;
		}
		await sync.load(selectedEvent.id);
	}

	// Children dispatch save with { key: <db column or store key> }.
	// The sync engine reads the current store state itself — no stale data races.
	function handleSave(event: CustomEvent) {
		const { key } = event.detail;
		sync.markDirty(key);
	}

	// Live net of the currently open budget — recomputes on every keystroke and
	// feeds the selector card, so it never waits for save + realtime round-trip.
	$: liveNet = $budgetStore ? computeLiveNet($budgetStore) : null;

	function computeLiveNet(s: any): number {
		const type = s.budget_type || 'Tour Prod';
		let expenses =
			subsBudgetedTotal(s.technical || []) +
			subsBudgetedTotal(s.hospitality || []) +
			subsBudgetedTotal(s.other_expenses || []);
		if (type === 'Complete Prod') expenses += itemsBudgetedTotal(s.artist_fee || []);
		return incomeTotalFor(s) - expenses;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
		if (!$budgetStore) return;
		e.preventDefault();
		// Commit whatever input is being typed in before stepping through history
		(document.activeElement as HTMLElement | null)?.blur?.();
		setTimeout(() => (e.shiftKey ? sync.redo() : sync.undo()), 0);
	}
</script>

<svelte:head>
	<title>Show Budget - NCG</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<MainLayout pageTitle="Show Budget">
	<div class="h-full overflow-hidden p-4 xl:p-6">
		<div class="liaison-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<EventSelectorBudget
					liveNetId={selectedEvent?.id ?? null}
					{liveNet}
					on:select={handleEventSelect}
				/>
			</div>

			<div class="details-column">
				<BudgetDetailsDisplay {budgetStore} {presetRefreshTrigger} on:save={handleSave} />
			</div>

			<div class="export-column">
				<ExportBudget
					{budgetStore}
					{selectedEvent}
					{isExporting}
					{savingState}
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
		grid-template-columns: 222px minmax(0, 1fr) 272px;
		gap: 12px;
		height: 100%;
	}
	.selector-column,
	.details-column,
	.export-column {
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
	.details-column {
		min-width: 0;
	}
	@media (max-width: 1400px) {
		.liaison-container { grid-template-columns: 208px minmax(0, 1fr) 252px; }
	}
	@media (max-width: 1200px) {
		.liaison-container { grid-template-columns: 194px minmax(0, 1fr) 232px; gap: 10px; }
	}
	/* Narrow windows: export panel drops below the details column so nothing
	   gets squeezed or cut — the selector keeps the full height on the left. */
	@media (max-width: 1024px) {
		.liaison-container {
			grid-template-columns: 184px minmax(0, 1fr);
			grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
		}
		.selector-column { grid-row: 1 / -1; }
	}
</style>