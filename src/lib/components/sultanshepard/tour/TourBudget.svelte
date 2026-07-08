<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type {
		SSTour,
		SSTourDate,
		TourBudget,
		TourBudgetSection,
		TourBudgetGridRow,
		BudgetCurrency
	} from '$lib/types/tour';
	import { DEFAULT_USD_CAD_RATE } from '$lib/types/tour';
	import { saveTourBudget, getUsdCadRate } from '$lib/services/tourService';

	export let tour: SSTour;
	export let tourDates: SSTourDate[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	// ---- state ----
	let budget: TourBudget = {};
	let usdCadRate = DEFAULT_USD_CAD_RATE;
	let sheetCurrency: BudgetCurrency = 'USD'; // grid display currency (default USD)
	let lastTourId: string | null = null;
	let status: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
	let saveTimer: ReturnType<typeof setTimeout>;

	// ---- column config ----
	type MoneyKey =
		| 'artist_fee'
		| 'prod_buyout'
		| 'salaries'
		| 'flights'
		| 'hotels'
		| 'per_diem'
		| 'transports'
		| 'other'
		| 'merch_revenue';
	type CountKey = 'capacity' | 'sold';

	const REVENUE_LEFT: { key: MoneyKey; label: string }[] = [
		{ key: 'artist_fee', label: 'Artist Fee' },
		{ key: 'prod_buyout', label: 'Prod Buyout' }
	];
	const EXPENSE_COLS: { key: MoneyKey; label: string }[] = [
		{ key: 'salaries', label: 'Salaries' },
		{ key: 'flights', label: 'Flights' },
		{ key: 'hotels', label: 'Hotels' },
		{ key: 'per_diem', label: 'Per Diem' },
		{ key: 'transports', label: 'Transports' },
		{ key: 'other', label: 'Other' }
	];

	const addButtonCls =
		'cursor-pointer px-3 py-1 rounded-full bg-lime text-black text-xs font-bold hover:brightness-110 transition-all';

	const CURRENCIES: BudgetCurrency[] = ['USD', 'CAD'];
	const SECTION_CURRENCIES: BudgetCurrency[] = ['CAD', 'USD'];

	// ---- init / migrate ----
	function initFor(t: SSTour) {
		const b: TourBudget = structuredClone(t.budget || {});
		if (!b.target_per_show) b.target_per_show = 15000;

		b.sections = (b.sections || []).map((s) => ({
			...s,
			currency: s.currency || 'CAD',
			collapsed: s.collapsed ?? true,
			items: s.items || []
		}));

		// migrate legacy bus / preproduction lists into sections (they were CAD)
		const migrate = (list: TourBudget['bus'], name: string) => {
			if (list && list.length) {
				b.sections!.push({
					id: uid(),
					name,
					currency: 'CAD',
					collapsed: true,
					items: list.map((i) => ({ ...i }))
				});
			}
		};
		migrate(b.bus, 'Bus');
		migrate(b.preproduction, 'Preproduction');
		delete b.bus;
		delete b.preproduction;

		if (!b.sections.length) {
			b.sections = [{ id: uid(), name: 'Production', currency: 'CAD', collapsed: false, items: [] }];
		}
		if (!b.grid) b.grid = {};

		budget = b;
		status = 'idle';
	}

	$: if (tour && tour.id !== lastTourId) {
		lastTourId = tour.id;
		initFor(tour);
	}

	onMount(() => {
		getUsdCadRate()
			.then((r) => (usdCadRate = r))
			.catch(() => {});
	});
	onDestroy(() => clearTimeout(saveTimer));

	// ---- persistence (debounced autosave) ----
	function changed() {
		budget = { ...budget };
		status = 'saving';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 700);
	}
	async function save() {
		if (!tour) return;
		status = 'saving';
		try {
			await saveTourBudget(tour.id, budget);
			status = 'saved';
			dispatch('saved', budget);
			setTimeout(() => status === 'saved' && (status = 'idle'), 1500);
		} catch (e) {
			console.error('Failed to save tour budget', e);
			status = 'error';
		}
	}

	// ---- currency helpers (rate = CAD per 1 USD). These are reactive ($:) so the
	// grid re-renders when you flip the USD/CAD toggle or the rate finishes loading. ----
	$: rate = usdCadRate > 0 ? usdCadRate : DEFAULT_USD_CAD_RATE;
	$: mult = sheetCurrency === 'CAD' ? rate : 1; // USD base → display
	$: sym = sheetCurrency === 'CAD' ? 'CAD$' : 'USD$';

	const round = (n: number) => Math.round(Number(n) || 0);
	const numFmt = (n: number) => (n ? round(n).toLocaleString('en-US') : '');
	const usd = (n: number) => 'USD$ ' + round(n).toLocaleString('en-US');
	const cad = (n: number) => 'CAD$ ' + round(n).toLocaleString('en-US');
	$: fmtSheet = (usdVal: number) => sym + ' ' + round(usdVal * mult).toLocaleString('en-US');

	// ---- grid cell access (values stored in USD base) ----
	$: showDates = tourDates.filter((d) => (d.type || 'Tour Date') === 'Tour Date');
	$: showCount = showDates.length;
	$: grid = budget.grid || {};

	function row(id: string): TourBudgetGridRow {
		return budget.grid?.[id] || {};
	}
	function gv(id: string, key: MoneyKey | CountKey): number {
		return Number(row(id)[key]) || 0;
	}
	const gvg = (g: Record<string, TourBudgetGridRow>, id: string, key: MoneyKey | CountKey) =>
		Number((g[id] || {})[key]) || 0;

	function setCell(id: string, key: MoneyKey | CountKey, val: number) {
		if (!budget.grid) budget.grid = {};
		if (!budget.grid[id]) budget.grid[id] = {};
		budget.grid[id][key] = val || 0;
		changed();
	}

	// money inputs read/write in the display currency; stored as USD base.
	// Reactive on `grid` + `mult` so non-focused cells refresh on currency flip.
	$: moneyDisp = (id: string, key: MoneyKey) => gvg(grid, id, key) * mult;
	function onMoneyInput(id: string, key: MoneyKey, node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9.\-]/g, '').replace(/(\..*)\./g, '$1');
		const disp = cleaned === '' || cleaned === '.' || cleaned === '-' ? 0 : Number(cleaned);
		setCell(id, key, mult ? disp / mult : disp);
	}
	// counts are plain integers (no conversion)
	function onCountInput(id: string, key: CountKey, node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9]/g, '');
		setCell(id, key, cleaned === '' ? 0 : Number(cleaned));
	}
	// uncontrolled input helper — only rewrites value when the field isn't focused
	function cellInit(node: HTMLInputElement, val: number) {
		node.value = numFmt(val);
		return {
			update(v: number) {
				if (document.activeElement !== node) node.value = numFmt(v);
			}
		};
	}

	// ---- section totals ----
	const sumItems = (s: TourBudgetSection) =>
		(s.items || []).reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
	$: sectionUSD = (s: TourBudgetSection) =>
		(s.currency || 'CAD') === 'CAD' ? sumItems(s) / rate : sumItems(s);

	$: rightPoolUSD = (budget.sections || []).reduce(
		(acc, s) => acc + ((s.currency || 'CAD') === 'CAD' ? sumItems(s) / rate : sumItems(s)),
		0
	);
	$: rightPoolCAD = (budget.sections || []).reduce(
		(acc, s) => acc + ((s.currency || 'CAD') === 'CAD' ? sumItems(s) : sumItems(s) * rate),
		0
	);
	$: fixedPerShowUSD = showCount > 0 ? rightPoolUSD / showCount : 0;
	$: prodPerShowCAD = showCount > 0 ? rightPoolCAD / showCount : 0;
	$: goalCAD = Number(budget.target_per_show) || 0;
	$: overGoal = showCount > 0 && goalCAD > 0 && prodPerShowCAD > goalCAD;

	// ---- column totals + per-row balances (USD base), reactive on `grid` ----
	const MONEY_KEYS: MoneyKey[] = [
		'artist_fee', 'prod_buyout', 'salaries', 'flights', 'hotels',
		'per_diem', 'transports', 'other', 'merch_revenue'
	];
	$: colTotals = (() => {
		const t: Record<string, number> = {};
		for (const k of [...MONEY_KEYS, 'capacity', 'sold']) t[k] = 0;
		for (const d of showDates)
			for (const k of Object.keys(t)) t[k] += gvg(grid, d.id, k as MoneyKey | CountKey);
		return t;
	})();
	$: balanceById = (() => {
		const m: Record<string, number> = {};
		for (const d of showDates) {
			const rev =
				gvg(grid, d.id, 'artist_fee') +
				gvg(grid, d.id, 'prod_buyout') +
				gvg(grid, d.id, 'merch_revenue');
			const exp = fixedPerShowUSD + EXPENSE_COLS.reduce((a, c) => a + gvg(grid, d.id, c.key), 0);
			m[d.id] = rev - exp;
		}
		return m;
	})();
	$: grandRevenueUSD = colTotals.artist_fee + colTotals.prod_buyout + colTotals.merch_revenue;
	$: grandExpenseUSD = rightPoolUSD + EXPENSE_COLS.reduce((a, c) => a + colTotals[c.key], 0);
	$: grandBalanceUSD = grandRevenueUSD - grandExpenseUSD;

	// ---- section mutations ----
	function addSection() {
		budget.sections = [
			...(budget.sections || []),
			{ id: uid(), name: 'New section', currency: 'CAD', collapsed: false, items: [] }
		];
		changed();
	}
	function removeSection(id: string) {
		budget.sections = (budget.sections || []).filter((s) => s.id !== id);
		changed();
	}
	function toggleCollapse(s: TourBudgetSection) {
		s.collapsed = !s.collapsed;
		changed();
	}
	function setSectionCurrency(s: TourBudgetSection, cur: BudgetCurrency) {
		s.currency = cur;
		changed();
	}
	function addItem(s: TourBudgetSection) {
		s.items = [...(s.items || []), { id: uid(), label: '', amount: 0 }];
		s.collapsed = false;
		changed();
	}
	function removeItem(s: TourBudgetSection, id: string) {
		s.items = s.items.filter((i) => i.id !== id);
		changed();
	}

	function fmtDate(d: string) {
		try {
			return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return d;
		}
	}
