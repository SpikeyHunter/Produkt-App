<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { MerchData, MerchDefaultItem, MerchCountItem } from '$lib/types/tour';
	import TextArea from '../ui/TextArea.svelte';
	import Toggle from '../ui/Toggle.svelte';

	export let data: MerchData = {};
	export let merchDefaults: MerchDefaultItem[] = []; // from Settings

	const dispatch = createEventDispatcher();

	const money = (n: number) =>
		n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

	const numColor = (n: number) => (n < 0 ? 'text-problem' : n > 0 ? 'text-confirmed' : 'text-gray3');

	// ---------- size logic (template-driven; not user-editable) ----------
	const SIZE_ORDER = ['ALL', 'S', 'M', 'L', 'XL', '2XL'];

	function itemKeys(c: MerchCountItem): string[] {
		return [...new Set([...Object.keys(c.in || {}), ...Object.keys(c.out || {})])];
	}
	function hasSize(c: MerchCountItem, s: string): boolean {
		return !!(c.in && s in c.in) || !!(c.out && s in c.out);
	}

	$: columns = (() => {
		const set = new Set<string>();
		for (const c of data.counts || []) for (const s of itemKeys(c)) set.add(s);
		const ordered = SIZE_ORDER.filter((s) => set.has(s));
		const extra = [...set].filter((s) => !SIZE_ORDER.includes(s));
		return [...ordered, ...extra];
	})();

	// One-time migration: fold legacy flat qty_in/qty_out into an 'ALL' column.
	let migrated = false;
	$: if (!migrated && data?.counts) {
		for (const c of data.counts) {
			if (!c.in && !c.out && (c.qty_in != null || c.qty_out != null)) {
				c.in = { ALL: c.qty_in || 0 };
				c.out = { ALL: c.qty_out || 0 };
			}
		}
		migrated = true;
	}

	// ---------- totals ----------
	const soldOf = (c: MerchCountItem, s: string) => (c.in?.[s] || 0) - (c.out?.[s] || 0);
	const itemSold = (c: MerchCountItem) => itemKeys(c).reduce((n, s) => n + soldOf(c, s), 0);
	const itemGross = (c: MerchCountItem) => itemSold(c) * (c.price || 0);
	const computeGross = () => (data.counts || []).reduce((s, c) => s + itemGross(c), 0);
	const computeNet = () => {
		const g = computeGross();
		return g - g * ((data.venue_pct || 0) / 100) - (Number(data.seller_rate) || 0);
	};

	$: gross = computeGross();
	$: venueCut = gross * ((data.venue_pct || 0) / 100);
	$: net = gross - venueCut - (Number(data.seller_rate) || 0);

	// Realtime link to Show Budget (also pulls live from tourData.merch on that side).
	const changed = () => {
		data = { ...data };
		dispatch('change', { merchNet: data.enabled ? computeNet() : 0, enabled: !!data.enabled });
	};

	// ---------- items ----------
	function loadDefaults() {
		data.counts = merchDefaults.map((m) => {
			const itemSizes = m.sizes && m.sizes.length ? m.sizes : ['ALL'];
			const inMap: Record<string, number> = {};
			const outMap: Record<string, number> = {};
			for (const s of itemSizes) {
				inMap[s] = 0;
				outMap[s] = 0;
			}
			return { item: m.name, price: m.price, in: inMap, out: outMap };
		});
		changed();
	}
	function addItem() {
		const cols = columns.length ? columns : ['ALL'];
		const inMap: Record<string, number> = {};
		const outMap: Record<string, number> = {};
		for (const s of cols) {
			inMap[s] = 0;
			outMap[s] = 0;
		}
		data.counts = [...(data.counts || []), { item: '', price: 0, in: inMap, out: outMap }];
		changed();
	}
	function removeItem(i: number) {
		data.counts = (data.counts || []).filter((_, idx) => idx !== i);
		changed();
	}
	function setCell(c: MerchCountItem, size: string, field: 'in' | 'out', e: Event) {
		const el = e.target as HTMLInputElement;
		const v = el.value === '' ? 0 : parseInt(el.value, 10);
		if (!c[field]) c[field] = {};
		(c[field] as Record<string, number>)[size] = isNaN(v) ? 0 : v;
		changed();
	}

	// ---------- per-section reset (Reset → Are you sure? → Confirm) ----------
	type Section = 'delivery' | 'counts';
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];
	let resetStage: Record<Section, 0 | 1 | 2> = { delivery: 0, counts: 0 };
	let resetTimers: Partial<Record<Section, ReturnType<typeof setTimeout>>> = {};

	function clickReset(section: Section, clear: () => void) {
		clearTimeout(resetTimers[section]);
		if (resetStage[section] < 2) {
			resetStage = { ...resetStage, [section]: (resetStage[section] + 1) as 0 | 1 | 2 };
			resetTimers[section] = setTimeout(() => (resetStage = { ...resetStage, [section]: 0 }), 4000);
			return;
		}
		resetStage = { ...resetStage, [section]: 0 };
		clear();
	}

	const resetDelivery = () => { data.delivery_restrictions = ''; data.tracking_info = ''; changed(); };
	const resetCounts = () => { data.counts = []; changed(); };

	const resetClass = (s: Section) =>
		`cursor-pointer px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
			resetStage[s] === 0
				? 'border-gray3/40 text-gray3 hover:border-problem hover:text-problem'
				: resetStage[s] === 1
					? 'border-problem/60 text-problem'
					: 'border-problem bg-problem text-black'
		}`;

	onDestroy(() => Object.values(resetTimers).forEach((t) => clearTimeout(t)));

	const fieldCls =
		'w-full bg-gray1 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60 transition-colors';
	const cellCls =
		'no-spin w-full text-center bg-gray1 rounded-full px-1 h-7 text-xs text-white outline-none border border-transparent focus:border-lime/60 transition-colors';
