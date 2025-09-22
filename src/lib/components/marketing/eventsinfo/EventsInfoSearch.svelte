<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;

	const dispatch = createEventDispatcher();
	// Search and filter state
	let searchValue = '';
	let allEvents: any[] = [];
	let filteredEvents: any[] = [];
	let loading = false;
	let modalReady = false;

	// --- UPDATED: Advanced filter states ---
	let filterStatus: 'LIVE' | 'PAST' | 'ALL' = 'LIVE';
	let sortBy: 'date' | 'name' | 'genre' = 'date';
	let sortDirection: 'asc' | 'desc' = 'asc'; // Default sort is now ascending

	// --- NEW: Granular date filter states ---
	let dateFilterMode: 'none' | 'day' | 'month' | 'year' = 'none';
	let filterDayValue: number | null = null;
	let filterMonthValue: number | null = null; // 1-12 for Jan-Dec
	let filterYearValue: number | null = null;
	
	let selectedGenre = '';
	let availableGenres: string[] = [];
	
	// Load events when modal opens
	$: if (isOpen) {
		// Force layout recalculation when modal opens
		modalReady = false;
		setTimeout(() => {
			modalReady = true;
		}, 10);
		loadAllEvents();
	}

	async function loadAllEvents() {
		loading = true;
		try {
			// NOTE: Initial fetch order is descending to get the latest events,
			// but the default client-side sort will be ascending.
			const { data, error } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_status, event_genre')
				.order('event_date', { ascending: false });
			if (error) {
				console.error('Error loading events:', error);
				return;
			}

			// --- NEW: Exclude events with specific keywords ---
			const excludeKeywords = ['test', 'réservations', 'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'];
			const filteredData = (data || []).filter(
				(event) =>
					!excludeKeywords.some((keyword) => event.event_name.toLowerCase().includes(keyword))
			);

			allEvents = filteredData;

			// Extract unique genres
			const genres = new Set<string>();
			allEvents.forEach((event) => {
				if (event.event_genre) {
					genres.add(event.event_genre);
				}
			});
			availableGenres = Array.from(genres).sort();

			applyFilters();
		} catch (error) {
			console.error('Error loading events:', error);
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let results = [...allEvents];
		// Filter by search term
		if (searchValue.trim()) {
			results = results.filter(
				(event) =>
					event.event_name.toLowerCase().includes(searchValue.toLowerCase()) ||
					event.event_id.toString().includes(searchValue) ||
					(event.event_genre && event.event_genre.toLowerCase().includes(searchValue.toLowerCase()))
			);
		}

		// --- UPDATED: Filter by status ---
		if (filterStatus !== 'ALL') {
			results = results.filter((event) => event.event_status === filterStatus);
		}

		// --- NEW: Granular date filtering ---
		if (dateFilterMode !== 'none') {
			results = results.filter((event) => {
				if (!event.event_date) return false;
				
				// Apply the same timezone fix as formatEventDate
				const eventDate = new Date(event.event_date);
				eventDate.setDate(eventDate.getDate() + 1);

				if (dateFilterMode === 'day' && filterDayValue) {
					return eventDate.getDate() === filterDayValue;
				}
				if (dateFilterMode === 'month' && filterMonthValue) {
					// getMonth() is 0-indexed, so we compare with filterMonthValue (1-indexed)
					return eventDate.getMonth() + 1 === filterMonthValue;
				}
				if (dateFilterMode === 'year' && filterYearValue) {
					return eventDate.getFullYear() === filterYearValue;
				}
				// If a mode is selected but no value is entered yet, don't filter out the event
				return true; 
			});
		}


		// Filter by genre
		if (selectedGenre) {
			results = results.filter((event) => event.event_genre === selectedGenre);
		}

		// --- UPDATED: Sorting logic ---
		results.sort((a, b) => {
			let comparison = 0;
			switch (sortBy) {
				case 'name':
					comparison = a.event_name.localeCompare(b.event_name);
					break;
				case 'genre':
					const genreA = a.event_genre || 'zzz';
					const genreB = b.event_genre || 'zzz';
					comparison = genreA.localeCompare(genreB);
					break;
				case 'date':
				default:
					comparison = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
					break;
			}
			return comparison * (sortDirection === 'desc' ? -1 : 1);
		});
		filteredEvents = results;
	}

	// Apply filters whenever any filter changes
	$: (searchValue, filterStatus, sortBy, sortDirection, selectedGenre, dateFilterMode, filterDayValue, filterMonthValue, filterYearValue, applyFilters());

	function formatEventDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1); // Fix timezone offset
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			return dateString;
		}
	}

	function selectEvent(event: any) {
		dispatch('select', { event });
		closeModal();
	}

	function clearFilters() {
		searchValue = '';
		filterStatus = 'LIVE';
		sortBy = 'date';
		sortDirection = 'asc'; // Reset to ascending
		selectedGenre = '';
		// NEW: Reset date filters
		dateFilterMode = 'none';
		filterDayValue = null;
		filterMonthValue = null;
		filterYearValue = null;
	}

	function closeModal() {
		dispatch('close');
		clearFilters();
		modalReady = false;
	}

	// --- NEW: Helper functions for date filters ---
	function setDateFilterMode(mode: 'day' | 'month' | 'year') {
		if (dateFilterMode === mode) {
			dateFilterMode = 'none'; // Toggle off if clicking the same button
		} else {
			dateFilterMode = mode;
		}
		// Reset values when changing mode
		filterDayValue = null;
		filterMonthValue = null;
		filterYearValue = null;

		// Set default value if switching TO a mode
		if (dateFilterMode === 'day') {
			filterDayValue = new Date().getDate();
		}
		if (dateFilterMode === 'year') {
			filterYearValue = new Date().getFullYear();
		}
	}

	function updateDay(amount: number) {
		const current = filterDayValue || new Date().getDate();
		let next = current + amount;
		if (next > 31) next = 1;
		if (next < 1) next = 31;
		filterDayValue = next;
	}
	
	function updateYear(amount: number) {
		const currentYear = new Date().getFullYear();
		const startYear = 2021;
		const current = filterYearValue || currentYear;
		let next = current + amount;

		// Clamp the value within the desired range and allow wrapping
		if (next > currentYear) next = startYear;
		if (next < startYear) next = currentYear;
		
		filterYearValue = next;
	}
	
	const monthNames = [
		'January', 'February', 'March', 'April', 'May', 'June', 
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	
	// Group events by status
	$: liveEvents = filteredEvents.filter((e) => e.event_status === 'LIVE');
	$: pastEvents = filteredEvents.filter((e) => e.event_status === 'PAST');
</script>

<Modal
	bind:isOpen
	title="Select an event"
	maxWidth="max-w-5xl"
	hasFooter={false}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="events-modal-grid {modalReady ? 'ready' : ''}">
		<div class="events-list-column">
			<div class="mb-4 relative">
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 pr-10 py-2 text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
					placeholder="Search events by name, ID, or genre..."
					bind:value={searchValue}
				/>
				{#if searchValue}
					<button
						type="button"
						class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray2 hover:text-white transition-colors"
						on:click={() => (searchValue = '')}
						aria-label="Clear search"
					>
						<svg
							class="w-5 h-5"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto pr-2">
				{#if loading}
					<div class="flex flex-col items-center justify-center h-full">
						<div
							class="animate-spin w-8 h-8 border-3 border-lime border-t-transparent rounded-full"
						></div>
						<p class="text-gray2 mt-4">Loading events...</p>
					</div>
				{:else if filteredEvents.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center">
						<svg
							class="w-16 h-16 text-gray2 mb-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.35-4.35" />
						</svg>
						<p class="text-gray2">No events found matching your filters</p>
						<button
							class="mt-4 px-4 py-2 bg-lime text-black rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
							on:click={clearFilters}
						>
							Clear All Filters
						</button>
					</div>
				{:else}
					{#if liveEvents.length > 0}
						<div class="mb-6">
							<h3 class="text-lg font-bold text-white mb-3 px-2">
								Upcoming Events ({liveEvents.length})
							</h3>
							<div class="grid grid-cols-1 gap-3">
								{#each liveEvents as event (event.event_id)}
									<button
										type="button"
										class="group flex items-center gap-3 p-3 bg-gray1/50 text-white rounded-lg hover:bg-lime hover:cursor-pointer hover:text-black transition-colors text-left"
										on:click={() => selectEvent(event)}
									>
										<div class="w-16 h-16 rounded-lg overflow-hidden bg-navbar flex-shrink-0">
											{#if event.event_flyer}
												<img
													src={event.event_flyer}
													alt={event.event_name}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div
													class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"
												>
													<svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="currentColor">
														<path
															d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
														/>
													</svg>
												</div>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="font-medium truncate">{event.event_name}</p>
											<p class="text-sm opacity-80">
												{formatEventDate(event.event_date)}
												{#if event.event_genre}
													• {event.event_genre}
												{/if}
											</p>
											<p class="text-xs opacity-70">ID: {event.event_id}</p>
										</div>
										<span
											class="px-2 py-1 bg-lime/20 text-lime text-xs rounded-full flex-shrink-0 transition-colors group-hover:bg-black/20 group-hover:text-black"
											>LIVE</span
										>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if pastEvents.length > 0}
						<div>
							<h3 class="text-lg font-bold text-white mb-3 px-2">
								Past Events ({pastEvents.length})
							</h3>
							<div class="grid grid-cols-1 gap-3">
								{#each pastEvents as event (event.event_id)}
									<button
										type="button"
										class="group flex items-center gap-3 p-3 bg-gray1/30 text-white rounded-lg hover:bg-lime hover:cursor-pointer hover:text-black transition-colors text-left"
										on:click={() => selectEvent(event)}
									>
										<div class="w-16 h-16 rounded-lg overflow-hidden bg-navbar flex-shrink-0">
											{#if event.event_flyer}
												<img
													src={event.event_flyer}
													alt={event.event_name}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div
													class="w-full h-full bg-gradient-to-br from-gray2/40 to-gray2/20 flex items-center justify-center"
												>
													<svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="currentColor">
														<path
															d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
														/>
													</svg>
												</div>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="font-medium truncate">{event.event_name}</p>
											<p class="text-sm opacity-80">
												{formatEventDate(event.event_date)}
												{#if event.event_genre}
													• {event.event_genre}
												{/if}
											</p>
											<p class="text-xs opacity-70">ID: {event.event_id}</p>
										</div>
										<span
											class="px-2 py-1 bg-gray1 text-gray2 text-xs rounded-full flex-shrink-0 transition-colors group-hover:bg-black/20 group-hover:cursor-pointer group-hover:text-black"
											>PAST</span
										>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<div class="filters-column">
			<h3 class="text-lg font-bold text-white sm:-ml-2">Filters</h3>

			<div>
				<h4
					class="text-sm font-medium
text-gray3 mb-2"
				>
					Status
				</h4>
				<div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold">
					<button
						on:click={() => (filterStatus = 'LIVE')}
						class="flex-1 py-1 rounded-full transition-colors {filterStatus === 'LIVE'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}">Live</button
					>
					<button
						on:click={() => (filterStatus = 'PAST')}
						class="flex-1 py-1 rounded-full transition-colors {filterStatus === 'PAST'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}">Past</button
					>
					<button
						on:click={() => (filterStatus = 'ALL')}
						class="flex-1 py-1 rounded-full transition-colors {filterStatus === 'ALL'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}">All</button
					>
				</div>
			</div>

			<div>
				<h4 class="text-sm font-medium text-gray3 mb-2">Sort By</h4>
				<div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold">
					<button
						on:click={() => {
							sortBy = 'date';
							sortDirection = 'asc';
						}}
						class="flex-1 py-1 rounded-full transition-colors {sortBy === 'date' &&
						sortDirection === 'asc'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Date ↑
					</button>
					<button
						on:click={() => {
							sortBy = 'date';
							sortDirection = 'desc';
						}}
						class="flex-1 py-1 rounded-full transition-colors {sortBy === 'date' &&
						sortDirection === 'desc'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Date ↓
					</button>
                    <button
						on:click={() => {
							sortBy = 'name';
							sortDirection = 'asc';
						}}
						class="flex-1 py-1 rounded-full transition-colors {sortBy === 'name' &&
						sortDirection === 'asc'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						A-Z
					</button>
					<button
						on:click={() => {
							sortBy = 'name';
							sortDirection = 'desc';
						}}
						class="flex-1 py-1 rounded-full transition-colors {sortBy === 'name' &&
						sortDirection === 'desc'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Z-A
					</button>
					
				</div>
			</div>
			
			<div>
				<h4 class="text-sm font-medium text-gray3 mb-2">Filter by Date</h4>
				<div class="flex gap-1 bg-gray1 p-1 rounded-full text-sm font-bold">
					<button
						on:click={() => setDateFilterMode('day')}
						class="flex-1 py-1 rounded-full transition-colors {dateFilterMode === 'day'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Day
					</button>
					<button
						on:click={() => setDateFilterMode('month')}
						class="flex-1 py-1 rounded-full transition-colors {dateFilterMode === 'month'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Month
					</button>
					<button
						on:click={() => setDateFilterMode('year')}
						class="flex-1 py-1 rounded-full transition-colors {dateFilterMode === 'year'
							? 'bg-lime text-black'
							: 'text-white hover:bg-gray2 hover:cursor-pointer hover:text-black'}"
					>
						Year
					</button>
				</div>
				
				{#if dateFilterMode !== 'none'}
				<div class="mt-3">
					{#if dateFilterMode === 'day'}
						<div class="flex items-center gap-2">
							<button on:click={() => updateDay(-1)} class="p-2 bg-gray1 text-white rounded-full hover:bg-lime hover:text-black transition-colors cursor-pointer flex-shrink-0 leading-none">-</button>
							<input
								type="number"
								readonly
								bind:value={filterDayValue}
								class="w-full bg-gray1 text-center font-bold rounded-full px-4 py-1.5 text-white placeholder-gray2 focus:outline-none cursor-default"
							/>
							<button on:click={() => updateDay(1)} class="p-2 bg-gray1 text-white rounded-full hover:bg-lime hover:text-black transition-colors cursor-pointer flex-shrink-0 leading-none">+</button>
						</div>
					{:else if dateFilterMode === 'month'}
						<select
							bind:value={filterMonthValue}
							class="w-full bg-gray1 rounded-full px-4 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-lime cursor-pointer appearance-none text-center font-bold"
						>
							<option class="bg-navbar font-bold" value={null}>Select a month...</option>
							{#each monthNames as month, i}
								<option class="bg-navbar hover:cursor-pointer font-bold" value={i + 1}>{month}</option>
							{/each}
						</select>

					{:else if dateFilterMode === 'year'}
						<div class="flex items-center gap-2">
							<button on:click={() => updateYear(-1)} class="p-2 bg-gray1 text-white rounded-full hover:bg-lime hover:text-black transition-colors cursor-pointer flex-shrink-0 leading-none">-</button>
							<input
								type="number"
								readonly
								bind:value={filterYearValue}
								class="w-full bg-gray1 text-center font-bold rounded-full px-4 py-1.5 text-white placeholder-gray2 focus:outline-none cursor-default"
							/>
							<button on:click={() => updateYear(1)} class="p-2 bg-gray1 text-white rounded-full hover:bg-lime hover:text-black transition-colors cursor-pointer flex-shrink-0 leading-none">+</button>
						</div>
					{/if}
				</div>
				{/if}

			</div>
			<div class="pt-4">
				<button
					type="button"
					class="w-full px-3 py-2 text-sm bg-gray1 text-white rounded-full hover:cursor-pointer hover:bg-gray2 hover:text-black transition-colors"
					on:click={clearFilters}
				>
					Clear Filters
				</button>
			</div>
		</div>
	</div>
</Modal>

<style>
	/* Updated grid layout with explicit column definitions */
	.events-modal-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
		height: 80vh;
		opacity: 0;
		transition: opacity 0.1s ease-in-out;
	}

	.events-modal-grid.ready {
		opacity: 1;
	}

	/* Force 2-column layout on desktop */
	@media (min-width: 640px) {
		.events-modal-grid {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
			height: 600px;
		}
	}

	.events-list-column {
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100%;
		overflow: hidden;
	}

	.filters-column {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		overflow-y: auto;
		padding-left: 0;
	}

	@media (min-width: 640px) {
		.filters-column {
			border-left: 1px solid rgba(255, 255, 255, 0.1);
			padding-left: 2rem;
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

	/* Hide arrows from number inputs */
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield; /* Firefox */
		appearance: none; /* Standard property */
	}
</style>