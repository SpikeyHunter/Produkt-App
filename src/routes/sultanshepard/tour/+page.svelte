<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import type { SSTour, SSTourDate } from '$lib/types/tour';
	import { fetchTours, fetchTourDates } from '$lib/services/tourService';

	// UI Components
	import TourDatesList from '$lib/components/sultanshepard/tour/TourDatesList.svelte';
	import TourMiddleDisplay from '$lib/components/sultanshepard/tour/TourMiddleDisplay.svelte';
	import TourToolsPanel from '$lib/components/sultanshepard/tour/TourToolsPanel.svelte';

	// Merged Modals
	import TourModal from '$lib/components/sultanshepard/tour/TourModal.svelte';
	import TourDateModal from '$lib/components/sultanshepard/tour/TourDateModal.svelte';

	// Data State
	let loading = true;
	let tours: SSTour[] = [];
	let tourDates: SSTourDate[] = [];

	// Selection State
	let selectedTourId: string | null = null;
	let selectedDateId: string | null = null;

	// Modal State
	let showTourModal = false;
	let tourToEdit: SSTour | null = null;
	let showDateModal = false;
	let dateToEdit: SSTourDate | null = null;

	let realtimeChannel: any;

	$: currentTour = tours.find((t) => t.id === selectedTourId) || null;

	$: if (selectedTourId) {
		loadDatesForTour(selectedTourId, true);
	}

	onMount(async () => {
		await loadAllTours(true);

		realtimeChannel = supabase
			.channel('tour_sync')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'ss_tour' }, () => {
				loadAllTours(false);
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'ss_tour_dates' }, () => {
				if (selectedTourId) loadDatesForTour(selectedTourId, false);
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

			if (tours.length > 0 && !selectedTourId) {
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
			tourDates = [...dates]; // spread to ensure Svelte detects the change

			if (selectedDateId && !dates.find((d) => d.id === selectedDateId)) {
				selectedDateId = null;
			}
		} catch (error) {
			console.error('Failed to load tour dates:', error);
			tourDates = [];
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

	function openAddDate() {
		dateToEdit = null;
		showDateModal = true;
	}
	function openEditDate(event: CustomEvent<{ date: SSTourDate }>) {
		dateToEdit = event.detail.date;
		showDateModal = true;
	}
	function handleDateSaved() {
		if (selectedTourId) loadDatesForTour(selectedTourId);
	}
	function handleDateDeleted() {
		selectedDateId = null;
		if (selectedTourId) loadDatesForTour(selectedTourId);
	}
</script>

<svelte:head>
	<title>Sultan + Shepard | Tour Management</title>
</svelte:head>

<MainLayout pageTitle="Sultan + Shepard Tour">
	<div class="p-6 h-[calc(100vh-80px)] max-w-[1800px] mx-auto flex flex-col gap-6">
		<div class="flex items-center justify-between shrink-0">
			<Button variant="gray" on:click={() => goto('/sultanshepard/djshow')}>
				<span class="flex items-center gap-2">
					<svg
						class="w-3 h-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg
					>
					Go Back
				</span>
			</Button>

			<div class="flex items-center gap-4">
				{#if tours.length > 0}
					<div class="relative">
						<select
							bind:value={selectedTourId}
							class="appearance-none bg-transparent border border-white/20 text-white rounded-[14px] h-8 pl-4 pr-10 text-sm font-bold focus:outline-none focus:border-lime cursor-pointer"
						>
							{#each tours as tour}
								<option class="bg-[#1a1a1a] text-white" value={tour.id}
									>{tour.year} - {tour.name}</option
								>
							{/each}
						</select>
						<svg
							class="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray2 pointer-events-none"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg
						>
					</div>
				{/if}

				<button
					class="h-8 px-4 flex items-center justify-center rounded-[14px] text-[14px] leading-[22px] font-bold whitespace-nowrap cursor-pointer transition-all duration-200 ease-in-out bg-lime text-black border-none hover:opacity-90"
					on:click={openAddTour}
				>
					<span class="flex items-center gap-2">
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg
						>
						Add Tour
					</span>
				</button>
			</div>
		</div>

		{#if loading}
			<div class="flex-1 flex justify-center items-center">
				<div class="animate-spin w-8 h-8 text-lime">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M21 12a9 9 0 11-6.219-8.56" /></svg
					>
				</div>
			</div>
		{:else if tours.length === 0}
			<div
				class="flex-1 flex flex-col items-center justify-center text-center p-8 bg-navbar rounded-2xl"
			>
				<div class="w-16 h-16 mx-auto mb-4 text-gray2 opacity-50">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
						><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12z" /><line
							x1="4"
							y1="22"
							x2="4"
							y2="15"
						/></svg
					>
				</div>
				<h3 class="text-xl font-bold text-white mb-2">No Tours Found</h3>
				<p class="text-gray2 text-base max-w-md">
					You haven't created any tours yet. Click "Add Tour" in the top right to get started.
				</p>
			</div>
		{:else}
			<div class="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
				<div class="w-full md:w-[250px] shrink-0 h-full min-h-0">
					<TourDatesList
						dates={tourDates}
						bind:selectedDateId
						on:addDate={openAddDate}
						on:editDate={openEditDate}
					/>
				</div>

				<div class="flex-1 min-w-0 h-full min-h-0">
					<!-- FIX: tourDates is now passed down to TourMiddleDisplay -->
					<TourMiddleDisplay {currentTour} {tourDates} />
				</div>

				<div class="w-full md:w-[220px] shrink-0 h-full min-h-0">
					<TourToolsPanel on:editSettings={openEditTour} />
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
		tourId={currentTour.id}
		tourDate={dateToEdit}
		tourStartDate={currentTour.start_date}
		tourEndDate={currentTour.end_date}
		bookedDates={tourDates.map((d) => d.date)}
		on:close={() => {
			showDateModal = false;
			dateToEdit = null;
		}}
		on:save={handleDateSaved}
		on:delete={handleDateDeleted}
	/>
{/if}