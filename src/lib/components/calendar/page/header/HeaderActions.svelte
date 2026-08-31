<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';
	import { syncEventToTechSchedule } from '$lib/services/techScheduleSync';
	import CalendarConfirm from '$lib/components/calendar/CalendarConfirm.svelte';

	export let event: CalendarEvent & {
		calendar?: { title?: string; details?: any };
		group_id?: string;
	};
	export let parsedDetails: any;
	export let venues: VenueSettings[];
	export let isEditor: boolean;

	$: isAdmin = $authStore?.profile?.role === 'Admin';
	$: vParsed = typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
	$: defaultEmailForVenue = vParsed.category === 'New City Gas';

	const dispatch = createEventDispatcher();

	let showMoreMenu = false;

	// === CALENDAR CONFIRM MODAL STATE ===
	let showCalendarConfirm = false;
	let confirmAction: 'confirm' | 'cancel' = 'confirm';
	let confirmPendingTask: 'delete' | 'duplicate' | null = null;
	let isSavingConfirm = false;

	// === DUPLICATE MODAL STATE ===
	let showDuplicateModal = false;
	let duplicateEventName = '';
	let dupDatesMonth = new Date();
	let dupStagedDates: string[] = [];
	// Duplicate without dates (undefined hold) — default for a dateless source.
	let dupNoDate = false;
	$: if (dupNoDate && dupStagedDates.length > 0) dupStagedDates = [];

	// Add this near your other modal states (around line 18)
	let showDeleteHoldModal = false;

	// === INITIALIZE ACTIONS ===
	function triggerDelete() {
		showMoreMenu = false;

		// --- NEW: Open custom modal for deleting a HOLD event ---
		if (event.status === 'HOLD') {
			showDeleteHoldModal = true;
			return; // Stop here so the main email modal doesn't open
		}
		// --------------------------------------------------------

		confirmPendingTask = 'delete';
		confirmAction = 'cancel';
		// Renders the red "Cancel Event" UI in the modal
		showCalendarConfirm = true;
	}

	// --- NEW: Execution function for the Delete Hold Modal ---
	async function executeDeleteHold() {
		isSavingConfirm = true;
		try {
			confirmPendingTask = 'delete';
			// Pass a mock CustomEvent to execute Confirm Task with emails/sms forced to false
			await executeConfirmTask(new CustomEvent('confirm', {
				detail: { sendEmail: false, sendSms: false }
			}));
		} finally {
			showDeleteHoldModal = false;
			isSavingConfirm = false;
		}
	}
	// ---------------------------------------------------------

	function openDuplicateModal() {
		showMoreMenu = false;
		duplicateEventName = `${event.calendar?.title || event.title || 'Unnamed Event'} (DUPLICATE)`;
		// A dateless (undefined) hold duplicates as another dateless hold.
		dupNoDate = !event.date;
		dupStagedDates = event.date ? [event.date] : [];
		dupDatesMonth = new Date((event.date || new Date().toISOString().split('T')[0]) + 'T00:00:00');
		showDuplicateModal = true;
	}

	/** Deep copy helper that also drops this event's generated-document history,
	 *  so a duplicate never points at (or overwrites) the original's PDFs. */
	function cloneDealPayload(raw: any): any {
		let payload: any = raw;
		if (typeof payload === 'string') {
			try {
				payload = JSON.parse(payload);
				if (typeof payload === 'string') payload = JSON.parse(payload);
			} catch {
				return {};
			}
		}
		if (!payload || typeof payload !== 'object') return {};
		const copy = JSON.parse(JSON.stringify(payload));
		// Deals live under headliner_deal / support_deal / support_deal_2 ...
		for (const key of Object.keys(copy)) {
			const val = copy[key];
			if (val && typeof val === 'object' && /_deal(_\d+)?$/.test(key)) {
				delete val.offers;
				delete val.settlements;
				delete val.settlementAdjustments;
				delete val.savedSettlementRate;
				delete val.savedSettlementRateAt;
			}
		}
		delete copy.lockedExchangeRate;
		delete copy.lockedExchangeRateAt;
		return copy;
	}

	/** Copies every calendar_data version (deals, revenue, costs, contacts,
	 *  pro forma, T&C) from the source event onto the duplicate. */
	async function copyCalendarData(sourceGroupId: string, newGroupId: string, newEventIds: string[]) {
		const { data: rows, error } = await supabase
			.from('calendar_data')
			.select('*')
			.eq('calendar_id', sourceGroupId);
		if (error || !rows || rows.length === 0) return;

		const inserts = rows.map((row: any) => {
			const copy: any = { ...row };
			delete copy.id;
			delete copy.created_at;
			delete copy.updated_at;
			copy.calendar_id = newGroupId;
			copy.event_ids = newEventIds;
			copy.event_deal = cloneDealPayload(row.event_deal);
			return copy;
		});

		const { error: insErr } = await supabase.from('calendar_data').insert(inserts);
		if (insErr) console.error('❌ [duplicate] Failed to copy calendar_data:', insErr);
	}

	function toggleDupDate(targetDate: string) {
		if (dupStagedDates.includes(targetDate)) {
			dupStagedDates = dupStagedDates.filter((d) => d !== targetDate);
		} else {
			dupStagedDates = [...dupStagedDates, targetDate];
		}
	}

	async function triggerDuplicateConfirm() {
		showDuplicateModal = false;
		confirmPendingTask = 'duplicate';
		confirmAction = 'confirm'; // Renders the green "Confirm Event" UI in the modal

		// Only a duplicate that lands as CONFIRMED warrants the notification
		// prompt — holds and dateless (undefined) duplicates save silently.
		const duplicateWillBeConfirmed = event.status === 'CONFIRMED' && !dupNoDate;
		if (!duplicateWillBeConfirmed) {
			await executeConfirmTask(
				new CustomEvent('confirm', { detail: { sendEmail: false, sendSms: false } })
			);
			return;
		}
		showCalendarConfirm = true;
	}

	// === UNIFIED EXECUTION LOGIC ===
	async function executeConfirmTask(e: CustomEvent) {
		const { sendEmail, sendSms } = e.detail;
		isSavingConfirm = true;

		try {
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'An Admin';

			// --- DELETE LOGIC ---
			if (confirmPendingTask === 'delete') {
				// 1. Sync to Tech Schedule to flag as Canceled
				try {
					await syncEventToTechSchedule(event as CalendarEvent, 'CANCELED');
				} catch (err) {
					console.error('Tech Sync failed:', err);
				}

				// 2. Delete DB
				await supabase.from('calendar').delete().eq('id', event.group_id);

				// 3. Notifications
				const payload = {
					eventId: event.short_id || event.id,
					eventTitle: event.calendar?.title || event.title || 'Unnamed Event',
					eventType: parsedDetails?.type || 'Event',
					eventDate: event.date,
					venueName: `${vParsed.category || ''} ${vParsed.room ? '/ ' + vParsed.room : ''}`.trim(),
					authUserName: authName,
					action: 'cancel'
				};
				await sendNotifications(payload, sendEmail, sendSms);

				showCalendarConfirm = false;
				goto('/calendar');
			}

			// --- DUPLICATE LOGIC ---
			else if (confirmPendingTask === 'duplicate') {
				let duplicateRouteId: string | null = null;
				// Copy the whole calendar row (details, current_version, ...) so the
				// duplicate is a standalone twin — never linked to the original.
				const { data: srcCal } = await supabase
					.from('calendar')
					.select('*')
					.eq('id', event.group_id)
					.maybeSingle();
				const calInsert: any = { ...(srcCal || {}) };
				delete calInsert.id;
				delete calInsert.created_at;
				delete calInsert.updated_at;
				delete calInsert.short_id;
				calInsert.title = duplicateEventName.trim();
				calInsert.details = parsedDetails;
				if (!calInsert.creator_name) {
					calInsert.creator_name =
						`${authUser?.first_name || ''} ${authUser?.last_name || ''}`.trim() || 'Unknown';
				}

				const { data: calData, error: calErr } = await supabase
					.from('calendar')
					.insert(calInsert)
					.select()
					.single();
				if (calErr) throw calErr;

				if (calData) {
					let defaultLevelNum = 2;
					if (vParsed.category) {
						const venueObj = venues.find((v) => v.setting_name === vParsed.category);
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
							} catch (err) {}
						}
					}

					const eventsToInsert = [];

					if (dupNoDate) {
						// Dateless duplicate: an undefined hold, like Date Bypass.
						eventsToInsert.push({
							group_id: calData.id,
							date: null,
							status: 'HOLD',
							hold_level: null,
							venue: event.venue || {},
							time: event.time || {},
							event_details: event.event_details || {}
						});
					}

					for (const dupDate of dupNoDate ? [] : dupStagedDates) {
						let statusToSet = event.status;
						let holdLevelToSet = event.hold_level;

						if (statusToSet === 'CONFIRMED') {
							holdLevelToSet = null;
						} else if (statusToSet === 'HOLD') {
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
								} catch (err) {}
								return hRoom === vParsed.room;
							});

							const levels = roomHolds.map((h) => h.hold_level).filter(Boolean);
							let nextAvailable = defaultLevelNum;
							while (levels.includes(`H${nextAvailable}` as CalendarEvent['hold_level'])) {
								nextAvailable++;
							}
							holdLevelToSet = `H${nextAvailable}` as CalendarEvent['hold_level'];
						}

						eventsToInsert.push({
							group_id: calData.id,
							date: dupDate,
							status: statusToSet,
							hold_level: holdLevelToSet,
							venue: event.venue || {},
							time: event.time || {},
							event_details: event.event_details || {}
						});
					}

					const { data: insertedEvents } = await supabase
						.from('calendar_events')
						.insert(eventsToInsert)
						.select('*, calendar(*)');

					if (insertedEvents && insertedEvents.length > 0) {
						// Land on the duplicate once it's fully built.
						duplicateRouteId = String(insertedEvents[0].short_id || insertedEvents[0].id);

						// Carry over deals, revenue, costs, contacts, T&C — every
						// calendar_data version — minus generated offers/settlements.
						await copyCalendarData(
							String(event.group_id),
							calData.id,
							insertedEvents.map((e: any) => e.id)
						);

						// Sync to Tech Schedule (dateless holds have nothing to sync)
						for (const newEv of insertedEvents) {
							if (!newEv.date) continue;
							try {
								const syncPayload = {
									...newEv,
									details: parsedDetails,
									title: duplicateEventName.trim()
								} as CalendarEvent;
								await syncEventToTechSchedule(syncPayload, newEv.status as any);
							} catch (e) {
								console.error('Duplicate Tech Sync failed:', e);
							}
						}

						// Notifications for the duplicated event
						const firstEv = insertedEvents[0];
						const payload = {
							eventId: firstEv.short_id || firstEv.id,
							eventTitle: duplicateEventName.trim(),
							eventType: parsedDetails?.type || 'Event',
							eventDate: firstEv.date,
							venueName:
								`${vParsed.category || ''} ${vParsed.room ? '/ ' + vParsed.room : ''}`.trim(),
							authUserName: authName,
							action: 'confirm'
						};
						await sendNotifications(payload, sendEmail, sendSms);
					}
				}

				showCalendarConfirm = false;
				if (duplicateRouteId) {
					// Open the new event (full reload of its page data).
					await goto(`/calendar/${duplicateRouteId}`, { invalidateAll: true });
				} else {
					invalidateAll();
				}
			}
		} catch (err) {
			console.error('Execute Confirm Task Error:', err);
		} finally {
			isSavingConfirm = false;
			confirmPendingTask = null;
		}
	}

	async function sendNotifications(payload: any, sendEmail: boolean, sendSms: boolean) {
		const promises = [];
		if (sendEmail) {
			promises.push(
				fetch('/api/calendar-confirm-email', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				})
			);
		}
		if (sendSms) {
			promises.push(
				fetch('/api/calendar-confirm-sms', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				})
			);
		}
		if (promises.length > 0) await Promise.allSettled(promises);
	}
