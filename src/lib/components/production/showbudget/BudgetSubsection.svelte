<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { formatMoney, itemsBudgetedTotal, itemsActualTotal, itemsHaveActuals } from '$lib/utils/budgetUtils';
	import { supabase } from '$lib/supabase.js';
	import type { Preset, BudgetItem } from '$lib/types/budget';
	import BudgetItemRow from './BudgetItemRow.svelte';

	export let name: string;
	export let hidden: boolean = false;
	export let categoryKey: string;
	export let items: BudgetItem[] = [];
	export let presetRefreshTrigger = 0;

	const dispatch = createEventDispatcher();
	let isEditingName = false;

	let availablePresets: Preset[] = [];

	onMount(() => {
		loadPresets();
	});

	$: if (presetRefreshTrigger >= 0) {
		loadPresets();
	}

	async function loadPresets() {
		const { data, error } = await supabase
			.from('show_expenses')
			.select('*')
			.eq('category', categoryKey)
			.order('name');
		if (error) console.error('Error loading presets:', error);
		else availablePresets = (data as Preset[]) || [];
	}

	function focus(node: HTMLElement) {
		node.focus();
	}

	function notifyUpdate() {
		dispatch('update');
	}
	function notifySave() {
		dispatch('save');
	}
	function change() {
		notifyUpdate();
		notifySave();
	}

	function addItem() {
		items = [
			...items,
			{
				id: crypto.randomUUID(),
				name: '',
				price: null,
				actual: null,
				quantity: 1,
				unit: '',
				hidden: false,
				flagged: false
			}
		];
		change();
	}

	function deleteItem(id: string) {
		items = items.filter((item) => item.id !== id);
		change();
	}

	function handleNameBlur() {
		isEditingName = false;
		notifySave();
	}

	function toggleHidden() {
		hidden = !hidden;
		change();
	}

	$: subsectionBudgeted = itemsBudgetedTotal(items);
	$: subsectionActual = itemsActualTotal(items);
	$: hasActuals = itemsHaveActuals(items);
</script>

<div class="bg-navbar p-2 rounded-xl {hidden ? 'opacity-50' : ''}">
	<!-- Subsection Header -->
	<div class="flex justify-between items-center {hidden ? '' : 'mb-2'}">
		{#if isEditingName}
			<input
				type="text"
				bind:value={name}
				on:blur={handleNameBlur}
				class="bg-gray1 text-white rounded px-2 py-0.5 text-sm font-bold"
				use:focus
				on:keydown={(e) => {
					if (e.key === 'Enter') handleNameBlur();
				}}
			/>
		{:else}
			<div class="min-w-0 truncate">
				<button
					type="button"
					class="text-white font-bold text-sm cursor-pointer hover:text-lime"
					on:click={() => (isEditingName = true)}
				>
					{name}
				</button>
				{#if !hidden}
					<span class="text-sm font-medium text-lime">- {formatMoney(subsectionBudgeted)}</span>
					{#if hasActuals}
						<span class="text-xs font-medium text-confirmed ml-1">act. {formatMoney(subsectionActual)}</span>
					{/if}
				{:else}
					<span class="text-xs text-gray2 ml-1">(hidden — excluded from totals)</span>
				{/if}
			</div>
		{/if}
		<div class="flex items-center gap-1.5 flex-shrink-0">
			{#if !hidden}
				<button
					type="button"
					on:click={addItem}
					class="px-2 py-0.5 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
				>
					+ Add Item
				</button>
			{/if}
			<button
				type="button"
				on:click={toggleHidden}
				class="w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors {hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
				title={hidden ? 'Show section' : 'Hide section (exclude from totals + export)'}
				aria-label="Toggle section visibility"
			>
				{#if hidden}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
						<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
						<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
						<line x1="1" y1="1" x2="23" y2="23" />
					</svg>
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				{/if}
			</button>
			<button
				type="button"
				on:click={() => dispatch('delete')}
				class="w-6 h-6 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer transition-colors"
				title="Delete section"
				aria-label="Delete section"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
				</svg>
			</button>
		</div>
	</div>

	{#if !hidden}
		<div class="space-y-1">
			{#if items.length > 0}
				<!-- Header Row -->
				<div class="header-grid text-gray2 text-[10px] uppercase tracking-wider px-0.5">
					<div></div>
					<div>Item</div>
					<div>Budgeted $</div>
					<div>Actual $</div>
					<div class="text-center">Qty</div>
					<div>Unit</div>
					<div class="text-right">Total</div>
					<div></div>
				</div>
				{#each items as item (item.id)}
					<BudgetItemRow
						bind:item
						{availablePresets}
						on:update={notifyUpdate}
						on:save={notifySave}
						on:delete={() => deleteItem(item.id)}
					/>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.header-grid {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr) minmax(64px, 84px) minmax(64px, 84px) 34px minmax(40px, 54px) minmax(74px, 92px) 40px;
		gap: 4px;
	}
</style>