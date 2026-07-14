<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import type {
		SSTour,
		SSTourDate,
		SSTourData,
		SSCrew,
		RidersSettings,
		MerchDefaultItem,
		TracklistTrack
	} from '$lib/types/tour';
	import { fetchTours, fetchTourDates, fetchCrew, getSetting } from '$lib/services/tourService';

	// UI Components
	import TourDatesList from '$lib/components/sultanshepard/tour/TourDatesList.svelte';
	import TourMiddleDisplay from '$lib/components/sultanshepard/tour/TourMiddleDisplay.svelte';
	import TourTabsPanel from '$lib/components/sultanshepard/tour/TourTabsPanel.svelte';
	import TourDropdown from '$lib/components/sultanshepard/tour/TourDropdown.svelte';

	// Modals
	import TourModal from '$lib/components/sultanshepard/tour/TourModal.svelte';
	import TourDateModal from '$lib/components/sultanshepard/tour/TourDateModal.svelte';
	import TourBudget from '$lib/components/sultanshepard/tour/TourBudget.svelte';
	import ProductionGrid from '$lib/components/sultanshepard/tour/ProductionGrid.svelte';
	import SettingsModal from '$lib/components/sultanshepard/tour/SettingsModal.svelte';

	// Type order for same-day sorting
	const TYPE_ORDER: Record<string, number> = {
		'Travel Day': 0,
		Pickup: 1,
		Dropoff: 2,
		'Tour Date': 3,
		Other: 4,
		'Tour Break': 5
	};

	// Data State
	let loading = true;
	let tours: SSTour[] = [];
	let tourDates: SSTourDate[] = [];
	let dateInitialType = 'Tour Date';

	// App-wide settings/crew (shared with sections)
	let crew: SSCrew[] = [];
	let riders: RidersSettings | null = null;
	let merchDefaults: MerchDefaultItem[] = [];
	let tracklist: TracklistTrack[] = [];
	let localCrewTemplate: { qty: number; role: string }[] = [];

	// Selection State
	let selectedTourId: string | null = null;
	let selectedDateId: string | null = null;

	// Tab data for the selected date
	let tourData: SSTourData | null = null;
	let activeTabId: string | null = 'map';
	let middleDisplay: TourMiddleDisplay;

	// Modal State
	let showTourModal = false;
	let tourToEdit: SSTour | null = null;
	let showDateModal = false;
	let dateToEdit: SSTourDate | null = null;
	let showSettingsModal = false;
	let realtimeChannel: any;
	let productionGrid: ProductionGrid;
	let pdfDownloading = false;

	async function downloadProductionPdf() {
		if (!productionGrid || pdfDownloading) return;
		pdfDownloading = true;
		try {
			await productionGrid.downloadPdf();
		} finally {
			pdfDownloading = false;
		}
	}

	// Full-page views are toggled via the URL (?view=budget | ?view=production)
	// so a refresh keeps them open. Only one may be active at a time.
	$: activeView = $page.url.searchParams.get('view');
	$: budgetOpen = activeView === 'budget';
	$: productionOpen = activeView === 'production';

	function setView(v: string | null) {
		const url = new URL($page.url);
		if (v) url.searchParams.set('view', v);
		else url.searchParams.delete('view');
		goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
	}
	function toggleBudget() {
		setView(budgetOpen ? null : 'budget');
	}
	function toggleProduction() {
		setView(productionOpen ? null : 'production');
	}

	$: currentTour = tours.find((t) => t.id === selectedTourId) || null;
	$: selectedDate = tourDates.find((d) => d.id === selectedDateId) || null;

	// For the map: Travel Days have no pin, so highlight the linked show instead.
	$: mapSelectedDateId = (() => {
		if (selectedDate?.type === 'Travel Day' && selectedDate?.linked_date_id) {
			return selectedDate.linked_date_id;
		}
		return selectedDateId;
	})();

	// All dates for the current tour — passed to modal for blocking logic
	$: allBookedDates = tourDates.map((d) => d.date);

	// Only Tour Break dates — blocks everything else from sharing that day
	$: tourBreakDates = tourDates.filter((d) => d.type === 'Tour Break').map((d) => d.date);

	// Sorted dates: primary = date asc, secondary = TYPE_ORDER for same-day entries
	$: sortedTourDates = [...tourDates].sort((a, b) => {
		const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
		if (dateDiff !== 0) return dateDiff;
		const aOrder = TYPE_ORDER[a.type ?? 'Tour Date'] ?? 3;
		const bOrder = TYPE_ORDER[b.type ?? 'Tour Date'] ?? 3;
		return aOrder - bOrder;
	});

	$: if (selectedTourId) {
		loadDatesForTour(selectedTourId, true);
	}

	// Sync selection state to the browser's memory automatically
	$: if (typeof window !== 'undefined' && !loading) {
		if (selectedTourId) localStorage.setItem('ss_saved_tour', selectedTourId);
		else localStorage.removeItem('ss_saved_tour');

		if (selectedDateId) localStorage.setItem('ss_saved_date', selectedDateId);
		else localStorage.removeItem('ss_saved_date');

		if (activeTabId) localStorage.setItem('ss_saved_tab', activeTabId);
		else localStorage.removeItem('ss_saved_tab');
	}

	onMount(async () => {
		// Read saved state from the browser before loading
		if (typeof window !== 'undefined') {
			selectedTourId = localStorage.getItem('ss_saved_tour');
			selectedDateId = localStorage.getItem('ss_saved_date');
			activeTabId = localStorage.getItem('ss_saved_tab') || 'map';
		}

		await Promise.all([loadAllTours(true), loadGlobals()]);

		realtimeChannel = supabase
			.channel('tour_sync')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'ss_tour' }, () => {
				loadAllTours(false);
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'ss_tour_dates' }, () => {
				if (selectedTourId) loadDatesForTour(selectedTourId, false);
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'ss_crew' }, () => {
				loadCrew();
			})
			.subscribe();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
	});

	async function loadAllTours(showSpinner = true) {
		if (showSpinner) loading = true;
		try {
			tours = await fetchTours();
			// Validate if the loaded tour ID still exists (in case it was deleted by another user)
			const tourExists = tours.find((t) => t.id === selectedTourId);

			if (tours.length > 0 && (!selectedTourId || !tourExists)) {
				selectedTourId = tours[0].id;
			} else if (tours.length === 0) {
				selectedTourId = null;
				tourDates = [];
			}
		} catch (error) {
			console.error('Failed to load tours:', error);
		} finally {
			if (showSpinner) loading = false;
		}
	}

	async function loadDatesForTour(tourId: string, showSpinner = true) {
		try {
			const dates = await fetchTourDates(tourId);
			tourDates = [...dates];

			if (selectedDateId && !dates.find((d) => d.id === selectedDateId)) {
				selectedDateId = null;
			}
		} catch (error) {
			console.error('Failed to load tour dates:', error);
			tourDates = [];
		}
	}

	async function loadCrew() {
		try {
			crew = await fetchCrew();
		} catch (e) {
			console.error('Failed to load crew:', e);
		}
	}

	async function loadGlobals() {
		try {
			const [c, r, m, t, lct] = await Promise.all([
				fetchCrew(),
				getSetting<RidersSettings | null>('riders', null),
				getSetting<MerchDefaultItem[]>('merch_defaults', []),
				getSetting<TracklistTrack[]>('tracklist', []),
				getSetting<{ qty: number; role: string }[]>('local_crew_template', [])
			]);
			crew = c;
			riders = r;
			merchDefaults = m;
			tracklist = t;
			localCrewTemplate = lct;
		} catch (e) {
			console.error('Failed to load settings/crew:', e);
		}
	}

	// --- Event Handlers --- //
	function openAddTour() {
		tourToEdit = null;
		showTourModal = true;
	}

	function openEditTour() {
		tourToEdit = currentTour;
		showTourModal = true;
	}

	function handleTourSaved(event: CustomEvent<{ tour: SSTour }>) {
		if (event.detail && event.detail.tour) selectedTourId = event.detail.tour.id;
		loadAllTours();
	}

	function handleTourDeleted() {
		selectedTourId = null;
		loadAllTours();
	}

	function openAddDate(event: CustomEvent<{ type?: string }>) {
		dateToEdit = null;
		dateInitialType = event?.detail?.type || 'Tour Date';
		showDateModal = true;
	}

	function openEditDate(event: CustomEvent<{ date: SSTourDate }>) {
		dateToEdit = event.detail.date;
		dateInitialType = event.detail.date.type || 'Tour Date';
		showDateModal = true;
	}

	function handleDateSaved() {
		if (selectedTourId) loadDatesForTour(selectedTourId);
	}

	function handleDateDeleted() {
		selectedDateId = null;
		if (selectedTourId) loadDatesForTour(selectedTourId);
	}

	function handleSelectTab(event: CustomEvent<string>) {
		activeTabId = event.detail;
		middleDisplay?.scrollTo(event.detail);
	}

	function handleBudgetSaved() {
		loadAllTours(false);
	}

	function goBack() {
		if (budgetOpen || productionOpen) {
			setView(null);
		} else {
			goto('/sultanshepard/djshow');
		}
	}
