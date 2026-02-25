<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';
	import DateSelector from './DateSelector.svelte';
	import VenueSelector from './VenueSelector.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';

	type ExtendedEvent = CalendarEvent & {
		calendar?: {
			title?: string;
			details?: CalendarEvent['details'];
		};
		short_id?: number;
	};

	export let event: ExtendedEvent;
	export let groupEvents: CalendarEvent[];
	export let venues: VenueSettings[];
	export let tabs: string[];
	export let activeTab: string;
	export let isSidebarOpen: boolean = true;

	const dispatch = createEventDispatcher();
	let isEditingTitle = false;
	let editTitle = event.calendar?.title || 'Unnamed Event';

	// Dropdown states
	let showStatusDrop = false;
	let showMoreMenu = false;
	let showTypeDrop = false; // Add this line

	let showConfirmationModal = false;
	let pendingStatus: 'CONFIRMED' | 'HOLD' = 'HOLD';

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	// 1. Safely extract and parse details, checking both possible locations
	$: rawDetails = event.calendar?.details || event.details || {};
	$: parsedDetails = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;

	// 2. Set the type and color based on the parsed data
	$: currentType = parsedDetails?.type || 'Select Type';
	$: currentTypeColor = typeColors[currentType] || typeColors['Other'];

	// Modal States
	let showDeleteModal = false;
	let deleteStep = 1;

	// Duplicate Modal State
	let showDuplicateModal = false;
	let duplicateEventName = '';
	let dupDatesMonth = new Date();
	let dupStagedDates: string[] = [];

	// Manage Dates Modal State
	let showManageDatesModal = false;
	let manageDatesMonth = new Date();
	let manageStagedDates: string[] = [];

	const statuses = [
		{ value: 'HOLD', label: 'Hold', color: 'bg-tentatif' },
		{ value: 'CONFIRMED', label: 'Confirmed', color: 'bg-confirmed' },
		{ value: 'IN SETTLEMENT', label: 'In Settlement', color: 'bg-info' },
		{ value: 'SETTLED', label: 'Settled', color: 'bg-gray2' }
	];

	$: currentStatusObj = statuses.find((s) => s.value === event.status) || statuses[0];

	async function saveTitle() {
		isEditingTitle = false;
		if (editTitle.trim() === '' || editTitle === event.calendar?.title) return;

		await supabase.from('calendar').update({ title: editTitle.trim() }).eq('id', event.group_id);
		invalidateAll();
	}

	async function setType(newType: string) {
		showTypeDrop = false;
		if (currentType === newType) return;

		// 1. Update the local parsed object
		parsedDetails.type = newType;

		// 2. Assign it back to both possible locations for optimistic UI
		if (event.calendar) event.calendar.details = parsedDetails;
		event.details = parsedDetails;

		// 3. Save to the database 'calendar' table
		await supabase.from('calendar').update({ details: parsedDetails }).eq('id', event.group_id);

		// 4. Trigger server refetch
		invalidateAll();
	}

	async function setStatus(newStatus: string) {
		showStatusDrop = false;
		if (newStatus === event.status) return;

		// For complex transitions, offload to the new ConfirmationModal
		if (
			(newStatus === 'CONFIRMED' && event.status === 'HOLD') ||
			(newStatus === 'HOLD' && event.status === 'CONFIRMED')
		) {
			pendingStatus = newStatus as 'CONFIRMED' | 'HOLD';
			showConfirmationModal = true;
		} else {
			// Basic updates for IN SETTLEMENT / SETTLED
			await supabase.from('calendar_events').update({ status: newStatus }).eq('id', event.id);
			invalidateAll();
		}
	}

	// === MODAL ACTIONS ===

	function openDeleteModal() {
		deleteStep = 1;
		showDeleteModal = true;
	}

	async function confirmDelete() {
		await supabase.from('calendar').delete().eq('id', event.group_id);
		showDeleteModal = false;
		goto('/calendar');
	}

	// === DUPLICATE EVENT MODAL LOGIC ===
	function openDuplicateModal() {
		duplicateEventName = `Copy of ${event.calendar?.title || 'Unnamed Event'}`;
		dupStagedDates = [event.date];
		dupDatesMonth = new Date(event.date + 'T00:00:00');
		showDuplicateModal = true;
	}

	function toggleDupDate(targetDate: string) {
		if (dupStagedDates.includes(targetDate)) {
			dupStagedDates = dupStagedDates.filter((d) => d !== targetDate);
		} else {
			dupStagedDates = [...dupStagedDates, targetDate];
		}
	}

	async function handleDuplicate() {
		if (!duplicateEventName.trim() || dupStagedDates.length === 0) return;

		const { data: calData, error: calErr } = await supabase
			.from('calendar')
			.insert({
				title: duplicateEventName.trim(),
				details: parsedDetails
			})
			.select()
			.single();

		if (calData && !calErr) {
			let vCat = '',
				vRoom = '';
			try {
				const vParsed =
					typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
				vCat = vParsed.category || '';
				vRoom = vParsed.room || '';
			} catch (e) {}

			let defaultLevelNum = 2;
			if (vCat) {
				const venueObj = venues.find((v) => v.setting_name === vCat);

				if (venueObj) {
					try {
						const params =
							typeof venueObj.setting_params === 'string'
								? JSON.parse(venueObj.setting_params)
								: venueObj.setting_params || {};
						const defaultLevelStr = params?.holdSettings?.defaultHoldLevel;

						if (defaultLevelStr && defaultLevelStr.startsWith('H')) {
							defaultLevelNum = parseInt(defaultLevelStr.replace('H', '')) || 2;
						}
					} catch (e) {}
				}
			}

			for (const dupDate of dupStagedDates) {
				let statusToSet = event.status;
				let holdLevelToSet = event.hold_level;

				if (statusToSet === 'CONFIRMED') {
					holdLevelToSet = null;
				} else if (statusToSet === 'HOLD') {
					// Fetch holds for this specific date and room to determine the next available hold level
					const { data: existingHolds } = await supabase
						.from('calendar_events')
						.select('id, hold_level, venue')
						.eq('date', dupDate)
						.eq('status', 'HOLD');

					const roomHolds = (existingHolds || []).filter((h) => {
						let hRoom = '';
						try {
							const hParsed = typeof h.venue === 'string' ? JSON.parse(h.venue) : h.venue || {};
							hRoom = hParsed.room || '';
						} catch (e) {}
						return hRoom === vRoom;
					});

					const levels = roomHolds.map((h) => h.hold_level).filter(Boolean);
					let nextAvailable = defaultLevelNum;
					while (levels.includes(`H${nextAvailable}` as CalendarEvent['hold_level'])) {
						nextAvailable++;
					}
					holdLevelToSet = `H${nextAvailable}` as CalendarEvent['hold_level'];
				}

				await supabase.from('calendar_events').insert({
					group_id: calData.id,
					date: dupDate,
					status: statusToSet,
					hold_level: holdLevelToSet,
					venue: event.venue || {},
					time: event.time || {},
					event_details: event.event_details || {}
				});
			}

			showDuplicateModal = false;
			invalidateAll();
		}
	}

	// === MANAGE DATES MODAL LOGIC ===
	function openManageDates() {
		manageStagedDates = groupEvents.filter((e) => e.status !== 'HIDDEN').map((e) => e.date);
		manageDatesMonth = new Date(event.date + 'T00:00:00');
		showManageDatesModal = true;
	}

	function toggleManageDate(targetDate: string) {
		if (manageStagedDates.includes(targetDate)) {
			manageStagedDates = manageStagedDates.filter((d) => d !== targetDate);
		} else {
			manageStagedDates = [...manageStagedDates, targetDate];
		}
	}

	async function saveManagedDate() {
		const originalDates = groupEvents.filter((e) => e.status !== 'HIDDEN').map((e) => e.date);
		const datesToAdd = manageStagedDates.filter((d) => !originalDates.includes(d));
		const datesToRemove = originalDates.filter((d) => !manageStagedDates.includes(d));

		// Set removed dates to HIDDEN instead of deleting
		if (datesToRemove.length > 0) {
			const idsToHide = groupEvents.filter((h) => datesToRemove.includes(h.date)).map((h) => h.id);
			await supabase.from('calendar_events').update({ status: 'HIDDEN' }).in('id', idsToHide);
		}

		if (datesToAdd.length > 0) {
			const newRows = datesToAdd.map((date) => ({
				group_id: event.group_id,
				creator_name: event.creator_name,
				date: date,
				status: event.status === 'CONFIRMED' ? 'CONFIRMED' : 'HOLD',
				hold_level: event.status === 'CONFIRMED' ? null : 'P',
				venue: event.venue,
				time: event.time,
				event_details: event.event_details
			}));

			await supabase.from('calendar_events').insert(newRows);
		}

		showManageDatesModal = false;
		invalidateAll();
	}

	function focusInput(node: HTMLInputElement) {
		node.focus();
	}

	function handleToggleClick() {
		dispatch('toggleSidebar');
	}
