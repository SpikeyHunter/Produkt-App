<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventsInfoCard from '$lib/components/marketing/eventsinfo/EventsInfoCard.svelte';
	// Import the new component
	import EventSalesCard from '$lib/components/marketing/eventsinfo/EventSalesCard.svelte';
	import EventsInfoSearch from '$lib/components/marketing/eventsinfo/EventsInfoSearch.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { GENRE_OPTIONS } from '$lib/services/constants.js';
	import {
		fetchEventsAdvance,
		updateEvent,
		type EventAdvance
	} from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';

	import DataEditModal from '$lib/components/modals/DataEditModal.svelte';
	import type { ContentItem } from '$lib/components/modals/DataEditModal.svelte';

	let isVenueModalOpen = false;
	let isGenreModalOpen = false;
	let isSaving = false;
	let modalContent: ContentItem[] = [];

	let mounted = false;
	let loading = true;
	let error: string | null = null;
	let showSearchModal = false;

	let events: EventAdvance[] = [];
	let selectedEvent: EventAdvance | null = null;
	let displayEvent: EventAdvance | null = null;

	// New state for sales card
	let salesData: any = null;
	let user: any = null;
	let salesLoading = false;

	onMount(async () => {
		setTimeout(() => (mounted = true), 150);

		// Fetch current user data for permissions
		const { data: { session } } = await supabase.auth.getSession();
		if (session) {
			const { data: profileData } = await supabase
				.from('profiles')
				.select('bot_userrole, bot_secondary_roles')
				.eq('id', session.user.id)
				.single();
			user = profileData;
		}

		const lastSelectedEventId = localStorage.getItem('lastSelectedEventId');
		await loadEvents(lastSelectedEventId);
	});

	async function loadEvents(preferredEventId: string | null = null) {
		try {
			loading = true;
			error = null;
			console.log('📄 Loading marketing events info from Supabase...');

			events = await fetchEventsAdvance();
			console.log('✅ Loaded events:', events);

			if (preferredEventId) {
				let cachedEvent = events.find((e) => e.event_id.toString() === preferredEventId);
				if (!cachedEvent) {
					console.log(`🤔 Cached event ${preferredEventId} not in main list, fetching directly...`);
					const { data: directEventData } = await supabase
						.from('events')
						.select('*')
						.eq('event_id', preferredEventId)
						.single();

					if (directEventData) {
						console.log(`✅ Fetched cached event directly.`);
						cachedEvent = {
							...directEventData,
							id: `${directEventData.event_id}-${directEventData.event_name}`,
							name: directEventData.event_name,
							date: directEventData.event_date,
							artist_name: directEventData.event_artist || directEventData.event_name,
							venue: directEventData.event_venue || 'TBD'
						} as EventAdvance;
					}
				}

				if (cachedEvent) {
					selectedEvent = cachedEvent;
					displayEvent = cachedEvent;
					console.log(`✅ Loaded cached event: ${cachedEvent.name}`);
					loading = false;
					return;
				} else {
					localStorage.removeItem('lastSelectedEventId');
				}
			}

			const { data: liveEventsData, error: liveError } = await supabase
				.from('events')
				.select('*')
				.eq('event_status', 'LIVE')
				.order('event_date', { ascending: true });

			if (liveError) throw liveError;

			if (!selectedEvent && liveEventsData && liveEventsData.length > 0) {
				const excludeKeywords = [
					'test',
					'réservations',
					'pass',
					'event',
					'template',
					'produktworld',
					'piknic',
					'oktoberfest'
				];
				const filteredLiveEvents = liveEventsData.filter(
					(event) =>
						!excludeKeywords.some((keyword) => event.event_name.toLowerCase().includes(keyword))
				);
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				const upcomingLiveEvents = filteredLiveEvents
					.filter((event) => new Date(event.event_date) >= today)
					.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
				const nearestLiveEvent =
					upcomingLiveEvents.length > 0
						? upcomingLiveEvents[0]
						: filteredLiveEvents.length > 0
						? filteredLiveEvents[filteredLiveEvents.length - 1]
						: null;

				if (nearestLiveEvent) {
					const foundEvent = events.find((e) => e.event_id === nearestLiveEvent.event_id);
					if (foundEvent) {
						displayEvent = foundEvent;
					} else {
						displayEvent = {
							...nearestLiveEvent,
							id: `${nearestLiveEvent.event_id}-${nearestLiveEvent.event_name}`,
							name: nearestLiveEvent.event_name,
							date: nearestLiveEvent.event_date,
							artist_name: nearestLiveEvent.event_artist || nearestLiveEvent.event_name,
							venue: nearestLiveEvent.event_venue || 'TBD'
						} as EventAdvance;
					}
				} else {
					displayEvent = null;
				}
			}
		} catch (err) {
			console.error('❌ Failed to load events:', err);
			error = 'Failed to load events. Please try again.';
			events = [];
		} finally {
			loading = false;
		}
	}

	// Function to load sales data for the selected event
	async function loadSalesData(eventId: string) {
		if (!eventId) return;
		try {
			salesLoading = true;
			console.log(`📊 Loading sales data for event ${eventId}...`);
			const { data, error } = await supabase
				.from('events_sales')
				.select('*')
				.eq('event_id', eventId)
				.single();

			if (error && error.code !== 'PGRST116') {
				// PGRST116 means no rows were found, which is not an error here
				throw error;
			}
			salesData = data;
			console.log('✅ Sales data loaded:', salesData);
		} catch (err) {
			console.error('❌ Failed to load sales data:', err);
			salesData = null; // Reset on error
		} finally {
			salesLoading = false;
		}
	}

	function openVenueModal(event: CustomEvent) {
		const eventData = event.detail;
		modalContent = [
			{
				data_name: 'Venue Name',
				value: eventData.event_venue || '',
				input_type: 'dropdown',
				options: ['New City Gas', 'Bazart', 'Other'],
				allow_other: true,
				table: 'events',
				column: 'event_venue',
				placeholder: 'Select a venue'
			}
		];
		isVenueModalOpen = true;
	}

	function openGenreModal(event: CustomEvent) {
		const eventData = event.detail;
		modalContent = [
			{
				data_name: 'Event Genre',
				value: eventData.event_genre || '',
				input_type: 'dropdown',
				options: GENRE_OPTIONS,
				allow_other: false,
				table: 'events',
				column: 'event_genre',
				placeholder: 'Select a genre'
			}
		];
		isGenreModalOpen = true;
	}

	async function handleVenueSave(event: CustomEvent) {
		const { updates } = event.detail;
		isSaving = true;
		try {
			const venueUpdate = updates.find((u: { column: string }) => u.column === 'event_venue');
			if (venueUpdate && displayEvent) {
				await updateEvent(displayEvent.event_id, { event_venue: (venueUpdate as any).value });
				displayEvent.event_venue = (venueUpdate as any).value;
				displayEvent = { ...displayEvent };
				console.log('✅ Venue updated successfully!');
			}
			closeVenueModal();
		} catch (err) {
			console.error('Failed to update venue:', err);
		} finally {
			isSaving = false;
		}
	}

	async function handleGenreSave(event: CustomEvent) {
		const { updates } = event.detail;
		isSaving = true;
		try {
			const genreUpdate = updates.find((u: { column: string }) => u.column === 'event_genre');
			if (genreUpdate && displayEvent) {
				await updateEvent(displayEvent.event_id, { event_genre: (genreUpdate as any).value });
				displayEvent.event_genre = (genreUpdate as any).value;
				displayEvent = { ...displayEvent }; // Trigger reactivity
				console.log('✅ Genre updated successfully!');
			}
			closeGenreModal();
		} catch (err) {
			console.error('Failed to update genre:', err);
		} finally {
			isSaving = false;
		}
	}

	function closeVenueModal() {
		isVenueModalOpen = false;
	}

	function closeGenreModal() {
		isGenreModalOpen = false;
	}

	function handleOpenSearchModal() {
		showSearchModal = true;
	}

	async function handleModalSelect(event: CustomEvent) {
		const eventData = event.detail.event;
		const eventId = eventData.event_id;
		if (eventId) {
			localStorage.setItem('lastSelectedEventId', eventId.toString());
			await loadEvents(eventId.toString());
		}
	}

	function handleRefresh() {
		selectedEvent = null;
		displayEvent = null;
		localStorage.removeItem('lastSelectedEventId');
		loadEvents();
	}

	// Handler for the sales card's refresh button
	function handleSalesRefresh(event: CustomEvent) {
		const { eventId } = event.detail;
		console.log(`🔄 Refreshing sales for event ${eventId}...`);
		loadSalesData(eventId);
	}

	// When a new event is displayed, fetch its sales data
	$: if (displayEvent) {
		loadSalesData(displayEvent.event_id.toString());
	}
