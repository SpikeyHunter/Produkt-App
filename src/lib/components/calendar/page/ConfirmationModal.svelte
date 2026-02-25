<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import { portal } from '$lib/utils/portalUtils';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';
	import Modal from '$lib/components/modals/Modal.svelte';
	import CalendarContactList from '$lib/components/calendar/CalendarContactList.svelte';

	type ExtendedEvent = CalendarEvent & {
		calendar?: {
			title?: string;
			details?: any;
		};
		short_id?: number;
		details?: any;
	};

	export let show: boolean;
	export let event: ExtendedEvent;
	export let newStatus: 'CONFIRMED' | 'HOLD';
	export let venues: VenueSettings[];

	let dialogEl: HTMLDivElement;
	let saving = false;
	const dispatch = createEventDispatcher();

	let optSendEmail = false;
	let optSendSms = false;
	let emailUsersCount = 0;
	let smsUsersCount = 0;
	let showContactListModal = false;

	let sameEventOtherRoomsCount = 0;
	let otherEventsOnDayCount = 0;
	let optConfirmAllRooms = false;
	let optClearOtherHolds = false;

	$: isAdmin = $authStore?.profile?.role === 'Admin';
	$: isConfirming = newStatus === 'CONFIRMED';

	$: if (show) {
		setupConfirm();
		tick().then(() => dialogEl?.focus());
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}

	function closeModal() {
		show = false;
		dispatch('close');
	}

	async function refreshUserCounts() {
		try {
			const [{ count: eCount }, { count: sCount }] = await Promise.all([
				supabase
					.from('calendar_users')
					.select('*', { count: 'exact', head: true })
					.eq('confirmation_email', true),
				supabase
					.from('calendar_users')
					.select('*', { count: 'exact', head: true })
					.eq('confirmation_phone', true)
			]);
			emailUsersCount = eCount || 0;
			smsUsersCount = sCount || 0;
		} catch (err) {
			console.error('Failed to fetch user counts:', err);
		}
	}

	async function setupConfirm() {
		saving = true;
		try {
			const { data } = await supabase
				.from('calendar_events')
				.select('id, group_id')
				.eq('date', event.date)
				.in('status', ['HOLD', 'PENDING']);

			if (data) {
				sameEventOtherRoomsCount = data.filter(
					(d) => d.group_id === event.group_id && d.id !== event.id
				).length;
				otherEventsOnDayCount = data.filter((d) => d.group_id !== event.group_id).length;
			}

			await refreshUserCounts();

			optConfirmAllRooms = false;
			optClearOtherHolds = false;

			// Auto-select email confirmation if venue is New City Gas
			const venueParsed =
				typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
			optSendEmail = venueParsed.category === 'New City Gas';
			optSendSms = false;
		} finally {
			saving = false;
		}
	}

	async function executeChange() {
		saving = true;
		try {
			const oldStatus = event.status;

			// === 1. DATABASE UPDATES ===
			if (newStatus === 'CONFIRMED' && oldStatus === 'HOLD') {
				await supabase
					.from('calendar_events')
					.update({ status: 'CONFIRMED', hold_level: null })
					.eq('id', event.id);

				if (sameEventOtherRoomsCount > 0) {
					if (optConfirmAllRooms) {
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

				if (optClearOtherHolds && otherEventsOnDayCount > 0) {
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

				const matchingOtherHiddenRows = (otherHiddenRows || []).filter((r) => {
					try {
						const vParsed = typeof r.venue === 'string' ? JSON.parse(r.venue) : r.venue || {};
						return vParsed.category === currentCategory && vParsed.room === currentRoom;
					} catch (e) {
						return false;
					}
				});

				const rowsToProcess = [...(allGroupRows || []), ...matchingOtherHiddenRows];
				rowsToProcess.sort((a, b) => {
					if (a.id === event.id) return -1;
					if (b.id === event.id) return 1;
					if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') return -1;
					if (b.status === 'CONFIRMED' && a.status !== 'CONFIRMED') return 1;
					return 0;
				});

				const locallyAssigned: Record<string, string[]> = {};
				const processingIds = rowsToProcess.map((r) => r.id);

				for (const row of rowsToProcess) {
					let defaultLevelNum = 2;
					let vCat = '';
					let vRoom = '';
					try {
						const vParsed = typeof row.venue === 'string' ? JSON.parse(row.venue) : row.venue || {};
						vCat = vParsed.category || '';
						vRoom = vParsed.room || '';
					} catch (e) {}

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

					const trackKey = `${row.date}:::${vRoom}`;
					if (!locallyAssigned[trackKey]) locallyAssigned[trackKey] = [];

					const { data: existingHolds } = await supabase
						.from('calendar_events')
						.select('id, hold_level, venue')
						.eq('date', row.date)
						.eq('status', 'HOLD');

					const roomHolds = (existingHolds || []).filter((h) => {
						if (processingIds.includes(h.id)) return false;
						let hRoom = '';
						try {
							const hParsed = typeof h.venue === 'string' ? JSON.parse(h.venue) : h.venue || {};
							hRoom = hParsed.room || '';
						} catch (e) {}
						return hRoom === vRoom;
					});

					const levels = roomHolds.map((h) => h.hold_level).filter(Boolean);
					levels.push(...locallyAssigned[trackKey]);

					let nextAvailable = defaultLevelNum;
					while (levels.includes(`H${nextAvailable}` as CalendarEvent['hold_level'])) {
						nextAvailable++;
					}

					locallyAssigned[trackKey].push(`H${nextAvailable}`);

					await supabase
						.from('calendar_events')
						.update({
							status: 'HOLD',
							hold_level: `H${nextAvailable}` as CalendarEvent['hold_level']
						})
						.eq('id', row.id);
				}

				await supabase
					.from('calendar_events')
					.update({ status: 'HOLD' })
					.eq('group_id', event.group_id)
					.eq('status', 'HIDDEN');
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

			// === 2. DISPATCH EMAILS / SMS ===
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'An Admin';

			const rawDetails = event.calendar?.details || event.details || {};
			const parsedDetails = typeof rawDetails === 'string' ? JSON.parse(rawDetails) : rawDetails;

			const venueParsed =
				typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};

			const payload = {
				eventId: event.short_id || event.id,
				eventTitle: event.calendar?.title || event.title || 'Unnamed Event',
				eventType: parsedDetails?.type || 'Event',
				eventDate: event.date,
				venueName:
					`${venueParsed.category || ''} ${venueParsed.room ? '/ ' + venueParsed.room : ''}`.trim(),
				authUserName: authName,
				action: isConfirming ? 'confirm' : 'cancel'
			};

			const promises = [];
			if (optSendEmail) {
				promises.push(
					fetch('/api/calendar-confirm-email', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}).catch((err) => console.error('Email API failed:', err))
				);
			}

			if (optSendSms) {
				promises.push(
					fetch('/api/calendar-confirm-sms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					}).catch((err) => console.error('SMS API failed:', err))
				);
			}

			if (promises.length > 0) {
				await Promise.allSettled(promises);
			}

			// === 3. FINISH ===
			dispatch('update');
			show = false;
		} catch (e) {
			console.error('Execute Change Error:', e);
		} finally {
			saving = false;
		}
	}
</script>

<div use:portal>
	{#if show}
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
							{event.calendar?.title || event.title || 'Unnamed Event'}
						</h3>
						<p class="text-sm font-bold text-gray2 mt-1">
							{new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
								weekday: 'long',
								month: 'long',
								day: 'numeric',
								year: 'numeric'
							})}
						</p>
					</div>
					<button
						aria-label="Close modal"
						class="text-gray2 hover:text-white transition-colors cursor-pointer"
						on:click={closeModal}
						disabled={saving}
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

				<div class="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
					<div class="flex items-center gap-3 mb-6">
						<div
							class="w-10 h-10 rounded-full {isConfirming
								? 'bg-lime/20 text-lime'
								: 'bg-problem/20 text-problem'} flex items-center justify-center shrink-0"
						>
							{#if isConfirming}
								<span class="font-black text-xl">✓</span>
							{:else}
								<svg
									class="w-5 h-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
									></line></svg
								>
							{/if}
						</div>
						<div class="text-left">
							<h3 class="text-lg font-black text-white">
								{isConfirming ? 'Confirm Event' : 'Cancel Event'}
							</h3>
							<p class="text-[11px] font-bold text-gray2">
								{isConfirming
									? 'Finalizing this date will auto-hide alternate holds for this event.'
									: 'Changing status to Hold will cancel this confirmed event globally.'}
							</p>
						</div>
					</div>

					<div class="space-y-3 mb-8">
						{#if isConfirming}
							{#if sameEventOtherRoomsCount > 0}
								<label
									class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optConfirmAllRooms
										? 'border-lime/50 bg-lime/5'
										: ''}"
								>
									<div
										class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optConfirmAllRooms
											? 'bg-lime border-lime'
											: 'border-2 border-gray2 bg-transparent'}"
									>
										{#if optConfirmAllRooms}<svg
												class="w-3.5 h-3.5 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
											>{/if}
									</div>
									<p class="text-sm font-bold text-white leading-tight">
										Confirm all holds for the same venue for this event
									</p>
									<input type="checkbox" class="hidden" bind:checked={optConfirmAllRooms} />
								</label>
							{/if}

							{#if otherEventsOnDayCount > 0}
								<label
									class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optClearOtherHolds
										? 'border-lime/50 bg-lime/5'
										: ''}"
								>
									<div
										class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optClearOtherHolds
											? 'bg-lime border-lime'
											: 'border-2 border-gray2 bg-transparent'}"
									>
										{#if optClearOtherHolds}<svg
												class="w-3.5 h-3.5 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
											>{/if}
									</div>
									<p class="text-sm font-bold text-white leading-tight">
										Clear all holds (including pending) on this day
									</p>
									<input type="checkbox" class="hidden" bind:checked={optClearOtherHolds} />
								</label>
							{/if}

							{#if sameEventOtherRoomsCount === 0 && otherEventsOnDayCount === 0}
								<div class="py-8 text-center">
									<p class="text-sm font-bold text-gray2">
										No scheduling conflicts detected for this date!
									</p>
								</div>
							{/if}
						{/if}

						<div class="mt-4 pt-4 border-t border-gray2/20 space-y-3">
							<p class="text-sm font-bold text-gray2 mb-2">
								Share {isConfirming ? 'confirmation' : 'cancellation'}
							</p>

							<div
								class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendEmail
									? isConfirming
										? 'border-lime bg-lime/5'
										: 'border-problem bg-problem/5'
									: 'border-gray2/20 hover:bg-gray2/10'}"
								on:click={() => (optSendEmail = !optSendEmail)}
								on:keydown={(e) =>
									(e.key === 'Enter' || e.key === ' ') && (optSendEmail = !optSendEmail)}
								role="button"
								tabindex="0"
								aria-label="Toggle Email"
							>
								<div
									class="mt-0.5 transition-colors {optSendEmail
										? isConfirming
											? 'text-lime'
											: 'text-problem'
										: 'text-gray2'}"
								>
									<svg
										class="w-5 h-5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path
											d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
										></path><polyline points="22,6 12,13 2,6"></polyline></svg
									>
								</div>
								<div class="flex-1">
									<p class="text-sm font-bold text-white leading-tight">
										Send Email {isConfirming ? 'confirmation' : 'cancellation'} to
										<span class={isConfirming ? 'text-lime' : 'text-problem'}
											>{emailUsersCount}</span
										>
										user{emailUsersCount !== 1 ? 's' : ''}
									</p>
								</div>
								{#if isAdmin}<button
										aria-label="View email list"
										type="button"
										class="text-xs {isConfirming
											? 'text-lime'
											: 'text-problem'} font-bold hover:underline cursor-pointer"
										on:click|stopPropagation={() => (showContactListModal = true)}
										>(view list)</button
									>{/if}
							</div>

							<div
								class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendSms
									? isConfirming
										? 'border-lime bg-lime/5'
										: 'border-problem bg-problem/5'
									: 'border-gray2/20 hover:bg-gray2/10'}"
								on:click={() => (optSendSms = !optSendSms)}
								on:keydown={(e) =>
									(e.key === 'Enter' || e.key === ' ') && (optSendSms = !optSendSms)}
								role="button"
								tabindex="0"
								aria-label="Toggle SMS"
							>
								<div
									class="mt-0.5 transition-colors {optSendSms
										? isConfirming
											? 'text-lime'
											: 'text-problem'
										: 'text-gray2'}"
								>
									<svg
										class="w-5 h-5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
										></path></svg
									>
								</div>
								<div class="flex-1">
									<p class="text-sm font-bold text-white leading-tight">
										Send SMS {isConfirming ? 'confirmation' : 'cancellation'} to
										<span class={isConfirming ? 'text-lime' : 'text-problem'}>{smsUsersCount}</span>
										user{smsUsersCount !== 1 ? 's' : ''}
									</p>
								</div>
								{#if isAdmin}<button
										aria-label="View SMS list"
										type="button"
										class="text-xs {isConfirming
											? 'text-lime'
											: 'text-problem'} font-bold hover:underline cursor-pointer"
										on:click|stopPropagation={() => (showContactListModal = true)}
										>(view list)</button
									>{/if}
							</div>
						</div>
					</div>

					<div class="mt-auto flex gap-3 w-full shrink-0">
						<button
							class="flex-1 py-3 bg-transparent border border-gray2/20 text-gray2 font-bold rounded-2xl hover:bg-gray2/10 hover:text-white transition-colors cursor-pointer"
							on:click={closeModal}>Cancel</button
						>
						<button
							class="flex-[1.5] py-3 text-black font-bold rounded-2xl transition-colors cursor-pointer flex justify-center items-center {isConfirming
								? 'bg-lime hover:bg-lime/90'
								: 'bg-problem hover:bg-problem/90'}"
							on:click={executeChange}
							disabled={saving}
						>
							{#if saving}<div
									class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2"
								></div>{/if}
							{isConfirming ? 'Confirm Event' : 'Cancel Event'}
						</button>
					</div>
				</div>
			</div>
		</div>

		<Modal
			bind:isOpen={showContactListModal}
			title="Contact List"
			maxWidth="max-w-7xl"
			showCloseButton={true}
			on:close={() => {
				showContactListModal = false;
				refreshUserCounts();
			}}
		>
			<CalendarContactList />
		</Modal>
	{/if}
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
