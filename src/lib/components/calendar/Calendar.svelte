<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import CalendarHeader from './CalendarHeader.svelte';
	import CalendarBody from './CalendarBody.svelte';
	import CalendarAddEvent from './CalendarAddEvent.svelte';
	import CalendarViewEvent from './CalendarViewEvent.svelte';
	import CalendarManageHolds from './CalendarManageHolds.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import type { CalendarEvent, CalendarDay, GroupedEvents } from '$lib/types/calendar-types';
	
	// Props & State
	export let selectedDate: Date = new Date();
	export let viewType: 'month' | 'week' | 'list' = 'month';
	
	let currentViewDate: Date = new Date(selectedDate.setHours(0, 0, 0, 0));
	let allEvents: CalendarEvent[] = [];
	let loading = true;
	let selectedEvent: CalendarEvent | null = null;
	let selectedDayEvents: CalendarEvent[] = [];
	let showEventModal = false;
	let showAddModal = false;
	let showManageHoldsModal = false;
	let filterStatus: 'all' | 'HOLD' | 'CONFIRMED' | 'PENDING' = 'all';
	let filterVenue: 'all' | 'Co-Pro Shows' | 'New City Gas' | 'Bazart' = 'all';
	
	// Constants
	const weekDayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	
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
			
			const dayEvents = getFilteredEvents(events).filter((event) => {
				const eventDate = new Date(event.date + 'T00:00:00');
				return eventDate.getTime() === date.getTime();
			});
			
			// Sort events by hold level (H1 first, then H2, etc.)
			dayEvents.sort((a, b) => {
				if (a.hold_level && b.hold_level) {
					return a.hold_level.localeCompare(b.hold_level);
				}
				return 0;
			});
			
			const holds = dayEvents.filter(e => e.status === 'HOLD' || e.status === 'PENDING');
			
			days.push({
				date: new Date(date),
				dayNumber: date.getDate(),
				isCurrentMonth: date.getMonth() === monthIndex,
				isToday: date.getTime() === today.getTime(),
				events: dayEvents,
				holds: holds
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
			
			const dayEvents = getFilteredEvents(events).filter((event) => {
				const eventDate = new Date(event.date + 'T00:00:00');
				return eventDate.getTime() === date.getTime();
			});
			
			dayEvents.sort((a, b) => {
				if (a.hold_level && b.hold_level) {
					return a.hold_level.localeCompare(b.hold_level);
				}
				return 0;
			});
			
			const holds = dayEvents.filter(e => e.status === 'HOLD' || e.status === 'PENDING');
			
			days.push({
				date: new Date(date),
				dayNumber: date.getDate(),
				isCurrentMonth: true,
				isToday: date.getTime() === today.getTime(),
				events: dayEvents,
				holds: holds
			});
		}
		
		return days;
	}
	
	function groupEventsForList(month: Date, events: CalendarEvent[]): GroupedEvents {
		const filteredEvents = getFilteredEvents(events).filter((event) => {
			const eventDate = new Date(event.date + 'T00:00:00');
			return viewType === 'list' 
				? eventDate >= new Date(new Date().setHours(0, 0, 0, 0)) 
				: eventDate.getMonth() === month.getMonth() && eventDate.getFullYear() === month.getFullYear();
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
	
	// --- Filtering ---
	function getFilteredEvents(events: CalendarEvent[]): CalendarEvent[] {
		return events.filter(event => {
			const statusMatch = filterStatus === 'all' || event.status === filterStatus;
			const venueMatch = filterVenue === 'all' || event.venue_category === filterVenue;
			return statusMatch && venueMatch;
		});
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
			
			const { data, error } = await query.order('date', { ascending: true });
			
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
	
	// --- Event Handlers ---
	function handleDayClick(event: CustomEvent<{day: CalendarDay, clickedDate: Date}>) {
		const { day, clickedDate } = event.detail;
		selectedDate = clickedDate;
		
		if (viewType === 'month' && !day.isCurrentMonth) {
			currentViewDate = new Date(day.date);
		} else if (day.events.length === 0) {
			// If no events on this day, open add modal
			showAddModal = true;
		} else if (day.events.length === 1) {
			// If one event, view it
			selectedEvent = day.events[0];
			showEventModal = true;
		} else {
			// If multiple events, show manage holds modal
			selectedDayEvents = day.events;
			showManageHoldsModal = true;
		}
	}
	
	function handleEventClick(event: CustomEvent<{event: CalendarEvent, e: MouseEvent | KeyboardEvent}>) {
		const { event: calendarEvent, e } = event.detail;
		e.stopPropagation();
		selectedEvent = calendarEvent;
		showEventModal = true;
	}
	
	function handleAddEventClick() {
		showAddModal = true;
	}
	
	function handleManageHolds() {
		const dayEvents = allEvents.filter(e => {
			const eventDate = new Date(e.date + 'T00:00:00');
			const selectedDateNormalized = new Date(selectedDate);
			selectedDateNormalized.setHours(0, 0, 0, 0);
			return eventDate.getTime() === selectedDateNormalized.getTime();
		});
		selectedDayEvents = dayEvents;
		showManageHoldsModal = true;
	}
	
	// --- Copy Holds to Clipboard ---
	async function copyHoldsToClipboard() {
		const holds = allEvents.filter(e => e.status === 'HOLD' || e.status === 'PENDING');
		const groupedByDate: Record<string, CalendarEvent[]> = {};
		
		holds.forEach(hold => {
			if (!groupedByDate[hold.date]) {
				groupedByDate[hold.date] = [];
			}
			groupedByDate[hold.date].push(hold);
		});
		
		let clipboardText = 'HOLDS:\n\n';
		
		Object.keys(groupedByDate).sort().forEach(date => {
			const dateObj = new Date(date + 'T00:00:00');
			const dateStr = dateObj.toLocaleDateString('en-US', { 
				weekday: 'short', 
				month: 'short', 
				day: 'numeric' 
			});
			
			clipboardText += `${dateStr}:\n`;
			groupedByDate[date].forEach(event => {
				const level = event.hold_level || '';
				const status = event.status === 'PENDING' ? ' (P)' : '';
				clipboardText += `  ${level}${status} - ${event.title}\n`;
			});
			clipboardText += '\n';
		});
		
		clipboardText += '\nAny holds not listed are NA.';
		
		try {
			await navigator.clipboard.writeText(clipboardText);
			alert('Holds copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy:', err);
		}
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
	
	// Reactive statements
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
	
	// Load events when view changes
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
	
	// Reset date when view type changes
	let previousViewType = viewType;
	$: {
		if (viewType !== previousViewType) {
			currentViewDate = new Date();
			currentViewDate.setHours(0, 0, 0, 0);
		}
		previousViewType = viewType;
	}
</script>

<!-- Modals (using portal) -->
<div use:portal>
	<CalendarAddEvent
		bind:isOpen={showAddModal}
		{selectedDate}
		on:success={() => loadEvents(currentViewDate)}
		on:close={() => showAddModal = false}
	/>
	
	<CalendarViewEvent
		bind:show={showEventModal}
		event={selectedEvent}
		on:close={() => {
			showEventModal = false;
			selectedEvent = null;
		}}
		on:edit={(e: CustomEvent) => {
			// Handle edit
			showEventModal = false;
		}}
	/>
	
	<CalendarManageHolds
		bind:isOpen={showManageHoldsModal}
		events={selectedDayEvents}
		selectedDate={selectedDate}
		on:close={() => showManageHoldsModal = false}
		on:update={() => loadEvents(currentViewDate)}
	/>
</div>

<div class="w-full bg-gray1 rounded-2xl p-6">
	<CalendarHeader
		{headerText}
		{filterStatus}
		{filterVenue}
		on:today={goToToday}
		on:previous={previousPeriod}
		on:next={nextPeriod}
		on:addEvent={handleAddEventClick}
		on:manageHolds={handleManageHolds}
		on:copyHolds={copyHoldsToClipboard}
		on:filterStatusChange={(e) => filterStatus = e.detail}
		on:filterVenueChange={(e) => filterVenue = e.detail}
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
		on:dayClick={handleDayClick}
		on:eventClick={handleEventClick}
	/>
</div>