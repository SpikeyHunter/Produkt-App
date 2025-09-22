<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import CalendarViewEvent from './CalendarViewEvent.svelte';
	import type { CalendarEvent, CalendarDay, GroupedEvents } from '$lib/types/types.ts';
	import { createEventDispatcher } from 'svelte';
	import { portal } from '$lib/utils/portalUtils.js';

	// Import the new components
	import CalendarHeader from './CalendarHeader.svelte';
	import CalendarBody from './CalendarBody.svelte';

	// Props & State
	export let selectedDate: Date = new Date();
	export let viewType: 'month' | 'week' | 'list' = 'month';
	let currentViewDate: Date = new Date(selectedDate.setHours(0, 0, 0, 0));
	let allEvents: CalendarEvent[] = [];
	let loading = true;
	let selectedEvent: CalendarEvent | null = null;
	let showEventModal = false;
	const dispatch = createEventDispatcher();

	// Constants
	const weekDayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const statusStyles: Record<string, string> = {
		HOLD: 'bg-tentatif text-black',
		CONFIRMED: 'bg-confirmed text-black'
	};
	const eventTypeIcons: Record<string, string> = {
		Show: '🎸',
		Corpo: '💼',
		Other: '🎉'
	};
	
	// --- Calendar Data Generation ---
	function generateMonthDays(month: Date, events: CalendarEvent[]): CalendarDay[] {
		const year = month.getFullYear();
		const monthIndex = month.getMonth();
		const firstDayOfMonth = new Date(year, monthIndex, 1);
		const startDate = new Date(firstDayOfMonth);
		startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
		const days: CalendarDay[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = 0; i < 42; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);
			const dayEvents = events.filter((event) => {
				const eventDate = new Date(event.date + 'T00:00:00');
				return eventDate.getTime() === date.getTime();
			});
			days.push({
				date: new Date(date),
				dayNumber: date.getDate(),
				isCurrentMonth: date.getMonth() === monthIndex,
				isToday: date.getTime() === today.getTime(),
				events: dayEvents
			});
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
				events: dayEvents
			});
		}
		return days;
	}

	function groupEventsForList(month: Date, events: CalendarEvent[]): GroupedEvents {
		const filteredEvents = events.filter((event) => {
			const eventDate = new Date(event.date + 'T00:00:00');
			return viewType === 'list' ? eventDate >= new Date(new Date().setHours(0, 0, 0, 0)) : eventDate.getMonth() === month.getMonth() && eventDate.getFullYear() === month.getFullYear();
		});
		filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
		const grouped: GroupedEvents = {};
		for (const event of filteredEvents) {
			if (!grouped[event.date]) {
				grouped[event.date] = {
					dateObj: new Date(event.date + 'T00:00:00'),
					events: []
				};
			}
			grouped[event.date].events.push(event);
		}
		return grouped;
	}

	// --- Data Loading ---
	async function loadEvents(date: Date) {
		loading = true;
		try {
			const year = date.getFullYear();
			const month = date.getMonth();

			let startRange: Date;
			let endRange: Date | null = null;
			
			if (viewType === 'list') {
				startRange = new Date();
				startRange.setHours(0, 0, 0, 0);
			} else {
				startRange = new Date(year, month, 1);
				startRange.setDate(startRange.getDate() - 7);
				endRange = new Date(year, month + 1, 0);
				endRange.setDate(endRange.getDate() + 7);
			}
			
			let query = supabase
				.from('calendar_events')
				.select('*')
				.gte('date', startRange.toISOString().split('T')[0]);
			
			if (endRange) {
				query = query.lte('date', endRange.toISOString().split('T')[0]);
			}
			
			const { data, error } = await query.order('start_time', { ascending: true });

			if (error) throw error;
			allEvents = data || [];
		} catch (error) {
			console.error('Error loading events:', error);
		} finally {
			loading = false;
		}
	}

	// --- Navigation ---
	function previousPeriod() {
		const newDate = new Date(currentViewDate);
		if (viewType === 'week') {
			newDate.setDate(newDate.getDate() - 7);
		} else {
			newDate.setMonth(newDate.getMonth() - 1);
		}
		currentViewDate = newDate;
	}

	function nextPeriod() {
		const newDate = new Date(currentViewDate);
		if (viewType === 'week') {
			newDate.setDate(newDate.getDate() + 7);
		} else {
			newDate.setMonth(newDate.getMonth() + 1);
		}
		currentViewDate = newDate;
	}

	function goToToday() {
		currentViewDate = new Date();
		currentViewDate.setHours(0, 0, 0, 0);
	}

	// --- UI Handlers ---
	function handleDayClick(event: CustomEvent<CalendarDay>) {
		const day = event.detail;
		if (viewType === 'month' && !day.isCurrentMonth) {
			currentViewDate = new Date(day.date);
		}
	}

	function handleEventClick(event: CustomEvent<{event: CalendarEvent, e: MouseEvent | KeyboardEvent}>) {
		const { event: calendarEvent, e } = event.detail;
		e.stopPropagation();
		selectedEvent = calendarEvent;
		showEventModal = true;
	}

	// --- Modal Event Handlers ---
	function handleViewEventClose() {
		showEventModal = false;
		selectedEvent = null;
	}
	function handleViewEventEdit(event: CustomEvent) {
		dispatch('editEvent', { event: event.detail.event });
		showEventModal = false;
		selectedEvent = null;
	}

	// --- Lifecycle & Reactivity ---
	onMount(() => {
		const subscription = supabase
			.channel('calendar_events_changes')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
				loadEvents(currentViewDate);
			})
			.subscribe();
		return () => {
			subscription.unsubscribe();
		};
	});

	$: monthViewDays = viewType === 'month' ? generateMonthDays(currentViewDate, allEvents) : [];
	$: weekViewDays = viewType === 'week' ? generateWeekDays(currentViewDate, allEvents) : [];
	$: listEventsGrouped = viewType === 'list' ? groupEventsForList(currentViewDate, allEvents) : {};
	$: listDates = viewType === 'list' ? Object.keys(listEventsGrouped) : [];
	
	$: headerText = (() => {
		const year = currentViewDate.getFullYear();
		const monthName = monthNames[currentViewDate.getMonth()];
		if (viewType === 'week') {
			const startOfWeek = new Date(currentViewDate);
			startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
			const endOfWeek = new Date(startOfWeek);
			endOfWeek.setDate(endOfWeek.getDate() + 6);
			const startMonth = monthNames[startOfWeek.getMonth()];
			const endMonth = monthNames[endOfWeek.getMonth()];
			if (startMonth === endMonth) {
				return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`;
			} else {
				return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
			}
		} else if (viewType === 'list') {
			return 'Upcoming Events';
		}
		return `${monthName} · ${year}`;
	})();
	
	let lastLoadedMonth = -1;
	let lastLoadedYear = -1;
	let lastViewType = viewType;

	$: {
		const currentMonth = currentViewDate.getMonth();
		const currentYear = currentViewDate.getFullYear();
		if (currentMonth !== lastLoadedMonth || currentYear !== lastLoadedYear || viewType !== lastViewType) {
			loadEvents(currentViewDate);
			lastLoadedMonth = currentMonth;
			lastLoadedYear = currentYear;
			lastViewType = viewType;
		}
	}

	// MODIFIED: This block now resets the date to today whenever the view type changes.
	let previousViewType = viewType;
	$: {
		if (viewType !== previousViewType) {
			// When the view type changes, always reset the date to today.
			currentViewDate = new Date();
			currentViewDate.setHours(0, 0, 0, 0);
		}
		previousViewType = viewType;
	}
</script>

<div use:portal>
	<CalendarViewEvent 
		bind:show={showEventModal} 
		event={selectedEvent} 
		on:close={handleViewEventClose}
		on:edit={handleViewEventEdit}
	/>
</div>

<div class="w-full bg-gray1 rounded-2xl p-6">
	<CalendarHeader {headerText} on:today={goToToday} on:previous={previousPeriod} on:next={nextPeriod} />

	<CalendarBody
		{loading}
		{viewType}
		{monthViewDays}
		{weekViewDays}
		{listEventsGrouped}
		{listDates}
		{weekDayNames}
		{monthNames}
		{statusStyles}
		{eventTypeIcons}
		on:dayClick={handleDayClick}
		on:eventClick={handleEventClick}
	/>
</div>