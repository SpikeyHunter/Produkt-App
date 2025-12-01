<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import SearchBar from '$lib/components/inputs/SearchBar.svelte';
	import BacklineCard from '$lib/components/production/backline/BacklineCard.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import FilterButton, { type FilterType } from '$lib/components/buttons/FilterButton.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
	import { fetchEventsAdvance, type EventAdvance } from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';

	let mounted = false;
	let searchValue = '';
	let currentFilter: FilterType = 'none';
	let loading = true;
	let error: string | null = null;

	// State for the toggle button
	let showLive = true;
	// allEvents stores the complete list from the server
	let allEvents: EventAdvance[] = [];
	// events stores the filtered list (live or past)
	let events: EventAdvance[] = [];
	
	// Store event IDs needed for filtering once, globally
	let existingEventIds = new Set<string>();

	// Preview modal state
	let showPreviewModal = false;
	let previewFileUrl = '';
	let previewFileName = '';

	onMount(async () => {
		setTimeout(() => (mounted = true), 150);
		await loadEvents();
	});

	// Refactored to fetch all data concurrently for speed
	async function loadEvents() {
		try {
			loading = true;
			error = null;
			console.log('Loading events from Supabase...');

			// 1. Fetch both datasets concurrently (faster than sequential awaits)
			const [fetchedAllEvents, eventsTableResult] = await Promise.all([
				fetchEventsAdvance() as Promise<EventAdvance[]>,
				supabase.from('events').select('event_id').not('event_id', 'is', null)
			]);

			if (eventsTableResult.error) {
				throw new Error(eventsTableResult.error.message);
			}

			allEvents = fetchedAllEvents;
			
			// FIX 1: Ensure existingEventIds stores strings for consistency
			existingEventIds = new Set(eventsTableResult.data.map((e: any) => String(e.event_id)));

			// 2. Initial filter (Synchronous now)
			filterEventsByStatus();
			
			console.log('Loaded all events and performed initial filter.');
		} catch (err) {
			console.error('Failed to load events:', err);
			error = 'Failed to load events. Please try again.';
			allEvents = [];
			events = [];
		} finally {
			loading = false;
		}
	}

	function handleToggle(): void { // Now synchronous and fast
		showLive = !showLive;
		filterEventsByStatus();
		console.log(`Toggled to ${showLive ? 'LIVE' : 'PAST'} events`);
	}

	// This function is now synchronous and uses the pre-fetched existingEventIds
	function filterEventsByStatus(): void {
		if (showLive) {
			events = allEvents.filter((event) => {
				// FIX 2: Convert event.event_id to string for Set lookup (L84 error)
				const eventIdString = event.event_id ? String(event.event_id) : null;
				
				// Custom events (not in events table) are always treated as live
				if (!eventIdString || !existingEventIds.has(eventIdString)) {
					return true;
				}

				// Regular events use the event_status field
				return event.event_status === 'LIVE';
			});
		} else {
			events = allEvents.filter((event) => {
				// FIX 3: Convert event.event_id to string for Set lookup (L94 error)
				const eventIdString = event.event_id ? String(event.event_id) : null;
				
				// Custom events are never shown in "past" view
				if (!eventIdString || !existingEventIds.has(eventIdString)) {
					return false;
				}

				// Regular events use the event_status field
				return event.event_status === 'PAST';
			});
		}

		console.log(
			`Filtered for ${showLive ? 'LIVE' : 'PAST'} events. Found ${events.length} events.`
		);
	}
	
	// Helper function to safely compare dates, pushing undefined/null dates to the end.
	const compareDatesSafely = (a: EventAdvance, b: EventAdvance, direction: 'asc' | 'desc'): number => {
		// Use event_date (YYYY-MM-DD string) for reliable chronological sorting
		const dateA = a.event_date; 
		const dateB = b.event_date;

		// Handle missing dates first: Push any missing date to the end of the list.
		if (!dateA && !dateB) return 0;
		if (!dateA) return 1; 
		if (!dateB) return -1;

		// Both dates are present (and strings), compare them directly
		if (direction === 'asc') {
			return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
		} else { // 'desc'
			return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
		}
	};

	function sortEvents(eventsToSort: EventAdvance[], filter: FilterType): EventAdvance[] {
		// Defensive check
		if (!eventsToSort) return [];
		
		const sorted = [...eventsToSort];

		const artistTypePriority = {
			Headliner: 1,
			Support: 2,
			Local: 3
		};
		const getArtistTypePriority = (artistType: string | null | undefined): number => {
			if (!artistType) return 999;
			return artistTypePriority[artistType as keyof typeof artistTypePriority] || 999;
		};

		switch (filter) {
			case 'a-z':
				return sorted.sort((a, b) => a.name.localeCompare(b.name));
			case 'z-a':
				return sorted.sort((a, b) => b.name.localeCompare(a.name));
			case 'date-asc':
				// Use safe string comparison for ascending chronological order
				return sorted.sort((a, b) => compareDatesSafely(a, b, 'asc'));
			case 'date-desc':
				// Use safe string comparison for descending chronological order
				return sorted.sort((a, b) => compareDatesSafely(a, b, 'desc'));
			case 'none':
			default:
				return sorted.sort((a, b) => {
					// Use safe string comparison for the default chronological sort (ascending)
					const dateComparison = compareDatesSafely(a, b, 'asc');
					if (dateComparison !== 0) {
						return dateComparison;
					}

					// Secondary sort by artist type priority for events on the same day
					const priorityA = getArtistTypePriority(a.artist_type);
					const priorityB = getArtistTypePriority(b.artist_type);
					return priorityA - priorityB;
				});
		}
	}

	$: filteredEvents = sortEvents(
		events.filter(
			(event) =>
				event.artist_type !== 'Local' &&
				(event.name.toLowerCase().includes(searchValue.toLowerCase()) ||
					event.tags.some((tag) => tag.toLowerCase().includes(searchValue.toLowerCase())))
		),
		currentFilter
	);

	function handleSearch(event: CustomEvent<{ value: string }>) {
		searchValue = event.detail.value;
	}

	function handleFilterChange(event: CustomEvent<{ filter: FilterType }>) {
		currentFilter = event.detail.filter;
	}

	function handleCardClick(event: CustomEvent) {
		console.log('Card clicked:', event.detail.event);
		const eventData = event.detail.event;
		const fullId = eventData.id;

		if (fullId) {
			console.log('Navigating to backline detail:', fullId);
			goto(`/production/backline/${fullId}`);
		} else {
			console.error('No valid ID found for navigation', eventData);
		}
	}

	function handleViewRider(event: CustomEvent) {
		console.log('View rider clicked:', event.detail);
		previewFileUrl = event.detail.fileUrl;
		previewFileName = event.detail.fileName;
		showPreviewModal = true;
	}

	function closePreviewModal() {
		showPreviewModal = false;
	}
</script>

<svelte:head>
	<title>Backline</title>
</svelte:head>

<MainLayout pageTitle="Backline">
	<div class="h-full overflow-auto">
		<div class="page-container">
			<div class="fade-in {mounted ? 'mounted' : ''} mb-8" style="transition-delay: 0.1s;">
				<div class="controls-container">
					<div class="search-container">
						<SearchBar
							placeholder="Search an artist"
							bind:value={searchValue}
							on:input={handleSearch}
						/>
					</div>

					<div class="buttons-container">
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
									<BacklineCard
										event={event as any}
										on:click={handleCardClick}
										on:view-rider={handleViewRider}
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
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>

<PreviewModal
	bind:isOpen={showPreviewModal}
	fileName={previewFileName}
	fileUrl={previewFileUrl}
	showDeleteButton={false}
	showDownloadButton={true}
	on:close={closePreviewModal}
/>

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
		justify-content: flex-start;
		width: 100%;
	}

	.buttons-left {
		display: flex;
		align-items: center;
		gap: 12px;
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
			justify-content: flex-start;
			width: 100%;
		}

		.buttons-left {
			justify-content: flex-start;
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