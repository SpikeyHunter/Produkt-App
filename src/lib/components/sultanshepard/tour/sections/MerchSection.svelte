<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { MerchData, MerchDefaultItem } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';
	import Toggle from '../ui/Toggle.svelte';

	export let data: MerchData = {};
	export let merchDefaults: MerchDefaultItem[] = []; // from Settings

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

	function loadDefaults() {
		data.counts = merchDefaults.map((m) => ({ item: m.name, price: m.price, qty_in: 0, qty_out: 0 }));
		changed();
	}
	function addItem() {
		data.counts = [...(data.counts || []), { item: '', price: 0, qty_in: 0, qty_out: 0 }];
		changed();
	}
	function removeItem(i: number) {
		data.counts = (data.counts || []).filter((_, idx) => idx !== i);
		changed();
	}

	$: gross = (data.counts || []).reduce((s, c) => s + Math.max(0, (c.qty_in || 0) - (c.qty_out || 0)) * (c.price || 0), 0);
	$: venueCut = gross * ((data.venue_pct || 0) / 100);
	$: net = gross - venueCut - (Number(data.seller_rate) || 0);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap gap-8">
		<Toggle label="Merch on this show" checked={data.enabled} on:change={(e) => { data.enabled = e.detail; changed(); }} />
		{#if data.enabled}
			<Toggle label="Merch delivery" checked={data.delivery ?? false} on:change={(e) => { data.delivery = e.detail; changed(); }} />
		{/if}
	</div>

	{#if data.enabled}
		{#if data.delivery}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<TextArea label="Delivery Restrictions" bind:value={data.delivery_restrictions} rows={2} on:change={changed} />
				<TextArea label="Tracking Info" bind:value={data.tracking_info} rows={2} on:change={changed} />
			</div>
		{/if}

		<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
			<Field label="Seller Name" bind:value={data.seller_name} on:change={changed} />
			<Field label="Seller Email / Phone" bind:value={data.seller_contact} on:change={changed} />
			<Field label="Seller Rate (USD → budget)" type="number" bind:value={data.seller_rate} on:change={changed} />
			<Field label="Venue %" type="number" bind:value={data.venue_pct} on:change={changed} />
		</div>

		<!-- Settlement -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Counts — Settlement</span>
				<div class="flex gap-3">
					{#if !(data.counts || []).length && merchDefaults.length}
						<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadDefaults}>Load default items</button>
					{/if}
					<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addItem}>+ Add item</button>
				</div>
			</div>

			<div class="hidden md:grid grid-cols-[1fr_100px_90px_90px_90px_90px_auto] gap-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray2">
				<span>Item</span><span>Price</span><span>Qty In</span><span>Qty Out</span><span>Sold</span><span>Gross</span><span></span>
			</div>
			<div class="space-y-1.5">
				{#each data.counts || [] as c, i}
					{@const sold = Math.max(0, (c.qty_in || 0) - (c.qty_out || 0))}
					<div class="grid grid-cols-2 md:grid-cols-[1fr_100px_90px_90px_90px_90px_auto] gap-2 items-center">
						<Field small bind:value={c.item} placeholder="Item" on:change={changed} />
						<Field small type="number" bind:value={c.price} on:change={changed} />
						<Field small type="number" bind:value={c.qty_in} on:change={changed} />
						<Field small type="number" bind:value={c.qty_out} on:change={changed} />
						<span class="text-sm text-gray3 font-mono px-1">{sold}</span>
						<span class="text-sm text-gray3 font-mono px-1">{money(sold * (c.price || 0))}</span>
						<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeItem(i)}>✕</button>
					</div>
				{/each}
			</div>

			<div class="border-t border-gray1 mt-4 pt-3 space-y-1 text-sm max-w-sm ml-auto">
				<div class="flex justify-between text-gray2"><span>Gross</span><span class="font-mono">{money(gross)}</span></div>
				<div class="flex justify-between text-gray2"><span>Venue ({data.venue_pct || 0}%)</span><span class="font-mono">-{money(venueCut)}</span></div>
				<div class="flex justify-between text-gray2"><span>Seller rate</span><span class="font-mono">-{money(Number(data.seller_rate) || 0)}</span></div>
				<div class="flex justify-between font-bold"><span class="text-white">Net (→ Show Budget)</span><span class="font-mono text-confirmed">{money(net)}</span></div>
			</div>
		</div>
	{/if}
</div>
