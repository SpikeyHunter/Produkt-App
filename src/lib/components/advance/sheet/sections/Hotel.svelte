<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import type { EventAdvance } from '$lib/types/events';
	import { advanceSettings } from '$lib/components/settings/AdvanceVariables';

	export let event: EventAdvance;

	// Use the hotel address map from the settings file
	const hotelAddressMap = advanceSettings.hotels;

	interface HotelReservation {
		id: string;
		reservationFirstName: string;
		reservationLastName: string;
		hotelName: string;
		customHotelName?: string;
		customHotelAddress?: string;
		roomType: string;
		checkInDate: string;
		checkInTime?: string;
		checkOutDate: string;
		checkOutTime?: string;
		notes?: string;
		requestEarlyCheckIn?: boolean;
		earlyCheckInTime?: string;
		requestLateCheckOut?: boolean;
		lateCheckOutTime?: string;
		isPaidByUs?: boolean;
		confirmationNumber?: string;
	}

	// Parse hotel info
	$: hotelData = parseHotelInfo(event.hotel_info);
	function parseHotelInfo(hotelInfo: any): HotelReservation[] {
		if (!hotelInfo) return [];
		try {
			if (Array.isArray(hotelInfo)) return hotelInfo;
			if (typeof hotelInfo === 'string') {
				return JSON.parse(hotelInfo);
			}
			return [];
		} catch (error) {
			console.error('Error parsing hotel info:', error);
			return [];
		}
	}

	// Format date to "3-Oct" format
	function formatDate(dateString: string): string {
		try {
			const [year, month, day] = dateString.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
			return `${day}-${monthShort}`;
		} catch (error) {
			return dateString;
		}
	}

	// Group reservations by hotel
	$: hotelGroups = groupByHotel(hotelData);
	function groupByHotel(reservations: HotelReservation[]) {
		const groups = new Map<string, HotelReservation[]>();
		reservations.forEach((res) => {
			const hotelName = res.customHotelName || res.hotelName;
			if (!groups.has(hotelName)) {
				groups.set(hotelName, []);
			}
			groups.get(hotelName)!.push(res);
		});
		return Array.from(groups.entries());
	}

	// Function to get hotel address
	function getHotelAddress(hotelName: string, reservations: HotelReservation[]): string {
		// 1. Prioritize a custom address if it exists
		const customAddress = reservations[0]?.customHotelAddress;
		if (customAddress) {
			return customAddress;
		}
		// 2. Fallback to the predefined map
		return hotelAddressMap[hotelName] || '';
	}

	// Parse notes into array
	function parseNotes(notesString?: string): string[] {
		if (!notesString) return [];
		return notesString.split('\n').filter((note) => note.trim());
	}

	// Get all unique notes from all reservations in a hotel group
	function getHotelNotes(reservations: HotelReservation[]): string[] {
		const allNotes = new Set<string>();
		reservations.forEach((res) => {
			parseNotes(res.notes).forEach((note) => allNotes.add(note));
		});
		return Array.from(allNotes);
	}

	// Check if hotel should show standard notes
	function shouldShowStandardNotes(hotelName: string, reservations: HotelReservation[]): boolean {
		const normalizedName = hotelName.toLowerCase();
		const isCorrectHotel = normalizedName.includes('monville') || 
		                       normalizedName.includes('alt hotel') || 
		                       normalizedName.includes('w hotel');
		
		// Only show if it's the correct hotel AND at least one room is paid by us
		const hasRoomPaidByUs = reservations.some(res => res.isPaidByUs === true);
		
		return isCorrectHotel && hasRoomPaidByUs;
	}
</script>

{#if hotelGroups.length > 0}
	<Section title="HOTEL ACCOMMODATION">
		{#each hotelGroups as [hotelName, reservations], index}
			{@const address = getHotelAddress(hotelName, reservations)}
			<ContentBox class="!bg-black/15 {index > 0 ? 'mt-4' : ''}">
				<div class="space-y-4">
					<div>
						<div class="mb-1 text-xs uppercase tracking-wider text-gray2">Hotel Name</div>
						<div class="text-xl font-bold text-white">{hotelName}</div>
						{#if address}
							<div class="mt-1 text-sm text-gray2">{address}</div>
						{/if}
					</div>

					<div class="overflow-x-auto border-t border-gray2/20 pt-4">
						<table class="w-full whitespace-nowrap text-left text-sm">
							<thead>
								<tr class="border-b border-gray2/20">
									<th
										class="py-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray2"
									>
										{reservations.length > 1 ? 'Names' : 'Name'}
									</th>
									<th
										class="px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray2"
										>Confirmation #</th
									>
									<th
										class="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray2"
										>Room Type</th
									>
									<th
										class="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray2"
										>Check-in</th
									>
									<th
										class="py-2 pl-4 text-xs font-medium uppercase tracking-wider text-gray2"
										>Check-out</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray2/20">
								{#each reservations as res}
									<tr>
										<td class="py-2 pr-4 text-white"
											>{res.reservationFirstName} {res.reservationLastName}</td
										>
										<td class="px-3 py-2 text-white">{res.confirmationNumber || 'N/A'}</td>
										<td class="px-4 py-2 text-white">{res.roomType}</td>
										<td class="px-4 py-2 text-white">{formatDate(res.checkInDate)}</td>
										<td class="py-2 pl-4 text-white">{formatDate(res.checkOutDate)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="border-t border-gray2/20 pt-3">
						<div class="mb-2 text-xs uppercase tracking-wider text-lime">Notes</div>
						<div class="space-y-1 text-sm text-gray2">
							{#each getHotelNotes(reservations) as note}
								<div>• {note}</div>
							{/each}
							{#if shouldShowStandardNotes(hotelName, reservations)}
								<div>
									• {reservations.length > 1 ? 'Rooms' : 'Room'} and taxes are covered by New City Gas
								</div>
								<div>• Credit card must be provided for incidentals</div>
							{/if}
						</div>
					</div>
				</div>
			</ContentBox>
		{/each}
	</Section>
{/if}