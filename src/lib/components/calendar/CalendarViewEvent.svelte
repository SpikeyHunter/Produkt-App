<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { CalendarEvent, HoldLevel } from '$lib/types/calendar-types';
	import { tick, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let show: boolean;
	export let event: CalendarEvent | null;

	let dialogEl: HTMLDivElement;
	let saving = false;
	const dispatch = createEventDispatcher();
	const holdNumbers = Array.from({ length: 20 }, (_, i) => i + 1);

	// 🚨 STATE CLONING: Prevents background refreshing while interacting
	let localEvent: CalendarEvent | null = null;
	let hasUnsavedChanges = false;

	// Notes Editor State
	let tempNotes = '';
	let isEditingNotes = false;

	$: if (show && event && (!localEvent || localEvent.id !== event.id)) {
		localEvent = JSON.parse(JSON.stringify(event));
		tempNotes = localEvent?.details?.notes || ''; // <-- Added '?' here
		isEditingNotes = false;
		hasUnsavedChanges = false;
	}

	$: if (!show) {
		localEvent = null;
		confirmMode = 'none';
		hasUnsavedChanges = false;
		isEditingNotes = false;
	}

	let confirmMode: 'none' | 'clearSingle' | 'clearAll' | 'confirm' = 'none';

	let sameEventOtherRoomsCount = 0;
	let otherEventsOnDayCount = 0;
	let optConfirmAllRooms = false;
	let optClearOtherHolds = false;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
		if ((e.key === 'Enter' || e.key === ' ') && e.target === dialogEl) {
			e.preventDefault();
			closeModal();
		}
	}

	async function closeModal() {
		if (hasUnsavedChanges) {
			await flushChanges();
		}
		show = false;
		dispatch('close');
	}

	function updateHoldLevel(level: HoldLevel) {
		if (!localEvent) return;
		localEvent.hold_level = level;
		localEvent.status = level === 'P' ? 'PENDING' : 'HOLD';
		hasUnsavedChanges = true;
	}

	function toggleFlag(flag: 'is_target' | 'is_challenge') {
		if (!localEvent) return;
		localEvent.details[flag] = !localEvent.details[flag];
		hasUnsavedChanges = true;
	}

	function saveNotes() {
		if (!localEvent) return;
		localEvent.details.notes = tempNotes;
		isEditingNotes = false;
		hasUnsavedChanges = true;
	}

	function cancelNotes() {
		if (!localEvent) return;
		tempNotes = localEvent.details.notes || '';
		isEditingNotes = false;
	}

	async function flushChanges() {
		if (!localEvent || !hasUnsavedChanges) return;
		saving = true;
		try {
			await supabase
				.from('calendar_events')
				.update({
					status: localEvent.status,
					hold_level: localEvent.hold_level
				})
				.eq('id', localEvent.id);
				
			if (localEvent.group_id) {
				await supabase
					.from('calendar')
					.update({
						details: localEvent.details,
						title: localEvent.title
					})
					.eq('id', localEvent.group_id);
			}
			dispatch('update');
		} catch (err) {
			console.error('Update failed:', err);
		} finally {
			saving = false;
			hasUnsavedChanges = false;
		}
	}

	async function executeClearSingle() {
		if (!localEvent) return;
		saving = true;
		try {
			const { count } = await supabase
				.from('calendar_events')
				.select('*', { count: 'exact', head: true })
				.eq('group_id', localEvent.group_id)
				.neq('id', localEvent.id);

			if (count === 0 && localEvent.group_id) {
				await supabase.from('calendar').delete().eq('id', localEvent.group_id);
			} else {
				await supabase.from('calendar_events').delete().eq('id', localEvent.id);
			}
			dispatch('update');
			show = false;
		} catch (e) {
			console.error(e);
		} finally {
			saving = false;
		}
	}

	async function executeClearAll() {
		if (!localEvent || !localEvent.group_id) return;
		saving = true;
		try {
			const { count } = await supabase
				.from('calendar_events')
				.select('*', { count: 'exact', head: true })
				.eq('group_id', localEvent.group_id)
				.eq('status', 'CONFIRMED');

			if (count === 0) {
				await supabase.from('calendar').delete().eq('id', localEvent.group_id);
			} else {
				await supabase
					.from('calendar_events')
					.delete()
					.eq('group_id', localEvent.group_id)
					.neq('status', 'CONFIRMED');
			}
			dispatch('update');
			show = false;
		} catch (e) {
			console.error(e);
		} finally {
			saving = false;
		}
	}

	async function setupConfirm() {
		if (!localEvent) return;
		saving = true;
		try {
			const { data } = await supabase
				.from('calendar_events')
				.select('id, group_id')
				.eq('date', localEvent.date)
				.in('status', ['HOLD', 'PENDING']);

			if (data) {
				sameEventOtherRoomsCount = data.filter(
					(d) => d.group_id === localEvent?.group_id && d.id !== localEvent?.id
				).length;
				otherEventsOnDayCount = data.filter((d) => d.group_id !== localEvent?.group_id).length;
			}
			optConfirmAllRooms = false;
			optClearOtherHolds = false;
			confirmMode = 'confirm';
		} finally {
			saving = false;
		}
	}

	async function executeConfirm() {
		if (!localEvent) return;
		saving = true;
		try {
			await supabase
				.from('calendar_events')
				.update({ status: 'CONFIRMED', hold_level: null })
				.eq('id', localEvent.id);

			await supabase
				.from('calendar_events')
				.update({ status: 'HIDDEN' })
				.eq('group_id', localEvent.group_id)
				.in('status', ['HOLD', 'PENDING'])
				.neq('id', localEvent.id)
				.neq('date', localEvent.date);

			if (sameEventOtherRoomsCount > 0) {
				if (optConfirmAllRooms) {
					await supabase
						.from('calendar_events')
						.update({ status: 'CONFIRMED', hold_level: null })
						.eq('group_id', localEvent.group_id)
						.eq('date', localEvent.date)
						.in('status', ['HOLD', 'PENDING']);
				} else {
					await supabase
						.from('calendar_events')
						.update({ status: 'HIDDEN' })
						.eq('group_id', localEvent.group_id)
						.eq('date', localEvent.date)
						.in('status', ['HOLD', 'PENDING'])
						.neq('id', localEvent.id);
				}
			}

			if (optClearOtherHolds && otherEventsOnDayCount > 0) {
				await supabase
					.from('calendar_events')
					.update({ status: 'HIDDEN' })
					.eq('date', localEvent.date)
					.neq('group_id', localEvent.group_id)
					.in('status', ['HOLD', 'PENDING']);
			}

			dispatch('update');
			show = false;
		} catch (e) {
			console.error(e);
		} finally {
			saving = false;
		}
	}

	$: if (show && dialogEl) {
		tick().then(() => dialogEl.focus());
	}
