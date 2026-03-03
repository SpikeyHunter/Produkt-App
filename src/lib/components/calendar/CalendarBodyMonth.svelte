<script lang="ts">
	import type { CalendarEvent, CalendarDay, StageConfig } from '$lib/types/calendar-types';
	import { createEventDispatcher } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	export let loading: boolean;
	export let monthViewDays: CalendarDay[] = [];
	export let weekDayNames: string[];
	export let activeDates: string[] = [];
	export let stages: StageConfig[] = [];
	export let isAddingEvent: boolean = false;
	export let minRowHeight: number = 100;
	export let deletedIds: string[] = [];
	let windowHeight = 0;
	$: minRowHeight = windowHeight > 900 ? 125 : 105;

	export let managingGroupId: string | null = null;
	export let canEdit: boolean;
	export let canViewHolds: boolean;

	const dispatch = createEventDispatcher();

	function getBaseColor(event: CalendarEvent): string {
		const roomName = event.venue.room;
		if (!roomName) return '#828282';
		const stage = stages.find((s) => s.name === roomName);
		return stage ? stage.color : '#828282';
	}

	function formatLabel(event: CalendarEvent): string {
		if (event.status === 'HOLD' && event.hold_level) return event.hold_level;
		if (event.hold_level === 'P') return 'P';
		return '';
	}

	function sortEventsForDisplay(events: CalendarEvent[]) {
		return [...events]
			.filter((e) => e.status !== 'HIDDEN' && !deletedIds.includes(e.id))
			.sort((a, b) => {
				// 1. CONFIRMED always goes at the absolute top, no matter what
				if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
				if (a.status !== 'CONFIRMED' && b.status === 'CONFIRMED') return 1;

				// 2. Keep NOTES at the top of the REMAINING unconfirmed events
				const aIsNotes = a.venue?.room === 'NOTES' && a.venue?.category === 'NOTES';
				const bIsNotes = b.venue?.room === 'NOTES' && b.venue?.category === 'NOTES';
				if (aIsNotes && !bIsNotes) return -1;
				if (!aIsNotes && bIsNotes) return 1;

				// 3. VENUE/ROOM PRIORITY (Sorted by the order they appear in your Venue Settings)
				const getRoomIndex = (roomName: string | null) => {
					if (!roomName) return 999;
					const idx = stages.findIndex((s) => s.name === roomName);
					return idx === -1 ? 999 : idx;
				};
				const roomIdxA = getRoomIndex(a.venue.room);
				const roomIdxB = getRoomIndex(b.venue.room);
				if (roomIdxA !== roomIdxB) return roomIdxA - roomIdxB;

				// 4. PRIORITY HOLDS (Checked Priority toggles)
				const aIsPrio = a.details?.is_priority ? 1 : 0;
				const bIsPrio = b.details?.is_priority ? 1 : 0;
				if (aIsPrio !== bIsPrio) return bIsPrio - aIsPrio;

				// 5. HOLD LEVELS (H1 before H2, etc.)
				if (a.status !== 'CONFIRMED' && b.status !== 'CONFIRMED') {
					const numA =
						a.hold_level === 'P' ? 0 : parseInt((a.hold_level || '').replace(/\D/g, '')) || 100;
					const numB =
						b.hold_level === 'P' ? 0 : parseInt((b.hold_level || '').replace(/\D/g, '')) || 100;
					if (numA !== numB) return numA - numB;
				}

				// 6. Finally, sort alphabetically if everything else is identical
				return (a.title || '').localeCompare(b.title || '');
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
			} catch (err) {
				console.error('Drag drop error:', err);
			}
		}
	}

	function handleDayClick(day: CalendarDay) {
		dispatch('dayClick', { day, clickedDate: day.date });
	}
	function handleEventClick(event: CalendarEvent, e: MouseEvent | KeyboardEvent) {
		dispatch('eventClick', { event, e });
	}
	function handleKeydown(e: KeyboardEvent, callback: Function) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			callback();
		}
	}

	function formatEventTitle(event: CalendarEvent): string {
		const title = event.title || '';
		const eventType = event.details?.type;

		// 1. Check for the "Corpo" Hold exception specifically
		// If it's a Corpo event, always show the prefix regardless of status
		if (eventType === 'Corpo') {
			return `Corpo - ${title}`;
		}

		// 2. Original logic: If it's a Hold/Pending (and not the Corpo exception above),
		// return just the title without prefix/suffix
		if (event.status !== 'CONFIRMED') {
			return title;
		}

		if (!eventType) return title;

		// 3. Only Confirmed events reach this point (other than Corpo which was handled)
		const prefixTypes = ['NCG 360', 'DSTRKT']; // Removed Corpo from here as it's handled in step 1

		if (prefixTypes.includes(eventType)) {
			const displayType = eventType === 'NCG 360' ? 'NCG360' : eventType;
			return `${displayType} - ${title}`;
		}

		if (eventType === 'Bazart Nuits') return `${title} - ${eventType}`;

		return title;
	}
