<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelector from '$lib/components/ncgapp/controlcenter/EventSelector.svelte';
	import EventCarouselManager from '$lib/components/ncgapp/controlcenter/EventCarouselManager.svelte';
	import EventModifier from '$lib/components/ncgapp/controlcenter/EventModifier.svelte';
	import EventAnnouncement from '$lib/components/ncgapp/controlcenter/EventAnnouncement.svelte';
	import EventGiveaway from '$lib/components/ncgapp/controlcenter/EventGiveaway.svelte';
	import { addEventToCarousel } from '$lib/services/controlCenterService';
	import type { UpcomingEvent, SourceEvent } from '$lib/types/controlcenter';

	let carouselEvents: UpcomingEvent[] = [];
	let excludeEventIds: number[] = [];
	let selectedEvent: UpcomingEvent | null = null;
	let adding = false;
	let mounted = false;
	let carouselManager: EventCarouselManager;

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
	});

	async function handleAddEvent(event: CustomEvent<SourceEvent>) {
		const sourceEvent = event.detail;
		adding = true;

		const newEvent = await addEventToCarousel(sourceEvent);
		if (newEvent) {
			carouselEvents = [...carouselEvents, newEvent];
			excludeEventIds = [...excludeEventIds, newEvent.event_id];
		}

		adding = false;
	}

	function handleEventsLoaded(event: CustomEvent<UpcomingEvent[]>) {
		carouselEvents = event.detail;
		excludeEventIds = event.detail.map((e) => e.event_id);
	}

	function handleSelectEvent(event: CustomEvent<UpcomingEvent | null>) {
		selectedEvent = event.detail;
	}

	async function handleEventUpdated() {
		if (carouselManager) {
			await carouselManager.refreshCurrentEvent();
		}
	}
</script>

<svelte:head>
	<title>Control Center - NCG</title>
</svelte:head>

<MainLayout pageTitle="Control Center" requiredPermission="ControlCenter">
	<div class="page-wrapper">
		<div class="control-center-container fade-in {mounted ? 'mounted' : ''}">
			<!-- First Row -->
			<div class="selector-column">
				<EventSelector {excludeEventIds} on:add={handleAddEvent} />
			</div>

			<div class="carousel-column">
				<EventCarouselManager
					bind:this={carouselManager}
					bind:events={carouselEvents}
					on:eventsLoaded={handleEventsLoaded}
					on:select={handleSelectEvent}
					on:addFromSource={handleAddEvent}
				/>
			</div>

			<div class="modifier-column">
				<EventModifier {selectedEvent} on:updated={handleEventUpdated} />
			</div>

			<!-- Second Row -->
			<div class="announcement-column">
				<EventAnnouncement />
			</div>

			<div class="giveaway-column">
				<EventGiveaway />
			</div>
		</div>
	</div>

	{#if adding}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-navbar border-2 border-lime rounded-xl p-6 flex flex-col items-center gap-3">
				<div
					class="animate-spin w-8 h-8 border-3 border-lime border-t-transparent rounded-full"
				></div>
				<p class="text-white text-sm font-bold">Adding event...</p>
			</div>
		</div>
	{/if}
</MainLayout>

<style>
	.page-wrapper {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 1.5rem;
	}

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

	.control-center-container {
		display: grid;
		grid-template-columns: 280px 1fr 280px;
		grid-template-rows: 415px 415px;
		gap: 16px;
		width: 100%;
	}

	.selector-column {
		grid-column: 1;
		grid-row: 1;
		height: 415px;
		max-height: 415px;
		min-height: 415px;
		overflow: hidden;
		width: 280px;
		min-width: 280px;
		max-width: 280px;
	}

	.carousel-column {
		grid-column: 2;
		grid-row: 1;
		height: 415px;
		max-height: 415px;
		min-height: 415px;
		overflow: hidden;
	}

	.modifier-column {
		grid-column: 3;
		grid-row: 1;
		height: 415px;
		max-height: 415px;
		min-height: 415px;
		overflow: hidden;
		width: 280px;
		min-width: 280px;
		max-width: 280px;
	}

	.announcement-column {
		grid-column: 1;
		grid-row: 2;
		height: 415px;
		max-height: 415px;
		min-height: 415px;
		overflow: hidden;
		width: 280px;
		min-width: 280px;
		max-width: 280px;
	}

	.giveaway-column {
		grid-column: 2;
		grid-row: 2;
		height: 415px;
		max-height: 415px;
		min-height: 415px;
		overflow: hidden;
		width: 280px;
		min-width: 280px;
		max-width: 280px;
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

	@media (max-width: 1415px) {
		.control-center-container {
			grid-template-columns: 280px 1fr 280px;
			grid-template-rows: 415px 415px;
		}

		.selector-column,
		.carousel-column,
		.modifier-column,
		.announcement-column,
		.giveaway-column {
			height: 415px;
			max-height: 415px;
		}
	}
</style>