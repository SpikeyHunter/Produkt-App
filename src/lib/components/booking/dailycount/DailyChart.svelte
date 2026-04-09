<script lang="ts">
	import type { DailyCount, EventData } from '$lib/types/dailycount';
	import { createEventDispatcher } from 'svelte';
	import { draw, fade } from 'svelte/transition';

	export let dailyCounts: DailyCount[] = [];
	export let activeEvents: EventData[] = [];
	export let dateRange: string[] = [];
	export let selectedEventForInfo: EventData | null = null;

	const dispatch = createEventDispatcher();
	let chartType: 'LINE' | 'COLUMN' = 'LINE';
	let viewMode: 'CUMULATIVE' | 'DAILY' = 'CUMULATIVE';
	let showTotals = false;
	let chartWidth = 0;
	let chartHeight = 0;
	const padding = { top: 30, right: 30, bottom: 70, left: 50 };
	const animationDuration = 1.0;

	$: innerWidth = Math.max(0, chartWidth - padding.left - padding.right);
	$: innerHeight = Math.max(0, chartHeight - padding.top - padding.bottom);

	$: sortedSidebarEvents = [...activeEvents].sort((a, b) => {
		const dateA = new Date(a.event_date || 0).getTime();
		const dateB = new Date(b.event_date || 0).getTime();
		return dateA - dateB;
	});

	$: activeCounts = dailyCounts.filter((c) => activeEvents.some((e) => e.event_id === c.event_id));

	$: chartDataPrep = activeEvents.map((event, eventIdx) => {
		const counts = dailyCounts.filter((c) => c.event_id === event.event_id);

		// Math fix: Determine if there were sales BEFORE our filtered dateRange
		let lastTotal = 0;
		let firstRecordFound = false;

		if (dateRange.length > 0) {
			const firstVisibleDate = dateRange[0];
			const priorRecords = counts.filter((c) => c.report_date < firstVisibleDate);
			if (priorRecords.length > 0) {
				// Sort to find the most recent one before the range
				priorRecords.sort((a, b) => a.report_date.localeCompare(b.report_date));
				lastTotal = priorRecords[priorRecords.length - 1].total;
				firstRecordFound = true; // Record already happened before
			}
		}

		const points = dateRange.map((date, dateIdx) => {
			const record = counts.find((c) => c.report_date === date);
			let daySells = 0;
			let currentTotal = lastTotal;
			let isFirstDataPoint = false;

			if (record) {
				if (!firstRecordFound) {
					daySells = 0;
					firstRecordFound = true;
					isFirstDataPoint = true;
				} else {
					daySells = Math.max(0, record.total - lastTotal);
				}
				lastTotal = record.total;
				currentTotal = record.total;
			}

			return {
				date,
				dateIdx,
				total: currentTotal,
				daySells,
				ga: record?.ga || 0,
				vip: record?.vip || 0,
				hasData: !!record,
				isFirstDataPoint,
				record
			};
		});

		return { event, eventIdx, points };
	});

	$: globalMax = Math.max(
		...chartDataPrep.flatMap((row) =>
			row.points
				.filter((p) => p.hasData && !(viewMode === 'DAILY' && p.isFirstDataPoint))
				.map((p) => (viewMode === 'CUMULATIVE' ? p.total : p.daySells))
		),
		10
	);

	$: yMax = (() => {
		let max = Math.max(10, globalMax);
		let niceMax = Math.ceil(max / 10) * 10;
		if (max > 100) niceMax = Math.ceil(max / 50) * 50;
		if (max > 1000) niceMax = Math.ceil(max / 100) * 100;
		if (max > 5000) niceMax = Math.ceil(max / 500) * 500;
		return niceMax;
	})();

	$: yTicks = Array.from({ length: 6 }).map((_, i) => (yMax / 5) * i);

	$: chartData = chartDataPrep.map((row) => {
		const validPoints = row.points.filter((p) => !(viewMode === 'DAILY' && p.isFirstDataPoint));

		const points = validPoints.map((p) => {
			const val = viewMode === 'CUMULATIVE' ? p.total : p.daySells;
			const xLine = padding.left + (p.dateIdx / Math.max(1, dateRange.length - 1)) * innerWidth;
			const y = padding.top + innerHeight - (val / yMax) * innerHeight;

			const slotWidth = innerWidth / Math.max(1, dateRange.length);
			const barGroupWidth = slotWidth * 0.8;
			const numberOfBars = Math.max(1, activeEvents.length);

			let gap = 4;
			const totalWidthPerBar = barGroupWidth / numberOfBars;
			if (totalWidthPerBar < 8) gap = 1;

			const barWidth = Math.max(1, Math.min(totalWidthPerBar - gap, 20));
			const totalDrawnWidth = barWidth * numberOfBars + gap * (numberOfBars - 1);
			const startX = padding.left + p.dateIdx * slotWidth + slotWidth / 2 - totalDrawnWidth / 2;
			const xColumn = startX + row.eventIdx * (barWidth + gap);
			const heightCol = (val / yMax) * innerHeight;

			return { ...p, xLine, xColumn, y, heightCol, barWidth };
		});

		return { event: row.event, points };
	});

	function getPath(points: any[]) {
		if (points.length === 0) return '';
		if (points.length === 1)
			return `M ${points[0].xLine} ${points[0].y} L ${points[0].xLine + innerWidth} ${points[0].y}`;

		return (
			`M ${points[0].xLine} ${points[0].y} ` +
			points
				.slice(1)
				.map((p) => `L ${p.xLine} ${p.y}`)
				.join(' ')
		);
	}

	let tooltip = {
		visible: false,
		x: 0,
		y: 0,
		title: '',
		ga: 0,
		vip: 0,
		total: 0,
		daySells: 0,
		color: '',
		eventName: ''
	};

	function showTooltip(e: MouseEvent, p: any, event: EventData) {
		tooltip = {
			visible: true,
			x: e.clientX,
			y: e.clientY,
			title: new Date(p.date).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				timeZone: 'UTC'
			}),
			ga: p.ga,
			vip: p.vip,
			total: p.total,
			daySells: p.daySells,
			color: event.color || '#9ca3af',
			eventName: event.event_name
		};
	}

	function hideTooltip() {
		tooltip.visible = false;
	}
