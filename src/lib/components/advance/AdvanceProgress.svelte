<script lang="ts">
	import type { EventAdvance } from '$lib/types/events.js';
	import { onMount, createEventDispatcher } from 'svelte';
	import { fetchMainEvent } from '$lib/services/eventsService.js';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';

	// Props
	export let event: EventAdvance;

	const dispatch = createEventDispatcher();

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

	// Handles updates from the dropdown and updates parent immediately
	function handleFieldUpdate(e: CustomEvent) {
		const { column, value, eventId, artistName } = e.detail;
		
		// Update the local event object immediately
		if (event.event_id === eventId && event.artist_name === artistName) {
			(event as any)[column] = value;
			event = { ...event }; // Force Svelte reactivity
		}
		
		// Notify parent to update its state and recalculate progress
		dispatch('columnUpdate', { 
			columns: [column], 
			value,
			event // Pass the entire updated event
		});
		
		console.log(`AdvanceProgress: Updated ${column} to ${value}, triggering parent update`);
	}

	/**
	 * Safely parses a value that might be a JSON string, an array, or null.
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
	// These will automatically update when event changes

	$: parsedRoles = parseJson(event.roles);
	$: rolesListStatus = Array.isArray(parsedRoles) && parsedRoles.length > 0 ? 'Yes' : 'No';

	$: passportStatus = (() => {
		const roles = parseJson(event.roles);
		if (!Array.isArray(roles) || roles.length === 0) return 'No';

		const peopleRequiringPassports = roles.filter((person: any) => person.immigration === true);
		const requiredPassportCount = peopleRequiringPassports.length;

		if (requiredPassportCount === 0) return 'N/A';

		const passportInfo = parseJson(event.passport_info);
		if (!passportInfo) return 'No';

		const passports = Array.isArray(passportInfo) ? passportInfo : [passportInfo];
		const completePassports = passports.filter(
			(passport: any) =>
				passport.passportNumber &&
				passport.givenName &&
				passport.lastName &&
				passport.dateOfBirth &&
				passport.country
		);
		const completeCount = completePassports.length;

		if (completeCount === 0) return 'No';
		if (completeCount < requiredPassportCount) return 'Waiting';
		if (completeCount >= requiredPassportCount) return 'Yes';

		return 'No';
	})();

	$: rosConfirmedStatus = (() => {
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

	$: flightsStatus = (() => {
		const groundTransport = parseJson(event.ground_transport);
		if (!Array.isArray(groundTransport) || groundTransport.length === 0) return 'No';

		const flights = groundTransport.filter(
			(item: any) => item.type === 'Arrival' || item.type === 'Departure'
		);
		if (flights.length === 0) return 'No';

		const calendarIds = parseJson(event.calendar_event_ids);
		if (!calendarIds || typeof calendarIds !== 'object' || Object.keys(calendarIds).length === 0) {
			return 'Received';
		}

		const allFlightsSynced = flights.every(
			(flight: any) => flight.id && calendarIds.hasOwnProperty(flight.id)
		);
		return allFlightsSynced ? 'Added' : 'Received';
	})();

	$: hotelsStatus = (() => {
		const hotelInfo = parseJson(event.hotel_info);
		if (!hotelInfo || !Array.isArray(hotelInfo) || hotelInfo.length === 0) return 'To Do';

		const allConfirmed = hotelInfo.every(
			(booking) => booking.confirmationNumber && booking.confirmationNumber.trim() !== ''
		);
		return allConfirmed ? 'Confirmed' : 'Waiting';
	})();

	$: riderStatus = (() => {
		const riderFiles = parseJson(event.rider_files);
		if (!riderFiles) return 'No';

		const techRiderUrl = riderFiles.tech_rider_url;
		const hospoRiderUrl = riderFiles.hospo_rider_url;
		const hospitalityIncluded = riderFiles.hospitality_included;

		if (!techRiderUrl || techRiderUrl.trim() === '') return 'No';

		if (hospitalityIncluded === 'No') {
			return !hospoRiderUrl || hospoRiderUrl.trim() === '' ? '1/2' : 'Yes';
		}

		if (hospitalityIncluded === 'Yes' && techRiderUrl && techRiderUrl.trim() !== '') return 'Yes';

		return 'No';
	})();

	$: visualsStatus = (() => {
		if (event.event_venue === 'Bazart') {
			return 'N/A';
		}
		return event.visual_received === true ? 'Yes' : 'No';
	})();

	$: immigrationNeeded = (() => {
		const roles = parseJson(event.roles);
		if (!Array.isArray(roles) || roles.length === 0) return false;
		return roles.some((person: any) => person.immigration === true);
	})();

	function getBadgeColor(status: string): string {
		const normalizedStatus = status ? status.toLowerCase().trim() : 'to do';
		if (
			[ 'yes', 'done', 'confirmed', 'sent', 'added', 'completed' ].includes(normalizedStatus)
		) {
			return 'bg-confirmed text-black';
		}
		if ([ 'no', 'to do', 'todo' ].includes(normalizedStatus)) {
			return 'bg-problem text-black';
		}
		if ([ 'waiting', 'received', '1/2', 'asked' ].includes(normalizedStatus)) {
			return 'bg-tentatif text-black';
		}
		return 'bg-gray2 text-black';
	}
</script>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300"
	style="width: 280px; height: 365px;"
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate">Progress</h2>
	</div>

	<div class="px-6 py-2 h-full">
		<div class="px-2 py-1 flex flex-col gap-2">
			{#if loading}
				<div class="text-gray3 text-sm">Loading...</div>
			{:else}
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Advance Status</span>
					<DropdownButton
						{event}
						options={['To Do', 'Asked', 'Completed']}
						value={event.advance_status || 'To Do'}
						column="advance_status"
						valueType="text"
						buttonClass={getBadgeColor(event.advance_status || 'To Do')}
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
					<span class="font-semibold min-w-[120px] text-gray3">ROS Confirmed</span>
					<div
						class="{getBadgeColor(rosConfirmedStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs"
					>
						<span>{rosConfirmedStatus}</span>
					</div>
				</div>
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Passports</span>
					<div class="{getBadgeColor(passportStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{passportStatus}</span>
					</div>
				</div>
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Immigration</span>
					{#if immigrationNeeded}
						<DropdownButton
							{event}
							options={['To Do', 'Waiting', 'Sent']}
							value={event.immigration_status || 'To Do'}
							column="immigration_status"
							valueType="text"
							buttonClass={getBadgeColor(event.immigration_status || 'To Do')}
							on:fieldUpdate={handleFieldUpdate}
						/>
					{:else}
						<div class="bg-gray2 text-black text-sm rounded-xl px-3 py-1 font-bold text-xs">
							<span>N/A</span>
						</div>
					{/if}
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
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Rider</span>
					<div class="{getBadgeColor(riderStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{riderStatus}</span>
					</div>
				</div>
				<div class="flex items-center gap-3 text-sm">
					<span class="font-semibold min-w-[120px] text-gray3">Visuals</span>
					<div class="{getBadgeColor(visualsStatus)} text-sm rounded-xl px-3 py-1 font-bold text-xs">
						<span>{visualsStatus}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>