<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SearchBar from '$lib/components/inputs/SearchBar.svelte';
	import AdvanceCard from '$lib/components/advance/AdvanceCard.svelte';
	import EventEditModal from '$lib/components/modals/EventEditModal.svelte';
	import EventAddModal from '$lib/components/modals/EventAddModal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import FilterButton, { type FilterType } from '$lib/components/buttons/FilterButton.svelte';
	import { fetchEventsAdvance, type EventAdvance } from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js'; // Add this import

	let mounted = false;
	let searchValue = '';
	let currentFilter: FilterType = 'none';
	let loading = true;
	let error: string | null = null;

	// State for the new toggle button
	let showLive = true;

	// allEvents stores the complete list from the server
	let allEvents: EventAdvance[] = [];
	// events stores the filtered list (live or past)
	let events: EventAdvance[] = [];

	// Modal state
	let showEditModal = false;
	let selectedEvent: EventAdvance | null = null;
	let showAddModal = false;

	// Update the onMount function
	onMount(async () => {
		setTimeout(() => mounted = true, 150);
		await loadEvents();
	});

	// Update loadEvents function
	async function loadEvents() {
		try {
			loading = true;
			error = null;
			console.log('Loading events from Supabase...');
			
			allEvents = await fetchEventsAdvance();
			// Apply the initial filter (showing live events by default)
			await filterEventsByStatus(); // Add await here
			console.log('Loaded all events:', allEvents);
		} catch (err) {
			console.error('Failed to load events:', err);
			error = 'Failed to load events. Please try again.';
			allEvents = [];
			events = [];
		} finally {
			loading = false;
		}
	}

	// Update handleToggle function
	async function handleToggle(): Promise<void> {
		showLive = !showLive;
		await filterEventsByStatus(); // Add await here
		console.log(`Toggled to ${showLive ? 'LIVE' : 'PAST'} events`);
	}

	async function filterEventsByStatus(): Promise<void> {
		// Debug: Log all events first
		console.log('🔍 DEBUG: All events before filtering:', allEvents);
		console.log('🔍 DEBUG: Looking for Noizu event:', allEvents.find(e => e.artist_name === 'Noizu'));
		
		// First, get all event_ids that exist in the events table
		const { data: eventsTableData, error } = await supabase
			.from('events')
			.select('event_id')
			.not('event_id', 'is', null);

		if (error) {
			console.error('Error fetching events table data:', error);
			// If we can't check, just show all events as live
			events = allEvents;
			return;
		}

		const existingEventIds = new Set(eventsTableData.map((e: any) => e.event_id));
		console.log('🔍 DEBUG: Existing event_ids in events table:', Array.from(existingEventIds));

		if (showLive) {
			events = allEvents.filter((event) => {
				console.log(`🔍 DEBUG: Checking event ${event.event_id} (${event.artist_name})`);
				console.log(`🔍 DEBUG: - event_status: ${event.event_status}`);
				console.log(`🔍 DEBUG: - exists in events table: ${existingEventIds.has(event.event_id)}`);
				
				// Custom events (not in events table) are always treated as live
				if (!existingEventIds.has(event.event_id)) {
					console.log(`✅ Custom event ${event.event_id} (${event.artist_name}) - treating as live`);
					return true;
				}

				// Regular events use the event_status field
				const isLive = event.event_status === 'LIVE';
				console.log(`${isLive ? '✅' : '❌'} Regular event ${event.event_id} (${event.artist_name}) - status: ${event.event_status}`);
				return isLive;
			});
		} else {
			events = allEvents.filter((event) => {
				// Custom events are never shown in "past" view
				if (!existingEventIds.has(event.event_id)) {
					return false;
				}

				// Regular events use the event_status field
				return event.event_status === 'PAST';
			});
		}

		console.log(
			`Filtered for ${showLive ? 'LIVE' : 'PAST'} events. Found ${events.length} events.`
		);
		console.log('🔍 DEBUG: Final filtered events:', events);
	}

	function parseEventDate(dateString: string): Date {
		const currentYear = new Date().getFullYear();

		// If it's already in a valid format, parse it directly
		try {
			const date = new Date(dateString);
			if (!isNaN(date.getTime())) {
				return date;
			}
		} catch (e) {
			// If that fails, try the original format
		}

		// Fallback to the original parsing logic
		return new Date(`${dateString}, ${currentYear}`);
	}

	function sortEvents(eventsToSort: EventAdvance[], filter: FilterType): EventAdvance[] {
		const sorted = [...eventsToSort];

		// Define artist type priority order
		const artistTypePriority = {
			Headliner: 1,
			Support: 2,
			Local: 3
		};

		// Function to get priority number for artist type
		const getArtistTypePriority = (artistType: string | null | undefined): number => {
			if (!artistType) return 999; // Unknown types go to the end
			return artistTypePriority[artistType as keyof typeof artistTypePriority] || 999;
		};

		switch (filter) {
			case 'a-z':
				return sorted.sort((a, b) => a.name.localeCompare(b.name));
			case 'z-a':
				return sorted.sort((a, b) => b.name.localeCompare(a.name));
			case 'date-asc':
				return sorted.sort(
					(a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime()
				);
			case 'date-desc':
				return sorted.sort(
					(a, b) => parseEventDate(b.date).getTime() - parseEventDate(a.date).getTime()
				);
			case 'none':
			default:
				// Default sorting: first by date, then by artist type priority
				return sorted.sort((a, b) => {
					const dateA = parseEventDate(a.date).getTime();
					const dateB = parseEventDate(b.date).getTime();

					// If dates are different, sort by date first
					if (dateA !== dateB) {
						return dateA - dateB;
					}

					// If same date, sort by artist type priority
					const priorityA = getArtistTypePriority(a.artist_type);
					const priorityB = getArtistTypePriority(b.artist_type);
					return priorityA - priorityB;
				});
		}
	}

	// This reactive statement now filters and sorts the `events` array,
	// which has already been filtered by live/past status.
	$: filteredEvents = sortEvents(
		events.filter(
			(event) =>
				event.name.toLowerCase().includes(searchValue.toLowerCase()) ||
				event.tags.some((tag) => tag.toLowerCase().includes(searchValue.toLowerCase()))
		),
		currentFilter
	);

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchValue = event.detail.value;
	}

	function handleFilterChange(event: CustomEvent<{ filter: FilterType }>) {
		currentFilter = event.detail.filter;
	}

	// Modal handlers
	function handleEdit(event: CustomEvent) {
		console.log('Edit event triggered:', event.detail.event);
		selectedEvent = event.detail.event;
		showEditModal = true;
		console.log('Modal state - showEditModal:', showEditModal, 'selectedEvent:', selectedEvent);
	}

	function closeEditModal() {
		console.log('Closing edit modal');
		showEditModal = false;
		selectedEvent = null;
	}

	function handleSave(event: CustomEvent) {
		console.log('Event saved:', event.detail);
		// Refresh events list to reflect changes
		loadEvents();
	}

	function handleDelete(event: CustomEvent) {
		console.log('Event deleted:', event.detail);
		// Refresh events list to reflect changes
		loadEvents();
	}

	function handleCardClick(event: CustomEvent) {
		console.log('Card clicked:', event.detail.event);
		const eventData = event.detail.event;

		// Use the full ID instead of extracting just the event ID
		const fullId = eventData.id; // This is "151459-Chase & Status"

		if (fullId) {
			console.log('Navigating to full ID:', fullId);
			goto(`/advancing/gathered/${fullId}`); // ✅ This goes to /151459-Chase & Status
		} else {
			console.error('No valid ID found for navigation', eventData);
		}
	}

	// Add modal handlers
	function handleAddEvent() {
		console.log('Add event button clicked');
		showAddModal = true;
	}

	function closeAddModal() {
		console.log('Closing add modal');
		showAddModal = false;
	}

	function handleAddSuccess() {
		console.log('Event added successfully');
		// Refresh events list to show new entries
		loadEvents();
	}
