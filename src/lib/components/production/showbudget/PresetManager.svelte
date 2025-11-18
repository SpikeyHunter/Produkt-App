<!--
  FIXED:
  - Removed 'async' from 'focus' action to resolve the TypeScript error:
    "Argument of type 'Promise<void>' is not assignable..."
  - Removed unused 'tick' import.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase.js';
	import { formatMoney } from '$lib/utils/budgetUtils';
	import type { Preset } from '$lib/types/budget';

	export let isOpen = false;
	const dispatch = createEventDispatcher();

	const categories = [
		{ key: 'technical', label: 'Technical' },
		{ key: 'hospitality', label: 'Hospitality' },
		{ key: 'other', label: 'Other Expenses' }
	];
	let currentCategory = 'technical';
	let allPresets: Preset[] = [];
	let loading = false;
	let editStates: { [id: string]: boolean } = {};

	// Form for new preset
	let newName = '';
	let newType = '';
	let newPrice: number | null = null;
	let newQuantity: number | null = 1;
	let newUnitInputValue = ''; 

	let showNewTypeDropdown = false;
	let showNewUnitDropdown = false;
	const unitOptions = ['Item', 'Hour', 'Day'];

	/**
	 * A simple action to programmatically focus an element.
	 * Fixed: Must be synchronous to satisfy Svelte action types.
	 */
	function focus(node: HTMLElement) {
		node.focus();
	}

	onMount(() => {
		if (isOpen) loadAllPresets();
	});

	$: if (isOpen) {
		loadAllPresets();
		currentCategory = 'technical';
	}

	async function loadAllPresets() {
		loading = true;
		const { data, error } = await supabase.from('show_expenses').select('*').order('name');
		if (error) console.error('Error loading all presets:', error);
		else allPresets = (data as Preset[]) || [];
		loading = false;
	}

	function notifyChange() {
		dispatch('presetsChanged');
	}

	async function addPreset() {
		if (!newName) return;
		const { data, error } = await supabase
			.from('show_expenses')
			.insert([
				{
					name: newName,
					category: currentCategory,
					type: newType || null,
					price: newPrice || 0,
					quantity: newQuantity || 1,
					unit: newUnitInputValue || 'Item'
				}
			])
			.select();

		if (error) console.error('Error adding preset:', error);
		else if (data) {
			allPresets = [...allPresets, data[0] as Preset];
			newName = '';
			newType = '';
			newPrice = null;
			newQuantity = 1;
			newUnitInputValue = '';
			notifyChange();
		}
	}

	async function updatePreset(preset: Preset) {
		const { data, error } = await supabase
			.from('show_expenses')
			.update({
				name: preset.name,
				type: preset.type || null,
				price: preset.price || 0,
				quantity: preset.quantity || 1,
				unit: preset.unit || 'Item'
			})
			.eq('id', preset.id)
			.select();

		if (error) console.error('Error updating preset:', error);
		else if (data) {
			allPresets = allPresets.map((p) => (p.id === data[0].id ? (data[0] as Preset) : p));
			editStates[preset.id] = false;
			notifyChange();
		}
	}

	async function deletePreset(id: string) {
		const { error } = await supabase.from('show_expenses').delete().eq('id', id);
		if (error) console.error('Error deleting preset:', error);
		else {
			allPresets = allPresets.filter((p) => p.id !== id);
			notifyChange();
		}
	}

	function closeModal() {
		dispatch('close');
	}

	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest) {
			if (!(event.target as Element).closest('.dropdown-container')) {
				showNewTypeDropdown = false;
				showNewUnitDropdown = false;
			}
		}
	}

	$: existingTypes = Array.from(
		new Set(
			allPresets
				.filter((p) => p.category === currentCategory && p.type)
				.map((p) => p.type as string)
		)
	).sort();

	$: groupedPresets = (allPresets || [])
		.filter((p) => p.category === currentCategory)
		.reduce((acc, preset) => {
			const type = preset.type || 'Uncategorized';
			if (!acc[type]) acc[type] = [];
			acc[type].push(preset);
			return acc;
		}, {} as { [type: string]: Preset[] });

	$: filteredTypes = existingTypes.filter((t) => t.toLowerCase().includes(newType.toLowerCase()));
	$: groupedPresetArray = Object.entries(groupedPresets);
</script>

<svelte:window on:click={handleClickOutside} />

