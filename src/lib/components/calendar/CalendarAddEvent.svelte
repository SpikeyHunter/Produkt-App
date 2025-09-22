<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';

	// Types (Updated to match new schema)
	type EventStatus = 'HOLD' | 'CONFIRMED';
	type EventType = 'Corpo' | 'Show' | 'Other';
	type VenueCategory = 'Co-Pro Shows' | 'New City Gas' | 'Bazart';

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
	}

	// Props
	export let isOpen: boolean = false;
	export let selectedDate: Date = new Date();

	// State
	let eventForm: EventForm = createEmptyForm();
	let saving = false;

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Functions
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
			notes: ''
		};
	}

	function formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	async function handleAddEvent() {
		if (!eventForm.title || !eventForm.date) {
			dispatch('error', { message: 'Title and date are required' });
			return;
		}

		saving = true;

		try {
			// Ensure empty strings are sent as null for optional fields
			const submissionData = {
				...eventForm,
				user_id: $user?.id,
				artist_name: eventForm.artist_name || null,
				venue_room: eventForm.venue_room || null,
				start_time: eventForm.start_time || null,
				end_time: eventForm.end_time || null,
				notes: eventForm.notes || null,
			};

			const { data, error: dbError } = await supabase
				.from('calendar_events')
				.insert([submissionData])
				.select()
				.single();

			if (dbError) throw dbError;
			
			dispatch('success', { 
				message: 'Event added successfully!',
				event: data 
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
		dispatch('close');
	}

	// Reactive - Update date when selectedDate changes
	$: if (isOpen && selectedDate) {
		eventForm.date = formatDateForInput(selectedDate);
	}
</script>

<Modal
	bind:isOpen
	title="Add New Event"
	maxWidth="max-w-2xl"
	hasFooter={true}
	on:close={closeModal}
>
	<form on:submit|preventDefault={handleAddEvent} class="space-y-4">
		<div>
			<label for="title" class="block text-sm font-bold text-gray2 mb-2">Event Title *</label>
			<TypebarCredentials
				variant="clear-lime"
				placeholder="Enter event title"
				bind:value={eventForm.title}
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="event_type" class="block text-sm font-bold text-gray2 mb-2">Event Type</label>
				<select 
					id="event_type" 
					bind:value={eventForm.event_type}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
				>
					<option value="Show">Show</option>
					<option value="Corpo">Corpo</option>
					<option value="Other">Other</option>
				</select>
			</div>

			<div>
				<label for="status" class="block text-sm font-bold text-gray2 mb-2">Status</label>
				<select 
					id="status" 
					bind:value={eventForm.status}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
				>
					<option value="HOLD">Hold</option>
					<option value="CONFIRMED">Confirmed</option>
				</select>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="venue_category" class="block text-sm font-bold text-gray2 mb-2">Venue Category</label>
				<select 
					id="venue_category" 
					bind:value={eventForm.venue_category}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
				>
					<option value={null}>None</option>
					<option value="Co-Pro Shows">Co-Pro Shows</option>
					<option value="New City Gas">New City Gas</option>
					<option value="Bazart">Bazart</option>
				</select>
			</div>

			<div>
				<label for="venue_room" class="block text-sm font-bold text-gray2 mb-2">Venue Room</label>
				<TypebarCredentials
					variant="clear-lime"
					placeholder="e.g., Main Room, NFT Gallery"
					bind:value={eventForm.venue_room}
				/>
			</div>
		</div>
		
		<div class="grid grid-cols-1">
			<div>
				<label for="artist_name" class="block text-sm font-bold text-gray2 mb-2">Artist Name</label>
				<TypebarCredentials
					variant="clear-lime"
					placeholder="Artist or band name"
					bind:value={eventForm.artist_name}
				/>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-4">
			<div class="col-span-1">
				<label for="date" class="block text-sm font-bold text-gray2 mb-2">Date *</label>
				<input
					id="date"
					type="date"
					bind:value={eventForm.date}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
					required
				/>
			</div>

			<div>
				<label for="start_time" class="block text-sm font-bold text-gray2 mb-2">Start Time</label>
				<input
					id="start_time"
					type="time"
					bind:value={eventForm.start_time}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
				/>
			</div>

			<div>
				<label for="end_time" class="block text-sm font-bold text-gray2 mb-2">End Time</label>
				<input
					id="end_time"
					type="time"
					bind:value={eventForm.end_time}
					class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white focus:border-lime focus:outline-none transition-colors"
				/>
			</div>
		</div>

		<div>
			<label for="notes" class="block text-sm font-bold text-gray2 mb-2">Notes</label>
			<textarea
				id="notes"
				bind:value={eventForm.notes}
				placeholder="Additional notes or details"
				rows="3"
				class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-lg text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors resize-none"
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
			{saving ? 'Adding...' : 'Add Event'}
		</Button>
	</div>
</Modal>