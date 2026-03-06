<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { cubicOut } from 'svelte/easing';
	import type { CalendarEvent, HoldLevel } from '$lib/types/calendar-types';
	import { tick, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import { authStore } from '$lib/stores/authStore';
	import Modal from '$lib/components/modals/Modal.svelte';
	import CalendarContactList from '$lib/components/calendar/CalendarContactList.svelte';
	import CalendarConfirm from '$lib/components/calendar/CalendarConfirm.svelte';
	import { calculateHoldShifts } from '$lib/utils/holdManager';

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

	// Conflict Management State
	let conflictingEventDate: string | null = null;
	let conflictingEventId: string | null = null;
	let pendingFlag: 'is_target' | 'is_challenge' | null = null;
	let showConflictOverlay = false;

	// Check if current user is an admin
	$: isAdmin = $authStore?.profile?.role === 'Admin';

	// Date Math for Conflict Overlay
	$: oldDateObj = conflictingEventDate ? new Date(conflictingEventDate + 'T00:00:00') : null;
	$: newDateObj = localEvent?.date ? new Date(localEvent.date + 'T00:00:00') : null;
	$: dayDiff =
		oldDateObj && newDateObj
			? Math.round((newDateObj.getTime() - oldDateObj.getTime()) / (1000 * 3600 * 24))
			: 0;
	$: diffText =
		dayDiff > 0
			? `+ ${dayDiff} day${dayDiff > 1 ? 's' : ''}`
			: `${dayDiff} day${Math.abs(dayDiff) > 1 ? 's' : ''}`;

	function formatDate(dateStr: string | null) {
		if (!dateStr) return { month: '', day: '', year: '' };
		const d = new Date(dateStr + 'T00:00:00');
		return {
			month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
			day: d.toLocaleDateString('en-US', { day: '2-digit' }),
			year: d.getFullYear()
		};
	}

	$: if (show && event && (!localEvent || localEvent.id !== event.id)) {
		localEvent = JSON.parse(JSON.stringify(event));
		tempNotes = localEvent?.details?.notes || '';
		isEditingNotes = false;
		hasUnsavedChanges = false;
	}

	$: if (!show) {
		localEvent = null;
		confirmMode = 'none';
		hasUnsavedChanges = false;
		isEditingNotes = false;
		conflictingEventDate = null;
		conflictingEventId = null;
		pendingFlag = null;
		showConflictOverlay = false;
	}

	let confirmMode: 'none' | 'clearSingle' | 'clearAll' | 'confirm' = 'none';
	let sameEventOtherRoomsCount = 0;
	let otherEventsOnDayCount = 0;
	let optConfirmAllRooms = false;
	let optClearOtherHolds = false;

	function handleKeydown(e: KeyboardEvent) {
		// Prevent closing the main modal if the conflict overlay is active
		if (showConflictOverlay) {
			if (e.key === 'Escape') {
				showConflictOverlay = false;
				pendingFlag = null;
			}
			return;
		}

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

	async function toggleFlag(flag: 'is_target' | 'is_challenge') {
		if (!localEvent) return;
		if (!localEvent.event_details) {
			localEvent.event_details = { is_target: false, is_challenge: false };
		}

		const isTurningOn = !localEvent.event_details[flag];

		// Check for conflicts if we are enabling a flag
		if (isTurningOn && localEvent.group_id) {
			saving = true;
			try {
				const { data, error } = await supabase
					.from('calendar_events')
					.select('id, date, event_details')
					.eq('group_id', localEvent.group_id)
					.neq('id', localEvent.id);

				if (!error && data) {
					// ONLY check if the specific flag being turned on is already active elsewhere
					const conflict = data.find((e) => e.event_details && e.event_details[flag] === true);

					if (conflict) {
						conflictingEventDate = conflict.date;
						conflictingEventId = conflict.id;
						pendingFlag = flag;
						showConflictOverlay = true;
						return; // Wait for modal confirmation
					}
				}
			} finally {
				saving = false;
			}
		}

		// Apply locally if no conflict or if we are just turning it off
		// This now preserves the other flag's state
		localEvent.event_details[flag] = isTurningOn;
		hasUnsavedChanges = true;
	}

	async function resolveConflict() {
		if (!localEvent || !conflictingEventId || !pendingFlag) return;
		saving = true;
		try {
			// 1. Wipe ONLY the conflicting flag on the old event globally
			const { data: oldEventData } = await supabase
				.from('calendar_events')
				.select('event_details')
				.eq('id', conflictingEventId)
				.single();

			if (oldEventData) {
				const updatedOldDetails = {
					...(oldEventData.event_details || {})
				};
				// Only remove the flag we are moving
				updatedOldDetails[pendingFlag] = false;

				await supabase
					.from('calendar_events')
					.update({ event_details: updatedOldDetails })
					.eq('id', conflictingEventId);
			}

			// 2. Set new flag on current local event without touching the other flag
			if (!localEvent.event_details) {
				localEvent.event_details = { is_target: false, is_challenge: false };
			}
			localEvent.event_details[pendingFlag] = true;

			hasUnsavedChanges = true;

			// Force save to database so parent view refreshes immediately
			await flushChanges();

			showConflictOverlay = false;
			conflictingEventId = null;
			conflictingEventDate = null;
			pendingFlag = null;
		} catch (e) {
			console.error('Failed to resolve target conflict:', e);
		} finally {
			saving = false;
		}
	}

	async function addAnotherFlag() {
		if (!localEvent || !pendingFlag) return;
		saving = true;

		try {
			// Set new flag on current local event
			if (!localEvent.event_details) {
				localEvent.event_details = { is_target: false, is_challenge: false };
			}
			localEvent.event_details[pendingFlag] = true;

			hasUnsavedChanges = true;

			// Force save to database so parent view refreshes immediately
			await flushChanges();

			showConflictOverlay = false;
			conflictingEventId = null;
			conflictingEventDate = null;
			pendingFlag = null;
		} catch (e) {
			console.error('Failed to add another flag:', e);
		} finally {
			saving = false;
		}
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
			// --- START HOLD SHIFT LOGIC ---
			if (event && localEvent.hold_level !== event.hold_level) {
				const { data: allDayEvents } = await supabase
					.from('calendar_events')
					.select('id, date, status, hold_level, venue')
					.eq('date', localEvent.date);

				if (allDayEvents) {
					const shiftUpdates = calculateHoldShifts({
						targetEventId: localEvent.id,
						newLevel: localEvent.hold_level as HoldLevel,
						date: localEvent.date,
						category: localEvent.venue.category || '',
						room: localEvent.venue.room || '',
						existingEvents: allDayEvents
					});

					for (const update of shiftUpdates) {
						await supabase
							.from('calendar_events')
							.update({
								hold_level: update.newHoldLevel,
								status: update.newStatus
							})
							.eq('id', update.id);
					}
				}
			}
			// --- END HOLD SHIFT LOGIC ---
			// --- END HOLD SWAP LOGIC ---

			await supabase
				.from('calendar_events')
				.update({
					status: localEvent.status,
					hold_level: localEvent.hold_level,
					event_details: localEvent.event_details
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
			// --- NEW: FILL THE GAP BEFORE DELETING ---
			const { data: allDayEvents } = await supabase
				.from('calendar_events')
				.select('id, date, status, hold_level, venue')
				.eq('date', localEvent.date);
			if (allDayEvents) {
				const shiftUpdates = calculateHoldShifts({
					targetEventId: localEvent.id,
					newLevel: null, // Null means it's being cleared
					oldLevel: localEvent.hold_level as HoldLevel,
					date: localEvent.date,
					category: localEvent.venue.category || '',
					room: localEvent.venue.room || '',
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

	let defaultEmailForVenue = false;
	let showConfirmModal = false;
	let showContactListModal = false;
	let otherEventsSameRoomCount = 0; // NEW

	async function setupConfirm() {
		if (!localEvent) return;
		saving = true;
		try {
			const { data } = await supabase
				.from('calendar_events')
				.select('id, group_id, venue')
				.eq('date', localEvent.date)
				.in('status', ['HOLD', 'PENDING']);

			if (data) {
				sameEventOtherRoomsCount = data.filter(
					(d: any) => d.group_id === localEvent?.group_id && d.id !== localEvent?.id
				).length;

				const otherEvents = data.filter((d: any) => d.group_id !== localEvent?.group_id);
				otherEventsOnDayCount = otherEvents.length;

				const venueParsed =
					typeof localEvent.venue === 'string'
						? JSON.parse(localEvent.venue)
						: localEvent.venue || {};
				const currentCategory = venueParsed.category || '';
				const currentRoom = venueParsed.room || '';

				otherEventsSameRoomCount = otherEvents.filter((d: any) => {
					try {
						const dVenue = typeof d.venue === 'string' ? JSON.parse(d.venue) : d.venue || {};
						return dVenue.category === currentCategory && dVenue.room === currentRoom;
					} catch (e) {
						return false;
					}
				}).length;
			}

			defaultEmailForVenue = localEvent.venue?.category === 'New City Gas';
			showConfirmModal = true;
		} finally {
			saving = false;
		}
	}
	async function executeConfirm(e: CustomEvent) {
		const { sendEmail, sendSms, confirmAllRooms, clearOtherHolds, clearSameRoomHolds } = e.detail;
		if (!localEvent) return;
		saving = true;
		try {
			// 1. Database Updates
			await supabase
				.from('calendar_events')
				.update({ status: 'CONFIRMED', hold_level: null })
				.eq('id', localEvent.id);

			await supabase
				.from('calendar_events')
				.update({ status: 'HIDDEN', hold_level: null })
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

			// Clear EVERY hold on the date no matter the venue or room
			if (clearOtherHolds) {
				await supabase
					.from('calendar_events')
					.update({ status: 'HIDDEN', hold_level: null })
					.eq('date', localEvent.date)
					.neq('group_id', localEvent.group_id)
					.in('status', ['HOLD', 'PENDING']);
			} 
			// Clear ONLY holds that share the exact same venue AND room
			else if (clearSameRoomHolds) {
				await supabase
					.from('calendar_events')
					.update({ status: 'HIDDEN', hold_level: null })
					.eq('date', localEvent.date)
					.neq('group_id', localEvent.group_id)
					.eq('venue->>category', localEvent.venue?.category || '')
					.eq('venue->>room', localEvent.venue?.room || '')
					.in('status', ['HOLD', 'PENDING']);
			}

			// 2. Dispatch Emails and SMS
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'An Admin';

			const payload = {
				eventId: localEvent.short_id || localEvent.id,
				eventTitle: localEvent.title,
				eventType: localEvent.details?.type || 'Event',
				eventDate: localEvent.date,
				venueName:
					`${localEvent.venue?.category || ''} ${localEvent.venue?.room ? '/ ' + localEvent.venue.room : ''}`.trim(),
				authUserName: authName
			};

			const promises = [];

			if (sendEmail) {
				promises.push(
					fetch('/api/calendar-confirm-email', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
						.then((res) => res.json())
						.catch((err) => console.error('Email API failed:', err))
				);
			}

			if (sendSms) {
				promises.push(
					fetch('/api/calendar-confirm-sms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					})
						.then((res) => res.json())
						.catch((err) => console.error('SMS API failed:', err))
				);
			}

			// Wait for notifications to send before closing
			if (promises.length > 0) {
				await Promise.allSettled(promises);
			}

			// 3. Update UI
			showConfirmModal = false;
			dispatch('update');
			show = false;
		} catch (e) {
			console.error('Execute Confirm Error:', e);
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
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="border-b border-gray2/20 mx-6"></div>

			<div class="px-6 py-4 flex items-center justify-between border-b border-gray2/10 shrink-0">
				<div class="flex items-center gap-2">
					<svg
						class="w-5 h-5 text-gray2"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
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
					on:click={() => {
						if (localEvent) {
							show = false;
							goto(`/calendar/${localEvent.short_id}`);
						}
					}}
				>
					View Event
					<svg
						class="w-3 h-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
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
								class="py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer {localEvent.hold_level ===
								'P'
									? 'bg-lime text-black border-lime'
									: 'bg-black/50 text-gray2 border-gray2/30 hover:border-gray2 hover:text-white'}"
								on:click={() => updateHoldLevel('P')}>P</button
							>
							{#each holdNumbers as num}
								<button
									class="py-2 rounded-2xl text-sm font-bold border transition-all cursor-pointer {localEvent.hold_level ===
									`H${num}`
										? 'bg-lime text-black border-lime'
										: 'bg-black/50 text-gray2 border-gray2/30 hover:border-gray2 hover:text-white'}"
									on:click={() => updateHoldLevel(`H${num}` as HoldLevel)}>{num}</button
								>
							{/each}
						</div>
					</div>

					<div class="flex flex-col gap-4">
						<button
							class="w-full py-3 rounded-2xl border border-gray2/30 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 hover:bg-white/5 cursor-pointer"
							on:click={async () => {
								// 1. Save any pending changes made in this modal first
								if (hasUnsavedChanges) {
									await flushChanges();
								}
								// 2. Hide the current modal
								show = false;
								// 3. Tell the parent (Calendar.svelte) to open the sidebar
								dispatch('manageHolds');
							}}
						>
							<svg
								class="w-4 h-4 text-gray2"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"
								></polyline>
							</svg>
							Manage Holds
						</button>

						<div class="grid grid-cols-2 gap-3">
							<button
								class="py-2.5 rounded-2xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer {localEvent
									.event_details?.is_target
									? 'text-confirmed border-confirmed bg-transparent'
									: 'border-gray2/30 text-gray2 bg-transparent hover:text-white hover:border-gray2'}"
								on:click={() => toggleFlag('is_target')}
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"
									></circle><circle cx="12" cy="12" r="2"></circle>
								</svg>
								{localEvent.event_details?.is_target ? 'Remove Target' : 'Add Target'}
							</button>

							<button
								class="py-2.5 rounded-2xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer {localEvent
									.event_details?.is_challenge
									? 'text-tentatif border-tentatif bg-transparent'
									: 'border-gray2/30 text-gray2 bg-transparent hover:text-white hover:border-gray2'}"
								on:click={() => toggleFlag('is_challenge')}
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
								</svg>
								{localEvent.event_details?.is_challenge ? 'Remove Challenge' : 'Challenge Hold'}
							</button>
						</div>
					</div>

					<div>
						<p class="text-[10px] font-bold text-gray2 uppercase mb-1 ml-1">Event Description</p>
						<div class="relative">
							<textarea
								bind:value={tempNotes}
								on:input={() => (isEditingNotes = true)}
								rows="4"
								placeholder="Add notes..."
								class="w-full px-4 py-3 bg-black/50 border border-gray2/30 rounded-2xl text-white placeholder-gray2/50 focus:border-lime focus:outline-none resize-none transition-colors"
							></textarea>

							{#if isEditingNotes}
								<div class="flex justify-end gap-2 mt-2" transition:fade={{ duration: 150 }}>
									<button
										class="w-8 h-8 flex items-center justify-center rounded-lg border border-problem/50 text-problem hover:bg-problem/10 transition-colors cursor-pointer"
										on:click={cancelNotes}
										aria-label="Cancel edit"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
											></line>
										</svg>
									</button>
									<button
										class="w-8 h-8 flex items-center justify-center rounded-lg border border-lime/50 text-lime hover:bg-lime/10 transition-colors cursor-pointer"
										on:click={saveNotes}
										aria-label="Save edits"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
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
						on:click={() => (confirmMode = 'clearAll')}>Clear All Holds</button
					>
					<button
						class="flex-1 py-3 px-2 border border-gray2/30 text-gray2 hover:text-white font-bold text-sm rounded-2xl hover:bg-gray2/10 transition-colors cursor-pointer"
						on:click={() => (confirmMode = 'clearSingle')}>Clear Hold</button
					>
					<button
						class="flex-1 py-3 px-2 bg-lime text-black font-bold text-sm rounded-2xl hover:bg-lime/90 transition-colors cursor-pointer"
						on:click={setupConfirm}
						disabled={saving}>Confirm</button
					>
				</div>
			{:else if confirmMode === 'clearSingle' || confirmMode === 'clearAll'}
				<div class="p-8 flex-1 flex flex-col items-center justify-center text-center">
					<div class="w-16 h-16 rounded-full bg-problem/10 flex items-center justify-center mb-6">
						<svg
							class="w-8 h-8 text-problem"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path
								d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
							></path>
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
							on:click={() => (confirmMode = 'none')}>Cancel</button
						>
						<button
							class="flex-1 py-3 bg-problem text-black font-bold rounded-2xl hover:bg-problem/90 transition-colors cursor-pointer"
							on:click={confirmMode === 'clearAll' ? executeClearAll : executeClearSingle}
							disabled={saving}>Confirm</button
						>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<div use:portal>
	{#if showConflictOverlay && pendingFlag && localEvent}
		<div
			class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="bg-gray1 border border-gray2/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col items-center text-center"
			>
				<div
					class="w-12 h-12 rounded-full bg-tentatif/20 text-tentatif flex items-center justify-center mb-4"
				>
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><path
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/></svg
					>
				</div>
				<h3 class="text-xl font-black text-white mb-2">Conflict Detected</h3>
				<p class="text-gray2 text-sm font-medium mb-6">
					The {pendingFlag === 'is_target' ? 'Target' : 'Challenge'} flag is currently on
					<strong class="text-white"
						>{formatDate(conflictingEventDate).month}
						{formatDate(conflictingEventDate).day}, {formatDate(conflictingEventDate).year}</strong
					>. Do you want to move it here, or add another? ({diffText})
				</p>
				<div class="flex flex-col gap-2 w-full">
					<div class="flex items-center gap-2 w-full mb-4">
						<button
							class="flex-1 py-3 px-4 rounded-3xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
							on:click={() => {
								showConflictOverlay = false;
								pendingFlag = null;
							}}>Cancel</button
						>
						<button
							class="flex-1 py-3 px-4 rounded-3xl font-bold text-black bg-tentatif hover:bg-tentatif/90 transition-colors cursor-pointer"
							on:click={resolveConflict}
							disabled={saving}>Move Flag</button
						>
					</div>
					<button
						class="w-full py-3 px-4 rounded-3xl font-bold text-black bg-lime hover:bg-lime/90 transition-colors cursor-pointer"
						on:click={addAnotherFlag}
						disabled={saving}>Add Another</button
					>
				</div>
			</div>
		</div>
	{/if}

	<Modal
		bind:isOpen={showContactListModal}
		title="Contact List"
		maxWidth="max-w-7xl"
		showCloseButton={true}
		on:close={() => {
			showContactListModal = false;
		}}
	>
		<CalendarContactList />
	</Modal>

	<CalendarConfirm
		bind:show={showConfirmModal}
		title="Confirm Event"
		message="Finalizing this date will auto-hide alternate holds for this event."
		{saving}
		{isAdmin}
		defaultEmail={defaultEmailForVenue}
		showConflicts={true}
		{sameEventOtherRoomsCount}
		{otherEventsOnDayCount}
		{otherEventsSameRoomCount} 
		on:viewContacts={() => (showContactListModal = true)}
		on:confirm={executeConfirm}
	/>
</div>

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
