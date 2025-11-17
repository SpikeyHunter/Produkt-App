<script lang="ts">
	import type { CalendarEvent, CalendarDay, GroupedEvents } from '$lib/types/calendar-types';
	import { createEventDispatcher } from 'svelte';
	
	// Props for all view types
	export let loading: boolean;
	export let viewType: 'month' | 'week' | 'list';
	export let monthViewDays: CalendarDay[] = [];
	export let weekViewDays: CalendarDay[] = [];
	export let listEventsGrouped: GroupedEvents = {};
	export let listDates: string[] = [];
	export let weekDayNames: string[];
	export let monthNames: string[];
	
	const dispatch = createEventDispatcher();
	
	// Status styles with Prism-like colors
	const statusStyles: Record<string, string> = {
		HOLD: 'bg-orange-500/20 text-orange-200 border border-orange-500/30',
		CONFIRMED: 'bg-lime/20 text-lime border border-lime/30',
		PENDING: 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30',
		CANCELLED: 'bg-red-500/20 text-red-200 border border-red-500/30'
	};
	
	// Hold level colors (like Prism)
	const holdLevelStyles: Record<string, string> = {
		H1: 'bg-red-500/30 text-red-200',
		H2: 'bg-orange-500/30 text-orange-200',
		H3: 'bg-yellow-500/30 text-yellow-200',
		H4: 'bg-green-500/30 text-green-200',
		H5: 'bg-blue-500/30 text-blue-200',
		H6: 'bg-purple-500/30 text-purple-200',
		P: 'bg-gray-500/30 text-gray-200'
	};
	
	// Icons for event types
	const eventTypeIcons: Record<string, string> = {
		Show: '🎸',
		Corpo: '💼',
		Other: '🎉'
	};
	
	// Helper functions
	function getEventDisplay(dayEvents: CalendarEvent[]) {
		const displayEvents = dayEvents.slice(0, 4);
		const remaining = dayEvents.length - 4;
		return { displayEvents, remaining };
	}
	
	function getEventStyle(event: CalendarEvent): string {
		if (event.status === 'HOLD' && event.hold_level) {
			return holdLevelStyles[event.hold_level] || statusStyles[event.status];
		}
		return statusStyles[event.status] || 'bg-gray-500/20 text-gray-200';
	}
	
	function formatHoldLabel(event: CalendarEvent): string {
		if (event.hold_level && event.hold_level !== 'P') {
			return event.hold_level;
		} else if (event.hold_level === 'P') {
			return 'P';
		} else if (event.status === 'CONFIRMED') {
			return '✓';
		}
		return '';
	}
	
	function handleKeyPress(e: KeyboardEvent, callback: Function) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			callback();
		}
	}
	
	// Event handlers
	function handleDayClick(day: CalendarDay) {
		dispatch('dayClick', { day, clickedDate: day.date });
	}
	
	function handleEventClick(event: CalendarEvent, e: MouseEvent | KeyboardEvent) {
		dispatch('eventClick', { event, e });
	}
</script>

