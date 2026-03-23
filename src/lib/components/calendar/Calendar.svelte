<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';

	import CalendarHeader from './CalendarHeader.svelte';
	import CalendarBodyMonth from './CalendarBodyMonth.svelte';
	import CalendarBodyWeek from './CalendarBodyWeek.svelte';
	import CalendarBodyList from './CalendarBodyList.svelte';
	import CalendarAddEvent from './CalendarAddEvent.svelte';
	import CalendarViewEvent from './CalendarViewEvent.svelte';
	import CalendarManageHolds from './CalendarManageHolds.svelte';
	import VenueSettingsModal from './VenueSettingsModal.svelte';
	import CalendarShareAvails from './CalendarShareAvails.svelte';
	import CalendarQuickSearch from './CalendarQuickSearch.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import type {
		CalendarEvent,
		CalendarDay,
		GroupedEvents,
		VenueSettings,
		StageConfig
	} from '$lib/types/calendar-types';
	import CalendarMoveModal from './CalendarMoveModal.svelte';

	export let selectedDate: Date = new Date();
	export let viewType: 'month' | 'week' | 'list' = 'month';
	export let currentViewDate: Date = new Date();
	let showHiddenHolds = false;

	// Replaced isEditor with explicit granular roles
	export let canEdit: boolean = false;
	export let canViewHolds: boolean = false;

	let allEvents: CalendarEvent[] = [];
	let draftEvents: CalendarEvent[] = [];
	let venues: VenueSettings[] = [];
	let stages: StageConfig[] = [];
	let loading = true;
	let listLayoutMode: 'list' | 'grid' = 'list';
	let currentListFilter: 'past' | 'all' | 'upcoming' = 'upcoming';

	let selectedEvent: CalendarEvent | null = null;
	let selectedDayEvents: CalendarEvent[] = [];
	let showEventModal = false;
	let showAddSidebar = false;

	let showAvailsModal = false;
	let showManageHoldsModal = false;
	let showSettingsModal = false;
	let selectedSettingsVenueId: string | null = null;
	let activeSelectedDates: string[] = [];

	let showMoveModal = false;
	let moveModalEvent: CalendarEvent | null = null;
	let moveModalNewDate: string | null = null;
	let manageHoldsDrafts: CalendarEvent[] = [];
	let manageHoldsDeletedIds: string[] = [];
	let toggleDateTrigger: { date: string; ts: number } | null = null;

	let showQuickSearch = false;

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	// --- START PREFERENCES LOGIC ---
	let startOfWeek = 'Sunday';
	let preferenceSubscription: any;

	const BASE_WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const dayOffsets: Record<string, number> = {
		'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
	};

	// Reactively calculate the offset and the new order of weekday headers
	$: targetStartDay = dayOffsets[startOfWeek] ?? 0;
	$: dynamicWeekDayNames = [
		...BASE_WEEK_DAYS.slice(targetStartDay), 
		...BASE_WEEK_DAYS.slice(0, targetStartDay)
	];

	// Listen to authStore and set up real-time sync for instant updates
	$: if ($authStore.isInitialized) {
		const userId = $authStore.profile?.id;
		
		if (userId) {
			startOfWeek = $authStore.profile?.user_settings?.start_week_on || 'Sunday';
			
			if (!preferenceSubscription) {
				preferenceSubscription = supabase
					.channel('user-preferences-main')
					.on(
						'postgres_changes',
						{ event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` },
						(payload) => {
							const newStartDay = payload.new.user_settings?.start_week_on || 'Sunday';
							if (startOfWeek !== newStartDay) startOfWeek = newStartDay;
						}
					)
					.subscribe();
			}
		} else {
			startOfWeek = 'Sunday';
		}
	}

	onDestroy(() => {
		if (preferenceSubscription) supabase.removeChannel(preferenceSubscription);
	});
	// --- END PREFERENCES LOGIC ---

	$: displayEvents = showManageHoldsModal
		? [
				...allEvents.filter(
					(e) =>
						!manageHoldsDeletedIds.includes(e.id) && !manageHoldsDrafts.some((md) => md.id === e.id)
				),
				...draftEvents,
				...manageHoldsDrafts
			]
		: [
				// Filter out any existing events that have been temporarily bumped by draftEvents
				...allEvents.filter(
					(e) => !draftEvents.some((draft) => draft.id === e.id && !draft.isNewDraft)
				),
				...draftEvents
			];

	$: if (showManageHoldsModal) {
		activeSelectedDates = manageHoldsDrafts.map((d) => d.date);
	} else if (!showAddSidebar) {
		activeSelectedDates = [];
	}

	function handleManageHoldsClose() {
		showManageHoldsModal = false;
		manageHoldsDrafts = [];
		manageHoldsDeletedIds = [];
		selectedDayEvents = [];
	}

	function handleMoveEvent(event: CustomEvent<{ event: CalendarEvent; newDate: string }>) {
		moveModalEvent = event.detail.event;
		moveModalNewDate = event.detail.newDate;
		showMoveModal = true;
	}

	function sortEvents(dayEvents: CalendarEvent[]) {
		return dayEvents.sort((a, b) => {
			if (a.hold_level && b.hold_level) {
				const numA = parseInt(a.hold_level.replace(/\D/g, '')) || 0;
				const numB = parseInt(b.hold_level.replace(/\D/g, '')) || 0;
				if (numA === 0 || numB === 0) return a.hold_level.localeCompare(b.hold_level);
				return numA - numB;
			}
			return 0;
		});
	}

	function generateMonthDays(month: Date, events: CalendarEvent[], startOffset: number): CalendarDay[] {
		const year = month.getFullYear();
		const monthIndex = month.getMonth();
		const startDate = new Date(year, monthIndex, 1);
		
		// Calculate days to subtract to reach the user's preferred start day
		const daysToSubtract = (startDate.getDay() - startOffset + 7) % 7;
		startDate.setDate(startDate.getDate() - daysToSubtract);

		const days: CalendarDay[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		let current = new Date(startDate);

		for (let i = 0; i < 42; i++) {
			const dateObj = new Date(current);
			const dayEvents = events.filter((event) => {
				const eventDate = new Date(event.date + 'T00:00:00');
				return eventDate.getTime() === dateObj.getTime();
			});
			days.push({
				date: dateObj,
				dayNumber: dateObj.getDate(),
				isCurrentMonth: dateObj.getMonth() === monthIndex,
				isToday: dateObj.getTime() === today.getTime(),
				events: sortEvents(dayEvents),
				holds: dayEvents.filter((e) => e.status === 'HOLD' || e.status === 'PENDING')
			});
			current.setDate(current.getDate() + 1);
		}
		return days;
	}

	function generateWeekDays(dateInWeek: Date, events: CalendarEvent[], startOffset: number): CalendarDay[] {
		const startDate = new Date(dateInWeek);
		
		const daysToSubtract = (startDate.getDay() - startOffset + 7) % 7;
		startDate.setDate(startDate.getDate() - daysToSubtract);

		const days: CalendarDay[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let i = 0; i < 7; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);
			const dayEvents = events.filter((event) => {
				const eventDate = new Date(event.date + 'T00:00:00');
				return eventDate.getTime() === date.getTime();
			});
			days.push({
				date: new Date(date),
				dayNumber: date.getDate(),
				isCurrentMonth: true,
				isToday: date.getTime() === today.getTime(),
				events: sortEvents(dayEvents),
				holds: dayEvents.filter((e) => e.status === 'HOLD' || e.status === 'PENDING')
			});
		}
		return days;
	}

	function groupEventsForList(month: Date, events: CalendarEvent[]): GroupedEvents {
		const filteredEvents = events.filter((event) => {
			const eventDate = new Date(event.date + 'T00:00:00');
			return viewType === 'list'
				? true
				: eventDate.getMonth() === month.getMonth() &&
						eventDate.getFullYear() === month.getFullYear();
		});

		filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

		const grouped: GroupedEvents = {};

		for (const event of filteredEvents) {
			if (!grouped[event.date])
				grouped[event.date] = { dateObj: new Date(event.date + 'T00:00:00'), events: [] };
			grouped[event.date].events.push(event);
		}
		return grouped;
	}

	async function loadEventsAndSettings(date: Date, isBackgroundRefresh = false) {
		if (!isBackgroundRefresh) loading = true;

		try {
			const { data: settingsData, error: settingsError } = await supabase
				.from('calendar_settings')
				.select('*')
				.order('setting_name', { ascending: true });

			if (settingsData && !settingsError) {
				venues = settingsData;
				stages = venues.flatMap((v) => {
					let parsed = v.setting_params;
					if (typeof parsed === 'string') {
						try {
							parsed = JSON.parse(parsed);
						} catch (e) {}
					}
					return parsed.stages || [];
				});
			}

			let startRangeStr: string;
			let endRangeStr: string;

			if (viewType === 'list') {
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				if (currentListFilter === 'upcoming') {
					startRangeStr = today.toISOString().split('T')[0];
					const end = new Date(today);
					end.setFullYear(end.getFullYear() + 2); // Fetch 2 years forward
					endRangeStr = end.toISOString().split('T')[0];
				} else if (currentListFilter === 'past') {
					const start = new Date(today);
					start.setFullYear(start.getFullYear() - 2); // Fetch 2 years backward
					startRangeStr = start.toISOString().split('T')[0];
					endRangeStr = today.toISOString().split('T')[0];
				} else {
					// 'all'
					const start = new Date(today);
					start.setFullYear(start.getFullYear() - 2);
					startRangeStr = start.toISOString().split('T')[0];
					const end = new Date(today);
					end.setFullYear(end.getFullYear() + 2);
					endRangeStr = end.toISOString().split('T')[0];
				}
			} else {
				// Keep existing month/week buffer behavior
				const year = date.getFullYear();
				const month = date.getMonth();
				let startRange = new Date(year, month, 1);
				startRange.setDate(startRange.getDate() - 20);

				let endRange = new Date(year, month + 1, 0);
				endRange.setDate(endRange.getDate() + 20);

				startRangeStr = startRange.toISOString().split('T')[0];
				endRangeStr = endRange.toISOString().split('T')[0];
			}

			const { data, error } = await supabase
				.from('calendar_events')
				.select('*, calendar(*)')
				.gte('date', startRangeStr)
				.lte('date', endRangeStr)
				.order('date', { ascending: true });

			if (error) throw error;

			allEvents = (data || []).map((row: any) => {
				const isHold = row.status === 'HOLD' || row.status === 'PENDING';
				// Applies masking logic depending on canViewHolds
				const displayTitle = !canViewHolds && isHold ? 'Hold' : row.calendar?.title || '(No Title)';

				return {
					id: row.id,
					short_id: row.short_id,
					group_id: row.group_id,
					creator_name: row.calendar?.creator_name || 'Unknown',
					date: row.date,
					status: row.status,
					hold_level: row.hold_level,
					venue: row.venue,
					time: row.time,
					isDraft: false,
					event_details: row.event_details || { is_target: false, is_challenge: false },
					title: displayTitle,
					details: row.calendar?.details || {}
				};
			});
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	function previousPeriod() {
		const newDate = new Date(currentViewDate);

		if (viewType === 'week') newDate.setDate(newDate.getDate() - 7);
		else newDate.setMonth(newDate.getMonth() - 1);
		currentViewDate = newDate;
	}

	function nextPeriod() {
		const newDate = new Date(currentViewDate);
		if (viewType === 'week') newDate.setDate(newDate.getDate() + 7);
		else newDate.setMonth(newDate.getMonth() + 1);

		currentViewDate = newDate;
	}

	function goToToday() {
		currentViewDate = new Date(new Date().setHours(0, 0, 0, 0));
	}

	function handleDayClick(event: CustomEvent<{ day: CalendarDay; clickedDate: Date }>) {
		const { clickedDate } = event.detail;
		const dateStr = clickedDate.toISOString().split('T')[0];

		if (!canEdit) return;

		if (showManageHoldsModal) {
			toggleDateTrigger = { date: dateStr, ts: Date.now() };
			return;
		}

		if (showAddSidebar) {
			if (activeSelectedDates.includes(dateStr)) {
				activeSelectedDates = activeSelectedDates.filter((d) => d !== dateStr);
			} else {
				activeSelectedDates = [...activeSelectedDates, dateStr];
			}
			
			// Close sidebar if no dates are left selected
			if (activeSelectedDates.length === 0) {
				showAddSidebar = false;
			}
			
			return;
		}

		selectedDate = clickedDate;
		activeSelectedDates = [dateStr];
		showAddSidebar = true;
	}
	function handleEventClick(
		event: CustomEvent<{
			event: CalendarEvent;
			e: MouseEvent | KeyboardEvent;
			forceOpenPage?: boolean;
		}>
	) {
		const { event: calendarEvent, e, forceOpenPage } = event.detail;

		e?.stopPropagation();

		if (calendarEvent.isDraft) return;

		// 1. "View Only" cannot access the page ID.
		// If they don't have canViewHolds (Manager+), stop here.
		if (!canViewHolds) return;

		// 2. Manager, Editor, and Admin can access the page[id]
		if (forceOpenPage || calendarEvent.status === 'CONFIRMED') {
			goto(`/calendar/${calendarEvent.short_id}`);
			return;
		}

		// 3. Only Editor and Admin can open the Edit/Hold modal
		if (!canEdit) return;

		if (showAddSidebar || showManageHoldsModal) return;

		selectedEvent = calendarEvent;
		showEventModal = true;
	}

	function handleAddEventClick() {
		if (!canEdit) return;
		if (viewType === 'list') {
			viewType = 'month';
		}
		activeSelectedDates = [new Date().toISOString().split('T')[0]];
		showAddSidebar = true;
	}

	async function handleSaveAndView(e: CustomEvent) {
		await loadEventsAndSettings(currentViewDate);
		const createdEvents = e.detail.events;

		if (createdEvents && createdEvents.length > 0) {
			selectedEvent = allEvents.find((ev) => ev.id === createdEvents[0].id) || null;
			showEventModal = true;
		}
	}

	onMount(() => {
		const eventsSub = supabase
			.channel('public:calendar_events')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
				loadEventsAndSettings(currentViewDate);
			})
			.subscribe();
		const calendarSub = supabase
			.channel('public:calendar')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'calendar' }, () => {
				loadEventsAndSettings(currentViewDate);
			})
			.subscribe();

		return () => {
			eventsSub.unsubscribe();
			calendarSub.unsubscribe();
		};
	});

	// PASS targetStartDay INTO THE GENERATE FUNCTIONS
	$: monthViewDays = generateMonthDays(currentViewDate, displayEvents, targetStartDay);
	$: weekViewDays = generateWeekDays(currentViewDate, displayEvents, targetStartDay);
	
	$: listEventsGrouped = groupEventsForList(currentViewDate, displayEvents);
	$: listDates = Object.keys(listEventsGrouped);

	$: headerText = (() => {
		const year = currentViewDate.getFullYear();
		const monthName = monthNames[currentViewDate.getMonth()];
		if (viewType === 'week') {
			const startOfWeekDate = new Date(currentViewDate);
			const daysToSubtract = (startOfWeekDate.getDay() - targetStartDay + 7) % 7;
			startOfWeekDate.setDate(startOfWeekDate.getDate() - daysToSubtract);
			const endOfWeekDate = new Date(startOfWeekDate);
			endOfWeekDate.setDate(endOfWeekDate.getDate() + 6);
			return `${monthNames[startOfWeekDate.getMonth()]} ${startOfWeekDate.getDate()} - ${monthNames[endOfWeekDate.getMonth()]} ${endOfWeekDate.getDate()}, ${year}`;
		}
		return viewType === 'list' ? 'Upcoming Events' : `${monthName} · ${year}`;
	})();

	let lastLoadedMonth = -1;
	let lastLoadedYear = -1;
	let lastLoadedViewType: 'month' | 'week' | 'list' = viewType;
	let lastLoadedListFilter: 'past' | 'all' | 'upcoming' = currentListFilter;

	$: {
		const currentMonth = currentViewDate.getMonth();
		const currentYear = currentViewDate.getFullYear();

		if (
			currentMonth !== lastLoadedMonth ||
			currentYear !== lastLoadedYear ||
			viewType !== lastLoadedViewType ||
			(viewType === 'list' && currentListFilter !== lastLoadedListFilter)
		) {
			loadEventsAndSettings(currentViewDate);
			lastLoadedMonth = currentMonth;
			lastLoadedYear = currentYear;
			lastLoadedViewType = viewType;
			lastLoadedListFilter = currentListFilter;
		}
	}
</script>

<div use:portal>
	<CalendarShareAvails bind:show={showAvailsModal} />
	<CalendarQuickSearch bind:show={showQuickSearch} {canEdit} />
	<CalendarViewEvent
		bind:show={showEventModal}
		event={selectedEvent}
		on:close={() => {
			showEventModal = false;
			selectedEvent = null;
		}}
		on:update={() => loadEventsAndSettings(currentViewDate, true)}
		on:manageHolds={() => {
			showEventModal = false;
			const currentEvent = selectedEvent;

			if (currentEvent) {
				selectedDayEvents = displayEvents.filter(
					(e) =>
						(currentEvent.group_id && e.group_id === currentEvent.group_id) ||
						e.id === currentEvent.id
				);
				showManageHoldsModal = true;
			}
		}}
	/>
	<VenueSettingsModal
		bind:isOpen={showSettingsModal}
		venueId={selectedSettingsVenueId}
		on:success={() => loadEventsAndSettings(currentViewDate)}
	/>
</div>

<div class="flex items-stretch gap-2 h-full w-full overflow-hidden">
	<div
		class="flex-1 w-full min-w-0 bg-gray1 rounded-xl flex flex-col transition-all duration-300 border border-gray2/10 overflow-hidden"
	>
		<CalendarHeader
			{headerText}
			{currentViewDate}
			{viewType}
			isEditor={canEdit}
			bind:listFilterMode={currentListFilter}
			bind:listLayoutMode
			bind:showHiddenHolds
			on:today={goToToday}
			on:previous={previousPeriod}
			on:next={nextPeriod}
			on:addEvent={handleAddEventClick}
			on:shareAvails={() => (showAvailsModal = true)}
			on:quickSearch={() => (showQuickSearch = true)}
			on:jumpToDate={(e) => {
				currentViewDate = e.detail;
			}}
		/>

		<div class="flex-1 overflow-hidden" class:hidden={viewType !== 'month'}>
			<CalendarBodyMonth
				{loading}
				{monthViewDays}
				weekDayNames={dynamicWeekDayNames}
				{stages}
				{canEdit}
				{canViewHolds}
				{showHiddenHolds}
				activeDates={activeSelectedDates}
				isAddingEvent={showAddSidebar}
				deletedIds={manageHoldsDeletedIds}
				managingGroupId={showManageHoldsModal && selectedDayEvents.length > 0
					? selectedDayEvents[0].group_id
					: null}
				on:dayClick={handleDayClick}
				on:eventClick={handleEventClick}
				on:moveEvent={handleMoveEvent}
			/>
		</div>

		<div class="flex-1 overflow-hidden" class:hidden={viewType !== 'week'}>
			<CalendarBodyWeek
				{loading}
				{weekViewDays}
				weekDayNames={dynamicWeekDayNames}
				{stages}
				{canEdit}
				{canViewHolds}
				activeDates={activeSelectedDates}
				isAddingEvent={showAddSidebar}
				deletedIds={manageHoldsDeletedIds}
				managingGroupId={showManageHoldsModal && selectedDayEvents.length > 0
					? selectedDayEvents[0].group_id
					: null}
				on:dayClick={handleDayClick}
				on:eventClick={handleEventClick}
				on:moveEvent={handleMoveEvent}
			/>
		</div>

		<div class="flex-1 overflow-hidden" class:hidden={viewType !== 'list'}>
			<CalendarBodyList
				{loading}
				{listEventsGrouped}
				{listDates}
				{monthNames}
				{stages}
				{venues}
				{canViewHolds}
				layoutMode={listLayoutMode}
				isAddingEvent={showAddSidebar}
				deletedIds={manageHoldsDeletedIds}
				managingGroupId={showManageHoldsModal && selectedDayEvents.length > 0
					? selectedDayEvents[0].group_id
					: null}
				{currentViewDate}
				on:eventClick={handleEventClick}
				on:jumpToDate={(e) => {
					currentViewDate = e.detail;
				}}
				bind:listFilterMode={currentListFilter}
			/>
		</div>
	</div>

	{#if canEdit}
		<CalendarAddEvent
			bind:isOpen={showAddSidebar}
			bind:dates={activeSelectedDates}
			bind:draftEvents
			{allEvents}
			{venues}
			on:openSettings={(e) => {
				selectedSettingsVenueId = e.detail?.venueId || null;
				showSettingsModal = true;
			}}
			on:success={() => loadEventsAndSettings(currentViewDate)}
			on:successAndView={handleSaveAndView}
			on:close={() => (showAddSidebar = false)}
		/>

		<CalendarManageHolds
			bind:isOpen={showManageHoldsModal}
			events={selectedDayEvents}
			{venues}
			bind:draftEvents={manageHoldsDrafts}
			bind:deletedIds={manageHoldsDeletedIds}
			bind:toggleDateTrigger
			on:close={handleManageHoldsClose}
			on:update={() => loadEventsAndSettings(currentViewDate, true)}
		/>

		<CalendarMoveModal
			bind:show={showMoveModal}
			event={moveModalEvent}
			newDateStr={moveModalNewDate}
			existingEvents={allEvents}
			{venues}
			on:success={() => loadEventsAndSettings(currentViewDate)}
			on:close={() => (showMoveModal = false)}
		/>
	{/if}
</div>