</script>

<svelte:head>
	<title>Events Info</title>
</svelte:head>

<MainLayout pageTitle="Events Info">
	<div class="h-full overflow-auto">
		<div class="p-6">
			<div class="fade-in {mounted ? 'mounted' : ''} mb-8" style="transition-delay: 0.1s;">
				<div class="flex justify-start">
					<div class="flex items-center gap-3">
						<button
							class="h-7 px-3 flex items-center justify-center gap-1.5 rounded-full bg-lime text-black border-none cursor-pointer transition-all duration-200 text-sm font-semibold hover:opacity-90 hover:-translate-y-0.5"
							on:click={handleOpenSearchModal}
							title="Select an event"
						>
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="3" width="7" height="7" />
								<rect x="14" y="3" width="7" height="7" />
								<rect x="14" y="14" width="7" height="7" />
								<rect x="3" y="14" width="7" height="7" />
							</svg>
							<span>Select an event</span>
						</button>
						<button
							class="h-7 w-7 flex items-center justify-center rounded-full bg-gray1 text-white border-none cursor-pointer transition-all duration-200 hover:bg-lime hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
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
					<p class="text-gray2 text-base">Loading events info...</p>
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
					<Button variant="filled" on:click={() => loadEvents()}>Retry</Button>
				</div>
			{:else}
				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					{#if displayEvent}
						<div class="flex flex-wrap justify-start items-start gap-8 min-h-[400px]">
							<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.3s;">
								{#key displayEvent.id || displayEvent.event_id}
									<EventsInfoCard
										event={displayEvent}
										on:openvenue={openVenueModal}
										on:opengenre={openGenreModal}
									/>
								{/key}
							</div>

							<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.4s;">
								{#key displayEvent.id || displayEvent.event_id}
									<EventSalesCard
										{salesData}
										loading={salesLoading}
										eventId={displayEvent.event_id.toString()}
										on:refresh={handleSalesRefresh}
									/>
								{/key}
							</div>
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
							<p class="text-gray2 text-base mb-6">No LIVE events available to display</p>
							<Button variant="filled" on:click={handleOpenSearchModal}>Browse All Events</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>

<EventsInfoSearch
	bind:isOpen={showSearchModal}
	on:select={handleModalSelect}
	on:close={() => (showSearchModal = false)}
/>

{#if isVenueModalOpen && displayEvent}
	<DataEditModal
		title="Set Event Venue"
		event_id={displayEvent.id}
		content={modalContent}
		bind:isOpen={isVenueModalOpen}
		bind:is_saving={isSaving}
		on:close={closeVenueModal}
		on:save={handleVenueSave}
	/>
{/if}

{#if isGenreModalOpen && displayEvent}
	<DataEditModal
		title="Set Event Genre"
		event_id={displayEvent.id}
		event_name={displayEvent.name}
		event_venue={displayEvent.event_venue}
		content={modalContent}
		bind:isOpen={isGenreModalOpen}
		bind:is_saving={isSaving}
		on:close={closeGenreModal}
		on:save={handleGenreSave}
	/>
{/if}

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
	.animate-spin {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>