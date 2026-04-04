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
	import type { User } from '@supabase/supabase-js';

	// --- AUTH STATE ---
	let currentUser: User | null = null;
	let authLoading = true; // Loading state for checking permissions
	let isGuestAuthenticated = false;
	let passwordInput = '';
	let passwordError = '';

	// --- EVENTS DATA STATE ---
	let mounted = false;
	let searchValue = '';
	let currentFilter: FilterType = 'none';
	let eventsLoading = true; // Renamed from 'loading' to avoid conflict
	let error: string | null = null;

	// State for the toggle button
	let showLive = true;
	let allEvents: EventAdvance[] = [];
	let events: EventAdvance[] = [];
	let existingEventIds = new Set<string>();

	// Preview modal state
	let showPreviewModal = false;
	let previewFileUrl = '';
	let previewFileName = '';

	onMount(async () => {
		// 1. Check Supabase User
		const {
			data: { session }
		} = await supabase.auth.getSession();
		currentUser = session?.user || null;

		supabase.auth.onAuthStateChange((_event, session) => {
			currentUser = session?.user || null;
		});

		// 2. Check Guest Token if not logged in
		if (!currentUser) {
			checkGuestAccess();
		}

		// 3. If we have access (User or Guest), load the data
		if (currentUser || isGuestAuthenticated) {
			setTimeout(() => (mounted = true), 150);
			await loadEvents();
		}

		// 4. Auth check complete
		authLoading = false;
	});

	// --- AUTH FUNCTIONS ---
	function checkGuestAccess() {
		try {
			const stored = sessionStorage.getItem('guest_access_token');
			if (stored) {
				const { expiry } = JSON.parse(stored);
				// Check if token is still valid (within 1 hour)
				if (Date.now() < expiry) {
					isGuestAuthenticated = true;
				} else {
					sessionStorage.removeItem('guest_access_token');
				}
			}
		} catch (e) {
			console.error('Error reading guest token', e);
			sessionStorage.removeItem('guest_access_token');
		}
	}

	async function handlePasswordSubmit() {
		// 1. Fetch the correct password from the database
		const { data, error } = await supabase
			.from('parameters')
			.select('data_1')
			.eq('param_name', 'password_stagemanager')
			.single();

		if (error || !data) {
			console.error('Failed to fetch password:', error);
			passwordError = 'System error: Could not verify password.';
			return;
		}

		const correctPassword = data.data_1;

		// 2. Compare user input to the database password
		if (passwordInput === correctPassword) {
			// Success: Save token with 1h expiry (or 7 days if you prefer)
			const expiry = Date.now() + 60 * 60 * 1000;
			sessionStorage.setItem('guest_access_token', JSON.stringify({ expiry }));

			isGuestAuthenticated = true;
			passwordError = '';

			// Trigger data load now that we are authenticated
			authLoading = true; // Briefly show loader while fetching
			await loadEvents();
			mounted = true;
			authLoading = false;
		} else {
			passwordError = 'Incorrect password';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handlePasswordSubmit();
		}
	}

	function focusInput(node: HTMLElement) {
		node.focus();
	}

	// --- DATA FUNCTIONS ---
	async function loadEvents() {
		try {
			eventsLoading = true;
			error = null;
			console.log('Loading events from Supabase...');

			const [fetchedAllEvents, eventsTableResult] = await Promise.all([
				fetchEventsAdvance() as Promise<EventAdvance[]>,
				supabase.from('events').select('event_id').not('event_id', 'is', null)
			]);

			if (eventsTableResult.error) {
				throw new Error(eventsTableResult.error.message);
			}

			allEvents = fetchedAllEvents;
			existingEventIds = new Set(eventsTableResult.data.map((e: any) => String(e.event_id)));

			filterEventsByStatus();

			console.log('Loaded all events and performed initial filter.');
		} catch (err) {
			console.error('Failed to load events:', err);
			error = 'Failed to load events. Please try again.';
			allEvents = [];
			events = [];
		} finally {
			eventsLoading = false;
		}
	}

	function handleToggle(): void {
		showLive = !showLive;
		filterEventsByStatus();
	}

	function filterEventsByStatus(): void {
		if (showLive) {
			events = allEvents.filter((event) => {
				const eventIdString = event.event_id ? String(event.event_id) : null;
				if (!eventIdString || !existingEventIds.has(eventIdString)) {
					return true;
				}
				return event.event_status === 'LIVE';
			});
		} else {
			events = allEvents.filter((event) => {
				const eventIdString = event.event_id ? String(event.event_id) : null;
				if (!eventIdString || !existingEventIds.has(eventIdString)) {
					return false;
				}
				return event.event_status === 'PAST';
			});
		}
	}

	const compareDatesSafely = (
		a: EventAdvance,
		b: EventAdvance,
		direction: 'asc' | 'desc'
	): number => {
		const dateA = a.event_date;
		const dateB = b.event_date;

		if (!dateA && !dateB) return 0;
		if (!dateA) return 1;
		if (!dateB) return -1;

		if (direction === 'asc') {
			return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
		} else {
			return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
		}
	};

	function sortEvents(eventsToSort: EventAdvance[], filter: FilterType): EventAdvance[] {
		if (!eventsToSort) return [];
		const sorted = [...eventsToSort];

		const artistTypePriority = { Headliner: 1, Support: 2, Local: 3 };
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
				return sorted.sort((a, b) => compareDatesSafely(a, b, 'asc'));
			case 'date-desc':
				return sorted.sort((a, b) => compareDatesSafely(a, b, 'desc'));
			case 'none':
			default:
				return sorted.sort((a, b) => {
					const dateComparison = compareDatesSafely(a, b, 'asc');
					if (dateComparison !== 0) return dateComparison;
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
		const eventData = event.detail.event;
		const fullId = eventData.id;
		if (fullId) {
			goto(`/production/backline/${fullId}`);
		}
	}

	function handleViewRider(event: CustomEvent) {
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

{#if !authLoading}
	{#if currentUser}
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
										disabled={eventsLoading}
										title={showLive ? 'Showing Live Events' : 'Showing Past Events'}
									>
										{showLive ? 'Live' : 'Past'}
									</button>
								</div>
							</div>
						</div>
					</div>

					{#if eventsLoading}
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
							<Button variant="filled" on:click={loadEvents}>Retry</Button>
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
										{#if searchValue}No events match "{searchValue}"
										{:else if showLive}No upcoming live events
										{:else}No past events{/if}
									</p>
									{#if searchValue}
										<Button variant="outline" on:click={() => (searchValue = '')}
											>Clear Search</Button
										>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</MainLayout>
	{:else if isGuestAuthenticated}
		<div class="w-full h-screen bg-gray1 overflow-y-auto overflow-x-hidden">
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
									disabled={eventsLoading}
									title={showLive ? 'Showing Live Events' : 'Showing Past Events'}
								>
									{showLive ? 'Live' : 'Past'}
								</button>
							</div>
						</div>
					</div>
				</div>

				{#if eventsLoading}
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
						<Button variant="filled" on:click={loadEvents}>Retry</Button>
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
									{#if searchValue}No events match "{searchValue}"
									{:else if showLive}No upcoming live events
									{:else}No past events{/if}
								</p>
								{#if searchValue}
									<Button variant="outline" on:click={() => (searchValue = '')}>Clear Search</Button
									>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
		>
			<div
				class="bg-gray1 border border-gray2/30 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col gap-6"
			>
				<div class="text-center">
					<img src="/images/ProduktXX_LOGO1.png" alt="Produkt Logo" class="h-9 mx-auto mb-10" />
					<h2 class="text-2xl font-bold text-white mb-2">Backline</h2>
					<p class="text-gray2 text-sm">Please enter the password to view the Backline.</p>
				</div>

				<div class="space-y-2">
					<input
						type="password"
						placeholder="Enter Password"
						bind:value={passwordInput}
						on:keydown={handleKeydown}
						use:focusInput
						class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
					/>
					{#if passwordError}
						<p
							class="text-red-500 text-xs text-center font-bold animate-in fade-in slide-in-from-top-1"
						>
							{passwordError}
						</p>
					{/if}
				</div>

				<button
					on:click={handlePasswordSubmit}
					class="w-full py-3 rounded-xl bg-lime text-black font-bold hover:bg-lime/90 transition-all shadow-lg shadow-lime/10"
				>
					Access Backline
				</button>
			</div>
		</div>
	{/if}
{:else}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{/if}

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