{#if loading}
	<div class="flex items-center justify-center min-h-[500px]">
		<div class="w-12 h-12 border-3 border-gray2 border-t-lime rounded-full animate-spin"></div>
	</div>
{:else}
	{#if viewType === 'month'}
		<!-- Month View -->
		<div class="grid grid-cols-7 gap-px bg-gray2/10 p-4 mb-px rounded-t-xl">
			{#each weekDayNames as day}
				<div class="text-center text-xs font-bold text-gray2 p-2">{day}</div>
			{/each}
		</div>
		
		<div class="grid grid-cols-7 gap-px bg-gray2/10 rounded-b-xl overflow-hidden">
			{#each monthViewDays as day}
				<div
					class="bg-gray1 min-h-[120px] p-2 transition-all relative cursor-pointer
					       {day.isCurrentMonth ? '' : 'opacity-40'} 
					       {day.isToday ? 'bg-lime/5 ring-1 ring-lime/30' : ''}
					       hover:bg-gray2/10"
					on:click={() => handleDayClick(day)}
					on:keydown={(e) => handleKeyPress(e, () => handleDayClick(day))}
					role="button"
					tabindex="0"
				>
					<!-- Day Number -->
					<div class="flex items-start justify-between mb-2">
						<span class="text-sm font-bold text-white inline-flex items-center justify-center 
						            {day.isToday ? 'bg-lime !text-black w-7 h-7 rounded-full' : ''}">
							{day.dayNumber}
						</span>
						
						<!-- Icons for special states -->
						<div class="flex gap-1">
							{#if day.events.some(e => e.is_challenge)}
								<span class="text-red-400 text-xs" title="Challenge">⚡</span>
							{/if}
							{#if day.events.some(e => e.is_target)}
								<span class="text-green-400 text-xs" title="Target">🎯</span>
							{/if}
						</div>
					</div>
					
					<!-- Events -->
					<div class="flex flex-col gap-1">
						{#if day.events.length > 0}
							{@const { displayEvents, remaining } = getEventDisplay(day.events)}
							{#each displayEvents as event}
								<div
									class="px-2 py-1 rounded-md text-xs font-medium cursor-pointer 
									       transition-all hover:scale-[1.02] hover:shadow-sm
									       flex items-center gap-1 overflow-hidden {getEventStyle(event)}"
									on:click|stopPropagation={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									{#if formatHoldLabel(event)}
										<span class="font-bold text-[10px] opacity-90">
											{formatHoldLabel(event)}
										</span>
									{/if}
									<span class="flex-1 truncate text-left">{event.title}</span>
								</div>
							{/each}
							{#if remaining > 0}
								<div class="text-[10px] text-gray2 px-2 py-0.5 font-semibold">
									+{remaining} more
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
		
	{:else if viewType === 'week'}
		<!-- Week View -->
		<div class="grid grid-cols-7 gap-px bg-gray2/10 p-4 mb-px rounded-t-xl">
			{#each weekViewDays as day, i}
				<div class="text-center text-xs font-bold text-gray2 p-2">
					{weekDayNames[i]} 
					<span class="text-white text-base block mt-1
					            {day.isToday ? 'bg-lime text-black w-8 h-8 rounded-full inline-flex items-center justify-center' : ''}">
						{day.dayNumber}
					</span>
				</div>
			{/each}
		</div>
		
		<div class="grid grid-cols-7 gap-px bg-gray2/10 rounded-b-xl overflow-hidden">
			{#each weekViewDays as day}
				<div class="bg-gray1 min-h-[400px] p-3 transition-all relative 
				           {day.isToday ? 'bg-lime/5 ring-1 ring-lime/30' : ''}
				           hover:bg-gray2/10">
					<div class="flex flex-col gap-2">
						{#each day.events as event}
							<div
								class="p-2 rounded-lg text-xs font-medium cursor-pointer 
								       transition-all hover:scale-[1.02] hover:shadow-sm
								       flex flex-col gap-1 {getEventStyle(event)}"
								on:click={(e) => handleEventClick(event, e)}
								on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center gap-1">
									{#if formatHoldLabel(event)}
										<span class="font-bold text-[10px]">{formatHoldLabel(event)}</span>
									{/if}
									<span class="text-sm">{eventTypeIcons[event.event_type]}</span>
									<span class="flex-1 font-bold truncate">{event.title}</span>
								</div>
								{#if event.artist_name}
									<div class="text-[11px] opacity-80">{event.artist_name}</div>
								{/if}
								{#if event.start_time}
									<div class="text-[10px] opacity-70">
										{event.start_time}{#if event.end_time} - {event.end_time}{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
		
	{:else if viewType === 'list'}
		<!-- List View -->
		<div class="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
			{#if listDates.length > 0}
				{#each listDates as dateKey}
					{@const dayData = listEventsGrouped[dateKey]}
					<div class="mb-6">
						<h3 class="font-bold text-lg text-white mb-3 border-b border-gray2/20 pb-2">
							{weekDayNames[dayData.dateObj.getDay()]}, {monthNames[dayData.dateObj.getMonth()]}
							{dayData.dateObj.getDate()}, {dayData.dateObj.getFullYear()}
						</h3>
						<div class="flex flex-col gap-3">
							{#each dayData.events as event}
								<div
									class="flex items-center gap-4 p-4 bg-black/30 rounded-xl cursor-pointer 
									       hover:bg-black/50 transition-all border border-gray2/20"
									on:click={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									<!-- Hold Level / Status -->
									<div class="w-20 text-center">
										<div class="px-3 py-1 rounded-full text-xs font-bold {getEventStyle(event)}">
											{formatHoldLabel(event) || event.status}
										</div>
									</div>
									
									<!-- Event Details -->
									<div class="border-l border-gray2/30 pl-4 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-lg">{eventTypeIcons[event.event_type]}</span>
											<span class="font-bold text-white text-lg">{event.title}</span>
											{#if event.is_challenge}
												<span class="text-red-400 text-sm" title="Challenge">⚡</span>
											{/if}
											{#if event.is_target}
												<span class="text-green-400 text-sm" title="Target">🎯</span>
											{/if}
										</div>
										<div class="text-sm text-gray2 mt-1">
											{#if event.artist_name}{event.artist_name} • {/if}
											{#if event.venue_category}{event.venue_category}{/if}
											{#if event.venue_room} - {event.venue_room}{/if}
										</div>
										{#if event.start_time}
											<div class="text-sm text-gray3 mt-1">
												{event.start_time}{#if event.end_time} - {event.end_time}{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div class="text-center text-gray2 py-20">No events found.</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}
</style>