<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SearchBar from '$lib/components/inputs/SearchBar.svelte';
	import SetTimesCard from '$lib/components/booking/settimes/setTimesCard.svelte';
	import FilterButton, { type FilterType } from '$lib/components/buttons/FilterButton.svelte';
	import {
		fetchAllEventsWithSetTimes,
		updateEventTimetableActive,
		updateEventTimetable,
		type EventWithTimetable
	} from '$lib/services/eventsService';
	import Button from '$lib/components/buttons/Button.svelte';
	import SetTimesModal from '$lib/components/modals/SetTimesModal.svelte';

	// 👇 IMPORTANT: Import your Supabase client here. Adjust the path to match your project.
	import { supabase } from '$lib/supabase';

	type EventWithStatus = EventWithTimetable & {
		event_status: 'LIVE' | 'PAST';
	};

	let mounted = false;
	let searchValue = '';
	let currentFilter: FilterType = 'none';
	let loading = true;
	let error: string | null = null;
	let realtimeChannel: any; // Store the subscription channel

	// --- MODAL STATE ---
	let showSetTimesModal = false;
	let selectedEventForModal: EventWithStatus | null = null;

	const EXCLUDE_WORDS = ['TEST', 'TESTING', 'PASS', 'RÉSERVATIONS', 'RÉSERVATION', 'TEMPLATE'];
	let allEvents: EventWithStatus[] = [];

	// --- TOGGLE STATES ---
	let showHiddenEvents = false;
	let showLiveEvents = true;

	$: events = allEvents
		.filter((event) => {
			const eventNameUpper = event.event_name.toUpperCase();
			return !EXCLUDE_WORDS.some((word) => eventNameUpper.includes(word));
		})
		.filter((event) => {
			if (showHiddenEvents) {
				return event.timetable_active === false;
			} else {
				return event.timetable_active !== false;
			}
		})
		.filter((event) => {
			if (showLiveEvents) {
				return event.event_status === 'LIVE';
			} else {
				return event.event_status === 'PAST';
			}
		});

	$: filteredEvents = sortEvents(
		events.filter((event) => event.event_name.toLowerCase().includes(searchValue.toLowerCase())),
		currentFilter
	);

	onMount(async () => {
		setTimeout(() => (mounted = true), 150);
		await loadEvents();

		// 👇 Set up Supabase Realtime Subscription
		realtimeChannel = supabase
			.channel('public-events-changes')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'events' }, // Adjust 'events' if your table is named differently
				(payload) => {
					console.log('🔄 Realtime payload received:', payload);
					handleRealtimeUpdate(payload);
				}
			)
			/* NOTE: If 'timetables' is a completely separate SQL table (not a JSONB column on events),
			   uncomment this secondary listener to capture those changes too!
			*/
			/*
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'timetables' },
				(payload) => {
					// The simplest way to handle complex relational data on the fly is to quickly refetch
					// OR you can map the specific nested payload to `allEvents` for true zero-lag.
					loadEvents(); 
				}
			)
			*/
			.subscribe((status) => {
				console.log('📡 Supabase Realtime Status:', status);
			});
	});

	// Clean up the subscription when the user navigates away
	onDestroy(() => {
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}
	});

	// 👇 This function updates the local Svelte state INSTANTLY across all connected browsers
	function handleRealtimeUpdate(payload: any) {
		if (payload.eventType === 'UPDATE') {
			allEvents = allEvents.map((event) =>
				// Match by your primary key. Adjust 'event_id' if needed.
				event.event_id === payload.new.event_id
					? { ...event, ...payload.new } // Instantly merges the new DB state into the local array
					: event
			);
		} else if (payload.eventType === 'INSERT') {
			// For inserts, complex joins often mean `payload.new` is missing relational data (like artist names).
			// Refetching is usually safer here, though you could push directly to the array.
			loadEvents();
		} else if (payload.eventType === 'DELETE') {
			allEvents = allEvents.filter((event) => event.event_id !== payload.old.event_id);
		}
	}

	async function loadEvents() {
		try {
			loading = true;
			error = null;
			console.log('🔄 Loading all events for set times...');
			const fetchedData = await fetchAllEventsWithSetTimes();
			allEvents = fetchedData as EventWithStatus[];
			console.log(`✅ Loaded ${allEvents.length} total events.`);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			console.error('❌ Failed to load events:', errorMessage);
			error = 'Failed to load events. Please try again.';
			allEvents = [];
		} finally {
			loading = false;
		}
	}

	function parseEventDate(dateString: string): Date {
		const currentYear = new Date().getFullYear();
		try {
			const date = new Date(dateString);
			if (!isNaN(date.getTime())) {
				return date;
			}
		} catch (e) {}
		return new Date(`${dateString}, ${currentYear}`);
	}

	function sortEvents(events: EventWithStatus[], filter: FilterType): EventWithStatus[] {
		const sorted = [...events];
		switch (filter) {
			case 'a-z': return sorted.sort((a, b) => a.event_name.localeCompare(b.event_name));
			case 'z-a': return sorted.sort((a, b) => b.event_name.localeCompare(a.event_name));
			case 'date-asc': return sorted.sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
			case 'date-desc': return sorted.sort((a, b) => parseEventDate(b.event_date).getTime() - parseEventDate(a.event_date).getTime());
			case 'none':
			default:
				if (showLiveEvents) {
					return sorted.sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
				} else {
					return sorted.sort((a, b) => parseEventDate(b.event_date).getTime() - parseEventDate(a.event_date).getTime());
				}
		}
	}

	function toggleHiddenEvents() { showHiddenEvents = !showHiddenEvents; }
	function toggleLivePast() { showLiveEvents = !showLiveEvents; }
	function handleSearch(event: CustomEvent<{ value: string }>) { searchValue = event.detail.value; }
	function handleFilterChange(event: CustomEvent<{ filter: FilterType }>) { currentFilter = event.detail.filter; }
	function handleRefresh() { loadEvents(); }

	function handleAddSetTimes(event: CustomEvent<{ event: EventWithStatus }>) {
		selectedEventForModal = event.detail.event;
		showSetTimesModal = true;
	}

	async function handleResetSetTimes(event: CustomEvent<{ eventId: number }>) {
		try {
			// Realtime will instantly handle the UI update, so no need to explicitly await loadEvents() here unless desired
			await updateEventTimetable(event.detail.eventId, null);
		} catch (error) {
			console.error('Failed to reset timetable', error);
			alert('Could not reset the timetable.');
		}
	}

	async function handleHideEvent(event: CustomEvent<{ eventId: number }>) {
		try {
			await updateEventTimetableActive(String(event.detail.eventId), false);
			console.log(`✅ Event ${event.detail.eventId} hidden from timetable`);
		} catch (err) {
			console.error('❌ Failed to hide event:', err);
		}
	}

	async function handleShowEvent(event: CustomEvent<{ eventId: number }>) {
		try {
			await updateEventTimetableActive(String(event.detail.eventId), true);
			console.log(`✅ Event ${event.detail.eventId} shown in timetable`);
		} catch (err) {
			console.error('❌ Failed to show event:', err);
		}
	}

	function handleModalSave() {
		// Realtime should handle standard updates naturally, but this serves as a fallback
		loadEvents();
	}
