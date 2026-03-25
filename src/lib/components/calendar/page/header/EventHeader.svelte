<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import type { CalendarEvent, VenueSettings, HoldLevel } from '$lib/types/calendar-types';
	import DateSelector from './DateSelector.svelte';
	import TimeSelector from './TimeSelector.svelte';
	import VenueSelector from './VenueSelector.svelte';
	import TypeSelector from '$lib/components/calendar/page/header/TypeSelector.svelte';
	import CalendarConfirm from '$lib/components/calendar/CalendarConfirm.svelte';
	import HeaderActions from './HeaderActions.svelte'; // <-- NEW IMPORT
	import VersionSelector from './VersionSelector.svelte';
	import { getNextAvailableHold, calculateHoldShifts } from '$lib/utils/holdManager';
	import { syncEventToTechSchedule } from '$lib/services/techScheduleSync';

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
	export let userRole: string = 'Email Only';

	export let isDeployed: boolean = false;
	export let deployedAppTabs: string[] = [];

	const dispatch = createEventDispatcher();

	// --- PERMISSION LOGIC ---
	$: isEditor = ['Editor', 'Admin'].includes(userRole);
	$: isAdmin = $authStore?.profile?.role === 'Admin';

	let isEditingTitle = false;
	let editTitle = event.calendar?.title || 'Unnamed Event';

	// New error state variables
	let titleError = false;
	let titleErrorTimeout: ReturnType<typeof setTimeout>;

	// Dropdown states
	let showStatusDrop = false;

	// Confirm Modal State
	let showConfirmModal = false;
	let pendingStatus: 'CONFIRMED' | 'HOLD' | 'CANCELED' = 'HOLD';
	let isSavingConfirm = false;
	let sameEventOtherRoomsCount = 0;
	let otherEventsOnDayCount = 0;
	let otherEventsSameRoomCount = 0; // NEW
	let defaultEmailForVenue = false;

	// Safely extract and parse details
	$: rawDetails = event.calendar?.details || event.details || {};
	$: parsedDetails = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;

	const statuses = [
		{ value: 'CANCELED', label: 'Canceled', color: 'bg-problem' },
		{ value: 'HOLD', label: 'Hold', color: 'bg-tentatif' },
		{ value: 'CONFIRMED', label: 'Confirmed', color: 'bg-confirmed' },
		{ value: 'IN SETTLEMENT', label: 'In Settlement', color: 'bg-info' },
		{ value: 'SETTLED', label: 'Settled', color: 'bg-gray2' }
	];

	$: currentStatusObj = statuses.find((s) => s.value === event.status) || statuses[0];

	async function saveTitle() {
		// Exit early if empty or unchanged
		if (editTitle.trim() === '' || editTitle === event.calendar?.title) {
			isEditingTitle = false;
			return;
		}

		const forbiddenWords = [
			'corpo',
			'bazart nuits',
			'nuits bazart',
			'bazart nuit',
			'nuit bazart',
			'ncg show',
			'ncg 360',
			'ncg360',
			'360',
			'dstrkt',
			'tour prod'
		];

		const titleLower = editTitle.toLowerCase().trim();
		const hasForbiddenWord = forbiddenWords.some((word) =>
			word === '360' ? /\b360\b/.test(titleLower) : titleLower.includes(word)
		);

		if (hasForbiddenWord) {
			// Revert the title back to what it was
			editTitle = event.calendar?.title || 'Unnamed Event';
			isEditingTitle = false; // Close the input

			// Trigger the error state UI
			titleError = true;

			// Clear any existing timeout to prevent overlapping timers
			if (titleErrorTimeout) clearTimeout(titleErrorTimeout);

			// Remove the error state after 4 seconds
			titleErrorTimeout = setTimeout(() => {
				titleError = false;
			}, 4000);

			return;
		}

		isEditingTitle = false;
		await supabase.from('calendar').update({ title: editTitle.trim() }).eq('id', event.group_id);
		invalidateAll();
	}

	async function setStatus(newStatus: string) {
		showStatusDrop = false;
		if (newStatus === event.status) return;

		// Trigger modal for Confirm (from ANY state), Hold (from Confirmed), OR Canceled
		if (
			newStatus === 'CONFIRMED' ||
			(newStatus === 'HOLD' && event.status === 'CONFIRMED') ||
			newStatus === 'CANCELED'
		) {
			pendingStatus = newStatus as 'CONFIRMED' | 'HOLD' | 'CANCELED';
			await setupConfirmData();
			showConfirmModal = true;
		} else {
			// All other simple status changes (In Settlement, Settled, etc.) happen instantly
			await supabase.from('calendar_events').update({ status: newStatus }).eq('id', event.id);
			invalidateAll();
		}
	}

	// === CONFIRM / CANCEL EVENT LOGIC ===
	async function setupConfirmData() {
		try {
			const { data } = await supabase
				.from('calendar_events')
				.select('id, group_id, venue')
				.eq('date', event.date)
				.in('status', ['HOLD', 'PENDING']);

			if (data) {
				sameEventOtherRoomsCount = data.filter(
					(d) => d.group_id === event.group_id && d.id !== event.id
				).length;

				const otherEvents = data.filter((d) => d.group_id !== event.group_id);
				otherEventsOnDayCount = otherEvents.length;

				const venueParsed =
					typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
				const currentCategory = venueParsed.category || '';
				const currentRoom = venueParsed.room || '';

				// NEW: Filter down to holds that are explicitly in the exact same room
				otherEventsSameRoomCount = otherEvents.filter((d) => {
					try {
						const dVenue = typeof d.venue === 'string' ? JSON.parse(d.venue) : d.venue || {};
						return dVenue.category === currentCategory && dVenue.room === currentRoom;
					} catch (e) {
						return false;
					}
				}).length;

				defaultEmailForVenue = currentCategory === 'New City Gas';
			}
		} catch (err) {
			console.error('Failed to setup confirm data:', err);
		}
	}

	async function executeConfirmChange(e: CustomEvent) {
		const {
			sendEmail,
			sendSms,
			confirmAllRooms,
			clearOtherHolds,
			clearSameRoomHolds,
			confirmAllDates
		} = e.detail;
		isSavingConfirm = true;

		try {
			const oldStatus = event.status;
			const newStatus = pendingStatus;
			let impactedDates = [event.date]; // 👈 ADD THIS at the top of the try block

			// === 1. DATABASE UPDATES ===
			if (newStatus === 'CONFIRMED' && (oldStatus === 'HOLD' || oldStatus === 'CANCELED')) {
				// --- KEEP YOUR EXISTING "FILL THE GAP" LOGIC HERE ---
				let vCat = '',
					vRoom = '';
				try {
					const vParsed =
						typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
					vCat = vParsed.category || '';
					vRoom = vParsed.room || '';
				} catch (e) {}

				const { data: allDayEvents } = await supabase
					.from('calendar_events')
					.select('id, date, status, hold_level, venue')
					.eq('date', event.date);

				if (allDayEvents) {
					const shiftUpdates = calculateHoldShifts({
						targetEventId: event.id,
						newLevel: null, // Cleared
						oldLevel: event.hold_level as HoldLevel,
						date: event.date,
						category: vCat,
						room: vRoom,
						existingEvents: allDayEvents
					});

					for (const update of shiftUpdates) {
						await supabase
							.from('calendar_events')
							.update({ hold_level: update.newHoldLevel })
							.eq('id', update.id);
					}
				}
				// ----------------------------------------

				if (confirmAllDates) {
					// 🟢 NEW: Fetch the dates we are about to confirm so we can email them
					let fetchQuery = supabase
						.from('calendar_events')
						.select('date')
						.eq('group_id', event.group_id)
						.in('status', ['HOLD', 'PENDING']);

					if (!confirmAllRooms) {
						fetchQuery = fetchQuery.eq('venue->>category', vCat).eq('venue->>room', vRoom);
					}
					const { data: dateData } = await fetchQuery;
					if (dateData) {
						impactedDates = [...new Set(dateData.map((d) => d.date))];
					}

					// 🟢 NEW LOGIC: Confirm ALL dates for this event
					let query = supabase
						.from('calendar_events')
						.update({ status: 'CONFIRMED', hold_level: null })
						.eq('group_id', event.group_id)
						.in('status', ['HOLD', 'PENDING']);

					if (!confirmAllRooms) {
						query = query.eq('venue->>category', vCat).eq('venue->>room', vRoom);
					}
					await query;
				} else {
					// 🟠 ORIGINAL LOGIC: Confirm single date
					await supabase
						.from('calendar_events')
						.update({ status: 'CONFIRMED', hold_level: null })
						.eq('id', event.id);

					if (sameEventOtherRoomsCount > 0) {
						if (confirmAllRooms) {
							await supabase
								.from('calendar_events')
								.update({ status: 'CONFIRMED', hold_level: null })
								.eq('group_id', event.group_id)
								.eq('date', event.date)
								.in('status', ['HOLD', 'PENDING']);
						} else {
							await supabase
								.from('calendar_events')
								.update({ status: 'HIDDEN' })
								.eq('group_id', event.group_id)
								.eq('date', event.date)
								.in('status', ['HOLD', 'PENDING'])
								.neq('id', event.id);
						}
					} else {
						await supabase
							.from('calendar_events')
							.update({ status: 'HIDDEN' })
							.eq('group_id', event.group_id)
							.in('status', ['HOLD', 'PENDING'])
							.neq('id', event.id);
					}
				}

				// NEW: Distinct handling for Clearing all holds vs. Clearing same room holds
				if (clearOtherHolds && otherEventsOnDayCount > 0) {
					await supabase
						.from('calendar_events')
						.update({ status: 'HIDDEN', hold_level: null })
						.eq('date', event.date)
						.neq('group_id', event.group_id)
						.in('status', ['HOLD', 'PENDING']);
				} else if (clearSameRoomHolds && otherEventsSameRoomCount > 0) {
					const venueParsed =
						typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};

					await supabase
						.from('calendar_events')
						.update({ status: 'HIDDEN', hold_level: null })
						.eq('date', event.date)
						.neq('group_id', event.group_id)
						.eq('venue->>category', venueParsed.category)
						.eq('venue->>room', venueParsed.room)
						.in('status', ['HOLD', 'PENDING']);
				}
			} else if (newStatus === 'HOLD' && oldStatus === 'CONFIRMED') {
				const { data: allGroupRows } = await supabase
					.from('calendar_events')
					.select('*')
					.eq('group_id', event.group_id);

				let currentCategory = '';
				let currentRoom = '';
				try {
					const vParsed =
						typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
					currentCategory = vParsed.category || '';
					currentRoom = vParsed.room || '';
				} catch (e) {}

				const { data: otherHiddenRows } = await supabase
					.from('calendar_events')
					.select('*')
					.eq('date', event.date)
					.eq('status', 'HIDDEN')
					.neq('group_id', event.group_id);

				const rowsToProcess = [...(allGroupRows || []), ...(otherHiddenRows || [])];

				rowsToProcess.sort((a, b) => {
					if (a.id === event.id) return -1;
					if (b.id === event.id) return 1;
					if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
					if (b.status === 'CONFIRMED' && a.status !== 'CONFIRMED') return 1;
					return 0;
				});

				const virtualHolds: Pick<CalendarEvent, 'date' | 'status' | 'hold_level' | 'venue'>[] = [];
				const processingIds = rowsToProcess.map((r) => r.id);

				for (const row of rowsToProcess) {
					let vCat = '',
						vRoom = '';
					try {
						const vParsed = typeof row.venue === 'string' ? JSON.parse(row.venue) : row.venue || {};
						vCat = vParsed.category || '';
						vRoom = vParsed.room || '';
					} catch (e) {}

					const { data: dbHolds } = await supabase
						.from('calendar_events')
						.select('id, date, status, hold_level, venue')
						.eq('date', row.date)
						.eq('status', 'HOLD');

					const validDbHolds = (dbHolds || []).filter((h) => !processingIds.includes(h.id));
					const combinedHolds = [...validDbHolds, ...virtualHolds];

					const nextAvailable = getNextAvailableHold({
						date: row.date,
						category: vCat,
						room: vRoom,
						existingEvents: combinedHolds as any,
						isPriority: false, // Default to false when demoting from confirmed
						venues: venues
					});

					virtualHolds.push({
						date: row.date,
						status: 'HOLD',
						hold_level: nextAvailable,
						venue: { category: vCat, room: vRoom }
					});

					await supabase
						.from('calendar_events')
						.update({
							status: 'HOLD',
							hold_level: nextAvailable
						})
						.eq('id', row.id);
				}

				await supabase
					.from('calendar_events')
					.update({ status: 'HOLD' })
					.eq('group_id', event.group_id)
					.eq('status', 'HIDDEN');
			} else if (newStatus === 'CANCELED') {
				await supabase.from('calendar_events').update({ status: 'CANCELED' }).eq('id', event.id);

				if (oldStatus === 'CONFIRMED') {
					const { data: hiddenHolds } = await supabase
						.from('calendar_events')
						.select('*')
						.eq('date', event.date)
						.eq('status', 'HIDDEN');

					if (hiddenHolds && hiddenHolds.length > 0) {
						const virtualHolds: Pick<CalendarEvent, 'date' | 'status' | 'hold_level' | 'venue'>[] =
							[];

						for (const row of hiddenHolds) {
							let vCat = '',
								vRoom = '';
							try {
								const vParsed =
									typeof row.venue === 'string' ? JSON.parse(row.venue) : row.venue || {};
								vCat = vParsed.category || '';
								vRoom = vParsed.room || '';
							} catch (e) {}

							const { data: dbHolds } = await supabase
								.from('calendar_events')
								.select('id, date, status, hold_level, venue')
								.eq('date', row.date)
								.eq('status', 'HOLD');

							const combinedHolds = [...(dbHolds || []), ...virtualHolds];

							const nextAvailable = getNextAvailableHold({
								date: row.date,
								category: vCat,
								room: vRoom,
								existingEvents: combinedHolds as any,
								isPriority: false,
								venues: venues
							});

							virtualHolds.push({
								date: row.date,
								status: 'HOLD',
								hold_level: nextAvailable,
								venue: { category: vCat, room: vRoom }
							});

							await supabase
								.from('calendar_events')
								.update({
									status: 'HOLD',
									hold_level: nextAvailable
								})
								.eq('id', row.id);
						}
					}
				}
			}

			// Post-update Deduplication Sweep
			const { data: currentEvents } = await supabase
				.from('calendar_events')
				.select('id, date, status, hold_level, venue')
				.eq('group_id', event.group_id);

			if (currentEvents && currentEvents.length > 0) {
				currentEvents.sort((a, b) => {
					if (a.id === event.id) return -1;
					if (b.id === event.id) return 1;
					if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
					if (b.status === 'CONFIRMED' && a.status !== 'CONFIRMED') return 1;
					const aLevel = a.hold_level ? parseInt(a.hold_level.replace('H', '')) || 999 : 999;
					const bLevel = b.hold_level ? parseInt(b.hold_level.replace('H', '')) || 999 : 999;
					return aLevel - bLevel;
				});

				const seenKeys = new Set();
				const idsToDelete = [];

				for (const row of currentEvents) {
					let vCat = '',
						vRoom = '';

					try {
						const vParsed = typeof row.venue === 'string' ? JSON.parse(row.venue) : row.venue || {};
						vCat = vParsed.category || '';
						vRoom = vParsed.room || '';
					} catch (e) {}

					const uniqueKey = `${row.date}:::${vCat}:::${vRoom}`;

					if (seenKeys.has(uniqueKey)) {
						idsToDelete.push(row.id);
					} else {
						seenKeys.add(uniqueKey);
					}
				}

				if (idsToDelete.length > 0) {
					await supabase.from('calendar_events').delete().in('id', idsToDelete);
				}
			}

			// 👇 --- TECH SCHEDULE SYNC --- 👇
			try {
				const updatedEventToSync = {
					...event,
					status: pendingStatus,
					details: parsedDetails
				} as CalendarEvent;

				await syncEventToTechSchedule(updatedEventToSync, pendingStatus);
			} catch (syncErr) {
				console.error('Tech Schedule Sync Failed:', syncErr);
			}
			// 👆 -------------------------------- 👆

			// === 2. DISPATCH EMAILS / SMS ===
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'An Admin';
			const venueParsed =
				typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};

			const payload = {
				eventId: event.short_id || event.id,
				eventTitle: event.calendar?.title || event.title || 'Unnamed Event',
				eventType: parsedDetails?.type || 'Event',
				eventDate: event.date,
				eventDates: impactedDates, // 👈 ADD THIS LINE
				venueName:
					`${venueParsed.category || ''} ${venueParsed.room ? '/ ' + venueParsed.room : ''}`.trim(),
				authUserName: authName,
				action: pendingStatus === 'CONFIRMED' ? 'confirm' : 'cancel'
			};

			const promises: Promise<any>[] = [];
			if (sendEmail) {
				promises.push(
					fetch('/api/calendar-confirm-email', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}).catch((err) => console.error('Email API failed:', err))
				);
			}

			if (sendSms) {
				promises.push(
					fetch('/api/calendar-confirm-sms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}).catch((err) => console.error('SMS API failed:', err))
				);
			}

			if (promises.length > 0) await Promise.allSettled(promises);

			// === 3. FINISH ===
			showConfirmModal = false;
			invalidateAll();
		} catch (e) {
			console.error('Execute Change Error:', e);
		} finally {
			isSavingConfirm = false;
		}
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
	}}
