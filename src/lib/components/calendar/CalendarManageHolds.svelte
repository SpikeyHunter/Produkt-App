<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, HoldLevel } from '$lib/types/calendar-types';

	export let isOpen: boolean = false;
	export let events: CalendarEvent[] = [];
	export let selectedDate: Date = new Date();
	
	// Fixes unused export warning safely
	$: _date = selectedDate; 

	let editedEvents = [...events];
	let saving = false;
	let bulkAction: 'none' | 'clear' | 'restore' | 'delete' = 'none';
	let selectedEventIds: Set<string> = new Set();
	const dispatch = createEventDispatcher();

	const holdLevels: (HoldLevel | 'CONFIRMED')[] = ['P', ...Array.from({length: 20}, (_, i) => `H${i+1}` as HoldLevel), 'CONFIRMED'];

	$: if (isOpen && events) {
		editedEvents = events.map(e => JSON.parse(JSON.stringify(e)));
		selectedEventIds.clear();
	}
	
	function toggleEventSelection(eventId: string) {
		if (selectedEventIds.has(eventId)) selectedEventIds.delete(eventId);
		else selectedEventIds.add(eventId);
		selectedEventIds = selectedEventIds;
	}
	
	function selectAll() {
		if (selectedEventIds.size === editedEvents.length) selectedEventIds.clear();
		else selectedEventIds = new Set(editedEvents.map(e => e.id));
	}
	
	function updateHoldLevel(eventId: string, newLevel: string) {
		const eventIndex = editedEvents.findIndex(e => e.id === eventId);
		if (eventIndex !== -1) {
			if (newLevel === 'CONFIRMED') {
				editedEvents[eventIndex].status = 'CONFIRMED';
				editedEvents[eventIndex].hold_level = null;
			} else if (newLevel === 'P') {
				editedEvents[eventIndex].status = 'PENDING';
				editedEvents[eventIndex].hold_level = 'P';
			} else {
				editedEvents[eventIndex].status = 'HOLD';
				editedEvents[eventIndex].hold_level = newLevel as HoldLevel;
			}
			editedEvents = editedEvents;
		}
	}
	
	async function applyBulkAction() {
		if (bulkAction === 'none' || selectedEventIds.size === 0) return;
		const selectedEvents = editedEvents.filter(e => selectedEventIds.has(e.id));
		
		switch (bulkAction) {
			case 'clear':
				selectedEvents.forEach(event => {
					const idx = editedEvents.findIndex(e => e.id === event.id);
					if (idx !== -1) { editedEvents[idx].hold_level = null; editedEvents[idx].status = 'CANCELLED'; }
				}); break;
			case 'restore':
				selectedEvents.forEach(event => {
					const idx = editedEvents.findIndex(e => e.id === event.id);
					if (idx !== -1) { editedEvents[idx].hold_level = 'H1'; editedEvents[idx].status = 'HOLD'; }
				}); break;
			case 'delete':
				editedEvents = editedEvents.filter(e => !selectedEventIds.has(e.id)); break;
		}
		selectedEventIds.clear(); bulkAction = 'none'; editedEvents = editedEvents;
	}
	
	async function saveChanges() {
		saving = true;
		try {
			for (const event of editedEvents) {
				const { error } = await supabase.from('calendar_events').update({ status: event.status, hold_level: event.hold_level, details: event.details }).eq('id', event.id);
				if (error) throw error;
			}
			
			const currentIds = editedEvents.map(e => e.id);
			const toDelete = events.filter(e => !currentIds.includes(e.id));
			if (toDelete.length > 0) {
				const { error } = await supabase.from('calendar_events').delete().in('id', toDelete.map(e => e.id));
				if (error) throw error;
			}
			dispatch('update'); closeModal();
		} catch (err: any) { dispatch('error', { message: err.message || 'Failed to save changes' }); } finally { saving = false; }
	}
	
	function closeModal() {
		isOpen = false; editedEvents = []; selectedEventIds.clear(); bulkAction = 'none'; dispatch('close');
	}
</script>

<Modal bind:isOpen title="Manage Holds" maxWidth="max-w-3xl" hasFooter={true} on:close={closeModal}>
	<div class="space-y-4">
		<div class="flex items-center justify-between p-3 bg-black/30 rounded-xl">
			<div class="flex items-center gap-4">
				<button class="text-sm text-lime font-bold hover:underline transition-colors" on:click={selectAll}>
					{selectedEventIds.size === editedEvents.length ? 'Deselect All' : 'Select All'}
				</button>
				{#if selectedEventIds.size > 0}
					<select bind:value={bulkAction} on:change={applyBulkAction} class="px-3 py-2 bg-black/50 border border-gray2/30 rounded-lg text-sm text-white focus:outline-none">
						<option value="none">Bulk Actions...</option>
						<option value="clear">Clear Selected</option>
						<option value="restore">Restore Selected</option>
						<option value="delete">Delete Selected</option>
					</select>
				{/if}
			</div>
		</div>
		
		<div class="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
			{#each editedEvents as event}
				<div class="flex items-center gap-4 p-3 bg-black/30 rounded-lg border border-gray2/20">
					<input type="checkbox" checked={selectedEventIds.has(event.id)} on:change={() => toggleEventSelection(event.id)} aria-label="Select Event" class="w-4 h-4 rounded bg-black/50 text-lime focus:ring-0" />
					<select value={event.status === 'CONFIRMED' ? 'CONFIRMED' : event.hold_level || 'none'} on:change={(e) => updateHoldLevel(event.id, e.currentTarget.value)} aria-label="Hold Level" class="px-3 py-2 bg-black/50 border border-gray2/30 rounded-lg text-sm font-bold text-white focus:outline-none w-20 text-center">
						<option value="none">NA</option>
						{#each holdLevels as level}<option value={level}>{level}</option>{/each}
					</select>
					<div class="flex-1 text-sm font-bold text-white truncate">{event.title}</div>
				</div>
			{/each}
		</div>
	</div>
	
	<div slot="footer" class="flex gap-3 justify-end">
		<Button variant="outline" on:click={closeModal}>Cancel</Button>
		<Button variant={saving ? 'loading' : 'filled'} disabled={saving} on:click={saveChanges}>{saving ? 'Saving...' : 'Save'}</Button>
	</div>
</Modal>