</script>

<svelte:head>
	<title>Advance Gathered</title>
</svelte:head>

<MainLayout pageTitle="Advance Gathered">
	<div class="h-full overflow-auto">
		<div class="page-container">
			<!-- Top Controls Bar -->
			<div class="fade-in {mounted ? 'mounted' : ''} mb-8" style="transition-delay: 0.1s;">
				<div class="controls-container">
					<!-- Search Bar (full width on mobile) -->
					<div class="search-container">
						<SearchBar
							placeholder="Search an artist"
							bind:value={searchValue}
							on:input={handleSearch}
						/>
					</div>

					<!-- All Buttons (stack under search on mobile) -->
					<div class="buttons-container">
						<!-- Left Side: Filter and Live/Past Toggle -->
						<div class="buttons-left">
							<FilterButton bind:currentFilter on:filterChange={handleFilterChange} />

							<!-- Live/Past Toggle Button -->
							<button
								class="h-7 px-4 flex items-center justify-center rounded-[14px] cursor-pointer transition-all duration-200 ease-in-out max-w-[50px] font-bold text-sm leading-[22px] {showLive
									? 'bg-transparent border border-lime text-lime hover:!bg-lime hover:text-black'
									: 'bg-transparent border border-gray3 text-gray3 hover:!bg-gray3 hover:text-black'}"
								on:click={handleToggle}
								disabled={loading}
								title={showLive ? 'Showing Live Events' : 'Showing Past Events'}
								aria-label="Toggle between live and past events"
							>
								{showLive ? 'Live' : 'Past'}
							</button>
						</div>

						<!-- Right Side: Add Event Button -->
						<div class="buttons-right">
							<button class="add-event-btn" on:click={handleAddEvent}>
								<span class="flex items-center gap-2">
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									Add Event
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Loading State -->
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
					<p class="text-gray2 text-base">Loading events...</p>
				</div>
				<!-- Error State -->
			{:else if error}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-16 h-16 mb-4 text-red-500">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<line x1="15" y1="9" x2="9" y2="15" />
							<line x1="9" y1="9" x2="15" y2="15" />
						</svg>
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
							>
								<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
								<path d="M21 3v5h-5" />
								<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
								<path d="M3 21v-5h5" />
							</svg>
							Retry
						</span>
					</Button>
				</div>
				<!-- Events Grid -->
			{:else}
				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					{#if filteredEvents.length > 0}
						<div class="events-grid">
							{#each filteredEvents as event, index}
								<div
									class="fade-in {mounted ? 'mounted' : ''} event-card-wrapper"
									style="transition-delay: {0.3 + index * 0.05}s;"
								>
									<AdvanceCard
										event={event as any}
										on:edit={handleEdit}
										on:click={handleCardClick}
									/>
								</div>
							{/each}
						</div>
					{:else}
						<!-- Empty State -->
						<div class="flex flex-col items-center justify-center py-16 text-center">
							<div class="w-16 h-16 mb-4 text-gray2">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="11" cy="11" r="8" />
									<path d="M21 21L16.5 16.5" />
								</svg>
							</div>
							<h3 class="text-xl font-bold text-white mb-2">No events found</h3>
							<p class="text-gray2 text-base mb-6">
								{#if searchValue}
									No events match "{searchValue}"
								{:else if showLive}
									No upcoming live events
								{:else}
									No past events
								{/if}
							</p>
							{#if searchValue}
								<Button variant="outline" on:click={() => (searchValue = '')}>Clear Search</Button>
							{:else}
								<Button variant="filled" on:click={handleAddEvent}>
									<span class="flex items-center gap-2">
										<svg
											class="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<line x1="12" y1="5" x2="12" y2="19" />
											<line x1="5" y1="12" x2="19" y2="12" />
										</svg>
										Add Your First Event
									</span>
								</Button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>

<!-- Edit Modal - IMPORTANT: Place outside MainLayout for proper z-index -->
<EventEditModal
	bind:isOpen={showEditModal}
	event={selectedEvent}
	on:close={closeEditModal}
	on:save={handleSave}
	on:delete={handleDelete}
/>

<!-- Add Modal - IMPORTANT: Place outside MainLayout for proper z-index -->
<EventAddModal bind:isOpen={showAddModal} on:close={closeAddModal} on:success={handleAddSuccess} />

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition:
			opacity 0.6s ease-out,
			transform 0.6s ease-out;
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
		height: auto;
		cursor: pointer;
	}

	.add-event-btn {
		height: 28px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		font-family: var(--font-helvetica);
		font-size: 14px;
		line-height: 22px;
		font-weight: 700;
		background: var(--color-lime);
		color: var(--color-black);
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.add-event-btn:hover {
		opacity: 0.9;
	}

	/* Responsive Controls */
	@media (min-width: 900px) {
		.events-grid {
			grid-template-columns: repeat(2, 400px);
		}
		.controls-container {
			max-width: 824px;
		}
	}

	@media (min-width: 1350px) {
		.events-grid {
			grid-template-columns: repeat(3, 400px);
		}
		.controls-container {
			max-width: 1248px;
		}
	}

	@media (min-width: 1800px) {
		.events-grid {
			grid-template-columns: repeat(4, 400px);
		}
		.controls-container {
			max-width: 1672px;
		}
	}

	/* Stack controls when cards are in single column (below 900px) */
	@media (max-width: 899px) {
		.controls-container {
			flex-direction: column;
			gap: 16px;
			align-items: stretch;
			max-width: 400px;
		}

		.search-container {
			width: 100%;
		}

		.buttons-container {
			justify-content: space-between;
			width: 100%;
		}

		.buttons-left {
			justify-content: flex-start;
		}

		.buttons-right {
			justify-content: flex-end;
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>