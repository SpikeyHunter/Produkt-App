<script lang="ts">
	import Modal from './Modal.svelte';
	import DatePicker from '../buttons/DatePicker.svelte'; // The original date picker
	import DatePickerCompact from '../buttons/DatePickerCompact.svelte'; // The new compact one
	import Button from '../buttons/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import { updateEventAdvance, type EventAdvance } from '../../services/eventsService';
	import { getAirportCodeSet } from '../../services/constants';
	import { subHours, roundToNearestMinutes } from 'date-fns';

	export let isOpen = false;
	export let event: EventAdvance;
	// --- Reactive Derivations ---
	$: artistName = event ? event.artist_name : 'Artist Name';
	$: roles = event?.roles
		? typeof event.roles === 'string'
			? JSON.parse(event.roles)
			: event.roles
		: [];
	$: roleNames = roles.map((r: any) => `${r.firstName} ${r.lastName}`);

	const dispatch = createEventDispatcher();
	let isSaving = false;

	function handleClose() {
		dispatch('close');
	}

	// --- Enhanced Data Structures ---
	type Flight = {
		id: number;
		flightNumber: string;
		date: string;
		from: string;
		to: string;
		time: string; // ISO string for arrival or departure time
		timeAtAirport?: string; // ISO string for departures
		hoursBeforeDeparture?: number; // For departures
		assignedRoles?: string[];
		isEditable?: boolean; // Flag for manually added flights
	};

	// --- Component State ---
	let arrivals: Flight[] = [];
	let departures: Flight[] = [];

	// State for the new flight search forms
	let arrivalFlightDate = '';
	let arrivalFlightNumber = '';
	let departureFlightDate = '';
	let departureFlightNumber = '';
	let isSearchingArrival = false;
	let isSearchingDeparture = false;
	let arrivalSearchError = '';
	let departureSearchError = '';

	// --- Load and Initialize Data ---
	$: if (isOpen && event) {
		// Reset forms and errors when modal opens
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

	// --- Flight Management Functions ---
	function removeArrival(id: number) {
		arrivals = arrivals.filter((flight) => flight.id !== id);
	}

	function removeDeparture(id: number) {
		departures = departures.filter((flight) => flight.id !== id);
	}

	function addManualFlight(type: 'arrival' | 'departure') {
		const now = new Date();
		const newFlightBase = {
			id: Date.now(),
			flightNumber: '',
			from: '',
			to: '',
			time: now.toISOString(),
			assignedRoles: [...roleNames],
			isEditable: true
		};
		if (type === 'arrival') {
			const newArrival: Flight = { ...newFlightBase, date: now.toISOString().split('T')[0] };
			arrivals = [newArrival, ...arrivals];
		} else {
			const hours = 3;
			const newDeparture: Flight = {
				...newFlightBase,
				date: now.toISOString().split('T')[0],
				hoursBeforeDeparture: hours,
				timeAtAirport: calculateTimeAtAirport(newFlightBase.time, hours)
			};
			departures = [newDeparture, ...departures];
		}
	}

	// --- Departure Time Logic ---
	function getDefaultHoursBeforeDeparture(origin: string, destination: string): number {
		const domesticAirportCodes = getAirportCodeSet();
		const isDomestic = domesticAirportCodes.has(origin) && domesticAirportCodes.has(destination);
		return isDomestic ? 2 : 3;
	}

	function calculateTimeAtAirport(
		departureTimeISO: string,
		hoursBeforeDeparture: number
	): string {
		const departureDate = new Date(departureTimeISO);
		const timeAtAirport = subHours(departureDate, hoursBeforeDeparture);
		const roundedTime = roundToNearestMinutes(timeAtAirport, { nearestTo: 15 });
		return roundedTime.toISOString();
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

	// --- Flight API and Data Handling ---
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

	// --- Role Management Functions ---
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

	function removeRoleFromFlight(
		flightId: number,
		roleName: string,
		type: 'arrival' | 'departure'
	) {
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

	// --- Save and Utility Functions ---
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

	// --- Formatting and Manual Edit Helpers ---
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
		const d = new Date(isoString);
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
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

		const newDateTimeString =
			part === 'date' ? `${value}T${currentTimePart}` : `${currentDatePart}T${value}`;
		const newIsoTime = new Date(newDateTimeString).toISOString();

		updateFlightInList(flightId, type, (f) => {
			const updatedFlight = { ...f, time: newIsoTime };
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
	<div class="grid grid-cols-2 gap-4">
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
					<Button on:click={() => findFlight('arrival')} disabled={isSearchingArrival} width="w-full">
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
											<polyline points="3 6 5 6 21 6"></polyline>
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path>
										</svg>
									</button>
								</div>
								<div class="grid grid-cols-2 gap-2">
									<div class="col-span-2">
										<label
											for={`flight-number-arr-${flight.id}`}
											class="text-xs text-gray2 block mb-1">Flight Number</label
										>
										<input
											type="text"
											bind:value={flight.flightNumber}
											placeholder="e.g., AC123"
											class={inputStyles}
											id={`flight-number-arr-${flight.id}`}
										/>
									</div>
									<div>
										<label for={`from-arr-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>From</label
										>
										<input
											type="text"
											bind:value={flight.from}
											placeholder="YYZ"
											class={`${inputStyles} uppercase`}
											id={`from-arr-${flight.id}`}
										/>
									</div>
									<div>
										<label for={`to-arr-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>To</label
										>
										<input
											type="text"
											bind:value={flight.to}
											placeholder="YUL"
											class={`${inputStyles} uppercase`}
											id={`to-arr-${flight.id}`}
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
										<label for={`arr-time-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>Arrival Time</label
										>
										<input
											type="time"
											id={`arr-time-${flight.id}`}
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
										<polyline points="3 6 5 6 21 6"></polyline>
										<path
											d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										></path>
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
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
											<polyline points="3 6 5 6 21 6"></polyline>
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path>
										</svg>
									</button>
								</div>
								<div class="grid grid-cols-2 gap-2">
									<div class="col-span-2">
										<label
											for={`flight-number-dep-${flight.id}`}
											class="text-xs text-gray2 block mb-1">Flight Number</label
										>
										<input
											type="text"
											bind:value={flight.flightNumber}
											placeholder="e.g., AC123"
											class={inputStyles}
											id={`flight-number-dep-${flight.id}`}
										/>
									</div>
									<div>
										<label for={`from-dep-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>From</label
										>
										<input
											type="text"
											bind:value={flight.from}
											placeholder="YUL"
											class={`${inputStyles} uppercase`}
											id={`from-dep-${flight.id}`}
										/>
									</div>
									<div>
										<label for={`to-dep-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>To</label
										>
										<input
											type="text"
											bind:value={flight.to}
											placeholder="YYZ"
											class={`${inputStyles} uppercase`}
											id={`to-dep-${flight.id}`}
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
										<label for={`dep-time-${flight.id}`} class="text-xs text-gray2 block mb-1"
											>Departure Time</label
										>
										<input
											type="time"
											id={`dep-time-${flight.id}`}
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
											on:click={() => updateHoursBeforeDeparture(flight.id, -0.5)}
											class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
											aria-label="Decrease time"
											>−</button
										>
										<span class="text-xs text-white font-mono px-1.5 w-10 text-center"
											>{flight.hoursBeforeDeparture || 2}h</span
										>
										<button
											on:click={() => updateHoursBeforeDeparture(flight.id, 0.5)}
											class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
											aria-label="Increase time"
											>+</button
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
										<polyline points="3 6 5 6 21 6"></polyline>
										<path
											d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										></path>
									</svg>
								</button>
							</div>
							<div class="text-sm text-white bg-gray1/50 p-2 rounded-md space-y-2">
								<div>
									Departs at <span class="font-semibold text-lime">{formatTime(flight.time)}</span>
									on {formatDate(flight.time)}
								</div>
								<div class="flex items-center gap-2 pt-2 border-t border-gray2/10">
									<span class="text-gray2">Arrive at Airport by:</span>
									<span class="font-semibold text-white">{formatTime(flight.timeAtAirport)}</span>
									<div class="flex items-center gap-1 ml-auto bg-navbar p-0.5 rounded-md">
										<button
											on:click={() => updateHoursBeforeDeparture(flight.id, -0.5)}
											class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
											aria-label="Decrease time"
											>−</button
										>
										<span class="text-xs text-white font-mono px-1.5 w-10 text-center"
											>{flight.hoursBeforeDeparture || 2}h</span
										>
										<button
											on:click={() => updateHoursBeforeDeparture(flight.id, 0.5)}
											class="w-5 h-5 bg-gray2/20 hover:bg-lime/20 text-gray2 hover:text-lime rounded text-lg flex items-center justify-center transition-colors"
											aria-label="Increase time"
											>+</button
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
												on:click={() =>
													removeRoleFromFlight(flight.id, roleName, 'departure')}
												class="hover:text-white hover:cursor-pointer transition-colors"
												aria-label="Remove {roleName} from flight"
											>
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
											class="px-2 py-1 bg-gray2/20 text-gray2 text-xs rounded-full  hover:cursor-pointer hover:bg-lime/20 hover:text-lime transition-colors opacity-60 hover:opacity-100"
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

	<div slot="footer" class="flex justify-end items-center w-full">
		<Button on:click={handleSave} variant="filled" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save & Close'}
		</Button>
	</div>
</Modal>