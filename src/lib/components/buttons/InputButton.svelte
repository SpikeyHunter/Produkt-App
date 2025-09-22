<script lang="ts">
	import { updateEventAdvance } from '$lib/services/eventsService';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { PROGRESS_FIELDS } from '$lib/utils/progressUtils';
	import { createEventDispatcher } from 'svelte';

	// Props
	export let event: EventAdvance;
	export let value: string = '';
	export let placeholder: string = 'Enter value';
	export let column: string; // The database column to update
	export let maxWidth: number = 200; // Maximum width in pixels
	export let width: string = 'w-auto';
	export let height: string = 'h-auto';

	// Internal state
	let isEditing = false;
	let isUpdating = false;
	let inputElement: HTMLInputElement;

	const dispatch = createEventDispatcher();

	function startEditing() {
		isEditing = true;
		// Focus the input after it's rendered
		setTimeout(() => {
			if (inputElement) {
				inputElement.focus();
				inputElement.select();
			}
		}, 0);
	}

	function stopEditing() {
		isEditing = false;
	}

	async function handleSave() {
		if (value.trim()) {
			try {
				isUpdating = true;
				await updateValueInDatabase(value.trim());
				stopEditing();
			} catch (error) {
				console.error(`Failed to update ${column}:`, error);
			} finally {
				isUpdating = false;
			}
		} else {
			stopEditing();
		}
	}

	async function updateValueInDatabase(newValue: string) {
		try {
			console.log(`🔄 Updating ${column} to:`, newValue);
			
			// Create update object with the specified column
			const updates = { [column]: newValue };
			
			await updateEventAdvance(event.event_id, event.artist_name, updates);

			// Dispatch event to parent for reactivity
			dispatch('fieldUpdate', { 
				column, 
				value: newValue,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			// Check if this is a progress-affecting field and dispatch progress update
			if (PROGRESS_FIELDS.includes(column as any)) {
				console.log('📈 InputButton: Progress field updated, dispatching progress-field-updated');
				dispatch('progress-field-updated', {
					column,
					value: newValue,
					eventId: event.event_id,
					artistName: event.artist_name
				});
			}

			console.log(`✅ ${column} updated successfully`);
		} catch (error) {
			console.error(`❌ Error updating ${column}:`, error);
			throw error;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSave();
		} else if (e.key === 'Escape') {
			stopEditing();
		}
	}

	// Calculate dynamic width - but respect maxWidth
	$: dynamicWidth = Math.min(maxWidth, Math.max(100, value ? (value.length + 4) * 6.5 : 100));
</script>

<div class="input-button-container relative {width} {height}">
	{#if isEditing}
		<!-- Editable input mode -->
		<input
			type="text"
			class="bg-gray2 text-black rounded-xl px-3 py-1 text-xs font-bold placeholder-gray-500 focus:outline-none focus:bg-lime focus:text-black transition-all duration-200 {isUpdating ? 'opacity-70' : ''}"
			style="width: {Math.min(maxWidth, Math.max(100, value ? (value.length + 6) * 6.5 : 140))}px;"
			{placeholder}
			bind:value
			bind:this={inputElement}
			on:blur={handleSave}
			on:keydown={handleKeydown}
			disabled={isUpdating}
		/>
	{:else}
		<!-- Button mode -->
		<button
			type="button"
			class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer {isUpdating ? 'opacity-70' : ''}"
			style="max-width: {maxWidth}px;"
			on:click={startEditing}
			disabled={isUpdating}
		>
			<span class="block truncate {value ? 'text-black' : 'text-gray-500'}">
				{value || placeholder}
			</span>
		</button>
	{/if}
</div>