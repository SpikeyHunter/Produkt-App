<script lang="ts">
	import type { CalendarEvent, CalendarDay, GroupedEvents, StageConfig } from '$lib/types/calendar-types';
	import { createEventDispatcher } from 'svelte';
	
	export let loading: boolean;
	export let viewType: 'month' | 'week' | 'list';
	export let monthViewDays: CalendarDay[] = [];
	export let weekViewDays: CalendarDay[] = [];
	export let listEventsGrouped: GroupedEvents = {};
	export let listDates: string[] = [];
	export let monthNames: string[];
	export let weekDayNames: string[];
	export let activeDates: string[] = [];
	export let stages: StageConfig[] = [];
	export let isAddingEvent: boolean = false;
	export let minRowHeight: number = 100; 
	
	const dispatch = createEventDispatcher();
	
	function getBaseColor(event: CalendarEvent): string {
		const roomName = event.venue.room;
		if (!roomName) return '#828282';
		const stage = stages.find(s => s.name === roomName);
		return stage ? stage.color : '#828282';
	}
	
	function formatLabel(event: CalendarEvent): string {
		if (event.status === 'HOLD' && event.hold_level) return event.hold_level;
		if (event.hold_level === 'P') return 'P';
		return '';
	}

	function formatVenues(roomStr: string | null): string {
		if (!roomStr) return 'No Stage Selected';
		return roomStr.replace(/Main Room/g, 'Main').replace(/NFT Gallery/g, 'NFT').replace(/Side Terrace/g, 'Side').replace(/Back Terrace/g, 'Back');
	}

	function sortEventsForDisplay(events: CalendarEvent[]) {
		return [...events]
			.filter(e => e.status !== 'HIDDEN') 
			.sort((a, b) => {
				if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
				if (a.status !== 'CONFIRMED' && b.status === 'CONFIRMED') return 1;

				const aIsPrio = a.details?.is_priority ? 1 : 0;
				const bIsPrio = b.details?.is_priority ? 1 : 0;
				if (aIsPrio !== bIsPrio) return bIsPrio - aIsPrio; 

				if (a.status !== 'CONFIRMED' && b.status !== 'CONFIRMED') {
					const numA = a.hold_level === 'P' ? 0 : (parseInt((a.hold_level || '').replace(/\D/g, '')) || 100);
					const numB = b.hold_level === 'P' ? 0 : (parseInt((b.hold_level || '').replace(/\D/g, '')) || 100);
					if (numA !== numB) return numA - numB;
				}

				const getRoomIndex = (roomName: string | null) => {
					if (!roomName) return 999;
					const idx = stages.findIndex(s => s.name === roomName);
					return idx === -1 ? 999 : idx;
				};
				
				const roomIdxA = getRoomIndex(a.venue.room);
				const roomIdxB = getRoomIndex(b.venue.room);
				if (roomIdxA !== roomIdxB) return roomIdxA - roomIdxB;
				
				const titleA = a.title || '';
				const titleB = b.title || '';
				return titleA.localeCompare(titleB);
			});
	}

	function handleDragStart(e: DragEvent, event: CalendarEvent) {
		if (isAddingEvent || event.isDraft) {
			e.preventDefault();
			return;
		}
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', JSON.stringify(event));
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDrop(e: DragEvent, dateObj: Date) {
		e.preventDefault();
		if (isAddingEvent) return;
		const data = e.dataTransfer?.getData('text/plain');
		if (data) {
			try {
				const event = JSON.parse(data);
				const newDateStr = dateObj.toISOString().split('T')[0];
				if (event.date !== newDateStr) {
					dispatch('moveEvent', { event, newDate: newDateStr });
				}
			} catch (err) { console.error('Drag drop error:', err); }
		}
	}
	
	function handleDayClick(day: CalendarDay) { dispatch('dayClick', { day, clickedDate: day.date }); }
	function handleEventClick(event: CalendarEvent, e: MouseEvent | KeyboardEvent) { dispatch('eventClick', { event, e }); }
	function handleKeydown(e: KeyboardEvent, callback: Function) {
		if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); callback(); }
	}
</script>