</script>

<svelte:window bind:innerHeight={windowHeight} />

{#if loading}
	<div class="flex items-center justify-center h-full min-h-[400px]">
		<div class="w-10 h-10 border-4 border-gray2/20 border-t-lime rounded-full animate-spin"></div>
	</div>
{:else}
	<div class="flex flex-col h-full w-full overflow-hidden bg-transparent">
		<div class="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col bg-navbar relative">
			<div
				class="grid gap-px w-full h-max bg-gray2/10 border-b border-gray2/10"
				style="grid-template-columns: repeat(7, minmax(13%, auto)); grid-template-rows: auto repeat(6, minmax({minRowHeight}px, auto));"
			>
				{#each weekDayNames as day}
					<div
						class="sticky top-0 z-40 bg-gray1 p-2 text-center text-[10px] font-black text-gray2 tracking-widest uppercase shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
					>
						{day}
					</div>
				{/each}

				{#each monthViewDays as day}
					{@const isSelected = activeDates.includes(day.date.toISOString().split('T')[0])}
					<div
						class="bg-navbar p-1.5 flex flex-col transition-all relative cursor-pointer {day.isCurrentMonth
							? ''
							: 'opacity-40'}"
						on:click={() => handleDayClick(day)}
						on:keydown={(e) => handleKeydown(e, () => handleDayClick(day))}
						on:dragover|preventDefault
						on:drop={(e) => handleDrop(e, day.date)}
						role="button"
						tabindex="0"
					>
						{#if isSelected}
							<div class="absolute inset-0 border-2 border-lime z-0 pointer-events-none"></div>
						{/if}

						<div class="absolute top-0 right-1.5 z-10 text-right shrink-0">
							<span
								class="text-[11px] font-bold text-white {day.isToday
									? 'absolute top-0.5 !right-0 bg-lime !text-black px-1.5 py-0.25 rounded-full'
									: ''}"
							>
								{day.dayNumber}
							</span>
						</div>

						<div class="flex-1 flex flex-col gap-[3px] pr-1 z-10 mt-[20px]">
							{#each sortEventsForDisplay(day.events) as event}
								{@const color = getBaseColor(event)}
								{@const isDimmed =
									(isAddingEvent && !event.isDraft) ||
									(managingGroupId !== null && event.group_id !== managingGroupId)}
								{@const isDisabled =
									isAddingEvent ||
									(managingGroupId !== null && event.group_id !== managingGroupId) ||
									!canViewHolds}
								{#if event.status === 'CANCELED'}
									<div
										class="flex items-center gap-1.5 px-1.5 py-1 rounded-[4px] min-h-[20px] transition-transform active:scale-95 shadow-sm overflow-hidden text-problem border border-problem/50 bg-transparent {isDimmed
											? 'opacity-40'
											: ''} {isDisabled
											? 'pointer-events-none'
											: canEdit
												? 'cursor-grab active:cursor-grabbing'
												: 'cursor-pointer'}"
										draggable={!isAddingEvent && canEdit}
										on:dragstart={(e) => handleDragStart(e, event)}
										on:click|stopPropagation={(e) => handleEventClick(event, e)}
										on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
										role="button"
										tabindex="0"
									>
										<svg
											class="w-3 h-3 shrink-0 text-problem"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="4"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
										<span
											class="truncate font-bold text-[11px] text-white leading-none pb-[1px] max-w-[14vw]"
										>
											{formatEventTitle(event)}
										</span>

										{#if event.event_details?.is_target || event.event_details?.is_challenge}
											<div class="ml-auto flex items-center gap-0.5 shrink-0 pr-1 text-gray3">
												{#if event.event_details?.is_target}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"
														></circle><circle cx="12" cy="12" r="2"></circle>
													</svg>
												{/if}
												{#if event.event_details?.is_challenge}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
													</svg>
												{/if}
											</div>
										{/if}
									</div>
								{:else if event.status === 'CONFIRMED'}
									<div
										class="flex items-center gap-1.5 px-1.5 py-1 rounded-[4px] min-h-[20px] transition-transform active:scale-95 shadow-sm overflow-hidden text-black {isDimmed
											? 'opacity-40'
											: ''} {isDisabled
											? 'pointer-events-none'
											: canEdit
												? 'cursor-grab active:cursor-grabbing'
												: 'cursor-pointer'}"
										draggable={!isAddingEvent && canEdit}
										style="background-color: {color};"
										on:dragstart={(e) => handleDragStart(e, event)}
										on:click|stopPropagation={(e) => handleEventClick(event, e)}
										on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
										role="button"
										tabindex="0"
									>
										<svg
											class="w-3 h-3 shrink-0 text-black"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="4"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
										<span class="truncate font-bold text-[11px] leading-none pb-[1px] max-w-[14vw]">
											{formatEventTitle(event)}
										</span>

										{#if event.event_details?.is_target || event.event_details?.is_challenge}
											<div class="ml-auto flex items-center gap-0.5 shrink-0 pr-1 text-gray3">
												{#if event.event_details?.is_target}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"
														></circle><circle cx="12" cy="12" r="2"></circle>
													</svg>
												{/if}
												{#if event.event_details?.is_challenge}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
													</svg>
												{/if}
											</div>
										{/if}
									</div>
								{:else}
									<div
										class="flex items-center gap-1.5 rounded-[4px] min-h-[20px] transition-transform active:scale-95 overflow-hidden {isDimmed
											? 'opacity-40'
											: ''} {isDisabled
											? 'pointer-events-none'
											: 'cursor-grab active:cursor-grabbing'}"
										draggable={!isAddingEvent}
										on:dragstart={(e) => handleDragStart(e, event)}
										on:click|stopPropagation={(e) => handleEventClick(event, e)}
										on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
										role="button"
										tabindex="0"
									>
										<div
											class="w-[22px] h-[20px] rounded-[4px] flex items-center justify-center text-black font-black text-[10px] shrink-0"
											style="background-color: {color};"
										>
											{formatLabel(event)}
										</div>
										<span
											class="truncate font-bold text-[11px] text-white leading-none pb-[1px] max-w-[14vw]"
										>
											{formatEventTitle(event)}
										</span>

										{#if event.event_details?.is_target || event.event_details?.is_challenge}
											<div class="ml-auto flex items-center gap-0.5 shrink-0 pr-1 text-gray3">
												{#if event.event_details?.is_target}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"
														></circle><circle cx="12" cy="12" r="2"></circle>
													</svg>
												{/if}
												{#if event.event_details?.is_challenge}
													<svg
														class="w-3 h-3"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
													</svg>
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
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(247, 247, 247, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>
