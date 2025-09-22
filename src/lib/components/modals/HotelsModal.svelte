<script context="module" lang="ts">
	export interface HotelRoom {
		id: string;
		reservationFirstName: string;
		reservationLastName: string;
		hotelName: string;
		customHotelName: string;
		customHotelAddress: string;
		roomType: string;
		checkInDate: string;
		checkInTime: string;
		checkOutDate: string;
		checkOutTime: string;
		notes: string;
		requestEarlyCheckIn: boolean;
		earlyCheckInTime: string;
		requestLateCheckOut: boolean;
		lateCheckOutTime: string;
		isPaidByUs: boolean;
		confirmationNumber: string;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import DatePicker from '../buttons/DatePickerCompact.svelte';
	import Button from '../buttons/Button.svelte';
	import DropdownButton from '../buttons/DropdownButton.svelte';
	import type { EventAdvance } from '$lib/types/events.js';
	import { updateEventAdvance } from '$lib/services/eventsService.js';
	import { autoFillHotel } from '$lib/services/autoFillHotel.js';
	import type { Role, GroundInfo } from '$lib/services/autoFillHotel.js';
	export let isOpen = false;
	export let event: EventAdvance | null = null;

	const dispatch = createEventDispatcher();
	const PREDEFINED_HOTELS = [
		{ name: 'Monville', roomTypes: ['Standard', 'Suite Monville'] },
		{ name: 'W Hotel', roomTypes: ['Wonderful King', 'Fantastic Suite', 'Wow Suite'] },
		{ name: 'Alt Hotel', roomTypes: ['Queen Bed', 'Two Queen Beds'] },
		{ name: 'Other', roomTypes: [] }
	];
	let rooms: HotelRoom[] = [];
	let isSubmitting = false;

	$: if (event && isOpen) {
		loadExistingHotelInfo();
	}

	function loadExistingHotelInfo() {
		if (!event?.hotel_info) {
			rooms = [];
			return;
		}
		try {
			const existingData =
				typeof event.hotel_info === 'string' ? JSON.parse(event.hotel_info) : event.hotel_info;
			if (Array.isArray(existingData)) {
				// Ensure all rooms have confirmationNumber field for backward compatibility
				rooms = existingData.map((room) => ({
					...room,
					confirmationNumber: room.confirmationNumber || ''
				}));
			} else {
				rooms = [];
			}
		} catch (error) {
			console.error('Error parsing existing hotel info:', error);
			rooms = [];
		}
	}

	function createNewRoom(): HotelRoom {
		return {
			id: crypto.randomUUID(),
			reservationFirstName: '',
			reservationLastName: '',
			hotelName: '',
			customHotelName: '',
			customHotelAddress: '',
			roomType: '',
			checkInDate: '',
			checkInTime: '16:00',
			checkOutDate: '',
			checkOutTime: '12:00',
			notes: '',
			requestEarlyCheckIn: false,
			earlyCheckInTime: '11:00',
			requestLateCheckOut: false,
			lateCheckOutTime: '14:00',
			isPaidByUs: true,
			confirmationNumber: ''
		};
	}

	function addRoom() {
		if (rooms.length >= 10) return;
		rooms = [...rooms, createNewRoom()];
	}

	function removeRoom(roomId: string) {
		rooms = rooms.filter((room) => room.id !== roomId);
	}

	function clearAllRooms() {
		rooms = [];
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		rooms = [];
		isSubmitting = false;
	}

	async function handleSave() {
		if (!event) return;
		isSubmitting = true;
		try {
			// Save ONLY the hotel_info data as a JSON string
			const hotelDataJson = JSON.stringify(rooms);
			const updates = {
				hotel_info: hotelDataJson
			};
			await updateEventAdvance(event.event_id, event.artist_name, updates);

			// FIXED: Dispatch save event with updated event data
			dispatch('save', {
				event: { ...event, ...updates }
			});

			closeModal();
		} catch (error) {
			console.error('Error saving hotel info:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleCheckInDateChange(room: HotelRoom) {
		if (!room.checkInDate) return;
		const checkIn = new Date(room.checkInDate);
		checkIn.setDate(checkIn.getDate() + 1);
		room.checkOutDate = checkIn.toISOString().split('T')[0];
	}

	function getRoomTypesForHotel(hotelName: string): string[] {
		const hotel = PREDEFINED_HOTELS.find((h) => h.name === hotelName);
		return hotel?.roomTypes || [];
	}

	function getNextDay(dateString: string): string {
		if (!dateString) return '';
		const date = new Date(dateString);
		date.setDate(date.getDate() + 1);
		return date.toISOString().split('T')[0];
	}

	function handleAutofill() {
		if (!event) return;
		try {
			// Parse roles from event
			let roles: Role[] = [];
			if (event.roles) {
				roles = typeof event.roles === 'string' ? JSON.parse(event.roles) : event.roles;
			}

			// Parse ground info from event
			let groundInfo: GroundInfo | null = null;
			if (event.ground_info) {
				groundInfo =
					typeof event.ground_info === 'string' ? JSON.parse(event.ground_info) : event.ground_info;
			}

			// Generate rooms using autofill service
			const autoFilledRooms = autoFillHotel(roles, groundInfo, event.event_date);

			// Replace current rooms with autofilled ones
			rooms = autoFilledRooms;
		} catch (error) {
			console.error('Error autofilling hotel rooms:', error);
		}
	}
</script>

<Modal
	bind:isOpen
	title="Hotel Booking - {event?.artist_name || 'Event'}"
	maxWidth="max-w-7xl"
	hasFooter={true}
	on:close={closeModal}
>
	<div class="p-1 space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="text-lg font-bold text-white">Hotel Deals: deal</h3>
			</div>
			<div class="flex gap-2">
				<Button variant="gray" on:click={clearAllRooms} disabled={rooms.length === 0}>
					Clear All
				</Button>
				<Button variant="gray" on:click={handleAutofill}>Autofill</Button>
				<Button variant="slim" on:click={addRoom} disabled={rooms.length >= 10}>
					+ Add Room ({rooms.length}/10)
				</Button>
			</div>
		</div>

		{#if rooms.length > 0}
			<div class="grid grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-2">
				{#each rooms as room, index (room.id)}
					<div
						class="bg-navbar rounded-xl p-3 border border-gray-600 flex flex-col gap-3 relative min-w-0"
					>
						<div class="flex justify-between items-center">
							<div class="flex items-center gap-2">
								<h4 class="text-white font-bold text-sm">Room #{index + 1}</h4>
							</div>
							<div class="flex items-center gap-2">
								<div class="min-w-0">
									<input
										type="text"
										class="bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs
focus:outline-none focus:border-lime w-32"
										placeholder="Confirmation #"
										bind:value={room.confirmationNumber}
									/>
								</div>
								<button
									type="button"
									class="flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer"
									aria-label="Remove Room"
									on:click={() => removeRoom(room.id)}
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M3 6h18" />
										<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
										<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
										<line x1="10" y1="11" x2="10" y2="17" />
										<line x1="14" y1="11" x2="14" y2="17" />
									</svg>
								</button>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div class="min-w-0">
								<label
									for="res-firstname-{room.id}"
									class="text-xs text-gray2 font-medium mb-1 block">First Name</label
								>
								<input
									id="res-firstname-{room.id}"
									type="text"
									class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime"
									placeholder="Jane"
									bind:value={room.reservationFirstName}
								/>
							</div>
							<div class="min-w-0">
								<label
									for="res-lastname-{room.id}"
									class="text-xs text-gray2 font-medium mb-1 block">Last Name</label
								>
								<input
									id="res-lastname-{room.id}"
									type="text"
									class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime"
									placeholder="Doe"
									bind:value={room.reservationLastName}
								/>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div class="min-w-0">
								<label for="hotel-name-{room.id}" class="text-xs text-gray2 font-medium mb-1 block"
									>Hotel Name</label
								>
								<select
									id="hotel-name-{room.id}"
									class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime appearance-none"
									bind:value={room.hotelName}
								>
									<option value="" disabled>Select Hotel...</option>
									{#each PREDEFINED_HOTELS as hotel}
										<option value={hotel.name}>{hotel.name}</option>
									{/each}
								</select>
							</div>
							<div class="min-w-0">
								<label for="room-type-{room.id}" class="text-xs text-gray2 font-medium mb-1 block"
									>Room Type</label
								>
								{#if room.hotelName === 'Other'}
									<input
										id="room-type-{room.id}"
										type="text"
										class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime"
										placeholder="Enter custom room type"
										bind:value={room.roomType}
									/>
								{:else}
									<select
										id="room-type-{room.id}"
										class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime appearance-none disabled:cursor-not-allowed disabled:opacity-50"
										bind:value={room.roomType}
										disabled={!room.hotelName}
									>
										<option value="" disabled>Select Type...</option>
										{#each getRoomTypesForHotel(room.hotelName) as type}
											<option value={type}>{type}</option>
										{/each}
									</select>
								{/if}
							</div>
						</div>

						{#if room.hotelName === 'Other'}
							<div class="grid grid-cols-2 gap-2">
								<div class="min-w-0">
									<label
										for="custom-hotel-name-{room.id}"
										class="text-xs text-gray2 font-medium mb-1 block">Custom Hotel Name</label
									>
									<input
										id="custom-hotel-name-{room.id}"
										type="text"
										class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime"
										placeholder="Custom hotel name"
										bind:value={room.customHotelName}
									/>
								</div>
								<div class="min-w-0">
									<label
										for="custom-hotel-address-{room.id}"
										class="text-xs text-gray2 font-medium mb-1 block">Hotel Address</label
									>
									<input
										id="custom-hotel-address-{room.id}"
										type="text"
										class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime"
										placeholder="Hotel address"
										bind:value={room.customHotelAddress}
									/>
								</div>
							</div>
						{/if}

						<div class="grid grid-cols-2 gap-2">
							<div class="min-w-0">
								<label
									for="check-in-date-{room.id}"
									class="text-xs text-gray2 font-medium mb-1 block">Check-in</label
								>
								<div class="flex gap-1">
									<div class="flex-1 min-w-0">
										<DatePicker
											bind:value={room.checkInDate}
											on:change={() => handleCheckInDateChange(room)}
											variant="slim"
											height="h-7"
										/>
									</div>
									<input
										type="time"
										bind:value={room.checkInTime}
										class="w-16 bg-gray1 border border-gray-600 rounded-md px-1 text-white text-xs"
									/>
								</div>
							</div>
							<div class="min-w-0">
								<label
									for="check-out-date-{room.id}"
									class="text-xs text-gray2 font-medium mb-1 block">Check-out</label
								>
								<div class="flex gap-1">
									<div class="flex-1 min-w-0">
										<DatePicker
											bind:value={room.checkOutDate}
											variant="slim"
											height="h-7"
											disabled={!room.checkInDate}
											minDate={getNextDay(room.checkInDate)}
										/>
									</div>
									<input
										type="time"
										bind:value={room.checkOutTime}
										class="w-16 bg-gray1 border border-gray-600 rounded-md px-1 text-white text-xs"
									/>
								</div>
							</div>
						</div>

						<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white">
							<div class="flex items-center gap-2">
								<label for="early-checkin-{room.id}" class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={room.requestEarlyCheckIn}
										id="early-checkin-{room.id}"
										class="sr-only peer"
									/>
									<span
										class="flex items-center justify-center w-3.5 h-3.5 rounded bg-gray1 border border-gray-500 transition-colors peer-checked:bg-lime peer-checked:border-lime"
									>
										{#if room.requestEarlyCheckIn}
											<svg
												class="w-2.5 h-2.5"
												viewBox="0 0 16 16"
												fill="none"
												stroke="black"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M2 8 L6 12 L14 4" />
											</svg>
										{/if}
									</span>
									<span class="text-xs text-white">Early Check-in</span>
								</label>
								{#if room.requestEarlyCheckIn}
									<input
										type="time"
										bind:value={room.earlyCheckInTime}
										class="bg-gray1 border border-gray-500 rounded px-1 py-0.5 text-white text-xs w-16"
									/>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<label for="late-checkout-{room.id}" class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={room.requestLateCheckOut}
										id="late-checkout-{room.id}"
										class="sr-only peer"
									/>
									<span
										class="flex items-center justify-center w-3.5 h-3.5 rounded bg-gray1 border border-gray-500 transition-colors peer-checked:bg-lime peer-checked:border-lime"
									>
										{#if room.requestLateCheckOut}
											<svg
												class="w-2.5 h-2.5"
												viewBox="0 0 16 16"
												fill="none"
												stroke="black"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M2 8 L6 12 L14 4" />
											</svg>
										{/if}
									</span>
									<span class="text-xs text-white">Late Check-out</span>
								</label>
								{#if room.requestLateCheckOut}
									<input
										type="time"
										bind:value={room.lateCheckOutTime}
										class="bg-gray1 border border-gray-500 rounded px-1 py-0.5 text-white text-xs w-16"
									/>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<label for="paid-by-us-{room.id}" class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={room.isPaidByUs}
										id="paid-by-us-{room.id}"
										class="sr-only peer"
									/>
									<span
										class="flex items-center justify-center w-3.5 h-3.5 rounded bg-gray1 border border-gray-500 transition-colors peer-checked:bg-lime peer-checked:border-lime"
									>
										{#if room.isPaidByUs}
											<svg
												class="w-2.5 h-2.5"
												viewBox="0 0 16 16"
												fill="none"
												stroke="black"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<path d="M2 8 L6 12 L14 4" />
											</svg>
										{/if}
									</span>
									<span class="text-xs text-white">Paid by Us</span>
								</label>
							</div>
						</div>

						<div class="min-w-0">
							<label for="notes-{room.id}" class="text-xs text-gray2 font-medium mb-1 block"
								>Notes</label
							>
							<textarea
								id="notes-{room.id}"
								class="w-full bg-gray1 border border-gray-600 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-lime resize-none h-12"
								placeholder="e.g., King bed preferred, away from elevator..."
								bind:value={room.notes}
							></textarea>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center text-gray2 py-16 border-2 border-dashed border-gray-600 rounded-lg">
				<p class="font-bold text-lg">No Rooms Added</p>
				<p class="text-sm">Click "+ Add Room" to start building the rooming list.</p>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex justify-end gap-2 pt-1">
		<Button variant="filled" on:click={handleSave} disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : 'Save & Close'}
		</Button>
	</div>
</Modal>