{#if loading}
	<div class="flex items-center justify-center h-full min-h-[400px]">
		<div class="w-10 h-10 border-4 border-gray2/20 border-t-lime rounded-full animate-spin"></div>
	</div>
{:else}
	<div class="flex flex-col h-full w-full overflow-hidden bg-transparent">
		{#if viewType === 'month'}
			<div class="grid grid-cols-7 gap-px bg-gray2/10 p-2 mb-px shrink-0 border-b border-gray2/10">
				{#each weekDayNames as day}
					<div class="text-center text-[10px] font-black text-gray2 tracking-widest uppercase">{day}</div>
				{/each}
			</div>
			
			<div class="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col bg-navbar">
				<div class="grid grid-cols-7 gap-px w-full h-max bg-gray2/10 border-b border-gray2/10" style="grid-template-rows: repeat(6, minmax({minRowHeight}px, auto));">
					{#each monthViewDays as day}
						{@const isSelected = activeDates.includes(day.date.toISOString().split('T')[0])}
						<div
							class="bg-navbar p-1.5 flex flex-col transition-all relative cursor-pointer {day.isCurrentMonth ? '' : 'opacity-40'}"
							on:click={() => handleDayClick(day)}
							on:keydown={(e) => handleKeydown(e, () => handleDayClick(day))}
							on:dragover|preventDefault
							on:drop={(e) => handleDrop(e, day.date)}
							role="button" tabindex="0"
						>
							{#if isSelected}
								<div class="absolute inset-0 border-2 border-lime z-0 pointer-events-none"></div>
							{/if}

							<div class="absolute top-1.5 right-1.5 z-10 text-right shrink-0">
								<span class="text-[11px] font-bold text-white {day.isToday ? 'bg-lime !text-black px-1.5 py-0.5 rounded-full' : ''}">
									{day.dayNumber}
								</span>
							</div>
							
							<div class="flex-1 flex flex-col gap-[3px] pr-1 z-10 mt-[20px]">
								{#each sortEventsForDisplay(day.events) as event}
									{@const color = getBaseColor(event)}
									{@const isDimmed = isAddingEvent && !event.isDraft}
									{@const isDisabled = isAddingEvent}
									
									{#if event.status === 'CONFIRMED'}
										<div 
											class="flex items-center gap-1.5 px-1.5 py-1 rounded-[4px] min-h-[20px] transition-transform active:scale-95 shadow-sm overflow-hidden text-black {isDimmed ? 'opacity-40' : ''} {isDisabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}" 
											style="background-color: {color};" 
											draggable={!isAddingEvent}
											on:dragstart={(e) => handleDragStart(e, event)}
											on:click|stopPropagation={(e) => handleEventClick(event, e)} 
											on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
											role="button" tabindex="0"
										>
											<svg class="w-3 h-3 shrink-0 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
											<span class="truncate font-bold text-[11px] leading-none pb-[1px]">{event.title}</span>
										</div>
									{:else}
										<div 
											class="flex items-center gap-1.5 rounded-[4px] min-h-[20px] transition-transform active:scale-95 overflow-hidden {isDimmed ? 'opacity-40' : ''} {isDisabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}" 
											draggable={!isAddingEvent}
											on:dragstart={(e) => handleDragStart(e, event)}
											on:click|stopPropagation={(e) => handleEventClick(event, e)} 
											on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
											role="button" tabindex="0"
										>
											<div class="w-[22px] h-[20px] rounded-[4px] flex items-center justify-center text-black font-black text-[10px] shrink-0" style="background-color: {color};">
												{formatLabel(event)}
											</div>
											<span class="truncate font-bold text-[11px] text-white leading-none pb-[1px]">{event.title}</span>
											
											{#if event.details?.is_target || event.details?.is_challenge}
												<div class="ml-auto flex items-center gap-0.5 shrink-0 pr-1 text-[#828282]">
													{#if event.details?.is_target}
														<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
													{/if}
													{#if event.details?.is_challenge}
														<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>

		{:else if viewType === 'week'}
			<div class="grid grid-cols-7 gap-px bg-gray2/10 p-3 mb-px shrink-0 border-b border-gray2/10">
				{#each weekDayNames as day, i}
					<div class="text-center text-[10px] font-black text-gray2 tracking-widest uppercase">
						{day} <span class="text-white text-base block mt-1 {weekViewDays[i].isToday ? 'bg-lime text-black px-2 py-0.5 rounded-full' : ''}">{weekViewDays[i].dayNumber}</span>
					</div>
				{/each}
			</div>
			
			<div class="flex-1 w-full overflow-y-auto custom-scrollbar bg-gray2/10 flex flex-col">
				<div class="grid grid-cols-7 gap-px w-full flex-1" style="grid-template-rows: minmax(100%, 1fr);">
					{#each weekViewDays as day}
						{@const isSelected = activeDates.includes(day.date.toISOString().split('T')[0])}
						<div 
							class="bg-navbar p-3 flex flex-col relative {isSelected ? 'border-2 border-lime' : ''}"
							on:click={() => handleDayClick(day)}
							on:keydown={(e) => handleKeydown(e, () => handleDayClick(day))}
							on:dragover|preventDefault
							on:drop={(e) => handleDrop(e, day.date)}
							role="button" tabindex="0"
						>
							<div class="flex flex-col gap-2 z-10">
								{#each sortEventsForDisplay(day.events) as event}
									{@const color = getBaseColor(event)}
									{@const isDimmed = isAddingEvent && !event.isDraft}
									{@const isDisabled = isAddingEvent}

									{#if event.status === 'CONFIRMED'}
										<div 
											class="flex items-center gap-2 px-2 py-2.5 rounded-lg min-h-[30px] transition-transform active:scale-95 shadow-md overflow-hidden text-black {isDimmed ? 'opacity-40' : ''} {isDisabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}" 
											style="background-color: {color};" 
											draggable={!isAddingEvent} on:dragstart={(e) => handleDragStart(e, event)}
											on:click|stopPropagation={(e) => handleEventClick(event, e)} on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
											role="button" tabindex="0"
										>
											<svg class="w-4 h-4 shrink-0 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
											<span class="truncate font-bold text-sm leading-none">{event.title}</span>
										</div>
									{:else}
										<div 
											class="flex items-center gap-2 rounded-lg min-h-[30px] transition-transform active:scale-95 overflow-hidden {isDimmed ? 'opacity-40' : ''} {isDisabled ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'}" 
											draggable={!isAddingEvent} on:dragstart={(e) => handleDragStart(e, event)}
											on:click|stopPropagation={(e) => handleEventClick(event, e)} on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
											role="button" tabindex="0"
										>
											<div class="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-black font-black text-xs shrink-0" style="background-color: {color};">
												{formatLabel(event)}
											</div>
											<span class="truncate font-bold text-sm text-white leading-none">{event.title}</span>
											
											{#if event.details?.is_target || event.details?.is_challenge}
												<div class="ml-auto flex items-center gap-1 shrink-0 pr-2 text-[#828282]">
													{#if event.details?.is_target}
														<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
													{/if}
													{#if event.details?.is_challenge}
														<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>

		{:else if viewType === 'list'}
			<div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
				{#if listDates.length > 0}
					{#each listDates as dateKey}
						{@const dayData = listEventsGrouped[dateKey]}
						<div class="mb-8 max-w-4xl mx-auto">
							<h3 class="font-black text-xs text-gray2 uppercase tracking-[0.2em] mb-4 border-b border-gray2/10 pb-2">
								{weekDayNames[dayData.dateObj.getDay()]}, {monthNames[dayData.dateObj.getMonth()]} {dayData.dateObj.getDate()}
							</h3>
							<div class="flex flex-col gap-3">
								{#each sortEventsForDisplay(dayData.events) as event}
									{@const color = getBaseColor(event)}
									{@const isDimmed = isAddingEvent && !event.isDraft}
									{@const isDisabled = isAddingEvent}

									<div 
										class="flex items-center gap-5 p-4 rounded-2xl cursor-pointer hover:bg-white/5 transition-all {event.status === 'CONFIRMED' ? '' : 'border border-gray2/10'} {isDimmed ? 'opacity-40' : ''} {isDisabled ? 'pointer-events-none' : ''}" 
										style={event.status === 'CONFIRMED' ? `background-color: ${color}; color: var(--color-black);` : ''} 
										on:click={(e) => handleEventClick(event, e)} 
										on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
										role="button" tabindex="0"
									>
										<div class="w-16 text-center font-black text-sm">
											{#if event.status === 'CONFIRMED'} 
												<span class="text-black text-xl">✓</span> 
											{:else} 
												<span class="px-2.5 py-1.5 rounded text-black text-[10px]" style="background-color: {color};">{formatLabel(event)}</span> 
											{/if}
										</div>
										<div class="flex-1 border-l border-white/10 pl-5">
											<div class="font-black text-lg {event.status === 'CONFIRMED' ? 'text-black' : 'text-white'}">
												{event.title}
												
												{#if event.status !== 'CONFIRMED' && (event.details?.is_target || event.details?.is_challenge)}
													<span class="inline-flex items-center gap-1.5 ml-2 align-middle text-[#828282]">
														{#if event.details?.is_target}
															<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
														{/if}
														{#if event.details?.is_challenge}
															<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
														{/if}
													</span>
												{/if}
											</div>
											<div class="text-xs font-bold {event.status === 'CONFIRMED' ? 'opacity-80 text-black' : 'text-gray2'} mt-1 uppercase tracking-wider">{formatVenues(event.venue.room)}</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				{:else}
					<div class="text-center text-gray2 text-lg py-20 font-black tracking-widest uppercase">No upcoming events found.</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 4px; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(247,247,247,0.15); border-radius: 10px; }
	.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-lime); }
</style>