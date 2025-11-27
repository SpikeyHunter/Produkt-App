<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { updateSSShow } from '$lib/services/ssShowService';

	export let isOpen = false;
    // We accept the full show object to get the ID, similar to how the original modal works
	export let show: any = null;
    export let initialSetTimes: any[] = [];

	const dispatch = createEventDispatcher();

	let entries: any[] = [];
	let isSubmitting = false;
	let isDeleting = false;
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let dropdownState = { show: false, index: -1 };
	let showDeleteConfirm = false;
	
    const statusOptions = ['Default', 'Problem', 'Tentative', 'Proposed', 'Confirmed'];

    const DEFAULT_SET_TIMES = [
        { time: '10:00PM', activity: 'Doors', status: 'Default' },
        { time: '10:00PM', activity: 'Local', status: 'Confirmed' },
        { time: '11:30PM', activity: 'Support', status: 'Confirmed' },
        { time: '1:00AM', activity: 'Sultan + Shepard', status: 'Confirmed' },
        { time: '3:00AM', activity: 'Curfew', status: 'Default' }
    ];

	function confirmDelete() {
		showDeleteConfirm = true;
	}
	function cancelDelete() {
		showDeleteConfirm = false;
	}

	async function handleDelete() {
		if (!show || isDeleting) return;
		isDeleting = true;
		try {
			await updateSSShow(show.id, { show_settimes: [] });
			dispatch('save', { settimes: [] });
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

        // Find DOORS to check logic
		const doorsEntry = entries.find((e) => e.activity === 'Doors' || e.activity === 'DOORS');
		const doorsTime = doorsEntry ? parseTime(doorsEntry.time) : null;
		const doorsIndex = doorsEntry ? entries.indexOf(doorsEntry) : -1;

		for (let i = 0; i < entries.length; i++) {
			let isProblem = false;
			const currentEntry = entries[i];
			const currentTime = parseTime(currentEntry.time);

            // Check against doors
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
                    // If time goes backwards (and isn't just crossing midnight logic handled in parseTime), flag it
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

            // Skip calculation for last entry or specific keywords
			if (i === entries.length - 1 || currentEntry.activity === 'DOORS' || currentEntry.activity === 'CURFEW') {
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

	function selectStatus(status: string) {
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

	$: if (show && isOpen) loadExistingTimetable();

	function loadExistingTimetable() {
		if (!show) return;
		showDeleteConfirm = false;
		if (initialSetTimes && Array.isArray(initialSetTimes) && initialSetTimes.length > 0) {
			// Ensure every entry has an ID for keyed blocks
			entries = initialSetTimes.map((entry) => ({ 
                ...entry, 
                id: entry.id || Math.random().toString(36).substr(2, 9) 
            }));
		} else {
			resetToDefault();
		}
		calculateLengths();
	}

	function createEntry(
		time: string,
		activity: string = '',
		status: string = 'Default'
	) {
		return { id: Math.random().toString(36).substr(2, 9), time, activity, status, length: '' };
	}

	function addEntry() {
		if (entries.length >= 10) return;
		const newEntry = createEntry('12:00AM', '', 'Default');
		if (entries.length > 1) {
			entries = [...entries.slice(0, -1), newEntry, entries[entries.length - 1]];
		} else {
			entries = [...entries, newEntry];
		}
		calculateLengths();
	}

	function removeEntry(index: number) {
		// Prevent removing the first/last if you want to enforce Doors/Curfew logic, 
        // but typically for freedom we allow removal, just re-calc lengths
		entries = entries.filter((_, i) => i !== index);
		calculateLengths();
	}

	function resetToDefault() {
        // Use the specific Sultan + Shepard defaults
		entries = DEFAULT_SET_TIMES.map(d => createEntry(d.time, d.activity, d.status));
		calculateLengths();
	}

	async function handleSave() {
		if (!show) return;
		const finalEntries = entries.map((entry) => {
			if (!entry.activity.trim() && entry.activity !== 'DOORS' && entry.activity !== 'CURFEW') {
				return { ...entry, activity: 'TBD', status: 'Tentative' };
			}
			return entry;
		});
		isSubmitting = true;
		try {
			await updateSSShow(show.id, { show_settimes: finalEntries });
			dispatch('save', { settimes: finalEntries });
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
        // Handle "next day" hours (0-9 AM) so 1:00AM is considered after 10:00PM
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
		if (draggedIndex === null || draggedIndex === dropIndex) {
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

<Modal bind:isOpen title="Set Times - {show?.show_venue || 'Event'}" maxWidth="max-w-4xl" hasFooter={true} on:close={closeModal}>
	<div class="space-y-4">
		{#if show}
			<div class="flex items-center justify-between mb-2">
				<h3 class="text-base font-bold text-white">Run of Show</h3>
				<div class="flex gap-2">
					<button on:click={resetToDefault} class="px-3 py-1.5 bg-gray1 text-white rounded-full font-bold text-xs border border-gray1 hover:border-lime hover:text-lime transition-colors cursor-pointer">Reset</button>
					<button on:click={addEntry} class="px-3 py-1.5 bg-lime text-black rounded-full font-bold text-xs hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={entries.length >= 10}>Add Line</button>
				</div>
			</div>

			<div class="grid grid-cols-12 gap-x-3 px-3 py-2 text-xs font-bold text-gray2 items-center">
				<div class="col-span-1"></div>
				<div class="col-span-2">Time</div>
				<div class="col-span-2 text-center">Length</div>
				<div class="col-span-4">Activity / Artist</div>
				<div class="col-span-2">Status</div>
				<div class="col-span-1"></div>
			</div>

			<div class="space-y-2 pr-2">
				{#each entries as entry, index (entry.id)}
					{@const formInputClasses = 'w-full bg-transparent border border-gray1 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all duration-200'}
                    <div
						role="listitem"
						class="grid grid-cols-12 gap-x-3 items-center p-2.5 border rounded-lg transition-all duration-200 {getStatusStyles(entry.status)}"
						draggable={true}
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
					>
						<div class="col-span-1 grid grid-cols-2 gap-1 items-center">
							<div class="flex items-center justify-center">
								<button class="cursor-move text-gray-400 hover:text-white" aria-label="Drag to reorder">
									<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" /></svg>
								</button>
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
						<div class="col-span-4">
							<input type="text" class={formInputClasses} bind:value={entry.activity} placeholder="Artist Name" />
						</div>

						<div class="col-span-2 relative">
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
						</div>

						<div class="col-span-1 flex items-center justify-center">
							<button type="button" class="text-red-500/70 hover:text-red-500 transition-colors cursor-pointer" on:click={() => removeEntry(index)} aria-label="Remove entry">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
							</button>
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
            <button class="px-6 py-3 bg-lime text-black rounded-full font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer" disabled={isSubmitting || isDeleting || showDeleteConfirm} on:click={handleSave}>
				{isSubmitting ? 'Saving...' : 'Done'}
			</button>
		</div>
	</div>
</Modal>