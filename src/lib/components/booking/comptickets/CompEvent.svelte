<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let selectedEventId: number | null = null;
	const dispatch = createEventDispatcher();
	let events: any[] = [];
	let loading = true;
	let searchTerm = '';
	let eventFilter: 'LIVE' | 'PAST' = 'LIVE';
	
	const excludedWords = ['test', 'réservations', 'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'];

	async function loadEvents(status: 'LIVE' | 'PAST') {
		loading = true;
		const { data, error } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_flyer, event_status, timetable_active')
			.eq('event_status', status)
			.eq('timetable_active', true)
			.order('event_date', { ascending: status === 'LIVE' });

		if (error) {
			console.error(`Error fetching ${status} events:`, error);
		} else if (data) {
			events = data;
			console.log(`Loaded ${status} events:`, events.length);
		}
		loading = false;
	}

	onMount(() => {
		loadEvents(eventFilter);
	});

	$: filteredEvents = events.filter((event) => {
		const eventNameLower = event.event_name.toLowerCase();
		const matchesSearch = event.event_name.toLowerCase().includes(searchTerm.toLowerCase());
		const isExcluded = excludedWords.some((word) => eventNameLower.includes(word.toLowerCase()));
		return matchesSearch && !isExcluded;
	});

	$: selectedEvent = events.find(e => e.event_id === selectedEventId);

	function selectEvent(eventId: number) {
		console.log('CompEvent: selectEvent called with eventId:', eventId);
		console.log('CompEvent: current selectedEventId:', selectedEventId);
		
		selectedEventId = eventId;
		console.log('CompEvent: updated selectedEventId to:', selectedEventId);
		
		dispatch('select', eventId);
		console.log('CompEvent: dispatched select event with:', eventId);
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Date TBD';
		try {
			const utcDate = new Date(dateString);
			if (isNaN(utcDate.getTime())) return dateString;
			const date = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
			const day = date.getDate();
			const month = date.toLocaleString('en-US', { month: 'long' });
			const year = date.getFullYear();
			const getSuffix = (d: number) => {
				if (d > 3 && d < 21) return 'th';
				switch (d % 10) {
					case 1: return "st";
					case 2: return "nd";
					case 3: return "rd";
					default: return "th";
				}
			};
			return `${month} ${day}${getSuffix(day)}, ${year}`;
		} catch {
			return dateString;
		}
	}
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl overflow-hidden">
	<div class="p-4 border-b border-gray1 flex-shrink-0 flex justify-between items-center">
		<h2 class="text-white text-sm font-bold">Select Event</h2>
		
		<div class="flex bg-gray1 rounded-3xl cursor-pointer p-0.5">
			<button 
				class="px-3 py-1 text-xs rounded-3xl cursor-pointer font-medium transition-colors {eventFilter === 'LIVE' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
				on:click={() => { if(eventFilter !== 'LIVE') { eventFilter = 'LIVE'; loadEvents('LIVE'); } }}
			>
				Live
			</button>
			<button 
				class="px-3 py-1 text-xs rounded-3xl cursor-pointer font-medium transition-colors {eventFilter === 'PAST' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
				on:click={() => { if(eventFilter !== 'PAST') { eventFilter = 'PAST'; loadEvents('PAST'); } }}
			>
				Past
			</button>
		</div>
	</div>

	<div class="p-4 border-b border-gray1 flex-shrink-0">
		<div class="relative">
			<input 
				type="text" 
				bind:value={searchTerm} 
				placeholder="Search an event" 
				class="w-full bg-gray1 text-white rounded-lg px-3 py-2 pl-9 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" 
			/>
			<svg
				class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray2"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.35-4.35" />
			</svg>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4 comp-scroll">
		{#if loading}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div class="animate-pulse flex gap-3">
						<div class="w-12 h-12 bg-gray1 rounded flex-shrink-0"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 bg-gray1 rounded w-3/4"></div>
							<div class="h-3 bg-gray1 rounded w-1/2"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if filteredEvents.length > 0}
			<div class="flex flex-col gap-3">
				{#each filteredEvents as event (event.event_id)}
					<button 
						type="button"
						on:click={() => selectEvent(event.event_id)} 
						class="w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 cursor-pointer
							{selectedEventId === event.event_id 
								? 'bg-lime text-black' 
								: 'bg-gray1 text-white hover:text-black hover:bg-gray2'}"
					>
						{#if event.event_flyer}
							<img src={event.event_flyer} alt={event.event_name} class="w-12 h-12 object-cover rounded flex-shrink-0" />
						{:else}
							<div class="w-12 h-12 bg-navbar rounded flex items-center justify-center flex-shrink-0">
								<svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="3" width="18" height="18" rx="2"/>
									<circle cx="8.5" cy="8.5" r="1.5"/>
									<path d="M21 15l-5-5L5 21"/>
								</svg>
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="text-sm font-bold truncate">{event.event_name}</div>
							<div class="text-xs opacity-70">{formatDate(event.event_date)}</div>
						</div>
						{#if selectedEventId === event.event_id}
							<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
				<p class="text-gray2 text-sm">{searchTerm ? `No matching ${eventFilter} events found` : `No ${eventFilter} events available`}</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.comp-scroll {
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE and Edge */
	}
	.comp-scroll::-webkit-scrollbar {
		display: none; /* Chrome, Safari, Opera */
	}
</style>