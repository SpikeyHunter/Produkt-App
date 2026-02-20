<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import CalendarHeader from './CalendarHeader.svelte';
	import CalendarBody from './CalendarBody.svelte';
	import CalendarAddEvent from './CalendarAddEvent.svelte';
	import CalendarViewEvent from './CalendarViewEvent.svelte';
	import CalendarManageHolds from './CalendarManageHolds.svelte';
	import VenueSettingsModal from './VenueSettingsModal.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import type { CalendarEvent, CalendarDay, GroupedEvents, VenueSettings, StageConfig } from '$lib/types/calendar-types';
	import CalendarMoveModal from './CalendarMoveModal.svelte';

	export let selectedDate: Date = new Date();
	export let viewType: 'month' | 'week' | 'list' = 'month';
	export let currentViewDate: Date = new Date();

	let allEvents: CalendarEvent[] = [];
	let draftEvents: CalendarEvent[] = [];
	let venues: VenueSettings[] = [];
	let stages: StageConfig[] = [];

	let loading = true;

	let selectedEvent: CalendarEvent | null = null;
	let selectedDayEvents: CalendarEvent[] = [];
	let showEventModal = false;
	let showAddSidebar = false;
	let showManageHoldsModal = false;
	let showSettingsModal = false;
	let selectedSettingsVenueId: string | null = null;
	let activeSelectedDates: string[] = [];

	let showMoveModal = false;
	let moveModalEvent: CalendarEvent | null = null;
	let moveModalNewDate: string | null = null;

	const weekDayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	$: displayEvents = [...allEvents, ...draftEvents];

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

	function generateMonthDays(month: Date, events: CalendarEvent[]): CalendarDay[] {
		const year = month.getFullYear();
		const monthIndex = month.getMonth();
		const startDate = new Date(year, monthIndex, 1);
		startDate.setDate(startDate.getDate() - startDate.getDay());

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

	function generateWeekDays(dateInWeek: Date, events: CalendarEvent[]): CalendarDay[] {
		const startDate = new Date(dateInWeek);
		startDate.setDate(startDate.getDate() - startDate.getDay());
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
				? eventDate >= new Date(new Date().setHours(0, 0, 0, 0))
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

	async function loadEventsAndSettings(date: Date) {
		loading = true;
		try {
			const { data: settingsData, error: settingsError } = await supabase
				.from('calendar_settings')
				.select('*')
				.order('setting_name', { ascending: true });
			if (settingsData && !settingsError) {
				venues = settingsData;
				stages = venues.flatMap((v) => {
					let parsed = v.setting_params;
					if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch(e){} }
					return parsed.stages || [];
				});
			}

			const year = date.getFullYear();
			const month = date.getMonth();
			let startRange = new Date(year, month, 1);
			startRange.setDate(startRange.getDate() - 20);
			let endRange = new Date(year, month + 1, 0);
			endRange.setDate(endRange.getDate() + 20);

			const { data, error } = await supabase
				.from('calendar_events')
				.select('*, calendar(*)') 
				.gte('date', startRange.toISOString().split('T')[0])
				.lte('date', endRange.toISOString().split('T')[0])
				.neq('status', 'HIDDEN') // 🚨 EXCLUDE HIDDEN STATUSES
				.order('date', { ascending: true });
			if (error) throw error;

			allEvents = (data || []).map((row: any) => ({
				id: row.id,
				short_id: row.short_id, 
				group_id: row.group_id,
				user_id: row.user_id,
				date: row.date,
				status: row.status,
				hold_level: row.hold_level,
				venue: row.venue,
				time: row.time,
				isDraft: false,
				title: row.calendar?.title || '(No Title)',
				details: row.calendar?.details || {},
				contact: row.calendar?.contact || {}
			}));

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
		if (showAddSidebar) {
			if (activeSelectedDates.includes(dateStr)) {
				activeSelectedDates = activeSelectedDates.filter((d) => d !== dateStr);
			} else {
				activeSelectedDates = [...activeSelectedDates, dateStr];
			}
			return;
		}

		selectedDate = clickedDate;
		activeSelectedDates = [dateStr];
		showAddSidebar = true;
	}

	function handleEventClick(event: CustomEvent<{ event: CalendarEvent; e: MouseEvent | KeyboardEvent }>) {
		if (showAddSidebar) return;
		const { event: calendarEvent, e } = event.detail;
		e.stopPropagation();
		if (calendarEvent.isDraft) return;

		if (calendarEvent.status === 'CONFIRMED') {
			goto(`/calendar/${calendarEvent.short_id}`); 
			return;
		}

		selectedEvent = calendarEvent;
		showEventModal = true;
	}

	function handleAddEventClick() {
		activeSelectedDates = [new Date().toISOString().split('T')[0]];
		showAddSidebar = true;
	}

	async function handleSaveAndView(e: CustomEvent) {
		await loadEventsAndSettings(currentViewDate);
		const createdEvents = e.detail.events;
		if (createdEvents && createdEvents.length > 0) {
			selectedEvent = allEvents.find(ev => ev.id === createdEvents[0].id) || null;
			showEventModal = true;
		}
	}

	onMount(() => {
		const eventsSub = supabase.channel('public:calendar_events').on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => { loadEventsAndSettings(currentViewDate); }).subscribe();
		const calendarSub = supabase.channel('public:calendar').on('postgres_changes', { event: '*', schema: 'public', table: 'calendar' }, () => { loadEventsAndSettings(currentViewDate); }).subscribe();

		return () => {
			eventsSub.unsubscribe();
			calendarSub.unsubscribe();
		};
	});
	$: monthViewDays = viewType === 'month' ? generateMonthDays(currentViewDate, displayEvents) : [];
	$: weekViewDays = viewType === 'week' ? generateWeekDays(currentViewDate, displayEvents) : [];
	$: listEventsGrouped = viewType === 'list' ? groupEventsForList(currentViewDate, displayEvents) : {};
	$: listDates = viewType === 'list' ? Object.keys(listEventsGrouped) : [];
	$: headerText = (() => {
		const year = currentViewDate.getFullYear();
		const monthName = monthNames[currentViewDate.getMonth()];
		if (viewType === 'week') {
			const startOfWeek = new Date(currentViewDate);
			startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
			const endOfWeek = new Date(startOfWeek);
			endOfWeek.setDate(endOfWeek.getDate() + 6);
			return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${year}`;
		}
		return viewType === 'list' ? 'Upcoming Events' : `${monthName} · ${year}`;
	})();
	let lastLoadedMonth = -1;
	let lastLoadedYear = -1;
	let lastViewType = viewType;

	$: {
		const currentMonth = currentViewDate.getMonth();
		const currentYear = currentViewDate.getFullYear();
		if (currentMonth !== lastLoadedMonth || currentYear !== lastLoadedYear || viewType !== lastViewType) {
			loadEventsAndSettings(currentViewDate);
			lastLoadedMonth = currentMonth;
			lastLoadedYear = currentYear;
			lastViewType = viewType;
		}
	}
</script>

<div use:portal>
	<CalendarViewEvent
		bind:show={showEventModal}
		event={selectedEvent}
		on:close={() => { showEventModal = false; selectedEvent = null; }}
		on:update={() => loadEventsAndSettings(currentViewDate)}
		on:manageHolds={() => {
			showEventModal = false;
			if (selectedEvent) {
				selectedDayEvents = displayEvents.filter((e) => e.date === selectedEvent?.date);
				showManageHoldsModal = true;
			}
		}}
	/>
	<CalendarManageHolds
		bind:isOpen={showManageHoldsModal}
		events={selectedDayEvents}
		{selectedDate}
		on:close={() => (showManageHoldsModal = false)}
		on:update={() => loadEventsAndSettings(currentViewDate)}
	/>
	<VenueSettingsModal
		bind:isOpen={showSettingsModal}
		venueId={selectedSettingsVenueId}
		on:success={() => loadEventsAndSettings(currentViewDate)}
	/>
</div>

<div class="flex items-stretch gap-2 h-full w-full overflow-hidden">
	<div class="flex-1 w-full min-w-0 bg-gray1 rounded-xl flex flex-col transition-all duration-300 border border-gray2/10 overflow-hidden">
		<CalendarHeader
			{headerText}
			on:today={goToToday}
			on:previous={previousPeriod}
			on:next={nextPeriod}
			on:addEvent={handleAddEventClick}
		/>
		<CalendarBody
			{loading}
			{viewType}
			{monthViewDays}
			{weekViewDays}
			{listEventsGrouped}
			{listDates}
			{weekDayNames}
			{monthNames}
			{stages}
			activeDates={activeSelectedDates}
			isAddingEvent={showAddSidebar}
			on:dayClick={handleDayClick}
			on:eventClick={handleEventClick}
			on:moveEvent={handleMoveEvent}
		/>
	</div>

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

	<CalendarMoveModal 
		bind:show={showMoveModal} 
		event={moveModalEvent} 
		newDateStr={moveModalNewDate} 
		existingEvents={allEvents}
		venues={venues} 
		on:success={() => loadEventsAndSettings(currentViewDate)} 
		on:close={() => showMoveModal = false}
	/>
</div>