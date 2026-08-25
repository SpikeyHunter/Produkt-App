<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { slide } from 'svelte/transition';
	import { computeArtistPayout, includedTalentDeals } from '$lib/components/calendar/page/tabs/deals/dealEngine';

	export let isSidebarOpen: boolean;
	export let userRole: string;
	export let event: any = null;
	let channel: any;

	$: isEditor = ['Editor', 'Admin'].includes(userRole);

	// Hold/Confirmed open on Internal (Prism-style EST | POTENTIAL); once the
	// event is In Settlement/Settled the sidebar opens on External.
	let budgetTab: 'Internal' | 'External' = 'Internal';
	const budgetTabs: Array<'Internal' | 'External'> = ['Internal', 'External'];
	$: statusLocked = ['IN SETTLEMENT', 'SETTLED'].includes(event?.status);
	let budgetTabSeeded = false;
	$: if (!budgetTabSeeded && event?.status) {
		budgetTabSeeded = true;
		budgetTab = statusLocked ? 'External' : 'Internal';
	}

	// Collapsible sections (mirror Prism's accordions)
	let openSections: Record<string, boolean> = {
		gross: true,
		taxes: false,
		expenses: true
	};
	const toggle = (key: string) => (openSections[key] = !openSections[key]);

	// ---------- Formatters ----------
	const fmt = (amount: number, code: string = 'CAD') => {
		try {
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: code,
				currencyDisplay: 'narrowSymbol'
			}).format(Math.abs(amount) || 0);
			const s = `${code}${num}`;
			return amount < 0 ? `(${s})` : s;
			// Prism shows expenses/negatives in parentheses
		} catch (e) {
			return `CAD$${amount || 0}`;
		}
	};
	const fmtPlain = (amount: number, code: string = 'CAD') => {
		try {
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: code,
				currencyDisplay: 'narrowSymbol'
			}).format(amount || 0);
			return `${code}${num}`;
		} catch (e) {
			return `CAD$${amount || 0}`;
		}
	};
	const fmtInt = (n: number) =>
		new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);

	// Negative values render in the `problem` color, otherwise white.
	const valColor = (n: number) => (n < 0 ? 'text-problem' : 'text-white');

	function parseJSON(val: any) {
		if (!val) return {};
		if (typeof val === 'object') return val;
		let p = val,
			i = 0;
		while (typeof p === 'string' && i < 3) {
			try {
				p = JSON.parse(p);
			} catch (e) {
				break;
			}
			i++;
		}
		return typeof p === 'object' && p !== null ? p : {};
	}

	// ---------- Version & Data Management ----------
	let viewedVersionNum = 0;
	let overrideData: any = null;
	let _currentEventId: number | string | null = null;
	$: eventId = event?.id || event?.group_id;

	// Safely initialize viewedVersionNum matching currentVersionNum without glitching
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: if (viewedVersionNum === 0 && currentVersionNum !== 0) {
		viewedVersionNum = currentVersionNum;
	}

	// Reset when navigating to a new event: seed from the page snapshot for an
	// instant paint, then always confirm against the DB — the snapshot goes
	// stale as soon as any tab saves its edits.
	$: if (eventId && String(eventId) !== String(_currentEventId)) {
		_currentEventId = eventId;
		viewedVersionNum = currentVersionNum;
		overrideData = null;
		applyData(event?.calendar_data, eventId);
		if (typeof window !== 'undefined') {
			setupRealtime();
			loadData();
		}
	}

	let currentRevenue: any = {};
	let currentCost: any = {};
	let currentDeal: any = {};
	let lastSig = '';


	function applyData(calData: any, _id: any) {
		// Build a cheap signature so we don't loop on identical data.
		const sig = calData
			? JSON.stringify([calData.event_revenue, calData.event_cost, calData.event_deal])
			: '';
		if (calData && sig && sig !== lastSig) {
			lastSig = sig;
			currentRevenue = calData.event_revenue;
			currentCost = calData.event_cost;
			currentDeal = calData.event_deal;
		} else if (!calData && eventId) {
			// Page didn't attach calendar_data — fetch it ourselves.
			loadData();
		}
	}

	async function loadData() {
		const targetId = event?.group_id || event?.id;
		if (!targetId || !viewedVersionNum) return;

		const { data: dbData, error } = await supabase
			.from('calendar_data')
			.select('event_revenue, event_cost, event_deal')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum) // Fetch the viewed version specifically
			.single();

		if (error) {
			console.warn('EventSidebar: calendar_data fetch failed', error);
			return;
		}
		if (dbData) {
			lastSig = JSON.stringify([dbData.event_revenue, dbData.event_cost, dbData.event_deal]);
			currentRevenue = dbData.event_revenue;
			currentCost = dbData.event_cost;
			currentDeal = dbData.event_deal;
		}
	}

	function handleSwitchVersion(e: Event) {
		const customEvent = e as CustomEvent<{ versionNum: number | string; calendarData: any; isGlobalChange?: boolean }>;
		viewedVersionNum = Number(customEvent.detail.versionNum);

		if (customEvent.detail.isGlobalChange) {
			// Permanent change, drop override and fetch the new base
			overrideData = null;
			loadData();
		} else if (customEvent.detail.calendarData) {
			// Previewing an alternate version
			overrideData = customEvent.detail.calendarData;
			applyData(overrideData, eventId);
		} else {
			// Fallback: Drop override and fetch specifically
			overrideData = null;
			loadData();
		}
		
		// Setup realtime for the newly viewed version
		setupRealtime();
	}

	// ---------- Core computation ----------
	$: model = computeModel(currentRevenue, currentCost, currentDeal, budgetTab);

	// Settlement vs Actual wording on the right column.
	// Internal tab -> "ACTUAL"; External tab -> "SETTLEMENT" (matches your screenshots).
	$: rightLabel =
		budgetTab === 'Internal' ? (statusLocked ? 'ACTUAL' : 'POTENTIAL') : 'SETTLEMENT';

	function computeModel(revenueData: any, costData: any, dealData: any, tab: 'Internal' | 'External') {
		const revenue = parseJSON(revenueData);
		const cost = parseJSON(costData);
		const deal = parseJSON(dealData);

		const currency = revenue?.financials?.currency || 'CAD';
		const financials = revenue?.financials || { taxRate: 0, taxType: 'Divisor', facilityFee: 0 };
		const tickets: any[] = Array.isArray(revenue?.tickets) ? revenue.tickets : [];

		// FX rate: in Settlement/Settled prefer the Settlement Rate (custom or
		// stamped at settlement generation); otherwise the Offer Rate chain
		// (matches the Pro Forma engine and the deals tab).
		const sidebarLocked = ['IN SETTLEMENT', 'SETTLED'].includes(event?.status);
		const custom = deal?.useCustomRate === true;
		const settleCustom = Number(deal?.customSettlementRate) || Number(deal?.customRate);
		const exchangeRate =
			(sidebarLocked &&
				((custom && settleCustom) ||
					Number(deal?.headliner_deal?.savedSettlementRate) ||
					Number(deal?.lockedExchangeRate))) ||
			(custom && Number(deal?.customRate)) ||
			Number(deal?.customRate) ||
			1;

		// Pre-settlement, the Internal tab's right column shows POTENTIAL
		// (sellout) numbers, matching Prism; in settlement it shows actuals.
		const usePotential = tab === 'Internal' && !sidebarLocked;

		// --- Per-ticket rows: estimated vs actual gross + breakeven counts ---
		const ticketRows = tickets
			.filter((t) => Number(t.price) > 0) // skip comps row in the priced breakdown
			.map((t) => {
				const price = Number(t.price) || 0;
				const allotment = Number(t.allotment) || 0;
				const comps = Number(t.comps) || 0;
				const kills = Number(t.kills) || 0;
				const sellable = allotment - comps - kills;
				const estSold = t.estSold != null ? Number(t.estSold) : sellable;
				const sold =
					tab === 'External' && t.extSold != null && t.extSold !== ''
						? Number(t.extSold) || 0
						: Number(t.sold) || 0;
				return {
					name: t.name,
					price,
					estimated: estSold * price,
					actual: (usePotential ? sellable : sold) * price
				};
			});

		// --- Gross totals ---
		let estGross = 0,
			actGross = 0,
			potentialGross = 0;
		let estTicketFees = 0,
			actTicketFees = 0,
			potTicketFees = 0;

		tickets.forEach((t) => {
			const price = Number(t.price) || 0;
			const allotment = Number(t.allotment) || 0;
			const comps = Number(t.comps) || 0;
			const kills = Number(t.kills) || 0;
			const sellable = allotment - comps - kills;
			const estSold = t.estSold != null ? Number(t.estSold) : sellable;
			const sold =
				tab === 'External' && t.extSold != null && t.extSold !== ''
					? Number(t.extSold) || 0
					: Number(t.sold) || 0;
			const fees = (Number(t.ticketFees) || 0) + (Number(financials.facilityFee) || 0);

			estGross += estSold * price;
			actGross += sold * price;
			potentialGross += sellable * price;
			estTicketFees += estSold * fees;
			actTicketFees += sold * fees;
			potTicketFees += sellable * fees;
		});

		// --- Taxes (same logic as the Pro Forma engine) ---
		const taxRate = Number(financials.taxRate) || 0;
		const computeTax = (gross: number, fees: number) => {
			const taxable = gross - fees;
			let tax = 0;
			if (taxRate > 0) {
				tax =
					financials.taxType === 'Multiplier'
						? taxable * (taxRate / 100)
						: taxable - taxable / (1 + taxRate / 100);
			}
			return fees + tax; // taxes & fees combined
		};
		const estTaxesFees = computeTax(estGross, estTicketFees);
		const actTaxesFees = computeTax(actGross, actTicketFees);
		const estNetGross = estGross - estTaxesFees;
		const actNetGross = actGross - actTaxesFees;
		const potTaxesFees = computeTax(potentialGross, potTicketFees);
		const potNetGross = potentialGross - potTaxesFees;

		// --- Expenses ---
		// Artist payout is computed below via the shared deal engine, AFTER costs
		// are known (Versus/Plus backends depend on costs).
		const hd = deal?.headliner_deal || {};
		const headlinerName = deal?.headliner_name || 'Headliner';

		// Fixed costs. Estimated side: Internal tab -> the internal estimates;
		// External tab -> the reported offer budget (qty x cost). Right side:
		// Internal -> actuals (with fallback chain); External -> settlement.
		const fixedCosts = Array.isArray(cost?.fixedCosts) ? cost.fixedCosts : [];
		let intEstFixed = 0,
			budEstFixed = 0,
			actFixed = 0;

		fixedCosts.forEach((g: any) => {
			const arr = Array.isArray(g.costs) ? g.costs : [];
			arr.forEach((c: any) => {
				intEstFixed += Number(c.estimatedInternal) || 0;
				if (c.reported !== false) budEstFixed += (Number(c.qty) || 0) * (Number(c.cost) || 0);
				actFixed +=
					tab === 'Internal'
						? Number(c.actualInternal) ||
							Number(c.externalSettlement) ||
							Number(c.estimatedInternal) ||
							0
						: Number(c.externalSettlement) || 0;
			});
		});
		const estFixed = tab === 'Internal' ? intEstFixed : budEstFixed;

		// Variable costs
		const variableCosts = Array.isArray(cost?.variableCosts) ? cost.variableCosts : [];
		const sumVariable = (
			gross: number,
			net: number,
			paid: number,
			useActual: boolean,
			amountField: 'internalAmount' | 'externalAmount' = 'internalAmount'
		) => {
			let total = 0;
			variableCosts.forEach((v: any) => {
				const m = Number(v[amountField]) || 0;
				switch (v.type) {
					case 'Flat':
						total += useActual
							? (tab === 'Internal'
									? Number(v.actualInternal) || Number(v.externalSettlement) || m
									: Number(v.externalSettlement) || m)
							: m;
						break;
					case '% of Gross':
						total += (m / 100) * gross;
						break;
					case '% of Net Gross':
						total += (m / 100) * net;
						break;
					case '$ per Paid Ticket':
					case '$ per Attendee':
						total += m * paid;
						break;
				}
			});
			return total;
		};
		const estPaid = tickets.reduce((s, t) => {
			const a = Number(t.allotment) || 0,
				c = Number(t.comps) || 0,
				k = Number(t.kills) || 0;
			const est = t.estSold != null ? Number(t.estSold) : a - c - k;
			return s + est;
		}, 0);
		const actPaid = tickets.reduce(
			(s, t) =>
				s +
				(tab === 'External' && t.extSold != null && t.extSold !== ''
					? Number(t.extSold) || 0
					: Number(t.sold) || 0),
			0
		);
		const variableField = tab === 'Internal' ? 'internalAmount' : ('externalAmount' as const);
		const estVariable = sumVariable(estGross, estNetGross, estPaid, false, variableField);
		const actVariable = sumVariable(actGross, actNetGross, actPaid, true, variableField);

		// Additional support: budgeted always shown as ESTIMATED; right column uses actual
		// (fall back to 0 when actual not entered, matching the Pro Forma rule).
		const supportBudgeted = Number(deal?.additional_support_budgeted) || 0;
		const hasActualSupport =
			deal?.additional_support_actual !== null &&
			deal?.additional_support_actual !== undefined &&
			deal?.additional_support_actual !== '';
		const supportActual = hasActualSupport ? Number(deal.additional_support_actual) || 0 : 0;

		const potPaid = tickets.reduce((s, t) => {
			const a = Number(t.allotment) || 0,
				c = Number(t.comps) || 0,
				k = Number(t.kills) || 0;
			return s + (a - c - k);
		}, 0);
		const potVariable = sumVariable(potentialGross, potNetGross, potPaid, false);

		// The right column's inputs: potential (sellout) pre-settlement on the
		// Internal tab, otherwise the actual/settlement figures.
		const rGross = usePotential ? potentialGross : actGross;
		const rTaxesFees = usePotential ? potTaxesFees : actTaxesFees;
		const rNetGross = usePotential ? potNetGross : actNetGross;
		const rPaid = usePotential ? potPaid : actPaid;
		const rFixed = usePotential ? estFixed : actFixed;
		const rVariable = usePotential ? potVariable : actVariable;
		const rSupport = usePotential ? supportBudgeted : supportActual;

		const baseEstCosts = estFixed + estVariable + supportBudgeted;
		const baseActCosts = rFixed + rVariable + rSupport;

		const totalAllotment = tickets.reduce((s, t) => s + (Number(t.allotment) || 0), 0);

		// Other deals that count as talent expenses: co-headliners plus support
		// deals with "Include in Headliner Deal" on.
		const rateFor = (d: any) =>
			(sidebarLocked &&
				((custom && settleCustom) ||
					Number(d?.savedSettlementRate) ||
					Number(deal?.lockedExchangeRate))) ||
			(custom && Number(deal?.customRate)) ||
			Number(d?.savedExchangeRate) ||
			Number(deal?.customRate) ||
			1;
		const extraTalent = includedTalentDeals(deal).map((x) => {
			const r = rateFor(x.deal);
			const mk = (g: number, ng: number, c: number, paid: number) =>
				computeArtistPayout(
					{ dealType: x.deal.dealType, guaranteeAmount: x.deal.guaranteeAmount, details: x.deal.details },
					{ gross: g, netGross: ng, costs: c, paidTickets: paid, totalAllotment, exchangeRate: r }
				);
			return {
				name: x.name,
				est: mk(estGross, estNetGross, baseEstCosts, estPaid),
				act: mk(rGross, rNetGross, baseActCosts, rPaid)
			};
		});
		const extraEst = extraTalent.reduce((s, t) => s + t.est, 0);
		const extraAct = extraTalent.reduce((s, t) => s + t.act, 0);

		// The headliner's split point includes the other talent as an expense.
		const estCosts = baseEstCosts + extraEst;
		const actCosts = baseActCosts + extraAct;
		const estPayout = computeArtistPayout(hd, {
			gross: estGross,
			netGross: estNetGross,
			costs: estCosts,
			paidTickets: estPaid,
			totalAllotment,
			exchangeRate
		});
		const actPayout = computeArtistPayout(hd, {
			gross: rGross,
			netGross: rNetGross,
			costs: actCosts,
			paidTickets: rPaid,
			totalAllotment,
			exchangeRate
		});
		const estExpenses = estPayout + estCosts;
		const actExpenses = actPayout + actCosts;

		// Prism's sidebar lists talent + variable + support only — fixed costs
		// stay out of the displayed Expenses/NET on BOTH tabs (they still count
		// in the split-point basis above), so NET (Est.) matches across tabs.
		const estExpensesDisplay = estExpenses - estFixed;
		const actExpensesDisplay = actExpenses - rFixed;

		const talentRows = [
			{ name: headlinerName, est: estPayout, act: actPayout },
			...extraTalent
		];

		const estNet = estNetGross - estExpensesDisplay;
		const actNet = rNetGross - actExpensesDisplay;

		// --- Show Health bar: estimated gross pre-settlement, actual after;
		// the expense marker mirrors Prism's internal expenses (no fixed).
		// Always computed on the INTERNAL basis so it never shifts with the tab. ---
		const healthGross = sidebarLocked ? actGross : estGross;
		const intEstVariable =
			tab === 'Internal'
				? estVariable
				: sumVariable(estGross, estNetGross, estPaid, false, 'internalAmount');
		const healthBase = intEstFixed + intEstVariable + supportBudgeted;
		const healthExtras = includedTalentDeals(deal).reduce(
			(sum, x) =>
				sum +
				computeArtistPayout(
					{ dealType: x.deal.dealType, guaranteeAmount: x.deal.guaranteeAmount, details: x.deal.details },
					{
						gross: estGross,
						netGross: estNetGross,
						costs: healthBase,
						paidTickets: estPaid,
						totalAllotment,
						exchangeRate: rateFor(x.deal)
					}
				),
			0
		);
		const healthPayout = computeArtistPayout(hd, {
			gross: estGross,
			netGross: estNetGross,
			costs: healthBase + healthExtras,
			paidTickets: estPaid,
			totalAllotment,
			exchangeRate
		});
		const healthExpenses = healthPayout + healthExtras + intEstVariable + supportBudgeted;
		const maxBar = Math.max(potentialGross, healthGross, healthExpenses, 1);
		const flagPositive = healthGross - healthExpenses >= 0;

		return {
			currency,
			headlinerName,
			potentialGross,
			ticketRows,
			gross: { est: estGross, act: rGross },
			taxes: { est: estTaxesFees, act: rTaxesFees },
			netGross: { est: estNetGross, act: rNetGross },
			expenses: { est: estExpensesDisplay, act: actExpensesDisplay },
			guaranteeRow: { est: estPayout, act: actPayout },
			talentRows,
			variableRow: { est: estVariable, act: rVariable },
			supportRow: { est: supportBudgeted, act: rSupport },
			net: { est: estNet, act: actNet },
			health: {
				actualGross: healthGross,
				grossLabel: sidebarLocked ? '(Act.)' : '(Est.)',
				expenses: healthExpenses,
				actualPct: Math.min((healthGross / maxBar) * 100, 100) || 0,
				expensePct: Math.min((healthExpenses / maxBar) * 100, 100) || 0,
				flagPositive
			}
		};
	}

	// ---------- Realtime ----------
	function setupRealtime() {
		if (channel) supabase.removeChannel(channel);
		
		const targetId = event?.group_id || event?.id;
		if (!targetId || !viewedVersionNum) return;

		channel = supabase
			.channel(`sidebar-health-${targetId}-${viewedVersionNum}`)
			.on(
				'postgres_changes',
				{
					event: '*', // INSERT or UPDATE
					schema: 'public',
					table: 'calendar_data',
					filter: `calendar_id=eq.${targetId}`
				},
				(payload) => {
					const row: any = payload.new;
					if (!row) return;
					// Ignore other versions of the same calendar.
					if (row.version_number != null && row.version_number !== viewedVersionNum) return;
					// Realtime payloads omit unchanged JSON (TOASTed) columns — e.g. a
					// Costs-tab save arrives without event_revenue. Never overwrite
					// with a partial row; refetch the full row instead.
					loadData();
				}
			)
			.subscribe();
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('switchViewedVersion', handleSwitchVersion);
		}
		setupRealtime();
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('switchViewedVersion', handleSwitchVersion);
		}
		if (channel) supabase.removeChannel(channel);
	});
