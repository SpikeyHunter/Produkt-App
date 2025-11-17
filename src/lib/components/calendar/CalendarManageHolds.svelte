<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, HoldLevel } from '$lib/types/calendar-types';
	
	// Props
	export let isOpen: boolean = false;
	export let events: CalendarEvent[] = [];
	export let selectedDate: Date = new Date();
	
	// State
	let editedEvents = [...events];
	let saving = false;
	let bulkAction: 'none' | 'clear' | 'restore' | 'delete' = 'none';
	let selectedEventIds: Set<string> = new Set();
	
	const dispatch = createEventDispatcher();
	
	// Hold level options
	const holdLevels: (HoldLevel | 'CONFIRMED')[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'CONFIRMED'];
	
	// Hold level styles
	const holdLevelStyles: Record<string, string> = {
		H1: 'bg-red-500/30 text-red-200 border-red-500/50',
		H2: 'bg-orange-500/30 text-orange-200 border-orange-500/50',
		H3: 'bg-yellow-500/30 text-yellow-200 border-yellow-500/50',
		H4: 'bg-green-500/30 text-green-200 border-green-500/50',
		H5: 'bg-blue-500/30 text-blue-200 border-blue-500/50',
		H6: 'bg-purple-500/30 text-purple-200 border-purple-500/50',
		P: 'bg-gray-500/30 text-gray-200 border-gray-500/50',
		CONFIRMED: 'bg-lime/30 text-lime border-lime/50'
	};
	
	// Update when events prop changes
	$: if (isOpen && events) {
		editedEvents = events.map(e => ({ ...e }));
		selectedEventIds.clear();
	}
	
	function toggleEventSelection(eventId: string) {
		if (selectedEventIds.has(eventId)) {
			selectedEventIds.delete(eventId);
		} else {
			selectedEventIds.add(eventId);
		}
		selectedEventIds = selectedEventIds; // Trigger reactivity
	}
	
	function selectAll() {
		if (selectedEventIds.size === editedEvents.length) {
			selectedEventIds.clear();
		} else {
			selectedEventIds = new Set(editedEvents.map(e => e.calendar_event_id));
		}
	}
	
	function updateHoldLevel(eventId: string, newLevel: string) {
		const eventIndex = editedEvents.findIndex(e => e.calendar_event_id === eventId);
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
			editedEvents = editedEvents; // Trigger reactivity
		}
	}
	
	function toggleChallenge(eventId: string) {
		const eventIndex = editedEvents.findIndex(e => e.calendar_event_id === eventId);
		if (eventIndex !== -1) {
			editedEvents[eventIndex].is_challenge = !editedEvents[eventIndex].is_challenge;
			editedEvents = editedEvents;
		}
	}
	
	function toggleTarget(eventId: string) {
		const eventIndex = editedEvents.findIndex(e => e.calendar_event_id === eventId);
		if (eventIndex !== -1) {
			editedEvents[eventIndex].is_target = !editedEvents[eventIndex].is_target;
			editedEvents = editedEvents;
		}
	}
	
	async function applyBulkAction() {
		if (bulkAction === 'none' || selectedEventIds.size === 0) return;
		
		const selectedEvents = editedEvents.filter(e => selectedEventIds.has(e.calendar_event_id));
		
		switch (bulkAction) {
			case 'clear':
				// Clear holds (set to NA/no hold)
				selectedEvents.forEach(event => {
					const idx = editedEvents.findIndex(e => e.calendar_event_id === event.calendar_event_id);
					if (idx !== -1) {
						editedEvents[idx].hold_level = null;
						editedEvents[idx].status = 'CANCELLED';
					}
				});
				break;
				
			case 'restore':
				// Restore holds to H1
				selectedEvents.forEach(event => {
					const idx = editedEvents.findIndex(e => e.calendar_event_id === event.calendar_event_id);
					if (idx !== -1) {
						editedEvents[idx].hold_level = 'H1';
						editedEvents[idx].status = 'HOLD';
					}
				});
				break;
				
			case 'delete':
				// Remove from list (will delete from DB on save)
				editedEvents = editedEvents.filter(e => !selectedEventIds.has(e.calendar_event_id));
				break;
		}
		
		selectedEventIds.clear();
		bulkAction = 'none';
		editedEvents = editedEvents; // Trigger reactivity
	}
	
	async function saveChanges() {
		saving = true;
		
		try {
			// Update each modified event
			for (const event of editedEvents) {
				const { error } = await supabase
					.from('calendar_events')
					.update({
						status: event.status,
						hold_level: event.hold_level,
						is_challenge: event.is_challenge,
						is_target: event.is_target
					})
					.eq('calendar_event_id', event.calendar_event_id);
				
				if (error) throw error;
			}
			
			// Delete removed events
			const currentIds = editedEvents.map(e => e.calendar_event_id);
			const toDelete = events.filter(e => !currentIds.includes(e.calendar_event_id));
			
			if (toDelete.length > 0) {
				const { error } = await supabase
					.from('calendar_events')
					.delete()
					.in('calendar_event_id', toDelete.map(e => e.calendar_event_id));
				
				if (error) throw error;
			}
			
			dispatch('update');
			closeModal();
		} catch (err: any) {
			console.error('Error saving changes:', err);
			dispatch('error', { message: err.message || 'Failed to save changes' });
		} finally {
			saving = false;
		}
	}
	
	async function copyHoldsForDate() {
		let clipboardText = `Holds for ${selectedDate.toLocaleDateString('en-US', { 
			weekday: 'short', 
			month: 'short', 
			day: 'numeric',
			year: 'numeric'
		})}:\n\n`;
		
		editedEvents
			.sort((a, b) => {
				if (a.hold_level && b.hold_level) {
					return a.hold_level.localeCompare(b.hold_level);
				}
				return 0;
			})
			.forEach(event => {
				const level = event.hold_level || (event.status === 'CONFIRMED' ? '✓' : 'NA');
				const status = event.status === 'PENDING' ? ' (P)' : '';
				const challenge = event.is_challenge ? ' ⚡' : '';
				const target = event.is_target ? ' 🎯' : '';
				clipboardText += `${level}${status} - ${event.title}${challenge}${target}\n`;
			});
		
		clipboardText += '\nAny holds not listed are NA.';
		
		try {
			await navigator.clipboard.writeText(clipboardText);
			alert('Holds copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
	
	function closeModal() {
		isOpen = false;
		editedEvents = [];
		selectedEventIds.clear();
		bulkAction = 'none';
		dispatch('close');
	}
</script>

<Modal
	bind:isOpen
	title="Manage Holds - {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}"
	maxWidth="max-w-4xl"
	hasFooter={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		<!-- Toolbar -->
		<div class="flex items-center justify-between p-3 bg-black/30 rounded-xl">
			<div class="flex items-center gap-3">
				<button
					class="text-sm text-gray2 hover:text-white transition-colors"
					on:click={selectAll}
				>
					{selectedEventIds.size === editedEvents.length ? 'Deselect All' : 'Select All'}
				</button>
				
				{#if selectedEventIds.size > 0}
					<select
						bind:value={bulkAction}
						on:change={applyBulkAction}
						class="px-3 py-1.5 bg-black/50 border border-gray2/30 rounded-lg text-sm text-white
						       focus:border-lime focus:outline-none transition-colors cursor-pointer"
					>
						<option value="none">Bulk Actions...</option>
						<option value="clear">Clear Selected Holds</option>
						<option value="restore">Restore Selected Holds</option>
						<option value="delete">Delete Selected</option>
					</select>
					
					<span class="text-sm text-gray2">
						{selectedEventIds.size} selected
					</span>
				{/if}
			</div>
			
			<button
				class="px-3 py-1.5 bg-transparent text-gray2 border border-gray2 rounded-lg text-sm
				       hover:bg-lime hover:text-black hover:border-lime transition-all cursor-pointer"
				on:click={copyHoldsForDate}
			>
				Copy Holds
			</button>
		</div>
		
		<!-- Events List -->
		<div class="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
			{#if editedEvents.length === 0}
				<div class="text-center text-gray2 py-8">
					No events on this date
				</div>
			{:else}
				{#each editedEvents as event}
					<div class="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-gray2/20
					           hover:border-gray2/40 transition-all">
						<!-- Checkbox -->
						<input
							type="checkbox"
							checked={selectedEventIds.has(event.calendar_event_id)}
							on:change={() => toggleEventSelection(event.calendar_event_id)}
							class="w-4 h-4 rounded border-gray2 bg-black/50 text-lime 
							       focus:ring-lime focus:ring-offset-0"
						/>
						
						<!-- Hold Level Selector -->
						<select
							value={event.status === 'CONFIRMED' ? 'CONFIRMED' : event.hold_level || 'none'}
							on:change={(e) => updateHoldLevel(event.calendar_event_id, e.currentTarget.value)}
							class="px-3 py-2 bg-black/50 border rounded-lg text-sm font-bold cursor-pointer
							       focus:border-lime focus:outline-none transition-all
							       {holdLevelStyles[event.hold_level || (event.status === 'CONFIRMED' ? 'CONFIRMED' : '')] || 'border-gray2/30 text-gray2'}"
						>
							<option value="none">NA</option>
							{#each holdLevels as level}
								<option value={level}>{level}</option>
							{/each}
						</select>
						
						<!-- Event Info -->
						<div class="flex-1">
							<div class="font-bold text-white">{event.title}</div>
							{#if event.artist_name}
								<div class="text-sm text-gray2">{event.artist_name}</div>
							{/if}
						</div>
						
						<!-- Action Buttons -->
						<div class="flex items-center gap-2">
							<button
								class="p-1.5 rounded-lg transition-all
								       {event.is_challenge ? 'bg-red-500/30 text-red-400' : 'bg-black/30 text-gray2 hover:text-red-400'}"
								on:click={() => toggleChallenge(event.calendar_event_id)}
								title="Challenge Hold"
							>
								⚡
							</button>
							
							<button
								class="p-1.5 rounded-lg transition-all
								       {event.is_target ? 'bg-green-500/30 text-green-400' : 'bg-black/30 text-gray2 hover:text-green-400'}"
								on:click={() => toggleTarget(event.calendar_event_id)}
								title="Target Date"
							>
								🎯
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
		
		<!-- Info Text -->
		<div class="text-xs text-gray2 p-3 bg-black/20 rounded-lg">
			💡 Tip: Use H1-H6 for hold priorities, P for pending, or mark as Confirmed. 
			Challenge (⚡) and Target (🎯) flags help track special dates.
		</div>
	</div>
	
	<div slot="footer" class="flex gap-3 justify-end">
		<Button variant="outline" on:click={closeModal}>Cancel</Button>
		<Button
			variant={saving ? 'loading' : 'filled'}
			disabled={saving}
			on:click={saveChanges}
		>
			{saving ? 'Saving...' : 'Save Changes'}
		</Button>
	</div>
</Modal>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 3px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}
	
	select {
		appearance: none;
	}
	
	input[type="checkbox"] {
		accent-color: #E1FF00;
	}
</style>