<!--
  NEW COMPONENT
  - This modal allows creating, updating, and deleting presets
    in the 'show_expenses' table.
  - Uses placeholders for new/empty fields.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;
	const dispatch = createEventDispatcher();

	const categories = [
		{ key: 'artist_fee', label: 'Artist Fee' },
		{ key: 'technical', label: 'Technical' },
		{ key: 'hospitality', label: 'Hospitality' },
		{ key: 'other', label: 'Other Expenses' }
	];
	let currentCategory = 'artist_fee';
	let allPresets: any[] = [];
	let loading = false;
	let editStates: { [id: string]: boolean } = {};

	// Form for new preset
	let newName = '';
	let newPrice: number | null = null;
	let newQuantity: number | null = 1;
	let newUnit = 'Item'; // Default new items to "Item"

	onMount(() => {
		if (isOpen) loadAllPresets();
	});

	$: if (isOpen) {
		loadAllPresets();
	}

	async function loadAllPresets() {
		loading = true;
		const { data, error } = await supabase.from('show_expenses').select('*').order('name');
		if (error) {
			console.error('Error loading all presets:', error);
		} else {
			allPresets = data || [];
		}
		loading = false;
	}

	async function addPreset() {
		if (!newName) return;
		const { data, error } = await supabase
			.from('show_expenses')
			.insert([
				{
					name: newName,
					category: currentCategory,
					price: newPrice || 0,
					quantity: newQuantity || 1,
					unit: newUnit || 'Item'
				}
			])
			.select();

		if (error) {
			console.error('Error adding preset:', error);
		} else if (data) {
			allPresets = [...allPresets, data[0]];
			newName = '';
			newPrice = null;
			newQuantity = 1;
			newUnit = 'Item';
		}
	}

	async function updatePreset(preset: any) {
		const { data, error } = await supabase
			.from('show_expenses')
			.update({
				name: preset.name,
				price: preset.price || 0,
				quantity: preset.quantity || 1,
				unit: preset.unit || 'Item'
			})
			.eq('id', preset.id)
			.select();

		if (error) {
			console.error('Error updating preset:', error);
		} else if (data) {
			// Update local list
			allPresets = allPresets.map((p) => (p.id === data[0].id ? data[0] : p));
			editStates[preset.id] = false;
		}
	}

	async function deletePreset(id: string) {
		const { error } = await supabase.from('show_expenses').delete().eq('id', id);
		if (error) {
			console.error('Error deleting preset:', error);
		} else {
			allPresets = allPresets.filter((p) => p.id !== id);
		}
	}

	function closeModal() {
		dispatch('close');
	}

	$: filteredPresets = allPresets.filter((p) => p.category === currentCategory);
</script>

<Modal bind:isOpen title="Manage Expense Presets" maxWidth="max-w-4xl" on:close={closeModal}>
	<div class="flex gap-6">
		<!-- Category Tabs -->
		<div class="w-1/4">
			<nav class="flex flex-col space-y-1">
				{#each categories as category}
					<button
						type="button"
						class="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all
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
		<div class="w-3/4">
			<h3 class="text-white font-bold text-lg mb-4">
				{categories.find((c) => c.key === currentCategory)?.label}
			</h3>

			<!-- Add New Preset Form -->
			<div class="grid grid-cols-12 gap-2 items-center bg-gray1 p-2 rounded-lg mb-4">
				<div class="col-span-4">
					<input
						type="text"
						bind:value={newName}
						placeholder="New Preset Name"
						class="w-full bg-navbar text-white rounded px-2 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<div class="col-span-2">
					<input
						type="number"
						bind:value={newPrice}
						placeholder="Price"
						class="w-full bg-navbar text-white rounded px-2 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<div class="col-span-2">
					<input
						type="number"
						bind:value={newQuantity}
						placeholder="Qty"
						class="w-full bg-navbar text-white rounded px-2 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<div class="col-span-2">
					<input
						type="text"
						bind:value={newUnit}
						placeholder="Unit"
						list="preset-unit-suggestions"
						class="w-full bg-navbar text-white rounded px-2 py-1 text-sm placeholder-gray2"
					/>
				</div>
				<div class="col-span-2">
					<button
						type="button"
						on:click={addPreset}
						disabled={!newName}
						class="w-full bg-lime text-black text-xs font-bold rounded py-1 disabled:opacity-50"
					>
						ADD
					</button>
				</div>
			</div>

			<!-- Existing Presets List -->
			<div class="max-h-[50vh] overflow-y-auto custom-scroll space-y-2">
				{#if loading}
					<p class="text-gray2">Loading...</p>
				{:else if filteredPresets.length === 0}
					<p class="text-gray2">No presets found for this category.</p>
				{:else}
					<!-- Header -->
					<div class="grid grid-cols-12 gap-2 text-gray2 text-xs uppercase px-2">
						<div class="col-span-4">Name</div>
						<div class="col-span-2">Price</div>
						<div class="col-span-2">Qty</div>
						<div class="col-span-2">Unit</div>
						<div class="col-span-2"></div>
					</div>
					<!-- Items -->
					{#each filteredPresets as preset (preset.id)}
						<div class="grid grid-cols-12 gap-2 items-center bg-navbar p-2 rounded-lg">
							{#if editStates[preset.id]}
								<input
									type="text"
									bind:value={preset.name}
									class="col-span-4 bg-gray1 text-white rounded px-2 py-1 text-sm"
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
									class="col-span-2 bg-gray1 text-white rounded px-2 py-1 text-sm"
								/>
								<input
									type="text"
									bind:value={preset.unit}
									placeholder="Unit"
									list="preset-unit-suggestions"
									class="col-span-2 bg-gray1 text-white rounded px-2 py-1 text-sm"
								/>
								<div class="col-span-2 flex justify-end gap-1">
									<button
										type="button"
										on:click={() => updatePreset(preset)}
										class="text-lime text-xs font-bold"
									>
										SAVE
									</button>
									<button
										type="button"
										on:click={() => (editStates[preset.id] = false)}
										class="text-gray2 text-xs"
									>
										CANCEL
									</button>
								</div>
							{:else}
								<span class="col-span-4 text-white truncate">{preset.name}</span>
								<span class="col-span-2 text-white">${preset.price}</span>
								<span class="col-span-2 text-white">{preset.quantity}</span>
								<span class="col-span-2 text-white">{preset.unit}</span>
								<div class="col-span-2 flex justify-end gap-2">
									<button
										type="button"
										on:click={() => (editStates[preset.id] = true)}
										class="text-gray2 hover:text-lime text-xs"
									>
										EDIT
									</button>
									<button
										type="button"
										on:click={() => deletePreset(preset.id)}
										class="text-gray2 hover:text-red-500 text-xs"
									>
										DEL
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</Modal>

<!-- Datalist for Unit suggestions -->
<datalist id="preset-unit-suggestions">
	<option value="Item"></option>
	<option value="Hour"></option>
	<option value="Day"></option>
</datalist>

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