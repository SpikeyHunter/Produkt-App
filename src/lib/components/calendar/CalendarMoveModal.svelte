<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, HoldLevel, VenueSettings } from '$lib/types/calendar-types';
	import { portal } from '$lib/utils/portalUtils';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import { getNextAvailableHold, calculateAutoPromotions } from '$lib/utils/holdManager';

	export let show = false;
	export let event: CalendarEvent | null = null;
	export let newDateStr: string | null = null;
	export let existingEvents: CalendarEvent[] = [];
	export let venues: VenueSettings[] = [];

	const dispatch = createEventDispatcher();
	let saving = false;

	// Notification State
	let showPopup = false;
	let popupMessage = '';

	$: oldDateObj = event ? new Date(event.date + 'T00:00:00') : null;
	$: newDateObj = newDateStr ? new Date(newDateStr + 'T00:00:00') : null;
	$: dayDiff =
		oldDateObj && newDateObj
			? Math.round((newDateObj.getTime() - oldDateObj.getTime()) / (1000 * 3600 * 24))
			: 0;
	$: diffText =
		dayDiff > 0
			? `+ ${dayDiff} day${dayDiff > 1 ? 's' : ''}`
			: `${dayDiff} day${Math.abs(dayDiff) > 1 ? 's' : ''}`;

	function close() {
		show = false;
		dispatch('close');
	}

	function showError(msg: string) {
		popupMessage = msg;
		showPopup = true;
	}

	function getVenueSettings() {
		return venues.find((v) => v.setting_name === event?.venue.category);
	}

	async function confirmMove() {
		if (!event || !newDateStr) return;

		// 🚨 PREVENTION LOGIC: Blocks duplicate drops to exact same date & room
		const isDuplicate = existingEvents.find(
			(e) =>
				e.date === newDateStr &&
				e.venue.room === event?.venue.room &&
				e.venue.category === event?.venue.category &&
				e.title === event?.title &&
				e.id !== event?.id
		);

		if (isDuplicate) {
			close();
			setTimeout(() => {
				showError('A hold-date already exists on this date for this event');
			}, 100);
			return;
		}

		saving = true;
		try {
			const venueConfig = getVenueSettings();
			let params = venueConfig?.setting_params;
			if (typeof params === 'string') {
				try {
					params = JSON.parse(params);
				} catch (e) {
					console.error('Parse err:', e);
				}
			}

			const autoPromote = params?.holdSettings?.autoPromote !== false;
			let newHoldLevel = event.hold_level;
			const updates = [];

			if (event.status === 'HOLD') {
				// 1. Calculate destination Hold Level
				const sameEventHoldsOnNewDate = existingEvents.filter(
					(e) =>
						e.date === newDateStr &&
						e.group_id === event?.group_id &&
						e.id !== event?.id &&
						e.status === 'HOLD'
				);

				if (sameEventHoldsOnNewDate.length > 0) {
					// Match the level of other rooms occupied by the same event
					newHoldLevel = sameEventHoldsOnNewDate[0].hold_level;
				} else {
					// Check for conflicts and get next available hold
					const isTakenInRoom = existingEvents.some(
						(e) =>
							e.date === newDateStr &&
							e.venue.category === event?.venue.category &&
							e.venue.room === event?.venue.room &&
							e.hold_level === event.hold_level &&
							e.status === 'HOLD' &&
							e.id !== event?.id
					);

					if (isTakenInRoom) {
						newHoldLevel = getNextAvailableHold({
							date: newDateStr,
							category: event.venue.category || '',
							room: event.venue.room || '',
							existingEvents: existingEvents,
							isPriority: event.details?.is_priority || false,
							venues: venues
						});
					}
				}

				// 2. Perform Auto-Promotion for the origin Date
				if (autoPromote && event.hold_level && event.hold_level.startsWith('H')) {
					const promotions = calculateAutoPromotions({
						vacatedLevel: event.hold_level,
						date: event.date,
						category: event.venue.category || '',
						room: event.venue.room || '',
						existingEvents: existingEvents
					});

					for (const promo of promotions) {
						updates.push(
							supabase
								.from('calendar_events')
								.update({ hold_level: promo.newHoldLevel })
								.eq('id', promo.id)
						);
					}
				}
			}

			// Add the moved event to the updates array
			updates.push(
				supabase
					.from('calendar_events')
					.update({
						date: newDateStr,
						hold_level: newHoldLevel
					})
					.eq('id', event.id)
			);

			// Execute all queries simultaneously
			const results = await Promise.all(updates);
			for (const res of results) {
				if (res.error) throw res.error;
			}

			dispatch('success');
			close();
		} catch (err) {
			console.error('Error moving event:', err);
			close();
			setTimeout(() => {
				showError('Failed to move the event. Please try again.');
			}, 100);
		} finally {
			saving = false;
		}
	}

	function formatDate(d: Date | null) {
		if (!d) return { month: '', day: '', year: '' };
		return {
			month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
			day: d.toLocaleDateString('en-US', { day: '2-digit' }),
			year: d.getFullYear()
		};
	}
