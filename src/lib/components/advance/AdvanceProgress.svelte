<script lang="ts">
	import type { EventAdvance } from '$lib/types/events.js';
	import { onMount } from 'svelte';
	import { fetchMainEvent } from '$lib/services/eventsService.js';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';

	// Props
	export let event: EventAdvance;

	// State
	let mainEvent: any = null;
	let loading = true;

	// Fetch main event data on mount
	onMount(async () => {
		if (event.event_id && event.event_id !== -1) {
			mainEvent = await fetchMainEvent(event.event_id);
		}
		loading = false;
	});

	// Handles updates from the dropdown to keep the UI reactive
	function handleFieldUpdate(e: CustomEvent) {
		const { column, value, eventId, artistName } = e.detail;
		
		// Ensure we are updating the correct event in the UI
		if (event.event_id === eventId && event.artist_name === artistName) {
			if (column === 'asked') {
				// Update the local event object to reflect the change immediately
				// The 'value' from the event is the display value ("Yes" or "No")
				event.asked = (value === 'Yes');
			}
		}
	}

	/**
	 * Safely parses a value that might be a JSON string, an array, or null.
	 * @param data The data from the database column.
	 * @returns The parsed data, or an empty array/object if parsing fails or data is null.
	 */
	function parseJson(data: any): any {
		if (!data) return null;
		if (typeof data === 'object') return data;
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch (e) {
				return null;
			}
		}
		return null;
	}

	// --- Reactive Status Computations ---

	$: advanceAskedStatus = event.asked ? 'Yes' : 'No';
	$: parsedRoles = parseJson(event.roles);
	$: rolesListStatus = (Array.isArray(parsedRoles) && parsedRoles.length > 0) ? 'Yes' : 'No';
	
	$: passportStatus = (() => {
		// First, check how many people require immigration (passports)
		const roles = parseJson(event.roles);
		if (!Array.isArray(roles) || roles.length === 0) return 'No';
		
		// Count people who have immigration flag set to true
		const peopleRequiringPassports = roles.filter((person: any) => person.immigration === true);
		const requiredPassportCount = peopleRequiringPassports.length;
		
		// If nobody requires passports, return N/A
		if (requiredPassportCount === 0) return 'N/A';
		
		// Parse passport info
		const passportInfo = parseJson(event.passport_info);
		if (!passportInfo) return 'No';
		
		const passports = Array.isArray(passportInfo) ? passportInfo : [passportInfo];
		
		// Count complete passports (with all required fields)
		const completePassports = passports.filter((passport: any) => 
			passport.passportNumber && 
			passport.givenName && 
			passport.lastName && 
			passport.dateOfBirth && 
			passport.country
		);
		
		const completeCount = completePassports.length;
		
		// Determine status based on completion
		if (completeCount === 0) {
			return 'No';
		} else if (completeCount < requiredPassportCount) {
			return 'Waiting';  // Some passports complete, but not all
		} else if (completeCount >= requiredPassportCount) {
			return 'Yes';  // All required passports are complete
		}
		
		return 'No';
	})();
	
	// FIXED: Check event.timetable first (which gets updated immediately), 
	// then fall back to mainEvent.timetable
	$: rosConfirmedStatus = (() => {
		// First check if the event itself has a timetable (this gets updated by AdvanceSetTimes)
		const timetableToCheck = event.timetable || mainEvent?.timetable;
		
		if (!timetableToCheck || !event.artist_name) return 'No';
		
		const timetable = parseJson(timetableToCheck);
		if (!Array.isArray(timetable)) return 'No';
		
		const isConfirmed = timetable.some((slot: any) => {
			if (!slot.artist || !slot.status) return false;
			const slotArtist = slot.artist.trim().toLowerCase();
			const eventArtist = event.artist_name.trim().toLowerCase();
			return slotArtist === eventArtist && slot.status === 'Confirmed';
		});
		return isConfirmed ? 'Yes' : 'No';
	})();
	
	$: immigrationStatus = '—';
	
	$: flightsStatus = (() => {
		const groundInfo = parseJson(event.ground_info);
		if (!groundInfo) return 'No';
		const hasCompleteArrival = groundInfo.arrivals?.some((arrival: any) => 
			arrival.date && arrival.time && arrival.flightNumber && arrival.from && arrival.to
		);
		const hasCompleteDeparture = groundInfo.departures?.some((departure: any) => 
			departure.date && departure.time && departure.flightNumber && departure.from && departure.to
		);
		if (!hasCompleteArrival || !hasCompleteDeparture) {
			return 'No';
		}
		return event.ground_done === true ? 'Done' : 'Received';
	})();
	
	$: hotelsStatus = (() => {
		// Parse the hotel info with proper handling
		const hotelInfo = parseJson(event.hotel_info);
		
		// Check if no hotels are booked
		if (!hotelInfo || !Array.isArray(hotelInfo) || hotelInfo.length === 0) {
			return 'To Do';
		}
		
		// Check confirmation status for all bookings
		const allConfirmed = hotelInfo.every(
			(booking) => booking.confirmationNumber && booking.confirmationNumber.trim() !== ''
		);
		
		if (allConfirmed) {
			return 'Confirmed';
		}
		
		// Some bookings exist but not all are confirmed
		return 'Waiting';
	})();

	function getBadgeColor(status: string): string {
		const normalizedStatus = status.toLowerCase().trim();
		if (normalizedStatus === 'yes' || normalizedStatus === 'done' || normalizedStatus === 'confirmed') {
			return 'bg-confirmed text-black';
		}
		if (normalizedStatus === 'no' || normalizedStatus === 'to do' || normalizedStatus === 'todo') {
			return 'bg-problem text-black';
		}
		if (normalizedStatus === 'waiting' || normalizedStatus === 'received') {
			return 'bg-tentatif text-black';
		}
		return 'bg-gray2 text-black';
	}
</script>

<div class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300" 
     style="width: 280px; height: 365px;">
	
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate">Progress</h2>
	</div>
	
	<div class="px-6 py-2 h-full">
		<div class="px-2 py-1 flex flex-col gap-3">
			
			{#if loading}
				<div class="text-gray3 text-sm">Loading...</div>
			{:else}
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Advance Asked</span>
					<DropdownButton
						{event}
						options={['Yes', 'No']}
						value={event.asked ? 'Yes' : 'No'}
						column="asked"
						valueType="boolean"
						trueValues={['Yes']}
						falseValues={['No']}
						buttonClass={getBadgeColor(event.asked ? 'Yes' : 'No')}
						on:fieldUpdate={handleFieldUpdate}
					/>
				</div>
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Role List</span>
					<div class="{getBadgeColor(rolesListStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{rolesListStatus}</span>
					</div>
				</div>

				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Passports</span>
					<div class="{getBadgeColor(passportStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{passportStatus}</span>
					</div>
				</div>

				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">ROS Confirmed</span>
					<div class="{getBadgeColor(rosConfirmedStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{rosConfirmedStatus}</span>
					</div>
				</div>

				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Immigration</span>
					<div class="{getBadgeColor(immigrationStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{immigrationStatus}</span>
					</div>
				</div>

				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Flights</span>
					<div class="{getBadgeColor(flightsStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{flightsStatus}</span>
					</div>
				</div>

				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Hotels</span>
					<div class="{getBadgeColor(hotelsStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{hotelsStatus}</span>
					</div>
				</div>
			{/if}
			
		</div>
	</div>
</div>