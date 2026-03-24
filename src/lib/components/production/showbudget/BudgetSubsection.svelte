<!--
  FIXED:
  - Removed 'async' from the 'focus' action to fix the TypeScript error.
  - 'focus' now returns void, which is valid for a Svelte action.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { formatMoney } from '$lib/utils/budgetUtils';
	import { supabase } from '$lib/supabase.js';
	import type { Preset } from '$lib/types/budget';
	import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';

	export let name: string;
	export let categoryKey: string;
	export let items: {
		id: string;
		name: string;
		price: number | null;
		quantity: number;
		unit: string;
	}[] = [];
	export let presetRefreshTrigger = 0;

	const dispatch = createEventDispatcher();
	let isEditingName = false;

	// --- Preset Autocomplete ---
	let availablePresets: Preset[] = [];
	let loadingPresets = true;
	let focusedItemId: string | null = null;
	let nameSearch = '';

	// --- Unit Dropdown ---
	let focusedUnitId: string | null = null;
	const unitOptions = ['Item', 'Hour', 'Day'];

	onMount(() => {
		loadPresets();
	});

	// Watch for refresh trigger
	$: if (presetRefreshTrigger >= 0) {
		loadPresets();
	}

	async function loadPresets() {
		loadingPresets = true;
		const { data, error } = await supabase
			.from('show_expenses')
			.select('*')
			.eq('category', categoryKey)
			.order('name');
		if (error) {
			console.error('Error loading presets:', error);
		} else {
			availablePresets = (data as Preset[]) || [];
		}
		loadingPresets = false;
	}

	/**
	 * Action to programmatically focus an element.
	 * Must be synchronous to satisfy Svelte's action type definition.
	 */
	function focus(node: HTMLElement) {
		// Simply calling focus() works well when the element is mounted.
		// If timing is an issue, requestAnimationFrame is a safe sync wrapper.
		node.focus();
	}

	function notifyUpdate() {
		dispatch('update');
	}

	function notifySave() {
		dispatch('save');
	}

	function addItem() {
		items = [
			...items,
			{
				id: crypto.randomUUID(),
				name: '',
				price: null,
				quantity: 1,
				unit: ''
			}
		];
		notifyUpdate();
		notifySave();
	}

	function deleteItem(id: string) {
		items = items.filter((item) => item.id !== id);
		notifyUpdate();
		notifySave();
	}

	function handleNameBlur() {
		isEditingName = false;
		notifySave();
	}

	// --- Autocomplete Handlers ---
	function handleItemNameFocus(item: any) {
		focusedItemId = item.id;
		focusedUnitId = null;
		nameSearch = item.name;
	}

	function handleItemNameBlur() {
		setTimeout(() => {
			focusedItemId = null;
		}, 150);
		notifySave();
	}

	function selectPreset(item: any, preset: Preset) {
		item.name = preset.name;
		item.price = preset.price;
		item.quantity = preset.quantity;
		item.unit = preset.unit;
		focusedItemId = null;
		nameSearch = '';
		notifyUpdate();
		notifySave();
	}
	// --- End Autocomplete Handlers ---

	// --- Unit Dropdown Handlers ---
	function handleUnitFocus(item: any) {
		focusedUnitId = item.id;
		focusedItemId = null;
	}
	function handleUnitBlur() {
		setTimeout(() => {
			focusedUnitId = null;
		}, 150);
		notifySave();
	}
	function selectUnit(item: any, unit: string) {
		item.unit = unit;
		focusedUnitId = null;
		notifyUpdate();
		notifySave();
	}
	// --- End Unit Handlers ---

	$: subsectionTotal = items.reduce(
		(acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
		0
	);

	$: groupedFilteredPresets = (availablePresets || [])
		.filter((p) => p.name.toLowerCase().includes(nameSearch.toLowerCase()))
		.reduce(
			(acc, preset) => {
				const type = preset.type || 'Uncategorized';
				if (!acc[type]) {
					acc[type] = [];
				}
				acc[type].push(preset);
				return acc;
			},
			{} as { [type: string]: Preset[] }
		);

	$: groupedFilteredPresetArray = Object.entries(groupedFilteredPresets);
</script>

<div class="bg-navbar p-3 rounded-xl">
	<!-- Subsection Header -->
	<div class="flex justify-between items-center mb-3">
		{#if isEditingName}
			<input
				type="text"
				bind:value={name}
				on:blur={handleNameBlur}
				class="bg-gray1 text-white rounded px-2 py-1 text-sm font-bold"
				use:focus
				on:keydown={(e) => {
					if (e.key === 'Enter') handleNameBlur();
				}}
			/>
		{:else}
			<div>
				<button
					type="button"
					class="text-white font-bold text-sm cursor-pointer hover:text-lime"
					on:click={() => (isEditingName = true)}
				>
					{name}
				</button>
				<span class="text-sm font-medium text-lime">- {formatMoney(subsectionTotal)}</span>
			</div>
		{/if}
		<div class="flex items-center gap-2">
			<button
				type="button"
				on:click={addItem}
				class="px-2 py-1 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
			>
				+ Add Item
			</button>
			<button
				type="button"
				on:click={() => dispatch('delete')}
				class="text-gray2 hover:text-problem cursor-pointer"
			>
				&times;
			</button>
		</div>
	</div>

	<!-- Item List for this Subsection -->
	<div class="space-y-2">
		{#if items.length > 0}
			<!-- Header Row -->
			<div class="grid grid-cols-12 gap-4 text-gray2 text-xs uppercase tracking-wider px-2">
				<div class="col-span-5">Item</div>
				<div class="col-span-2">Price</div>
				<div class="col-span-1">Qty</div>
				<div class="col-span-2">Unit</div>
				<div class="col-span-2 text-right">Total</div>
			</div>
			<!-- Items -->
			{#each items as item (item.id)}
				<div class="grid grid-cols-12 gap-2 items-start" in:fade|local={{ duration: 200 }}>
					<!-- Name -->
					<div class="col-span-5 relative">
						<input
							type="text"
							bind:value={item.name}
							on:focus={() => handleItemNameFocus(item)}
							on:input={(e) => {
								nameSearch = e.currentTarget.value;
								notifyUpdate();
							}}
							on:blur={handleItemNameBlur}
							placeholder="Type or select preset"
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-[13px] placeholder-gray2"
						/>
						<!-- Auto-suggestion dropdown -->
						{#if focusedItemId === item.id && groupedFilteredPresetArray.length > 0}
							<div
								class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-lime rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto custom-scroll"
							>
								{#each groupedFilteredPresetArray as [type, presets]}
									<!-- Type Sub-header -->
									<div class="px-3 py-1.5 text-lime text-xs font-bold uppercase tracking-wider">
										{type}
									</div>
									<!-- Presets in this group -->
									{#each presets as preset}
										<button
											type="button"
											class="w-full text-left px-3 py-1.5 text-white hover:bg-lime hover:text-black cursor-pointer"
											on:mousedown={() => selectPreset(item, preset)}
										>
											{preset.name}
										</button>
									{/each}
								{/each}
							</div>
						{/if}
					</div>
					<!-- Price -->
					<div class="col-span-2">
						<BudgetCurrencyInput
							bind:value={item.price}
							on:input={notifyUpdate}
							on:blur={notifySave}
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-[13px] placeholder-gray2"
						/>
					</div>
					<!-- Qty -->
					<div class="col-span-1">
						<input
							type="number"
							bind:value={item.quantity}
							on:input={notifyUpdate}
							on:blur={notifySave}
							placeholder="1"
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-[13px] placeholder-gray2"
						/>
					</div>
					<!-- Unit -->
					<div class="col-span-2 relative">
						<input
							type="text"
							bind:value={item.unit}
							on:focus={() => handleUnitFocus(item)}
							on:input={notifyUpdate}
							on:blur={handleUnitBlur}
							placeholder="Item"
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-[13px] placeholder-gray2"
						/>
						<!-- Unit suggestion dropdown -->
						{#if focusedUnitId === item.id}
							<div
								class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-lime rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto custom-scroll"
							>
								{#each unitOptions as unit}
									<button
										type="button"
										class="w-full text-left px-3 py-1.5 text-white hover:bg-lime hover:text-black cursor-pointer"
										on:mousedown={() => selectUnit(item, unit)}
									>
										{unit}
									</button>
								{/each}
							</div>
						{/if}
					</div>
					<!-- Total -->
					<div class="col-span-2 text-right mr-1">
						<span class="text-white text-[13px] font-medium mr-3">
							{formatMoney(Number(item.price || 0) * Number(item.quantity || 1))}
						</span>
						<button
							type="button"
							on:click={() => deleteItem(item.id)}
							class="ml-2 text-gray2 hover:text-problem cursor-pointer"
						>
							&times;
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.custom-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 2px;
	}
</style>
