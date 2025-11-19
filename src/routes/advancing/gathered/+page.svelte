<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SearchBar from '$lib/components/inputs/SearchBar.svelte';
	import AdvanceCard from '$lib/components/advance/AdvanceCard.svelte';
	import EventEditModal from '$lib/components/modals/EventEditModal.svelte';
	import EventAddModal from '$lib/components/modals/EventAddModal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import FilterButton, { type FilterType } from '$lib/components/buttons/FilterButton.svelte';
	import { fetchEventsAdvance, type EventAdvance } from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';

	let mounted = false;
	let searchValue = '';
	let currentFilter: FilterType = 'none';
	let loading = true;
	let error: string | null = null;

	// State for the new toggle button
	let showLive = true;
	let showLocalOnly = false;

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
		// Read filters from URL params FIRST
		const params = $page.url.searchParams;

		if (params.has('live')) {
			showLive = params.get('live') === 'true';
		}
		if (params.has('local')) {
			showLocalOnly = params.get('local') === 'true';
		}
		if (params.has('filter')) {
			currentFilter = params.get('filter') as FilterType;
		}
		if (params.has('search')) {
			searchValue = params.get('search') || '';
		}

		// Then load events with the restored filters
		await loadEvents();

		// Set mounted for animations
		setTimeout(() => (mounted = true), 150);
	});

	function updateUrlParams() {
		if (!mounted) return;

		const params = new URLSearchParams();

		if (!showLive) {
			params.set('live', 'false');
		}
		if (showLocalOnly) {
			params.set('local', 'true');
		}
		if (currentFilter !== 'none') {
			params.set('filter', currentFilter);
		}
		if (searchValue) {
			params.set('search', searchValue);
		}

		const newUrl = params.toString()
			? `/advancing/gathered?${params.toString()}`
			: '/advancing/gathered';
		window.history.replaceState({}, '', newUrl);
		console.log('URL updated to:', newUrl);
	}

	// Update loadEvents function
	async function loadEvents() {
		try {
			loading = true;
			error = null;
			console.log('Loading events from Supabase...');

			allEvents = await fetchEventsAdvance();
			await filterEventsByStatus();
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

	async function handleToggle(): Promise<void> {
		showLive = !showLive;
		await filterEventsByStatus();
		updateUrlParams();
		console.log(`Toggled to ${showLive ? 'LIVE' : 'PAST'} events`);
	}

	function handleLocalToggle(): void {
		showLocalOnly = !showLocalOnly;
		updateUrlParams();
		console.log(`Toggled to ${showLocalOnly ? 'LOCAL' : 'ALL'} artists`);
	}

	async function filterEventsByStatus(): Promise<void> {
		console.log('🔍 DEBUG: All events before filtering:', allEvents);
		console.log(
			'🔍 DEBUG: Looking for Noizu event:',
			allEvents.find((e) => e.artist_name === 'Noizu')
		);

		const { data: eventsTableData, error } = await supabase
			.from('events')
			.select('event_id')
			.not('event_id', 'is', null);

		if (error) {
			console.error('Error fetching events table data:', error);
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

				if (!existingEventIds.has(event.event_id)) {
					console.log(
						`✅ Custom event ${event.event_id} (${event.artist_name}) - treating as live`
					);
					return true;
				}

				const isLive = event.event_status === 'LIVE';
				console.log(
					`${isLive ? '✅' : '❌'} Regular event ${event.event_id} (${event.artist_name}) - status: ${event.event_status}`
				);
				return isLive;
			});
		} else {
			events = allEvents.filter((event) => {
				if (!existingEventIds.has(event.event_id)) {
					return false;
				}
				return event.event_status === 'PAST';
			});
		}

		console.log(
			`Filtered for ${showLive ? 'LIVE' : 'PAST'} events. Found ${events.length} events.`
		);
		console.log('🔍 DEBUG: Final filtered events:', events);
	}

	function parseEventDate(dateString: string | null | undefined): Date {
		if (!dateString) return new Date(0); // Handle missing dates safely

		// Standardize input to string
		const dateStr = String(dateString);

		// Try parsing ISO format (YYYY-MM-DD) first
		const date = new Date(dateStr);
		if (!isNaN(date.getTime())) {
			return date;
		}

		// Fallback for "Month Day" format (adds current year)
		const currentYear = new Date().getFullYear();
		return new Date(`${dateStr}, ${currentYear}`);
	}

	function sortEvents(
		eventsToSort: EventAdvance[],
		filter: FilterType,
		isLive: boolean
	): EventAdvance[] {
		const sorted = [...eventsToSort];

		// 1. Headliner, 2. Support, 3. Local, 4. Other
		const artistTypePriority: Record<string, number> = {
			Headliner: 1,
			Support: 2,
			Local: 3,
			Other: 4
		};

		// 1. New City Gas, 2. Bazart, 3. Other
		const venuePriority: Record<string, number> = {
			'new city gas': 1,
			bazart: 2
		};

		const getArtistPriority = (type: string | null | undefined): number => {
			if (!type) return 999;
			return artistTypePriority[type] || 999;
		};

		const getVenuePriority = (venue: string | null | undefined): number => {
			if (!venue) return 999;
			const v = venue.toLowerCase();
			// Check if venue string contains our keywords
			if (v.includes('new city gas')) return 1;
			if (v.includes('bazart')) return 2;
			return 3;
		};

		// Helper to access date safely from either property
		const getDate = (e: any) => parseEventDate(e.event_date || e.date).getTime();

		switch (filter) {
			case 'a-z':
				return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			case 'z-a':
				return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
			case 'date-asc':
				return sorted.sort((a, b) => getDate(a) - getDate(b));
			case 'date-desc':
				return sorted.sort((a, b) => getDate(b) - getDate(a));
			case 'none':
			default:
				return sorted.sort((a: any, b: any) => {
					// 1. Sort by FULL Date (Year included via .getTime())
					const dateA = getDate(a);
					const dateB = getDate(b);

					if (dateA !== dateB) {
						// If Live: Ascending (Soonest -> Furthest)
						// If Past: Descending (Most Recent -> Oldest)
						return isLive ? dateA - dateB : dateB - dateA;
					}

					// 2. Sort by Venue (New City Gas -> Bazart -> Others)
					const venueA = getVenuePriority(a.event_venue || a.venue);
					const venueB = getVenuePriority(b.event_venue || b.venue);

					if (venueA !== venueB) {
						return venueA - venueB;
					}

					// 3. Group by Event ID (Keep artists from same event together)
					if (a.event_id !== b.event_id) {
						return (a.event_id || 0) - (b.event_id || 0);
					}

					// 4. Sort by Artist Type (Headliner -> Support -> Local)
					const typeA = getArtistPriority(a.artist_type);
					const typeB = getArtistPriority(b.artist_type);
					return typeA - typeB;
				});
		}
	}

	$: filteredEvents = sortEvents(
		events
			.filter((event) => {
				return showLocalOnly ? event.artist_type === 'Local' : event.artist_type !== 'Local';
			})
			.filter(
				(event) =>
					event.name.toLowerCase().includes(searchValue.toLowerCase()) ||
					event.tags.some((tag) => tag.toLowerCase().includes(searchValue.toLowerCase()))
			),
		currentFilter,
		showLive
	);

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchValue = event.detail.value;
		updateUrlParams();
	}

	function handleFilterChange(event: CustomEvent<{ filter: FilterType }>) {
		currentFilter = event.detail.filter;
		updateUrlParams();
	}

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
		loadEvents();
	}

	function handleDelete(event: CustomEvent) {
		console.log('Event deleted:', event.detail);
		loadEvents();
	}

	function handleCardClick(event: CustomEvent) {
		console.log('Card clicked:', event.detail.event);
		const eventData = event.detail.event;
		const fullId = eventData.id;

		if (fullId) {
			console.log('Navigating to full ID:', fullId);
			goto(`/advancing/gathered/${fullId}`);
		} else {
			console.error('No valid ID found for navigation', eventData);
		}
	}

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

							<button
								class="h-7 px-4 flex items-center justify-center rounded-[14px] cursor-pointer transition-all duration-200 ease-in-out max-w-[60px] font-bold text-sm leading-[22px] {showLocalOnly
									? 'bg-transparent border border-question text-question hover:!bg-question hover:text-black'
									: 'bg-transparent border border-gray3 text-gray3 hover:!bg-gray3 hover:text-black'}"
								on:click={handleLocalToggle}
								disabled={loading}
								title={showLocalOnly ? 'Showing Local Artists' : 'Showing All Artists'}
								aria-label="Toggle between all and local artists"
							>
								{showLocalOnly ? 'Locals' : 'All'}
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

<EventEditModal
	bind:isOpen={showEditModal}
	event={selectedEvent}
	on:close={closeEditModal}
	on:save={handleSave}
	on:delete={handleDelete}
/>

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