</script>

{#if show && localEvent}
	<div
		bind:this={dialogEl}
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 outline-none z-[9999]"
		transition:fade={{ duration: 200, easing: cubicOut }}
		on:click|self={closeModal}
		on:keydown={handleKeydown}
		role="button"
		tabindex="0"
		aria-label="Close modal backdrop"
	>
		<div
			class="bg-gray1 rounded-2xl max-w-md w-full relative shadow-2xl border border-gray2/20 flex flex-col max-h-[90vh] overflow-hidden"
			transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
		>
			<div class="flex items-start justify-between p-6 pb-4 shrink-0">
				<div>
					<h3 class="text-xl font-black text-white leading-tight uppercase tracking-wide">
						{localEvent.title}
					</h3>
					<p class="text-sm font-bold text-gray2 mt-1">
						{new Date(localEvent.date + 'T00:00:00').toLocaleDateString('en-US', {
							weekday: 'long',
							month: 'long',
							day: 'numeric',
							year: 'numeric'
						})}
					</p>
				</div>
				<button
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={closeModal}
					disabled={saving}
					aria-label="Close modal"
				>
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="border-b border-gray2/20 mx-6"></div>

			<div class="px-6 py-4 flex items-center justify-between border-b border-gray2/10 shrink-0">
				<div class="flex items-center gap-2">
					<svg class="w-5 h-5 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
						<circle cx="12" cy="10" r="3"></circle>
					</svg>
					<p class="text-sm font-bold text-white">
						{localEvent.venue.category || 'No Venue'}
						{#if localEvent.venue.room}
							<span class="text-gray2 font-normal">/ {localEvent.venue.room}</span>
						{/if}
					</p>
				</div>
				<button
					class="text-sm font-bold text-lime hover:underline flex items-center gap-1 cursor-pointer"
					aria-label="View Event Details"
				>
					View Event 
					<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
					</svg>
				</button>
			</div>

			{#if confirmMode === 'none'}
				<div class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
					<div>
						<p class="text-sm font-bold text-gray2 mb-3">Hold Level</p>
						<div class="grid grid-cols-7 gap-2">
							<button
								class="py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer {localEvent.hold_level === 'P'
									? 'bg-lime text-black border-lime'
									: 'bg-black/50 text-gray2 border-gray2/30 hover:border-gray2 hover:text-white'}"
								on:click={() => updateHoldLevel('P')}>P</button>
							{#each holdNumbers as num}
								<button
									class="py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer {localEvent.hold_level === `H${num}`
										? 'bg-lime text-black border-lime'
										: 'bg-black/50 text-gray2 border-gray2/30 hover:border-gray2 hover:text-white'}"
									on:click={() => updateHoldLevel(`H${num}` as HoldLevel)}>{num}</button>
							{/each}
						</div>
					</div>

					<div class="flex flex-col gap-4">
						<button 
							class="w-full py-3 rounded-2xl border border-gray2/30 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 hover:bg-white/5 cursor-pointer"
							on:click={() => { dispatch('manageHolds'); }}
						>
							<svg class="w-4 h-4 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>
							</svg>
							Manage Holds
						</button>

						<div class="grid grid-cols-2 gap-3">
							<button
								class="py-2.5 rounded-2xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer {localEvent.details.is_target
									? 'text-confirmed border-confirmed bg-transparent'
									: 'border-gray2/30 text-gray2 bg-transparent hover:text-white hover:border-gray2'}"
								on:click={() => toggleFlag('is_target')}
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>
								</svg>
								{localEvent.details.is_target ? 'Remove Target' : 'Add Target'}
							</button>
							
							<button
								class="py-2.5 rounded-2xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer {localEvent.details.is_challenge
									? 'text-tentatif border-tentatif bg-transparent'
									: 'border-gray2/30 text-gray2 bg-transparent hover:text-white hover:border-gray2'}"
								on:click={() => toggleFlag('is_challenge')}
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
								</svg>
								{localEvent.details.is_challenge ? 'Remove Challenge' : 'Challenge Hold'}
							</button>
						</div>
					</div>

					<div>
						<p class="text-[10px] font-bold text-gray2 uppercase mb-1 ml-1">Event Description</p>
						<div class="relative">
							<textarea
								bind:value={tempNotes}
								on:input={() => isEditingNotes = true}
								rows="4"
								placeholder="Add notes..."
								class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-2xl text-white placeholder-gray2/50 focus:border-lime focus:outline-none resize-none transition-colors"
							></textarea>
							
							{#if isEditingNotes}
								<div class="flex justify-end gap-2 mt-2" transition:fade={{duration: 150}}>
									<button class="w-8 h-8 flex items-center justify-center rounded-lg border border-problem/50 text-problem hover:bg-problem/10 transition-colors cursor-pointer" on:click={cancelNotes} aria-label="Cancel edit">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
									</button>
									<button class="w-8 h-8 flex items-center justify-center rounded-lg border border-lime/50 text-lime hover:bg-lime/10 transition-colors cursor-pointer" on:click={saveNotes} aria-label="Save edits">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="p-6 border-t border-gray2/20 flex gap-3 shrink-0">
					<button
						class="flex-1 py-3 px-2 border border-problem/50 text-problem font-bold text-sm rounded-2xl hover:bg-problem/10 transition-colors cursor-pointer"
						on:click={() => (confirmMode = 'clearAll')}>Clear All Holds</button>
					<button
						class="flex-1 py-3 px-2 border border-gray2/30 text-gray2 hover:text-white font-bold text-sm rounded-2xl hover:bg-gray2/10 transition-colors cursor-pointer"
						on:click={() => (confirmMode = 'clearSingle')}>Clear Hold</button>
					<button
						class="flex-1 py-3 px-2 bg-lime text-black font-bold text-sm rounded-2xl hover:bg-lime/90 transition-colors cursor-pointer"
						on:click={setupConfirm}
						disabled={saving}>Confirm</button>
				</div>

			{:else if confirmMode === 'clearSingle' || confirmMode === 'clearAll'}
				<div class="p-8 flex-1 flex flex-col items-center justify-center text-center">
					<div class="w-16 h-16 rounded-full bg-problem/10 flex items-center justify-center mb-6">
						<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
</svg>
					</div>
					<h3 class="text-xl font-black text-white mb-2">Are you sure?</h3>
					<p class="text-sm font-bold text-gray2 mb-8">
						{confirmMode === 'clearAll'
							? 'This will permanently wipe all non-confirmed holds associated with this event globally.'
							: 'This will permanently remove this specific hold from the calendar.'}
					</p>
					<div class="flex gap-3 w-full">
						<button
							class="flex-1 py-3 bg-transparent border border-gray2/20 text-gray2 font-bold rounded-2xl hover:bg-gray2/10 hover:text-white transition-colors cursor-pointer"
							on:click={() => (confirmMode = 'none')}>Cancel</button>
						<button
							class="flex-1 py-3 bg-problem text-black font-bold rounded-2xl hover:bg-problem/90 transition-colors cursor-pointer"
							on:click={confirmMode === 'clearAll' ? executeClearAll : executeClearSingle}
							disabled={saving}>Confirm</button>
					</div>
				</div>

			{:else if confirmMode === 'confirm'}
				<div class="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
					<div class="flex items-center gap-3 mb-6">
						<div class="w-10 h-10 rounded-full bg-lime/20 flex items-center justify-center shrink-0">
							<span class="text-lime font-black text-xl">✓</span>
						</div>
						<div class="text-left">
							<h3 class="text-lg font-black text-white">Confirm Event</h3>
							<p class="text-[11px] font-bold text-gray2">
								Finalizing this date will auto-hide alternate holds for this event.
							</p>
						</div>
					</div>

					<div class="space-y-3 mb-8">
						{#if sameEventOtherRoomsCount > 0}
							<label class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optConfirmAllRooms ? 'border-lime/50 bg-lime/5' : ''}">
								<div class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optConfirmAllRooms ? 'bg-lime border-lime' : 'border-2 border-gray2 bg-transparent'}" aria-hidden="true">
									{#if optConfirmAllRooms}
										<svg class="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									{/if}
								</div>
								<p class="text-sm font-bold text-white leading-tight">Confirm all holds for the same venue for this event</p>
								<input type="checkbox" class="hidden" bind:checked={optConfirmAllRooms} aria-label="Confirm all holds for the same venue for this event"/>
							</label>
						{/if}

						{#if otherEventsOnDayCount > 0}
							<label class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optClearOtherHolds ? 'border-lime/50 bg-lime/5' : ''}">
								<div class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optClearOtherHolds ? 'bg-lime border-lime' : 'border-2 border-gray2 bg-transparent'}" aria-hidden="true">
									{#if optClearOtherHolds}
										<svg class="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"></polyline>
										</svg>
									{/if}
								</div>
								<p class="text-sm font-bold text-white leading-tight">Clear all relevant holds (including pending) on this day</p>
								<input type="checkbox" class="hidden" bind:checked={optClearOtherHolds} aria-label="Clear all relevant holds including pending on this day"/>
							</label>
						{/if}

						{#if sameEventOtherRoomsCount === 0 && otherEventsOnDayCount === 0}
							<div class="py-8 text-center">
								<p class="text-sm font-bold text-gray2">No scheduling conflicts detected for this date!</p>
							</div>
						{/if}
					</div>

					<div class="mt-auto flex gap-3 w-full shrink-0">
						<button
							class="flex-1 py-3 bg-transparent border border-gray2/20 text-gray2 font-bold rounded-2xl hover:bg-gray2/10 hover:text-white transition-colors cursor-pointer"
							on:click={() => (confirmMode = 'none')}>Cancel</button>
						<button
							class="flex-[1.5] py-3 bg-lime text-black font-bold rounded-2xl hover:bg-lime/90 transition-colors cursor-pointer flex justify-center items-center"
							on:click={executeConfirm}
							disabled={saving}
						>
							{#if saving}<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2"></div>{/if}
							Confirm Event
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(247, 247, 247, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>