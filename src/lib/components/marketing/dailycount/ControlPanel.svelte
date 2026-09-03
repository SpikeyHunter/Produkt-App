<script lang="ts">
	import {
		formatEventDateShort,
		type EventData,
		type DailyCount,
		type EffectiveCount
	} from '$lib/types/dailycount';
	import { createEventDispatcher } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import EventInfoPanel from './EventInfoPanel.svelte';
	import RangeFilter from './RangeFilter.svelte';

	export let events: EventData[] = [];
	export let activeEvents: EventData[] = [];
	export let dailyCounts: DailyCount[] = [];

	export let mode: 'LIVE' | 'CUSTOM' = 'LIVE';
	export let selectedCustomIds: number[] = [];

	export let minAvailableDate = '';
	export let maxAvailableDate = '';

	export let selectedEventForInfo: EventData | null = null;
	export let latestCountForSelected: DailyCount | null = null;
	// Own + linked + reported totals per event (what every displayed count uses).
	export let effectiveCounts: Record<number, EffectiveCount> = {};
	// Every event that can be linked (all events except Réservations).
	export let linkableEvents: EventData[] = [];

	const emptyCount: EffectiveCount = {
		total: 0, ga: 0, vip: 0, base: 0, linked: 0, linkedGa: 0, linkedVip: 0, reported: 0
	};
	const countFor = (id: number): EffectiveCount => effectiveCounts[id] || emptyCount;
	const countLine = (id: number) => {
		const c = countFor(id);
		return `${c.total} - (GA: ${c.ga} / VIP: ${c.vip})`;
	};

	const dispatch = createEventDispatcher();
	let currentFilter: 'LIVE' | 'PAST' = 'LIVE';
	let searchQuery = '';
	let showCustomDropdown = false;
	let expandedTop3Id: number | null = null;

	// Auto-close the custom dropdown if an event is selected to view info
	$: if (selectedEventForInfo) {
		showCustomDropdown = false;
	}

	$: filteredEvents = events
		.filter((e) => {
			// Hide if status doesn't match, UNLESS it's pinned
			if (e.event_status !== currentFilter && !e.pinned) return false; 
			
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					e.event_name.toLowerCase().includes(query) ||
					formatEventDateShort(e.event_date).toLowerCase().includes(query) ||
					(e.event_venue || '').toLowerCase().includes(query)
				);
			}
			return true;
		})
		.sort((a, b) => {
			const dateA = new Date(a.event_date || 0).getTime();
			const dateB = new Date(b.event_date || 0).getTime();
			return currentFilter === 'LIVE' ? dateA - dateB : dateB - dateA;
		});

	// Strict reactive list to control fading in the Top 3 panel
	$: top3Shows = activeEvents
		.map((event) => {
			const counts = dailyCounts.filter((c) => c.event_id === event.event_id);
			const raw =
				counts.length > 0 ? counts[counts.length - 1] : ({ total: 0, ga: 0, vip: 0 } as DailyCount);
			// Displayed numbers fold in the linked event + reported tickets.
			const eff = countFor(event.event_id);
			const latest = { ...raw, total: eff.total, ga: eff.ga, vip: eff.vip } as DailyCount;

			let dailyAvg = 0;
			let weeklyAvg = 0;
			if (counts.length > 0) {
				const firstDate = new Date(counts[0].report_date);
				const lastDate = new Date(raw.report_date);
				const daysDiff = Math.max(
					1,
					Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 3600 * 24))
				);
				dailyAvg = Math.round(eff.total / daysDiff);
				weeklyAvg = Math.round(dailyAvg * 7);
			}
			return { event, latest, dailyAvg, weeklyAvg };
		})
		.sort((a, b) => b.latest.total - a.latest.total)
		.slice(0, 10)
		.map((show) => {
			// Ensures the top 3 list ALSO grays out when interacting with the chart
			const isSelected = selectedEventForInfo?.event_id === show.event.event_id;
			const isFaded = selectedEventForInfo != null && !isSelected;

			return {
				...show,
				uiColor: isFaded ? '#6b7280' : (show.event.color || '#ffffff'),
				uiOpacity: isFaded ? 0.4 : 1
			};
		});

	// Bar length = share of the #1 show's total (100% for the leader).
	$: topMax = top3Shows.length > 0 ? Math.max(1, top3Shows[0].latest.total) : 1;

	function toggleEvent(id: number) {
		if (selectedCustomIds.includes(id))
			selectedCustomIds = selectedCustomIds.filter((x) => x !== id);
		else selectedCustomIds = [...selectedCustomIds, id];
		dispatch('selectionChanged', selectedCustomIds);
	}
