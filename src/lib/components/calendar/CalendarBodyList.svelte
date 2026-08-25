<script lang="ts">
	import type {
		CalendarEvent,
		GroupedEvents,
		StageConfig,
		VenueSettings
	} from '$lib/types/calendar-types';
	import { createEventDispatcher, tick } from 'svelte';
	import { slide } from 'svelte/transition';

	export let loading: boolean;
	export let listEventsGrouped: GroupedEvents = {};
	export let listDates: string[] = [];
	export let monthNames: string[];

	export let stages: StageConfig[] = [];
	export let venues: VenueSettings[] = [];
	export let layoutMode: 'list' | 'grid' = 'list';

	export let isAddingEvent: boolean = false;
	export let deletedIds: string[] = [];
	export let currentViewDate: Date = new Date();

	export let managingGroupId: string | null = null;
	export let canViewHolds: boolean;

	// This prop must be bound in the parent for the filter state to be received!
	export let listFilterMode: 'past' | 'all' | 'upcoming' = 'upcoming';

	const dispatch = createEventDispatcher();

	let showFilters = true;
	let scrollContainerRef: HTMLElement;

	let searchQuery = '';
	let selectedMonth: number | 'ALL' = 'ALL';
	let selectedYear: number | 'ALL' = 'ALL';
	let showMonthYearDrop = false;

	let showStatusHold = true;
	let showStatusConfirmed = true;
	let minHoldIdx = 0;
	let maxHoldIdx = 20;

	let selectedTypes: string[] = [];
	let showTypeDropdown = false;
	let selectedRooms: string[] = [];
	let showVenueDropdown = false;

	let venueDropRef: HTMLElement;
	let typeDropRef: HTMLElement;
	let monthYearDropRef: HTMLElement;

	const allTypes = [
		'Corpo',
		'Bazart Nuits',
		'Moet City',
		'NCG Show',
		'NCG 360',
		'DSTRKT',
		'Tour Prod',
		'Other'
	];

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	const fullWeekNames = [
		'SUNDAY',
		'MONDAY',
		'TUESDAY',
		'WEDNESDAY',
		'THURSDAY',
		'FRIDAY',
		'SATURDAY'
	];

	// Automatically triggers smooth scrolling when 'Today' is clicked and changes the date
	let prevDateForScroll = '';

	$: {
		if (currentViewDate) {
			const cvdStr = currentViewDate.toISOString().split('T')[0];
			const todayStr = new Date().toISOString().split('T')[0];

			// Detect when the date specifically jumps back to today
			if (cvdStr !== prevDateForScroll) {
				prevDateForScroll = cvdStr;

				if (cvdStr === todayStr) {
					// Add small delay to let DOM render first
					setTimeout(() => scrollToNearestToday(), 150);
				}
			}
		}
	}

	export async function scrollToNearestToday() {
		await tick();
		if (!scrollContainerRef) return;
		const today = new Date();
		const tY = today.getFullYear();
		const tM = String(today.getMonth() + 1).padStart(2, '0');
		const tD = String(today.getDate()).padStart(2, '0');
		const localTodayStr = `${tY}-${tM}-${tD}`;

		// Find exactly today, or the first date after today
		let targetDate = filteredListDates.find((d) => d >= localTodayStr);

		// If there are no future events, just jump to the last past event
		if (!targetDate && filteredListDates.length > 0) {
			targetDate = filteredListDates[filteredListDates.length - 1];
		}

		if (targetDate) {
			const el = document.getElementById(`date-${targetDate}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}

	function handleWindowClick(e: MouseEvent) {
		if (showVenueDropdown && venueDropRef && !venueDropRef.contains(e.target as Node)) {
			showVenueDropdown = false;
		}
		if (showTypeDropdown && typeDropRef && !typeDropRef.contains(e.target as Node)) {
			showTypeDropdown = false;
		}
		if (showMonthYearDrop && monthYearDropRef && !monthYearDropRef.contains(e.target as Node)) {
			showMonthYearDrop = false;
		}
	}

	function toggleVenueDropdown() {
		showVenueDropdown = !showVenueDropdown;
		showTypeDropdown = false;
		showMonthYearDrop = false;
	}

	function toggleTypeDropdown() {
		showTypeDropdown = !showTypeDropdown;
		showVenueDropdown = false;
		showMonthYearDrop = false;
	}

	function toggleMonthYear() {
		showMonthYearDrop = !showMonthYearDrop;
		showVenueDropdown = false;
		showTypeDropdown = false;
	}

	function handleMonthSelect(idx: number | 'ALL') {
		selectedMonth = idx;

		if (idx !== 'ALL' && currentViewDate) {
			const newDate = new Date(currentViewDate);
			newDate.setMonth(idx);
			dispatch('jumpToDate', newDate);
		}
	}

	function handleYearSelect(yr: number | 'ALL') {
		selectedYear = yr;
		if (yr !== 'ALL' && currentViewDate) {
			const newDate = new Date(currentViewDate);
			newDate.setFullYear(yr);
			dispatch('jumpToDate', newDate);
		}
	}

	function handleMinInput(e: Event) {
		let val = parseInt((e.target as HTMLInputElement).value);
		if (val > maxHoldIdx) minHoldIdx = maxHoldIdx;
		else minHoldIdx = val;
	}

	function handleMaxInput(e: Event) {
		let val = parseInt((e.target as HTMLInputElement).value);
		if (val < minHoldIdx) maxHoldIdx = minHoldIdx;
		else maxHoldIdx = val;
	}

	function clearFilters() {
		searchQuery = '';
		selectedMonth = 'ALL';
		selectedYear = 'ALL';
		showStatusHold = true;
		showStatusConfirmed = true;
		minHoldIdx = 0;
		maxHoldIdx = 20;
		selectedTypes = [];
		selectedRooms = [];
	}

	function getBaseColor(event: CalendarEvent): string {
		const roomName = event.venue.room;
		if (!roomName) return '#828282';
		const stage = stages.find((s) => s.name === roomName);
		return stage ? stage.color : '#828282';
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
		if (!['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(event.status)) {
			return title;
		}

		if (!eventType) return title;

		// 3. Only Confirmed events reach this point (other than Corpo which was handled)
		const prefixTypes = ['NCG 360', 'DSTRKT'];

		// Removed Corpo from here as it's handled in step 1
		if (prefixTypes.includes(eventType)) {
			const displayType = eventType === 'NCG 360' ? 'NCG360' : eventType;
			return `${displayType} - ${title}`;
		}

		if (eventType === 'Bazart Nuits') return `${title} - Nuits Bazart`;

		return title;
	}

	function handleEventClick(event: CalendarEvent, e: MouseEvent | KeyboardEvent) {
		dispatch('eventClick', { event, e, forceOpenPage: true });
	}

	function handleKeydown(e: KeyboardEvent, callback: Function) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			callback();
		}
	}

	function sortEventsForDisplay(events: CalendarEvent[]) {
		return [...events]
			.filter((e) => e.status !== 'HIDDEN' && !deletedIds.includes(e.id))
			.sort((a, b) => {
				const isConfirmedA = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(a.status);
				const isConfirmedB = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(b.status);

				// 1. CONFIRMED/SETTLED always goes at the absolute top, no matter what
				if (isConfirmedA && !isConfirmedB) return -1;
				if (!isConfirmedA && isConfirmedB) return 1;

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
				if (!isConfirmedA && !isConfirmedB) {
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

	$: filteredGroupedEvents = (() => {
		const result: GroupedEvents = {};

		const today = new Date();
		const tY = today.getFullYear();
		const tM = String(today.getMonth() + 1).padStart(2, '0');
		const tD = String(today.getDate()).padStart(2, '0');
		const localTodayStr = `${tY}-${tM}-${tD}`;

		listDates.forEach((dateKey) => {
			// CRITICAL: This is the logic that filters based on the toggle!
			if (listFilterMode === 'past' && dateKey >= localTodayStr) return;
			if (listFilterMode === 'upcoming' && dateKey < localTodayStr) return;

			const dayData = listEventsGrouped[dateKey];
			if (selectedMonth !== 'ALL' && dayData.dateObj.getMonth() !== selectedMonth) return;
			if (selectedYear !== 'ALL' && dayData.dateObj.getFullYear() !== selectedYear) return;

			const filteredEvents = dayData.events.filter((e) => {
				if (e.status === 'HIDDEN' || deletedIds.includes(e.id)) return false;

				if (searchQuery.trim() !== '') {
					const term = searchQuery.toLowerCase();
					const matchName = (e.title || '').toLowerCase().includes(term);
					const matchType = (e.details?.type || '').toLowerCase().includes(term);
					const matchHold = (e.hold_level || '').toLowerCase().includes(term);
					const matchDate = (e.date || '').toLowerCase().includes(term);
					if (!matchName && !matchType && !matchDate && !matchHold) return false;
				}

				const isConfirmed = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(e.status);
				if (!showStatusConfirmed && isConfirmed) return false;
				if (!isConfirmed) {
					if (!showStatusHold) return false;
					const hLvl =
						e.hold_level === 'P' ? 0 : parseInt((e.hold_level || '').replace(/\D/g, '')) || 0;
					if (hLvl < minHoldIdx || hLvl > maxHoldIdx) return false;
				}

				if (selectedRooms.length > 0 && (!e.venue?.room || !selectedRooms.includes(e.venue.room)))
					return false;
				if (
					selectedTypes.length > 0 &&
					(!e.details?.type || !selectedTypes.includes(e.details.type))
				)
					return false;

				return true;
			});

			if (filteredEvents.length > 0) {
				result[dateKey] = {
					dateObj: dayData.dateObj,
					events: sortEventsForDisplay(filteredEvents)
				};
			}
		});
		return result;
	})();

	$: filteredListDates = Object.keys(filteredGroupedEvents);

	$: flatEvents = filteredListDates.flatMap((dateKey) =>
		filteredGroupedEvents[dateKey].events.map((event) => ({
			dateKey,
			dateObj: filteredGroupedEvents[dateKey].dateObj,
			event
		}))
	);
</script>

<svelte:window on:click={handleWindowClick} />

{#if loading}
	<div class="flex items-center justify-center h-full min-h-[400px]">
		<div class="w-10 h-10 border-4 border-gray2/20 border-t-lime rounded-full animate-spin"></div>
	</div>
{:else}
	<div class="flex flex-col h-full w-full relative overflow-hidden bg-transparent">
		<div class="flex h-full w-full relative overflow-hidden bg-transparent">
			<div
				class="flex-1 overflow-y-auto p-6 hide-scrollbar bg-gray2/5 scroll-smooth"
				bind:this={scrollContainerRef}
			>
				{#if flatEvents.length > 0}
					{#if layoutMode === 'list'}
						{#each filteredListDates as dateKey}
							{@const dayData = filteredGroupedEvents[dateKey]}
							{#each dayData.events as event, idx}
								{@const color = getBaseColor(event)}
								{@const isDimmed =
									(isAddingEvent && !event.isDraft) ||
									(managingGroupId !== null && event.group_id !== managingGroupId)}
								{@const isDisabled =
									isAddingEvent ||
									(managingGroupId !== null && event.group_id !== managingGroupId) ||
									!canViewHolds}
								<div
									id={idx === 0 ? `date-${dateKey}` : undefined}
									class="flex items-center gap-3 bg-navbar border border-navbar rounded-xl mb-1.5 px-4 py-2 transition-all hover:border-lime {isDimmed
										? 'opacity-40'
										: ''} {isDisabled ? 'pointer-events-none' : 'cursor-pointer'}"
									on:click={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									<div class="w-44 shrink-0 flex items-baseline gap-1.5 whitespace-nowrap">
										<span class="text-[10px] text-gray2 font-bold uppercase tracking-wider w-8 shrink-0"
											>{fullWeekNames[dayData.dateObj.getDay()].slice(0, 3)}</span
										>
										<span class="text-sm font-black text-white"
											>{monthNames[dayData.dateObj.getMonth()]} {dayData.dateObj.getDate()}</span
										>
										<span class="text-[10px] text-gray2 font-bold"
											>{dayData.dateObj.getFullYear()}</span
										>
									</div>

									<div class="w-36 shrink-0 text-[11px] font-bold uppercase tracking-wider text-gray2 truncate">
										{event.venue.room || 'No Stage Selected'}
									</div>

									<div class="w-28 shrink-0">
										{#if event.details?.type}
											<span
												class="inline-block max-w-full truncate text-[10px] font-bold px-2 py-0.5 rounded-full align-middle"
												style="background-color: {typeColors[event.details.type] ||
													'#828282'}; color: #000;"
											>
												{event.details.type === 'Bazart Nuits' ? 'Nuits Bazart' : event.details.type}
											</span>
										{/if}
									</div>

									<h2
										class="flex-1 min-w-0 truncate font-black text-base tracking-wide {event.status ===
										'CANCELED'
											? 'text-problem/60 line-through'
											: 'text-gray3'}"
									>
										{formatEventTitle(event)}
									</h2>

									<div class="shrink-0">
										{#if event.status === 'CANCELED'}
											<span
												class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-solid border-problem text-problem bg-transparent whitespace-nowrap"
											>
												✕ CANCELED
											</span>
										{:else if ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(event.status)}
											<span
												class="px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
												style="background-color: {color}; color: #000;"
											>
												✓ {event.status}
											</span>
										{:else}
											<span
												class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-solid whitespace-nowrap"
												style="color: {color}; border-color: {color}; background-color: transparent;"
											>
												{event.hold_level === 'P' ? 'P' : event.hold_level}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						{/each}
					{:else}
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
							{#each flatEvents as { dateKey, dateObj, event }, i}
								{@const color = getBaseColor(event)}
								{@const isDimmed =
									(isAddingEvent && !event.isDraft) ||
									(managingGroupId !== null && event.group_id !== managingGroupId)}
								{@const isDisabled =
									isAddingEvent || (managingGroupId !== null && event.group_id !== managingGroupId)}

								<div
									id={i === 0 || flatEvents[i - 1].dateKey !== dateKey
										? `date-${dateKey}`
										: undefined}
									class="bg-navbar border border-gray2/10 rounded-xl p-3 flex flex-col gap-2 transition-all hover:border-lime/50 {isDimmed
										? 'opacity-40'
										: ''} {isDisabled ? 'pointer-events-none' : 'cursor-pointer'}"
									on:click={(e) => handleEventClick(event, e)}
									on:keydown={(e) => handleKeydown(e, () => handleEventClick(event, e))}
									role="button"
									tabindex="0"
								>
									<div class="flex justify-between items-start border-b border-gray2/10 pb-2">
										<div class="flex items-baseline gap-1.5 min-w-0">
											<span class="text-[9px] text-gray2 font-bold uppercase tracking-wider shrink-0"
												>{fullWeekNames[dateObj.getDay()].slice(0, 3)}</span
											>
											<span class="text-sm font-black text-white whitespace-nowrap"
												>{monthNames[dateObj.getMonth()]} {dateObj.getDate()}</span
											>
											<span class="text-[9px] text-gray2 font-bold">{dateObj.getFullYear()}</span>
										</div>
										{#if event.details?.type}
											<span
												class="text-[8px] font-bold px-2 py-0.5 rounded-full text-black shrink-0 ml-1"
												style="background-color: {typeColors[event.details.type] || '#828282'};"
											>
												{event.details.type === 'Bazart Nuits' ? 'Nuits Bazart' : event.details.type}
											</span>
										{/if}
									</div>

									<div class="flex flex-col items-start gap-1.5 min-w-0">
										<span class="text-[9px] font-bold uppercase tracking-wider text-[#828282] truncate max-w-full">
											{event.venue.room || 'No Stage Selected'}
										</span>
										<h3 class="font-black text-sm leading-snug text-white truncate max-w-full">
											{formatEventTitle(event)}
										</h3>
										{#if ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(event.status)}
											<span
												class="px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm"
												style="background-color: {color}; color: #000;"
											>
												{event.status} ✓
											</span>
										{:else}
											<span
												class="px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm border border-solid"
												style="color: {color}; border-color: {color}; background-color: transparent;"
											>
												{event.hold_level === 'P' ? 'P' : event.hold_level}
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="text-center text-gray2 text-lg py-20 font-black tracking-widest uppercase">
						No events match your filters.
					</div>
				{/if}
			</div>

			<div
				class="absolute top-1/2 -translate-y-1/2 z-40 transition-all duration-250 flex"
				style="right: {showFilters ? '380px' : '0px'};"
			>
				<button
					class="w-10 h-16 bg-gray1 border border-gray2/10 border-r-0 rounded-l-2xl flex items-center justify-center text-lime hover:text-[#828282] cursor-pointer shadow-xl transition-colors"
					aria-label="Toggle Filters"
					on:click={() => (showFilters = !showFilters)}
				>
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"
						></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"
						></line><line x1="20" y1="21" x2="20" y2="16"></line><line
							x1="20"
							y1="12"
							x2="20"
							y2="3"
						></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"
						></line><line x1="17" y1="16" x2="23" y2="16"></line></svg
					>
				</button>
			</div>

			{#if showFilters}
				<div
					class="w-[380px] shrink-0 bg-gray1 shadow-2xl border-l border-gray2/10 flex flex-col"
					transition:slide={{ axis: 'x', duration: 250 }}
				>
					<div class="flex items-center justify-end p-4 pb-0">
						<button
							class="px-4 py-1.5 rounded-3xl bg-gray2/20 hover:bg-gray2/40 text-[10px] font-bold text-gray2 hover:text-white uppercase transition-colors cursor-pointer"
							on:click={clearFilters}>Clear Filters</button
						>
					</div>

					<div class="flex-1 overflow-y-auto p-5 pt-4 space-y-5 hide-scrollbar">
						<div class="relative group">
							<svg
								class="absolute left-4 top-3.5 w-4 h-4 text-gray2 group-focus-within:text-lime transition-colors"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"
								></line></svg
							>
							<input
								type="text"
								placeholder="Search events..."
								bind:value={searchQuery}
								class="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-3xl text-white text-sm focus:outline-none focus:border-lime transition-colors placeholder:text-gray2/40 cursor-pointer"
							/>
						</div>

						<div class="relative w-full" bind:this={venueDropRef}>
							<div
								role="button"
								tabindex="0"
								class="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-3xl text-white text-sm text-left flex justify-between items-center cursor-pointer min-h-[48px] transition-colors focus:outline-none focus:border-lime"
								on:click={toggleVenueDropdown}
								on:keydown={(e) => {
									if (e.key === 'Enter') toggleVenueDropdown();
								}}
							>
								<div class="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
									{#if selectedRooms.length === 0}
										<span class="text-gray2/60 font-bold text-xs uppercase tracking-wider"
											>Venue / Stages</span
										>
									{:else}
										{#each selectedRooms as room}
											<span
												class="bg-gray1 border border-white/10 px-2 py-1 rounded-3xl text-[10px] font-bold text-white shrink-0"
												>{room}</span
											>
										{/each}
									{/if}
								</div>
								<div class="flex items-center gap-2 shrink-0">
									{#if selectedRooms.length > 0}
										<button
											type="button"
											aria-label="Clear venues"
											class="text-gray2 hover:text-problem transition-colors p-0.5 cursor-pointer"
											on:click|stopPropagation={() => (selectedRooms = [])}
											><svg
												class="w-4 h-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												><line x1="18" y1="6" x2="6" y2="18"></line><line
													x1="6"
													y1="6"
													x2="18"
													y2="18"
												></line></svg
											></button
										>
									{/if}
									<svg
										class="w-4 h-4 transition-transform {showVenueDropdown
											? 'rotate-180 text-lime'
											: 'text-gray2'}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</div>
							</div>
							{#if showVenueDropdown}
								<div
									class="absolute top-[calc(100%+8px)] left-0 bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-xl z-50 w-full overflow-hidden max-h-[300px] overflow-y-auto hide-scrollbar py-2"
								>
									{#each venues as venue}
										{@const venueStages =
											typeof venue.setting_params === 'string'
												? JSON.parse(venue.setting_params).stages || []
												: venue.setting_params.stages || []}
										{#if venueStages.length > 0}
											<div
												class="px-5 py-2 text-[9px] font-bold text-gray2 uppercase tracking-widest border-b border-white/5"
											>
												{venue.setting_name}
											</div>
											{#each venueStages as stage}
												<label
													class="flex items-center gap-3 w-full px-5 py-2.5 text-sm text-white hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-b-0"
												>
													<input
														type="checkbox"
														bind:group={selectedRooms}
														value={stage.name}
														class="hidden"
													/>
													<div
														class="flex items-center justify-center w-4 h-4 rounded-full border {selectedRooms.includes(
															stage.name
														)
															? 'bg-lime border-lime'
															: 'border-gray2/50'}"
													>
														{#if selectedRooms.includes(stage.name)}<svg
																class="w-2.5 h-2.5 text-black"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg
															>{/if}
													</div>
													<div class="flex items-center gap-2">
														<span
															class="w-2.5 h-2.5 rounded-full shadow-sm"
															style="background-color: {stage.color}"
														></span>{stage.name}
													</div>
												</label>
											{/each}
										{/if}
									{/each}
								</div>
							{/if}
						</div>

						<div class="relative w-full" bind:this={typeDropRef}>
							<div
								role="button"
								tabindex="0"
								class="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-3xl text-white text-sm text-left flex justify-between items-center cursor-pointer min-h-[48px] transition-colors focus:outline-none focus:border-lime"
								on:click={toggleTypeDropdown}
								on:keydown={(e) => {
									if (e.key === 'Enter') toggleTypeDropdown();
								}}
							>
								<div class="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
									{#if selectedTypes.length === 0}
										<span class="text-gray2/60 font-bold text-xs uppercase tracking-wider"
											>Event Types</span
										>
									{:else}
										{#each selectedTypes as type}
											<span
												class="flex items-center gap-1.5 bg-gray1 border border-white/10 px-2 py-1 rounded-3xl text-[10px] font-bold text-white shrink-0"
											>
												<span
													class="w-2.5 h-2.5 rounded-full"
													style="background-color: {typeColors[type]}"
												></span>{type === 'Bazart Nuits' ? 'Nuits Bazart' : type}
											</span>
										{/each}
									{/if}
								</div>
								<div class="flex items-center gap-2 shrink-0">
									{#if selectedTypes.length > 0}
										<button
											type="button"
											aria-label="Clear types"
											class="text-gray2 hover:text-problem transition-colors p-0.5 cursor-pointer"
											on:click|stopPropagation={() => (selectedTypes = [])}
											><svg
												class="w-4 h-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												><line x1="18" y1="6" x2="6" y2="18"></line><line
													x1="6"
													y1="6"
													x2="18"
													y2="18"
												></line></svg
											></button
										>
									{/if}
									<svg
										class="w-4 h-4 transition-transform {showTypeDropdown
											? 'rotate-180 text-lime'
											: 'text-gray2'}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</div>
							</div>
							{#if showTypeDropdown}
								<div
									class="absolute top-[calc(100%+8px)] left-0 bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-xl z-50 w-full overflow-hidden max-h-[300px] overflow-y-auto hide-scrollbar py-2"
								>
									{#each allTypes as type}
										<label
											class="flex items-center gap-3 w-full px-5 py-2.5 text-sm text-white hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-b-0"
										>
											<input
												type="checkbox"
												bind:group={selectedTypes}
												value={type}
												class="hidden"
											/>
											<div
												class="flex items-center justify-center w-4 h-4 rounded-full border {selectedTypes.includes(
													type
												)
													? 'bg-lime border-lime'
													: 'border-gray2/50'}"
											>
												{#if selectedTypes.includes(type)}<svg
														class="w-2.5 h-2.5 text-black"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg
													>{/if}
											</div>
											<div class="flex items-center gap-2">
												<span
													class="w-2.5 h-2.5 rounded-full"
													style="background-color: {typeColors[type]}"
												></span>{type === 'Bazart Nuits' ? 'Nuits Bazart' : type}
											</div>
										</label>
									{/each}
								</div>
							{/if}
						</div>

						<div class="relative w-full" bind:this={monthYearDropRef}>
							<button
								class="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-3xl text-white text-sm text-left flex justify-between items-center cursor-pointer focus:outline-none focus:border-lime"
								on:click={toggleMonthYear}
							>
								<div class="flex items-center gap-2">
									{#if selectedMonth === 'ALL' && selectedYear === 'ALL'}
										<span class="text-gray2/60 font-bold text-xs uppercase tracking-wider"
											>Month / Year</span
										>
									{:else}
										<span class="text-white font-bold"
											>{selectedMonth === 'ALL' ? 'All Months' : monthNames[selectedMonth]}
											{selectedYear === 'ALL' ? 'All Years' : selectedYear}</span
										>
									{/if}
								</div>
								<svg
									class="w-4 h-4 transition-transform text-gray2 {showMonthYearDrop
										? 'rotate-180 !text-lime'
										: ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg
								>
							</button>
							{#if showMonthYearDrop}
								<div
									class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#1a1a1a] border border-white/10 rounded-3xl shadow-xl z-50 p-4 flex gap-4"
								>
									<div class="flex-1 grid grid-cols-2 gap-2 h-max">
										<button
											class="px-2 py-2 text-xs rounded-xl text-center transition-all cursor-pointer {selectedMonth ===
											'ALL'
												? 'bg-lime text-black font-black'
												: 'text-gray2 hover:bg-white/10 font-bold'}"
											on:click={() => handleMonthSelect('ALL')}>All</button
										>
										{#each monthNames as month, idx}
											<button
												class="px-2 py-2 text-xs rounded-xl text-center transition-all cursor-pointer {selectedMonth ===
												idx
													? 'bg-lime text-black font-black'
													: 'text-gray2 hover:bg-white/10 font-bold'}"
												on:click={() => handleMonthSelect(idx)}>{month.slice(0, 3)}</button
											>
										{/each}
									</div>
									<div class="w-px bg-white/10"></div>
									<div
										class="w-16 flex flex-col gap-1 max-h-[220px] overflow-y-auto hide-scrollbar"
									>
										<button
											class="px-1 py-2 text-xs rounded-xl text-center transition-all cursor-pointer {selectedYear ===
											'ALL'
												? 'bg-lime text-black font-black'
												: 'text-gray2 hover:bg-white/10 font-bold'}"
											on:click={() => handleYearSelect('ALL')}>All</button
										>
										{#each Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i) as yr}
											<button
												class="px-1 py-2 text-xs rounded-xl text-center transition-all cursor-pointer {selectedYear ===
												yr
													? 'bg-lime text-black font-black'
													: 'text-gray2 hover:bg-white/10 font-bold'}"
												on:click={() => handleYearSelect(yr)}>{yr}</button
											>
										{/each}
									</div>
								</div>
							{/if}
						</div>

						<div class="pt-2">
							<div class="block text-[10px] font-bold text-gray2 uppercase mb-2 ml-1">Status</div>
							<div class="flex gap-3">
								<button
									class="flex-1 py-2 rounded-3xl text-xs font-bold transition-all border cursor-pointer {showStatusHold
										? 'bg-lime/10 border-lime text-lime'
										: 'bg-transparent border-white/10 text-gray2 hover:bg-white/5'}"
									on:click={() => (showStatusHold = !showStatusHold)}>Holds</button
								>
								<button
									class="flex-1 py-2 rounded-3xl text-xs font-bold transition-all border cursor-pointer {showStatusConfirmed
										? 'bg-lime/10 border-lime text-lime'
										: 'bg-transparent border-white/10 text-gray2 hover:bg-white/5'}"
									on:click={() => (showStatusConfirmed = !showStatusConfirmed)}>Confirmed</button
								>
							</div>
						</div>

						{#if showStatusHold}
							<div
								class="bg-[#1a1a1a] border border-white/10 rounded-3xl p-5 flex flex-col mt-2"
								transition:slide
							>
								<div class="flex justify-between items-center mb-1">
									<span class="text-[10px] font-bold text-gray2 uppercase tracking-wider"
										>Hold Range Filter</span
									>
									<span class="text-xs font-bold text-lime"
										>{minHoldIdx === 0 ? 'P' : 'H' + minHoldIdx} - {maxHoldIdx === 0
											? 'P'
											: 'H' + maxHoldIdx}</span
									>
								</div>

								<div class="relative w-full h-8 flex items-center mt-3 mb-8 px-1">
									<div class="absolute w-[calc(100%-0.5rem)] h-1.5 bg-gray2/20 rounded-full"></div>
									<div
										class="absolute h-1.5 bg-lime rounded-full"
										style="left: {(minHoldIdx / 20) * 100}%; right: {100 -
											(maxHoldIdx / 20) * 100}%; margin-left: 0.25rem; margin-right: 0.25rem;"
									></div>

									<input
										type="range"
										min="0"
										max="20"
										bind:value={minHoldIdx}
										on:input={handleMinInput}
										class="absolute w-[calc(100%-0.5rem)] appearance-none bg-transparent pointer-events-none z-20 custom-range"
									/>
									<input
										type="range"
										min="0"
										max="20"
										bind:value={maxHoldIdx}
										on:input={handleMaxInput}
										class="absolute w-[calc(100%-0.5rem)] appearance-none bg-transparent pointer-events-none z-30 custom-range"
									/>

									<div
										class="absolute top-8 left-0 w-full flex justify-between text-[10px] font-bold text-gray2 px-0.5 mt-2"
									>
										<span>P</span><span>H5</span><span>H10</span><span>H15</span><span>H20</span>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Hide scrollbar for Chrome, Safari and Opera */
	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}
	/* Hide scrollbar for IE, Edge and Firefox */
	.hide-scrollbar {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	.custom-range::-webkit-slider-thumb {
		pointer-events: auto;
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		background: var(--color-lime);
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
	}
	.custom-range::-moz-range-thumb {
		pointer-events: auto;
		width: 16px;
		height: 16px;
		background: var(--color-lime);
		border-radius: 50%;
		cursor: pointer;
		border: none;
		box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
	}
</style>