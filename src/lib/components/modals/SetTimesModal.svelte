<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import {
		updateEventTimetable,
		type EventWithTimetable,
		type TimetableEntry as BaseTimetableEntry
	} from '$lib/services/eventsService';
	import Button from '../buttons/Button.svelte';

	export let isOpen = false;
	export let event: EventWithTimetable | null = null;
	const dispatch = createEventDispatcher();

	interface TimetableEntry extends BaseTimetableEntry {}

	let entries: TimetableEntry[] = [];
	let isSubmitting = false;
	let isDeleting = false;
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let dropdownState = { show: false, index: -1 };
	let showDeleteConfirm = false;
	const statusOptions: BaseTimetableEntry['status'][] = ['Default', 'Problem', 'Tentative', 'Proposed', 'Confirmed'];

	function confirmDelete() {
		showDeleteConfirm = true;
	}
	function cancelDelete() {
		showDeleteConfirm = false;
	}

	async function handleDelete() {
		if (!event || isDeleting) return;
		isDeleting = true;
		try {
			await updateEventTimetable(event.event_id, null);
			dispatch('save', { eventId: event.event_id, timetable: null });
			closeModal();
		} catch (error) {
			console.error('Error deleting timetable:', error);
			alert('Failed to delete timetable.');
		} finally {
			isDeleting = false;
			showDeleteConfirm = false;
		}
	}

	function calculateLengths() {
		const hadError = new Set();
		entries.forEach((entry) => {
			if (entry.status === 'Problem') hadError.add(entry.id);
		});

		const doorsEntry = entries.find((e) => e.artist === 'DOORS');
		const doorsTime = doorsEntry ? parseTime(doorsEntry.time) : null;
		const doorsIndex = doorsEntry ? entries.indexOf(doorsEntry) : -1;

		for (let i = 0; i < entries.length; i++) {
			let isProblem = false;
			const currentEntry = entries[i];
			const currentTime = parseTime(currentEntry.time);

			if (doorsTime && i === doorsIndex + 1 && currentTime) {
				const diffFromDoors = (currentTime.hours * 60 + currentTime.minutes) - (doorsTime.hours * 60 + doorsTime.minutes);
				if (diffFromDoors < 0) {
					isProblem = true;
				}
			}

			let nextTime = null;
			if (i < entries.length - 1) {
				nextTime = parseTime(entries[i + 1].time);
				if (currentTime && nextTime) {
					const diff = (nextTime.hours * 60 + nextTime.minutes) - (currentTime.hours * 60 + currentTime.minutes);
					if (diff < 0) {
						isProblem = true;
					}
				}
			}

			if (isProblem) {
				currentEntry.status = 'Problem';
			} else {
				if (hadError.has(currentEntry.id)) {
					currentEntry.status = 'Default';
				}
			}

			if (i === entries.length - 1 || currentEntry.artist === 'DOORS' || currentEntry.artist === 'CURFEW') {
				currentEntry.length = '';
				continue;
			}
			
			if (currentEntry.status === 'Problem') {
				currentEntry.length = 'Error';
			} else if (currentTime && nextTime) {
				const diff = (nextTime.hours * 60 + nextTime.minutes) - (currentTime.hours * 60 + currentTime.minutes);
				const hours = Math.floor(diff / 60);
				const mins = diff % 60;
				if (hours > 0 && mins > 0) currentEntry.length = `${hours}h ${mins}m`;
				else if (hours > 0) currentEntry.length = `${hours}h`;
				else currentEntry.length = `${mins}m`;
			} else {
				currentEntry.length = '';
			}
		}

		entries = [...entries];
	}

	function handleDragStart(e: DragEvent, index: number) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', 'dragging');
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedIndex = index;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}
	
	function toggleStatusDropdown(index: number) {
		if (dropdownState.show && dropdownState.index === index) {
			dropdownState.show = false;
		} else {
			dropdownState = { show: true, index };
		}
	}

	function selectStatus(status: BaseTimetableEntry['status']) {
		if (dropdownState.index !== -1) {
			entries[dropdownState.index].status = status;
			entries = [...entries];
		}
		dropdownState.show = false;
	}

	function generateTimeOptions(): string[] {
		const times: string[] = [];
		for (let hour = 22; hour < 24; hour++) {
			for (let min = 0; min < 60; min += 15) {
				const displayHour = hour > 12 ? hour - 12 : hour;
				times.push(`${displayHour}:${min.toString().padStart(2, '0')}PM`);
			}
		}
		for (let hour = 0; hour <= 3; hour++) {
			for (let min = 0; min < 60; min += 15) {
				const displayHour = hour === 0 ? 12 : hour;
				times.push(`${displayHour}:${min.toString().padStart(2, '0')}AM`);
			}
		}
		return times;
	}
	const timeOptions: string[] = generateTimeOptions();

	function adjustTime(index: number, direction: 'up' | 'down') {
		const entry = entries[index];
		const currentTimeIndex = timeOptions.indexOf(entry.time);
		if (currentTimeIndex !== -1) {
			const newIndex = direction === 'up' ?
				Math.min(currentTimeIndex + 1, timeOptions.length - 1) :
				Math.max(currentTimeIndex - 1, 0);
			entry.time = timeOptions[newIndex];
		}
		entries = [...entries];
		calculateLengths();
	}

	function formatTimeInput(index: number) {
		const entry = entries[index];
		const formatted = formatTime(entry.time);
		if (formatted) {
			entry.time = formatted;
			entries = [...entries];
		}
		calculateLengths();
	}

	function formatTime(input: string): string | null {
		const cleaned = input.replace(/\s/g, '').toUpperCase();
		const patterns = [/^(\d{1,2}):?(\d{2})?(AM|PM)?$/, /^(\d{1,2})(AM|PM)$/];
		for (const pattern of patterns) {
			const match = cleaned.match(pattern);
			if (match) {
				let hours = parseInt(match[1]);
				const minutes = match[2] ? parseInt(match[2]) : 0;
				let period = match[3] || match[2] || '';
				if (!period.includes('AM') && !period.includes('PM')) {
					if (hours >= 10 && hours <= 11) period = 'PM';
					else if (hours === 12) period = 'AM';
					else if (hours >= 1 && hours <= 9) period = 'AM';
					else period = 'PM';
				}
				if (hours === 0) hours = 12;
				if (hours > 12) hours -= 12;
				return `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
			}
		}
		return null;
	}

	function getStatusStyles(status: string): string {
		switch (status) {
			case 'Problem': return 'border-problem bg-problem/10 hover:bg-problem/20';
			case 'Tentative': return 'border-tentatif bg-tentatif/10 hover:bg-tentatif/20';
			case 'Proposed': return 'border-proposed bg-proposed/10 hover:bg-proposed/20';
			case 'Confirmed': return 'border-confirmed bg-confirmed/10 hover:bg-confirmed/20';
			default: return 'border-gray1 bg-gray1/10 hover:bg-gray1/20';
		}
	}

	$: if (typeof window !== 'undefined') {
		document.body.classList.toggle('modal-open', isOpen);
		if (!isOpen) dropdownState.show = false;
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') document.body.classList.remove('modal-open');
	});

	$: if (event && isOpen) loadExistingTimetable();

	function loadExistingTimetable() {
		if (!event) return;
		showDeleteConfirm = false;
		if (event.timetable && Array.isArray(event.timetable) && event.timetable.length > 0) {
			entries = event.timetable.map((entry) => ({ ...entry }));
		} else {
			resetToDefault();
		}
		calculateLengths();
	}

	function createEntry(
		time: string,
		artist: string = '',
		notes: string = '',
		status: 'Problem' | 'Tentative' | 'Proposed' | 'Confirmed' | 'Default' = 'Default'
	): TimetableEntry {
		return { id: Math.random().toString(36).substr(2, 9), time, artist, notes, status, length: '' };
	}

	function addEntry() {
		if (entries.length >= 7) return;
		const newEntry = createEntry('12:00AM', '', '', 'Default');
		if (entries.length > 1) {
			entries = [...entries.slice(0, -1), newEntry, entries[entries.length - 1]];
		} else {
			entries = [...entries, newEntry];
		}
		calculateLengths();
	}

	function removeEntry(index: number) {
		if (index === 0 || index === entries.length - 1) return;
		entries = entries.filter((_, i) => i !== index);
		calculateLengths();
	}

	function resetToDefault() {
		if (!event) return;
		entries = [
			createEntry('10:00PM', 'DOORS', '', 'Default'),
			createEntry('10:00PM', '', 'Local', 'Default'),
			createEntry('11:30PM', '', 'Support', 'Default'),
			createEntry('1:00AM', '', 'Headliner', 'Default'),
			createEntry('3:00AM', 'CURFEW', '', 'Default')
		];
		calculateLengths();
	}

	async function handleSave() {
		if (!event) return;
		const finalEntries = entries.map((entry) => {
			if (!entry.artist.trim() && entry.artist !== 'DOORS' && entry.artist !== 'CURFEW') {
				return { ...entry, artist: 'TBD', status: 'Tentative' as const };
			}
			return entry;
		});
		isSubmitting = true;
		try {
			await updateEventTimetable(event.event_id, finalEntries);
			dispatch('save', { eventId: event.event_id, timetable: finalEntries });
			closeModal();
		} catch (error) {
			console.error('Error saving timetable:', error);
			alert('Failed to save timetable.');
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.dropdown-portal') && !target.closest('.status-button')) {
			dropdownState.show = false;
		}
	}

	function parseTime(timeStr: string): { hours: number; minutes: number } | null {
		const match = timeStr.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
		if (!match) return null;
		let hours = parseInt(match[1]);
		const minutes = parseInt(match[2]);
		const period = match[3].toUpperCase();
		if (period === 'PM' && hours !== 12) hours += 12;
		if (period === 'AM' && hours === 12) hours = 0;
		if (hours < 10) hours += 24;
		return { hours, minutes };
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex || dropIndex === 0 || dropIndex === entries.length - 1) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}
		const item = entries.splice(draggedIndex, 1)[0];
		entries.splice(dropIndex, 0, item);
		draggedIndex = null;
		dragOverIndex = null;
		calculateLengths();
	}
</script>

<style>
	:global(body.modal-open) {
		overflow: hidden !important;
	}
	.dragging {
		opacity: 0.5;
	}
	.drag-over {
		box-shadow: 0 -2px 0 var(--color-lime);
	}
</style>

<svelte:window on:click={handleClickOutside} />

<Modal bind:isOpen title="Set Times - {event?.event_name || 'Event'}" maxWidth="max-w-4xl" hasFooter={true} on:close={closeModal}>
	<div class="space-y-4">
		{#if event}
			<div class="flex items-center justify-between mb-2">
				<h3 class="text-base font-bold text-white">Run of Show</h3>
				<div class="flex gap-2">
					<button on:click={resetToDefault} class="px-3 py-1.5 bg-gray1 text-white rounded-full font-bold text-xs border border-gray1 hover:border-lime hover:text-lime transition-colors cursor-pointer">Clear</button>
					<button on:click={addEntry} class="px-3 py-1.5 bg-lime text-black rounded-full font-bold text-xs hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={entries.length >= 7}>Add Line</button>
				</div>
			</div>

			<div class="grid grid-cols-13 gap-x-3 px-3 py-2 text-xs font-bold text-gray2 items-center">
				<div class="col-span-1"></div>
				<div class="col-span-2">Time</div>
				<div class="col-span-2 text-center">Length</div>
				<div class="col-span-3">Artist</div>
				<div class="col-span-2">Notes</div>
				<div class="col-span-2">Status</div>
				<div class="col-span-1"></div>
			</div>

			<div class="space-y-2 pr-2">
				{#each entries as entry, index (entry.id)}
					{@const formInputClasses = 'w-full bg-transparent border border-gray1 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all duration-200'}
					{@const isSpecialRow = entry.artist === 'DOORS' || entry.artist === 'CURFEW'}
					<div
						role="listitem"
						class="grid grid-cols-13 gap-x-3 items-center p-2.5 border rounded-lg transition-all duration-200 {getStatusStyles(entry.status)}"
						draggable={!isSpecialRow}
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
					>
						<div class="col-span-1 grid grid-cols-2 gap-1 items-center">
							<div class="flex items-center justify-center">
								{#if !isSpecialRow}
									<button class="cursor-move text-gray-400 hover:text-white" aria-label="Drag to reorder">
										<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" /></svg>
									</button>
								{/if}
							</div>
							<div class="flex flex-col">
								<button on:click={() => adjustTime(index, 'up')} class="text-gray2 hover:text-lime cursor-pointer" aria-label="Increase time">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6" /></svg>
								</button>
								<button on:click={() => adjustTime(index, 'down')} class="text-gray2 hover:text-lime cursor-pointer" aria-label="Decrease time">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6" /></svg>
								</button>
							</div>
						</div>

						<div class="col-span-2">
							<input type="text" class={formInputClasses} bind:value={entry.time} on:blur={() => formatTimeInput(index)} />
						</div>
						<div class="col-span-2 text-center">
							<span class="text-gray2 text-xs">{entry.length}</span>
						</div>
						<div class="col-span-3">
							{#if isSpecialRow}
								<span class="px-2.5 py-1.5 text-white font-bold text-xs">{entry.artist}</span>
							{:else}
								<input type="text" class={formInputClasses} bind:value={entry.artist} placeholder="Enter name" />
							{/if}
						</div>
						<div class="col-span-2">
							{#if !isSpecialRow}
								<input type="text" class={formInputClasses} bind:value={entry.notes} placeholder="Add" />
							{/if}
						</div>

						<div class="col-span-2 relative">
							{#if !isSpecialRow}
								<button type="button" class="{formInputClasses} status-button flex items-center justify-between text-left" on:click={() => toggleStatusDropdown(index)}>
									<span>{entry.status}</span>
									<svg class="w-3 h-3 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
								</button>

								{#if dropdownState.show && dropdownState.index === index}
									<div class="dropdown-portal absolute top-full mt-1 w-full bg-navbar border border-lime rounded-lg shadow-lg z-20 overflow-hidden" role="listbox">
										{#each statusOptions as option}
											<button
												type="button"
												class="w-full px-3 py-2 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer text-xs font-bold whitespace-nowrap"
												on:click={() => selectStatus(option)}
											>
												{option}
											</button>
										{/each}
									</div>
								{/if}
							{/if}
						</div>

						<div class="col-span-1 flex items-center justify-center">
							{#if !isSpecialRow}
								<button type="button" class="text-red-500/70 hover:text-red-500 transition-colors cursor-pointer" on:click={() => removeEntry(index)} aria-label="Remove entry">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div slot="footer" class="w-full flex justify-between items-center pt-2">
		<div class="flex-1">
			{#if showDeleteConfirm}
				<div class="flex items-center gap-2">
					<button class="px-6 py-3 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer" on:click={cancelDelete}>Cancel</button>
					<button class="px-6 py-3 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer" disabled={isDeleting} on:click={handleDelete}>
						{isDeleting ? '...' : 'Confirm'}
					</button>
				</div>
			{:else}
				<button class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer" disabled={isSubmitting || isDeleting} on:click={confirmDelete}>Delete</button>
			{/if}
		</div>
		<div class="flex gap-2">
			<button class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer" disabled={showDeleteConfirm} on:click={closeModal}>Cancel</button>
			<Button variant="filled" disabled={isSubmitting || isDeleting || showDeleteConfirm} on:click={handleSave}>
				{isSubmitting ? 'Saving...' : 'Done'}
			</Button>
		</div>
	</div>
</Modal>