</script>

<aside
	class="w-[340px] bg-navbar rounded-3xl p-5 flex flex-col h-full shadow-lg border border-gray1 shrink-0 relative overflow-hidden"
>
	<div
		class="flex flex-col h-full w-full overflow-y-auto custom-scrollbar pr-1 relative {selectedEventForInfo
			? 'z-0'
			: 'z-10'}"
	>
		<div class="flex items-center justify-between mb-4 shrink-0">
			<span class="text-xl font-bold text-white tracking-tight">Data Source</span>
		</div>

		<div
			class="relative flex w-full shrink-0 bg-gray1 p-1 rounded-3xl cursor-pointer select-none mb-6 {selectedEventForInfo
				? 'z-0'
				: 'z-20'}"
		>
			<div
				class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-lime rounded-3xl transition-transform duration-300 ease-in-out shadow-sm"
				style="transform: translateX({mode === 'LIVE' ? '0' : '100%'})"
			></div>
			<div
				class="flex-1 text-center py-2 relative {selectedEventForInfo
					? 'z-0'
					: 'z-10'} text-sm font-bold outline-none {mode === 'LIVE' ? 'text-black' : 'text-gray2'}"
				on:click={() => (mode = 'LIVE')}
				role="button"
				tabindex="0"
				on:keydown={(e) => e.key === 'Enter' && (mode = 'LIVE')}
			>
				Live Events
			</div>
			<div
				class="flex-1 text-center py-2 relative {selectedEventForInfo
					? 'z-0'
					: 'z-10'} text-sm font-bold outline-none {mode === 'CUSTOM'
					? 'text-black'
					: 'text-gray2'}"
				on:click={() => (mode = 'CUSTOM')}
				role="button"
				tabindex="0"
				on:keydown={(e) => e.key === 'Enter' && (mode = 'CUSTOM')}
			>
				Custom
			</div>
		</div>

		{#if mode === 'CUSTOM'}
			<div class="relative w-full shrink-0 mb-6 {selectedEventForInfo ? 'z-0' : 'z-30'}">
				<span class="text-sm font-bold text-gray2 mb-3 block">Custom Selection</span>
				<div
					class="w-full bg-gray1 text-white rounded-xl flex items-center justify-between text-sm font-bold transition-colors"
				>
					<button
						class="flex-1 flex items-center justify-between px-4 py-3 outline-none cursor-pointer bg-transparent border-none text-left"
						on:click={() => (showCustomDropdown = !showCustomDropdown)}
					>
						<span class="truncate pr-2">
							{selectedCustomIds.length > 0
								? `${selectedCustomIds.length} Event${selectedCustomIds.length > 1 ? 's' : ''} Selected`
								: 'Select Events'}
						</span>
						<svg
							class="w-4 h-4 shrink-0 transition-transform duration-200 {showCustomDropdown
								? 'rotate-180'
								: ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path></svg
						>
					</button>
					{#if selectedCustomIds.length > 0}
						<button
							class="pr-4 py-3 pl-2 text-xs text-gray2 hover:text-red-500 transition-colors outline-none cursor-pointer bg-transparent border-none shrink-0"
							on:click|stopPropagation={() => {
								selectedCustomIds = [];
								dispatch('selectionChanged', []);
							}}>Clear</button
						>
					{/if}
				</div>

				{#if showCustomDropdown}
					<button
						type="button"
						class="fixed inset-0 z-40 w-full h-full bg-transparent border-none cursor-default p-0 m-0 appearance-none outline-none"
						on:click={() => (showCustomDropdown = false)}
						aria-label="Close"
						tabindex="-1"
					></button>
					<div
						class="absolute top-[80px] left-0 w-full bg-navbar rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-50 p-4 flex flex-col h-[420px]"
						transition:fly={{ y: -10, duration: 200 }}
					>
						<div class="flex items-center gap-2 mb-4 shrink-0 w-full">
							<input
								type="text"
								placeholder="Search..."
								bind:value={searchQuery}
								class="flex-1 bg-gray1 text-white rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-lime transition-colors min-w-0"
							/>
							<div class="flex bg-gray1 rounded-lg p-0.5 shrink-0">
								<button
									class="px-3 py-1.5 text-xs rounded-md font-bold transition-colors outline-none {currentFilter ===
									'LIVE'
										? 'bg-lime text-black'
										: 'text-gray2 hover:text-white'}"
									on:click={() => (currentFilter = 'LIVE')}>Live</button
								>
								<button
									class="px-3 py-1.5 text-xs rounded-md font-bold transition-colors outline-none {currentFilter ===
									'PAST'
										? 'bg-lime text-black'
										: 'text-gray2 hover:text-white'}"
									on:click={() => (currentFilter = 'PAST')}>Past</button
								>
							</div>
						</div>
						<div class="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
							{#each filteredEvents as event (event.event_id)}
								{@const isSelected = selectedCustomIds.includes(event.event_id)}
								<div
									class="flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer border outline-none {isSelected
										? 'border-lime bg-lime/10'
										: 'border-transparent hover:bg-gray1'}"
									on:click={() => toggleEvent(event.event_id)}
									role="button"
									tabindex="0"
									on:keydown={(e) =>
										(e.key === 'Enter' || e.key === ' ') && toggleEvent(event.event_id)}
								>
									<div class="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray1">
										{#if event.event_flyer}<img
												class="w-full h-full object-cover"
												src={event.event_flyer}
												alt={event.event_name}
											/>{/if}
									</div>
									<div class="flex flex-col min-w-0 flex-1">
										<div 
											class="font-bold text-xs truncate transition-colors duration-200" 
											style="color: {isSelected ? '#ffffff' : 'var(--color-gray2)'}"
										>
											{event.event_name}
										</div>
										<div class="text-[var(--color-gray3)] text-[10px] truncate mt-0.5">
											{event.event_id}{#if event.event_venue}
												- {event.event_venue}{/if}
										</div>
										<div class="text-white text-[10px] truncate mt-0.5">{event.event_date}</div>
									</div>
									{#if isSelected}<div
											class="w-4 h-4 rounded-full bg-lime border-2 border-black flex items-center justify-center shrink-0"
										></div>{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<div
			class="w-full pb-6 border-b border-gray1/40 mb-6 shrink-0 relative {selectedEventForInfo
				? 'z-0'
				: 'z-20'}"
		>
			<span class="text-sm font-bold text-gray2 mb-3 block">Filter by Date</span>
			<RangeFilter
				minDateStr={minAvailableDate}
				maxDateStr={maxAvailableDate}
				on:change={(e) => dispatch('dateRangeFilterChanged', e.detail)}
			/>
		</div>

		<div class="w-full pb-6 relative {selectedEventForInfo ? 'z-0' : 'z-10'}">
			<span class="text-sm font-bold text-gray2 mb-3 block">Top 10 Shows</span>
			<div class="space-y-1.5">
				{#each top3Shows as show, rank (show.event.event_id)}
					{@const isExpanded = expandedTop3Id === show.event.event_id}
					{@const pct = Math.round((show.latest.total / topMax) * 100)}
					<div class="bg-gray1/30 rounded-xl overflow-hidden" style="opacity: {show.uiOpacity}; transition: opacity 0.3s ease;">
						<button
							class="w-full flex items-center gap-2.5 px-2 py-1.5 text-left outline-none hover:bg-gray1/50 transition-colors border-none bg-transparent cursor-pointer"
							on:click={() => (expandedTop3Id = isExpanded ? null : show.event.event_id)}
						>
							<span class="w-4 text-[10px] font-black text-gray2 text-right shrink-0">{rank + 1}</span>
							<div class="w-7 h-7 shrink-0 rounded-md overflow-hidden bg-black">
								{#if show.event.event_flyer}<img
										class="w-full h-full object-cover"
										src={show.event.event_flyer}
										alt={show.event.event_name}
									/>{/if}
							</div>
							<div class="flex flex-col min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<div
										class="font-bold text-xs truncate leading-tight"
										style="color: {show.uiColor}; transition: color 0.3s ease;"
									>
										{show.event.event_name}
									</div>
									<div class="text-xs font-bold text-lime shrink-0">{show.latest.total} sold</div>
								</div>
								<div class="text-gray3 text-[10px] truncate leading-tight mt-0.5">
									{show.event.event_id}{show.event.event_venue ? ` - ${show.event.event_venue}` : ''} · {show.event.event_date}
								</div>
								<!-- Relative to the #1 show -->
								<div class="h-1 w-full rounded-full bg-gray1 mt-1 overflow-hidden">
									<div
										class="h-full rounded-full transition-[width] duration-300"
										style="width: {pct}%; background-color: {show.uiColor};"
									></div>
								</div>
							</div>
						</button>
						{#if isExpanded}
							<div class="p-3 pt-0 bg-black/20" transition:slide={{ duration: 200 }}>
								<div class="flex w-full mt-0 gap-4">
									<div class="flex-1 flex mt-2 flex-col gap-1.5 border-r border-gray2/10 pr-4">
										<span class="text-[11px] font-bold text-lime uppercase">Total</span>
										<div class="flex justify-between text-xs">
											<span class="text-gray2">GA</span><span class="font-bold text-white"
												>{show.latest.ga}</span
											>
										</div>
										<div class="flex justify-between text-xs">
											<span class="text-gray2">VIP</span><span class="font-bold text-white"
												>{show.latest.vip}</span
											>
										</div>
									</div>
									<div class="flex-1 flex mt-2 flex-col gap-1.5">
										<span class="text-[11px] font-bold text-lime uppercase">Sell Through</span>
										<div class="flex justify-between text-xs">
											<span class="text-gray2">GA</span><span class="font-bold text-white"
												>{show.event.stage_type?.capacity?.GA
													? Math.round((show.latest.ga / show.event.stage_type.capacity.GA) * 100)
													: 0}%</span
											>
										</div>
										<div class="flex justify-between text-xs">
											<span class="text-gray2">VIP</span><span class="font-bold text-white"
												>{show.event.stage_type?.capacity?.VIP
													? Math.round((show.latest.vip / show.event.stage_type.capacity.VIP) * 100)
													: 0}%</span
											>
										</div>
									</div>
								</div>
								<div class="mt-3 pt-3 border-t border-gray2/10 flex justify-between text-[12px]">
									<span class="text-gray2"
										>Daily Avg. <strong class="text-white ml-1">{show.dailyAvg}</strong></span
									>
									<span class="text-gray2"
										>Weekly Avg. <strong class="text-white ml-1">{show.weeklyAvg}</strong></span
									>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="text-[14px] text-gray2 text-center py-4 bg-gray1 rounded-xl">
						Select events to display the Top 10
					</div>
				{/each}
			</div>
		</div>
	</div>

	<EventInfoPanel
		{selectedEventForInfo}
		{latestCountForSelected}
		{effectiveCounts}
		{linkableEvents}
		on:closeInfoPanel
		on:colorChanged
		on:stageTypeChanged
		on:pinToggled
		on:linkChanged
		on:reportedCountChanged
	/>
</aside>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		opacity: 0.3;
		border-radius: 4px;
	}
</style>