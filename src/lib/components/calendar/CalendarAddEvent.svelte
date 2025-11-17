<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';
	import type { EventStatus, EventType, VenueCategory, HoldLevel } from '$lib/types/calendar-types';

	// Props
	export let isOpen: boolean = false;
	export let selectedDate: Date = new Date();
	export let existingEvent: any = null;

	// State
	let eventForm = createEmptyForm();
	let saving = false;
	let selectedDates: Date[] = [selectedDate];
	let createSeparateEvents = false;
	let priorityHold = false;
	const dispatch = createEventDispatcher();

	// Form structure
	interface EventForm {
		title: string;
		artist_name: string;
		venue_category: VenueCategory | null;
		venue_room: string;
		date: string;
		start_time: string;
		end_time: string;
		status: EventStatus;
		event_type: EventType;
		notes: string;
		hold_level: HoldLevel;
		is_challenge: boolean;
		is_target: boolean;
		tour_name: string;
		contact_name: string;
		contact_email: string;
		contact_phone: string;
		is_matinee: boolean;
	}

	function createEmptyForm(): EventForm {
		return {
			title: '',
			artist_name: '',
			venue_category: null,
			venue_room: '',
			date: formatDateForInput(selectedDate),
			start_time: '',
			end_time: '',
			status: 'HOLD',
			event_type: 'Show',
			notes: '',
			hold_level: null,
			is_challenge: false,
			is_target: false,
			tour_name: '',
			contact_name: '',
			contact_email: '',
			contact_phone: '',
			is_matinee: false
		};
	}

	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	async function getNextAvailableHoldLevel(date: string): Promise<HoldLevel> {
		const { data: existingHolds } = await supabase
			.from('calendar_events')
			.select('hold_level')
			.eq('date', date)
			.eq('status', 'HOLD')
			.order('hold_level', { ascending: true });
		const usedLevels = (existingHolds || []).map(h => h.hold_level).filter(Boolean);
		const allLevels: HoldLevel[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
		for (const level of allLevels) {
			if (!usedLevels.includes(level)) {
				return level;
			}
		}
		
		return 'H6';
	}

	async function handleAddEvent() {
		if (!eventForm.title) {
			dispatch('error', { message: 'Title is required' });
			return;
		}

		saving = true;
		try {
			const datesToCreate = createSeparateEvents ? selectedDates : [new Date(eventForm.date + 'T00:00:00')];
			const events = [];
			for (const date of datesToCreate) {
				const dateStr = formatDateForInput(date);
				let holdLevel = eventForm.hold_level;
				if (priorityHold && eventForm.status === 'HOLD') {
					holdLevel = await getNextAvailableHoldLevel(dateStr);
				}

				const eventData = {
					...eventForm,
					date: dateStr,
					user_id: $user?.id,
					hold_level: holdLevel,
					artist_name: eventForm.artist_name ||
					null,
					venue_room: eventForm.venue_room || null,
					start_time: eventForm.start_time || null,
					end_time: eventForm.end_time || null,
					notes: eventForm.notes || null,
					tour_name: eventForm.tour_name || null,
					contact_name: eventForm.contact_name ||
					null,
					contact_email: eventForm.contact_email || null,
					contact_phone: eventForm.contact_phone || null
				};

				events.push(eventData);
			}

			const { data, error: dbError } = await supabase
				.from('calendar_events')
				.insert(events)
				.select();
			if (dbError) throw dbError;

			dispatch('success', {
				message: `${events.length} event(s) added successfully!`,
				events: data
			});

			closeModal();
		} catch (err: any) {
			dispatch('error', {
				message: err.message || 'Failed to add event'
			});
		} finally {
			saving = false;
		}
	}

	function closeModal() {
		isOpen = false;
		eventForm = createEmptyForm();
		selectedDates = [selectedDate];
		createSeparateEvents = false;
		priorityHold = false;
		dispatch('close');
	}

	$: if (isOpen && selectedDate) {
		eventForm.date = formatDateForInput(selectedDate);
		selectedDates = [selectedDate];
	}

	$: if (existingEvent) {
		eventForm = { ...existingEvent };
	}
</script>

<Modal
	bind:isOpen
	title={existingEvent ? "Edit Event" : "Add New Hold / Event"}
	maxWidth="max-w-3xl"
	hasFooter={true}
	on:close={closeModal}
>
	<form on:submit|preventDefault={handleAddEvent} class="space-y-6">
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="title" class="block text-sm font-bold text-gray2 mb-2">
					Event Title <span class="text-lime">*</span>
				</label>
				<input
					type="text"
					id="title"
					bind:value={eventForm.title}
					placeholder="Enter event title"
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
					required
				/>
			</div>
			
			<div>
				<label for="artist_name" class="block text-sm font-bold text-gray2 mb-2">
					Artist Name
				</label>
				<input
					type="text"
					id="artist_name"
					bind:value={eventForm.artist_name}
					placeholder="Artist or band name"
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
				/>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div>
				<label for="status" class="block text-sm font-bold text-gray2 mb-2">Status</label>
				<select
					id="status"
					bind:value={eventForm.status}
					class="custom-select w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl 
					       text-white focus:border-lime focus:outline-none transition-colors cursor-pointer"
				>
					<option value="HOLD">Hold</option>
					<option value="CONFIRMED">Confirmed</option>
					<option value="PENDING">Pending</option>
				</select>
			</div>

			<div>
				<label for="hold_level" class="block text-sm font-bold text-gray2 mb-2">
					Hold Level
					{#if priorityHold}
						<span class="text-lime text-xs">(Auto)</span>
					{/if}
				</label>
				<select
					id="hold_level"
					bind:value={eventForm.hold_level}
					disabled={priorityHold}
					class="custom-select w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl 
					       text-white focus:border-lime focus:outline-none transition-colors cursor-pointer
					       disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<option value={null}>None</option>
					<option value="H1">H1 - First Hold</option>
					<option value="H2">H2 - Second Hold</option>
					<option value="H3">H3 - Third Hold</option>
					<option value="H4">H4 - Fourth Hold</option>
					<option value="H5">H5 - Fifth Hold</option>
					<option value="H6">H6 - Sixth Hold</option>
					<option value="P">P - Pending</option>
				</select>
			</div>

			<div>
				<label for="event_type" class="block text-sm font-bold text-gray2 mb-2">Event Type</label>
				<select
					id="event_type"
					bind:value={eventForm.event_type}
					class="custom-select w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl 
					       text-white focus:border-lime focus:outline-none transition-colors cursor-pointer"
				>
					<option value="Show">Show</option>
					<option value="Corpo">Corpo</option>
					<option value="Other">Other</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="venue_category" class="block text-sm font-bold text-gray2 mb-2">
					Venue Category
				</label>
				<select
					id="venue_category"
					bind:value={eventForm.venue_category}
					class="custom-select w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl 
					       text-white focus:border-lime focus:outline-none transition-colors cursor-pointer"
				>
					<option value={null}>Select venue...</option>
					<option value="Co-Pro Shows">Co-Pro Shows</option>
					<option value="New City Gas">New City Gas</option>
					<option value="Bazart">Bazart</option>
				</select>
			</div>

			<div>
				<label for="venue_room" class="block text-sm font-bold text-gray2 mb-2">
					Venue Room
				</label>
				<input
					type="text"
					id="venue_room"
					bind:value={eventForm.venue_room}
					placeholder="e.g., Main Room, NFT Gallery"
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
				/>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div>
				<label for="date" class="block text-sm font-bold text-gray2 mb-2">
					Date <span class="text-lime">*</span>
				</label>
				<input
					id="date"
					type="date"
					bind:value={eventForm.date}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       focus:border-lime focus:outline-none transition-colors"
					required
				/>
			</div>

			<div>
				<label for="start_time" class="block text-sm font-bold text-gray2 mb-2">Start Time</label>
				<input
					id="start_time"
					type="time"
					bind:value={eventForm.start_time}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       focus:border-lime focus:outline-none transition-colors"
				/>
			</div>

			<div>
				<label for="end_time" class="block text-sm font-bold text-gray2 mb-2">End Time</label>
				<input
					id="end_time"
					type="time"
					bind:value={eventForm.end_time}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       focus:border-lime focus:outline-none transition-colors"
				/>
			</div>
		</div>

		<div class="flex flex-wrap gap-6 p-4 bg-black/30 rounded-xl">
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={priorityHold}
					class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
					       focus:ring-lime focus:ring-offset-0"
				/>
				<span class="text-sm text-gray2">Priority Hold (Auto-assign best level)</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={eventForm.is_challenge}
					class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
					       focus:ring-lime focus:ring-offset-0"
				/>
				<span class="text-sm text-gray2">Challenge Hold ⚡</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={eventForm.is_target}
					class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
					       focus:ring-lime focus:ring-offset-0"
				/>
				<span class="text-sm text-gray2">Target Date 🎯</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={eventForm.is_matinee}
					class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
					       focus:ring-lime focus:ring-offset-0"
				/>
				<span class="text-sm text-gray2">Matinee Event</span>
			</label>

			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={createSeparateEvents}
					class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
					       focus:ring-lime focus:ring-offset-0"
				/>
				<span class="text-sm text-gray2">Save as separate events</span>
			</label>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="tour_name" class="block text-sm font-bold text-gray2 mb-2">Tour</label>
				<input
					type="text"
					id="tour_name"
					bind:value={eventForm.tour_name}
					placeholder="Tour name (optional)"
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
				/>
			</div>

			<div>
				<label for="contact_name" class="block text-sm font-bold text-gray2 mb-2">Contact</label>
				<input
					type="text"
					id="contact_name"
					bind:value={eventForm.contact_name}
					placeholder="Agent/Contact name"
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
					       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
				/>
			</div>
		</div>

		<div>
			<label for="notes" class="block text-sm font-bold text-gray2 mb-2">Notes</label>
			<textarea
				id="notes"
				bind:value={eventForm.notes}
				placeholder="Additional notes or details..."
				rows="3"
				class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-xl text-white 
				       placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors resize-none"
			></textarea>
		</div>
	</form>

	<div slot="footer" class="flex gap-3 justify-end">
		<Button variant="outline" on:click={closeModal}>Cancel</Button>
		<Button
			variant={saving ? 'loading' : 'filled'}
			disabled={saving}
			on:click={handleAddEvent}
		>
			{saving ? 'Saving...' : (existingEvent ? 'Update Event' : 'Add Event')}
		</Button>
	</div>
</Modal>

<style>
	.custom-select {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23999999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 16px center;
		padding-right: 40px;
	}
	
	.custom-select:hover:not(:disabled) {
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23E1FF00' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
	}
	
	.custom-select:focus {
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23E1FF00' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
	}
	
	input[type="checkbox"] {
		accent-color: #E1FF00;
	}
	
	input[type="date"]::-webkit-calendar-picker-indicator,
	input[type="time"]::-webkit-calendar-picker-indicator {
		filter: invert(1);
		cursor: pointer;
	}
</style>