</script>

<div
	class="flex-1 bg-navbar rounded-3xl border border-gray1 flex flex-col min-w-0 h-full overflow-hidden shadow-lg p-6"
>
	<div class="flex items-center justify-between mb-4 shrink-0">
		<h2 class="text-white font-bold text-xl">Sales Overview</h2>
		<div class="flex items-center gap-3">
			<button
				class="px-4 py-2 text-xs rounded-3xl outline-none focus:outline-none hover:cursor-pointer font-bold transition-colors bg-gray1 text-gray2 hover:text-white border border-gray2/20"
				on:click={() => (viewMode = viewMode === 'CUMULATIVE' ? 'DAILY' : 'CUMULATIVE')}
			>
				{viewMode === 'CUMULATIVE' ? 'Daily' : 'Total'}
			</button>
			<button
				class="px-4 py-2 text-xs rounded-3xl outline-none focus:outline-none hover:cursor-pointer font-bold transition-colors flex items-center gap-1.5 {showTotals
					? 'bg-lime text-black border-lime'
					: 'bg-gray1 text-gray2 hover:text-white border border-gray2/20'}"
				on:click={() => (showTotals = !showTotals)}
			>
				{#if showTotals}
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
							cx="12"
							cy="12"
							r="3"
						/></svg
					>
					Hide {viewMode === 'CUMULATIVE' ? 'Total' : 'Daily'}
				{:else}
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path
							d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
						/><line x1="1" y1="1" x2="23" y2="23" /></svg
					>
					View {viewMode === 'CUMULATIVE' ? 'Total' : 'Daily'}
				{/if}
			</button>
			<div class="flex bg-gray1 rounded-3xl p-1 border border-gray2/20">
				<button
					class="px-4 py-1.5 text-xs rounded-3xl outline-none hover:cursor-pointer font-bold transition-colors {chartType ===
					'LINE'
						? 'bg-lime text-black'
						: 'text-gray2 hover:text-white'}"
					on:click={() => (chartType = 'LINE')}>Line</button
				>
				<button
					class="px-4 py-1.5 text-xs rounded-3xl outline-none hover:cursor-pointer font-bold transition-colors {chartType ===
					'COLUMN'
						? 'bg-lime text-black'
						: 'text-gray2 hover:text-white'}"
					on:click={() => (chartType = 'COLUMN')}>Columns</button
				>
			</div>
		</div>
	</div>

	<div class="flex flex-1 min-h-0 gap-6">
		<div class="w-[240px] shrink-0 overflow-y-auto custom-scrollbar space-y-2 pr-2">
			<h2 class="text-gray3 font-bold text-sm">Selected Events</h2>
			{#each sortedSidebarEvents as event}
				<div
					class="flex items-center gap-3 p-2 bg-gray1/40 rounded-xl border-l-4 border-r-4 shadow-sm transition-all outline-none hover:bg-gray1/60 cursor-pointer {selectedEventForInfo &&
					selectedEventForInfo.event_id === event.event_id
						? 'bg-gray1/80 shadow-md'
						: ''}"
					style="border-color: {event.color}; opacity: {selectedEventForInfo &&
					selectedEventForInfo.event_id !== event.event_id
						? 0.4
						: 1};"
					on:click={() => dispatch('eventClicked', event)}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') dispatch('eventClicked', event);
					}}
					role="button"
					tabindex="0"
				>
					<div class="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-black">
						{#if event.event_flyer}
							<img
								src={event.event_flyer}
								alt={event.event_name}
								class="w-full h-full object-cover"
							/>
						{/if}
					</div>
					<div class="flex flex-col min-w-0">
						<span class="font-bold text-xs truncate" style="color: {event.color}"
							>{event.event_name}</span
						>
						<span class="text-[10px] text-[var(--color-gray3)] truncate mt-0.5"
							>{event.event_id}{#if event.event_venue}
								- {event.event_venue}{/if}</span
						>
						<span class="text-[10px] text-white truncate mt-0.5">{event.event_date}</span>
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
							x="0"
							y="0"
							width="100%"
							height="100%"
							fill="transparent"
							class="cursor-default outline-none focus:outline-none"
							role="button"
							tabindex="-1"
							on:click={() => dispatch('unselectEvent')}
							on:keydown={(e) => e.key === 'Enter' && dispatch('unselectEvent')}
						/>
						<defs
							><clipPath id="reveal-clip"
								><rect
									x={padding.left}
									y="0"
									width={innerWidth}
									height={chartHeight}
									class="clip-rect"
								/></clipPath
							></defs
						>

						{#each yTicks as tick}
							<text
								x={padding.left - 30}
								y={padding.top + innerHeight - (tick / yMax) * innerHeight + 4}
								fill="var(--color-gray3)"
								font-size="14"
								font-weight="bold"
								text-anchor="end">{tick}</text
							>
							<line
								x1={padding.left}
								y1={padding.top + innerHeight - (tick / yMax) * innerHeight}
								x2={padding.left + innerWidth}
								y2={padding.top + innerHeight - (tick / yMax) * innerHeight}
								stroke="var(--color-gray1)"
								stroke-dasharray="4"
								pointer-events="none"
							/>
						{/each}

						{#each dateRange as date, i}
							{@const slotWidth = innerWidth / Math.max(1, dateRange.length)}
							{@const xCentered =
								chartType === 'LINE'
									? padding.left + (i / Math.max(1, dateRange.length - 1)) * innerWidth
									: padding.left + i * slotWidth + slotWidth / 2}
							{@const angle = slotWidth < 25 ? -90 : slotWidth < 50 ? -45 : 0}
							<text
								x={xCentered}
								y={chartHeight - (angle === -90 ? 30 : angle === -45 ? 20 : 12)}
								fill="var(--color-gray3)"
								font-size={slotWidth < 20 ? 10 : 12}
								font-weight="bold"
								text-anchor={angle === 0 ? 'middle' : 'end'}
								transform="rotate({angle}, {xCentered}, {chartHeight - 12})"
								pointer-events="none"
							>
								{new Date(date).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									timeZone: 'UTC'
								})}
							</text>
						{/each}

						{#if chartType === 'LINE'}
							<g clip-path="url(#reveal-clip)">
								{#each chartData as row (row.event.event_id)}
									{@const isFaded =
										selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
									{@const elementColor = isFaded ? '#6b7280' : row.event.color}
									<path
										in:draw={{ duration: 1000 }}
										out:fade={{ duration: 300 }}
										d={getPath(row.points)}
										fill="none"
										stroke={elementColor}
										stroke-width={isFaded ? 2 : 3}
										stroke-linecap="round"
										stroke-linejoin="round"
										style="opacity: {isFaded ? 0.4 : 1}; transition: all 0.3s ease-in-out;"
										class="cursor-pointer hover:stroke-[4px] outline-none focus:outline-none"
										role="button"
										tabindex="-1"
										on:click|stopPropagation={() => dispatch('eventClicked', row.event)}
										on:keydown={(e) => e.key === 'Enter' && dispatch('eventClicked', row.event)}
									/>
								{/each}
							</g>
							{#each chartData as row (row.event.event_id)}
								{@const isFaded =
									selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
								{@const elementColor = isFaded ? '#6b7280' : row.event.color}
								<g
									style="opacity: {isFaded ? 0.4 : 1}; transition: opacity 0.3s ease-in-out;"
									out:fade={{ duration: 300 }}
								>
									{#each row.points as p}
										{#if p.hasData}
											{@const percentX = innerWidth > 0 ? (p.xLine - padding.left) / innerWidth : 0}
											{@const staggerDelay = percentX * animationDuration}
											<foreignObject
												x={p.xLine - 20}
												y={p.y - 24}
												width="40"
												height="16"
												class="animated-point"
												style="animation-delay: {staggerDelay}s; overflow: visible; visibility: {showTotals
													? 'visible'
													: 'hidden'}; pointer-events: none;"
											>
												<div
													class="bg-gray1 rounded-full text-[9px] font-bold text-gray3 w-full h-full flex items-center justify-center"
												>
													{viewMode === 'CUMULATIVE' ? p.total : p.daySells}
												</div>
											</foreignObject>
											<circle
												cx={p.xLine}
												cy={p.y}
												r="4.5"
												fill="var(--color-navbar)"
												stroke={elementColor}
												stroke-width="2.5"
												class="cursor-pointer hover:r-[7px] animated-point transition-colors outline-none focus:outline-none"
												style="animation-delay: {staggerDelay}s"
												role="button"
												tabindex="-1"
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
							{#each chartData as row (row.event.event_id)}
								{@const isFaded =
									selectedEventForInfo && selectedEventForInfo.event_id !== row.event.event_id}
								{@const elementColor = isFaded ? '#6b7280' : row.event.color}
								<g
									style="opacity: {isFaded ? 0.4 : 1}; transition: opacity 0.3s ease-in-out;"
									out:fade={{ duration: 300 }}
								>
									{#each row.points as p}
										{#if p.hasData && p.heightCol > 0}
											<text
												x={p.xColumn + p.barWidth / 2}
												y={p.y - 5}
												fill="var(--color-gray3)"
												font-size="10"
												font-weight="bold"
												text-anchor="middle"
												class="animated-column-text"
												style="visibility: {showTotals
													? 'visible'
													: 'hidden'}; pointer-events: none;"
												>{viewMode === 'CUMULATIVE' ? p.total : p.daySells}</text
											>
											<rect
												x={p.xColumn}
												y={p.y}
												width={p.barWidth}
												height={p.heightCol}
												fill={elementColor}
												rx="2"
												class="cursor-pointer hover:opacity-80 animated-column transition-colors outline-none focus:outline-none"
												role="button"
												tabindex="-1"
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
	<div
		class="fixed pointer-events-none z-50 bg-navbar border p-3 rounded-xl shadow-2xl transition-opacity w-[180px]"
		style="left: {tooltip.x}px; top: {tooltip.y}px; border-color: {tooltip.color};
		transform: translate(-50%, {tooltip.y < 220 ? '15px' : '-115%'});"
	>
		<div
			class="text-[11px] font-bold mb-1 break-words whitespace-normal leading-tight"
			style="color: {tooltip.color}"
		>
			{tooltip.eventName}
		</div>
		<div class="text-white font-bold text-xs border-b border-gray2/20 pb-2 mb-2">
			{tooltip.title}
		</div>
		<div class="flex flex-col text-xs space-y-1">
			<div class="flex justify-between">
				<span class="text-gray2">Total:</span><span class="text-white font-bold"
					>{tooltip.total}</span
				>
			</div>
			<div class="flex justify-between pl-3">
				<span class="text-gray2">GA:</span><span class="text-white font-bold">{tooltip.ga}</span>
			</div>
			<div class="flex justify-between pl-3">
				<span class="text-gray2">VIP:</span><span class="text-white font-bold">{tooltip.vip}</span>
			</div>
			<div class="flex justify-between mt-1 pt-2 border-t border-gray2/20">
				<span class="text-gray2">Day sells:</span><span class="font-bold text-lime"
					>{tooltip.daySells >= 0 ? '+' : ''}{tooltip.daySells}</span
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		opacity: 0.3;
		border-radius: 4px;
	}
	.clip-rect {
		animation: revealLine 1s linear forwards;
	}
	@keyframes revealLine {
		0% {
			width: 0;
		}
		100% {
			width: 100%;
		}
	}
	.animated-point {
		opacity: 0;
		animation: popIn 0.01s linear forwards;
	}
	@keyframes popIn {
		to {
			opacity: 1;
		}
	}
	.animated-column {
		transform: scaleY(0);
		transform-origin: bottom;
		animation: growUp 0.3s ease-out forwards;
	}
	.animated-column-text {
		opacity: 0;
		animation: popIn 0.01s linear 0.3s forwards;
	}
	@keyframes growUp {
		to {
			transform: scaleY(1);
		}
	}
</style>
