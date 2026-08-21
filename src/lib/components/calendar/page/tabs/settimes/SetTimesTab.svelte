<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { fade, fly } from 'svelte/transition';
	import {
		updateEventTimetable,
		type TimetableEntry as BaseTimetableEntry
	} from '$lib/services/eventsService';
	import {
		buildDefaultTimetable,
		parseTimetableClock
	} from '$lib/services/timetableSync';

	// Props passed by the tab host (+page.svelte) — some are unused here but
	// declared so svelte:component can pass them without "unknown prop" warnings.
	export let userRole = 'Email Only';
	export let event: any = null;
	export let eventDealData: any = {};
	export let eventDate: string = '';
	export let venueCurrency: string = 'CAD';
	export let viewedVersionNum: number = 1;
	export let overrideCalendarData: any = null;
	// Mark the host-injected props as read so the compiler doesn't flag them.
	$: void [eventDealData, eventDate, venueCurrency, viewedVersionNum, overrideCalendarData];

	interface TimetableEntry extends BaseTimetableEntry {}

	$: canEdit = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: groupId = event?.calendar?.id || event?.group_id || null;

	let loading = true;
	let linkedEvent: {
		event_id: number;
		event_name: string;
		event_date: string;
		event_venue: string | null;
		timetable: TimetableEntry[] | null;
	} | null = null;

	let entries: TimetableEntry[] = [];
	let isDirty = false;
	let isSubmitting = false;
	let saveMessage = '';
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let dropdownState = { show: false, index: -1 };

	const statusOptions: BaseTimetableEntry['status'][] = [
		'Default',
		'Problem',
		'Tentative',
		'Proposed',
		'Confirmed'
	];
	const statusDisplayNames: Record<BaseTimetableEntry['status'], string> = {
		Default: 'Draft',
		Problem: 'Problem',
		Tentative: 'Set Time Pending',
		Proposed: 'Artist Confirmed',
		Confirmed: 'Approved & Advanced'
	};

	// --- Calendar event time (drives the default DOORS/CURFEW when seeding) ---
	function parsedEventTime(): { start: string | null; end: string | null } {
		let t: any = event?.time;
		try {
			if (typeof t === 'string') t = JSON.parse(t);
		} catch (e) {
			t = null;
		}
		if (!t || typeof t !== 'object') return { start: null, end: null };
		return { start: t.start || null, end: t.end || null };
	}

	async function loadLinkedEvent() {
		loading = true;
		linkedEvent = null;
		entries = [];
		isDirty = false;
		if (!groupId) {
			loading = false;
			return;
		}
		const { data, error } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_venue, timetable')
			.eq('calendar_link', groupId)
			.limit(1)
			.maybeSingle();

		if (error) console.error('[SetTimesTab] Failed to load linked event:', error);
		linkedEvent = data || null;

		if (linkedEvent) {
			if (Array.isArray(linkedEvent.timetable) && linkedEvent.timetable.length > 0) {
				entries = linkedEvent.timetable.map((e) => ({ ...e }));
			} else {
				// No timetable yet — preview the default template (saved on Done).
				const t = parsedEventTime();
				entries = buildDefaultTimetable(t.start, t.end);
				isDirty = true;
			}
			calculateLengths();
		}
		loading = false;
	}

	// Load on init + reload when navigating to a different calendar event.
	let _loadedGroupId: string | null = null;
	$: if (groupId && groupId !== _loadedGroupId) {
		_loadedGroupId = groupId;
		loadLinkedEvent();
	}

	// --- Editor logic (parity with SetTimesModal) ---

	function createEntry(
		time: string,
		artist: string = '',
		notes: string = '',
		status: BaseTimetableEntry['status'] = 'Default'
	): TimetableEntry {
		return { id: Math.random().toString(36).substr(2, 9), time, artist, notes, status, length: '' };
	}

	function calculateLengths() {
		const hadError = new Set();
		entries.forEach((entry) => {
			if (entry.status === 'Problem') hadError.add(entry.id);
		});

		const doorsEntry = entries.find((e) => e.artist === 'DOORS');
		const doorsMins = doorsEntry ? parseTimetableClock(doorsEntry.time) : null;
		const doorsIndex = doorsEntry ? entries.indexOf(doorsEntry) : -1;

		for (let i = 0; i < entries.length; i++) {
			let isProblem = false;
			const currentEntry = entries[i];
			const currentMins = parseTimetableClock(currentEntry.time);

			if (doorsMins != null && i === doorsIndex + 1 && currentMins != null) {
				if (currentMins - doorsMins < 0) isProblem = true;
			}

			let nextMins: number | null = null;
			if (i < entries.length - 1) {
				nextMins = parseTimetableClock(entries[i + 1].time);
				if (currentMins != null && nextMins != null && nextMins - currentMins < 0) {
					isProblem = true;
				}
			}

			if (isProblem) {
				currentEntry.status = 'Problem';
			} else if (hadError.has(currentEntry.id)) {
				currentEntry.status = 'Default';
			}

			if (
				i === entries.length - 1 ||
				currentEntry.artist === 'DOORS' ||
				currentEntry.artist === 'CURFEW'
			) {
				currentEntry.length = '';
				continue;
			}

			if (currentEntry.status === 'Problem') {
				currentEntry.length = 'Error';
			} else if (currentMins != null && nextMins != null) {
				const diff = nextMins - currentMins;
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

	function markDirty() {
		isDirty = true;
		saveMessage = '';
	}

	function adjustTime(index: number, direction: 'up' | 'down') {
		if (!canEdit) return;
		const entry = entries[index];
		const mins = parseTimetableClock(entry.time);
		if (mins == null) return;
		let next = mins + (direction === 'up' ? 15 : -15);
		let hours = Math.floor(next / 60) % 24;
		const minutes = ((next % 60) + 60) % 60;
		if (hours < 0) hours += 24;
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const h12 = hours % 12 || 12;
		entry.time = `${h12}:${String(minutes).padStart(2, '0')}${ampm}`;
		markDirty();
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

	function formatTimeInput(index: number) {
		const entry = entries[index];
		const formatted = formatTime(entry.time);
		if (formatted) {
			entry.time = formatted;
			entries = [...entries];
		}
		markDirty();
		calculateLengths();
	}

	function addEntry() {
		if (!canEdit || entries.length >= 9) return;
		const newEntry = createEntry('12:00AM', '', '', 'Default');
		if (entries.length > 1) {
			entries = [...entries.slice(0, -1), newEntry, entries[entries.length - 1]];
		} else {
			entries = [...entries, newEntry];
		}
		markDirty();
		calculateLengths();
	}

	function removeEntry(index: number) {
		if (!canEdit || index === 0 || index === entries.length - 1) return;
		entries = entries.filter((_, i) => i !== index);
		markDirty();
		calculateLengths();
	}

	function resetToTemplate() {
		if (!canEdit) return;
		const t = parsedEventTime();
		entries = buildDefaultTimetable(t.start, t.end);
		markDirty();
		calculateLengths();
	}

	function toggleStatusDropdown(index: number) {
		if (!canEdit) return;
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
			markDirty();
		}
		dropdownState.show = false;
	}

	function getStatusStyles(status: string): string {
		switch (status) {
			case 'Problem':
				return 'border-problem bg-problem/10 hover:bg-problem/20';
			case 'Tentative':
				return 'border-tentatif bg-tentatif/10 hover:bg-tentatif/20';
			case 'Proposed':
				return 'border-proposed bg-proposed/10 hover:bg-proposed/20';
			case 'Confirmed':
				return 'border-confirmed bg-confirmed/10 hover:bg-confirmed/20';
			default:
				return 'border-gray1 bg-gray1/10 hover:bg-gray1/20';
		}
	}

	// --- Drag & drop reorder ---
	function handleDragStart(e: DragEvent, index: number) {
		if (!canEdit) {
			e.preventDefault();
			return;
		}
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', 'dragging');
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedIndex = index;
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
		if (
			draggedIndex === null ||
			draggedIndex === dropIndex ||
			dropIndex === 0 ||
			dropIndex === entries.length - 1
		) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}
		const item = entries.splice(draggedIndex, 1)[0];
		entries.splice(dropIndex, 0, item);
		draggedIndex = null;
		dragOverIndex = null;
		markDirty();
		calculateLengths();
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.dropdown-portal') && !target.closest('.status-button')) {
			dropdownState.show = false;
		}
	}

	async function handleSave() {
		if (!linkedEvent || !canEdit || isSubmitting) return;
		const finalEntries = entries.map((entry) => {
			if (!entry.artist.trim() && entry.artist !== 'DOORS' && entry.artist !== 'CURFEW') {
				return { ...entry, artist: 'TBD', status: 'Tentative' as const };
			}
			return entry;
		});
		isSubmitting = true;
		try {
			await updateEventTimetable(linkedEvent.event_id, finalEntries);
			linkedEvent.timetable = finalEntries;
			entries = finalEntries.map((e) => ({ ...e }));
			isDirty = false;
			saveMessage = 'Set times saved';
			setTimeout(() => (saveMessage = ''), 3000);
		} catch (error) {
			console.error('[SetTimesTab] Error saving timetable:', error);
			saveMessage = 'Failed to save set times';
		} finally {
			isSubmitting = false;
		}
	}

	function formatDisplayDate(dateString: string): string {
		if (!dateString) return 'TBD';
		try {
			const date = new Date(dateString);
			date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
			return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
		} catch (e) {
			return dateString;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="flex flex-col h-full bg-navbar text-white relative">
	<div class="px-8 pt-6 pb-3 flex justify-between items-center shrink-0">
		<div>
			<h2 class="text-xl font-black uppercase tracking-wide text-lime">Set Times</h2>
			{#if linkedEvent}
				<p class="text-xs text-gray2 font-bold mt-1">
					{linkedEvent.event_name} — {formatDisplayDate(linkedEvent.event_date)}
					{#if linkedEvent.event_venue}· {linkedEvent.event_venue}{/if}
				</p>
			{/if}
		</div>
		{#if linkedEvent && canEdit}
			<div class="flex items-center gap-3">
				{#if saveMessage}
					<span
						transition:fade={{ duration: 150 }}
						class="text-xs font-bold {saveMessage.startsWith('Failed')
							? 'text-problem'
							: 'text-lime'}">{saveMessage}</span
					>
				{/if}
				<button
					on:click={resetToTemplate}
					class="px-4 py-2 bg-gray1 text-white rounded-full font-bold text-xs border border-gray1 hover:border-lime hover:text-lime transition-colors cursor-pointer"
				>
					Reset Template
				</button>
				<button
					on:click={addEntry}
					disabled={entries.length >= 9}
					class="px-4 py-2 bg-gray1 text-white rounded-full font-bold text-xs border border-gray1 hover:border-lime hover:text-lime transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Add Line
				</button>
				<button
					on:click={handleSave}
					disabled={!isDirty || isSubmitting}
					class="px-6 py-2 font-bold rounded-full text-xs transition-opacity {isDirty && !isSubmitting
						? 'bg-lime text-black hover:opacity-90 cursor-pointer'
						: 'bg-gray2 text-black/50 cursor-not-allowed opacity-50'}"
				>
					{isSubmitting ? 'Saving...' : 'Save Set Times'}
				</button>
			</div>
		{/if}
	</div>

	<div class="px-8 pt-4 pb-24 flex-1 overflow-y-auto">
		{#if loading}
			<div class="w-full h-40 flex items-center justify-center">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
			</div>
		{:else if !linkedEvent}
			<div
				class="w-full rounded-2xl bg-gray1 p-10 flex flex-col items-center justify-center text-center gap-3"
			>
				<svg
					class="w-10 h-10 text-gray2"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
				<p class="text-white font-bold">No linked show yet</p>
				<p class="text-gray2 text-sm font-medium max-w-md">
					Confirm this event in the calendar to create its linked show — the set times template
					will be generated automatically from the event time.
				</p>
			</div>
		{:else}
			{#if (!linkedEvent.timetable || linkedEvent.timetable.length === 0) && isDirty}
				<div
					transition:fade={{ duration: 150 }}
					class="mb-4 px-4 py-3 rounded-xl bg-lime/10 border border-lime/30 text-lime text-xs font-bold"
				>
					Template preview generated from the event time — hit "Save Set Times" to keep it.
				</div>
			{/if}

			<div class="rounded-2xl bg-gray1 p-4">
				<div
					class="grid grid-cols-14 gap-x-3 px-3 py-2 text-xs font-bold text-gray2 items-center"
				>
					<div class="col-span-1"></div>
					<div class="col-span-2">Time</div>
					<div class="col-span-2 text-center">Length</div>
					<div class="col-span-3">Artist</div>
					<div class="col-span-2">Notes</div>
					<div class="col-span-3">Status</div>
					<div class="col-span-1"></div>
				</div>

				<div class="space-y-2">
					{#each entries as entry, index (entry.id)}
						{@const formInputClasses =
							'w-full bg-transparent border border-gray2/30 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all duration-200 disabled:opacity-60'}
						{@const isSpecialRow = entry.artist === 'DOORS' || entry.artist === 'CURFEW'}
						<div
							role="listitem"
							class="grid grid-cols-14 gap-x-3 items-center p-2.5 border rounded-lg transition-all duration-200 {getStatusStyles(
								entry.status
							)} {dragOverIndex === index ? 'drag-over' : ''} {draggedIndex === index
								? 'opacity-50'
								: ''}"
							draggable={canEdit && !isSpecialRow}
							on:dragstart={(e) => handleDragStart(e, index)}
							on:dragover={(e) => handleDragOver(e, index)}
							on:dragleave={handleDragLeave}
							on:drop={(e) => handleDrop(e, index)}
							on:dragend={handleDragEnd}
						>
							<div class="col-span-1 grid grid-cols-2 gap-1 items-center">
								<div class="flex items-center justify-center">
									{#if canEdit && !isSpecialRow}
										<button
											class="cursor-move text-gray-400 hover:text-white"
											aria-label="Drag to reorder"
										>
											<svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"
												><path
													d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z"
												/></svg
											>
										</button>
									{/if}
								</div>
								{#if canEdit}
									<div class="flex flex-col">
										<button
											on:click={() => adjustTime(index, 'up')}
											class="text-gray2 hover:text-lime cursor-pointer"
											aria-label="Increase time"
										>
											<svg
												class="w-4 h-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"><path d="M18 15l-6-6-6 6" /></svg
											>
										</button>
										<button
											on:click={() => adjustTime(index, 'down')}
											class="text-gray2 hover:text-lime cursor-pointer"
											aria-label="Decrease time"
										>
											<svg
												class="w-4 h-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"><path d="M6 9l6 6 6-6" /></svg
											>
										</button>
									</div>
								{/if}
							</div>

							<div class="col-span-2">
								<input
									type="text"
									class={formInputClasses}
									bind:value={entry.time}
									disabled={!canEdit}
									on:blur={() => formatTimeInput(index)}
								/>
							</div>
							<div class="col-span-2 text-center">
								<span class="text-gray2 text-xs">{entry.length}</span>
							</div>
							<div class="col-span-3">
								{#if isSpecialRow}
									<span class="px-2.5 py-1.5 text-white font-bold text-xs">{entry.artist}</span>
								{:else}
									<input
										type="text"
										class={formInputClasses}
										bind:value={entry.artist}
										disabled={!canEdit}
										on:input={markDirty}
										placeholder="Enter name"
									/>
								{/if}
							</div>
							<div class="col-span-2">
								{#if !isSpecialRow}
									<input
										type="text"
										class={formInputClasses}
										bind:value={entry.notes}
										disabled={!canEdit}
										on:input={markDirty}
										placeholder="Add"
									/>
								{/if}
							</div>

							<div class="col-span-3 relative">
								{#if !isSpecialRow}
									<button
										type="button"
										class="{formInputClasses} status-button flex items-center justify-between text-left cursor-pointer"
										disabled={!canEdit}
										on:click={() => toggleStatusDropdown(index)}
									>
										<span>{statusDisplayNames[entry.status]}</span>
										<svg
											class="w-3 h-3 text-gray2"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
										>
									</button>

									{#if dropdownState.show && dropdownState.index === index}
										<div
											class="dropdown-portal absolute top-full mt-1 w-full bg-navbar border border-lime rounded-lg shadow-lg z-20 overflow-hidden"
											role="listbox"
											transition:fly={{ y: -4, duration: 120 }}
										>
											{#each statusOptions as option}
												<button
													type="button"
													class="w-full px-3 py-2 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer text-xs font-bold whitespace-nowrap"
													on:click={() => selectStatus(option)}
												>
													{statusDisplayNames[option]}
												</button>
											{/each}
										</div>
									{/if}
								{/if}
							</div>

							<div class="col-span-1 flex items-center justify-center">
								{#if canEdit && !isSpecialRow}
									<button
										type="button"
										class="text-red-500/70 hover:text-red-500 transition-colors cursor-pointer"
										on:click={() => removeEntry(index)}
										aria-label="Remove entry"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											><polyline points="3 6 5 6 21 6"></polyline><path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path><line x1="10" y1="11" x2="10" y2="17"></line><line
												x1="14"
												y1="11"
												x2="14"
												y2="17"
											></line></svg
										>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<p class="text-gray2/70 text-xs font-medium mt-4 px-1">
				Deals with Set Times enabled push their suggested slot into this timetable automatically.
				Edits made here never modify the deals — this is a one-way sync.
			</p>
		{/if}
	</div>
</div>

<style>
	.drag-over {
		box-shadow: 0 -2px 0 var(--color-lime);
	}
</style>