</script>

<div
	class="transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 {isSidebarOpen
		? 'w-[340px] opacity-100'
		: 'w-0 opacity-0'}"
>
	<div
		class="w-[340px] h-full bg-navbar border-l border-gray2/10 shadow-sm flex flex-col overflow-hidden rounded-xl"
	>
		<div class="flex-1 overflow-y-auto custom-scrollbar">
			<div class="px-4 py-7 border-b border-gray2/10">
				<h3 class="text-xs font-black text-lime uppercase tracking-widest mb-6">Show Health</h3>

				<div class="text-[12px] text-center text-gray2 mb-10 font-medium leading-relaxed">
					<strong class="text-white">Total Gross {model.health.grossLabel}</strong> out of
					<span class="text-white font-bold">{fmtPlain(model.potentialGross, model.currency)}</span>
					Potential Gross
				</div>

				<div class="relative w-full h-2 bg-white/10 rounded-full mb-4 mt-8">
					<div
						class="absolute top-0 left-0 h-full {model.health.flagPositive
							? 'bg-confirmed'
							: 'bg-problem'} rounded-full transition-all duration-300"
						style="width: {model.health.actualPct}%;"
					></div>

					<div class="absolute bottom-full" style="left: {model.health.actualPct}%; z-index: 10;">
						<div
							class="w-[4px] h-8 absolute bottom-0 left-0 -translate-x-1 translate-y-2 rounded-full {model
								.health.flagPositive
								? 'bg-confirmed'
								: 'bg-problem'}"
						></div>
						<div
							class="absolute bottom-2 left-0 whitespace-nowrap"
							style="transform: translateX(-{model.health.actualPct}%);"
						>
							<div
								class="text-[11px] font-extrabold px-1.5 py-0.5 rounded {model.health.flagPositive
									? 'bg-confirmed text-black'
									: 'bg-problem text-black'}"
							>
								{fmtPlain(model.health.actualGross, model.currency)}
							</div>
						</div>
					</div>

					<div class="absolute top-full" style="left: {model.health.expensePct}%; z-index: 10;">
						<div
							class="w-[2px] h-4 absolute top-0 left-0 -translate-x-1 -translate-y-2 rounded-full bg-white"
						></div>
						<div
							class="absolute top-2 left-0 whitespace-nowrap"
							style="transform: translateX(-{model.health.expensePct}%);"
						>
							<div class="text-gray2 text-[10px] font-bold">
								<span class="text-white">{fmtPlain(model.health.expenses, model.currency)}</span>
								Expenses (Est.)
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="px-4 py-7 border-b border-gray2/10">
				<h3 class="text-xs font-black text-lime uppercase tracking-widest mb-5">Budget Summary</h3>

				<div class="flex border-b border-gray1 mb-4">
					{#each budgetTabs as tab}
						<button
							class="flex-1 pb-3 text-sm font-bold transition-colors relative cursor-pointer {budgetTab ===
							tab
								? 'text-lime'
								: 'text-gray2 hover:text-white'}"
							on:click={() => (budgetTab = tab)}
						>
							{tab}
							{#if budgetTab === tab}
								<div class="absolute bottom-0 left-0 w-full h-[2px] bg-lime rounded-t-full"></div>
							{/if}
						</button>
					{/each}
				</div>

				<div class="bg-gray1/30 rounded-lg mb-3 overflow-hidden">
					<button
						class="w-full flex items-center justify-between px-3 py-3 text-left cursor-pointer"
						on:click={() => toggle('gross')}
					>
						<span class="text-sm font-bold text-lime">Gross Ticket Revenue</span>
						<svg
							class="w-4 h-4 text-gray2 transition-transform {openSections.gross ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					</button>

					<div class="px-3 pb-3">
						<div class="grid grid-cols-2 gap-2 pb-3">
							<div class="text-center">
								<div class="text-sm font-bold {valColor(model.gross.est)}">
									{fmt(model.gross.est, model.currency)}
								</div>
								<div class="text-[10px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
							</div>
							<div class="text-center">
								<div class="text-sm font-bold {valColor(model.gross.act)}">
									{fmt(model.gross.act, model.currency)}
								</div>
								<div class="text-[10px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
							</div>
						</div>

						{#if openSections.gross}
							<div transition:slide|local class="flex flex-col gap-3 pt-1">
								{#each model.ticketRows as r}
									<div>
										<div class="text-[12px] text-lime font-semibold mb-1">
											{r.name} | {fmtPlain(r.price, model.currency)}
										</div>
										<div class="grid grid-cols-2 gap-2">
											<div class="text-center">
												<div class="text-sm font-bold {valColor(r.estimated)}">
													{fmt(r.estimated, model.currency)}
												</div>
												<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
											</div>
											<div class="text-center">
												<div class="text-sm font-bold {valColor(r.actual)}">
													{fmt(r.actual, model.currency)}
												</div>
												<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="px-3 py-3 mb-3">
					<div class="text-sm font-bold text-lime mb-2">Taxes and Fees</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="text-center">
							<div class="text-sm font-bold {valColor(-model.taxes.est)}">
								{fmt(-model.taxes.est, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
						</div>
						<div class="text-center">
							<div class="text-sm font-bold {valColor(-model.taxes.act)}">
								{fmt(-model.taxes.act, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
						</div>
					</div>
				</div>

				<div class="px-3 py-3 mb-3 border-t border-gray1/40">
					<div class="text-sm font-bold text-lime mb-2">Net Gross</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="text-center">
							<div class="text-sm font-bold {valColor(model.netGross.est)}">
								{fmt(model.netGross.est, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
						</div>
						<div class="text-center">
							<div class="text-sm font-bold {valColor(model.netGross.act)}">
								{fmt(model.netGross.act, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
						</div>
					</div>
				</div>

				<div class="bg-gray1/30 rounded-lg mb-3 overflow-hidden">
					<button
						class="w-full flex items-center justify-between px-3 py-3 text-left cursor-pointer"
						on:click={() => toggle('expenses')}
					>
						<span class="text-sm font-bold text-lime">Expenses</span>
						<svg
							class="w-4 h-4 text-gray2 transition-transform {openSections.expenses ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					</button>

					<div class="px-3 pb-3">
						<div class="grid grid-cols-2 gap-2 pb-3">
							<div class="text-center">
								<div class="text-sm font-bold {valColor(-model.expenses.est)}">
									{fmt(-model.expenses.est, model.currency)}
								</div>
								<div class="text-[10px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
							</div>
							<div class="text-center">
								<div class="text-sm font-bold {valColor(-model.expenses.act)}">
									{fmt(-model.expenses.act, model.currency)}
								</div>
								<div class="text-[10px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
							</div>
						</div>

						{#if openSections.expenses}
							<div transition:slide|local class="flex flex-col gap-3 pt-1">
								{#each model.talentRows as tr (tr.name)}
									<div>
										<div class="text-[12px] text-lime font-semibold mb-1">{tr.name}</div>
										<div class="grid grid-cols-2 gap-2">
											<div class="text-center">
												<div class="text-sm font-bold {valColor(-tr.est)}">
													{fmt(-tr.est, model.currency)}
												</div>
												<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
											</div>
											<div class="text-center">
												<div class="text-sm font-bold {valColor(-tr.act)}">
													{fmt(-tr.act, model.currency)}
												</div>
												<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
											</div>
										</div>
									</div>
								{/each}
								<div>
									<div class="text-[12px] text-lime font-semibold mb-1">Variable Costs</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="text-center">
											<div class="text-sm font-bold {valColor(-model.variableRow.est)}">
												{fmt(-model.variableRow.est, model.currency)}
											</div>
											<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
										</div>
										<div class="text-center">
											<div class="text-sm font-bold {valColor(-model.variableRow.act)}">
												{fmt(-model.variableRow.act, model.currency)}
											</div>
											<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
										</div>
									</div>
								</div>
								<div>
									<div class="text-[12px] text-lime font-semibold mb-1">Additional Support</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="text-center">
											<div class="text-sm font-bold {valColor(-model.supportRow.est)}">
												{fmt(-model.supportRow.est, model.currency)}
											</div>
											<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
										</div>
										<div class="text-center">
											<div class="text-sm font-bold {valColor(-model.supportRow.act)}">
												{fmt(-model.supportRow.act, model.currency)}
											</div>
											<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="px-3 py-3 border-t border-gray1/40">
					<div class="text-sm font-black text-lime mb-2 tracking-wide">NET</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="text-center">
							<div class="text-sm font-black {model.net.est >= 0 ? 'text-confirmed' : 'text-problem'}">
								{fmt(model.net.est, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">ESTIMATED</div>
						</div>
						<div class="text-center">
							<div class="text-sm font-black {model.net.act >= 0 ? 'text-confirmed' : 'text-problem'}">
								{fmt(model.net.act, model.currency)}
							</div>
							<div class="text-[9px] font-bold text-gray2 tracking-wider">{rightLabel}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
	}
	:global(.custom-scrollbar::-webkit-scrollbar) {
		width: 3px;
	}
	:global(.custom-scrollbar::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.custom-scrollbar::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.12);
		border-radius: 999px;
	}
</style>