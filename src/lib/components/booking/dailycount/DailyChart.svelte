<script lang="ts">
	import type { DailyCount, EventData } from '$lib/types/dailycount';
	import { createEventDispatcher } from 'svelte';

	export let dailyCounts: DailyCount[] = [];
	export let activeEvents: EventData[] = [];
	export let dateRange: string[] = [];
	export let selectedEventForInfo: EventData | null = null;

	const dispatch = createEventDispatcher();
	let chartType: 'LINE' | 'COLUMN' = 'LINE';
	let showTotals = false;
	let chartWidth = 0;
	let chartHeight = 0;
	const padding = { top: 30, right: 30, bottom: 50, left: 50 };
	const animationDuration = 1.0; // seconds

	$: innerWidth = Math.max(0, chartWidth - padding.left - padding.right);
	$: innerHeight = Math.max(0, chartHeight - padding.top - padding.bottom);
	
	$: activeCounts = dailyCounts.filter(c => activeEvents.some(e => e.event_id === c.event_id));
	$: globalMax = Math.max(...activeCounts.map(c => c.total), 10);
	$: yMax = Math.ceil(globalMax / 100) * 100;
	$: yTicks = Array.from({length: 6}).map((_, i) => (yMax / 5) * i);

	$: chartData = activeEvents.map((event, eventIdx) => {
		const counts = dailyCounts.filter(c => c.event_id === event.event_id);
		let lastData = { total: 0, ga: 0, vip: 0, hasData: false };
		
		const points = dateRange.map((date, dateIdx) => {
			const record = counts.find(c => c.report_date === date);
			let daySells = 0;
			
			if (record) {
				daySells = dateIdx === 0 ? record.total : (record.total - lastData.total);
				lastData = { total: record.total, ga: record.ga, vip: record.vip, hasData: true };
			} else {
				daySells = 0;
			}

			const xLine = padding.left + (dateIdx / Math.max(1, dateRange.length - 1)) * innerWidth;
			const y = padding.top + innerHeight - ((lastData.total / yMax) * innerHeight);

			const slotWidth = innerWidth / Math.max(1, dateRange.length);
			const barGroupWidth = slotWidth * 0.8;
			const barWidth = Math.min(barGroupWidth / Math.max(1, activeEvents.length), 20);
			const xColumn = padding.left + (dateIdx * slotWidth) + (slotWidth - barGroupWidth)/2 + (eventIdx * barWidth);
			const heightCol = ((lastData.total / yMax) * innerHeight);

			return { date, dateIdx, ...lastData, daySells, xLine, xColumn, y, heightCol, barWidth, isRealDataPoint: !!record };
		});
		
		return { event, points };
	});

	function getPath(points: any[]) {
		if(points.length === 0) return '';
		if(points.length === 1) return `M ${points[0].xLine} ${points[0].y} L ${points[0].xLine + innerWidth} ${points[0].y}`;
		return `M ${points[0].xLine} ${points[0].y} ` + points.slice(1).map(p => `L ${p.xLine} ${p.y}`).join(' ');
	}

	let tooltip = { visible: false, x: 0, y: 0, title: '', ga: 0, vip: 0, total: 0, daySells: 0, color: '', eventName: '' };

	function showTooltip(e: MouseEvent, p: any, event: EventData) {
		tooltip = {
			visible: true,
			x: e.clientX,
			y: e.clientY,
			title: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
			ga: p.ga,
			vip: p.vip,
			total: p.total,
			daySells: p.daySells,
			color: event.color || '#9ca3af',
			eventName: event.event_name
		};
	}
	function hideTooltip() { tooltip.visible = false; }
</script>

