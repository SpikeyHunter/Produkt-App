<!--
  NEW COMPONENT: BudgetSimpleCategory
  - Designed for categories like "Artist Fee" that don't need subsections.
  - Manages a flat list of items directly.
  - Includes Auto-Suggest for Presets.
  - Includes Custom Unit Dropdown.
-->
<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase.js';
	import { formatMoney } from '$lib/utils/budgetUtils';
	import type { Preset } from '$lib/types/budget';
    import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';

	export let title: string;
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
		if (error) console.error('Error loading presets:', error);
		else availablePresets = (data as Preset[]) || [];
		loadingPresets = false;
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

	$: categoryTotal = items.reduce(
		(acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
		0
	);

	$: groupedFilteredPresets = (availablePresets || [])
		.filter((p) => p.name.toLowerCase().includes(nameSearch.toLowerCase()))
		.reduce((acc, preset) => {
			const type = preset.type || 'Uncategorized';
			if (!acc[type]) acc[type] = [];
			acc[type].push(preset);
			return acc;
		}, {} as { [type: string]: Preset[] });

	$: groupedFilteredPresetArray = Object.entries(groupedFilteredPresets);
</script>

<div class="py-4 border-t border-gray1 first:pt-0 first:border-t-0">
	<!-- Category Header -->
	<div class="flex justify-between items-center mb-3">
		<div class="flex justify-between items-center">
        <h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
        <span class="text-sm ml-1 font-bold text-white">- {formatMoney(categoryTotal)}</span>
        </div>
		<div class="flex items-center gap-2">
			
			<button
				type="button"
				on:click={addItem}
				class="px-2 py-1 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
			>
				+ Add Fee
			</button>
		</div>
	</div>

	<!-- Item List -->
	<div class="space-y-2">
		{#if items.length > 0}
			<!-- Header Row -->
			<div class="grid grid-cols-12 gap-2 text-gray2 text-xs uppercase tracking-wider px-2">
				<div class="col-span-5">Item</div>
				<div class="col-span-2">Price</div>
				<div class="col-span-1">Qty</div>
				<div class="col-span-2">Unit</div>
				<div class="col-span-2 text-right">Total</div>
			</div>
			<!-- Items -->
			{#each items as item (item.id)}
				<div
					class="grid grid-cols-12 gap-2 items-start bg-navbar p-2 rounded-xl"
					in:fade|local={{ duration: 200 }}
				>
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
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
						/>
						<!-- Auto-suggestion dropdown -->
						{#if focusedItemId === item.id && groupedFilteredPresetArray.length > 0}
							<div
								class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-lime rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto custom-scroll"
							>
								{#each groupedFilteredPresetArray as [type, presets]}
									<div class="px-3 py-1.5 text-lime text-xs font-bold uppercase tracking-wider">
										{type}
									</div>
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
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
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
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
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
							class="w-full bg-gray1 text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
						/>
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
					<div class="col-span-2 text-right mr-3">
						<span class="text-white text-sm font-medium mr-3">
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