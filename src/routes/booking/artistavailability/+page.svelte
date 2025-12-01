<!-- /src/routes/booking/artistavailability/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import BookingGrid from '$lib/components/booking/artistavailability/BookingGrid.svelte';
	import ControlPanel from '$lib/components/booking/artistavailability/ControlPanel.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { fetchArtistEvents } from '$lib/services/bookingartist/bookingService';
	import type { BookingFilters, BookingArtist, BookingEvent } from '$lib/types/booking';

	const PAGE_SIZE = 21;

	let items: (BookingArtist | BookingEvent)[] = [];
	let totalCount = 0;
	let currentPage = 1;
	let isLoading = false;
	let hasMore = true;
	let mounted = false;

	let isModalOpen = false;
	let selectedArtist: BookingArtist | null = null;

	let filters: BookingFilters = {
		viewType: 'event',
		artistDateFilter: 'all',
		sortOrder: 'name_asc',
		dateFilter: 'upcoming',
		quickDateFilter: 'all'
	};
	let searchTerm = '';
	let searchTimeout: NodeJS.Timeout;

	onMount(() => {
		loadInitialItems();
		setTimeout(() => (mounted = true), 100);
	});

	async function loadInitialItems() {
		currentPage = 1;
		hasMore = true;
		isLoading = true;
		items = [];

		const result = await fetchArtistEvents(filters, searchTerm, currentPage, PAGE_SIZE);

		items = result.items;
		totalCount = result.totalCount;
		hasMore = items.length < totalCount;
		isLoading = false;
	}

	async function loadMoreItems() {
		if (isLoading || !hasMore) return;

		currentPage++;
		isLoading = true;
		const result = await fetchArtistEvents(filters, searchTerm, currentPage, PAGE_SIZE);
		items = [...items, ...result.items];
		totalCount = result.totalCount;
		hasMore = items.length < totalCount;
		isLoading = false;
	}

	function handleFiltersChange(event: CustomEvent) {
		filters = event.detail;
		loadInitialItems();
	}

	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadInitialItems();
		}, 300);
	}

	function handleSyncComplete() {
		loadInitialItems();
	}

	function handleArtistClick(event: CustomEvent) {
		selectedArtist = event.detail as BookingArtist;
		isModalOpen = true;
	}
</script>

<svelte:head>
	<title>Artist Availability</title>
</svelte:head>

<MainLayout pageTitle="Artist Availability">
	<div class="h-full overflow-hidden p-4">
		<div class="h-full flex flex-col lg:flex-row gap-4">
			<!-- Left Column -->
			<div class="flex-1 min-w-0 flex flex-col gap-4">
				<!-- Search Bar -->
				<div class="bg-navbar border border-gray1 rounded-xl p-4">
					<div class="relative">
						<input
							type="text"
							bind:value={searchTerm}
							on:input={handleSearchInput}
							placeholder="Search {filters.viewType}s..."
							class="w-full bg-gray1 text-white rounded-lg px-4 py-2 pl-10 text-sm placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
						/>
						<svg
							class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray2"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
					</div>
				</div>

				<!-- Grid -->
				<div class="flex-1 min-h-0">
					<BookingGrid
						{items}
						type={filters.viewType}
						{totalCount}
						{isLoading}
						{hasMore}
						on:loadMore={loadMoreItems}
						on:artistClick={handleArtistClick}
					/>
				</div>
			</div>

			<!-- Right Column -->
			<div class="w-full lg:w-[200px] lg:min-w-[200px] flex-shrink-0">
				<ControlPanel
					bind:filters
					on:filtersChange={handleFiltersChange}
					on:syncComplete={handleSyncComplete}
				/>
			</div>
		</div>
	</div>
</MainLayout>

<Modal bind:isOpen={isModalOpen} title={selectedArtist?.name || 'Artist Details'}>
	<p class="text-gray2">More artist details will be shown here soon.</p>
</Modal>
