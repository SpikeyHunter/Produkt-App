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
	// Fixed, non-random id so this section survives renames/reloads and can always
	// be identified — its total is intentionally excluded from the fixed-costs pool.
	const PRE_PROD_ID = 'preprod-budget';

	// ---- state ----
	let budget: TourBudget = {};
	let usdCadRate = DEFAULT_USD_CAD_RATE;
	let sheetCurrency: BudgetCurrency = 'USD'; // grid display currency (default USD)
	let lastTourId: string | null = null;
	let status: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
	let saveTimer: ReturnType<typeof setTimeout>;

	// Fixed Costs drawer — collapsed by default, slides open on demand (req #1 + #7).
	let fixedOpen = false;

	// Display currency for the "Budget per Show" goal — the value is always stored
	// in CAD (target_per_show), this only controls how it's shown/entered.
	let goalCurrency: BudgetCurrency = 'CAD';

	// Column-wide hover highlight — only triggered from the header row or the
	// totals/footer row, per request. Every cell in that column index reacts.
	let hoveredCol: number | null = null;
	const colEnter = (i: number) => () => (hoveredCol = i);
	const colLeave = () => (hoveredCol = null);

	// root + probe refs — the probe reads the theme's actual gray1 color so the
	// scrollbar override always matches your design tokens, no hardcoded hex (req #2).
	let sectionEl: HTMLElement;
	let gray1Probe: HTMLSpanElement;

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
			b.sections = [{ id: uid(), name: 'Production', currency: 'CAD', collapsed: true, items: [] }];
		}

		// Pre-Prod Budget always exists and always sits first. It behaves like any
		// other section (add/hide/remove items) but never contributes to the
		// fixed-costs pool — see rightPoolUSD / rightPoolCAD below.
		const preProdIdx = b.sections.findIndex((s) => s.id === PRE_PROD_ID);
		if (preProdIdx === -1) {
			b.sections.unshift({
				id: PRE_PROD_ID,
				name: 'Pre-Prod Budget',
				currency: 'CAD',
				collapsed: true,
				items: []
			});
		} else if (preProdIdx > 0) {
			const [preProd] = b.sections.splice(preProdIdx, 1);
			b.sections.unshift(preProd);
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

		// Read the theme's real gray1 color and expose it as a CSS var so the
		// scrollbar thumb always matches your design tokens (req #2).
		if (gray1Probe && sectionEl) {
			const c = getComputedStyle(gray1Probe).color;
			if (c) sectionEl.style.setProperty('--sb-thumb', c);
		}
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
	// Fixed Costs + Balance columns don't repeat the currency symbol per cell — the
	// USD/CAD toggle above the grid already sets that context — just the number.
	$: fmtNum = (usdVal: number) => moneyFmtBare(usdVal * mult);

	// ---- money input formatting ----
	// Entered money always renders as "100,000.00$" (grid) or "100,000.00" (sidebar,
	// which already carries a currency label). Zero/empty always shows "0.00" —
	// never blank — so the two-decimal format is consistent everywhere.
	const moneyFmtBare = (n: number) => {
		const v = Number(n) || 0;
		return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	};
	const moneyFmt = (n: number) => moneyFmtBare(n) + '$';
	// strip everything but digits / dot / minus → a clean float.
	// Supports "10k" / "100K" shorthand → 10,000 / 100,000.
	const parseMoney = (s: string) => {
		const trimmed = s.trim();
		const isK = /k$/i.test(trimmed);
		const body = trimmed.replace(/[kK]\s*$/, '');
		const c = body.replace(/[^0-9.\-]/g, '').replace(/(\..*)\./g, '$1');
		const n = c === '' || c === '.' || c === '-' ? 0 : Number(c);
		return isK ? n * 1000 : n;
	};

	// ---- dynamic column width ----
	// Inputs size themselves to their own displayed text (in `ch` units) instead of a
	// fixed px width, so "10$" stays compact and "100,000.00$" grows the column that
	// holds it. A floor keeps every column from collapsing below a usable min width.
	const CH_MIN = 7;
	const CH_PAD = 1.5;
	function sizeToContent(node: HTMLInputElement) {
		const len = Math.max(node.value.length, node.placeholder?.length || 0);
		node.style.width = Math.max(CH_MIN, len + CH_PAD) + 'ch';
	}

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
		const disp = parseMoney(node.value);
		setCell(id, key, mult ? disp / mult : disp);
		sizeToContent(node);
	}
	// counts are plain integers (no conversion)
	function onCountInput(id: string, key: CountKey, node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9]/g, '');
		setCell(id, key, cleaned === '' ? 0 : Number(cleaned));
		sizeToContent(node);
	}

	// uncontrolled input helpers — only rewrite value when the field isn't focused.
	// count cells → integers; money cells → "100,000.00$"; bare money → "100,000.00".
	// Each also sizes the input to its own content so columns grow with longer numbers.
	function cellInit(node: HTMLInputElement, val: number) {
		node.value = numFmt(val);
		sizeToContent(node);
		return {
			update(v: number) {
				if (document.activeElement !== node) {
					node.value = numFmt(v);
					sizeToContent(node);
				}
			}
		};
	}
	function moneyCell(node: HTMLInputElement, val: number) {
		node.value = moneyFmt(val);
		sizeToContent(node);
		return {
			update(v: number) {
				if (document.activeElement !== node) {
					node.value = moneyFmt(v);
					sizeToContent(node);
				}
			}
		};
	}
	function moneyCellBare(node: HTMLInputElement, val: number) {
		node.value = moneyFmtBare(val);
		sizeToContent(node);
		return {
			update(v: number) {
				if (document.activeElement !== node) {
					node.value = moneyFmtBare(v);
					sizeToContent(node);
				}
			}
		};
	}
	// on focus, drop the formatting so the raw number is easy to edit
	const stripFmt = (e: Event) => {
		const n = e.currentTarget as HTMLInputElement;
		n.value = n.value.replace(/[^0-9.\-]/g, '');
		sizeToContent(n);
		n.select();
	};
	// for inputs that don't need reformatting on focus (counts, labels) — still select-all
	const selectAll = (e: Event) => (e.currentTarget as HTMLInputElement).select();

	// ---- section totals ----
	// Hidden items (eye toggled off) are excluded from every downstream total —
	// section subtotal, the fixed-costs pool, per-show cost, and the grand balance.
	const sumItems = (s: TourBudgetSection) =>
		(s.items || []).reduce((acc, i) => (i.hidden ? acc : acc + (Number(i.amount) || 0)), 0);
	$: sectionUSD = (s: TourBudgetSection) =>
		(s.currency || 'CAD') === 'CAD' ? sumItems(s) / rate : sumItems(s);

	$: rightPoolUSD = (budget.sections || [])
		.filter((s) => s.id !== PRE_PROD_ID)
		.reduce(
			(acc, s) => acc + ((s.currency || 'CAD') === 'CAD' ? sumItems(s) / rate : sumItems(s)),
			0
		);
	$: rightPoolCAD = (budget.sections || [])
		.filter((s) => s.id !== PRE_PROD_ID)
		.reduce(
			(acc, s) => acc + ((s.currency || 'CAD') === 'CAD' ? sumItems(s) : sumItems(s) * rate),
			0
		);
	$: fixedPerShowUSD = showCount > 0 ? rightPoolUSD / showCount : 0;
	$: prodPerShowCAD = showCount > 0 ? rightPoolCAD / showCount : 0;
	$: goalCAD = Number(budget.target_per_show) || 0;
	$: overGoal = showCount > 0 && goalCAD > 0 && prodPerShowCAD > goalCAD;
	// Goal is always stored in CAD; these convert for display/entry in whichever
	// currency the toggle is set to.
	$: goalDisp = goalCurrency === 'USD' ? goalCAD / rate : goalCAD;
	function onGoalInput(node: HTMLInputElement) {
		const raw = parseMoney(node.value);
		budget.target_per_show = goalCurrency === 'USD' ? raw * rate : raw;
		changed();
	}

	// ---- column totals + per-row balances (USD base), reactive on `grid` ----
	const MONEY_KEYS: MoneyKey[] = [
		'artist_fee',
		'prod_buyout',
		'salaries',
		'flights',
		'hotels',
		'per_diem',
		'transports',
		'other',
		'merch_revenue'
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

	// ---- drawer footer summary — a distinct breakdown from the grid's Total row above.
	// Fixed Costs: only the sections pool (rightPoolUSD).
	// Show Expenses: the per-show expense columns only, fixed costs excluded.
	// Revenue: artist fee + prod buyout only (merch is its own line).
	// Balance: Revenue − Show Expenses − Fixed Costs.
	$: footerShowExpensesUSD = EXPENSE_COLS.reduce((a, c) => a + colTotals[c.key], 0);
	$: footerRevenueUSD = colTotals.artist_fee + colTotals.prod_buyout;
	$: footerBalanceUSD = footerRevenueUSD - footerShowExpensesUSD - rightPoolUSD;

	// ---- section mutations ----
	function addSection() {
		budget.sections = [
			...(budget.sections || []),
			{ id: uid(), name: 'New section', currency: 'CAD', collapsed: true, items: [] }
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
	// true only when every section is currently collapsed — drives the
	// Expand all / Collapse all label and its action.
	$: allSectionsCollapsed =
		(budget.sections || []).length > 0 && (budget.sections || []).every((s) => s.collapsed);
	function toggleAllSections() {
		const nextCollapsed = !allSectionsCollapsed;
		budget.sections = (budget.sections || []).map((s) => ({ ...s, collapsed: nextCollapsed }));
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
	function toggleItemHidden(item: TourBudgetSection['items'][number]) {
		item.hidden = !item.hidden;
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

<section
	bind:this={sectionEl}
	class="tour-budget bg-navbar rounded-2xl h-full flex flex-col min-h-0 overflow-hidden"
>
	<!-- invisible probe: lets us read the theme's real gray1 color at runtime for the
	     scrollbar override below, instead of hardcoding a hex that might not match (req #1) -->
	<span
		bind:this={gray1Probe}
		class="text-gray1"
		style="position:absolute; width:0; height:0; overflow:hidden; visibility:hidden;"
		aria-hidden="true"
	></span>

	<!-- header section removed per request (req #3) — title/rate now live inline in the
	     grid's own top bar below, save status + exit affordance removed. -->

	<!-- body: left grid (flexes full width when the drawer is closed) + right fixed-costs drawer -->
	<div class="flex-1 min-h-0 flex">
		<!-- ===================== LEFT — GRID ===================== -->
		<div class="min-w-0 flex-1 flex flex-col min-h-0 border-r border-gray1">
			<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray1 shrink-0">
				<!-- "Tour Budget" title + custom rate, stacked (req #4) -->
				<div class="min-w-0">
					<span class="block text-[13px] font-bold uppercase tracking-wider text-lime leading-tight"
						>Tour Budget</span
					>
					<span class="block text-[10px] text-gray2 leading-tight whitespace-nowrap">
						1 USD = {rate.toLocaleString('en-US', { maximumFractionDigits: 4 })} CAD
					</span>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5">
						{#each CURRENCIES as cur}
							<button
								type="button"
								class="cursor-pointer px-3 py-1 text-xs font-bold rounded-full transition {sheetCurrency ===
								cur
									? 'bg-lime text-black'
									: 'text-gray2 hover:text-white'}"
								on:click={() => (sheetCurrency = cur)}
							>
								{cur}$
							</button>
						{/each}
					</div>

					<!-- Fixed Costs drawer toggle — the ONLY place this control lives (req #7),
					     gray2-tinted, with a visible background in both open and retracted states -->
					<button
						type="button"
						class="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer {fixedOpen
							? 'bg-gray2/25 text-gray2'
							: 'bg-gray1 text-gray2 hover:bg-gray1/70 hover:text-white'}"
						on:click={() => (fixedOpen = !fixedOpen)}
						aria-expanded={fixedOpen}
					>
						<svg
							class="w-3 h-3 transition-transform {fixedOpen ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M9 6l6 6-6 6" /></svg
						>
						Fixed Costs
					</button>
				</div>
			</div>

			<div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
				{#if showCount === 0}
					<p class="text-sm text-gray2 italic p-6">
						No Tour Dates yet — add shows to build the grid.
					</p>
				{:else}
					<table class="w-full border-collapse text-sm min-w-[1150px]">
						<thead>
							<tr>
								<th on:mouseenter={colEnter(0)} on:mouseleave={colLeave} class="sticky left-0 top-0 z-30 text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap {hoveredCol === 0 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Show</th>
								{#each REVENUE_LEFT as c, i}
									<!-- vertical divider: Show | Artist Fee -->
									<th on:mouseenter={colEnter(1 + i)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol === 1 + i ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">{c.label}</th>
								{/each}
								<!-- vertical divider: Prod Buyout | Fixed Costs -->
								<th on:mouseenter={colEnter(3)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-l border-gray1 {hoveredCol === 3 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Fixed Costs</th>
								{#each EXPENSE_COLS as c, i}
									<!-- vertical divider: Fixed Costs | Salaries -->
									<th on:mouseenter={colEnter(4 + i)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol === 4 + i ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">{c.label}</th>
								{/each}
								<th on:mouseenter={colEnter(10)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-l border-gray1 {hoveredCol === 10 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Balance</th>
								<th on:mouseenter={colEnter(11)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-l border-gray1 {hoveredCol === 11 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Merch Rev</th>
								<th on:mouseenter={colEnter(12)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap border-l border-gray1 {hoveredCol === 12 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Capacity</th>
								<th on:mouseenter={colEnter(13)} on:mouseleave={colLeave} class="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-center whitespace-nowrap {hoveredCol === 13 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">Sold</th>
							</tr>
						</thead>
						<tbody>
							{#each showDates as d (d.id)}
								{@const bal = balanceById[d.id] || 0}
								<tr class="group border-t border-gray1/60 hover:bg-white/[0.1] transition-colors">
									<td class="sticky left-0 z-10 bg-navbar px-3 py-1 text-left whitespace-nowrap">
										<div
											class="absolute inset-0 bg-white/0 group-hover:bg-white/[0.1] transition-colors pointer-events-none"
										></div>
										{#if hoveredCol === 0}<div
												class="absolute inset-0 bg-white/[0.06] pointer-events-none"
											></div>{/if}
										<div class="relative text-sm font-bold text-white whitespace-nowrap">
											{d.venue || 'Untitled'}
										</div>
										<div class="relative text-[11px] text-gray2 whitespace-nowrap">
											{fmtDate(d.date)}
										</div>
									</td>

									{#each REVENUE_LEFT as c, i}
										<td
											class="px-1 py-1 {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol ===
											1 + i
												? 'bg-white/[0.06]'
												: ''}"
										>
											<input
												type="text"
												inputmode="decimal"
												use:moneyCell={moneyDisp(d.id, c.key)}
												on:focus={stripFmt}
												on:input={(e) => onMoneyInput(d.id, c.key, e.currentTarget)}
												on:blur={(e) => {
													e.currentTarget.value = moneyFmt(moneyDisp(d.id, c.key));
													sizeToContent(e.currentTarget);
												}}
												class="mx-auto block bg-transparent rounded-lg px-2 h-6 text-sm font-mono text-center whitespace-nowrap outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors {gvg(
													grid,
													d.id,
													c.key
												)
													? 'text-confirmed'
													: c.key === 'artist_fee'
														? 'text-proposed'
														: 'text-gray3'}"
												placeholder="0.00$"
											/>
										</td>
									{/each}

									<!-- Fixed Costs per-show value → gray2, darker resting bg than the rest of the grid -->
									<td
										class="px-2 py-1 text-center whitespace-nowrap border-l border-gray1 {hoveredCol ===
										3
											? 'bg-white/[0.08]'
											: 'bg-black/20'}"
									>
										<span class="text-sm text-gray2 font-mono whitespace-nowrap"
											>{fmtNum(fixedPerShowUSD)}</span
										>
									</td>

									{#each EXPENSE_COLS as c, i}
										<td
											class="px-1 py-1 {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol ===
											4 + i
												? 'bg-white/[0.06]'
												: ''}"
										>
											<input
												type="text"
												inputmode="decimal"
												use:moneyCell={moneyDisp(d.id, c.key)}
												on:focus={stripFmt}
												on:input={(e) => onMoneyInput(d.id, c.key, e.currentTarget)}
												on:blur={(e) => {
													e.currentTarget.value = moneyFmt(moneyDisp(d.id, c.key));
													sizeToContent(e.currentTarget);
												}}
												class="mx-auto block bg-transparent rounded-lg px-2 h-6 text-sm font-mono text-center whitespace-nowrap outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors {gvg(
													grid,
													d.id,
													c.key
												)
													? 'text-problem'
													: 'text-gray3'}"
												placeholder="0.00$"
											/>
										</td>
									{/each}

									<td
										class="px-2 py-1 text-center border-l border-gray1 whitespace-nowrap {hoveredCol ===
										10
											? 'bg-white/[0.06]'
											: ''}"
									>
										<span
											class="text-sm font-bold font-mono whitespace-nowrap {bal >= 0
												? 'text-confirmed'
												: 'text-problem'}">{fmtNum(bal)}</span
										>
									</td>

									<td
										class="px-1 py-1 border-l border-gray1 {hoveredCol === 11
											? 'bg-white/[0.06]'
											: ''}"
									>
										<input
											type="text"
											inputmode="decimal"
											use:moneyCell={moneyDisp(d.id, 'merch_revenue')}
											on:focus={stripFmt}
											on:input={(e) => onMoneyInput(d.id, 'merch_revenue', e.currentTarget)}
											on:blur={(e) => {
												e.currentTarget.value = moneyFmt(moneyDisp(d.id, 'merch_revenue'));
												sizeToContent(e.currentTarget);
											}}
											class="mx-auto block bg-transparent rounded-lg px-2 h-6 text-sm font-mono text-center whitespace-nowrap outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors {gvg(
												grid,
												d.id,
												'merch_revenue'
											)
												? 'text-confirmed'
												: 'text-gray3'}"
											placeholder="0.00$"
										/>
									</td>

									<td
										class="px-1 py-1 border-l border-gray1 {hoveredCol === 12
											? 'bg-white/[0.06]'
											: ''}"
									>
										<input
											type="text"
											inputmode="numeric"
											use:cellInit={gv(d.id, 'capacity')}
											on:focus={selectAll}
											on:input={(e) => onCountInput(d.id, 'capacity', e.currentTarget)}
											on:blur={(e) => {
												e.currentTarget.value = numFmt(gv(d.id, 'capacity'));
												sizeToContent(e.currentTarget);
											}}
											class="mx-auto block bg-transparent rounded-lg px-2 h-6 text-sm text-white font-mono text-center whitespace-nowrap outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
											placeholder="0"
										/>
									</td>
									<td class="px-1 py-1 {hoveredCol === 13 ? 'bg-white/[0.06]' : ''}">
										<input
											type="text"
											inputmode="numeric"
											use:cellInit={gv(d.id, 'sold')}
											on:focus={selectAll}
											on:input={(e) => onCountInput(d.id, 'sold', e.currentTarget)}
											on:blur={(e) => {
												e.currentTarget.value = numFmt(gv(d.id, 'sold'));
												sizeToContent(e.currentTarget);
											}}
											class="mx-auto block bg-transparent rounded-lg px-2 h-6 text-sm text-white font-mono text-center whitespace-nowrap outline-none border border-transparent focus:border-lime/60 focus:bg-black/30 transition-colors"
											placeholder="0"
										/>
									</td>
								</tr>
							{/each}

							<!-- totals — fully opaque (bg-[#131313]) so scrolling body never shows through, column-hover matches header -->
<tr class="border-t-2 border-gray1 sticky bottom-0 z-20">
	<td on:mouseenter={colEnter(0)} on:mouseleave={colLeave} class="sticky left-0 z-30 px-3 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap text-left {hoveredCol === 0 ? 'bg-gray2 text-black' : 'bg-[#131313] text-white'}">Total</td>
	{#each REVENUE_LEFT as c, i}
		<td on:mouseenter={colEnter(1 + i)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono whitespace-nowrap {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol === 1 + i ? 'bg-gray2 text-black' : 'bg-[#131313] text-confirmed'}">{fmtSheet(colTotals[c.key])}</td>
	{/each}
	<!-- Fixed Costs total -->
	<td on:mouseenter={colEnter(3)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono whitespace-nowrap border-l border-gray1 {hoveredCol === 3 ? 'bg-gray2 text-black' : 'bg-[#131313] text-gray2'}">{fmtNum(rightPoolUSD)}</td>
	{#each EXPENSE_COLS as c, i}
		<td on:mouseenter={colEnter(4 + i)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono whitespace-nowrap {i === 0 ? 'border-l border-gray1' : ''} {hoveredCol === 4 + i ? 'bg-gray2 text-black' : 'bg-[#131313] text-problem'}">{fmtSheet(colTotals[c.key])}</td>
	{/each}
	<td on:mouseenter={colEnter(10)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-black font-mono border-l border-gray1 whitespace-nowrap {hoveredCol === 10 ? 'bg-gray2 text-black' : 'bg-[#131313] ' + (grandBalanceUSD >= 0 ? 'text-confirmed' : 'text-problem')}">{fmtNum(grandBalanceUSD)}</td>
	<td on:mouseenter={colEnter(11)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono border-l border-gray1 whitespace-nowrap {hoveredCol === 11 ? 'bg-gray2 text-black' : 'bg-[#131313] text-confirmed'}">{fmtSheet(colTotals.merch_revenue)}</td>
	<td on:mouseenter={colEnter(12)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono border-l border-gray1 whitespace-nowrap {hoveredCol === 12 ? 'bg-gray2 text-black' : 'bg-[#131313] text-white'}">{colTotals.capacity.toLocaleString('en-US')}</td>
	<td on:mouseenter={colEnter(13)} on:mouseleave={colLeave} class="px-2 py-1.5 text-center text-sm font-bold font-mono whitespace-nowrap {hoveredCol === 13 ? 'bg-gray2 text-black' : 'bg-[#131313] text-white'}">{colTotals.sold.toLocaleString('en-US')}</td>
</tr>
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<!-- ===================== RIGHT — FIXED COSTS DRAWER ===================== -->
		<!-- Always mounted; width animates 0 → 380px so it slides in/out instead of popping (req #1).
		     overflow-hidden clips it while collapsed; the inner panel keeps a fixed width so
		     content never reflows/squishes mid-animation. -->
		<div
			class="shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out {fixedOpen
				? 'w-[460px] opacity-100'
				: 'w-0 opacity-0'}"
			aria-hidden={!fixedOpen}
		>
			<div class="w-[460px] h-full flex flex-col min-h-0">
				<!-- drawer header — no redundant collapse control, gray2-tinted (req #3, #7) -->
				<div
					class="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray1 shrink-0"
				>
					<span class="text-[13px] font-bold uppercase tracking-wider text-gray2 truncate"
						>Fixed Costs</span
					>
					<button type="button" class={addButtonCls} on:click={addSection}>+ Add section</button>
				</div>

				<!-- budget per show -->
				<div class="px-5 py-3 border-b border-gray1 shrink-0 space-y-2">
					<div class="flex items-center justify-between gap-2">
						<span
							class="text-[11px] font-bold uppercase tracking-wider text-gray2 whitespace-nowrap"
							>Budget per Show</span
						>
						<div class="flex items-center gap-2 shrink-0">
							<!-- currency toggle -->
							<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5 shrink-0">
								{#each SECTION_CURRENCIES as cur}
									<button
										type="button"
										class="cursor-pointer px-2 py-0.5 text-[10px] font-bold rounded-full transition {goalCurrency ===
										cur
											? 'bg-lime text-black'
											: 'text-gray2 hover:text-white'}"
										on:click={() => (goalCurrency = cur)}
									>
										{cur}
									</button>
								{/each}
							</div>
							<!-- flex pill: prefix + input are separate flex children, so the input's
							     own ch-based auto-width never has to fight fixed prefix padding
							     (that mismatch was what clipped the number before). -->
							<div class="flex items-center gap-1 bg-gray1 rounded-full pl-3 pr-2 h-7 shrink-0">
								<span class="text-xs text-gray2 shrink-0">{goalCurrency}$</span>
								<input
									type="text"
									inputmode="decimal"
									use:moneyCellBare={goalDisp}
									on:focus={stripFmt}
									on:input={(e) => onGoalInput(e.currentTarget)}
									on:blur={(e) => {
										e.currentTarget.value = moneyFmtBare(goalDisp);
										sizeToContent(e.currentTarget);
									}}
									class="bg-transparent text-sm text-white text-right font-mono whitespace-nowrap outline-none border-none focus:outline-none"
									placeholder="0.00"
								/>
							</div>
						</div>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-gray2 whitespace-nowrap">Prod / show (actual)</span>
						<span
							class="font-mono font-bold whitespace-nowrap {overGoal
								? 'text-problem'
								: 'text-confirmed'}"
						>
							{showCount > 0
								? goalCurrency === 'USD'
									? usd(fixedPerShowUSD)
									: cad(prodPerShowCAD)
								: '—'}
						</span>
					</div>
				</div>

				<!-- sections -->
				<div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-3 space-y-2">
					{#if (budget.sections || []).length > 0}
						<div class="flex justify-end">
							<button
								type="button"
								class="text-[11px] font-bold text-gray2 hover:text-white transition cursor-pointer"
								on:click={toggleAllSections}
							>
								{allSectionsCollapsed ? 'Expand all' : 'Collapse all'}
							</button>
						</div>
					{/if}
					{#each budget.sections || [] as section (section.id)}
						<div class="bg-black/30 rounded-2xl overflow-hidden">
							<div class="flex items-center gap-2 px-3 py-2">
								<button
									class="text-gray2/70 hover:text-gray2 transition shrink-0 cursor-pointer"
									on:click={() => toggleCollapse(section)}
									aria-label="Toggle items"
								>
									<svg
										class="w-4 h-4 transition-transform {section.collapsed ? '' : 'rotate-90'}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M9 18l6-6-6-6" /></svg
									>
								</button>
								<input
									class="flex-1 min-w-0 bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-lime/60"
									bind:value={section.name}
									on:focus={selectAll}
									on:input={changed}
								/>
								<!-- currency pill -->
								<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5 shrink-0">
									{#each SECTION_CURRENCIES as cur}
										<button
											type="button"
											class="cursor-pointer px-2 py-0.5 text-[10px] font-bold rounded-full transition {(section.currency ||
												'CAD') === cur
												? 'bg-lime text-black'
												: 'text-gray2 hover:text-white'}"
											on:click={() => setSectionCurrency(section, cur)}
										>
											{cur}
										</button>
									{/each}
								</div>
								{#if section.id !== PRE_PROD_ID}
									<button
										class="text-gray2 hover:text-problem transition shrink-0 cursor-pointer"
										on:click={() => removeSection(section.id)}
										aria-label="Remove section"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
										>
									</button>
								{:else}
									<!-- Pre-Prod Budget is permanent: no remove button -->
									<div class="w-4 shrink-0"></div>
								{/if}
							</div>

							<!-- section total row (always visible), never wraps -->
							<div class="flex items-center justify-between gap-2 px-3 pb-2">
								<span class="text-[10px] uppercase tracking-wider text-gray2/70 whitespace-nowrap">
									{(section.items || []).length} item{(section.items || []).length === 1 ? '' : 's'}
									{#if section.id === PRE_PROD_ID}
										<span class="text-gray2/50">· not counted in budget</span>
									{/if}
								</span>
								<span class="text-sm font-bold font-mono text-gray2 whitespace-nowrap text-right">
									{(section.currency || 'CAD') === 'CAD'
										? cad(sumItems(section))
										: usd(sumItems(section))}
									<span class="text-[10px] text-gray2 font-normal"
										>≈ {usd(sectionUSD(section))}</span
									>
								</span>
							</div>

							{#if !section.collapsed}
								<div class="px-3 pb-3 space-y-1.5 border-t border-gray1/60 pt-2">
									{#each section.items as item (item.id)}
										<div class="flex items-center gap-2 {item.hidden ? 'opacity-40' : ''}">
											<input
												class="flex-1 min-w-[110px] bg-gray1 rounded-full px-3 h-7 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
												placeholder="Item"
												bind:value={item.label}
												on:focus={selectAll}
												on:input={changed}
											/>
											<input
												type="text"
												inputmode="decimal"
												use:moneyCellBare={item.amount}
												on:focus={stripFmt}
												on:input={(e) => {
													item.amount = parseMoney(e.currentTarget.value);
													changed();
												}}
												on:blur={(e) => (e.currentTarget.value = moneyFmtBare(item.amount))}
												class="w-24 shrink-0 bg-gray1 rounded-full px-3 h-7 text-sm text-white text-right font-mono whitespace-nowrap outline-none border border-transparent focus:border-lime/60 transition-colors"
												placeholder="0.00"
											/>
											<button
												class="text-gray2 hover:text-white transition shrink-0 cursor-pointer"
												on:click={() => toggleItemHidden(item)}
												aria-label={item.hidden
													? 'Show item (excluded from total)'
													: 'Hide item (included in total)'}
												title={item.hidden
													? 'Hidden — excluded from total'
													: 'Visible — included in total'}
											>
												{#if item.hidden}
													<svg
														class="w-4 h-4"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														><path
															d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-10-8-10-8a18.6 18.6 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 10 8 10 8a18.6 18.6 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"
														/><path d="M1 1l22 22" /></svg
													>
												{:else}
													<svg
														class="w-4 h-4"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														><path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8z" /><circle
															cx="12"
															cy="12"
															r="3"
														/></svg
													>
												{/if}
											</button>
											<button
												class="text-gray2 hover:text-problem transition shrink-0 cursor-pointer"
												on:click={() => removeItem(section, item.id)}
												aria-label="Remove item"
											>
												<svg
													class="w-4 h-4"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
												>
											</button>
										</div>
									{/each}
									<button
										class="text-xs text-gray2/70 hover:text-gray2 transition cursor-pointer"
										on:click={() => addItem(section)}
									>
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

				<!-- fixed footer: summary, opaque, never wraps -->
				<div class="border-t border-gray1 px-5 py-3 shrink-0 bg-navbar space-y-1.5">
					<div class="flex items-center justify-between gap-2 text-sm">
						<span
							class="text-[12px] font-bold uppercase tracking-wider text-gray3 whitespace-nowrap"
							>Fixed Costs</span
						>
						<span class="font-mono font-bold text-gray2 whitespace-nowrap">{usd(rightPoolUSD)}</span
						>
					</div>
					<div class="flex items-center justify-between gap-2 text-sm">
						<span
							class="text-[12px] font-bold uppercase tracking-wider text-gray3 whitespace-nowrap"
							>Show Expenses</span
						>
						<span class="font-mono font-bold text-problem whitespace-nowrap"
							>{usd(footerShowExpensesUSD)}</span
						>
					</div>
					<div
						class="flex items-center justify-between gap-2 pt-1.5 border-t border-gray1/60 text-sm"
					>
						<span
							class="text-[12px] font-bold uppercase tracking-wider text-gray3 whitespace-nowrap"
							>Revenue</span
						>
						<span class="font-mono font-bold text-confirmed whitespace-nowrap"
							>{usd(footerRevenueUSD)}</span
						>
					</div>
					<div
						class="flex items-center justify-between gap-2 pt-1.5 border-t border-gray1/60 text-sm"
					>
						<span
							class="text-[12px] font-bold uppercase tracking-wider text-gray3 whitespace-nowrap"
							>Merch Revenue</span
						>
						<span class="font-mono font-bold text-confirmed whitespace-nowrap"
							>{usd(colTotals.merch_revenue)}</span
						>
					</div>
					<div class="flex items-center justify-between gap-2 pt-1.5 border-t border-gray1/60">
						<span
							class="text-[12px] font-black uppercase tracking-wider text-white whitespace-nowrap"
							>Balance</span
						>
						<span
							class="text-lg font-black font-mono whitespace-nowrap {footerBalanceUSD >= 0
								? 'text-confirmed'
								: 'text-problem'}">{usd(footerBalanceUSD)}</span
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	/* ---- scrollbars: thinner + gray1, overriding any app-wide lime scrollbar theme ---- */
	/* Firefox */
	:global(.tour-budget),
	:global(.tour-budget *) {
		scrollbar-width: thin !important;
		scrollbar-color: var(--sb-thumb, #6b7280) transparent !important;
	}
	/* Chrome/Safari/Edge — targets every scrollbar inside this component, not just .custom-scrollbar,
	   so nothing here can fall back to a global lime rule. */
	:global(.tour-budget ::-webkit-scrollbar) {
		width: 3px !important;
		height: 3px !important;
	}
	:global(.tour-budget ::-webkit-scrollbar-track) {
		background: transparent !important;
	}
	:global(.tour-budget ::-webkit-scrollbar-thumb) {
		background: var(--sb-thumb, #6b7280) !important;
		border-radius: 1.5px !important;
	}
	:global(.tour-budget ::-webkit-scrollbar-thumb:hover) {
		background: var(--sb-thumb, #6b7280) !important;
		opacity: 0.8;
	}

	/* Safety net: if any native number input is ever re-added, keep it arrow-free.
	   :global so Svelte doesn't strip it as "unused" now that all money fields are text inputs. */
	:global(.tour-budget input[type='number']::-webkit-outer-spin-button),
	:global(.tour-budget input[type='number']::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		margin: 0;
	}
	:global(.tour-budget input[type='number']) {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