</script>

<svelte:window
	on:click={(e) => {
		if (
			showStatusDrop &&
			e.target instanceof Element &&
			!e.target.closest('.status-dropdown-container')
		) {
			showStatusDrop = false;
		}

		if (
			showMoreMenu &&
			e.target instanceof Element &&
			!e.target.closest('.more-options-dropdown-container')
		) {
			showMoreMenu = false;
		}

		// Add this block
		if (
			showTypeDrop &&
			e.target instanceof Element &&
			!e.target.closest('.type-dropdown-container')
		) {
			showTypeDrop = false;
		}
	}}
/>

{#if showDeleteModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
	>
		<div
			class="bg-gray1 border border-gray2/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center"
		>
			<div
				class="w-12 h-12 rounded-full bg-problem/20 text-problem flex items-center justify-center mb-4"
			>
				<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
			</div>

			{#if deleteStep === 1}
				<h3 class="text-xl font-black text-white mb-2">Delete Event</h3>
				<p class="text-gray2 text-sm font-medium mb-6">
					Are you sure you want to delete this event?
				</p>
				<div class="flex items-center gap-3 w-full">
					<button
						class="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
						on:click={() => (showDeleteModal = false)}>No</button
					>
					<button
						class="flex-1 py-3 px-4 rounded-xl font-bold text-problem bg-problem/10 hover:bg-problem/20 transition-colors cursor-pointer"
						on:click={() => (deleteStep = 2)}>Yes</button
					>
				</div>
			{:else}
				<h3 class="text-xl font-black text-white mb-2">Final Confirmation</h3>
				<p class="text-problem text-sm font-bold mb-6">This action is not reversible.</p>
				<div class="flex items-center gap-3 w-full">
					<button
						class="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
						on:click={() => (showDeleteModal = false)}>Cancel</button
					>
					<button
						class="flex-1 py-3 px-4 rounded-xl font-bold text-problem bg-problem/10 hover:bg-problem/20 transition-colors cursor-pointer"
						on:click={confirmDelete}>Confirm</button
					>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if showDuplicateModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
	>
		<div class="bg-gray1 border border-gray2/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
			<h3 class="text-xl font-black text-white mb-6">Duplicate Event</h3>

			<div class="flex flex-col gap-4 mb-6">
				<div class="flex flex-col gap-2">
					<label for="dup-name" class="text-xs font-bold text-gray2 uppercase tracking-wider"
						>Event Name</label
					>
					<input
						id="dup-name"
						type="text"
						bind:value={duplicateEventName}
						class="bg-navbar border border-gray2/20 rounded-xl px-4 py-3 text-white font-bold focus:border-lime transition-colors w-full"
					/>
				</div>

				<div class="flex flex-col gap-2 mt-2">
					<p class="text-xs font-bold text-gray2 uppercase tracking-wider">Select Dates</p>
					<div class="bg-navbar border border-gray2/20 rounded-2xl p-4">
						<div class="flex justify-between items-center mb-4">
							<button
								aria-label="Previous month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() =>
									(dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() - 1)))}
								><svg
									class="w-4 h-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg
								></button
							>
							<span class="text-sm font-bold text-white tracking-wide"
								>{dupDatesMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span
							>
							<button
								aria-label="Next month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() =>
									(dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() + 1)))}
								><svg
									class="w-4 h-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg
								></button
							>
						</div>

						<div class="grid grid-cols-7 gap-1 text-center mb-2">
							{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}<div
									class="text-[10px] font-bold text-gray2"
								>
									{d}
								</div>{/each}
						</div>
						<div class="grid grid-cols-7 gap-1.5 text-center">
							{#each Array(new Date(dupDatesMonth.getFullYear(), dupDatesMonth.getMonth(), 1).getDay()) as _}<div
								></div>{/each}
							{#each Array(new Date(dupDatesMonth.getFullYear(), dupDatesMonth.getMonth() + 1, 0).getDate()) as _, i}
								{@const dayNum = i + 1}
								{@const targetDate = `${dupDatesMonth.getFullYear()}-${String(dupDatesMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
								{@const isSelected = dupStagedDates.includes(targetDate)}

								<button
									class="w-7 h-7 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer {isSelected
										? 'border-2 border-lime text-white'
										: 'text-gray2 hover:bg-white/5'}"
									on:click={() => toggleDupDate(targetDate)}
								>
									{dayNum}
									{#if isSelected}<div
											class="w-1 h-1 rounded-full bg-lime absolute bottom-0.5"
										></div>{/if}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3">
				<button
					class="py-2.5 px-5 rounded-xl font-bold text-white hover:bg-white/5 transition-colors cursor-pointer"
					on:click={() => (showDuplicateModal = false)}>Cancel</button
				>
				<button
					class="py-2.5 px-6 rounded-xl font-black text-bg-primary bg-lime hover:bg-lime/90 transition-colors cursor-pointer disabled:opacity-50"
					on:click={handleDuplicate}
					disabled={!duplicateEventName.trim() || dupStagedDates.length === 0}>Create</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showManageDatesModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
	>
		<div class="bg-gray1 border border-gray2/20 rounded-2xl max-w-md w-full p-6 shadow-2xl">
			<h3 class="text-2xl font-black text-white mb-6">Manage Dates</h3>

			<div class="flex flex-col gap-3 mb-6">
				<p class="text-xs font-bold text-gray2 uppercase tracking-wider">Event Dates</p>
				<div class="bg-navbar border border-gray2/20 rounded-2xl p-5">
					<div class="flex justify-between items-center mb-6">
						<button
							aria-label="Previous month"
							class="p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
							on:click={() =>
								(manageDatesMonth = new Date(
									manageDatesMonth.setMonth(manageDatesMonth.getMonth() - 1)
								))}
							><svg
								class="w-5 h-5 text-white"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg
							></button
						>
						<span class="text-base font-bold text-white tracking-wide"
							>{manageDatesMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span
						>
						<button
							aria-label="Next month"
							class="p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
							on:click={() =>
								(manageDatesMonth = new Date(
									manageDatesMonth.setMonth(manageDatesMonth.getMonth() + 1)
								))}
							><svg
								class="w-5 h-5 text-white"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg
							></button
						>
					</div>

					<div class="grid grid-cols-7 gap-2 text-center mb-3">
						{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}<div
								class="text-xs font-bold text-gray2"
							>
								{d}
							</div>{/each}
					</div>
					<div class="grid grid-cols-7 gap-2 text-center">
						{#each Array(new Date(manageDatesMonth.getFullYear(), manageDatesMonth.getMonth(), 1).getDay()) as _}<div
							></div>{/each}
						{#each Array(new Date(manageDatesMonth.getFullYear(), manageDatesMonth.getMonth() + 1, 0).getDate()) as _, i}
							{@const dayNum = i + 1}
							{@const targetDate = `${manageDatesMonth.getFullYear()}-${String(manageDatesMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
							{@const isSelected = manageStagedDates.includes(targetDate)}

							<button
								class="w-10 h-10 mx-auto rounded-full flex flex-col items-center justify-center text-sm font-bold transition-all relative cursor-pointer {isSelected
									? 'border-2 border-lime text-white'
									: 'text-gray2 hover:bg-white/5'}"
								on:click={() => toggleManageDate(targetDate)}
							>
								{dayNum}
								{#if isSelected}<div
										class="w-1.5 h-1.5 rounded-full {event.status === 'CONFIRMED'
											? 'bg-confirmed'
											: 'bg-lime'} absolute bottom-1"
									></div>{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 mt-8">
				<button
					class="py-3 px-6 rounded-xl font-bold text-white hover:bg-white/5 transition-colors cursor-pointer"
					on:click={() => (showManageDatesModal = false)}>Cancel</button
				>
				<button
					class="py-3 px-8 rounded-xl font-black text-bg-primary bg-lime hover:bg-lime/90 transition-colors cursor-pointer disabled:opacity-50"
					on:click={saveManagedDate}
					disabled={manageStagedDates.length === 0}>Save</button
				>
			</div>
		</div>
	</div>
{/if}

<div class="bg-gray1 flex flex-col shrink-0 relative z-20">
	<div class="px-6 py-4 flex justify-between items-center">
		<div class="flex items-center gap-3">
			<a
				href="/calendar?view=month&date={event.date}"
				class="block -ml-2 p-2 text-gray2 hover:text-lime bg-white/5 rounded-2xl border-transparent border-2 hover:border-lime transition-all cursor-pointer"
				aria-label="Go back to calendar"
			>
				<svg
					class="w-5 h-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg
				>
			</a>

			<div class="group relative flex items-center">
				{#if isEditingTitle}
					<input
						type="text"
						bind:value={editTitle}
						on:blur={saveTitle}
						on:keydown={(e) => e.key === 'Enter' && saveTitle()}
						class="text-2xl font-black text-white border-b-2 border-lime focus:outline-none bg-transparent px-1 min-w-[300px]"
						use:focusInput
					/>
				{:else}
					<button
						class="text-2xl font-black text-white cursor-pointer hover:text-lime transition-colors px-1 text-left"
						on:click={() => (isEditingTitle = true)}
						aria-label="Edit event title"
					>
						{event.calendar?.title || 'Unnamed Event'}
					</button>
					<span
						class="opacity-0 group-hover:opacity-100 absolute -right-20 text-[10px] font-bold uppercase tracking-wider bg-navbar text-white px-2 py-1 rounded transition-opacity pointer-events-none shadow-sm"
						>Rename</span
					>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4">
			<div class="relative status-dropdown-container">
				<button
					class="flex items-center gap-3 px-5 py-2.5 rounded-3xl bg-navbar shadow-lg border border-gray2/10 hover:bg-white/5 transition-colors cursor-pointer"
					on:click={() => (showStatusDrop = !showStatusDrop)}
					aria-label="Change event status"
				>
					<div class="w-2.5 h-2.5 rounded-3xl {currentStatusObj.color}"></div>
					<span class="text-sm font-bold text-white">{currentStatusObj.label}</span>
					<svg
						class="w-4 h-4 text-gray2 ml-1"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
					>
				</button>

				{#if showStatusDrop}
					<div
						class="absolute right-0 top-[calc(100%+8px)] w-56 bg-navbar rounded-2xl shadow-xl overflow-hidden py-2 z-50 border border-gray2/10"
					>
						{#each statuses as status}
							{@const isLocked = status.value === 'IN SETTLEMENT' || status.value === 'SETTLED'}
							{@const isDisabled = status.value === event.status || isLocked}
							<button
								class="w-full px-5 py-3 flex items-center gap-3 text-left transition-colors {isDisabled
									? 'opacity-50 cursor-not-allowed bg-white/5'
									: 'hover:bg-white/5 cursor-pointer'}"
								on:click={() => !isDisabled && setStatus(status.value)}
								disabled={isDisabled}
							>
								<div class="w-2.5 h-2.5 rounded-full {status.color}"></div>
								<span class="text-sm font-bold text-white">{status.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<button
				class="text-gray2 hover:text-white transition-colors cursor-pointer"
				aria-label="Settings"
				><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="3"></circle><path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
					></path></svg
				></button
			>

			<div class="relative more-options-dropdown-container">
				<button
					class="text-gray2 hover:text-white transition-colors cursor-pointer p-1"
					aria-label="More options"
					on:click={() => (showMoreMenu = !showMoreMenu)}
					><svg
						class="w-5 h-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle
							cx="12"
							cy="19"
							r="1"
						></circle></svg
					>
				</button>

				{#if showMoreMenu}
					<div
						class="absolute right-0 top-[calc(100%+8px)] w-48 bg-navbar rounded-2xl shadow-xl overflow-hidden py-2 z-[9999] border border-gray2/10"
					>
						<button
							class="w-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 text-left transition-colors cursor-pointer"
							on:click={() => {
								showMoreMenu = false;
								openManageDates();
							}}
						>
							Manage Dates
						</button>
						<button
							class="w-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 text-left transition-colors cursor-pointer"
							on:click={() => {
								showMoreMenu = false;
								openDuplicateModal();
							}}
						>
							Duplicate Event
						</button>
						<button
							class="w-full px-4 py-2.5 text-sm font-bold text-problem hover:bg-white/5 text-left transition-colors cursor-pointer"
							on:click={() => {
								showMoreMenu = false;
								openDeleteModal();
							}}
						>
							Delete Event
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="px-6 py-3 flex items-center gap-30">
		<div class="flex items-center gap-3 -ml-3">
			<DateSelector {event} {groupEvents} />
			<VenueSelector {event} {groupEvents} {venues} on:openSettings />

			<div class="relative type-dropdown-container ml-2">
				<button
					class="flex items-center gap-3 px-4 py-2 rounded-2xl bg-navbar hover:bg-white/5 border border-gray2/10 transition-colors cursor-pointer"
					on:click={() => (showTypeDrop = !showTypeDrop)}
					aria-label="Change event type"
				>
					<div class="w-3 h-3 rounded-full" style="background-color: {currentTypeColor}"></div>
					<span class="text-sm font-bold text-white whitespace-nowrap">
						{currentType}
					</span>
					<svg
						class="w-4 h-4 text-gray2 ml-1"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
					>
				</button>

				{#if showTypeDrop}
					<div
						class="absolute left-0 top-[calc(100%+8px)] w-52 bg-navbar rounded-2xl shadow-xl overflow-hidden py-2 z-[60] border border-gray2/10"
					>
						{#each Object.entries(typeColors) as [typeName, colorHex]}
							<button
								class="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/5 cursor-pointer text-left transition-colors"
								on:click={() => setType(typeName)}
							>
								<div class="w-3 h-3 rounded-full" style="background-color: {colorHex}"></div>
								<span class="text-sm font-bold text-white">{typeName}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div
		class="mx-3 px-6 pt-2 bg-navbar flex items-end gap-8 overflow-x-auto rounded-2xl custom-scrollbar"
	>
		{#each tabs as tab}
			<button
				class="pb-3 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap relative cursor-pointer {activeTab ===
				tab
					? 'text-lime'
					: 'text-gray2 hover:text-white'}"
				on:click={() => dispatch('tabChange', tab)}
			>
				{tab}
				{#if activeTab === tab}
					<div class="absolute bottom-0 left-0 w-full h-[3px] bg-lime rounded-t-full"></div>
				{/if}
			</button>
		{/each}
	</div>

	<button
		class="group absolute bottom-6 right-2 translate-y-1/2 w-11 h-11 bg-gray1 hover:border-lime border-2 border-gray2/30 rounded-full shadow-lg flex items-center justify-center z-[100] cursor-pointer transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
		style="transform: translateY(50%) rotate({isSidebarOpen ? 0 : 180}deg);"
		on:click={handleToggleClick}
		aria-label={isSidebarOpen ? 'Hide sidebar' : 'Reveal sidebar'}
		title={isSidebarOpen ? 'Hide sidebar' : 'Reveal sidebar'}
	>
		<svg
			class="w-5 h-5 text-gray3 transition-colors duration-300 group-hover:text-lime"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<path
				d="M4 20h16v2H4v-2zM4 2h16v2H4V2zm9 7h3l-4-4-4 4h3v6H8l4 4 4-4h-3V9z"
				transform="rotate(-90 12 12)"
			/>
		</svg>
	</button>
</div>
<ConfirmationModal
	bind:show={showConfirmationModal}
	{event}
	newStatus={pendingStatus}
	{venues}
	on:update={() => invalidateAll()}
/>
