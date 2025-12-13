<script lang="ts">
	import { type SalesStats } from '$lib/types/compare';

	export let mainStats: SalesStats | null = null;
	export let compareStats: SalesStats | null = null;
	export let mainTodayStats: SalesStats | null = null;
	export let compareTodayStats: SalesStats | null = null;
	
	export let compareCount: number = 0;

	const fmtMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
	const fmtNum = (val: number) => new Intl.NumberFormat('en-US').format(Math.round(val));

	function getAvg(stats: SalesStats | null): SalesStats | null {
		if (!stats) return null;
		if (compareCount <= 1) return stats;
		return {
			total_tickets: stats.total_tickets / compareCount,
			ga_tickets: stats.ga_tickets / compareCount,
			vip_tickets: stats.vip_tickets / compareCount,
			gross_revenue: stats.gross_revenue / compareCount,
			net_revenue: stats.net_revenue / compareCount,
			door_sales: stats.door_sales / compareCount,
			attendance: stats.attendance / compareCount
		};
	}

	$: avgCompareStats = getAvg(compareStats);
	$: avgCompareTodayStats = getAvg(compareTodayStats);
	
	$: hasMain = !!mainStats;
	$: hasCompare = !!avgCompareStats;

	function getStatusColor(current: number, prev: number) {
		if (!hasCompare) return 'text-lime';
		return current >= prev ? 'text-confirmed' : 'text-problem';
	}

	function getDiffInfo(current: number, prev: number, isCurrency: boolean) {
		const diff = current - prev;
		const absDiff = Math.abs(diff);
		const formattedDiff = isCurrency ? fmtMoney(absDiff) : fmtNum(absDiff);
		const isBehind = diff < 0;
		
		return {
			text: isBehind 
				? `You are behind by ${formattedDiff}` 
				: `You are ahead by ${formattedDiff}`,
			color: isBehind ? 'text-problem' : 'text-confirmed'
		};
	}
</script>

