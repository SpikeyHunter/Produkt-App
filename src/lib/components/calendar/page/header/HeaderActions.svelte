<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';
	import { syncEventToTechSchedule } from '$lib/services/techScheduleSync';
	import CalendarConfirm from '$lib/components/calendar/CalendarConfirm.svelte';

	export let event: CalendarEvent & { calendar?: { title?: string; details?: any }; group_id?: string };
	export let parsedDetails: any;
	export let venues: VenueSettings[];
	export let isEditor: boolean;

	$: isAdmin = $authStore?.profile?.role === 'Admin';
	$: vParsed = typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
	$: defaultEmailForVenue = vParsed.category === 'New City Gas';

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

	// === INITIALIZE ACTIONS ===
	function triggerDelete() {
		showMoreMenu = false;
		confirmPendingTask = 'delete';
		confirmAction = 'cancel'; // Renders the red "Cancel Event" UI in the modal
		showCalendarConfirm = true;
	}

	function openDuplicateModal() {
		showMoreMenu = false;
		duplicateEventName = `Copy of ${event.calendar?.title || event.title || 'Unnamed Event'}`;
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

	function triggerDuplicateConfirm() {
		showDuplicateModal = false;
		confirmPendingTask = 'duplicate';
		confirmAction = 'confirm'; // Renders the green "Confirm Event" UI in the modal
		showCalendarConfirm = true;
	}

	// === UNIFIED EXECUTION LOGIC ===
	async function executeConfirmTask(e: CustomEvent) {
		const { sendEmail, sendSms } = e.detail;
		isSavingConfirm = true;

		try {
			const authUser = $authStore?.profile;
			const authName = authUser ? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim() : 'An Admin';

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
				const { data: calData } = await supabase
					.from('calendar')
					.insert({ title: duplicateEventName.trim(), details: parsedDetails })
					.select()
					.single();

				if (calData) {
					let defaultLevelNum = 2;
					if (vParsed.category) {
						const venueObj = venues.find((v) => v.setting_name === vParsed.category);
						if (venueObj) {
							try {
								const params = typeof venueObj.setting_params === 'string'
										? JSON.parse(venueObj.setting_params) : venueObj.setting_params || {};
								const defaultLevelStr = params?.holdSettings?.defaultHoldLevel;
								if (defaultLevelStr && defaultLevelStr.startsWith('H')) {
									defaultLevelNum = parseInt(defaultLevelStr.replace('H', '')) || 2;
								}
							} catch (err) {}
						}
					}

					const eventsToInsert = [];
					for (const dupDate of dupStagedDates) {
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
						// Sync to Tech Schedule
						for (const newEv of insertedEvents) {
							try {
								const syncPayload = {
									...newEv,
									details: parsedDetails,
									title: duplicateEventName.trim()
								} as CalendarEvent;
								await syncEventToTechSchedule(syncPayload, newEv.status as any);
							} catch (e) {
								console.error("Duplicate Tech Sync failed:", e);
							}
						}

						// Notifications for the duplicated event
						const firstEv = insertedEvents[0];
						const payload = {
							eventId: firstEv.short_id || firstEv.id,
							eventTitle: duplicateEventName.trim(),
							eventType: parsedDetails?.type || 'Event',
							eventDate: firstEv.date,
							venueName: `${vParsed.category || ''} ${vParsed.room ? '/ ' + vParsed.room : ''}`.trim(),
							authUserName: authName,
							action: 'confirm'
						};
						await sendNotifications(payload, sendEmail, sendSms);
					}
				}

				showCalendarConfirm = false;
				invalidateAll();
			}
		} catch (err) {
			console.error("Execute Confirm Task Error:", err);
		} finally {
			isSavingConfirm = false;
			confirmPendingTask = null;
		}
	}

	async function sendNotifications(payload: any, sendEmail: boolean, sendSms: boolean) {
		const promises = [];
		if (sendEmail) {
			promises.push(fetch('/api/calendar-confirm-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
		}
		if (sendSms) {
			promises.push(fetch('/api/calendar-confirm-sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
		}
		if (promises.length > 0) await Promise.allSettled(promises);
	}
</script>

<svelte:window
	on:click={(e) => {
		if (showMoreMenu && e.target instanceof Element && !e.target.closest('.more-options-dropdown-container')) {
			showMoreMenu = false;
		}
	}}
/>

<div class="relative more-options-dropdown-container">
	<button
		class="text-gray2 transition-colors p-1 {isEditor ? 'hover:text-white cursor-pointer' : 'opacity-50'}"
		style="cursor: {!isEditor ? 'not-allowed' : 'pointer'};"
		aria-label="More options"
		disabled={!isEditor}
		title={!isEditor ? 'You do not have permission for advanced options' : 'More options'}
		on:click={() => { if (isEditor) showMoreMenu = !showMoreMenu; }}
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="1"></circle>
			<circle cx="12" cy="5" r="1"></circle>
			<circle cx="12" cy="19" r="1"></circle>
		</svg>
	</button>

	{#if showMoreMenu && isEditor}
		<div class="absolute right-0 top-[calc(100%+8px)] w-48 bg-navbar rounded-2xl shadow-xl overflow-hidden py-2 z-[9999] border border-gray2/10">
			<button
				class="w-full px-4 py-2.5 text-sm font-bold text-white hover:bg-white/5 text-left transition-colors cursor-pointer"
				on:click={openDuplicateModal}>Duplicate Event</button>
			<button
				class="w-full px-4 py-2.5 text-sm font-bold text-problem hover:bg-white/5 text-left transition-colors cursor-pointer"
				on:click={triggerDelete}>Delete Event</button>
		</div>
	{/if}
</div>

{#if showDuplicateModal && isEditor}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-gray1 border border-gray2/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
			<h3 class="text-xl font-black text-white mb-6">Duplicate Event</h3>
			<div class="flex flex-col gap-4 mb-6">
				<div class="flex flex-col gap-2">
					<label for="dup-name" class="text-xs font-bold text-gray2 uppercase tracking-wider">Event Name</label>
					<input id="dup-name" type="text" bind:value={duplicateEventName} class="bg-navbar border border-gray2/20 rounded-xl px-4 py-3 text-white font-bold focus:border-lime transition-colors w-full" />
				</div>
				<div class="flex flex-col gap-2 mt-2">
					<p class="text-xs font-bold text-gray2 uppercase tracking-wider">Select Dates</p>
					<div class="bg-navbar border border-gray2/20 rounded-2xl p-4">
						<div class="flex justify-between items-center mb-4">
							<button aria-label="Previous month" class="p-1 hover:bg-white/5 rounded cursor-pointer" on:click={() => (dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() - 1)))}>
								<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
							</button>
							<span class="text-sm font-bold text-white tracking-wide">{dupDatesMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
							<button aria-label="Next month" class="p-1 hover:bg-white/5 rounded cursor-pointer" on:click={() => (dupDatesMonth = new Date(dupDatesMonth.setMonth(dupDatesMonth.getMonth() + 1)))}>
								<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
							</button>
						</div>
						<div class="grid grid-cols-7 gap-1 text-center mb-2">
							{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}<div class="text-[10px] font-bold text-gray2">{d}</div>{/each}
						</div>
						<div class="grid grid-cols-7 gap-1.5 text-center">
							{#each Array(new Date(dupDatesMonth.getFullYear(), dupDatesMonth.getMonth(), 1).getDay()) as _}<div></div>{/each}
							{#each Array(new Date(dupDatesMonth.getFullYear(), dupDatesMonth.getMonth() + 1, 0).getDate()) as _, i}
								{@const dayNum = i + 1}
								{@const targetDate = `${dupDatesMonth.getFullYear()}-${String(dupDatesMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
								{@const isSelected = dupStagedDates.includes(targetDate)}
								<button class="w-7 h-7 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer {isSelected ? 'border-2 border-lime text-white' : 'text-gray2 hover:bg-white/5'}" on:click={() => toggleDupDate(targetDate)}>
									{dayNum}
									{#if isSelected}<div class="w-1 h-1 rounded-full bg-lime absolute bottom-0.5"></div>{/if}
								</button>
							{/each}
						</div>
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end gap-3">
				<button class="py-2.5 px-5 rounded-xl font-bold text-white hover:bg-white/5 transition-colors cursor-pointer" on:click={() => (showDuplicateModal = false)}>Cancel</button>
				<button class="py-2.5 px-6 rounded-xl font-black text-bg-primary bg-lime hover:bg-lime/90 transition-colors cursor-pointer disabled:opacity-50" on:click={triggerDuplicateConfirm} disabled={!duplicateEventName.trim() || dupStagedDates.length === 0}>Create</button>
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