</script>

<svelte:head>
	<title>Set Times</title>
</svelte:head>

<MainLayout pageTitle="Set Times">
	<div class="h-full overflow-auto">
		<div class="page-container">
			<div class="fade-in {mounted ? 'mounted' : ''} mb-8" style="transition-delay: 0.1s;">
				<div class="controls-container">
					<div class="search-container">
						<SearchBar placeholder="Search an event" bind:value={searchValue} on:input={handleSearch} />
					</div>

					<div class="buttons-container">
						<div class="buttons-left">
							<FilterButton bind:currentFilter on:filterChange={handleFilterChange} />

							<button
								class="toggle-live-past-btn {showLiveEvents ? 'live' : 'past'}"
								on:click={toggleLivePast}
								disabled={loading}
								title={showLiveEvents ? 'Showing Live Events' : 'Showing Past Events'}
							>
								{showLiveEvents ? 'Live' : 'Past'}
							</button>

							<button
								class="refresh-btn"
								on:click={handleRefresh}
								disabled={loading}
								title="Refresh events"
								aria-label="Refresh events"
							>
								<svg
									class="w-4 h-4 {loading ? 'animate-spin' : ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
									<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
									<path d="M3 21v-5h5" />
								</svg>
							</button>
						</div>

						<div class="buttons-right">
							<div class="tooltip-container">
								<button
									class="eye-toggle-btn {showHiddenEvents ? 'active' : ''}"
									on:click={toggleHiddenEvents}
									aria-label={!showHiddenEvents
										? 'Viewing active, click to see inactive'
										: 'Viewing inactive, click to see active'}
								>
									{#if showHiddenEvents}
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
											/>
											<line x1="1" y1="1" x2="23" y2="23" />
										</svg>
									{:else}
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
											<circle cx="12" cy="12" r="3" />
										</svg>
									{/if}
								</button>
								<span class="custom-tooltip">{!showHiddenEvents ? 'Active' : 'Hidden'}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{#if loading}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-8 h-8 mb-4 animate-spin">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="text-lime"
						>
							<path d="M21 12a9 9 0 11-6.219-8.56" />
						</svg>
					</div>
					<p class="text-gray2 text-base">Loading Events...</p>
				</div>
			{:else if error}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-16 h-16 mb-4 text-red-500">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line
								x1="9"
								y1="9"
								x2="15"
								y2="15"
							/></svg
						>
					</div>
					<h3 class="text-xl font-bold text-white mb-2">Error Loading Events</h3>
					<p class="text-gray2 text-base mb-6">{error}</p>
					<Button variant="filled" on:click={loadEvents}>
						<span class="flex items-center gap-2">
							<svg
								class="w-5 h-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path
									d="M21 3v5h-5"
								/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path
									d="M3 21v-5h5"
								/></svg
							>
							Retry
						</span>
					</Button>
				</div>
			{:else}
				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					{#if filteredEvents.length > 0}
						<div class="events-grid">
							{#each filteredEvents as event, index (event.event_id)}
								<div
									class="fade-in {mounted ? 'mounted' : ''} event-card-wrapper {event.timetable_active ===
									false
										? 'opacity-50'
										: ''}"
									style="transition-delay: {0.3 + index * 0.05}s;"
								>
									<SetTimesCard
										{event}
										on:add={handleAddSetTimes}
										on:hide={handleHideEvent}
										on:show={handleShowEvent}
										on:reset={handleResetSetTimes}
									/>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-16 text-center">
							<div class="w-16 h-16 mb-4 text-gray2">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/></svg
								>
							</div>
							<h3 class="text-xl font-bold text-white mb-2">No Events Found</h3>
							<p class="text-gray2 text-base">No events match the current filters.</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>

<SetTimesModal
	bind:isOpen={showSetTimesModal}
	event={selectedEventForModal}
	on:close={() => (showSetTimesModal = false)}
	on:save={handleModalSave}
/>

<style>
/* (Keep your exact existing styles here) */
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
	}
	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
	.page-container {
		padding: 24px;
		max-width: none;
		height: 100%;
		transition: all 0.3s ease;
	}
	.controls-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 400px;
		margin: 0 auto;
	}
	.search-container {
		flex: 1;
	}
	.buttons-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	.buttons-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.buttons-right {
		display: flex;
		align-items: center;
	}
	.events-grid {
		display: grid;
		gap: 24px;
		justify-content: center;
		grid-template-columns: repeat(1, 400px);
	}
	.event-card-wrapper {
		width: 400px;
		height: 240px;
	}
	.toggle-live-past-btn {
		height: 28px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		font-weight: 700;
		font-size: 14px;
		border: 1px solid;
		background-color: transparent;
	}
	.toggle-live-past-btn.live {
		border-color: var(--color-lime);
		color: var(--color-lime);
	}
	.toggle-live-past-btn.live:hover:not(:disabled) {
		background-color: var(--color-lime);
		color: var(--color-black);
	}
	.toggle-live-past-btn.past {
		border-color: var(--color-gray3, #888888);
		color: var(--color-gray3, #888888);
	}
	.toggle-live-past-btn.past:hover:not(:disabled) {
		background-color: var(--color-gray3, #888888);
		color: var(--color-black);
	}
	.toggle-live-past-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.refresh-btn {
		height: 28px;
		width: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		background: var(--color-gray1);
		color: var(--color-white);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.refresh-btn:hover:not(:disabled) {
		background: var(--color-gray2);
	}
	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.eye-toggle-btn {
		height: 28px;
		width: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		background: var(--color-gray1);
		color: var(--color-white);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.eye-toggle-btn:hover {
		background: var(--color-gray2);
	}
	.eye-toggle-btn.active {
		background: var(--color-lime);
		color: var(--color-black);
	}
	.eye-toggle-btn.active:hover {
		background: var(--color-lime);
		opacity: 0.9;
	}
	.tooltip-container {
		position: relative;
		display: flex;
		align-items: center;
	}
	.custom-tooltip {
		position: absolute;
		right: 100%;
		margin-right: 10px;
		background: #333;
		background: var(--color-gray-dark, #333);
		color: var(--color-white);
		padding: 4px 8px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}
	.tooltip-container:hover .custom-tooltip {
		opacity: 1;
		pointer-events: auto;
	}
	@media (min-width: 900px) {
		.events-grid { grid-template-columns: repeat(2, 400px); }
		.controls-container { max-width: 824px; }
	}
	@media (min-width: 1350px) {
		.events-grid { grid-template-columns: repeat(3, 400px); }
		.controls-container { max-width: 1248px; }
	}
	@media (min-width: 1800px) {
		.events-grid { grid-template-columns: repeat(4, 400px); }
		.controls-container { max-width: 1672px; }
	}
	@media (max-width: 899px) {
		.controls-container {
			flex-direction: column;
			gap: 16px;
			align-items: stretch;
			max-width: 400px;
		}
		.search-container { width: 100%; }
		.buttons-container { justify-content: flex-start; width: 100%; }
		.buttons-left { justify-content: flex-start; }
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	.animate-spin { animation: spin 1s linear infinite; }
</style>