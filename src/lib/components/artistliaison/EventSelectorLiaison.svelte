<script lang="ts">
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { EventAdvance } from '$lib/types/events';

	const dispatch = createEventDispatcher();

	interface EventWithAdvanceStatus {
		event_id: number;
		event_name: string;
		event_date: string;
		event_flyer: string | null;
		event_venue: string | null;
		totalAdvances: number;
		completedAdvances: number;
		isFullyCompleted: boolean;
		advances: EventAdvance[];
	}

	let eventsWithStatus: EventWithAdvanceStatus[] = [];
	let loading = true;
	let searchTerm = '';
	let selectedEventId: number | null = null;

	onMount(async () => {
		await loadEvents();
	});

	async function loadEvents() {
		loading = true;
		try {
			// Fetch all advance records
			const { data: advanceData, error: advanceError } = await supabase
				.from('events_advance')
				.select('*')
				.order('event_id', { ascending: false });

			if (advanceError) throw advanceError;

			if (!advanceData || advanceData.length === 0) {
				eventsWithStatus = [];
				loading = false;
				return;
			}

			// Get unique event IDs
			const uniqueEventIds = [...new Set(advanceData.map(a => a.event_id))];

			// Fetch event details for LIVE events only
			const { data: eventsData, error: eventsError } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue, event_status')
				.in('event_id', uniqueEventIds)
				.eq('event_status', 'LIVE');

			if (eventsError) throw eventsError;

			// Process and combine data
			eventsWithStatus = eventsData?.map(event => {
				const eventAdvances = advanceData.filter(a => a.event_id === event.event_id);
				const completedAdvances = eventAdvances.filter(
					a => a.advance_status === 'Completed'
				).length;

				return {
					event_id: event.event_id,
					event_name: event.event_name,
					event_date: event.event_date,
					event_flyer: event.event_flyer,
					event_venue: event.event_venue,
					totalAdvances: eventAdvances.length,
					completedAdvances,
					isFullyCompleted: completedAdvances === eventAdvances.length,
					advances: eventAdvances
				};
			}) || [];

			// Sort by date
			eventsWithStatus.sort((a, b) => {
				const dateA = new Date(a.event_date);
				const dateB = new Date(b.event_date);
				return dateA.getTime() - dateB.getTime();
			});

		} catch (error) {
			console.error('Error loading events:', error);
			eventsWithStatus = [];
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	function handleSelectEvent(event: EventWithAdvanceStatus) {
		if (!event.isFullyCompleted) return;
		
		selectedEventId = event.event_id;
		dispatch('select', event);
	}

	$: filteredEvents = eventsWithStatus.filter((event) => {
		const matchesSearch = 
			event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			event.event_venue?.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesSearch;
	});
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold mb-2">Event Selection</h3>
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Search events or venues..."
			class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
		/>
	</div>

	<div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
		{#if loading}
			<div class="space-y-2">
				{#each Array(6) as _}
					<div class="animate-pulse h-20 bg-gray1 rounded-lg"></div>
				{/each}
			</div>
		{:else if filteredEvents.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="15" y1="9" x2="9" y2="15"></line>
					<line x1="9" y1="9" x2="15" y2="15"></line>
				</svg>
				<p class="text-gray2 text-xs">
					{searchTerm ? 'No events found' : 'No LIVE events with advances'}
				</p>
			</div>
		{:else}
			{#each filteredEvents as event (event.event_id)}
				<button
					type="button"
					on:click={() => handleSelectEvent(event)}
					disabled={!event.isFullyCompleted}
					class="w-full text-left transition-all
						{event.isFullyCompleted 
							? 'cursor-pointer hover:scale-[1.02]' 
							: 'cursor-not-allowed opacity-60'}"
				>
					<div class="flex items-center gap-3 p-2 bg-gray1 rounded-lg border-2 
						{selectedEventId === event.event_id ? 'border-lime' : 'border-transparent'}
						{event.isFullyCompleted ? 'hover:border-lime/50' : ''}"
					>
						<!-- Event Flyer -->
						<div class="w-14 h-20 rounded overflow-hidden bg-navbar flex-shrink-0">
							{#if event.event_flyer}
								<img
									src={event.event_flyer}
									alt={event.event_name}
									class="w-full h-full object-cover"
									draggable="false"
								/>
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-lime/20 to-lime/10 flex items-center justify-center">
									<svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
									</svg>
								</div>
							{/if}
						</div>

						<!-- Event Info -->
						<div class="flex-1 min-w-0">
							<p class="text-xs font-bold text-white truncate">{event.event_name}</p>
							<p class="text-[10px] text-gray2">{formatDate(event.event_date)}</p>
							{#if event.event_venue}
								<p class="text-[10px] text-gray3 truncate">{event.event_venue}</p>
							{/if}
							
							<!-- Advance Status -->
							<div class="mt-1">
								{#if event.isFullyCompleted}
									<div class="flex items-center gap-1">
										<svg class="w-3 h-3 text-lime" viewBox="0 0 24 24" fill="currentColor">
											<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path>
										</svg>
										<span class="text-[10px] text-lime font-medium">
											All advances completed
										</span>
									</div>
								{:else}
									<div class="flex items-center gap-1">
										<div class="w-full bg-gray2 rounded-full h-1.5">
											<div 
												class="bg-lime h-1.5 rounded-full transition-all"
												style="width: {(event.completedAdvances / event.totalAdvances) * 100}%"
											></div>
										</div>
										<span class="text-[10px] text-lime font-medium ml-1">
											{event.completedAdvances}/{event.totalAdvances}
										</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}
</style>