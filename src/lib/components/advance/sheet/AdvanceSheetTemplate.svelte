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
	import TechHospitality from './sections/TechHospitality.svelte';
	import type { EventAdvance } from '$lib/types/events';

	interface TimetableEntry {
		id: string;
		time: string;
		artist: string;
		notes: string;
		status: string;
		length: string;
	}

	interface Role {
		id: string;
		firstName: string;
		lastName: string;
		role: string;
		customRole: string;
		immigration: boolean;
		showDropdown: boolean;
	}
	
	// Section visibility toggles
	export let showArtistItinerary = true;
	export let showContact = true;
	export let showHotel = true;
	export let showImmigration = true;
	export let showRunningOrder = true;
	export let showMeetGreet = true;
	export let showGroundTransfers = true;
	export let showHouseRules = true;
	export let showTechHospitality = true;

	// Event data prop (can include timetable)
	export let event: EventAdvance & { timetable?: TimetableEntry[] | null };

	// Template variables derived from event data
	$: artistName = event?.artist_name || 'ARTIST NAME';
	$: venueName = event?.event_venue || 'VENUE NAME';
	$: eventDate = event?.event_date || 'DATE';

	// Check if any role has immigration enabled
	$: hasImmigrationNeeded = (() => {
		if (!event?.roles) return false;
		try {
			const roles: Role[] = typeof event.roles === 'string' 
				? JSON.parse(event.roles) 
				: event.roles;
			return roles.some(role => role.immigration === true);
		} catch (e) {
			console.error('Error parsing roles:', e);
			return false;
		}
	})();
</script>

<div
	id="sheet-to-print"
	class="bg-gray1 text-white pb-2 font-helvetica"
	style="width: 8.5in; min-height: 11in;"
>
	<SheetHeader {artistName} {venueName} {eventDate} />

	<div class="px-8 py-6 space-y-5">
		{#if showArtistItinerary} <Itinerary {event} /> {/if}
		{#if showContact} <Contact {event} /> {/if}
		{#if showHotel && event.hotel_enabled} <Hotel {event} /> {/if}
		{#if showImmigration && hasImmigrationNeeded} <Immigration /> {/if}

		<div class="grid grid-cols-2 gap-5">
			{#if showRunningOrder}
				<RunningOrder {event} />
			{/if}
			{#if showMeetGreet}
				<MeetGreet {event} />
			{/if}
		</div>

		{#if showGroundTransfers} <GroundTransfers {event} /> {/if}
		{#if showTechHospitality} <TechHospitality {event} /> {/if}
		{#if showHouseRules} <HouseRules event={event} />{/if}
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