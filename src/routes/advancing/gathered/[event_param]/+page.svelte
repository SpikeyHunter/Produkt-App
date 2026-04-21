<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import AdvanceEvent from '$lib/components/advance/AdvanceInfo.svelte';
	import AdvanceProgress from '$lib/components/advance/AdvanceProgress.svelte';
	import AdvanceTools from '$lib/components/advance/AdvanceTools.svelte';
	import AdvanceEmail from '$lib/components/advance/AdvanceEmail.svelte';
	import AdvanceSetTimes from '$lib/components/advance/AdvanceSetTimes.svelte';
	import AdvanceProduction from '$lib/components/advance/AdvanceProduction.svelte';
	import AdvanceHospo from '$lib/components/advance/AdvanceHospo.svelte';
	import AdvanceTech from '$lib/components/advance/AdvanceTech.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { fetchEventById } from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';
	import type { EventAdvance, TimetableEntry } from '$lib/services/eventsService.js';

	let mounted = false;
	let loading = true;
	let error: string | null = null;
	let event: (EventAdvance & { timetable?: TimetableEntry[] | null }) | null = null;
	$: event_id = $page.params.event_param;
	let timetableKey = 1;
	let advanceEmailRef: any;

	async function handleContactChanged(e: CustomEvent) {
		if (event) {
			event.main_contact = e.detail.mainContact;
			event = { ...event };
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
		if (advanceEmailRef) {
			advanceEmailRef.recheckCanGenerate();
		}
	}

	onMount(async () => {
		setTimeout(() => (mounted = true), 150);
		if (event_id) {
			await loadEvent(event_id);
		} else {
			error = 'No event ID provided';
			loading = false;
		}
	});

	async function loadEvent(id: string, showLoadingState = true) {
		try {
			if (showLoadingState) loading = true;
			error = null;
			const eventData = await fetchEventById(id);

			if (eventData) {
				const numericEventId = eventData.event_id;
				const { data: timetableData, error: timetableError } = await supabase
					.from('events')
					.select('timetable, timetable_active')
					.eq('event_id', numericEventId)
					.single();

				if (!timetableError && timetableData) {
					event = {
						...eventData,
						timetable: timetableData.timetable,
						timetable_active: timetableData.timetable_active
					};
				} else {
					event = {
						...eventData,
						timetable: null,
						timetable_active: false
					};
				}
			} else {
				event = null;
			}
		} catch (err) {
			console.error('💥 Failed to load event:', err);
			error = 'Failed to load event. Please try again.';
			event = null;
		} finally {
			if (showLoadingState) loading = false;
		}
	}

	async function handleGoBack() {
		if (!event) {
			goto('/advancing/gathered');
			return;
		}
		const params = new URLSearchParams();
		if (event.event_status === 'PAST') params.set('live', 'false');
		if (event.artist_type === 'Local') params.set('local', 'true');
		
		const url = params.toString() ? `/advancing/gathered?${params.toString()}` : '/advancing/gathered';
		goto(url);
	}

	async function handleAdvanceInfoUpdate(e: CustomEvent) {
		const updatedEvent = e.detail.event;
		const valueToSave = updatedEvent.main_contact === '' ? null : updatedEvent.main_contact;
		const updateObject = { main_contact: valueToSave };
		await supabase.from('events').update(updateObject).eq('id', updatedEvent.id);
	}

	async function handleColumnUpdate(updateEvent: CustomEvent) {
		if (event) {
			const { columns, value } = updateEvent.detail;
			for (const column of columns) {
				(event as any)[column] = value;
			}
			event = { ...event };
		}
	}

	function handleFieldUpdate(updateEvent: CustomEvent) {
		if (event) {
			const { column, value } = updateEvent.detail;
			if (column) {
				(event as any)[column] = value;
				event = { ...event };
			}
		}
	}

	async function handleDataRefresh() {
		if (event) await loadEvent(event.id, false);
		else if (event_id) await loadEvent(event_id, false);
	}

	async function handleTimetableUpdate() {
		await handleDataRefresh();
		timetableKey += 1;
	}
    
	async function handleDataChanged(e: CustomEvent) {
		const updatedEventFromChild = e.detail;
		if (updatedEventFromChild && typeof updatedEventFromChild === 'object' && updatedEventFromChild.id) {
			event = updatedEventFromChild;
		} else {
			await handleDataRefresh();
		}
	}
</script>

<svelte:head>
	<title>{event ? `${event.artist_name} - Advance` : 'Event Details'}</title>
</svelte:head>

<MainLayout pageTitle="Advance Details">
	<div class="h-full overflow-y-auto overflow-x-hidden">
		<div class="page-container">
			<div class="fade-in {mounted ? 'mounted' : ''} mb-4" style="transition-delay: 0.1s;">
				<Button variant="gray" on:click={handleGoBack}>
					<span class="flex items-center gap-2">
						<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
						Go Back
					</span>
				</Button>
			</div>

			{#if loading}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-8 h-8 mb-4 animate-spin">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
					</div>
					<p class="text-gray2 text-base">Loading event details...</p>
				</div>
			{:else if error}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-16 h-16 mb-4 text-red-500">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
					</div>
					<h3 class="text-xl font-bold text-white mb-2">Error Loading Event</h3>
					<p class="text-gray2 text-base mb-6">{error}</p>
					<Button variant="filled" on:click={() => { if (event_id) loadEvent(event_id, true); }}>
						<span class="flex items-center gap-2">Retry</span>
					</Button>
				</div>
			{:else if event}
				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					<div class="cards-container">
						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.3s;">
							<AdvanceEvent {event} on:update={handleAdvanceInfoUpdate} on:contactChanged={handleContactChanged} />
						</div>

						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.35s;">
							<AdvanceProgress {event} on:columnUpdate={handleColumnUpdate} />
						</div>

						{#key timetableKey}
							<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.5s;">
								<AdvanceSetTimes {event} on:timetableUpdate={handleTimetableUpdate} />
							</div>
						{/key}
						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.4s;">
							<AdvanceTools {event} on:fieldUpdate={handleFieldUpdate} on:datachanged={handleDataChanged} />
						</div>
						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.55s;">
							<AdvanceProduction {event} on:datachanged={handleDataChanged} />
						</div>

						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.6s;">
							<AdvanceHospo {event} on:datachanged={handleDataChanged} />
						</div>

						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.65s;">
							<AdvanceTech {event} on:datachanged={handleDataChanged} />
						</div>

						<div class="fade-in {mounted ? 'mounted' : ''} card-item" style="transition-delay: 0.7s;">
							<AdvanceEmail bind:this={advanceEmailRef} {event} on:datachanged={handleDataChanged} />
						</div>
					</div>
				</div>
			{:else}
				<div class="text-center text-gray2 py-16">Event Not Found</div>
			{/if}
		</div>
	</div>
</MainLayout>

<style>
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
		padding: 20px;
		max-width: none;
		width: 100%;
		height: 100%;
		transition: all 0.3s ease;
	}
	
    /* --- FIXED LAYOUT CSS --- */
	.cards-container {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		width: 100%;
		align-items: flex-start; /* Prevents vertical stretching */
		justify-content: flex-start;
	}

    /* Enforce strict non-growing behavior */
	.card-item {
		flex: 0 0 auto; /* Do not grow, do not shrink */
		width: auto;    /* Take the width of the inner component */
        height: auto;
        max-width: 100%; /* Prevent horizontal overflow on tiny screens */
	}

	@media (max-width: 900px) {
		.cards-container {
			flex-direction: column;
			align-items: center; /* Center cards on mobile, DO NOT STRETCH */
		}
        /* Ensure items don't stretch even on mobile */
		.card-item {
			flex: 0 0 auto;
            width: auto;
		}
	}

	@media (min-width: 2400px) {
		.page-container {
			max-width: 2200px;
			margin: 0 auto;
		}
	}
</style>