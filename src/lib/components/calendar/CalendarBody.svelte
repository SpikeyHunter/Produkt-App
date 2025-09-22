<script lang="ts">
	import type { CalendarEvent, CalendarDay, GroupedEvents } from '$lib/types/types';
	import { createEventDispatcher } from 'svelte';

	// Props for all view types
	export let loading: boolean;
	export let viewType: 'month' | 'week' | 'list';
	export let monthViewDays: CalendarDay[] = [];
	export let weekViewDays: CalendarDay[] = [];
	export let listEventsGrouped: GroupedEvents = {};
	export let listDates: string[] = [];
	
	// Constants passed from parent
	export let weekDayNames: string[];
	export let monthNames: string[];
	export let statusStyles: Record<string, string>;
	export let eventTypeIcons: Record<string, string>;

	const dispatch = createEventDispatcher();

	// --- UI Helper Functions (moved from parent) ---
	function getEventDisplay(dayEvents: CalendarEvent[]) {
		const displayEvents = dayEvents.slice(0, 3);
		const remaining = dayEvents.length - 3;
		return { displayEvents, remaining };
	}

	function handleKeyPress(e: KeyboardEvent, callback: Function) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			callback();
		}
	}

	// --- Event Forwarders ---
	function handleDayClick(day: CalendarDay) {
		dispatch('dayClick', day);
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
		<div class="grid grid-cols-7 gap-px bg-gray2/10 p-4 mb-px">
			{#each weekDayNames as day}
				<div class="text-center text-xs font-bold text-gray2 p-2">{day}</div>
			{/each}
		</div>
		<div class="grid grid-cols-7 gap-px bg-gray2/10">
			{#each monthViewDays as day}
				<div
					class="bg-gray1 min-h-[120px] p-2 transition-colors relative {day.isCurrentMonth ? '' : 'opacity-40'} {day.isToday ? 'bg-lime/10' : ''}"
					on:click={() => handleDayClick(day)}
					on:keydown={(e) => handleKeyPress(e, () => handleDayClick(day))}
					role="button"
					tabindex="0"
				>
					<span
						class="text-sm font-bold text-white inline-flex items-center justify-center {day.isToday ? 'bg-lime !text-black w-7 h-7 rounded-full' : ''}"
					>
						{day.dayNumber}
					</span>
					<div class="flex flex-col gap-0.5 mt-2">
						{#if day.events.length > 0}
							{@const { displayEvents, remaining } = getEventDisplay(day.events)}
							{#each displayEvents as event}
								<div
									class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-1 overflow-hidden whitespace-nowrap text-ellipsis {statusStyles[event.status]}"
									on:click={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									<span class="text-[10px]">{eventTypeIcons[event.event_type]}</span>
									<span class="flex-1 overflow-hidden text-ellipsis text-left">{event.title}</span>
								</div>
							{/each}
							{#if remaining > 0}
								<div class="text-[10px] text-gray2 px-2 py-0.5 font-semibold">+{remaining} more</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else if viewType === 'week'}
		<div class="grid grid-cols-7 gap-px bg-gray2/10 p-4 mb-px">
			{#each weekViewDays as day, i}
				<div class="text-center text-xs font-bold text-gray2 p-2">
					{weekDayNames[i]} <span class="text-white text-base">{day.dayNumber}</span>
				</div>
			{/each}
		</div>
		<div class="grid grid-cols-7 gap-px bg-gray2/10">
			{#each weekViewDays as day}
				<div class="bg-gray1 min-h-[400px] p-2 transition-colors relative {day.isToday ? 'bg-lime/10' : ''}">
					<div class="flex flex-col gap-1.5 mt-2">
						{#each day.events as event}
							<div
								class="p-2 rounded text-xs font-semibold cursor-pointer transition-transform hover:scale-[1.02] flex items-start gap-2 {statusStyles[event.status]}"
								on:click={(e) => handleEventClick(event, e)}
								on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
								role="button"
								tabindex="0"
							>
								<span class="text-sm pt-0.5">{eventTypeIcons[event.event_type]}</span>
								<div class="flex-1 text-left">
									<div class="font-bold text-sm">{event.title}</div>
									{#if event.start_time}
										<div class="text-[11px] opacity-80">
											{event.start_time}{#if event.end_time} - {event.end_time}{/if}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else if viewType === 'list'}
		<div class="max-h-[600px] overflow-y-auto pr-2">
			{#if listDates.length > 0}
				{#each listDates as dateKey}
					{@const dayData = listEventsGrouped[dateKey]}
					<div class="mb-6">
						<h3 class="font-bold text-lg text-white mb-3 border-b border-gray2/20 pb-2">
							{weekDayNames[dayData.dateObj.getDay()]}, {monthNames[dayData.dateObj.getMonth()]}
							{dayData.dateObj.getDate()}
						</h3>
						<div class="flex flex-col gap-3">
							{#each dayData.events as event}
								<div
									class="flex items-center gap-4 p-3 bg-gray2/10 rounded-lg cursor-pointer hover:bg-gray2/20 transition-colors"
									on:click={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeyPress(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									<div class="w-24 text-center">
										<div class="px-3 py-1 rounded-full text-xs font-bold {statusStyles[event.status]}">
											{event.status}
										</div>
										{#if event.start_time}
											<div class="text-sm text-gray2 mt-1">{event.start_time}</div>
										{/if}
									</div>
									<div class="border-l border-gray2/30 pl-4 flex-1">
										<div class="font-bold text-white">{event.title}</div>
										<div class="text-sm text-gray2">
											{#if event.artist_name}{event.artist_name} &middot; {/if}
											{event.event_type} Event
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div class="text-center text-gray2 py-20">No events for this month.</div>
			{/if}
		</div>
	{/if}
{/if}