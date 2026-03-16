<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore'; // <-- Corrected Auth Import
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';
	import { syncRowToCalendar } from '$lib/services/calendar';
	import CalendarModify from '../../CalendarModify.svelte';

	type ExtendedEvent = CalendarEvent & {
		calendar?: {
			title?: string;
			details?: any;
		};
		short_id?: number;
		details?: any;
	};

	export let event: ExtendedEvent;
	export let parsedDetails: any;

	let showTypeDrop = false;
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

	$: currentType = parsedDetails?.type || 'Select Type';
	$: currentTypeColor = typeColors[currentType] || typeColors['Other'];

	let showModifyModal = false;
	let isSavingModification = false;
	let oldTypeToPass = '';
	let newTypeToPass = '';

	// MATCHES EVENTHEADER LOGIC EXACTLY
	function getVenueName(e: any) {
		const v = e.venue || e.details?.venue || e.calendar?.details?.venue;
		if (!v) return 'TBD';
		
		const vParsed = typeof v === 'string' ? JSON.parse(v) : v;
		if (vParsed.category) {
			return `${vParsed.category} ${vParsed.room ? '/ ' + vParsed.room : ''}`.trim();
		}
		
		return vParsed.label || vParsed.name || vParsed.title || vParsed.value || 'TBD';
	}

	function promptModifyType(newType: string) {
		if (currentType === newType) return;
		
		oldTypeToPass = currentType;
		newTypeToPass = newType;
		
		showTypeDrop = false;
		showModifyModal = true;
	}

	async function handleModifyConfirm(e: CustomEvent) {
		isSavingModification = true;
		const { sendEmail, sendSms, oldType, newType } = e.detail;

		parsedDetails.type = newType;
		
		if (event.calendar) event.calendar.details = parsedDetails;
		event.details = parsedDetails;
		
		await supabase.from('calendar').update({ details: parsedDetails }).eq('id', event.group_id);
		
		if (event.status === 'CONFIRMED') {
			const { data: techRows } = await supabase
				.from('schedule_techs')
				.select('*')
				.eq('group_id', event.group_id);
				
			if (techRows && techRows.length > 0) {
				for (const row of techRows) {
					if (row.type !== newType) {
						const updatedRow = { ...row, type: newType };
						await supabase.from('schedule_techs').update({ type: newType }).eq('id', row.id);
						try {
							await syncRowToCalendar(updatedRow, 'UPDATE', row);
						} catch (err) {
							console.error('Failed to sync type change to Google Calendar:', err);
						}
					}
				}
			}
		}

		if (sendEmail || sendSms) {
			const activeHolds = (event as any).groupEvents?.filter((ev: any) => ev.status !== 'HIDDEN') || [event];
			const dates = activeHolds.map((h: any) => h.date);

			// MATCHES EVENTHEADER LOGIC EXACTLY
			const authUser = $authStore?.profile;
			const authName = authUser
				? `${authUser.first_name || ''} ${authUser.last_name || ''}`.trim()
				: 'A team member';

			const payload = {
				eventId: event.short_id || event.id,
				eventTitle: event.calendar?.title || 'Event',
				oldDates: dates, 
				newDates: dates,
				oldType,
				newType,
				venueName: getVenueName(event),
				authUserName: authName
			};

			try {
				if (sendEmail) await fetch('/api/calendar-modify-email', { method: 'POST', body: JSON.stringify(payload) });
				if (sendSms) await fetch('/api/calendar-modify-sms', { method: 'POST', body: JSON.stringify(payload) });
			} catch (err) {
				console.error("Failed to trigger modify notifications", err);
			}
		}

		isSavingModification = false;
		showModifyModal = false;
		invalidateAll();
	}

	function handleWindowClick(e: MouseEvent) {
		if (
			showTypeDrop &&
			e.target instanceof Element &&
			!e.target.closest('.type-dropdown-container')
		) {
			showTypeDrop = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative type-dropdown-container ml-2">
	<button
		class="flex items-center gap-2 px-3 py-2 rounded-3xl bg-navbar hover:bg-white/5 transition-colors cursor-pointer"
		on:click={() => (showTypeDrop = !showTypeDrop)}
		aria-label="Change event type"
	>
		<div class="w-3 h-3 rounded-full" style="background-color: {currentTypeColor}"></div>
		<span class="text-sm font-bold text-white whitespace-nowrap">
			{currentType === 'Bazart Nuits' ? 'Nuits Bazart' : currentType}
		</span>
		<svg class="w-4 h-4 text-gray2 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
	</button>

	{#if showTypeDrop}
		<div class="absolute left-0 top-[calc(100%+8px)] w-52 bg-navbar rounded-3xl shadow-xl overflow-hidden py-2 z-[60] border border-gray2/10">
			{#each Object.entries(typeColors) as [typeName, colorHex]}
				<button
					class="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/5 cursor-pointer text-left transition-colors"
					on:click={() => promptModifyType(typeName)}
				>
					<div class="w-3 h-3 rounded-full" style="background-color: {colorHex}"></div>
					<span class="text-sm font-bold text-white">{typeName === 'Bazart Nuits' ? 'Nuits Bazart' : typeName}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<CalendarModify
	show={showModifyModal}
	oldType={oldTypeToPass}
	newType={newTypeToPass}
	saving={isSavingModification}
	on:confirm={handleModifyConfirm}
	on:cancel={() => (showModifyModal = false)}
/>