</script>

<svelte:window
	on:click={(e) => {
		if (
			showMoreMenu &&
			e.target instanceof Element &&
			!e.target.closest('.more-options-dropdown-container')
		) {
			showMoreMenu = false;
		}
	}}
/>

<div class="relative more-options-dropdown-container">
	<button
		class="text-gray2 transition-colors p-1 {isEditor
			? 'hover:text-white cursor-pointer'
			: 'opacity-50'}"
		style="cursor: {!isEditor ? 'not-allowed' : 'pointer'};"
		aria-label="More options"
		disabled={!isEditor}
		title={!isEditor ? 'You do not have permission for advanced options' : 'More options'}
		on:click={() => {
			if (isEditor) showMoreMenu = !showMoreMenu;
		}}
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="1"></circle>
			<circle cx="12" cy="5" r="1"></circle>
			<circle cx="12" cy="19" r="1"></circle>
		</svg>
	</button>

	{#if showMoreMenu && isEditor}
		<div
			class="absolute right-0 top-[calc(100%+8px)] w-48 bg-navbar rounded-2xl shadow-xl overflow-hidden py-2 z-[9999] border border-gray2/10"
		>
			<button
				class="w-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 text-left transition-colors cursor-pointer"
				on:click={() => {
					showMoreMenu = false;
					dispatch('applyEventTemplate');
				}}>Apply Event Template</button
			>
			<button
				class="w-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 text-left transition-colors cursor-pointer"
				on:click={openDuplicateModal}>Duplicate Event</button
			>
			<button
				class="w-full px-4 py-2.5 text-sm font-bold text-problem hover:bg-white/5 text-left transition-colors cursor-pointer"
				on:click={triggerDelete}>Delete Event</button
			>
		</div>
	{/if}
</div>

{#if showDuplicateModal && isEditor}
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
				<label class="flex items-center gap-2.5 cursor-pointer">
					<input type="checkbox" class="hidden" bind:checked={dupNoDate} />
					<div
						class="w-4 h-4 rounded border flex items-center justify-center shrink-0 {dupNoDate
							? 'bg-lime border-lime'
							: 'border-gray2/50'}"
					>
						{#if dupNoDate}<svg
								class="w-3 h-3 text-black"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
							>{/if}
					</div>
					<span class="text-xs font-bold text-white">Date Bypass</span>
				</label>

				<div class="flex flex-col gap-2 mt-2 {dupNoDate ? 'opacity-40 pointer-events-none' : ''}">
					<p class="text-xs font-bold text-gray2 uppercase tracking-wider">
						{dupNoDate ? 'Dates bypassed' : 'Select Dates'}
					</p>
					<div class="bg-navbar border border-gray2/20 rounded-2xl p-4">
						<div class="flex justify-between items-center mb-4">
							<button
								aria-label="Previous month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() =>
									(dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() - 1)))}
							>
								<svg
									class="w-4 h-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg
								>
							</button>
							<span class="text-sm font-bold text-white tracking-wide"
								>{dupDatesMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span
							>
							<button
								aria-label="Next month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() =>
									(dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() + 1)))}
							>
								<svg
									class="w-4 h-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg
								>
							</button>
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
					on:click={triggerDuplicateConfirm}
					disabled={!duplicateEventName.trim() || (!dupNoDate && dupStagedDates.length === 0)}
					>Create</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteHoldModal && isEditor}
	<div class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-gray1 rounded-2xl max-w-sm w-full relative shadow-2xl border border-gray2/20 flex flex-col p-8 text-center">
			
			<div class="w-12 h-12 rounded-full bg-problem/20 text-problem flex items-center justify-center mx-auto mb-4 shrink-0">
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</div>

			<h3 class="text-xl font-black text-white mb-2">Delete Held Event</h3>
			<p class="text-sm font-bold text-gray2 mb-8">Are you sure you want to delete this held event? No emails will be sent.</p>

			<div class="flex gap-3 w-full shrink-0">
				<button
					class="flex-1 py-3 bg-transparent border border-gray2/20 text-gray2 font-bold rounded-xl hover:bg-gray2/10 hover:text-white transition-colors cursor-pointer"
					on:click={() => (showDeleteHoldModal = false)}
					disabled={isSavingConfirm}
				>
					Cancel
				</button>
				<button
					class="flex-[1.5] py-3 text-black font-bold rounded-xl bg-problem hover:bg-problem/90 transition-colors flex justify-center items-center cursor-pointer"
					on:click={executeDeleteHold}
					disabled={isSavingConfirm}
				>
					{#if isSavingConfirm}
						<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2"></div>
					{/if}
					Delete Event
				</button>
			</div>
			
		</div>
	</div>
{/if}

{#if showCalendarConfirm}
	<CalendarConfirm
		bind:show={showCalendarConfirm}
		action={confirmAction}
		saving={isSavingConfirm}
		{isAdmin}
		defaultEmail={defaultEmailForVenue}
		showConflicts={false}
		on:confirm={executeConfirmTask}
		on:cancel={() => {
			showCalendarConfirm = false;
			confirmPendingTask = null;
		}}
	/>
{/if}
