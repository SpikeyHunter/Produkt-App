<script lang="ts">
	import SheetHeader from './SheetHeader.svelte';
	import Itinerary from './sections/Itinerary.svelte';
	import Contact from './sections/Contact.svelte';
	import Hotel from './sections/Hotel.svelte';
	import Immigration from './sections/Immigration.svelte';
	import RunningOrder from './sections/RunningOrder.svelte';
	import MeetGreet from './sections/MeetGreet.svelte';
	import GroundTransfers from './sections/GroundTransfers.svelte';
	import HouseRules from './sections/HouseRules.svelte';
	
	// Section visibility toggles
	export let showArtistItinerary = true;
	export let showContact = true;
	export let showHotel = true;
	export let showImmigration = true;
	export let showRunningOrder = true;
	export let showMeetGreet = true;
	export let showGroundTransfers = true;
	export let showHouseRules = true;

	// Corrected: Template variables are now exported props
	export let artistName = 'ARTIST NAME';
	export let venueName = 'VENUE NAME';
	export let eventDate = 'DATE';
</script>

<div
	id="sheet-to-print"
	class="bg-gray1 text-white pb-2 font-helvetica"
	style="width: 8.5in; min-height: 11in;"
>
	<SheetHeader {artistName} {venueName} {eventDate} />

	<div class="px-8 py-6 space-y-5">
		{#if showArtistItinerary} <Itinerary /> {/if}
		{#if showContact} <Contact /> {/if}
		{#if showHotel} <Hotel /> {/if}
		{#if showImmigration} <Immigration /> {/if}

		<div class="grid grid-cols-2 gap-5">
			{#if showRunningOrder}
				<RunningOrder {artistName} />
			{/if}
			{#if showMeetGreet}
				<MeetGreet />
			{/if}
		</div>

		{#if showGroundTransfers} <GroundTransfers /> {/if}
		{#if showHouseRules} <HouseRules /> {/if}
	</div>
</div>

<style>
	/* Styles remain the same */
	@media print {
		@page {
			size: 8.5in 11in;
			margin: 0;
		}
		* {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
	:global(#sheet-to-print .bg-gray1) {
		background-color: #1c1c1e !important;
	}
	:global(#sheet-to-print .text-white) {
		color: #ffffff !important;
	}
</style>