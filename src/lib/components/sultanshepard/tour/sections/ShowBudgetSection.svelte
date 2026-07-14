<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { SSTourData, SSCrew, BudgetLine, ExpenseUnit } from '$lib/types/tour';
	import { crewSalaryUsd, DEFAULT_USD_CAD_RATE } from '$lib/types/tour';
	import { getUsdCadRate } from '$lib/services/tourService';

	export let data: SSTourData['show_budget'] = {};
	export let tourData: SSTourData; // for live links (crew assigned in Event Details, merch…)
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	// Fixed USD/CAD rate — loaded once. Crew salaries stored in CAD are converted
	// to USD for display/totals via crewSalaryUsd(); USD salaries pass through.
	let usdCadRate = DEFAULT_USD_CAD_RATE;

	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// ============================================================
	// STAGEHANDS — linked live to the Production tab
	// ============================================================
	const STAGEHANDS_LABEL = 'Local / Stage Hands';
	const isStagehandsLine = (e: BudgetLine) =>
		(e as any).linked === 'production_stagehands' ||
		e.label === 'Local/Stage Hands' ||
		e.label === STAGEHANDS_LABEL;

	$: stagehandsRate = Number(tourData?.production?.stagehands_rate_total) || 0;
	$: hasStagehands = stagehandsRate > 0;

	function setStagehandsRate(amount: number) {
		const amt = Number(amount) || 0;
		if (!tourData.production) tourData.production = {} as any;
		tourData.production.stagehands_rate_total = amt > 0 ? amt : undefined;
		tourData.production = { ...tourData.production };
		changed();
	}
	function clearStagehands() {
		setStagehandsRate(0);
	}

	onMount(() => {
		getUsdCadRate()
			.then((r) => (usdCadRate = r))
			.catch(() => {});
		const list = data.other_expenses || [];
		const idx = list.findIndex(isStagehandsLine);
		if (idx < 0) return;
		const legacyAmt = Number(list[idx].amount) || 0;
		if (!(Number(tourData?.production?.stagehands_rate_total) > 0) && legacyAmt > 0) {
			if (!tourData.production) tourData.production = {} as any;
			tourData.production.stagehands_rate_total = legacyAmt;
			tourData.production = { ...tourData.production };
		}
		list.splice(idx, 1);
		data.other_expenses = [...list];
		changed();
	});

	function stagehandsPriceInit(node: HTMLInputElement, rate: number) {
		node.value = fmtPrice(rate);
		return {
			update(r: number) {
				if (document.activeElement !== node) node.value = fmtPrice(r);
			}
		};
	}
	function onStagehandsPriceInput(node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
		const amt = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
		setStagehandsRate(amt);
	}
	function onStagehandsPriceBlur(node: HTMLInputElement) {
		node.value = fmtPrice(stagehandsRate);
	}

	const money = (n: number) =>
		'USD$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

	const addButtonCls =
		'cursor-pointer px-3 py-1 rounded-full bg-lime text-black text-xs font-bold hover:brightness-110 transition-all';

	// ============================================================
	// CREW (linked live from Event Details → ss_crew salaries)
	// ============================================================
	const CREW_TYPE_ORDER: Record<string, number> = { artist: 0, management: 1, prod: 2, singer: 3, media: 4 };
	const CREW_TYPE_LABEL: Record<string, string> = {
		artist: 'Artist', management: 'Management', prod: 'Production', singer: 'Singer', media: 'Media'
	};

	$: assignedCrew = (tourData?.event_details?.crew_ids || [])
		.map((id) => crew.find((c) => c.id === id))
		.filter((c): c is SSCrew => !!c)
		.sort(
			(a, b) =>
				(CREW_TYPE_ORDER[a.crew_type] ?? 9) - (CREW_TYPE_ORDER[b.crew_type] ?? 9) ||
				(a.sort_order ?? 0) - (b.sort_order ?? 0) ||
				a.name.localeCompare(b.name)
		);

	$: crewTotal = assignedCrew.reduce((s, c) => s + crewSalaryUsd(c, usdCadRate), 0);

	// ============================================================
	// LOGISTICS EXPENSES — coming soon (display only)
	// ============================================================
	const LOGISTICS_LINES: { key: string; label: string }[] = [
		{ key: 'flights', label: 'Flights' },
		{ key: 'hotels', label: 'Hotels' },
		{ key: 'per_diem', label: 'Per Diem' },
		{ key: 'transports', label: 'Transports' }
	];

	// ============================================================
	// OTHER EXPENSES
	// ============================================================
	const UNIT_OPTIONS: { value: ExpenseUnit; label: string }[] = [
		{ value: 'item', label: 'Item' },
		{ value: 'hour', label: 'Hour' },
		{ value: 'day', label: 'Day' }
	];

	const lineTotal = (e: BudgetLine) => (Number(e.amount) || 0) * (Number(e.qty) || 0);
	const fmtPrice = (n: number | undefined) => (Number(n) || 0).toFixed(2);

	function priceInit(node: HTMLInputElement, item: BudgetLine) {
		node.value = fmtPrice(item.amount);
		return {
			update(it: BudgetLine) {
				if (document.activeElement !== node) node.value = fmtPrice(it.amount);
			}
		};
	}
	function onPriceInput(e: BudgetLine, node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
		e.amount = cleaned === '' || cleaned === '.' ? 0 : Number(cleaned);
		changed();
	}
	function onPriceBlur(e: BudgetLine, node: HTMLInputElement) {
		node.value = fmtPrice(e.amount);
		changed();
	}
	function onQtyInput(e: BudgetLine, node: HTMLInputElement) {
		const v = node.value.replace(/[^0-9]/g, '');
		e.qty = v === '' ? undefined : Number(v);
		changed();
	}

	function addExpense() {
		data.other_expenses = [
			...(data.other_expenses || []),
			{ id: uid(), label: '', amount: 0, qty: 1, unit: 'item', enabled: true }
		];
		changed();
	}
	function removeExpense(id: string) {
		data.other_expenses = (data.other_expenses || []).filter((e) => e.id !== id);
		changed();
	}
	function setUnit(e: BudgetLine, value: string) {
		e.unit = value as ExpenseUnit;
		changed();
	}

	// ============================================================
	// REVENUE — Merch, linked LIVE from the Merch tab (tourData.merch).
	// Only counts when "Merch on this show" is toggled on; respects an explicit
	// merch_revenue_override, otherwise uses the live net (gross − venue − seller).
	// ============================================================
	const numColor = (n: number) => (n < 0 ? 'text-problem' : n > 0 ? 'text-confirmed' : 'text-gray3');

	function mItemSold(c: any): number {
		if (!c.in && !c.out) return (Number(c.qty_in) || 0) - (Number(c.qty_out) || 0); // legacy
		const keys = new Set<string>([...Object.keys(c.in || {}), ...Object.keys(c.out || {})]);
		let n = 0;
		for (const s of keys) n += (c.in?.[s] || 0) - (c.out?.[s] || 0);
		return n;
	}

	$: merch = tourData?.merch ?? ({} as any);
	$: merchEnabled = !!merch.enabled;
	$: merchGross = (merch.counts || []).reduce(
		(s: number, c: any) => s + mItemSold(c) * (Number(c.price) || 0),
		0
	);
	$: merchVenueCut = merchGross * ((Number(merch.venue_pct) || 0) / 100);
	$: merchSellerRate = Number(merch.seller_rate) || 0;
	$: merchLiveNet = merchGross - merchVenueCut - merchSellerRate;
	$: merchNet = merchEnabled
		? data.merch_revenue_override != null
			? Number(data.merch_revenue_override)
			: merchLiveNet
		: 0;

	$: revenueTotal = merchNet;

	// ============================================================
	// TOTALS
	// ============================================================
	$: freeExpenses = (data.other_expenses || []).filter((e) => !isStagehandsLine(e));
	$: otherTotal = freeExpenses.reduce((s, e) => s + lineTotal(e), 0);
	$: otherSectionTotal = otherTotal + stagehandsRate;
	$: totalExpenses = crewTotal + otherSectionTotal;

	const inputCls =
		'w-full bg-gray1 rounded-full px-3 h-7 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors';
