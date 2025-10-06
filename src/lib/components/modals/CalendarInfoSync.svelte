<script lang="ts">
	import Modal from './Modal.svelte';
	import DatePicker from '../buttons/DatePicker.svelte';
	import DatePickerCompact from '../buttons/DatePickerCompact.svelte';
	import Button from '../buttons/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import { updateEventAdvance, type EventAdvance } from '../../services/eventsService';
	import { getAirportCodeSet } from '../../services/constants';
	import { subHours, roundToNearestMinutes } from 'date-fns';
	import { isDaylightSavingTime } from '../../utils/timezoneUtils';

	export let isOpen = false;
	export let event: EventAdvance;

	$: artistName = event ? event.artist_name : 'Artist Name';
	$: roles = event?.roles
		? typeof event.roles === 'string'
			? JSON.parse(event.roles)
			: event.roles
		: [];
	$: roleNames = roles.map((r: any) => `${r.firstName} ${r.lastName}`);
	$: flightsEnabled = event?.flights_enabled !== false;

	const dispatch = createEventDispatcher();
	let isSaving = false;

	function handleClose() {
		dispatch('close');
	}

	async function toggleFlightsEnabled() {
		if (isSaving) return;

		isSaving = true;
		try {
			const newFlightsEnabled = !flightsEnabled;
			await updateEventAdvance(event.event_id, event.artist_name, {
				flights_enabled: newFlightsEnabled
			});

			event = { ...event, flights_enabled: newFlightsEnabled };

			console.log(`Flights enabled toggled to: ${newFlightsEnabled}`);
		} catch (error) {
			console.error('Failed to toggle flights enabled:', error);
		} finally {
			isSaving = false;
		}
	}

	type Flight = {
		id: number;
		flightNumber: string;
		date: string;
		from: string;
		to: string;
		time: string;
		timeAtAirport?: string;
		hoursBeforeDeparture?: number;
		assignedRoles?: string[];
		isEditable?: boolean;
	};

	let arrivals: Flight[] = [];
	let departures: Flight[] = [];
	let arrivalFlightDate = '';
	let arrivalFlightNumber = '';
	let departureFlightDate = '';
	let departureFlightNumber = '';
	let isSearchingArrival = false;
	let isSearchingDeparture = false;
	let arrivalSearchError = '';
	let departureSearchError = '';

	$: if (isOpen && event) {
		arrivalFlightDate = '';
		arrivalFlightNumber = '';
		departureFlightDate = '';
		departureFlightNumber = '';
		arrivalSearchError = '';
		departureSearchError = '';

		let info = event.ground_info;
		if (info) {
			if (typeof info === 'string') {
				try {
					info = JSON.parse(info);
				} catch (e) {
					console.error('Failed to parse ground_info:', e);
					info = {};
				}
			}
			const loadedArrivals = Array.isArray(info.arrivals)
				? JSON.parse(JSON.stringify(info.arrivals))
				: [];
			const loadedDepartures = Array.isArray(info.departures)
				? JSON.parse(JSON.stringify(info.departures))
				: [];
			arrivals = loadedArrivals.map((flight: Flight) => ({
				...flight,
				assignedRoles: flight.assignedRoles?.length ? flight.assignedRoles : [...roleNames]
			}));
			departures = loadedDepartures.map((flight: Flight) => {
				const hours =
					flight.hoursBeforeDeparture || getDefaultHoursBeforeDeparture(flight.from, flight.to);
				return {
					...flight,
					hoursBeforeDeparture: hours,
					timeAtAirport: flight.timeAtAirport || calculateTimeAtAirport(flight.time, hours),
					assignedRoles: flight.assignedRoles?.length ? flight.assignedRoles : [...roleNames]
				};
			});
		} else {
			arrivals = [];
			departures = [];
		}
	}

	function removeArrival(id: number) {
		arrivals = arrivals.filter((flight) => flight.id !== id);
	}

	function removeDeparture(id: number) {
		departures = departures.filter((flight) => flight.id !== id);
	}

	function addManualFlight(type: 'arrival' | 'departure') {
		const defaultDate = event.event_date
			? event.event_date
			: new Date().toISOString().split('T')[0];
		const defaultTime = '12:00';

		const newFlightBase = {
			id: Date.now(),
			flightNumber: '',
			from: '',
			to: '',
			time: toEasternISO(defaultDate, defaultTime),
			assignedRoles: [...roleNames],
			isEditable: true
		};

		if (type === 'arrival') {
			const newArrival: Flight = {
				...newFlightBase,
				date: defaultDate
			};
			arrivals = [newArrival, ...arrivals];
		} else {
			const hours = 3;
			const newDeparture: Flight = {
				...newFlightBase,
				date: defaultDate,
				hoursBeforeDeparture: hours,
				timeAtAirport: calculateTimeAtAirport(newFlightBase.time, hours)
			};
			departures = [newDeparture, ...departures];
		}
	}
	function toEasternISO(dateStr: string, timeStr: string = '12:00'): string {
		const dateObj = new Date(dateStr + 'T12:00:00');
		const isDST = isDaylightSavingTime(dateObj);
		const offset = isDST ? '-04:00' : '-05:00';
		return `${dateStr}T${timeStr}:00${offset}`;
	}

	function getDefaultHoursBeforeDeparture(origin: string, destination: string): number {
		const domesticAirportCodes = getAirportCodeSet();
		const isDomestic = domesticAirportCodes.has(origin) && domesticAirportCodes.has(destination);
		return isDomestic ? 2 : 3;
	}

	function calculateTimeAtAirport(departureTimeISO: string, hoursBeforeDeparture: number): string {
		const hasTimezone =
			departureTimeISO.includes('-', 10) ||
			departureTimeISO.includes('+', 10) ||
			departureTimeISO.endsWith('Z');

		let dateStr: string;
		let timeStr: string;

		if (hasTimezone) {
			const parts = departureTimeISO.split('T');
			dateStr = parts[0];
			const timePart = parts[1].split(/[-+Z]/)[0];
			const [hours, minutes] = timePart.split(':').map((s) => parseInt(s));
			timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		} else {
			const parts = departureTimeISO.split('T');
			dateStr = parts[0];
			const timePart = parts[1].split('.')[0];
			const [hours, minutes] = timePart.split(':').map((s) => parseInt(s));
			timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		}

		const [hours, minutes] = timeStr.split(':').map(Number);
		const totalMinutes = hours * 60 + minutes;
		const minutesBeforeDeparture = hoursBeforeDeparture * 60;
		const airportMinutes = totalMinutes - minutesBeforeDeparture;
		const roundedMinutes = Math.round(airportMinutes / 15) * 15;

		let finalMinutes = roundedMinutes;
		let dayOffset = 0;

		if (roundedMinutes < 0) {
			finalMinutes = roundedMinutes + 24 * 60;
			dayOffset = -1;
		} else if (roundedMinutes >= 24 * 60) {
			finalMinutes = roundedMinutes - 24 * 60;
			dayOffset = 1;
		}

		const airportHours = Math.floor(finalMinutes / 60);
		const airportMins = finalMinutes % 60;
		const airportTimeStr = `${airportHours.toString().padStart(2, '0')}:${airportMins.toString().padStart(2, '0')}`;

		let finalDate = dateStr;
		if (dayOffset !== 0) {
			const date = new Date(dateStr + 'T12:00:00');
			date.setDate(date.getDate() + dayOffset);
			finalDate = date.toISOString().split('T')[0];
		}

		const dateObj = new Date(finalDate + 'T12:00:00');
		const isDST = isDaylightSavingTime(dateObj);
		const offset = isDST ? '-04:00' : '-05:00';

		return `${finalDate}T${airportTimeStr}:00${offset}`;
	}

	function formatHours(hours: number): string {
		const wholeHours = Math.floor(hours);
		const minutes = Math.round((hours - wholeHours) * 60);

		if (minutes === 0) {
			return `${wholeHours}h`;
		} else {
			return `${wholeHours}h${minutes.toString().padStart(2, '0')}`;
		}
	}

	function updateHoursBeforeDeparture(flightId: number, change: number) {
		departures = departures.map((flight) => {
			if (flight.id === flightId) {
				const newHours = Math.max(1, Math.min(6, (flight.hoursBeforeDeparture || 2) + change));
				return {
					...flight,
					hoursBeforeDeparture: newHours,
					timeAtAirport: calculateTimeAtAirport(flight.time, newHours)
				};
			}
			return flight;
		});
	}

	async function findFlight(type: 'arrival' | 'departure') {
		const isArrival = type === 'arrival';
		const flightDate = isArrival ? arrivalFlightDate : departureFlightDate;
		const flightNumber = isArrival ? arrivalFlightNumber : departureFlightNumber;
		const setError = (msg: string) => {
			if (isArrival) arrivalSearchError = msg;
			else departureSearchError = msg;
		};
		const setLoading = (val: boolean) => {
			if (isArrival) isSearchingArrival = val;
			else isSearchingDeparture = val;
		};

		if (!flightDate || !flightNumber) {
			setError('Please provide a date and flight number.');
			return;
		}

		setLoading(true);
		setError('');
		try {
			const response = await fetch(
				`/api/flight-lookup?flightNumber=${flightNumber}&date=${flightDate}`
			);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Could not find flight.');
			}

			if (isArrival) {
				const newArrival: Flight = {
					id: Date.now(),
					flightNumber: data.flightNumber,
					date: flightDate,
					from: data.from,
					to: data.to,
					time: data.arrivalTime,
					assignedRoles: [...roleNames]
				};
				arrivals = [...arrivals, newArrival];
				arrivalFlightDate = '';
				arrivalFlightNumber = '';
			} else {
				const hoursBeforeDeparture = getDefaultHoursBeforeDeparture(data.from, data.to);
				const newDeparture: Flight = {
					id: Date.now(),
					flightNumber: data.flightNumber,
					date: flightDate,
					from: data.from,
					to: data.to,
					time: data.departureTime,
					hoursBeforeDeparture,
					timeAtAirport: calculateTimeAtAirport(data.departureTime, hoursBeforeDeparture),
					assignedRoles: [...roleNames]
				};
				departures = [...departures, newDeparture];
				departureFlightDate = '';
				departureFlightNumber = '';
			}
		} catch (error) {
			setError((error as Error).message);
		} finally {
			setLoading(false);
		}
	}

	function updateFlightInList(
		flightId: number,
		type: 'arrival' | 'departure',
		updateFn: (flight: Flight) => Flight
	) {
		if (type === 'arrival') {
			arrivals = arrivals.map((f) => (f.id === flightId ? updateFn(f) : f));
		} else {
			departures = departures.map((f) => (f.id === flightId ? updateFn(f) : f));
		}
	}

	function removeRoleFromFlight(flightId: number, roleName: string, type: 'arrival' | 'departure') {
		updateFlightInList(flightId, type, (flight) => {
			const currentRoles = flight.assignedRoles || [];
			if (currentRoles.length <= 1) return flight;
			return {
				...flight,
				assignedRoles: currentRoles.filter((r: string) => r !== roleName)
			};
		});
	}

	function addRoleToFlight(flightId: number, roleName: string, type: 'arrival' | 'departure') {
		updateFlightInList(flightId, type, (flight) => {
			const currentRoles = flight.assignedRoles || [];
			if (!currentRoles.includes(roleName)) {
				return { ...flight, assignedRoles: [...currentRoles, roleName] };
			}
			return flight;
		});
	}

	async function handleSave() {
		if (!event) return;
		isSaving = true;
		try {
			const cleanArrivals = arrivals.map(({ isEditable, ...rest }) => rest);
			const cleanDepartures = departures.map(({ isEditable, ...rest }) => rest);
			const groundInfoPayload = { arrivals: cleanArrivals, departures: cleanDepartures };

			await updateEventAdvance(event.event_id, event.artist_name, {
				ground_info: groundInfoPayload
			});
			dispatch('save_success');
			handleClose();
		} catch (error) {
			console.error('Failed to save flight info:', error);
		} finally {
			isSaving = false;
		}
	}

	function formatTime(isoString: string | undefined) {
		if (!isoString) return 'N/A';
		return new Date(isoString).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function formatDate(isoString: string | undefined): string {
		if (!isoString) return 'N/A';
		const date = new Date(isoString);
		const day = date.getDate();
		const month = date.toLocaleString('en-US', { month: 'long' });
		const year = date.getFullYear();
		const getOrdinalSuffix = (d: number) => {
			if (d > 3 && d < 21) return 'th';
			switch (d % 10) {
				case 1:
					return 'st';
				case 2:
					return 'nd';
				case 3:
					return 'rd';
				default:
					return 'th';
			}
		};
		return `${month} ${day}${getOrdinalSuffix(day)} ${year}`;
	}

	function getISODatePart(isoString: string) {
		if (!isoString) return '';
		return isoString.split('T')[0];
	}

	function getISOTimePart(isoString: string) {
		if (!isoString) return '00:00';

		const hasTimezone =
			isoString.includes('-', 10) || isoString.includes('+', 10) || isoString.endsWith('Z');

		if (hasTimezone) {
			const parts = isoString.split('T');
			const timePart = parts[1].split(/[-+Z]/)[0];
			const [hours, minutes] = timePart.split(':').map((s) => parseInt(s));
			return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		} else {
			const parts = isoString.split('T');
			const timePart = parts[1].split('.')[0];
			const [hours, minutes] = timePart.split(':').map((s) => parseInt(s));
			return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		}
	}

	function updateManualFlightDateTime(
		flightId: number,
		part: 'date' | 'time',
		value: string,
		type: 'arrival' | 'departure'
	) {
		const list = type === 'arrival' ? arrivals : departures;
		const flight = list.find((f) => f.id === flightId);
		if (!flight) return;

		const currentDatePart = getISODatePart(flight.time);
		const currentTimePart = getISOTimePart(flight.time);

		const newDate = part === 'date' ? value : currentDatePart;
		const newTime = part === 'time' ? value : currentTimePart;

		const newIsoTime = toEasternISO(newDate, newTime);

		updateFlightInList(flightId, type, (f) => {
			const updatedFlight = {
				...f,
				time: newIsoTime,
				date: newDate // ADD THIS LINE - update the date field too
			};
			if (type === 'departure') {
				updatedFlight.timeAtAirport = calculateTimeAtAirport(
					newIsoTime,
					updatedFlight.hoursBeforeDeparture || 2
				);
			}
			return updatedFlight;
		});
	}
</script>

<Modal
	{isOpen}
	on:close={handleClose}
	title="Flight Info - {artistName}"
	maxWidth="max-w-4xl"
	hasFooter={true}
>
	<div class="relative">
		<div class="grid grid-cols-2 gap-4 {!flightsEnabled ? 'opacity-20 blur-sm' : ''}">
			<div class="space-y-4">
				<h2 class="text-xl font-bold text-white flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 text-lime"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 14l-7 7m0 0l-7-7m7 7V3"
						/>
					</svg>
					Arrivals
				</h2>

				<div class="p-4 bg-gray1 rounded-lg">
					<div class="space-y-3">
						<label>
							<span class="text-xs text-gray2 block mb-1">Date</span>
							<DatePicker bind:value={arrivalFlightDate} placeholder="Set Date" />
						</label>
						<div>
							<label for="arrivalFlightNumber" class="text-xs text-gray2 block mt-2 mb-1"
								>Flight Number</label
							>
							<input
								type="text"
								bind:value={arrivalFlightNumber}
								placeholder="e.g., AC123"
								class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:ring-lime focus:border-lime px-3 py-2"
								id="arrivalFlightNumber"
							/>
						</div>
						<Button
							on:click={() => findFlight('arrival')}
							disabled={isSearchingArrival}
							width="w-full"
						>
							{isSearchingArrival ? 'Detecting...' : 'Detect Arrival'}
						</Button>
						<p class="text-center text-xs pt-1.5">
							<button
								on:click={() => addManualFlight('arrival')}
								class="text-gray2 hover:cursor-pointer hover:text-lime transition-colors underline"
							>
								or add manually
							</button>
						</p>
					</div>
					{#if arrivalSearchError}
						<p class="text-problem text-sm mt-2 text-center">{arrivalSearchError}</p>
					{/if}
				</div>

				<div class="p-4 bg-gray1 rounded-lg space-y-3">
					{#if arrivals.length === 0}
						<p class="text-gray2 text-sm text-center py-8">No arrival flights detected.</p>
					{/if}
					{#each arrivals as flight (flight.id)}
						{@const availableRoles = roleNames.filter(
							(name: string) => !(flight.assignedRoles || []).includes(name)
						)}
						{@const inputStyles =
							'h-9 w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:ring-lime focus:border-lime px-3 py-2'}
						<div
							in:fly={{ y: 10, duration: 200 }}
							class="p-3 bg-navbar rounded-lg border border-gray2/20 space-y-3"
						>
							{#if flight.isEditable}
								<div class="space-y-0">
									<div class="flex justify-between items-start">
										<div></div>
										<button
											on:click={() => removeArrival(flight.id)}
											class="text-gray2 hover:text-red-400 hover:cursor-pointer p-1 -mr-1 rounded-full transition-colors"
											aria-label="Remove arrival flight"
										>
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
												<polyline points="3 6 5 6 21 6" />
												<path
													d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
												/>
											</svg>
										</button>
									</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="col-span-2">
											<label
												for="flight-number-arr-{flight.id}"
												class="text-xs text-gray2 block mb-1">Flight Number</label
											>
											<input
												type="text"
												bind:value={flight.flightNumber}
												placeholder="e.g., AC123"
												class={inputStyles}
												id="flight-number-arr-{flight.id}"
											/>
										</div>
										<div>
											<label for="from-arr-{flight.id}" class="text-xs text-gray2 block mb-1"
												>From</label
											>
											<input
												type="text"
												bind:value={flight.from}
												placeholder="YYZ"
												class="{inputStyles} uppercase"
												id="from-arr-{flight.id}"
											/>
										</div>
										<div>
											<label for="to-arr-{flight.id}" class="text-xs text-gray2 block mb-1"
												>To</label
											>
											<input
												type="text"
												bind:value={flight.to}
												placeholder="YUL"
												class="{inputStyles} uppercase"
												id="to-arr-{flight.id}"
											/>
										</div>
										<div>
											<label class="text-xs text-gray2 block">
												<span class="mb-1 block">Arrival Date</span>
												<DatePickerCompact
													height="h-9"
													value={getISODatePart(flight.time)}
													on:change={(e) =>
														updateManualFlightDateTime(flight.id, 'date', e.detail, 'arrival')}
												/>
											</label>
										</div>
										<div>
											<label for="arr-time-{flight.id}" class="text-xs text-gray2 block mb-1"
												>Arrival Time</label
											>
											<input
												type="time"
												id="arr-time-{flight.id}"
												value={getISOTimePart(flight.time)}
												on:input={(e) =>
													updateManualFlightDateTime(
														flight.id,
														'time',
														e.currentTarget.value,
														'arrival'
													)}
												class={inputStyles}
											/>
										</div>
									</div>
								</div>
							{:else}
								<div class="flex items-start justify-between">
									<div class="flex flex-col gap-1">
										<div class="font-bold text-white text-lg">{flight.flightNumber}</div>
										<div class="flex items-center gap-2 text-sm">
											<span class="font-mono bg-gray2/20 px-2 py-1 rounded text-white"
												>{flight.from}</span
											>
											<span class="text-gray2">→</span>
											<span class="font-mono bg-gray2/20 px-2 py-1 rounded text-white"
												>{flight.to}</span
											>
										</div>
									</div>
									<button
										on:click={() => removeArrival(flight.id)}
										class="text-gray2 hover:text-red-400 hover:cursor-pointer p-1 rounded-full transition-colors"
										aria-label="Remove arrival flight"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
											<polyline points="3 6 5 6 21 6" />
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									</button>
								</div>
								<div class="text-sm text-white bg-gray1/50 p-2 rounded-md">
									Arrives at <span class="font-semibold text-lime">{formatTime(flight.time)}</span>
									on {formatDate(flight.time)}
								</div>
							{/if}

							<div>
								<div class="text-xs text-gray2 mb-2">Assigned People:</div>
								<div class="flex flex-wrap gap-1 mb-2">
									{#each flight.assignedRoles || [] as roleName}
										<span
											class="inline-flex items-center gap-1.5 px-2 py-1 bg-lime/20 hover:cursor-pointer text-lime text-xs rounded-full"
										>
											{roleName}
											{#if (flight.assignedRoles || []).length > 1}
												<button
													on:click={() => removeRoleFromFlight(flight.id, roleName, 'arrival')}
													class="hover:text-white transition-color hover:cursor-pointer"
													aria-label="Remove {roleName} from flight"
												>
													<svg
														class="h-3 w-3"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											{/if}
										</span>
									{/each}
								</div>

								{#if availableRoles.length > 0}
									<div class="flex flex-wrap gap-1 border-t border-gray2/10 pt-2 mt-2">
										{#each availableRoles as name}
											<button
												on:click={() => addRoleToFlight(flight.id, name, 'arrival')}
												class="px-2 py-1 bg-gray2/20 text-gray2 text-xs rounded-full hover:cursor-pointer hover:bg-lime/20 hover:text-lime transition-colors opacity-60 hover:opacity-100"
											>
												+ {name}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="space-y-4">
				<h2 class="text-xl font-bold text-white flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 text-lime"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 10l7-7m0 0l7 7m-7-7v18"
						/>
					</svg>
					Departures
				</h2>

				<div class="p-4 bg-gray1 rounded-lg">
					<div class="space-y-3">
						<label>
							<span class="text-xs text-gray2 block mb-1">Date</span>
							<DatePicker bind:value={departureFlightDate} placeholder="Set Date" />
						</label>
						<div>
							<label for="departureFlightNumber" class="text-xs text-gray2 block mt-2 mb-1"
								>Flight Number</label
							>
							<input
								type="text"
								bind:value={departureFlightNumber}
								placeholder="e.g., AC123"
								class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:ring-lime focus:border-lime px-3 py-2"
								id="departureFlightNumber"
							/>
						</div>
						<Button
							on:click={() => findFlight('departure')}
							disabled={isSearchingDeparture}
							width="w-full"
						>
							{isSearchingDeparture ? 'Detecting...' : 'Detect Departure'}
						</Button>
						<p class="text-center text-xs pt-1.5">
							<button
								on:click={() => addManualFlight('departure')}
								class="text-gray2 hover:cursor-pointer hover:text-lime transition-colors underline"
							>
								or add manually
							</button>
						</p>
					</div>
					{#if departureSearchError}
						<p class="text-problem text-sm mt-2 text-center">{departureSearchError}</p>
					{/if}
				</div>

				<div class="p-4 bg-gray1 rounded-lg space-y-3">
					{#if departures.length === 0}
						<p class="text-gray2 text-sm text-center py-8">No departure flights detected.</p>
					{/if}
					{#each departures as flight (flight.id)}
						{@const availableRoles = roleNames.filter(
							(name: string) => !(flight.assignedRoles || []).includes(name)
						)}
						{@const inputStyles =
							'h-9 w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:ring-lime focus:border-lime px-3 py-2'}
						<div
							in:fly={{ y: 10, duration: 200 }}
							class="p-3 bg-navbar rounded-lg border border-gray2/20 space-y-3"
						>
							{#if flight.isEditable}
								<div class="space-y-0">
									<div class="flex justify-between items-start">
										<div></div>
										<button
											on:click={() => removeDeparture(flight.id)}
											class="text-gray2 hover:text-red-400 hover:cursor-pointer p-1 -mr-1 rounded-full transition-colors"
											aria-label="Remove departure flight"
										>
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
												<polyline points="3 6 5 6 21 6" />
												<path
													d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
												/>
											</svg>
										</button>
									</div>
									<div class="grid grid-cols-2 gap-2">
										<div class="col-span-2">
											<label
												for="flight-number-dep-{flight.id}"
												class="text-xs text-gray2 block mb-1">Flight Number</label
											>
											<input
												type="text"
												bind:value={flight.flightNumber}
												placeholder="e.g., AC123"
												class={inputStyles}
												id="flight-number-dep-{flight.id}"
											/>
										</div>
										<div>
											<label for="from-dep-{flight.id}" class="text-xs text-gray2 block mb-1"
												>From</label
											>
											<input
												type="text"
												bind:value={flight.from}
												placeholder="YUL"
												class="{inputStyles} uppercase"
												id="from-dep-{flight.id}"
											/>
										</div>
										<div>
											<label for="to-dep-{flight.id}" class="text-xs text-gray2 block mb-1"
												>To</label
											>
											<input
												type="text"
												bind:value={flight.to}
												placeholder="YYZ"
												class="{inputStyles} uppercase"
												id="to-dep-{flight.id}"
											/>
										</div>
										<div>
											<label class="text-xs text-gray2 block">
												<span class="mb-1 block">Departure Date</span>
												<DatePickerCompact
													height="h-9"
													value={getISODatePart(flight.time)}
													on:change={(e) =>
														updateManualFlightDateTime(flight.id, 'date', e.detail, 'departure')}
												/>
											</label>
										</div>
										<div>
											<label for="dep-time-{flight.id}" class="text-xs text-gray2 block mb-1"
												>Departure Time</label
											>
											<input
												type="time"
												id="dep-time-{flight.id}"
												value={getISOTimePart(flight.time)}
												on:input={(e) =>
													updateManualFlightDateTime(
														flight.id,
														'time',
														e.currentTarget.value,
														'departure'
													)}
												class={inputStyles}
											/>
										</div>
									</div>
									<div class="flex items-center gap-2 pt-3 border-t border-gray2/10">
										<span class="text-gray2">Arrive at Airport by:</span>
										<span class="font-semibold text-white">{formatTime(flight.timeAtAirport)}</span>
										<div class="flex items-center gap-1 ml-auto bg-navbar p-0.5 rounded-md">
											<button
												on:click={() => updateHoursBeforeDeparture(flight.id, -0.25)}
												class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
												aria-label="Decrease time">−</button
											>
											<span class="text-xs text-white font-mono px-1.5 w-12 text-center">
												{formatHours(flight.hoursBeforeDeparture || 2)}
											</span>
											<button
												on:click={() => updateHoursBeforeDeparture(flight.id, 0.25)}
												class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
												aria-label="Increase time">+</button
											>
										</div>
									</div>
								</div>
							{:else}
								<div class="flex items-start justify-between">
									<div class="flex flex-col gap-1">
										<div class="font-bold text-white text-lg">{flight.flightNumber}</div>
										<div class="flex items-center gap-2 text-sm">
											<span class="font-mono bg-gray2/20 px-2 py-1 rounded text-white"
												>{flight.from}</span
											>
											<span class="text-gray2">→</span>
											<span class="font-mono bg-gray2/20 px-2 py-1 rounded text-white"
												>{flight.to}</span
											>
										</div>
									</div>
									<button
										on:click={() => removeDeparture(flight.id)}
										class="text-gray2 hover:text-red-400 hover:cursor-pointer p-1 rounded-full transition-colors"
										aria-label="Remove departure flight"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
											<polyline points="3 6 5 6 21 6" />
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									</button>
								</div>
								<div class="text-sm text-white bg-gray1/50 p-2 rounded-md space-y-2">
									<div>
										Departs at <span class="font-semibold text-lime">{formatTime(flight.time)}</span
										>
										on {formatDate(flight.time)}
									</div>
									<div class="flex items-center gap-2 pt-2 border-t border-gray2/10">
										<span class="text-gray2">Arrive at Airport by:</span>
										<span class="font-semibold text-white">{formatTime(flight.timeAtAirport)}</span>
										<div class="flex items-center gap-1 ml-auto bg-navbar p-0.5 rounded-md">
											<button
												on:click={() => updateHoursBeforeDeparture(flight.id, -0.25)}
												class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
												aria-label="Decrease time">−</button
											>
											<span class="text-xs text-white font-mono px-1.5 w-12 text-center">
												{formatHours(flight.hoursBeforeDeparture || 2)}
											</span>
											<button
												on:click={() => updateHoursBeforeDeparture(flight.id, 0.25)}
												class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
												aria-label="Increase time">+</button
											>
										</div>
									</div>
								</div>
							{/if}

							<div>
								<div class="text-xs text-gray2 mb-2">Assigned People:</div>
								<div class="flex flex-wrap gap-1 mb-2">
									{#each flight.assignedRoles || [] as roleName}
										<span
											class="inline-flex items-center gap-1.5 px-2 py-1 bg-lime/20 text-lime text-xs rounded-full hover:cursor-pointer"
										>
											{roleName}
											{#if (flight.assignedRoles || []).length > 1}
												<button
													on:click={() => removeRoleFromFlight(flight.id, roleName, 'departure')}
													class="hover:text-white hover:cursor-pointer transition-colors"
													aria-label="Remove {roleName} from flight"
												>
													<svg
														class="h-3 w-3"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											{/if}
										</span>
									{/each}
								</div>

								{#if availableRoles.length > 0}
									<div class="flex flex-wrap gap-1 border-t border-gray2/10 pt-2 mt-2">
										{#each availableRoles as name}
											<button
												on:click={() => addRoleToFlight(flight.id, name, 'departure')}
												class="px-2 py-1 bg-gray2/20 text-gray2 text-xs rounded-full hover:cursor-pointer hover:bg-lime/20 hover:text-lime transition-colors opacity-60 hover:opacity-100"
											>
												+ {name}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		{#if !flightsEnabled}
			<div
				class="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center cursor-not-allowed"
			>
				<div class="text-white text-center pointer-events-none">
					<p class="text-lg font-semibold">Flights Disabled</p>
					<p class="text-sm text-gray2">Enable flights below to use this feature</p>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex justify-end items-center w-full gap-3">
		<button
			type="button"
			on:click={toggleFlightsEnabled}
			disabled={isSaving}
			class="px-8 py-3 text-sm border transition-colors rounded-full cursor-pointer {flightsEnabled
				? 'bg-lime text-black font-bold border-lime hover:bg-transparent hover:text-lime'
				: 'bg-navbar border-lime text-lime hover:bg-lime hover:text-black hover:border-lime'}"
		>
			{flightsEnabled ? 'Enabled' : 'Disabled'}
		</button>

		<Button on:click={handleSave} variant="filled" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save & Close'}
		</Button>
	</div>
</Modal>
