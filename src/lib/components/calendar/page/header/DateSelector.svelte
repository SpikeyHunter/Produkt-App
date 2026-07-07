<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';
	import CalendarModify from '../../CalendarModify.svelte';
	import { syncLinkedDateFromCalendar } from '$lib/services/calendarEventLink';

	export let event: CalendarEvent;
	export let groupEvents: CalendarEvent[];
	let showPopover = false;
	let popupRef: HTMLElement;
	
	$: activeHolds = groupEvents
		.filter((e) => e.status !== 'HIDDEN')
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	let stagedDates: string[] = [];
	$: holdCount = stagedDates.length;
	$: dateRangeText = (() => {
		if (holdCount === 0) return 'No dates';

		const sortedStaged = [...stagedDates].sort(
			(a, b) => new Date(a).getTime() - new Date(b).getTime()
		);
		if (holdCount === 1)
			return new Date(sortedStaged[0] + 'T00:00:00').toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});

		const first = new Date(sortedStaged[0] + 'T00:00:00');
		const last = new Date(sortedStaged[sortedStaged.length - 1] + 'T00:00:00');
		if (first.getMonth() === last.getMonth())
			return `${first.toLocaleString('en-US', { month: 'short' })} ${first.getDate()} - ${last.getDate()}, ${first.getFullYear()}`;
		return `${first.toLocaleString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	})();
	const today = new Date();
	let viewMonth = new Date(event.date + 'T00:00:00');
	$: daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
	$: firstDayIndex = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

	let showModifyModal = false;
	let isSavingModification = false;
	let oldDatesToPass: string[] = [];
	let newDatesToPass: string[] = [];
	// --- Lock & Label Logic ---
	$: isDateLocked = ['IN SETTLEMENT', 'SETTLED'].includes(event?.status);
	$: isConfirmedStatus = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'].includes(event?.status);
	$: statusLabel = isConfirmedStatus ? 'Confirmed' : (activeHolds.length === 1 ? 'Hold' : 'Holds');
	// MATCHES EVENTHEADER LOGIC EXACTLY
	function getVenueName(e: any) {
		const v = e.venue || e.details?.venue || e.calendar?.details?.venue;
		if (!v) return 'TBD';
		const vParsed = typeof v === 'string' ? JSON.parse(v) : v;
		if (vParsed.category) {
			return `${vParsed.category} ${vParsed.room ?
			'/ ' + vParsed.room : ''}`.trim();
		}

		return vParsed.label || vParsed.name || vParsed.title || vParsed.value || 'TBD';
	}

	function openPopover() {
		if (isDateLocked) return; // Guard clause to prevent opening if locked
		stagedDates = activeHolds.map((h) => h.date);
		viewMonth = new Date(event.date + 'T00:00:00');
		showPopover = true;
	}

	function toggleDate(dayNum: number) {
		const targetDate = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		if (stagedDates.includes(targetDate)) {
			stagedDates = stagedDates.filter((d) => d !== targetDate);
		} else {
			stagedDates = [...stagedDates, targetDate];
		}
	}

	function promptModifyDates() {
		oldDatesToPass = activeHolds.map((h) => h.date);
		newDatesToPass = [...stagedDates].sort();
		if (JSON.stringify(oldDatesToPass.sort()) === JSON.stringify(newDatesToPass)) {
			showPopover = false;
			return;
		}

		showPopover = false;

		if (isConfirmedStatus) {
			// Show popup for confirmed shows
			showModifyModal = true;
		} else {
			// Bypass popup and update silently for unconfirmed shows
			handleModifyConfirm({
				detail: {
					sendEmail: false,
					sendSms: false,
					oldDates: oldDatesToPass,
					newDates: newDatesToPass
				}
			});
		}
	}

	async function handleModifyConfirm(e: any) {
		isSavingModification = true;
		const { sendEmail, sendSms, oldDates, newDates } = e.detail;
		const oldHolds = [...activeHolds].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);
		const sortedNewDates = [...newDates].sort();

		const updates: { id: string; date: string }[] = [];
		const inserts: any[] = [];
		const deletes: string[] = [];
		let currentEventDeleted = false;
		const maxLen = Math.max(oldHolds.length, sortedNewDates.length);
		for (let i = 0; i < maxLen; i++) {
			if (i < oldHolds.length && i < sortedNewDates.length) {
				if (oldHolds[i].date !== sortedNewDates[i]) {
					updates.push({ id: oldHolds[i].id, date: sortedNewDates[i] });
				}
			} else if (i < sortedNewDates.length) {
				// STRICT WHITELIST: Only include columns that exist in the 'calendar_events' table schema
				inserts.push({
					group_id: event.group_id,
					date: sortedNewDates[i],
					status: event.status,
					hold_level: event.hold_level,
					venue: event.venue,
					time: event.time,
					event_details: event.event_details
				});
			} else if (i < oldHolds.length) {
				deletes.push(oldHolds[i].id);
				if (oldHolds[i].id === event.id) currentEventDeleted = true;
			}
		}

		try {
			if (updates.length > 0) {
				for (const u of updates) {
					const { error } = await supabase.from('calendar_events').update({ date: u.date }).eq('id', u.id);
					if (error) throw new Error(`Update Error: ${error.message}`);
				}
			}
			if (inserts.length > 0) {
				const { error } = await supabase.from('calendar_events').insert(inserts);
					if (error) throw new Error(`Insert Error: ${error.message}`);
			}
			if (deletes.length > 0) {
				const { error } = await supabase.from('calendar_events').delete().in('id', deletes);
					if (error) throw new Error(`Delete Error: ${error.message}`);
			}
		} catch (err: any) {
			console.error("🔥 DATABASE ERROR:", err);
			alert(`Supabase Error:\n${err.message}`);
			isSavingModification = false;
			return; // Stops execution on failure
		}
		// Push the new confirmed date onto the linked events row (if any)
		await syncLinkedDateFromCalendar(event.group_id);

		// --- Notifications block ---
		if (sendEmail || sendSms) {
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'A team member';
			const payload = {
				eventId: (event as any).short_id || event.id,
				eventTitle: (event as any).calendar?.title || 'Event',
				oldDates,
				newDates,
				oldType: (event as any).details?.type ||
				'',
				newType: (event as any).details?.type || '',
				venueName: getVenueName(event),
				authUserName: authName
			};

			try {
				if (sendEmail)
					await fetch('/api/calendar-modify-email', { method: 'POST', body: JSON.stringify(payload) });
				if (sendSms)
					await fetch('/api/calendar-modify-sms', { method: 'POST', body: JSON.stringify(payload) });
			} catch (err) {
				console.error('Failed to trigger modify notifications', err);
			}
		}

		isSavingModification = false;
		showModifyModal = false;

		if (currentEventDeleted) {
			goto('/calendar');
		} else {
			invalidateAll();
		}
	}

	function cancelDates() {
		showPopover = false;
	}

	function handleWindowClick(e: MouseEvent) {
		if (showPopover && popupRef && !popupRef.contains(e.target as Node)) {
			cancelDates();
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative" bind:this={popupRef}>
	<button
		class="flex items-center gap-2 px-3.5 py-2.5 bg-navbar rounded-3xl transition-colors {isDateLocked ? 'opacity-70 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}"
		on:click={openPopover}
		disabled={isDateLocked}
		title={isDateLocked ?
		'Dates are locked while in settlement' : 'Edit dates'}
	>
		<svg
			class="w-4 h-4 text-lime"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line
				x1="16"
				y1="2"
				x2="16"
				y2="6"
			></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"
			></line></svg
		>
		<span class="text-xs font-black text-white">
			{activeHolds.length} {statusLabel}
		</span>
		<span class="text-xs font-medium text-gray2"
			>{(() => {
				if (activeHolds.length === 0) return 'No dates';
				const s = [...activeHolds].sort(
					(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
				);
				if (s.length === 1)
					return new Date(s[0].date + 'T00:00:00').toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					});
				const f = new Date(s[0].date + 'T00:00:00');
				const l = new Date(s[s.length - 1].date + 'T00:00:00');
				return f.getMonth() === l.getMonth()
					? `${f.toLocaleString('en-US', { month: 'short' })} ${f.getDate()} - ${l.getDate()}, ${f.getFullYear()}`
					: `${f.toLocaleString('en-US', { month: 'short', day: 'numeric' })} - ${l.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
			})()}</span
		>
	</button>

	{#if showPopover}
		<div
			class="absolute left-0 top-[calc(100%+8px)] w-[300px] bg-navbar rounded-3xl shadow-2xl border border-gray2/20 p-5 z-50"
		>
			<div class="flex justify-between items-center mb-5">
				<button
					aria-label="Previous month"
					class="p-1 hover:bg-white/5 rounded cursor-pointer"
					on:click={() => (viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))}
					><svg
						class="w-4 h-4 text-white"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg
					></button
				>
				<span class="text-sm font-bold text-white tracking-wide"
					>{viewMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span
				>
				<button
					aria-label="Next month"
					class="p-1 hover:bg-white/5 rounded cursor-pointer"
					on:click={() => (viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))}
					><svg
						class="w-4 h-4 text-white"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg
					></button
				>
			</div>

			<div class="grid grid-cols-7 gap-1 text-center mb-3">
				{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}<div
						class="text-[10px] font-bold text-gray2"
					>
						{d}
					</div>{/each}
			</div>
			<div class="grid grid-cols-7 gap-1.5 text-center mb-6">
				{#each Array(firstDayIndex) as _}<div></div>{/each}
				{#each Array(daysInMonth) as _, i}
					{@const dayNum = 
					i + 1}
					{@const targetDate = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
					{@const isSelected = stagedDates.includes(targetDate)}

					<button
						class="w-8 h-8 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer {isSelected
							?
							'border-2 border-lime text-white'
							: 'text-gray2 hover:bg-white/5'}"
						on:click={() => toggleDate(dayNum)}
					>
						{dayNum}
						{#if isSelected}<div
								class="w-1 h-1 rounded-full {isConfirmedStatus
									?
									'bg-confirmed'
									: 'bg-lime'} absolute bottom-1"
							></div>{/if}
					</button>
				{/each}
			</div>

			<div class="flex gap-3 mt-2 border-t border-gray2/10 pt-4">
				<button
					class="flex-1 py-2 rounded-xl bg-transparent border border-gray2/20 text-gray2 hover:text-white hover:bg-white/5 text-sm font-bold transition-colors cursor-pointer"
					on:click={cancelDates}>Cancel</button
				>
				<button
					class="flex-1 py-2 rounded-xl bg-lime text-black hover:bg-lime/90 text-sm font-bold transition-colors cursor-pointer"
					on:click={promptModifyDates}>{isConfirmedStatus ? 'Confirm' : 'Update'}</button
				>
			</div>
		</div>
	{/if}
</div>

<CalendarModify
	show={showModifyModal}
	oldDates={oldDatesToPass}
	newDates={newDatesToPass}
	saving={isSavingModification}
	on:confirm={handleModifyConfirm}
	on:cancel={() => (showModifyModal = false)}
/>