</script>

<div class="space-y-4">
	<div class="flex flex-wrap gap-8">
		<Toggle label="Merch on this show" checked={data.enabled} on:change={(e) => { data.enabled = e.detail; changed(); }} />
		{#if data.enabled}
			<Toggle label="Merch delivery" checked={data.delivery ?? false} on:change={(e) => { data.delivery = e.detail; changed(); }} />
		{/if}
	</div>

	{#if data.enabled}
		{#if data.delivery}
			<div>
				<div class="flex items-center justify-between mb-1.5">
					<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Delivery</span>
					<button type="button" class={resetClass('delivery')} on:click={() => clickReset('delivery', resetDelivery)}>{RESET_LABELS[resetStage.delivery]}</button>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					<TextArea label="Delivery Restrictions" bind:value={data.delivery_restrictions} rows={2} on:change={changed} />
					<TextArea label="Tracking Info" bind:value={data.tracking_info} rows={2} on:change={changed} />
				</div>
			</div>
		{/if}

		<!-- Seller fields (no section header) -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1">Seller Name</span>
				<input class={fieldCls} bind:value={data.seller_name} on:input={changed} />
			</label>
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1">Seller Email / Phone</span>
				<input class={fieldCls} bind:value={data.seller_contact} on:input={changed} />
			</label>
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1">Seller Rate (USD$)</span>
				<input type="number" class="{fieldCls} no-spin" bind:value={data.seller_rate} on:input={changed} />
			</label>
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1">Venue %</span>
				<input type="number" class="{fieldCls} no-spin" bind:value={data.venue_pct} on:input={changed} />
			</label>
		</div>

		<!-- Counts -->
		<div>
			<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
				<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Counts — Settlement</span>
				<div class="flex items-center gap-3">
					<button type="button" class={resetClass('counts')} on:click={() => clickReset('counts', resetCounts)}>{RESET_LABELS[resetStage.counts]}</button>
					{#if !(data.counts || []).length && merchDefaults.length}
						<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadDefaults}>Load default items</button>
					{/if}
					<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addItem}>+ Add item</button>
				</div>
			</div>

			{#if (data.counts || []).length}
				<div class="overflow-x-auto custom-scroll">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr>
								<th class="p-1.5 border-b border-gray2/20 text-gray3 font-bold uppercase text-xs min-w-[190px]">Item &amp; Price</th>
								<th class="p-1.5 border-b border-gray2/20 text-gray3 font-bold uppercase text-xs w-14"></th>
								{#each columns as size}
									<th class="p-1.5 border-b border-gray2/20 text-center text-gray3 font-bold text-xs min-w-[5rem]">{size}</th>
								{/each}
								<th class="p-1.5 border-b border-gray2/20 w-9"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.counts || [] as c, i (i)}
								<tr class="border-b border-gray2/10">
									<!-- item + price -->
									<td class="p-1.5 align-top pt-3">
										<input type="text" placeholder="Item Name" bind:value={c.item} on:input={changed} class="w-full bg-gray1 rounded-full text-sm px-3 py-1 text-white font-bold mb-1.5 placeholder-gray2 outline-none" />
										<div class="flex items-center justify-end text-lime text-sm">
											<span class="whitespace-nowrap">Price $</span>
											<input type="number" step="0.01" placeholder="0.00" bind:value={c.price} on:input={changed} class="no-spin w-20 bg-gray1 px-3 py-1 rounded-full ml-2 font-bold outline-none" />
										</div>
									</td>

									<!-- row labels -->
									<td class="p-1.5 align-top pt-3 space-y-1.5">
										<div class="text-[11px] font-bold text-gray2 h-7 flex items-center">IN</div>
										<div class="text-[11px] font-bold text-gray2 h-7 flex items-center">OUT</div>
										<div class="text-[11px] font-bold text-gray2 h-7 flex items-center">SOLD</div>
										<div class="text-[11px] font-bold text-gray2 h-7 flex items-center">GROSS</div>
									</td>

									<!-- per-size cells -->
									{#each columns as size}
										<td class="p-1.5 align-top pt-3 space-y-1.5 text-center">
											{#if hasSize(c, size)}
												{@const sold = soldOf(c, size)}
												{@const sizeGross = sold * (c.price || 0)}
												<input
													type="number"
													value={c.in?.[size] ?? 0}
													on:change={(e) => setCell(c, size, 'in', e)}
													on:focus={(e) => { if (e.currentTarget.value === '0') e.currentTarget.value = ''; else e.currentTarget.select(); }}
													on:blur={(e) => { if (e.currentTarget.value === '') e.currentTarget.value = '0'; setCell(c, size, 'in', e); }}
													class={cellCls}
												/>
												<input
													type="number"
													value={c.out?.[size] ?? 0}
													on:change={(e) => setCell(c, size, 'out', e)}
													on:focus={(e) => { if (e.currentTarget.value === '0') e.currentTarget.value = ''; else e.currentTarget.select(); }}
													on:blur={(e) => { if (e.currentTarget.value === '') e.currentTarget.value = '0'; setCell(c, size, 'out', e); }}
													class={cellCls}
												/>
												<div class="h-7 flex items-center justify-center text-xs font-bold font-mono {numColor(sold)}">{sold}</div>
												<div class="h-7 flex items-center justify-center text-xs font-bold font-mono {numColor(sizeGross)}">{money(sizeGross)}</div>
											{:else}
												<div class="h-7 flex items-center justify-center text-gray2/30">—</div>
												<div class="h-7 flex items-center justify-center text-gray2/30">—</div>
												<div class="h-7 flex items-center justify-center text-gray2/30">—</div>
												<div class="h-7 flex items-center justify-center text-gray2/30">—</div>
											{/if}
										</td>
									{/each}

									<td class="p-1.5 align-middle text-center">
										<button type="button" class="p-1.5 text-gray2 hover:text-problem hover:bg-problem/10 rounded-full transition-colors cursor-pointer" on:click={() => removeItem(i)} aria-label="Delete item">
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="text-xs text-gray2 italic py-3">No items yet — load defaults or add an item.</p>
			{/if}

			<!-- settlement totals (live → Show Budget when merch is on) -->
			<div class="border-t border-gray1 mt-3 pt-2 space-y-1 text-sm max-w-sm ml-auto">
				<div class="flex justify-between text-gray2"><span>Gross</span><span class="font-mono {numColor(gross)}">{money(gross)}</span></div>
				<div class="flex justify-between text-gray2"><span>Venue ({data.venue_pct || 0}%)</span><span class="font-mono">-{money(venueCut)}</span></div>
				<div class="flex justify-between text-gray2"><span>Seller rate</span><span class="font-mono">-{money(Number(data.seller_rate) || 0)}</span></div>
				<div class="flex justify-between font-bold"><span class="text-white">Net Revenue</span><span class="font-mono {numColor(net)}">{money(net)}</span></div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		height: 6px;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: transparent;
	}
	.no-spin::-webkit-inner-spin-button,
	.no-spin::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.no-spin {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>