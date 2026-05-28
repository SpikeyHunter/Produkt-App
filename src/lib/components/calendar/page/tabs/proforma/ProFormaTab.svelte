<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { slide } from 'svelte/transition';
	import FinancialSummaryTable from './FinancialSummaryTable.svelte';

	export let userRole: string = 'Email Only';
	export let event: any = null;

	$: hasAccess = ['Editor', 'Admin'].includes(userRole);
	$: eventId = event?.id || event?.group_id;

	let isInitialized = false;
	let isSaving = false;
	let saveTimeout: ReturnType<typeof setTimeout>;

	let currency: string = 'CAD';
	let eventRevenue: any = {};
	let eventCost: any = {};
	let eventDeal: any = {};

	// Settlement-aware: only the ACTUAL column reacts to this. Projections stay budgeted.
	$: isSettlementMode = ['IN SETTLEMENT', 'SETTLED'].includes(event?.status);

	// Regenerate the ACTUAL column when status flips between budgeted/actual modes.
	$: if (isInitialized && isSettlementMode !== undefined) {
		generateProFormaData();
	}

	// UI States
	let isExpanded = true;
	let goalInput: number | null = null;
	let forecastInput: number | null = null;
	let breakevenDisplay: string = '0.00';

	let proFormaColumns: any[] = [];

	// Helper to safely parse JSON DB columns
	function parseData(val: any) {
		if (!val) return {};
		if (typeof val === 'object' && !Array.isArray(val)) return val;

		let parsed = val;
		let attempts = 0;
		while (typeof parsed === 'string' && attempts < 3) {
			try {
				parsed = JSON.parse(parsed);
			} catch (e) {
				break;
			}
			attempts++;
		}
		return typeof parsed === 'object' && parsed !== null ? parsed : {};
	}

	// Make data fetch reactive to eventId
	$: if (eventId) {
		loadData();
	}

	async function loadData() {
		const targetId = event?.group_id || event?.id;
		const currentVersion = event?.calendar?.current_version || 1;
		if (!targetId) return;

		const { data: dbData, error } = await supabase
			.from('calendar_data')
			.select('event_revenue, event_cost, event_deal, pro_forma')
			.eq('calendar_id', targetId)
			.eq('version_number', currentVersion)
			.single();

		if (error) {
			console.warn('Falling back to legacy query for calendar_data table...', error);
			const { data: fallbackData } = await supabase
				.from('calendar_data')
				.select('event_revenue, event_cost, event_deal')
				.eq('calendar_id', targetId)
				.eq('version_number', currentVersion)
				.single();

			if (fallbackData) processData(fallbackData);
		} else if (dbData) {
			processData(dbData);
		}
	}

	function processData(dbData: any) {
		eventRevenue = parseData(dbData.event_revenue);
		eventCost = parseData(dbData.event_cost);
		eventDeal = parseData(dbData.event_deal);

		let proFormaData = dbData.pro_forma ? parseData(dbData.pro_forma) : {};

		goalInput = proFormaData.goal || null;
		forecastInput = proFormaData.forecast || null;

		generateProFormaData();
		isInitialized = true;
	}

	function triggerSave() {
		if (!isInitialized || !hasAccess || !eventId) return;

		generateProFormaData();

		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			isSaving = true;
			const payload = { goal: goalInput, forecast: forecastInput };

			try {
				const targetId = event?.group_id || event?.id;
				const currentVersion = event?.calendar?.current_version || 1;
				await supabase
					.from('calendar_data')
					.update({ pro_forma: payload })
					.eq('calendar_id', targetId)
					.eq('version_number', currentVersion);
			} catch (error) {
				console.error('Error saving pro forma data:', error);
			} finally {
				isSaving = false;
			}
		}, 500);
	}

	// --- MATHEMATICAL ALGORITHM ENGINE (PRISM MATCHED) ---
	function calculateScenario(
		percentage: number,
		isActual: boolean = false,
		useActualSupport: boolean = false
	) {
		const tickets = Array.isArray(eventRevenue?.tickets) ? eventRevenue.tickets : [];
		const financials = eventRevenue?.financials || {
			taxRate: 0,
			taxType: 'Divisor',
			facilityFee: 0
		};

		const fixedCosts = Array.isArray(eventCost?.fixedCosts) ? eventCost.fixedCosts : [];
		const variableCosts = Array.isArray(eventCost?.variableCosts) ? eventCost.variableCosts : [];

		let paidTickets = 0;
		let grossRevenue = 0;
		let ticketFeesTotal = 0;

		// 1. Calculate Quantities & Gross
		tickets.forEach((t: any) => {
			const allotment = Number(t.allotment ?? t.Allotment) || 0;
			const comps = Number(t.comps ?? t.Comps) || 0;
			const kills = Number(t.kills ?? t.Kills) || 0;
			const price = Number(t.price ?? t.Price) || 0;
			const ticketFees = Number(t.ticketFees ?? t.ticket_fees ?? t['Ticket fees']) || 0;

			const sellable = allotment - comps - kills;
			// Actuals use literal tickets sold, Pro Forma scales the sellable
			const simSold = isActual ? Number(t.sold ?? t.Sold) || 0 : sellable * (percentage / 100);

			paidTickets += simSold;
			grossRevenue += simSold * price;
			ticketFeesTotal += simSold * (ticketFees + (Number(financials.facilityFee) || 0));
		});

		// 2. Calculate Taxes
		let taxes = 0;
		const taxable = grossRevenue - ticketFeesTotal;
		const taxRate = Number(financials.taxRate) || 0;

		if (taxRate > 0) {
			if (financials.taxType === 'Multiplier') {
				taxes = taxable * (taxRate / 100);
			} else {
				taxes = taxable - taxable / (1 + taxRate / 100);
			}
		}

		const taxesAndFees = ticketFeesTotal + taxes;
		const netGross = grossRevenue - taxesAndFees;
		const additionalRevenue = 0;

		// 3. Total Expenses (Internal Costs ONLY, BEFORE Artist Payout)
		let fixedTotal = 0;
		fixedCosts.forEach((g: any) => {
			const costsArray = Array.isArray(g.costs) ? g.costs : [];
			costsArray.forEach((c: any) => {
				// PRISM logic: Actuals use `actualInternal`, Estimates use `estimatedInternal`
				fixedTotal += Number(isActual ? c.actualInternal : c.estimatedInternal) || 0;
			});
		});

		let variableTotal = 0;
		variableCosts.forEach((v: any) => {
			const multiplier = Number(v.internalAmount) || 0;
			switch (v.type) {
				case 'Flat':
					variableTotal += isActual ? Number(v.actualInternal) || multiplier : multiplier;
					break;
				case '% of Gross':
					variableTotal += (multiplier / 100) * grossRevenue;
					break;
				case '% of Net Gross':
					variableTotal += (multiplier / 100) * netGross;
					break;
				case '$ per Paid Ticket':
					variableTotal += multiplier * paidTickets;
					break;
				case '$ per Attendee':
					variableTotal += multiplier * paidTickets;
					break;
			}
		});

		const expensesBeforeArtist = fixedTotal + variableTotal;
		const netProfitBeforeArtist = netGross + additionalRevenue - expensesBeforeArtist;

		// 4. Artist Deal Calculation (Guarantee + Backend)
		const headlinerDeal = eventDeal?.headliner_deal || {};
		let artistPayout = 0;

		// Exchange rate: prefer the deal's customRate (when useCustomRate is on), then any explicit
		// exchangeRate field, then the raw customRate, then 1. The DB stores customRate at the
		// eventDeal level (not inside headliner_deal), e.g. customRate: 1.3844, useCustomRate: true.
		const exchangeRate =
			(eventDeal?.useCustomRate && Number(eventDeal?.customRate)) ||
			Number(headlinerDeal?.exchangeRate) ||
			Number(eventDeal?.customRate) ||
			1;

		const dealType = headlinerDeal.dealType || 'Flat';
		const guarantee = (Number(headlinerDeal.guaranteeAmount) || 0) * exchangeRate;

		const metricType = headlinerDeal.details?.metricType || 'Flat';
		const metricAmount = Number(headlinerDeal.details?.metricAmount) || 0;
		const splitPoint = (Number(headlinerDeal.details?.splitPointAmount) || 0) * exchangeRate;

		let backend = 0;
		// Backend (Plus / Versus) is only triggered if Net Profit clears the split point
		if (netProfitBeforeArtist > splitPoint) {
			const overage = netProfitBeforeArtist - splitPoint;
			if (metricType === 'Flat') {
				backend = metricAmount * exchangeRate;
			} else if (metricType === '% of Net') {
				backend = overage * (metricAmount / 100);
			} else if (metricType === '% of Gross') {
				backend = grossRevenue * (metricAmount / 100);
			}
		}

		if (dealType === 'Plus') {
			artistPayout = guarantee + backend;
		} else if (dealType === 'Versus') {
			artistPayout = Math.max(guarantee, backend);
		} else {
			artistPayout = guarantee; // Flat
		}

		// Additional Support (separate from the artist guarantee in the offer model).
		// Budgeted by default; switch to actual when the show is in settlement.
		// If actual hasn't been filled in yet, fall back to the budgeted figure.
		const additionalSupportBudgeted = Number(eventDeal?.additional_support_budgeted) || 0;
		// Distinguish "actual not entered" (null/undefined) from "actual is genuinely 0".
		const hasActualSupport =
			eventDeal?.additional_support_actual !== null &&
			eventDeal?.additional_support_actual !== undefined &&
			eventDeal?.additional_support_actual !== '';
		const additionalSupportActual = hasActualSupport
			? Number(eventDeal.additional_support_actual) || 0
			: 0;
		// ACTUAL column: use actual support if it exists, otherwise NO support (not budgeted).
		// Projection columns: always budgeted.
		const additionalSupport = useActualSupport
			? additionalSupportActual
			: additionalSupportBudgeted;

		// 5. Final Calculations
		const totalExpenses = expensesBeforeArtist + artistPayout + additionalSupport;
		const netProfit = netGross + additionalRevenue - totalExpenses;

		return {
			paidTickets,
			grossRevenue,
			taxesAndFees,
			netGross,
			additionalRevenue,
			totalExpenses,
			netProfit
		};
	}

	function findBreakeven() {
		let p0 = calculateScenario(0, false, false).netProfit;
		let p100 = calculateScenario(100, false, false).netProfit;
		if (p0 === 0 && p100 === 0) return 0;
		let isIncreasing = p100 > p0;

		let low = 0;
		let high = 1000;

		for (let i = 0; i < 50; i++) {
			let mid = (low + high) / 2;
			let sim = calculateScenario(mid, false, false);

			if (isIncreasing) {
				if (sim.netProfit > 0) high = mid;
				else low = mid;
			} else {
				if (sim.netProfit > 0) low = mid;
				else high = mid;
			}
		}

		const breakeven = (low + high) / 2;
		if (breakeven > 999 || breakeven < 0.01) return 0;
		return breakeven;
	}

	function generateProFormaData() {
		const basePercentages = [100, 90, 80, 70, 60, 50, 40];
		const columns = [];

		basePercentages.forEach((p) => {
			columns.push({ label: `${p}%`, data: calculateScenario(p, false, false) });
		});

		if (goalInput !== null && goalInput > 0) {
			columns.push({
				label: `GOAL (${goalInput}%)`,
				data: calculateScenario(goalInput, false, false)
			});
		}
		if (forecastInput !== null && forecastInput > 0) {
			columns.push({
				label: `FORECAST (${forecastInput}%)`,
				data: calculateScenario(forecastInput, false, false)
			});
		}

		let totalSellable = 0;
		let totalSold = 0;
		const tickets = Array.isArray(eventRevenue?.tickets) ? eventRevenue.tickets : [];

		tickets.forEach((t: any) => {
			const allotment = Number(t.allotment ?? t.Allotment) || 0;
			const comps = Number(t.comps ?? t.Comps) || 0;
			const kills = Number(t.kills ?? t.Kills) || 0;
			const sold = Number(t.sold ?? t.Sold) || 0;

			totalSellable += allotment - comps - kills;
			totalSold += sold;
		});

		const actualPercentage = totalSellable > 0 ? (totalSold / totalSellable) * 100 : 0;
		columns.push({
			label: `ACTUAL (${actualPercentage.toFixed(2)}%)`,
			// Only this column reacts to status: actual support when IN SETTLEMENT / SETTLED,
			// otherwise budgeted (CONFIRMED / HOLD).
			data: calculateScenario(actualPercentage, true, isSettlementMode)
		});

		const breakeven = findBreakeven();
		breakevenDisplay = breakeven.toFixed(2);
		columns.push({
			label: `PRODUKT BREAKEVEN\n(${breakevenDisplay}%)`,
			data: calculateScenario(breakeven, false, false)
		});

		proFormaColumns = [...columns];
	}

	function downloadCSV() {
		const headerLabels = ['Line Item', ...proFormaColumns.map((c) => c.label)];
		const csvRows = [headerLabels.map((l) => `"${l}"`).join(',')];

		const rowsConfig = [
			{ id: 'paidTickets', label: 'Paid Tickets' },
			{ id: 'grossRevenue', label: 'Gross Ticket Revenue' },
			{ id: 'taxesAndFees', label: 'Taxes & Fees' },
			{ id: 'netGross', label: 'Net Gross' },
			{ id: 'additionalRevenue', label: 'Additional Revenue' },
			{ id: 'totalExpenses', label: 'Total Expenses' },
			{ id: 'netProfit', label: 'Net Profit' }
		];

		rowsConfig.forEach((row) => {
			const rowValues = [`"${row.label}"`];
			proFormaColumns.forEach((col) => {
				rowValues.push(col.data[row.id].toFixed(2));
			});
			csvRows.push(rowValues.join(','));
		});

		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', 'Pro_Forma_Export.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

{#if !hasAccess}
	<div class="flex-1 flex items-center justify-center p-6 bg-navbar">
		<p class="text-gray2 font-bold text-lg">You do not have permission to view this.</p>
	</div>
{:else}
	<div class="p-6 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-6 bg-navbar">
		{#if isInitialized}
			<section class="flex flex-col">
				<div
					class="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none px-4 py-3 rounded-t-xl transition-colors {isExpanded
						? 'bg-gray1/80'
						: 'hover:bg-gray1'}"
					role="button"
					tabindex="0"
					on:click={() => (isExpanded = !isExpanded)}
					on:keydown={(e) => e.key === 'Enter' && (isExpanded = !isExpanded)}
				>
					<div class="flex items-center gap-2">
						<svg
							class="w-6 h-6 text-lime transition-transform {isExpanded ? 'rotate-90' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
							></path>
						</svg>
						<h3 class="text-xl font-black text-white tracking-wide">Pro Forma Settings</h3>
					</div>

					<div class="flex items-center gap-3">
						<button
							on:click|stopPropagation={downloadCSV}
							class="flex items-center gap-2 px-4 py-2 bg-gray1 border border-navbar text-gray2 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:cursor-pointer hover:text-white transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								></path>
							</svg> CSV
						</button>
					</div>
				</div>

				{#if isExpanded}
					<div
						transition:slide|local
						class="px-4 py-6 rounded-b-xl border-t border-gray1/10 bg-gray1/40"
					>
						<div class="flex items-center gap-6">
							<div class="flex flex-col gap-1 w-24">
								<label for="breakeven-input" class="text-xs text-gray3 font-bold tracking-wider"
									>Breakeven</label
								>
								<div class="relative w-full">
									<input
										id="breakeven-input"
										type="text"
										disabled
										value={breakevenDisplay}
										class="w-full bg-gray1/50 border border-gray1/50 rounded-md px-3 py-1.5 text-sm text-lime focus:outline-none"
									/>
									<span class="absolute right-3 top-1.5 text-gray3 text-sm">%</span>
								</div>
							</div>

							<div class="flex flex-col gap-1 w-24">
								<label for="goal-input" class="text-xs text-gray3 font-bold tracking-wider"
									>Goal</label
								>
								<div class="relative w-full">
									<input
										id="goal-input"
										type="number"
										bind:value={goalInput}
										on:input={triggerSave}
										class="w-full bg-navbar border border-gray1 focus:border-lime rounded-md px-3 py-1.5 text-sm text-white focus:outline-none transition-colors"
									/>
									<span class="absolute right-3 top-1.5 text-gray3 text-sm">%</span>
								</div>
							</div>

							<div class="flex flex-col gap-1 w-24">
								<label for="forecast-input" class="text-xs text-gray3 font-bold tracking-wider"
									>Forecast</label
								>
								<div class="relative w-full">
									<input
										id="forecast-input"
										type="number"
										bind:value={forecastInput}
										on:input={triggerSave}
										class="w-full bg-navbar border border-gray1 focus:border-lime rounded-md px-3 py-1.5 text-sm text-white focus:outline-none transition-colors"
									/>
									<span class="absolute right-3 top-1.5 text-gray3 text-sm">%</span>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<div class="mt-8">
					<h4 class="text-xl font-black text-lime tracking-wide uppercase mb-4">
						Financial Summary
					</h4>
					<FinancialSummaryTable columns={proFormaColumns} {currency} />
				</div>
			</section>
		{/if}
	</div>
{/if}

<style>
	/* Hide scrollbar for Chrome, Safari and Opera */
	:global(.hide-scrollbar::-webkit-scrollbar) {
		display: none;
	}

	/* Hide scrollbar for IE, Edge and Firefox */
	:global(.hide-scrollbar) {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