</script>

<div class="space-y-4">
	<!-- SUMMARY -->
	<div class="flex flex-wrap items-center gap-x-8 gap-y-1.5 bg-gray1/30 rounded-full px-4 py-2">
		<div class="flex items-baseline gap-2">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray3">Expense</span>
			<span class="text-base font-bold font-mono text-problem">{money(totalExpenses)}</span>
		</div>
		<div class="flex items-baseline gap-2">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray3">Revenue</span>
			<span class="text-base font-bold font-mono text-confirmed">{money(revenueTotal)}</span>
		</div>
	</div>

	<!-- ROW 1 — Crew · Logistics -->
	<div class="grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-3 items-start">
		<!-- Crew -->
		<div>
			<div class="flex items-center justify-between mb-1.5">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Crew</span>
			</div>

			{#if assignedCrew.length}
				<div class="grid grid-cols-[120px_1fr_100px] gap-2 px-3 mb-1">
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Name</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70 text-right">Salary</span>
				</div>
			{/if}

			<div class="bg-gray1/30 rounded-2xl divide-y divide-gray1/60 overflow-hidden">
				{#each assignedCrew as c (c.id)}
					<div class="grid grid-cols-[120px_1fr_100px] gap-2 items-center px-3 py-1">
						<span class="text-xs font-bold {c.crew_type === 'artist' ? 'text-lime' : 'text-gray2'}">
							{c.role || CREW_TYPE_LABEL[c.crew_type] || c.crew_type}
						</span>
						<span class="text-sm text-white truncate">{c.name}</span>
						<span class="text-sm text-gray3 font-mono text-right">{money(crewSalaryUsd(c, usdCadRate))}</span>
					</div>
				{:else}
					<p class="text-xs text-gray2 italic px-3 py-1.5">No crew assigned in Event Details.</p>
				{/each}

				{#if assignedCrew.length}
					<div class="grid grid-cols-[120px_1fr_100px] gap-2 items-center px-3 py-1 bg-gray1/40">
						<span class="text-xs font-bold uppercase tracking-wider text-white col-span-2">Crew total</span>
						<span class="text-sm font-bold text-white font-mono text-right">{money(crewTotal)}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Logistics Expenses (coming soon) -->
		<div>
			<div class="flex items-center justify-between mb-1.5">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Logistics Expenses</span>
				<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray1 text-gray2">Coming soon</span>
			</div>

			<div class="bg-gray1/30 rounded-2xl divide-y divide-gray1/60 overflow-hidden opacity-60">
				{#each LOGISTICS_LINES as l (l.key)}
					<div class="flex items-center justify-between px-3 py-1">
						<span class="text-sm text-gray2">{l.label}</span>
						<span class="text-xs text-gray2/70 italic">Coming soon</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- ROW 2 — Merch Revenue (live) · Other Expenses -->
	<div class="grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-3 items-start">
		<!-- Merch Revenue (linked live from Merch tab) -->
		<div>
			<div class="flex items-center justify-between mb-1.5">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Merch Revenue</span>
				
			</div>

			<div class="bg-gray1/30 rounded-2xl overflow-hidden">
				{#if !merchEnabled}
					<p class="text-xs text-gray2 italic px-3 py-3 text-center">Merch is off for this show.</p>
				{:else}
					<div class="px-3 py-2 space-y-1 text-sm">
						<div class="flex justify-between text-gray2"><span>Gross</span><span class="font-mono {numColor(merchGross)}">{money(merchGross)}</span></div>
						<div class="flex justify-between text-gray2"><span>Venue ({merch.venue_pct || 0}%)</span><span class="font-mono">-{money(merchVenueCut)}</span></div>
						<div class="flex justify-between text-gray2"><span>Seller rate</span><span class="font-mono">-{money(merchSellerRate)}</span></div>
						<div class="flex justify-between font-bold pt-1 border-t border-gray1/60">
							<span class="text-white">Net{data.merch_revenue_override != null ? ' (override)' : ''}</span>
							<span class="font-mono {numColor(merchNet)}">{money(merchNet)}</span>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Other Expenses -->
		<div>
			<div class="flex items-center justify-between mb-1.5">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Other Expenses</span>
				<button type="button" class={addButtonCls} on:click={addExpense}>+ Add item</button>
			</div>

			{#if hasStagehands || freeExpenses.length}
				<div class="grid grid-cols-[1fr_116px_46px_72px_24px] gap-2 px-2 mb-1">
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Item</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Price</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Qty</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Unit</span>
					<span class="w-6"></span>
				</div>
			{/if}

			<div class="space-y-1">
				{#if hasStagehands}
					<div class="grid grid-cols-[1fr_116px_46px_72px_24px] gap-2 items-center rounded-full bg-lime/5">
						<div class="flex items-center gap-1.5 min-w-0 pl-3">
							<svg class="w-3.5 h-3.5 text-lime shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
							<span class="text-sm text-white truncate">{STAGEHANDS_LABEL}</span>
						</div>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray2 pointer-events-none select-none">USD$</span>
							<input
								type="text"
								inputmode="decimal"
								use:stagehandsPriceInit={stagehandsRate}
								on:input={(ev) => onStagehandsPriceInput(ev.currentTarget)}
								on:blur={(ev) => onStagehandsPriceBlur(ev.currentTarget)}
								class="w-full bg-lime/10 rounded-full pl-12 pr-3 h-7 text-sm text-lime text-right placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
							/>
						</div>
						<span class="text-sm text-gray2/50 text-center select-none">1</span>
						<span class="text-xs text-gray2/50 text-center select-none">item</span>
						<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove stagehands rate" title="Clears the rate in Production too" on:click={clearStagehands}>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</button>
					</div>
				{/if}

				{#each freeExpenses as e (e.id)}
					<div class="grid grid-cols-[1fr_116px_46px_72px_24px] gap-2 items-center">
						<input class={inputCls} bind:value={e.label} placeholder="e.g. Photo, runner tip…" on:input={changed} />
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray2 pointer-events-none select-none">USD$</span>
							<input
								type="text"
								inputmode="decimal"
								use:priceInit={e}
								on:input={(ev) => onPriceInput(e, ev.currentTarget)}
								on:blur={(ev) => onPriceBlur(e, ev.currentTarget)}
								class="w-full bg-gray1 rounded-full pl-12 pr-3 h-7 text-sm text-white text-right placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
							/>
						</div>
						<input
							type="text"
							inputmode="numeric"
							value={e.qty ?? ''}
							placeholder="1"
							on:input={(ev) => onQtyInput(e, ev.currentTarget)}
							class="w-full bg-gray1 rounded-full px-2 h-7 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
						/>
						<select
							class="w-full bg-gray1 rounded-full px-2 h-7 text-sm text-white outline-none border border-transparent focus:border-lime/60 transition-colors cursor-pointer appearance-none"
							value={e.unit || 'item'}
							on:change={(ev) => setUnit(e, (ev.target as HTMLSelectElement).value)}
						>
							{#each UNIT_OPTIONS as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove expense" on:click={() => removeExpense(e.id)}>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</button>
					</div>
				{:else}
					{#if !hasStagehands}
						<p class="text-xs text-gray2 italic">No expenses yet — add an item.</p>
					{/if}
				{/each}

				{#if hasStagehands || freeExpenses.length}
					<div class="flex items-center justify-between px-2 pt-2 mt-1 border-t border-gray1/60">
						<span class="text-xs font-bold uppercase tracking-wider text-gray3">Other total</span>
						<span class="text-sm font-bold text-white font-mono">{money(otherSectionTotal)}</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>