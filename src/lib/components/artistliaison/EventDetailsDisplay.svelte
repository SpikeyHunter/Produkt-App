<script lang="ts">
	import { updateEventColumn } from '$lib/services/eventsService';
	import type { EventAdvance } from '$lib/types/events';
	import { advanceSettings } from '$lib/components/settings/AdvanceVariables';

	export let selectedEvent: any = null;

	let artistDetails: EventAdvance[] = [];
	let loading = false;
	let foodBuyoutData: Record<string, any> = {};
	let liaisonNotes: Record<string, string> = {};
	let savingStates: Record<string, boolean> = {};

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
		checkOutDate: string;
		confirmationNumber?: string;
		notes?: string;
	}

	interface GroundTransfer {
		id: number;
		date: string;
		type: string;
		driverName: string;
		pickupTime: string;
		pickupLocation: string;
		dropoffLocation: string;
		paxNames: string;
		flightInfo?: string;
	}

	interface TimetableEntry {
		id: string;
		time: string;
		artist: string;
		notes: string;
		status: string;
		length: string;
	}

	$: if (selectedEvent) {
		loadArtistDetails();
	}

	async function loadArtistDetails() {
		if (!selectedEvent) {
			artistDetails = [];
			return;
		}

		loading = true;
		artistDetails = selectedEvent.advances || [];

		artistDetails.forEach((artist) => {
			const artistKey = `${artist.event_id}-${artist.artist_name}`;
			if (!foodBuyoutData[artistKey]) {
				foodBuyoutData[artistKey] = { type: null, details: '' };
			}
			foodBuyoutData[artistKey] = parseJsonData(artist.food_buyout) || { type: null, details: '' };
			liaisonNotes[artistKey] = artist.liaison_notes || '';
		});

		foodBuyoutData = { ...foodBuyoutData };
		liaisonNotes = { ...liaisonNotes };

		loading = false;
	}

	function parseJsonData(data: any): any {
		if (!data) return null;
		if (typeof data === 'object') return data;
		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}

	async function saveFoodBuyout(artistKey: string) {
		savingStates[artistKey] = true;
		try {
			await updateEventColumn(artistKey, 'food_buyout', JSON.stringify(foodBuyoutData[artistKey]));
		} catch (error) {
			console.error('Error saving food buyout:', error);
		} finally {
			savingStates[artistKey] = false;
		}
	}

	async function saveLiaisonNotes(artistKey: string) {
		savingStates[artistKey] = true;
		try {
			await updateEventColumn(artistKey, 'liaison_notes', liaisonNotes[artistKey]);
		} catch (error) {
			console.error('Error saving liaison notes:', error);
		} finally {
			savingStates[artistKey] = false;
		}
	}

	function formatEventDateFull(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
			const day = date.getDate();
			const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
			return `${months[date.getMonth()]} ${day}${suffix} ${date.getFullYear()}`;
		} catch {
			return dateString;
		}
	}

	function getTransferTypeColor(type: string): string {
		const lowerType = type.toLowerCase();
		if (lowerType === 'show' || lowerType === 'post show') return '#FCA5A5';
		else if (lowerType === 'arrival' || lowerType === 'departure') return '#93C5FD';
		else if (lowerType === 'soundcheck' || lowerType === 'post sc' || lowerType === 'post-sc') return '#C4B5FD';
		return '#6B7280';
	}

	function formatHotelDate(dateString: string): string {
		try {
			const [year, month, day] = dateString.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
			return `${day}-${monthShort}`;
		} catch {
			return dateString;
		}
	}

	function formatTime(time24: string): string {
		if (!time24) return '';
		try {
			const [hours, minutes] = time24.split(':');
			const hour = parseInt(hours);
			const ampm = hour >= 12 ? 'PM' : 'AM';
			const hour12 = hour % 12 || 12;
			return `${hour12}:${minutes}${ampm}`;
		} catch {
			return time24;
		}
	}

	$: allHotelReservations = artistDetails.flatMap((artist) => {
		const reservations: HotelReservation[] = parseJsonData(artist.hotel_info) || [];
		return reservations.map((res) => ({
			...res,
			artist_name: artist.artist_name,
			notes: res.notes || ''
		}));
	});

	$: hotelGroups = ((): [string, (HotelReservation & { artist_name: string })[]][] => {
		const groups = new Map<string, (HotelReservation & { artist_name: string })[]>();
		allHotelReservations.forEach((res) => {
			const hotelName = res.customHotelName || res.hotelName;
			if (!groups.has(hotelName)) {
				groups.set(hotelName, []);
			}
			groups.get(hotelName)!.push(res);
		});
		return Array.from(groups.entries());
	})();

	function getHotelAddress(hotelName: string, reservations: HotelReservation[]): string {
		const customAddress = reservations[0]?.customHotelAddress;
		if (customAddress) return customAddress;
		return hotelAddressMap[hotelName] || '';
	}

	$: allGroundTransfers = (() => {
		const transfers = artistDetails.flatMap((artist) => {
			const groundData: GroundTransfer[] = parseJsonData(artist.ground_transport) || [];
			return groundData.map((t) => ({ ...t, artist_name: artist.artist_name }));
		});
		return transfers.sort((a, b) => {
			if (a.date < b.date) return -1;
			if (a.date > b.date) return 1;
			if (a.pickupTime < b.pickupTime) return -1;
			if (a.pickupTime > b.pickupTime) return 1;
			return 0;
		});
	})();

	function formatGroundDate(dateString: string): string {
		try {
			const [year, month, day] = dateString.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
			return `${monthShort}-${day}`;
		} catch {
			return dateString;
		}
	}

	function extractFlightNumber(flightInfo?: string): string {
		if (!flightInfo) return '';
		const withoutRoute = flightInfo.split('>').pop() || '';
		const parts = withoutRoute.trim().split(' ');
		return parts[parts.length - 1] || '';
	}

	$: soundcheckEntries = (selectedEvent?.timetable || [])
		.filter((item: TimetableEntry) => item.artist.toLowerCase().includes('soundcheck'))
		.sort((a: TimetableEntry, b: TimetableEntry) => (a.time < b.time ? -1 : 1));

	function formatSoundcheckTime(entry: TimetableEntry): string {
		if (!entry.length) return formatTime(entry.time);
		try {
			const [startHours, startMins] = entry.time.split(':').map(Number);
			const lengthMins = parseInt(entry.length, 10);
			const startDate = new Date(0, 0, 0, startHours, startMins);
			const endDate = new Date(startDate.getTime() + lengthMins * 60000);
			const endHours = endDate.getHours();
			const endMins = endDate.getMinutes().toString().padStart(2, '0');
			const endAmpm = endHours >= 12 ? 'PM' : 'AM';
			const endHour12 = endHours % 12 || 12;
			return `${formatTime(entry.time)} - ${endHour12}:${endMins}${endAmpm}`;
		} catch {
			return formatTime(entry.time);
		}
	}

	function getTechRiderSummary(techRider: any): string[] {
		const data = parseJsonData(techRider);
		if (!data) return [];
		const items: string[] = [];
		if (data.selected_mixer) items.push(`1x ${data.selected_mixer}`);
		if (data.equipment) {
			Object.entries(data.equipment).forEach(([key, value]: [string, any]) => {
				if (value.selected) {
					items.push(`${value.qty}x ${key}`);
				}
			});
		}
		if (data.other && data.other.length > 0) {
			data.other.forEach((item: { text: string }) => items.push(item.text));
		}
		return items.sort((a, b) => {
			const getPriority = (item: string) => {
				const lowerItem = item.toLowerCase();
				if (lowerItem.includes('djm') || lowerItem.includes('mixer')) return 1;
				if (lowerItem.includes('cdj')) return 2;
				if (lowerItem.includes('rmx-1000') || lowerItem.includes('rmx 1000')) return 3;
				if (lowerItem.includes('mic') || lowerItem.includes('microphone')) return 4;
				return 5;
			};
			const priorityA = getPriority(a);
			const priorityB = getPriority(b);
			if (priorityA !== priorityB) return priorityA - priorityB;
			return a.localeCompare(b);
		});
	}

	$: allBackline = artistDetails.map((artist) => ({
		artist_name: artist.artist_name,
		items: getTechRiderSummary(artist.tech_rider)
	}));

	$: backlineFormatted = (() => {
		if (allBackline.length === 0) return [];
		const itemToArtists = new Map<string, string[]>();
		allBackline.forEach((artist) => {
			artist.items.forEach((item) => {
				if (!itemToArtists.has(item)) {
					itemToArtists.set(item, []);
				}
				itemToArtists.get(item)!.push(artist.artist_name);
			});
		});
		return Array.from(itemToArtists.entries()).map(([item, artists]) => {
			if (artists.length === allBackline.length) {
				return item;
			} else {
				return `${item} (${artists.join(', ')})`;
			}
		});
	})();

	$: hasBackline = allBackline.some((artist) => artist.items.length > 0);

	function getSfxSummary(sfxRider: any): string[] {
		const sfxData = parseJsonData(sfxRider);
		if (!sfxData) return [];
		const items: string[] = [];
		if (sfxData.cryo_jets?.enabled) {
			const duration = parseInt(sfxData.cryo_jets.duration, 10);
			items.push(`${sfxData.cryo_jets.qty}x Cryo Jets ${duration === 0 ? '- Empty Tanks' : `(CO2) - ${duration}sec`}`);
		}
		if (sfxData.sparkulars?.enabled) {
			const duration = parseInt(sfxData.sparkulars.duration, 10);
			items.push(`${sfxData.sparkulars.qty}x Sparkulars ${duration === 0 ? '- Empty Reservoir' : `- ${duration}sec`}`);
		}
		if (sfxData.lasers?.enabled) {
			items.push(`${sfxData.lasers.qty}x Lasers`);
		}
		if (sfxData.other && sfxData.other.length > 0) {
			sfxData.other.forEach((item: { text: string }) => items.push(item.text));
		}
		return items;
	}

	$: allSfx = artistDetails.map((artist) => ({
		artist_name: artist.artist_name,
		items: getSfxSummary(artist.sfx_rider)
	})).filter((artist) => artist.items.length > 0);

	function getGuestlistSummary(guestlist: any): string {
		const data = parseJsonData(guestlist);
		if (!data) return '';
		const parts: string[] = [];
		if (data.vip > 0) parts.push(`${data.vip}x VIP`);
		if (data.ga > 0) parts.push(`${data.ga}x GA`);
		return parts.join(' + ');
	}

	$: allGuestlists = artistDetails.map((artist) => ({
		artist_name: artist.artist_name,
		summary: getGuestlistSummary(artist.guestlist)
	})).filter((artist) => artist.summary);

	function getMeetGreetSummary(meetGreetInfo: any, enabled: boolean | null | undefined): string {
		if (!enabled) return 'Not Required';
		const data = parseJsonData(meetGreetInfo);
		if (!data) return 'TBD';
		return `${formatTime(data.time)} - ${data.peopleCount} people`;
	}

	$: hasMeetAndGreet = artistDetails.some((artist) => artist.meetgreet_enabled);

	$: allMeetAndGreets = artistDetails.filter((artist) => artist.meetgreet_enabled).map((artist) => ({
		artist_name: artist.artist_name,
		summary: getMeetGreetSummary(artist.meetgreet_info, artist.meetgreet_enabled)
	}));

	function getHospitalityItems(hospoRider: any): string[] {
		const hospoData = parseJsonData(hospoRider);
		if (!hospoData) return [];
		const items: string[] = [];
		if (hospoData.spirits) {
			Object.entries(hospoData.spirits).forEach(([name, details]: [string, any]) => {
				if (details.selected) items.push(`${details.qty}x ${name}`);
			});
		}
		if (hospoData.beers_wine?.beers) {
			Object.entries(hospoData.beers_wine.beers).forEach(([name, details]: [string, any]) => {
				if (details.selected) items.push(`${details.qty}x ${name}`);
			});
		}
		if (hospoData.beers_wine?.wine) {
			Object.entries(hospoData.beers_wine.wine).forEach(([name, details]: [string, any]) => {
				if (details.selected) items.push(`${details.qty}x ${name}`);
			});
		}
		if (hospoData.beers_wine?.juice) {
			Object.entries(hospoData.beers_wine.juice).forEach(([name, details]: [string, any]) => {
				if (details.selected) items.push(`${details.qty}x ${name}`);
			});
		}
		if (hospoData.other_drinks) {
			Object.entries(hospoData.other_drinks).forEach(([name, details]: [string, any]) => {
				if (details.selected) items.push(`${details.qty}x ${name}`);
			});
		}
		if (hospoData.custom_requests && hospoData.custom_requests.length > 0) {
			hospoData.custom_requests.forEach((item: { text: string }) => items.push(item.text));
		}
		return items;
	}

	function getSoundcheckForArtist(artistName: string): string {
		const entry = soundcheckEntries.find((e: TimetableEntry) => 
			e.artist.toLowerCase().replace('soundcheck', '').trim() === artistName.toLowerCase()
		);
		return entry ? formatSoundcheckTime(entry) : 'N/A';
	}

	$: timetableEntries = selectedEvent?.timetable ? 
		(Array.isArray(selectedEvent.timetable) ? 
			selectedEvent.timetable.filter((item: TimetableEntry) => item.status !== 'Default') : 
			[]) : [];
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	{#if !selectedEvent}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg class="w-16 h-16 text-gray2 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="7" width="18" height="10" rx="2" ry="2"></rect>
					<line x1="8" y1="21" x2="16" y2="21"></line>
					<line x1="12" y1="17" x2="12" y2="21"></line>
				</svg>
				<h3 class="text-white text-lg font-bold mb-2">No Event Selected</h3>
				<p class="text-gray2 text-sm">Select a completed event from the list to view details</p>
			</div>
		</div>
	{:else}
		<div class="p-4 border-b border-gray1 flex-shrink-0">
			<h2 class="text-white text-xl font-bold">
				Artist Liaison - {selectedEvent.event_name} - {formatEventDateFull(selectedEvent.event_date)}
			</h2>
		</div>

		<div class="flex-1 overflow-y-auto p-4 custom-scroll space-y-4">
			{#if loading}
				<div class="space-y-3">
					{#each Array(3) as _}
						<div class="animate-pulse h-48 bg-gray1 rounded-lg"></div>
					{/each}
				</div>
			{:else if artistDetails.length > 0}
				{#if hotelGroups.length > 0}
					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">
							{hotelGroups.length > 1 ? 'Hotels' : 'Hotel'}
						</h3>
						{#each hotelGroups as [hotelName, reservations]}
							{@const address = getHotelAddress(hotelName, reservations)}
							{@const hotelNotes = reservations.filter((res) => res.notes && res.notes.trim() !== '').map((res) => res.notes!.trim())}
							<div class="mb-4">
								<h4 class="text-lime text-sm font-bold">{hotelName}</h4>
								{#if address}
									<p class="text-xs text-gray2 mb-2">{address}</p>
								{/if}
								<table class="w-full text-xs">
									<thead>
										<tr class="border-b border-gray2/20">
											<th class="py-1 text-gray2 uppercase tracking-wider text-left w-1/5">Guest</th>
											<th class="py-1 text-gray2 uppercase tracking-wider text-left w-1/5">Conf #</th>
											<th class="py-1 text-gray2 uppercase tracking-wider text-left w-1/5">Room</th>
											<th class="py-1 text-gray2 uppercase tracking-wider text-left w-1/5">Check-in</th>
											<th class="py-1 text-gray2 uppercase tracking-wider text-left w-1/5">Check-out</th>
										</tr>
									</thead>
									<tbody>
										{#each reservations as res}
											<tr class="border-b border-gray2/10">
												<td class="py-1.5 text-white">{res.reservationFirstName} {res.reservationLastName}</td>
												<td class="py-1.5 text-white">{res.confirmationNumber || 'N/A'}</td>
												<td class="py-1.5 text-white">{res.roomType}</td>
												<td class="py-1.5 text-white">{formatHotelDate(res.checkInDate)}</td>
												<td class="py-1.5 text-white">{formatHotelDate(res.checkOutDate)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
								{#if hotelNotes.length > 0}
									<div class="mt-2 p-2 bg-black/20 rounded">
										<div class="text-xs text-gray2">
											{#each hotelNotes as note}
												{#each note.split('\n') as line}
													<div>• {line}</div>
												{/each}
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if allGroundTransfers.length > 0}
					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Ground Transfers</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="text-gray2 uppercase tracking-wider text-left border-b border-gray2/20">
										<th class="py-2 pr-2 w-24">Type</th>
										<th class="py-2 px-2">Names</th>
										<th class="py-2 px-2">Date</th>
										<th class="py-2 px-2">Time</th>
										<th class="py-2 px-2">From</th>
										<th class="py-2 px-2">To</th>
										<th class="py-2 px-2">Driver</th>
										<th class="py-2 pl-2">Notes</th>
									</tr>
								</thead>
								<tbody>
									{#each allGroundTransfers as transfer}
										<tr class="border-b border-gray2/10">
											<td class="py-2 pr-2 w-24">
												<span class="inline-block px-2 py-1 rounded-full text-xs font-medium text-black" style="background-color: {getTransferTypeColor(transfer.type)}">
													{transfer.type}
												</span>
											</td>
											<td class="py-2 px-2 text-white">{transfer.paxNames}</td>
											<td class="py-2 px-2 text-lime">{formatGroundDate(transfer.date)}</td>
											<td class="py-2 px-2 text-lime">{formatTime(transfer.pickupTime)}</td>
											<td class="py-2 px-2 text-white truncate max-w-[120px]">{transfer.pickupLocation}</td>
											<td class="py-2 px-2 text-white truncate max-w-[120px]">{transfer.dropoffLocation}</td>
											<td class="py-2 px-2 text-white">{transfer.driverName}</td>
											<td class="py-2 pl-2 text-white">{extractFlightNumber(transfer.flightInfo)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				{#if hasBackline || allSfx.length > 0 || allGuestlists.length > 0}
					<div class="grid grid-cols-3 gap-4">
						<div class="bg-gray1 rounded-lg p-4">
							<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Backline</h3>
							{#if hasBackline}
								<div class="text-xs text-white space-y-0.5">
									{#each backlineFormatted as item}
										<div>• {item}</div>
									{/each}
								</div>
							{:else}
								<div class="text-xs text-gray2">None</div>
							{/if}
						</div>

						<div class="bg-gray1 rounded-lg p-4">
							<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">SFX</h3>
							{#if allSfx.length > 0}
								<div class="text-xs text-white space-y-2">
									{#each allSfx as artist}
										<div>
											<div class="font-bold text-lime mb-1">{artist.artist_name}:</div>
											{#each artist.items as item}
												<div class="ml-2">• {item}</div>
											{/each}
										</div>
									{/each}
								</div>
							{:else}
								<div class="text-xs text-gray2">None</div>
							{/if}
						</div>

						<div class="bg-gray1 rounded-lg p-4">
							<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Guestlist</h3>
							{#if allGuestlists.length > 0}
								<div class="text-xs space-y-2">
									{#each allGuestlists as artist}
										<div>
											<div class="text-lime font-bold mb-1">{artist.artist_name}:</div>
											<div class="ml-2 text-white">• {artist.summary}</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="text-xs text-gray2">None</div>
							{/if}
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-3 gap-4">
					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Set Times</h3>
						{#if timetableEntries.length > 0}
							<div class="text-xs text-white space-y-1">
								{#each timetableEntries as entry}
									<div class="flex items-center gap-2">
										<span class="text-lime font-medium w-16">{formatTime(entry.time)}</span>
										<span>{entry.artist}</span>
										{#if entry.length}
											<span class="text-gray2">({entry.length})</span>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-xs text-gray2">None</div>
						{/if}
					</div>

					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Soundcheck</h3>
						<div class="text-xs text-white space-y-2">
							{#each artistDetails as artist}
								<div>
									<div class="font-bold text-lime mb-1">{artist.artist_name}:</div>
									<div class="ml-2">• {getSoundcheckForArtist(artist.artist_name)}</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="bg-gray1 rounded-lg p-4">
						<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Meet & Greet</h3>
						{#if hasMeetAndGreet}
							<div class="text-xs text-white space-y-2">
								{#each allMeetAndGreets as artist}
									<div>
										<div class="font-bold text-lime mb-1">{artist.artist_name}:</div>
										<div class="ml-2">• {artist.summary}</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="text-xs text-gray2">None</div>
						{/if}
					</div>
				</div>

				<div class="bg-gray1 rounded-lg p-4">
					<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Hospitality</h3>
					<div class="grid grid-cols-{artistDetails.length} gap-4">
						{#each artistDetails as artist}
							{@const hospoItems = getHospitalityItems(artist.hospo_rider)}
							<div>
								<h4 class="text-lime font-bold text-sm mb-2">{artist.artist_name}</h4>
								{#if hospoItems.length > 0}
									<div class="text-xs text-white space-y-0.5">
										{#each hospoItems as item}
											<div>• {item}</div>
										{/each}
									</div>
								{:else}
									<div class="text-xs text-gray2">None</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div class="bg-gray1 rounded-lg p-4">
					<h3 class="text-white font-bold text-base mb-3 pb-2 border-b border-gray2/20">Notes</h3>
					<div class="grid grid-cols-1 md:grid-cols-{artistDetails.length <= 2 ? artistDetails.length : 3} gap-4">
						{#each artistDetails as artist}
							{@const artistKey = `${artist.event_id}-${artist.artist_name}`}
							<div class="bg-black/20 rounded-lg p-3 relative">
								<div class="flex justify-between items-start mb-3">
									<h4 class="text-lime font-bold">{artist.artist_name}</h4>
									{#if savingStates[artistKey]}
										<span class="text-lime text-xs">Saving...</span>
									{/if}
								</div>

								<div class="mb-3">
									<div class="flex gap-2 mb-2">
										<label class="flex items-center gap-1 cursor-pointer">
											<input type="radio" name="food-{artistKey}" value="buyout" bind:group={foodBuyoutData[artistKey].type} on:change={() => saveFoodBuyout(artistKey)} class="w-3 h-3 text-lime" />
											<span class="text-xs text-white">Buyout</span>
										</label>
										<label class="flex items-center gap-1 cursor-pointer">
											<input type="radio" name="food-{artistKey}" value="dinner" bind:group={foodBuyoutData[artistKey].type} on:change={() => saveFoodBuyout(artistKey)} class="w-3 h-3 text-lime" />
											<span class="text-xs text-white">Dinner</span>
										</label>
										<label class="flex items-center gap-1 cursor-pointer">
											<input type="radio" name="food-{artistKey}" value="" bind:group={foodBuyoutData[artistKey].type} on:change={() => saveFoodBuyout(artistKey)} class="w-3 h-3 text-lime" />
											<span class="text-xs text-white">None</span>
										</label>
									</div>
									{#if foodBuyoutData[artistKey] && foodBuyoutData[artistKey].type}
										<input type="text" placeholder="Details..." bind:value={foodBuyoutData[artistKey].details} on:blur={() => saveFoodBuyout(artistKey)} class="w-full bg-gray1 text-white text-xs rounded px-2 py-1 placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
									{/if}
								</div>

								<div class="border-t border-gray2/20 pt-3">
									<h5 class="text-xs text-gray2 mb-1">Notes</h5>
									<textarea placeholder="Additional notes..." bind:value={liaisonNotes[artistKey]} on:blur={() => saveLiaisonNotes(artistKey)} class="w-full bg-gray1 text-white text-xs rounded px-2 py-1 placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime resize-none" rows="3"></textarea>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<p class="text-gray2 text-sm text-center">No artist details available</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}

	input[type='radio'] {
		accent-color: #e1ff00;
	}

	textarea {
		min-height: 60px;
	}
</style>