</script>

<section class="bg-navbar rounded-2xl h-full flex flex-col min-h-0 overflow-hidden">
	<!-- header -->
	<header class="flex items-center gap-3 px-5 py-4 border-b border-gray1 shrink-0">
		<svg class="w-5 h-5 text-lime shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
		</svg>
		<div class="flex-1 min-w-0">
			<h2 class="text-lg font-bold text-white truncate">Tour Budget — {tour?.name}</h2>
			<p class="text-[10px] uppercase tracking-widest text-gray2">
				1 USD = {rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} CAD · rate set in Settings → Other
			</p>
		</div>

		{#if status === 'saving'}
			<span class="text-[11px] text-gray2 italic shrink-0">Saving…</span>
		{:else if status === 'saved'}
			<span class="text-[11px] text-confirmed font-bold shrink-0">Saved ✓</span>
		{:else if status === 'error'}
			<span class="text-[11px] text-problem font-bold shrink-0">Save failed</span>
		{/if}

		<span class="text-[9px] font-black uppercase tracking-widest text-problem bg-problem/10 px-2 py-0.5 rounded-md shrink-0">
			Restricted
		</span>
		<button
			class="h-8 px-3 flex items-center gap-1.5 rounded-full border border-white/20 text-white text-xs font-bold hover:border-lime hover:text-lime transition-colors cursor-pointer shrink-0"
			on:click={() => dispatch('close')}
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
			Exit
		</button>
	</header>

	<!-- body: left grid (70-75%) + right expenses (25-30%) -->
	<div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[73fr_27fr]">
		<!-- ===================== LEFT — GRID ===================== -->
		<div class="min-w-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray1">
			<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray1 shrink-0">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Per-show budget</span>
				<div class="flex items-center gap-2">
					<span class="text-[10px] uppercase tracking-wider text-gray2">Show in</span>
					<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5">
						{#each CURRENCIES as cur}
							<button
								type="button"
								class="cursor-pointer px-3 py-1 text-xs font-bold rounded-full transition {sheetCurrency === cur ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
								on:click={() => (sheetCurrency = cur)}
							>
								{cur}$
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
				{#if showCount === 0}
					<p class="text-sm text-gray2 italic p-6">No Tour Dates yet — add shows to build the grid.</p>
				{:else}
					<table class="w-full border-collapse text-sm min-w-[1100px]">
						<thead>
							<tr class="bg-navbar">
								<th class="sticky left-0 top-0 z-30 bg-navbar text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2/70 min-w-[150px]">Show</th>
								{#each REVENUE_LEFT as c}
									<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-confirmed text-right whitespace-nowrap">{c.label}</th>
								{/each}
								<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-problem text-right whitespace-nowrap">Fixed Costs</th>
								{#each EXPENSE_COLS as c}
									<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-problem text-right whitespace-nowrap">{c.label}</th>
								{/each}
								<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white text-right whitespace-nowrap border-l border-gray1">Balance</th>
								<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-confirmed text-right whitespace-nowrap border-l border-gray1">Merch Rev</th>
								<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-right whitespace-nowrap border-l border-gray1">Capacity</th>
								<th class="sticky top-0 z-20 bg-navbar px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-right whitespace-nowrap">Sold</th>
							</tr>
						</thead>
						<tbody>
							{#each showDates as d (d.id)}
								{@const bal = balanceById[d.id] || 0}
								<tr class="border-t border-gray1/60 hover:bg-white/[0.02]">
									<td class="sticky left-0 z-10 bg-navbar px-3 py-1.5 min-w-[150px]">
										<div class="text-sm font-bold text-white truncate max-w-[150px]">{d.venue || 'Untitled'}</div>
										<div class="text-[11px] text-gray2">{fmtDate(d.date)}</div>
									</td>

									{#each REVENUE_LEFT as c}
										<td class="px-1 py-1">
											<input
												type="text" inputmode="decimal"
												use:cellInit={moneyDisp(d.id, c.key)}
												on:input={(e) => onMoneyInput(d.id, c.key, e.currentTarget)}
												on:blur={(e) => (e.currentTarget.value = numFmt(moneyDisp(d.id, c.key)))}
												class="w-24 bg-transparent rounded-lg px-2 h-8 text-sm text-confirmed font-mono text-right outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
												placeholder="0"
											/>
										</td>
									{/each}

									<td class="px-2 py-1 text-right">
										<span class="text-sm text-problem/80 font-mono">{fmtSheet(fixedPerShowUSD)}</span>
									</td>

									{#each EXPENSE_COLS as c}
										<td class="px-1 py-1">
											<input
												type="text" inputmode="decimal"
												use:cellInit={moneyDisp(d.id, c.key)}
												on:input={(e) => onMoneyInput(d.id, c.key, e.currentTarget)}
												on:blur={(e) => (e.currentTarget.value = numFmt(moneyDisp(d.id, c.key)))}
												class="w-24 bg-transparent rounded-lg px-2 h-8 text-sm text-problem font-mono text-right outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
												placeholder="0"
											/>
										</td>
									{/each}

									<td class="px-2 py-1 text-right border-l border-gray1">
										<span class="text-sm font-bold font-mono {bal >= 0 ? 'text-confirmed' : 'text-problem'}">{fmtSheet(bal)}</span>
									</td>

									<td class="px-1 py-1 border-l border-gray1">
										<input
											type="text" inputmode="decimal"
											use:cellInit={moneyDisp(d.id, 'merch_revenue')}
											on:input={(e) => onMoneyInput(d.id, 'merch_revenue', e.currentTarget)}
											on:blur={(e) => (e.currentTarget.value = numFmt(moneyDisp(d.id, 'merch_revenue')))}
											class="w-24 bg-transparent rounded-lg px-2 h-8 text-sm text-confirmed font-mono text-right outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
											placeholder="0"
										/>
									</td>

									<td class="px-1 py-1 border-l border-gray1">
										<input
											type="text" inputmode="numeric"
											use:cellInit={gv(d.id, 'capacity')}
											on:input={(e) => onCountInput(d.id, 'capacity', e.currentTarget)}
											on:blur={(e) => (e.currentTarget.value = numFmt(gv(d.id, 'capacity')))}
											class="w-20 bg-transparent rounded-lg px-2 h-8 text-sm text-white font-mono text-right outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
											placeholder="0"
										/>
									</td>
									<td class="px-1 py-1">
										<input
											type="text" inputmode="numeric"
											use:cellInit={gv(d.id, 'sold')}
											on:input={(e) => onCountInput(d.id, 'sold', e.currentTarget)}
											on:blur={(e) => (e.currentTarget.value = numFmt(gv(d.id, 'sold')))}
											class="w-20 bg-transparent rounded-lg px-2 h-8 text-sm text-white font-mono text-right outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
											placeholder="0"
										/>
									</td>
								</tr>
							{/each}

							<!-- totals -->
							<tr class="border-t-2 border-gray1 bg-black/30 sticky bottom-0">
								<td class="sticky left-0 z-10 bg-navbar px-3 py-2 text-xs font-black uppercase tracking-wider text-white min-w-[150px]">Total</td>
								{#each REVENUE_LEFT as c}
									<td class="px-2 py-2 text-right text-sm font-bold font-mono text-confirmed">{fmtSheet(colTotals[c.key])}</td>
								{/each}
								<td class="px-2 py-2 text-right text-sm font-bold font-mono text-problem/80">{fmtSheet(rightPoolUSD)}</td>
								{#each EXPENSE_COLS as c}
									<td class="px-2 py-2 text-right text-sm font-bold font-mono text-problem">{fmtSheet(colTotals[c.key])}</td>
								{/each}
								<td class="px-2 py-2 text-right text-sm font-black font-mono border-l border-gray1 {grandBalanceUSD >= 0 ? 'text-confirmed' : 'text-problem'}">{fmtSheet(grandBalanceUSD)}</td>
								<td class="px-2 py-2 text-right text-sm font-bold font-mono text-confirmed border-l border-gray1">{fmtSheet(colTotals.merch_revenue)}</td>
								<td class="px-2 py-2 text-right text-sm font-bold font-mono text-white border-l border-gray1">{colTotals.capacity.toLocaleString('en-US')}</td>
								<td class="px-2 py-2 text-right text-sm font-bold font-mono text-white">{colTotals.sold.toLocaleString('en-US')}</td>
							</tr>
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<!-- ===================== RIGHT — EXPENSES ===================== -->
		<div class="min-w-0 flex flex-col min-h-0">
			<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray1 shrink-0">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Fixed Costs (pool)</span>
				<button type="button" class={addButtonCls} on:click={addSection}>+ Add section</button>
			</div>

			<!-- goal per show -->
			<div class="px-5 py-3 border-b border-gray1 shrink-0 space-y-2">
				<div class="flex items-center justify-between gap-2">
					<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Goal / show (CAD)</span>
					<div class="relative w-32">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray2 pointer-events-none">CAD$</span>
						<input
							type="number"
							bind:value={budget.target_per_show}
							on:input={changed}
							class="w-full bg-gray1 rounded-full pl-11 pr-3 h-9 text-sm text-white text-right font-mono outline-none border border-transparent focus:border-lime/60 transition-colors"
						/>
					</div>
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="text-gray2">Prod / show (actual)</span>
					<span class="font-mono font-bold {overGoal ? 'text-problem' : 'text-confirmed'}">
						{showCount > 0 ? cad(prodPerShowCAD) : '—'}
					</span>
				</div>
			</div>

			<!-- sections -->
			<div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-3 space-y-2">
				{#each budget.sections || [] as section (section.id)}
					<div class="bg-black/30 rounded-2xl overflow-hidden">
						<div class="flex items-center gap-2 px-3 py-2">
							<button
								class="text-gray2 hover:text-lime transition shrink-0 cursor-pointer"
								on:click={() => toggleCollapse(section)}
								aria-label="Toggle items"
							>
								<svg class="w-4 h-4 transition-transform {section.collapsed ? '' : 'rotate-90'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" /></svg>
							</button>
							<input
								class="flex-1 min-w-0 bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-lime/60"
								bind:value={section.name}
								on:input={changed}
							/>
							<!-- currency pill -->
							<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5 shrink-0">
								{#each SECTION_CURRENCIES as cur}
									<button
										type="button"
										class="cursor-pointer px-2 py-0.5 text-[10px] font-bold rounded-full transition {(section.currency || 'CAD') === cur ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
										on:click={() => setSectionCurrency(section, cur)}
									>
										{cur}
									</button>
								{/each}
							</div>
							<button class="text-gray2 hover:text-problem transition shrink-0 cursor-pointer" on:click={() => removeSection(section.id)} aria-label="Remove section">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>

						<!-- section total row (always visible) -->
						<div class="flex items-center justify-between px-3 pb-2">
							<span class="text-[10px] uppercase tracking-wider text-gray2/70">
								{(section.items || []).length} item{(section.items || []).length === 1 ? '' : 's'}
							</span>
							<span class="text-sm font-bold font-mono text-lime">
								{(section.currency || 'CAD') === 'CAD' ? cad(sumItems(section)) : usd(sumItems(section))}
								<span class="text-[10px] text-gray2 font-normal">≈ {usd(sectionUSD(section))}</span>
							</span>
						</div>

						{#if !section.collapsed}
							<div class="px-3 pb-3 space-y-1.5 border-t border-gray1/60 pt-2">
								{#each section.items as item (item.id)}
									<div class="flex items-center gap-2">
										<input
											class="flex-1 min-w-0 bg-gray1 rounded-full px-3 h-8 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
											placeholder="Item"
											bind:value={item.label}
											on:input={changed}
										/>
										<input
											type="number"
											class="w-24 bg-gray1 rounded-full px-3 h-8 text-sm text-white text-right font-mono outline-none border border-transparent focus:border-lime/60 transition-colors"
											bind:value={item.amount}
											on:input={changed}
										/>
										<button class="text-gray2 hover:text-problem transition shrink-0 cursor-pointer" on:click={() => removeItem(section, item.id)} aria-label="Remove item">
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
										</button>
									</div>
								{/each}
								<button class="text-xs text-gray2 hover:text-lime transition cursor-pointer" on:click={() => addItem(section)}>
									+ Add item
								</button>
							</div>
						{/if}
					</div>
				{/each}

				{#if !(budget.sections || []).length}
					<p class="text-xs text-gray2 italic">No sections yet — add one above.</p>
				{/if}
			</div>

			<!-- fixed footer: balance -->
			<div class="border-t border-gray1 px-5 py-3 shrink-0 bg-black/30 space-y-1.5">
				<div class="flex items-center justify-between text-xs">
					<span class="text-gray2">Fixed costs pool</span>
					<span class="font-mono text-problem/80">{usd(rightPoolUSD)}</span>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-[12px] font-bold uppercase tracking-wider text-gray3">Revenue</span>
					<span class="font-mono font-bold text-confirmed">{usd(grandRevenueUSD)}</span>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="text-[12px] font-bold uppercase tracking-wider text-gray3">Expenses</span>
					<span class="font-mono font-bold text-problem">{usd(grandExpenseUSD)}</span>
				</div>
				<div class="flex items-center justify-between pt-1.5 border-t border-gray1/60">
					<span class="text-[12px] font-black uppercase tracking-wider text-white">
						{grandBalanceUSD >= 0 ? 'Profit' : 'Loss'}
					</span>
					<span class="text-lg font-black font-mono {grandBalanceUSD >= 0 ? 'text-confirmed' : 'text-problem'}">{usd(grandBalanceUSD)}</span>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
	.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
</style>