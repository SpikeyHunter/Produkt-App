<script context="module" lang="ts">
	export interface MerchItem {
		id: string;
		name: string;
		price: number;
		qty: Record<string, number>;
		finals: Record<string, number>;
		sales: Record<string, number>;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Button from '$lib/components/buttons/Button.svelte';
	import MerchSummary from './MerchSummary.svelte';
	import { portal } from '$lib/utils/portalUtils';

	export let settlementId: number;
	const dispatch = createEventDispatcher();

	let settlement: any = null;
	let loading = true;
	let items: MerchItem[] = [];
	let channel: any;
	let saveDebounce: any;

	let itemToDelete: string | null = null;

	onMount(() => {
		loadSettlement();
		setupRealtime();
	});

	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
		if (saveDebounce) clearTimeout(saveDebounce);
	});

	async function loadSettlement() {
		loading = true;
		const { data } = await supabase
			.from('merch_settlements')
			.select('*')
			.eq('id', settlementId)
			.single();
		if (data) {
			settlement = data;
			items = data.items || [];
		}
		loading = false;
	}

	function setupRealtime() {
		channel = supabase
			.channel(`merch_${settlementId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'merch_settlements',
					filter: `id=eq.${settlementId}`
				},
				(payload) => {
					if (!saveDebounce) {
						settlement = payload.new;
						items = payload.new.items || [];
					}
				}
			)
			.subscribe();
	}

	function saveToDb() {
		if (saveDebounce) clearTimeout(saveDebounce);
		saveDebounce = setTimeout(async () => {
			// Clean up any legacy error properties from DB just in case
			const cleanItems = items.map((item) => {
				const { _errorSize, _errors, ...rest } = item as any;
				return rest;
			});
			await supabase
				.from('merch_settlements')
				.update({ items: cleanItems, input_mode: settlement.input_mode })
				.eq('id', settlementId);
			saveDebounce = null;
			dispatch('saved');
		}, 800);
	}

	function toggleInputMode() {
		settlement.input_mode = settlement.input_mode === 'final' ? 'sold' : 'final';
		saveToDb();
	}

	function addItem() {
		const newItem: MerchItem = {
			id: crypto.randomUUID(),
			name: '',
			price: 0,
			qty: {},
			finals: {},
			sales: {}
		};
		settlement.sizes.forEach((s: string) => {
			newItem.qty[s] = 0;
			newItem.finals[s] = 0;
			newItem.sales[s] = 0;
		});
		items = [...items, newItem];
		saveToDb();
	}

	function confirmDeleteItem() {
		if (itemToDelete) {
			items = items.filter((i) => i.id !== itemToDelete);
			itemToDelete = null;
			saveToDb();
		}
	}

	function updateCell(itemIdx: number, size: string, field: 'qty' | 'finals' | 'sales', e: Event) {
		const inputEl = e.currentTarget as HTMLInputElement;
		
		const isEmpty = inputEl.value === '';
		let val = isEmpty ? 0 : parseInt(inputEl.value);

		if (isNaN(val)) val = 0;

		const item = items[itemIdx];
		item[field][size] = val; // Store exactly what they typed

		// Recalculate dependent cell based on strict mode math
		if (field === 'qty') {
			if (settlement.input_mode === 'final') {
				item.sales[size] = item.qty[size] - item.finals[size];
			} else if (settlement.input_mode === 'sold') {
				item.finals[size] = item.qty[size] - item.sales[size];
			}
		} else if (field === 'finals' && settlement.input_mode === 'final') {
			item.sales[size] = item.qty[size] - val;
		} else if (field === 'sales' && settlement.input_mode === 'sold') {
			item.finals[size] = item.qty[size] - val;
		}

		// Re-trigger Svelte reactivity
		items = items;
		saveToDb();
	}

	$: currencySym = settlement?.currency === 'EUR' ? '€' : '$';

	function getItemSalesTotal(item: MerchItem) {
		let totalItemsSold = Object.values(item.sales).reduce((a, b) => a + (Number(b) || 0), 0);
		return totalItemsSold * (Number(item.price) || 0);
	}

	$: grandTotal = items.reduce((sum, item) => sum + getItemSalesTotal(item), 0);
	$: venueCut = grandTotal * ((settlement?.venue_cut_pct || 0) / 100);
	$: balance = grandTotal - venueCut - (settlement?.seller_rate || 0);
</script>

<div class="h-full flex gap-4 overflow-hidden">
	<div class="flex-1 bg-navbar rounded-3xl flex flex-col overflow-hidden">
		{#if loading}
			<div
				class="m-auto w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin"
			></div>
		{:else}
			<div class="p-5 border-b border-gray2/20 flex justify-between items-center bg-gray1/50">
				<h2 class="text-white font-bold text-lg">{settlement.event_name}</h2>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-1 bg-gray1 rounded-full p-1">
						<button
							on:click={toggleInputMode}
							class="px-5 py-2 text-sm font-bold rounded-full transition-colors cursor-pointer {settlement.input_mode ===
							'final'
								? 'bg-lime text-black'
								: 'text-gray2 hover:text-white'}">Final Quantities</button
						>
						<button
							on:click={toggleInputMode}
							class="px-5 py-2 text-sm font-bold rounded-full transition-colors cursor-pointer {settlement.input_mode ===
							'sold'
								? 'bg-lime text-black'
								: 'text-gray2 hover:text-white'}">Sold Items</button
						>
					</div>
					<button
						on:click={addItem}
						class="px-5 py-2 text-sm font-bold rounded-full bg-gray3 text-black hover:bg-lime hover:text-black transition-colors cursor-pointer"
						>+ Add Item</button
					>
				</div>
			</div>

			<div class="flex-1 overflow-auto custom-scroll p-4">
				<table class="w-full text-left border-collapse">
					<thead>
						<tr>
							<th class="p-3 border-b border-gray2/20 text-gray3 font-bold uppercase text-xs"
								>Item & Price</th
							>
							<th class="p-3 border-b border-gray2/20 text-gray3 font-bold uppercase text-xs w-20"
								>Type</th
							>
							{#each settlement.sizes as size}
								<th
									class="p-3 border-b border-gray2/20 text-center text-gray3 font-bold text-xs w-16"
									>{size}</th
								>
							{/each}
							<th class="p-3 border-b border-gray2/20 w-12"></th>
						</tr>
					</thead>
					<tbody>
						{#each items as item, i}
							<tr class="border-b border-gray2/10">
								<td class="p-3 align-top pt-5">
									<input
										type="text"
										placeholder="Item Name"
										bind:value={item.name}
										on:input={saveToDb}
										class="w-full bg-gray1 rounded-3xl text-sm px-4 py-1 text-white font-bold mb-2 placeholder-gray2"
									/>
									<div class="flex items-center text-lime text-sm">
										<p>Price {currencySym}</p>
										<input
											type="number"
											step="0.01"
											placeholder="0.00"
											bind:value={item.price}
											on:input={saveToDb}
											class="w-24 bg-gray1 px-4 py-1 rounded-3xl ml-3 font-bold"
										/>
									</div>
								</td>
								<td class="p-3 align-top pt-5 space-y-3">
									<div class="text-xs text-gray2 font-bold h-8 flex items-center">QTY</div>
									<div
										class="text-xs font-bold h-8 flex items-center {settlement.input_mode ===
										'final'
											? 'text-lime'
											: 'text-gray2'}"
									>
										FINALS
									</div>
									<div
										class="text-xs font-bold h-8 flex items-center {settlement.input_mode === 'sold'
											? 'text-lime'
											: 'text-gray2'}"
									>
										SALES
									</div>
								</td>
								{#each settlement.sizes as size}
									{@const hasError = item.qty[size] < 0 || item.finals[size] < 0 || item.sales[size] < 0}

									<td class="p-3 align-top pt-5 space-y-3 text-center">
										<input
											type="number"
											value={item.qty[size]}
											on:change={(e) => updateCell(i, size, 'qty', e)}
											on:focus={(e) => { if(e.currentTarget.value === '0') e.currentTarget.value = ''; else e.currentTarget.select(); }}
											on:blur={(e) => { if(e.currentTarget.value === '') e.currentTarget.value = '0'; updateCell(i, size, 'qty', e); }}
											class="w-full text-center bg-gray1 {hasError ? 'border-2 border-problem focus:border-problem text-problem' : ''} rounded-lg px-1 h-8 text-xs text-white outline-none transition-colors"
										/>

										{#if settlement.input_mode === 'final'}
											<input
												type="number"
												value={item.finals[size]}
												on:change={(e) => updateCell(i, size, 'finals', e)}
												on:focus={(e) => { if(e.currentTarget.value === '0') e.currentTarget.value = ''; else e.currentTarget.select(); }}
												on:blur={(e) => { if(e.currentTarget.value === '') e.currentTarget.value = '0'; updateCell(i, size, 'finals', e); }}
												class="w-full text-center bg-gray1 {hasError ? 'border-2 border-problem focus:border-problem text-problem' : 'bg-lime/10 text-lime'} rounded-lg px-1 h-8 text-xs outline-none transition-colors"
											/>
										{:else}
											<div
												class="h-8 text-xs flex items-center justify-center font-medium bg-gray1/20 border border-transparent rounded-lg {hasError ? 'text-problem border-problem' : 'text-gray2'}"
											>
												{item.finals[size]}
											</div>
										{/if}

										{#if settlement.input_mode === 'sold'}
											<input
												type="number"
												value={item.sales[size]}
												on:change={(e) => updateCell(i, size, 'sales', e)}
												on:focus={(e) => { if(e.currentTarget.value === '0') e.currentTarget.value = ''; else e.currentTarget.select(); }}
												on:blur={(e) => { if(e.currentTarget.value === '') e.currentTarget.value = '0'; updateCell(i, size, 'sales', e); }}
												class="w-full text-center bg-gray1 {hasError ? 'border-2 border-problem focus:border-problem text-problem' : 'bg-lime/10 text-lime'} rounded-lg px-1 h-8 text-xs outline-none transition-colors"
											/>
										{:else}
											<div
												class="h-8 text-xs flex items-center justify-center font-medium bg-gray1/20 border border-transparent rounded-lg {hasError ? 'text-problem border-problem' : 'text-gray2'}"
											>
												{item.sales[size]}
											</div>
										{/if}
									</td>
								{/each}
								<td class="p-3 align-middle text-center">
									<button
										type="button"
										class="p-2 text-gray2 hover:text-problem hover:bg-problem/10 rounded-full transition-colors cursor-pointer"
										on:click={() => (itemToDelete = item.id)}
										aria-label="Delete item"
									>
										<svg
											class="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><path
												d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/></svg
										>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if items.length === 0}
					<div class="text-center text-gray2 py-16 m-4">
						<p class="font-bold text-lg mb-2">No items added yet.</p>
						<p class="text-sm">Click "+ Add Item" to start your settlement.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<MerchSummary {items} {settlement} {grandTotal} {venueCut} {balance} {currencySym} />
</div>

{#if itemToDelete}
	<div
		use:portal
		class="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="absolute inset-0 bg-black/70 backdrop-blur-md"
			on:click={() => (itemToDelete = null)}
			role="button"
			tabindex="-1"
			on:keypress={(e) => e.key === 'Escape' && (itemToDelete = null)}
			aria-label="Close modal"
		></div>
		<div
			class="relative bg-navbar border border-gray2/20 rounded-3xl w-full max-w-sm shadow-2xl p-6"
		>
			<h3 class="text-xl font-bold text-white mb-2 border-b border-gray1 py-3">Delete Item</h3>
			<p class="text-gray2 mb-2">Are you sure you want to delete this item?</p>
			<p class="text-gray2 mb-6">This action cannot be undone.</p>
			<div class="flex gap-3 justify-end">
				<button
					type="button"
					class="px-6 py-2.5 bg-gray3 text-black font-bold rounded-full hover:bg-gray2 transition-colors cursor-pointer"
					on:click={() => (itemToDelete = null)}
				>
					Cancel
				</button>

				<button
					type="button"
					class="px-6 py-2.5 bg-problem text-black font-bold rounded-full hover:bg-problem/80 transition-colors cursor-pointer"
					on:click={confirmDeleteItem}
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>