<div class="flex-1 bg-navbar rounded-3xl border border-gray1 flex flex-col min-w-0 h-[760px] overflow-hidden shadow-lg p-6">
	
	<div class="flex items-center justify-between mb-4 shrink-0">
		<h2 class="text-white font-bold text-lg">Daily Sales Analysis</h2>
		<div class="flex items-center gap-3">
			<button class="px-4 py-2 text-xs rounded-3xl hover:cursor-pointer font-bold transition-colors flex items-center gap-1.5 {showTotals ? 'bg-lime text-black' : 'bg-gray1 text-gray2 hover:text-white border border-gray2/20'}" on:click={() => showTotals = !showTotals}>
				{#if showTotals}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
					Hide Total
				{:else}
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
					View Total
				{/if}
			</button>
			<div class="flex bg-gray1 rounded-3xl p-1 border border-gray2/20">
				<button class="px-4 py-1.5 text-xs rounded-3xl hover:cursor-pointer font-bold transition-colors {chartType === 'LINE' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => chartType = 'LINE'}>Line</button>
				<button class="px-4 py-1.5 text-xs rounded-3xl hover:cursor-pointer font-bold transition-colors {chartType === 'COLUMN' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => chartType = 'COLUMN'}>Columns</button>
			</div>
		</div>
	</div>

	<div class="flex flex-1 min-h-0 gap-6">
		<div class="w-[240px] shrink-0 overflow-y-auto custom-scrollbar space-y-2 pr-2">
			{#each activeEvents as event}
				<div 
					class="flex items-center gap-3 p-2 bg-gray1/40 rounded-xl border-l-4 border-r-4 shadow-sm transition-all hover:bg-gray1/60 cursor-pointer {selectedEventForInfo && selectedEventForInfo.event_id === event.event_id ? 'bg-gray1/80 shadow-md' : ''}" 
					style="border-color: {event.color}; opacity: {selectedEventForInfo && selectedEventForInfo.event_id !== event.event_id ? 0.4 : 1};"
					on:click={() => dispatch('eventClicked', event)}
					on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') dispatch('eventClicked', event); }}
					role="button"
					tabindex="0"
				>
					<div class="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-black">
						{#if event.event_flyer}
							<img src={event.event_flyer} alt={event.event_name} class="w-full h-full object-cover" />
						{/if}
					</div>
					<div class="flex flex-col min-w-0">
						<span class="font-bold text-xs truncate" style="color: {event.color}">{event.event_name}</span>
						<span class="text-[10px] text-[var(--color-gray3)] truncate mt-0.5">{event.event_id} - {event.event_venue}</span>
					</div>
				</div>
			{/each}
			{#if activeEvents.length === 0}
				<div class="text-gray2 text-sm font-bold mt-4">Select events to view data.</div>
			{/if}
		</div>

		<div class="flex-1 relative" bind:clientWidth={chartWidth} bind:clientHeight={chartHeight}>
			{#if activeEvents.length > 0}
				{#key chartType}
					<svg width="100%" height="100%" class="absolute inset-0 overflow-visible">
						
						<rect 
							x="0" y="0" width="100%" height="100%" fill="transparent" class="cursor-default" 
							role="button" tabindex="-1"
							on:click={() => dispatch('unselectEvent')} 
							on:keydown={(e) => e.key === 'Enter' && dispatch('unselectEvent')}
						/>

						<defs>
							<clipPath id="reveal-clip">
								<rect x="{padding.left}" y="0" width="{innerWidth}" height="{chartHeight}" class="clip-rect" />
							</clipPath>
						</defs>

						{#each yTicks as tick}
							<text x="{padding.left - 30}" y="{padding.top + innerHeight - (tick/yMax)*innerHeight + 4}" fill="var(--color-gray3)" font-size="14" font-weight="bold" text-anchor="end">{tick}</text>
							<line x1="{padding.left}" y1="{padding.top + innerHeight - (tick/yMax)*innerHeight}" x2="{padding.left + innerWidth}" y2="{padding.top + innerHeight - (tick/yMax)*innerHeight}" stroke="var(--color-gray1)" stroke-dasharray="4" pointer-events="none" />
						{/each}

						{#each dateRange as date, i}
							{@const slotWidth = innerWidth / Math.max(1, dateRange.length)}
							{@const xCentered = chartType === 'LINE' ? padding.left + (i / Math.max(1, dateRange.length - 1)) * innerWidth : padding.left + (i * slotWidth) + (slotWidth / 2)}
							{#if dateRange.length <= 15 || i % Math.ceil(dateRange.length / 10) === 0 || i === dateRange.length - 1}
								<text x={xCentered} y="{chartHeight - 12}" fill="var(--color-gray3)" font-size="14" font-weight="bold" text-anchor="middle" pointer-events="none">
									{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
								</text>
							{/if}
						{/each}

						{#if chartType === 'LINE'}
							<g clip-path="url(#reveal-clip)">
								{#each chartData as row}
									{@const isFaded = selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
									{@const elementColor = isFaded ? '#6b7280' : row.event.color}
									<path 
										d={getPath(row.points)} 
										fill="none" 
										stroke="{elementColor}" 
										stroke-width="{isFaded ? 2 : 3}" 
										stroke-linecap="round" 
										stroke-linejoin="round" 
										style="opacity: {isFaded ? 0.4 : 1}; transition: all 0.3s ease-in-out;"
										class="cursor-pointer hover:stroke-[4px]"
										role="button" tabindex="-1"
										on:click|stopPropagation={() => dispatch('eventClicked', row.event)}
										on:keydown={(e) => e.key === 'Enter' && dispatch('eventClicked', row.event)}
									/>
								{/each}
							</g>
							
							{#each chartData as row}
								{@const isFaded = selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
								{@const elementColor = isFaded ? '#6b7280' : row.event.color}
								<g style="opacity: {isFaded ? 0.4 : 1}; transition: opacity 0.3s ease-in-out;">
									{#each row.points as p}
										{#if p.hasData}
											{@const percentX = innerWidth > 0 ? (p.xLine - padding.left) / innerWidth : 0}
											{@const staggerDelay = percentX * animationDuration}
											
											<foreignObject x={p.xLine - 20} y={p.y - 24} width="40" height="16" class="animated-point" style="animation-delay: {staggerDelay}s; overflow: visible; visibility: {showTotals ? 'visible' : 'hidden'}; pointer-events: none;">
												<div class="bg-gray1 rounded-full text-[9px] font-bold text-gray3 w-full h-full flex items-center justify-center">
													{p.total}
												</div>
											</foreignObject>

											<circle 
												cx={p.xLine} cy={p.y} r="4.5" 
												fill="var(--color-navbar)" stroke="{elementColor}" stroke-width="2.5" 
												class="cursor-pointer hover:r-[7px] animated-point transition-colors"
												style="animation-delay: {staggerDelay}s"
												role="button" tabindex="-1"
												on:mouseenter={(e) => showTooltip(e, p, row.event)}
												on:mouseleave={hideTooltip}
												on:click|stopPropagation={() => dispatch('eventClicked', row.event)}
												on:keydown={(e) => e.key === 'Enter' && dispatch('eventClicked', row.event)}
											/>
										{/if}
									{/each}
								</g>
							{/each}
						{:else}
							{#each chartData as row}
								{@const isFaded = selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
								{@const elementColor = isFaded ? '#6b7280' : row.event.color}
								<g style="opacity: {isFaded ? 0.4 : 1}; transition: opacity 0.3s ease-in-out;">
									{#each row.points as p}
										{#if p.hasData && p.heightCol > 0}
											<text x={p.xColumn + (p.barWidth / 2)} y={p.y - 5} fill="var(--color-gray3)" font-size="10" font-weight="bold" text-anchor="middle" class="animated-column-text" style="visibility: {showTotals ? 'visible' : 'hidden'}; pointer-events: none;">
												{p.total}
											</text>

											<rect 
												x={p.xColumn} y={p.y} width={p.barWidth} height={p.heightCol} fill="{elementColor}" rx="2"
												class="cursor-pointer hover:opacity-80 animated-column transition-colors"
												role="button" tabindex="-1"
												on:mouseenter={(e) => showTooltip(e, p, row.event)}
												on:mouseleave={hideTooltip}
												on:click|stopPropagation={() => dispatch('eventClicked', row.event)}
												on:keydown={(e) => e.key === 'Enter' && dispatch('eventClicked', row.event)}
											/>
										{/if}
									{/each}
								</g>
							{/each}
						{/if}
					</svg>
				{/key}
			{/if}
		</div>
	</div>
</div>

{#if tooltip.visible}
	<div class="fixed pointer-events-none z-50 bg-navbar border p-3 rounded-xl shadow-2xl transition-opacity w-[180px]" style="left: {tooltip.x}px; top: {tooltip.y}px; border-color: {tooltip.color}; transform: translate(-50%, -115%);">
		<div class="text-[11px] font-bold mb-1 break-words whitespace-normal leading-tight" style="color: {tooltip.color}">{tooltip.eventName}</div>
		<div class="text-white font-bold text-xs border-b border-gray2/20 pb-2 mb-2">{tooltip.title}</div>
		<div class="flex flex-col text-xs space-y-1">
			<div class="flex justify-between"><span class="text-gray2">Total:</span><span class="text-white font-bold">{tooltip.total}</span></div>
			<div class="flex justify-between pl-3"><span class="text-gray2">GA:</span><span class="text-white font-bold">{tooltip.ga}</span></div>
			<div class="flex justify-between pl-3"><span class="text-gray2">VIP:</span><span class="text-white font-bold">{tooltip.vip}</span></div>
			<div class="flex justify-between mt-1 pt-2 border-t border-gray2/20"><span class="text-gray2">Day sells:</span><span class="font-bold text-lime">{tooltip.daySells >= 0 ? '+' : ''}{tooltip.daySells}</span></div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 6px; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gray2); opacity: 0.3; border-radius: 4px; }
	
	.clip-rect { animation: revealLine 1.0s linear forwards; }
	@keyframes revealLine { 0% { width: 0; } 100% { width: 100%; } }
	
	.animated-point { opacity: 0; animation: popIn 0.01s linear forwards; }
	@keyframes popIn { to { opacity: 1; } }
	
	.animated-column { transform: scaleY(0); transform-origin: bottom; animation: growUp 0.3s ease-out forwards; }
	.animated-column-text { opacity: 0; animation: popIn 0.01s linear 0.3s forwards; }
	
	@keyframes growUp { to { transform: scaleY(1); } }
</style>