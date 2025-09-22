<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import type { EventAdvance } from '$lib/types/events.js';
	import { updateEventAdvance } from '$lib/services/eventsService.js';

	export let isOpen = false;
	export let event: EventAdvance | null = null;

	const dispatch = createEventDispatcher();
	let isSubmitting = false;
	let customRiderText = '';

	$: if (event) {
		try {
			const existingData = typeof event.hospo_rider === 'string'
				? JSON.parse(event.hospo_rider)
				: event.hospo_rider;
			
			customRiderText = existingData?.custom_rider_text || '';
		} catch (e) {
			customRiderText = '';
		}
	}

	async function handleSave() {
		if (!event) return;
		isSubmitting = true;
		
		try {
			// Get existing hospo data
			let hospoData;
			try {
				hospoData = typeof event.hospo_rider === 'string'
					? JSON.parse(event.hospo_rider)
					: event.hospo_rider || {};
			} catch (e) {
				hospoData = {};
			}
			
			// Update only the custom rider text
			hospoData.custom_rider_text = customRiderText;
			
			const updates = {
				hospo_rider: JSON.stringify(hospoData)
			};
			
			await updateEventAdvance(event.event_id, event.artist_name, updates);
			dispatch('save_success', { updates });
			closeModal();
		} catch (error) {
			console.error('Error saving custom rider:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}
</script>

<Modal
	bind:isOpen
	title="Custom Rider - {event?.artist_name || 'Event'}"
	maxWidth="max-w-3xl"
	hasFooter={true}
	on:close={closeModal}
>
	{#if event}
		<div class="space-y-4">
			<p class="text-sm text-gray3">
				Enter any special rider requirements or custom requests not covered in the standard options.
			</p>
			
			<textarea
				bind:value={customRiderText}
				placeholder="Enter custom rider requirements..."
				class="w-full h-64 bg-gray1 text-white rounded-lg p-4 text-sm placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime resize-none"
			></textarea>
			
			<div class="text-xs text-gray3">
				This text will be included separately when copying the hospitality rider.
			</div>
		</div>
	{/if}

	<div slot="footer" class="flex gap-2 justify-end pt-4">
		<button
			class="px-4 py-2 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer text-sm"
			on:click={closeModal}
		>
			Cancel
		</button>
		<button
			class="px-4 py-2 rounded-full transition-colors cursor-pointer text-sm bg-lime text-black hover:opacity-90"
			disabled={isSubmitting}
			on:click={handleSave}
		>
			{isSubmitting ? 'Saving...' : 'Save Changes'}
		</button>
	</div>
</Modal>