<div class="bg-navbar rounded-2xl p-5 mt-2 border border-gray2/10 shadow-sm font-bold text-sm flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
	{#if hasMain && mainStats}
		
		<div class="flex flex-col gap-2">
			<div>
				<div class="flex justify-between items-end mb-1">
					<span class="text-white text-lg">Current Revenue:</span>
					<span class="text-lg {hasCompare && avgCompareStats ? getStatusColor(mainStats.gross_revenue, avgCompareStats.gross_revenue) : 'text-lime'}">
						{fmtMoney(mainStats.gross_revenue)}
					</span>
				</div>
				
				{#if hasCompare && avgCompareStats}
					<div class="flex justify-between items-center text-xs mb-1">
						<span class="text-gray2">
							{compareCount > 1 ? 'Avg Previous Revenue:' : 'Previous Revenue:'}
						</span>
						<span class="text-gray2 opacity-80">
							{fmtMoney(avgCompareStats.gross_revenue)}
						</span>
					</div>
					<div class="text-[11px] {getDiffInfo(mainStats.gross_revenue, avgCompareStats.gross_revenue, true).color} italic text-right leading-tight">
						{getDiffInfo(mainStats.gross_revenue, avgCompareStats.gross_revenue, true).text}
					</div>
				{/if}
			</div>

			<div>
				<div class="flex justify-between items-end mb-1">
					<span class="text-white text-base">Current Tickets:</span>
					<span class="text-lg {hasCompare && avgCompareStats ? getStatusColor(mainStats.total_tickets, avgCompareStats.total_tickets) : 'text-lime'}">
						{fmtNum(mainStats.total_tickets)}
					</span>
				</div>
				<div class="flex flex-col gap-0.5 text-xs text-gray2/80 pl-3 border-l-2 border-transparent">
					<div class="flex justify-between">
						<span>- GA</span>
						<span>{fmtNum(mainStats.ga_tickets)}</span>
					</div>
					<div class="flex justify-between">
						<span>- VIP</span>
						<span>{fmtNum(mainStats.vip_tickets)}</span>
					</div>
				</div>

				{#if hasCompare && avgCompareStats}
					<div class="mt-3">
						<div class="flex justify-between items-center mb-1 text-xs">
							<span class="text-gray2">
								{compareCount > 1 ? 'Avg Previous Tickets:' : 'Previous Tickets:'}
							</span>
							<span class="text-gray2 opacity-80">
								{fmtNum(avgCompareStats.total_tickets)}
							</span>
						</div>
						<div class="flex flex-col gap-0.5 text-xs text-gray2/50 pl-3">
							<div class="flex justify-between">
								<span>- GA</span>
								<span>{fmtNum(avgCompareStats.ga_tickets)}</span>
							</div>
							<div class="flex justify-between">
								<span>- VIP</span>
								<span>{fmtNum(avgCompareStats.vip_tickets)}</span>
							</div>
						</div>
						<div class="text-[11px] {getDiffInfo(mainStats.total_tickets, avgCompareStats.total_tickets, false).color} italic text-right mt-1 leading-tight">
							{getDiffInfo(mainStats.total_tickets, avgCompareStats.total_tickets, false).text}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="bg-gray1/50 -mx-2 px-3 py-3 rounded-xl border border-gray2/10 mt-auto">
			<h4 class="text-gray2 font-bold text-[10px] uppercase tracking-wider mb-1">
				Selected Date Performance
			</h4>
			
			{#if mainTodayStats}
				<div class="flex flex-col gap-2">
					<div>
						<div class="flex justify-between items-center">
							<span class="text-white text-lg">Current Revenue:</span>
							<span class="text-lg {avgCompareTodayStats ? getStatusColor(mainTodayStats.gross_revenue, avgCompareTodayStats.gross_revenue) : 'text-white'}">
								{fmtMoney(mainTodayStats.gross_revenue)}
							</span>
						</div>
						{#if avgCompareTodayStats}
							<div class="flex justify-between items-center text-sm mb-1">
								<span class="text-gray2">
									{compareCount > 1 ? 'Avg Prev Revenue:' : 'Prev Revenue:'}
								</span>
								<span class="text-gray2 opacity-80">
									{fmtMoney(avgCompareTodayStats.gross_revenue)}
								</span>
							</div>
							<div class="text-[11px] {getDiffInfo(mainTodayStats.gross_revenue, avgCompareTodayStats.gross_revenue, true).color} italic text-right leading-tight">
								{getDiffInfo(mainTodayStats.gross_revenue, avgCompareTodayStats.gross_revenue, true).text}
							</div>
						{/if}
					</div>

					<div>
						<div class="flex justify-between items-center mb-0.5">
							<span class="text-white text-base">Current Tickets:</span>
							<span class="text-lg {avgCompareTodayStats ? getStatusColor(mainTodayStats.total_tickets, avgCompareTodayStats.total_tickets) : 'text-white'}">
								{fmtNum(mainTodayStats.total_tickets)}
							</span>
						</div>
						<div class="flex flex-col gap-0.5 text-[11px] text-gray2/70 pl-3">
							<div class="flex justify-between">
								<span>- GA</span>
								<span>{fmtNum(mainTodayStats.ga_tickets)}</span>
							</div>
							<div class="flex justify-between">
								<span>- VIP</span>
								<span>{fmtNum(mainTodayStats.vip_tickets)}</span>
							</div>
						</div>

						{#if avgCompareTodayStats}
							<div class="mt-2">
								<div class="flex justify-between items-center mb-0.5 text-xs">
									<span class="text-gray2">
										{compareCount > 1 ? 'Avg Prev Tickets:' : 'Prev Tickets:'}
									</span>
									<span class="text-gray2 opacity-80">
										{fmtNum(avgCompareTodayStats.total_tickets)}
									</span>
								</div>
								<div class="flex flex-col gap-0.5 text-[10px] text-gray2/40 pl-3">
									<div class="flex justify-between">
										<span>- GA</span>
										<span>{fmtNum(avgCompareTodayStats.ga_tickets)}</span>
									</div>
									<div class="flex justify-between">
										<span>- VIP</span>
										<span>{fmtNum(avgCompareTodayStats.vip_tickets)}</span>
									</div>
								</div>
								<div class="text-[11px] {getDiffInfo(mainTodayStats.total_tickets, avgCompareTodayStats.total_tickets, false).color} italic text-right mt-0.5 leading-tight">
									{getDiffInfo(mainTodayStats.total_tickets, avgCompareTodayStats.total_tickets, false).text}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<span class="text-gray2 text-[11px] italic font-bold block text-center py-2">No data for selected date</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.text-confirmed { color: var(--color-confirmed); }
	.text-problem { color: var(--color-problem); }
</style>