/>

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
				{#if isEditingTitle && isEditor}
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
						class="text-2xl font-black px-1 text-left transition-all {isEditor
							? 'cursor-pointer'
							: 'opacity-80'} 
					{titleError
							? 'text-problem underline decoration-problem decoration-2 underline-offset-4'
							: 'text-white hover:text-lime'}"
						style="cursor: {!isEditor ? 'not-allowed' : 'pointer'};"
						on:click={() => {
							if (isEditor) isEditingTitle = true;
						}}
						disabled={!isEditor}
						aria-disabled={!isEditor}
						aria-label={isEditor ? 'Edit event title' : 'Event title'}
						title={!isEditor ? 'You do not have permission to edit the title' : 'Edit event title'}
					>
						{event.calendar?.title || 'Unnamed Event'}
					</button>
					{#if isEditor && !titleError}
						<span
							class="opacity-0 group-hover:opacity-100 absolute -right-20 text-[10px] font-bold uppercase tracking-wider bg-navbar text-white px-2 py-1 rounded transition-opacity pointer-events-none shadow-sm"
							>Rename</span
						>
					{/if}
				{/if}

				{#if titleError}
					<div
						class="absolute top-full left-1 mt-1 text-problem text-[10px] font-bold whitespace-nowrap pointer-events-none"
					>
						Do not include event type in the name, select type from dropdown below.
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4">
			
			<VersionSelector {event} {isEditor} />

			<div class="relative status-dropdown-container">
				<button
					class="flex items-center gap-3 px-5 py-2.5 rounded-3xl bg-navbar shadow-lg border border-gray2/10 transition-colors {isEditor
						? 'hover:bg-white/5 cursor-pointer'
						: 'opacity-80'}"
					style="cursor: {!isEditor ? 'not-allowed' : 'pointer'};"
					on:click={() => {
						if (isEditor) showStatusDrop = !showStatusDrop;
					}}
					disabled={!isEditor}
					aria-disabled={!isEditor}
					aria-label="Change event status"
					title={!isEditor
						? 'You do not have permission to change the status'
						: 'Change event status'}
				>
					<div class="w-2.5 h-2.5 rounded-3xl {currentStatusObj.color}"></div>
					<span class="text-sm font-bold text-white">{currentStatusObj.label}</span>
					{#if isEditor}
						<svg
							class="w-4 h-4 text-gray2 ml-1"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					{/if}
				</button>

				{#if showStatusDrop && isEditor}
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
				class="text-gray2 transition-colors {isEditor
					? 'hover:text-white cursor-pointer'
					: 'opacity-50'}"
				style="cursor: {!isEditor ? 'not-allowed' : 'pointer'};"
				disabled={!isEditor}
				aria-disabled={!isEditor}
				aria-label="Settings"
				title={!isEditor ? 'You do not have permission to change settings' : 'Settings'}
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="3"></circle><path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
					></path></svg
				>
			</button>

			<HeaderActions {event} {parsedDetails} {venues} {isEditor} />
		</div>
	</div>

	<div
		class="px-6 py-3 flex items-center gap-30"
		title={!isEditor ? 'You do not have permission to edit event details' : ''}
		style="cursor: {!isEditor ? 'not-allowed' : 'default'}"
	>
		<div
			class="flex items-center gap-3 -ml-3 transition-opacity {isEditor
				? ''
				: 'pointer-events-none opacity-80'}"
		>
			<DateSelector {event} {groupEvents} />
			<TimeSelector {event} />
			<VenueSelector {event} {groupEvents} {venues} on:openSettings />
			<TypeSelector {event} {parsedDetails} />
		</div>
	</div>

	<div
		class="mx-3 px-6 pt-2 bg-navbar flex items-end gap-8 overflow-x-auto rounded-2xl custom-scrollbar"
	>
		{#each tabs as tab}
			{@const isEnvironmentBlocked = isDeployed && !deployedAppTabs.includes(tab)}
			{@const isRoleBlocked = !isEditor && tab !== 'Deals'}
			{@const isDisabled = isEnvironmentBlocked || isRoleBlocked}

			<button
				class="pb-3 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap relative
					{activeTab === tab ? 'text-lime' : 'text-gray2'} 
					{isDisabled ? 'opacity-30' : 'hover:text-white'}"
				style="cursor: {isDisabled ? 'not-allowed' : 'pointer'};"
				on:click={() => {
					if (!isDisabled) dispatch('tabChange', tab);
				}}
				aria-disabled={isDisabled}
				title={isEnvironmentBlocked
					? 'This tab is currently disabled in this environment'
					: isRoleBlocked
						? 'You do not have permission to view this tab'
						: ''}
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
			><path
				d="M4 20h16v2H4v-2zM4 2h16v2H4V2zm9 7h3l-4-4-4 4h3v6H8l4 4 4-4h-3V9z"
				transform="rotate(-90 12 12)"
			/></svg
		>
	</button>
</div>

{#if isEditor}
	<CalendarConfirm
		bind:show={showConfirmModal}
		action={pendingStatus === 'CONFIRMED' ? 'confirm' : 'cancel'}
		saving={isSavingConfirm}
		{isAdmin}
		defaultEmail={defaultEmailForVenue}
		showConflicts={pendingStatus === 'CONFIRMED'}
		{sameEventOtherRoomsCount}
		{otherEventsOnDayCount}
		{otherEventsSameRoomCount}
		on:confirm={executeConfirmChange}
	/>
{/if}