<Modal bind:isOpen title="Manage Expense Presets" maxWidth="max-w-7xl" on:close={closeModal}>
	<div class="flex gap-6">
		<!-- Category Tabs -->
		<div class="w-1/5">
			<nav class="flex flex-col space-y-1">
				{#each categories as category}
					<button
						type="button"
						class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer
            {currentCategory === category.key
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray1'}"
						on:click={() => (currentCategory = category.key)}
					>
						{category.label}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Preset List & Forms -->
		<div class="w-3/4 h-[70vh] overflow-y-auto custom-scroll pr-2">
			<h3 class="text-white font-bold text-lg mb-4 sticky top-0 bg-navbar py-2">
				{categories.find((c) => c.key === currentCategory)?.label}
			</h3>

			<!-- Add New Preset Form -->
			<div class="grid grid-cols-12 gap-2 items-center bg-gray1 p-2 rounded-lg mb-4">
				<div class="col-span-3">
					<input
						type="text"
						bind:value={newName}
						placeholder="New Preset Name"
						class="w-full bg-navbar text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<!-- Type Dropdown Input -->
				<div class="col-span-2 relative dropdown-container">
					<input
						type="text"
						bind:value={newType}
						on:focus={() => (showNewTypeDropdown = true)}
						on:blur={() => setTimeout(() => (showNewTypeDropdown = false), 150)}
						on:input={() => (showNewTypeDropdown = true)}
						placeholder="Type (e.g., Mixer)"
						class="w-full bg-navbar text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
					/>
					{#if showNewTypeDropdown && filteredTypes.length > 0}
						<div
							class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-lime rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto custom-scroll"
						>
							{#each filteredTypes as type}
								<button
									type="button"
									class="w-full text-left px-3 py-1.5 text-white hover:bg-lime hover:text-black cursor-pointer"
									on:mousedown={() => {
										newType = type;
										showNewTypeDropdown = false;
									}}
								>
									{type}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="col-span-2">
					<input
						type="number"
						bind:value={newPrice}
						placeholder="Price"
						class="w-full bg-navbar text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<div class="col-span-1">
					<input
						type="number"
						bind:value={newQuantity}
						placeholder="Qty"
						class="w-full bg-navbar text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<!-- Unit Dropdown Input -->
				<div class="col-span-2 relative dropdown-container">
					<input
						type="text"
						bind:value={newUnitInputValue}
						on:focus={() => (showNewUnitDropdown = true)}
						on:blur={() => setTimeout(() => (showNewUnitDropdown = false), 150)}
						placeholder="Unit"
						class="w-full bg-navbar text-white rounded-xl px-3 py-1 text-sm placeholder-gray2"
					/>
					{#if showNewUnitDropdown}
						<div
							class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-lime rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto custom-scroll"
						>
							{#each unitOptions as unit}
								<button
									type="button"
									class="w-full text-left px-3 py-1.5 text-white hover:bg-lime hover:text-black cursor-pointer"
									on:mousedown={() => {
										newUnitInputValue = unit;
										showNewUnitDropdown = false;
									}}
								>
									{unit}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="col-span-2">
					<button
						type="button"
						on:click={addPreset}
						disabled={!newName}
						class="w-full bg-lime text-black text-xs font-bold rounded-xl px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						ADD PRESET
					</button>
				</div>
			</div>

			<!-- Existing Presets List -->
			<div class="space-y-2">
				{#if loading}
					<p class="text-gray2">Loading...</p>
				{:else if groupedPresetArray.length === 0}
					<p class="text-gray2">No presets found for this category.</p>
				{:else}
					<!-- Header -->
					<div class="grid grid-cols-12 gap-2 text-gray2 text-xs uppercase px-2">
						<div class="col-span-3">Name</div>
						<div class="col-span-2">Type</div>
						<div class="col-span-2">Price</div>
						<div class="col-span-1">Qty</div>
						<div class="col-span-2">Unit</div>
						<div class="col-span-2"></div>
					</div>
					<!-- Items -->
					{#each groupedPresetArray as [type, presets]}
						<div class="pt-2">
							<h4 class="text-lime text-xs font-bold uppercase tracking-wider mb-1 px-2">
								{type}
							</h4>
						</div>
						{#each presets as preset (preset.id)}
							<div class="grid grid-cols-12 gap-2 items-center bg-navbar p-2 rounded-lg">
								{#if editStates[preset.id]}
									<input
										type="text"
										bind:value={preset.name}
										class="col-span-3 bg-gray1 text-white rounded px-2 py-1 text-sm"
										use:focus
									/>
									<input
										type="text"
										bind:value={preset.type}
										placeholder="Type"
										class="col-span-2 bg-gray1 text-white rounded px-2 py-1 text-sm"
									/>
									<input
										type="number"
										bind:value={preset.price}
										placeholder="Price"
										class="col-span-2 bg-gray1 text-white rounded px-2 py-1 text-sm"
									/>
									<input
										type="number"
										bind:value={preset.quantity}
										placeholder="Qty"
										class="col-span-1 bg-gray1 text-white rounded px-2 py-1 text-sm"
									/>
									<!-- Editable Unit Field -->
									<input
										type="text"
										bind:value={preset.unit}
										placeholder="Unit"
										class="col-span-2 bg-gray1 text-white rounded px-2 py-1 text-sm"
									/>
									<div class="col-span-2 flex justify-end gap-1">
										<button
											type="button"
											on:click={() => updatePreset(preset)}
											class="text-lime text-xs font-bold cursor-pointer"
										>
											SAVE
										</button>
										<button
											type="button"
											on:click={() => (editStates[preset.id] = false)}
											class="text-gray2 text-xs cursor-pointer"
										>
											CANCEL
										</button>
									</div>
								{:else}
									<span class="col-span-3 text-white truncate">{preset.name}</span>
									<span class="col-span-2 text-white truncate">{preset.type || '–'}</span>
									<span class="col-span-2 text-white">{formatMoney(preset.price)}</span>
									<span class="col-span-1 text-white">{preset.quantity}</span>
									<span class="col-span-2 text-white">{preset.unit}</span>
									<div class="col-span-2 flex justify-end gap-2">
										<button
											type="button"
											on:click={() => (editStates[preset.id] = true)}
											class="text-gray2 hover:text-lime text-xs cursor-pointer"
										>
											<!-- EDIT ICON -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												class="w-4 h-4"
											>
												<path
													d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
												/>
											</svg>
										</button>
										<button
											type="button"
											on:click={() => deletePreset(preset.id)}
											class="text-gray2 hover:text-red-500 text-xs cursor-pointer"
										>
											<!-- TRASH ICON -->
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												class="w-4 h-4"
											>
												<path
													fill-rule="evenodd"
													d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
													clip-rule="evenodd"
												/>
											</svg>
										</button>
									</div>
								{/if}
							</div>
						{/each}
					{/each}
				{/if}
			</div>
		</div>
	</div>
</Modal>

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