<script lang="ts">
	import { createEventDispatcher, afterUpdate } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { EventAdvance, NoteItem } from '$lib/types/events.js';
	import Modal from '$lib/components/modals/Modal.svelte';

	export let isOpen = false;
	export let event: EventAdvance;
	$: artistName = event ? event.artist_name : 'Artist Name';
	const dispatch = createEventDispatcher();

	let notes: NoteItem[] = [];
	let saving = false;
	let previousIsOpen = false;

	// This lifecycle function runs after the component updates.
	// We use it to reliably detect when the modal has just opened.
	afterUpdate(() => {
		if (isOpen && !previousIsOpen) {
			// Modal has just opened, so we initialize the local state once.
			// This prevents user input from being overwritten by reactive changes to the 'event' prop.
			notes = event.notes ? JSON.parse(JSON.stringify(event.notes)) : [];
			if (notes.length === 0) {
				addNewNote(); // Start with one empty note if none exist
			}
		}
		previousIsOpen = isOpen;
	});

	function addNewNote() {
		notes = [...notes, { id: `note_${Date.now()}`, text: '' }];
	}

	function removeNote(id: string) {
		notes = notes.filter((note) => note.id !== id);
	}

	async function handleSave() {
		if (!event?.event_id || !event.artist_name) return;
		saving = true;

		const validNotes = notes.filter((note) => note.text && note.text.trim() !== '');

		try {
			const { error } = await supabase
				.from('events_advance')
				.update({ notes: validNotes.length > 0 ? validNotes : null })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);

			if (error) {
				console.error('Error saving notes:', error);
				alert('Failed to save notes.');
			} else {
				dispatch('save_success');
			}
		} catch (err) {
			console.error('Unexpected error saving notes:', err);
			alert('An unexpected error occurred.');
		} finally {
			saving = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}
</script>

<Modal
	{isOpen}
	on:close={closeModal}
	title="Notes - {artistName}"
	maxWidth="max-w-xl"
	hasFooter={true}
>
	<div class="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
		{#each notes as note (note.id)}
			<div class="flex items-center gap-3 animate-fade-in">
				<textarea
					bind:value={note.text}
					placeholder="Enter note details..."
					class="flex-1 resize-none rounded-lg border border-transparent bg-gray1 p-2 text-sm text-gray3 w-full focus:border-lime focus:outline-none"
					rows="2"
				></textarea>
				<button
					on:click={() => removeNote(note.id)}
					class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:cursor-pointer hover:bg-red-500 hover:text-white"
					aria-label="Remove note"
				>
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</button>
			</div>
		{/each}

		<button
			on:click={addNewNote}
			class="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray1 py-2 text-sm text-lime transition-colors hover:bg-lime hover:text-black hover:cursor-pointer"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			Add Note
		</button>
	</div>

	<div slot="footer" class="flex justify-end gap-3">
		<button
			on:click={closeModal}
			class="rounded-3xl border-gray2 border-1 px-4 py-2 text-white transition-colors hover hover:bg-gray3 hover:text-black hover:cursor-pointer"
		>
			Cancel
		</button>
		<button
			on:click={handleSave}
			disabled={saving}
			class="rounded-3xl bg-gray3 px-4 py-2 font-bold text-black transition-colors hover hover:bg-lime hover:text-black hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if saving}
				Saving...
			{:else}
				Save Notes
			{/if}
		</button>
	</div>
</Modal>

<style>
	.animate-fade-in {
		animation: fadeIn 0.3s ease-out forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
