<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let isSidebarOpen: boolean;
	export let userRole: string;
	export let event: any = null;

	let channel: any;

	// Permission check
	$: isEditor = ['Editor', 'Admin'].includes(userRole);

	// Safe Currency Formatter
	const formatCurrency = (amount: number, currencyCode: string = 'CAD') => {
		try {
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: currencyCode,
				currencyDisplay: 'narrowSymbol'
			}).format(amount || 0);
			return `${currencyCode} ${num}`;
		} catch (e) {
			return `CAD $${amount || 0}`;
		}
	};

	// --- BULLETPROOF REACTIVITY ---
	// We track real-time updates separately.
	let realtimeRevenue: any = undefined;
	let realtimeCost: any = undefined;

	$: currentRevenue =
		realtimeRevenue !== undefined
			? realtimeRevenue
			: event?.calendar?.event_revenue || event?.event_revenue;
	$: currentCost =
		realtimeCost !== undefined ? realtimeCost : event?.calendar?.event_cost || event?.event_cost;

	// Reactively trigger the math WHENEVER currentRevenue or currentCost changes.
	$: calculateHealth(currentRevenue, currentCost);

	// --- MATH STATE ---
	let currency = 'CAD';
	let potentialGross = 0;
	let actualGross = 0;
	let expenses = 0;
	let flagValue = 0;
	let flagIsPositive = true;
	let maxBarValue = 1;
	let actualPercentage = 0;
	let expensePercentage = 0;

	// The calculation function
	function calculateHealth(revenueData: any, costData: any) {
		// 1. Safely parse and extract Expenses
		let parsedCost = costData;
		if (typeof parsedCost === 'string') {
			try {
				parsedCost = JSON.parse(parsedCost);
			} catch (e) {
				parsedCost = {};
			}
		}
		// Grab the first item in the cost array, default to 0 if missing
		expenses = Number(parsedCost?.total_cost?.[0]) || 0;

		// 2. Safely parse revenue
		let revenue = revenueData;
		if (typeof revenue === 'string') {
			try {
				revenue = JSON.parse(revenue);
			} catch (e) {
				revenue = {};
			}
		}

		const tickets = revenue?.tickets || [];

		if (revenue?.financials?.currency) {
			currency = revenue.financials.currency;
		}

		// 3. Calculate Grosses based on tickets
		let tempPotential = 0;
		let tempActual = 0;

		if (Array.isArray(tickets)) {
			tickets.forEach((t: any) => {
				const price = Number(t.price) || 0;
				const allotment = Number(t.allotment) || 0;
				const comps = Number(t.comps) || 0;
				const kills = Number(t.kills) || 0;
				const sold = Number(t.sold) || 0;

				const sellable = allotment - comps - kills;

				tempPotential += sellable * price;
				tempActual += sold * price;
			});
		}

		potentialGross = tempPotential;
		actualGross = tempActual;

		// 4. Progress Bar Calculations
		flagValue = actualGross - expenses;
		flagIsPositive = flagValue >= 0;

		maxBarValue = Math.max(potentialGross, actualGross, expenses, 1);
		actualPercentage = Math.min((actualGross / maxBarValue) * 100, 100) || 0;
		expensePercentage = Math.min((expenses / maxBarValue) * 100, 100) || 0;
	}

	// --- REALTIME SYNC ---
	onMount(() => {
		const targetId = event?.group_id || event?.id;
		if (!targetId) return;

		// Listen for changes made by the Revenue/Cost tabs in the background
		channel = supabase
			.channel(`sidebar-health-${targetId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'calendar',
					filter: `id=eq.${targetId}`
				},
				(payload) => {
					if (payload.new) {
						// This instantly updates the UI because of the $: currentRevenue block above!
						realtimeRevenue = payload.new.event_revenue;
						realtimeCost = payload.new.event_cost;
					}
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
	});
</script>

<div
	class="transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 {isSidebarOpen
		? 'w-[320px] opacity-100'
		: 'w-0 opacity-0'}"
>
	<div
		class="w-[320px] h-full bg-navbar border-l border-gray2/10 shadow-sm flex flex-col overflow-hidden rounded-xl"
	>
		<div class="px-6 py-8 border-b border-gray2/10 shrink-0">
			<h3 class="text-xs font-black text-gray2 uppercase tracking-widest mb-6">Show Health</h3>

			<div class="text-[12px] text-center text-gray2 mb-10 font-medium">
				<strong class="text-white">Total Gross (Act.)</strong> out of
				<span class="text-white font-bold">{formatCurrency(potentialGross, currency)}</span>
				Potential Gross
			</div>

			<div class="relative w-full h-2 bg-white/10 rounded-full mb-4 mt-8">
				<div
					class="absolute top-0 left-0 h-full {flagIsPositive
						? 'border-confirmed bg-confirmed text-black'
						: 'border-problem bg-problem text-black'} rounded-full transition-all duration-300"
					style="width: {actualPercentage}%;"
				></div>

				<div class="absolute bottom-full" style="left: {actualPercentage}%; z-index: 10;">
					<div
						class="w-[4px] h-8 absolute bottom-0 left-0 -translate-x-1 translate-y-2 rounded-full {flagIsPositive
							? 'bg-confirmed'
							: 'bg-problem'}"
					></div>
					<div
						class="absolute bottom-2 left-0 whitespace-nowrap"
						style="transform: translateX(-{actualPercentage}%);"
					>
						<div
							class="bg-black text-[11px] font-extrabold px-1.5 py-0.5 rounded border {flagIsPositive
								? 'border-confirmed bg-confirmed text-black'
								: 'border-problem bg-problem text-black'} transition-colors"
						>
							{formatCurrency(actualGross, currency)}
						</div>
					</div>
				</div>

				<div class="absolute top-full" style="left: {expensePercentage}%; z-index: 10;">
					<div
						class="w-[2px] h-4 absolute top-0 left-0 -translate-x-1 -translate-y-2 rounded-full bg-white"
					></div>
					<div
						class="absolute top-2 left-0 whitespace-nowrap"
						style="transform: translateX(-{expensePercentage}%);"
					>
						<div class="text-gray2 text-[10px] font-bold">
							<span class="text-white">{formatCurrency(expenses, currency)}</span> Expenses (Est.)
						</div>
					</div>
				</div>
			</div>
		</div>

		
	</div>
</div>
