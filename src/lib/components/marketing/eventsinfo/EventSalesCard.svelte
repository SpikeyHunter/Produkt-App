<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import InfoCardTemplate from '$lib/components/marketing/eventsinfo/InfoCardTemplate.svelte';

	// Types for sales data structure
	interface EventSalesData {
		event_id: string;
		sales_total_ga?: number;
		sales_total_vip?: number;
		sales_total_tables?: number;
		sales_total_coatcheck?: number;
		sales_total_comp_ga?: number;
		sales_total_comp_vip?: number;
		sales_total_free_ga?: number;
		sales_total_free_vip?: number;
		sales_gross?: number;
		sales_net?: number;
	}

	// Props
	export let salesData: EventSalesData | null = null;
	export let eventId: string = '';
	export let width: number = 330;
	export let height: number = 300;
	export let loading: boolean = false;

	const dispatch = createEventDispatcher();
	// Format currency helper
	function formatCurrency(amount: number | null | undefined): string {
		if (!amount || amount === 0) return '$0.00';
		return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
	}

	// Format date helper
	function formatDisplayDate(dateString: string): string {
		if (!dateString) return 'TBD';
		try {
			const date = new Date(dateString);
			if (isNaN(date.getTime())) return dateString;
			return date.toLocaleString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}

	// Computed values
	$: onlineGA = salesData?.sales_total_ga || 0;
	$: onlineVIP = salesData?.sales_total_vip || 0;
	$: totalGAVIP = onlineGA + onlineVIP || 0;
	$: compGA = salesData?.sales_total_comp_ga || 0;
	$: compVIP = salesData?.sales_total_comp_vip || 0;
	$: freeGA = salesData?.sales_total_free_ga || 0;
	$: freeVIP = salesData?.sales_total_free_vip || 0;
	$: onlineCoatcheck = salesData?.sales_total_coatcheck || 0;
	$: grossRevenue = salesData?.sales_gross || 0;
	$: netRevenue = salesData?.sales_net || 0;
	$: totalOnlineTickets = onlineGA + onlineVIP + onlineCoatcheck;

	// Door sales (placeholder)
	$: doorGA = 0;
	$: doorVIP = 0;
	$: totalDoorTickets = doorGA + doorVIP;

	$: totalRevenue = grossRevenue; // For now, just gross revenue
	$: hasAnySalesData = totalOnlineTickets > 0 || grossRevenue > 0;

	function handleRefresh() {
		dispatch('refresh', { eventId });
	}
</script>

<div
	class="sales-card-wrapper rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
	style="width: {width}px; height: {height}px;"
>
	<InfoCardTemplate title="Event Sales" showHeader={true} showFooter={false} contentPadding="p-0">
		<div class="flex flex-col h-full">
			{#if loading}
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<div
							class="w-8 h-8 border-2 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-3"
						></div>
						<p class="text-gray3">Loading sales data...</p>
					</div>
				</div>
			{:else if !hasAnySalesData}
				<div class="flex-1 flex items-center justify-center px-6">
					<div class="text-center">
						<svg
							class="w-12 h-12 text-gray2 mx-auto mb-3"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M9 12l2 2 4-4" />
							<path
								d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1"
							/>
							<path d="M3 12v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						</svg>
						<p class="text-gray3 text-sm">No sales data available yet</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 overflow-hidden">
					<div class="w-1/2 pl-6 pr-0 pt-2">
						<h4>Online Sales</h4>
						<div class="gap-1">
							<div class="flex pl-2 gap-2 items-center">
								<span class="text-gray3 text-sm">Total Sales</span>
								<span class="text-lime text-sm">{totalGAVIP}</span>
							</div>
							<div class="flex pl-2 gap-2 items-center">
								<span class="text-gray3 text-sm">- GA:</span>
								<span class="text-lime text-sm">{onlineGA}</span>
							</div>
							<div class="flex pl-2 gap-2 items-center">
								<span class="text-gray3 text-sm">- VIP:</span>
								<span class="text-lime text-sm">{onlineVIP}</span>
							</div>
							{#if onlineCoatcheck > 0}
								<div class="flex pl-2 gap-2 items-center">
									<span class="text-gray3 text-sm">- Coatcheck:</span>
									<span class="text-lime text-sm">{onlineCoatcheck}</span>
								</div>
							{:else}
								<div class="w-full h-0 my-0"></div>
							{/if}

							<div class="w-full h-0 my-4"></div>
							<h4>Total Revenue</h4>
							<div class="flex pl-2 gap-2 items-center">
								<span class="text-gray3 text-sm">- Gross:</span>
								<span class="text-lime text-sm font-semibold">{formatCurrency(grossRevenue)}</span>
							</div>
							<div class="flex pl-2 gap-2 items-center">
								<span class="text-gray3 text-sm">- Net:</span>
								<span class="text-lime text-sm font-semibold">{formatCurrency(netRevenue)}</span>
							</div>
						</div>
					</div>

					<div class="w-1/2 pl-7 pr-2 pt-2">
						<h4>Door Sales</h4>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- GA:</span>
							<span class="text-lime text-sm">{compGA}</span>
						</div>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- VIP:</span>
							<span class="text-lime text-sm">{compVIP}</span>
						</div>
						<div class="w-full h-0 my-2"></div>
						<h4>Comp Tickets</h4>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- GA:</span>
							<span class="text-lime text-sm">{compGA}</span>
						</div>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- VIP:</span>
							<span class="text-lime text-sm">{compVIP}</span>
						</div>
                        <div class="w-full h-0 my-2"></div>
						<h4>Free Tickets</h4>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- GA:</span>
							<span class="text-lime text-sm">{freeGA}</span>
						</div>
						<div class="flex pl-2 gap-2 items-center">
							<span class="text-gray3 text-sm">- VIP:</span>
							<span class="text-lime text-sm">{freeVIP}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</InfoCardTemplate>
</div>

<style>
	.sales-card-wrapper {
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}
</style>