</script>

<svelte:head>
	<title>S+S Tour</title>
</svelte:head>

<MainLayout pageTitle="Sultan + Shepard Tour">
	<div class="flex flex-col h-full min-h-0 w-full max-w-[1800px] mx-auto p-6 gap-6">
		<div class="flex items-center justify-between shrink-0 gap-4">
			<Button variant="gray" on:click={goBack}>
				<span class="flex items-center gap-2">
					<svg
						class="w-3 h-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
					</svg>
					Go Back
				</span>
			</Button>

			<div class="flex items-center gap-3">
				{#if currentTour}
					{#if productionOpen}
						<button
							class="h-8 w-8 flex items-center justify-center rounded-full border border-white/20 text-white hover:border-lime hover:text-lime transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait disabled:hover:border-white/20 disabled:hover:text-white"
							title="Download PDF"
							aria-label="Download PDF"
							disabled={pdfDownloading}
							on:click={downloadProductionPdf}
						>
							{#if pdfDownloading}
								<svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
							{:else}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
							{/if}
						</button>
					{/if}

					<button
						class="h-8 px-4 flex items-center gap-2 rounded-full border text-sm font-bold transition-colors cursor-pointer {productionOpen
							? 'bg-lime text-black border-lime'
							: 'border-white/20 text-white hover:border-lime hover:text-lime'}"
						on:click={toggleProduction}
					>
						<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
						</svg>
						{productionOpen ? 'Exit Production' : 'Production'}
					</button>

					<button
						class="h-8 px-4 flex items-center gap-2 rounded-full border text-sm font-bold transition-colors cursor-pointer {budgetOpen
							? 'bg-lime text-black border-lime'
							: 'border-white/20 text-white hover:border-lime hover:text-lime'}"
						on:click={toggleBudget}
						>{budgetOpen ? 'Exit Budget' : 'Tour Budget $'}
					</button>
				{/if}

				{#if tours.length > 0}
					<TourDropdown {tours} bind:selectedTourId />
				{/if}

				<button
					class="h-7 px-4 flex items-center justify-center rounded-full text-[14px] leading-[22px] font-bold whitespace-nowrap cursor-pointer transition-all duration-200 ease-in-out bg-lime text-black border-none hover:opacity-90"
					on:click={openAddTour}
				>
					<span class="flex items-center gap-2">
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						Add Tour
					</span>
				</button>

				{#if currentTour}
					<button
						class="h-8 w-8 flex items-center justify-center rounded-full border border-white/20 text-white hover:border-lime hover:text-lime transition-colors cursor-pointer"
						title="Tour settings (edit / delete this tour)"
						aria-label="Tour settings"
						on:click={openEditTour}
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="3" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
							/>
						</svg>
					</button>
				{/if}

				<button
					class="h-8 w-8 flex items-center justify-center rounded-[14px] border border-white/20 text-white hover:border-lime hover:text-lime transition-colors cursor-pointer"
					title="App settings (crew, merch defaults, tracklist, riders)"
					aria-label="App settings"
					on:click={() => (showSettingsModal = true)}
				>
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
						<line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
						<line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
						<line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line
							x1="17"
							y1="16"
							x2="23"
							y2="16"
						/>
					</svg>
				</button>
			</div>
		</div>

		{#if loading}
			<div class="flex-1 flex justify-center items-center">
				<div class="animate-spin w-8 h-8 text-lime">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 12a9 9 0 11-6.219-8.56" />
					</svg>
				</div>
			</div>
		{:else if tours.length === 0}
			<div
				class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-navbar rounded-2xl"
			>
				<h3 class="text-xl font-bold text-white mb-2">No Tours Found</h3>
				<p class="text-gray2 text-base max-w-md">
					You haven't created any tours yet. Click "Add Tour" in the top right to get started.
				</p>
			</div>
		{:else if productionOpen && currentTour}
			<div
				class="flex-1 min-h-0 overflow-hidden"
				in:scale={{ start: 0.96, opacity: 0, duration: 240, easing: cubicOut }}
				out:fade={{ duration: 110 }}
			>
				<ProductionGrid
					bind:this={productionGrid}
					tour={currentTour}
					tourDates={sortedTourDates}
					on:close={toggleProduction}
				/>
			</div>
		{:else if budgetOpen && currentTour}
			<div
				class="flex-1 min-h-0 overflow-hidden"
				in:scale={{ start: 0.96, opacity: 0, duration: 240, easing: cubicOut }}
				out:fade={{ duration: 110 }}
			>
				<TourBudget
					tour={currentTour}
					tourDates={sortedTourDates}
					on:saved={handleBudgetSaved}
					on:close={toggleBudget}
				/>
			</div>
		{:else}
			<div class="flex flex-col md:flex-row gap-6 flex-1 min-h-0 overflow-hidden">
				<div
					class="w-full md:w-[290px] lg:w-[250px] 2xl:w-[270px] shrink-0 flex flex-col min-h-0 transition-all duration-300"
				>
					<TourDatesList
						dates={sortedTourDates}
						bind:selectedDateId
						on:addDate={openAddDate}
						on:editDate={openEditDate}
					/>
				</div>

				<div class="flex-1 min-w-0 flex flex-col min-h-0">
					<TourMiddleDisplay
						bind:this={middleDisplay}
						{currentTour}
						tourDates={sortedTourDates}
						bind:selectedDateId
						{mapSelectedDateId}
						bind:tourData
						bind:activeTabId
						{crew}
						{riders}
						{merchDefaults}
						{tracklist}
						{localCrewTemplate}
					/>
				</div>

				<div
					class="w-full md:w-[88px] 2xl:w-[220px] shrink-0 flex flex-col min-h-0 transition-all duration-300"
				>
					<TourTabsPanel
						{selectedDate}
						{tourData}
						{crew}
						{activeTabId}
						on:selectTab={handleSelectTab}
					/>
				</div>
			</div>
		{/if}
	</div>
</MainLayout>

<TourModal
	bind:isOpen={showTourModal}
	tour={tourToEdit}
	on:close={() => {
		showTourModal = false;
		tourToEdit = null;
	}}
	on:save={handleTourSaved}
	on:delete={handleTourDeleted}
/>

{#if currentTour}
	<TourDateModal
		bind:isOpen={showDateModal}
		initialType={dateInitialType}
		tourId={currentTour.id}
		tourDate={dateToEdit}
		tourStartDate={currentTour.start_date}
		tourEndDate={currentTour.end_date}
		bookedDates={allBookedDates}
		{tourBreakDates}
		allDates={sortedTourDates}
		on:close={() => {
			showDateModal = false;
			dateToEdit = null;
		}}
		on:save={handleDateSaved}
		on:delete={handleDateDeleted}
	/>
{/if}

<SettingsModal
	bind:open={showSettingsModal}
	bind:crew
	bind:riders
	bind:merchDefaults
	bind:tracklist
	bind:localCrewTemplate
/>