</script>

<div use:portal>
	<PopupNotification
		message={popupMessage}
		bind:show={showPopup}
		variant="white"
		iconType="error"
	/>

	{#if show && event && oldDateObj && newDateObj}
		<div
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
			transition:fade={{ duration: 200 }}
		>
			<div
				class="absolute inset-0"
				on:click={close}
				role="button"
				tabindex="0"
				on:keydown={(e) => {
					if (e.key === 'Escape') close();
				}}
				aria-label="Close modal"
			></div>

			<div
				class="bg-[#1e1e1e] border border-[#BDBDBB]/20 rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10"
				transition:fly={{ y: 20, duration: 200 }}
			>
				<h2 class="text-xl font-black text-[#F7F7F7] mb-8">Move Hold</h2>

				<div class="flex items-center justify-between mb-8">
					<div class="flex flex-col items-center gap-2">
						<span class="text-xs font-bold text-[#BDBDBB]">From</span>
						<div
							class="border border-[#BDBDBB]/30 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[90px] bg-[#2F2F2F]"
						>
							<span class="text-[10px] font-black text-[#BDBDBB]"
								>{formatDate(oldDateObj).month}</span
							>
							<span class="text-2xl font-black text-[#E1FF00] my-0.5"
								>{formatDate(oldDateObj).day}</span
							>
							<span class="text-[10px] font-bold text-[#BDBDBB]">{formatDate(oldDateObj).year}</span
							>
						</div>
					</div>

					<div class="flex flex-col items-center justify-center pt-6">
						<svg
							class="w-6 h-6 text-[#F7F7F7] mb-1"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"
							></polyline></svg
						>
						<span class="text-xs font-bold text-green-400">{diffText}</span>
					</div>

					<div class="flex flex-col items-center gap-2">
						<span class="text-xs font-bold text-[#BDBDBB]">To</span>
						<div
							class="border border-[#E1FF00]/50 rounded-xl px-6 py-4 flex flex-col items-center justify-center min-w-[90px] bg-[#2F2F2F]"
						>
							<span class="text-[10px] font-black text-[#BDBDBB]"
								>{formatDate(newDateObj).month}</span
							>
							<span class="text-2xl font-black text-[#E1FF00] my-0.5"
								>{formatDate(newDateObj).day}</span
							>
							<span class="text-[10px] font-bold text-[#BDBDBB]">{formatDate(newDateObj).year}</span
							>
						</div>
					</div>
				</div>

				<p class="text-sm font-bold text-[#F7F7F7] text-center mb-8">
					Are you sure you want to move this hold? <br />
					{#if event.status === 'HOLD'}<span class="text-[#BDBDBB]">The hold level may change.</span
						>{/if}
				</p>

				<div class="flex gap-3">
					<button
						class="flex-1 py-3 bg-transparent border border-[#BDBDBB]/20 text-[#BDBDBB] font-bold rounded-3xl hover:bg-[#BDBDBB]/10 hover:text-white transition-colors cursor-pointer"
						on:click={close}
						disabled={saving}>Cancel</button
					>
					<button
						class="flex-[1.5] py-3 bg-[#E1FF00] text-black font-bold rounded-3xl hover:bg-[#E1FF00]/90 transition-colors disabled:opacity-50 cursor-pointer"
						on:click={confirmMove}
						disabled={saving}>Move hold</button
					>
				</div>
			</div>
		</div>
	{/if}
</div>
