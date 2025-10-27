<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import { advanceSettings } from '$lib/components/settings/AdvanceVariables';
	import type { EventAdvance } from '$lib/types/events';

	export let event: EventAdvance;

	interface GroundTransfer {
		id: number;
		date: string;
		type: string;
		driverName: string;
		pickupTime: string;
		pickupLocation: string;
		dropoffTime: string;
		dropoffLocation: string;
		paxNames: string;
		flightInfo?: string;
		contact?: string;
		flightDepartureTime?: string;
	}

	// Parse ground transport data
	$: transferData = parseGroundTransport(event.ground_transport);
	// Filter out N/A drivers
	$: filteredTransferData = transferData.filter((t) => t.driverName !== 'N/A');
	$: transferGroups = groupTransfersByType(filteredTransferData);
	$: uniqueDrivers = getUniqueDrivers(filteredTransferData);

	function parseGroundTransport(groundTransport: any): GroundTransfer[] {
		if (!groundTransport) return [];

		try {
			// If it's already an array, return it
			if (Array.isArray(groundTransport)) return groundTransport;

			// If it's a string, parse it
			if (typeof groundTransport === 'string') {
				return JSON.parse(groundTransport);
			}

			return [];
		} catch (error) {
			console.error('Error parsing ground transport:', error);
			return [];
		}
	}

	// Format date to "Oct-4" format
	function formatDate(dateString: string): string {
		try {
			const [year, month, day] = dateString.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
			return `${monthShort}-${day}`;
		} catch (error) {
			return dateString;
		}
	}

	// Format time from 24h to 12h format (no space before AM/PM)
	function formatTime(time24: string): string {
		if (!time24) return '';
		try {
			const [hours, minutes] = time24.split(':');
			const hour = parseInt(hours);
			const ampm = hour >= 12 ? 'PM' : 'AM';
			const hour12 = hour % 12 || 12;
			return `${hour12}:${minutes}${ampm}`;
		} catch (error) {
			return time24;
		}
	}

	// Group transfers by type
	function groupTransfersByType(transfers: GroundTransfer[]) {
		const groups = new Map<string, GroundTransfer[]>();

		transfers.forEach((transfer) => {
			let groupKey = transfer.type;

			// Group Show and Post Show together
			if (transfer.type === 'Show' || transfer.type === 'Post Show') {
				groupKey = 'Show Transfers';
			}
			// Group Soundcheck and Post SC together
			else if (
				transfer.type === 'Soundcheck' ||
				transfer.type === 'Post-SC' ||
				transfer.type === 'Post SC'
			) {
				groupKey = 'Soundcheck Transfers';
			}
			// Keep Arrival and Departure separate
			else if (transfer.type === 'Arrival') {
				groupKey = 'Airport Transfers - Arrival';
			} else if (transfer.type === 'Departure') {
				groupKey = 'Airport Transfers - Departure';
			}

			if (!groups.has(groupKey)) {
				groups.set(groupKey, []);
			}
			groups.get(groupKey)!.push(transfer);
		});

		// Define display order
		const displayOrder = [
			'Airport Transfers - Arrival',
			'Soundcheck Transfers',
			'Show Transfers',
			'Airport Transfers - Departure'
		];

		const sortedGroups: { title: string; transfers: GroundTransfer[] }[] = [];
		displayOrder.forEach((title) => {
			if (groups.has(title)) {
				sortedGroups.push({
					title,
					transfers: groups.get(title)!
				});
			}
		});

		return sortedGroups;
	}

	// Get unique drivers with their contact info (excluding UBER and N/A)
	function getUniqueDrivers(transfers: GroundTransfer[]) {
		const driverSet = new Set<string>();
		transfers.forEach((t) => {
			if (t.driverName && t.driverName !== 'UBER' && t.driverName !== 'N/A') {
				driverSet.add(t.driverName);
			}
		});

		return Array.from(driverSet).map((driverName) => ({
			name: driverName,
			phone: advanceSettings.drivers[driverName] || 'N/A'
		}));
	}

	// Check if UBER is used in any transfer (excluding N/A)
	$: hasUber = filteredTransferData.some((t) => t.driverName === 'UBER');

	// Count number of passengers (count commas + 1)
	function countPax(paxNames: string): number {
		if (!paxNames) return 0;
		return paxNames.split('+').length;
	}

	// Extract flight number only (last part after the last space)
	function extractFlightNumber(flightInfo?: string): string {
		if (!flightInfo) return '';
		// Remove route part (everything before and including ">"), then trim
		const withoutRoute = flightInfo.split('>').pop() || '';
		// Take everything after the last space to get just the flight number
		const parts = withoutRoute.trim().split(' ');
		return parts[parts.length - 1] || '';
	}
</script>

{#if filteredTransferData.length > 0}
	<Section title="GROUND TRANSFERS">
		<div class="space-y-4">
			<ContentBox class="!bg-black/15">
				<div>
					<h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-2">Information</h3>
					<div class="space-y-1 text-sm">
						{#each uniqueDrivers as driver}
							<div class="text-gray2">
								<span class="font-bold text-white">Driver:</span>
								{driver.name} - {driver.phone}
							</div>
						{/each}
						<div class="text-gray2">
							<span class="font-bold text-white">Vehicle:</span>
							{advanceSettings.vehicle}
						</div>
						{#if hasUber}
							<div class="text-gray2 pt-2">
								<span class="font-bold text-white">UBER:</span>
								{advanceSettings.drivers['UBER']}
							</div>
						{/if}
					</div>
				</div>
			</ContentBox>

			<ContentBox class="!bg-black/15">
				<div class="space-y-6">
					{#each transferGroups as group}
						<div>
							<h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-3">
								{group.title}
							</h3>
							<table class="w-full text-xs">
								<thead>
									<tr class="border-b border-gray2/20 whitespace-nowrap">
										<th class="py-2 pr-2 text-gray2 uppercase tracking-wider text-left w-[15%]"
											>Name</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[13%]"
											>Date</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[10%]"
											>Time</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-center w-[5%]"
											># PAX</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[14%]"
											>From</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[14%]"
											>To</th
										>
										<th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[10%]"
											>Driver</th
										>
										<th class="py-2 pl-2 text-gray2 uppercase tracking-wider text-left w-[19%]"
											>Notes</th
										>
									</tr>
								</thead>
								<tbody class="whitespace-nowrap">
									{#each group.transfers as transfer}
										<tr class="border-b border-gray2/10">
											<td class="py-2 pr-2 text-white">{transfer.paxNames}</td>
											<td class="py-2 px-2 text-white">{formatDate(transfer.date)}</td>
											<td class="py-2 px-2 text-white">{formatTime(transfer.pickupTime)}</td>
											<td class="py-2 px-2 text-white text-center">{countPax(transfer.paxNames)}</td
											>
											<td class="py-2 px-2 text-white">{transfer.pickupLocation}</td>
											<td class="py-2 px-2 text-white">{transfer.dropoffLocation}</td>
											<td class="py-2 px-2 text-white">{transfer.driverName}</td>
											<td class="py-2 pl-2 text-white"
												>{extractFlightNumber(transfer.flightInfo)}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>
			</ContentBox>
		</div>
	</Section>
{/if}