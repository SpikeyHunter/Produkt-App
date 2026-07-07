<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';
	import { syncRowToCalendar } from '$lib/services/calendar';
	import CalendarModify from '../../CalendarModify.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { updateLinkedShowVenue } from '$lib/services/calendarEventLink';

	type ExtendedEvent = CalendarEvent & {
		calendar?: {
			title?: string;
			details?: any;
			current_version?: number;
		};
		calendar_data?: any;
		short_id?: number;
		details?: any;
	};

	export let event: ExtendedEvent;
	export let parsedDetails: any;

	// Explicitly cast to Number to satisfy TypeScript strict mode
	$: currentVersionNum = Number(event?.calendar?.current_version) || 1;

	let viewedVersionNum: number = 0;
	let overrideVersionType: string | null = null;

	// Safely initialize viewedVersionNum matching currentVersionNum without glitching
	$: if (viewedVersionNum === 0 && currentVersionNum !== 0) {
		viewedVersionNum = currentVersionNum;
	}

	// Reset when navigating to a new event
	let _currentEventId: number | string | null = null;
	$: if (event?.id && String(event.id) !== String(_currentEventId)) {
		_currentEventId = event.id;
		viewedVersionNum = currentVersionNum;
		overrideVersionType = null;
	}

	function handleSwitchVersion(e: Event) {
		// Define the expected custom event shape
		const customEvent = e as CustomEvent<{
			versionNum: number | string;
			calendarData: any;
			isGlobalChange?: boolean;
			versionType?: string;
		}>;

		// Force cast to number
		viewedVersionNum = Number(customEvent.detail.versionNum);

		// Optimistically update to prevent the type dropdown from temporarily locking
		if (customEvent.detail.isGlobalChange && event?.calendar) {
			event.calendar.current_version = viewedVersionNum;
			event = event; // Trigger Svelte reactivity
		}

		// Set the type instantly if explicitly passed (Global Change / Base Version)
		if (customEvent.detail.versionType !== undefined) {
			overrideVersionType = customEvent.detail.versionType;
		}
		// Set the type from calendarData if previewing an alternate locked version
		else if (customEvent.detail.calendarData) {
			overrideVersionType = customEvent.detail.calendarData.version_type;
		} else {
			overrideVersionType = null;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('switchViewedVersion', handleSwitchVersion);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('switchViewedVersion', handleSwitchVersion);
		}
	});

	const LOCKED_STATUSES = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'];
	$: isStatusLocked = LOCKED_STATUSES.includes(event?.status);

	// Locked if looking at an alternate version OR if the event status is locked
	$: isAlternateVersion = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;
	$: isLocked = isAlternateVersion || isStatusLocked;

	// For version >= 2, use version_type from calendar_data (if present)
	$: versionType =
		overrideVersionType !== null ? overrideVersionType : event?.calendar_data?.version_type || null;

	// Effective type: version_type overrides details.type for v2+
	$: effectiveType =
		viewedVersionNum >= 2 && versionType ? versionType : parsedDetails?.type || 'Select Type';

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

	$: currentType = effectiveType;
	$: currentTypeColor = typeColors[currentType] || typeColors['Other'];

	let showModifyModal = false;
	let isSavingModification = false;
	let oldTypeToPass = '';
	let newTypeToPass = '';

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

		if (viewedVersionNum >= 2) {
			// For v2+: store the type in calendar_data.version_type only
			const calendarId = event.group_id || event.id;
			await supabase
				.from('calendar_data')
				.update({ version_type: newType })
				.eq('calendar_id', calendarId)
				.eq('version_number', viewedVersionNum);

			// Update local reference so UI reacts immediately
			if (event.calendar_data) {
				event.calendar_data.version_type = newType;
				event = event; // trigger svelte reactivity
			}
		} else {
			// For v1: update the shared calendar.details as before
			parsedDetails.type = newType;
			if (event.calendar) event.calendar.details = parsedDetails;
			event.details = parsedDetails;
			await supabase.from('calendar').update({ details: parsedDetails }).eq('id', event.group_id);
			await updateLinkedShowVenue(event.group_id, newType);
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
		}

		if (sendEmail || sendSms) {
			const activeHolds = (event as any).groupEvents?.filter(
				(ev: any) => ev.status !== 'HIDDEN'
			) || [event];
			const dates = activeHolds.map((h: any) => h.date);

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
				if (sendEmail)
					await fetch('/api/calendar-modify-email', {
						method: 'POST',
						body: JSON.stringify(payload)
					});
				if (sendSms)
					await fetch('/api/calendar-modify-sms', {
						method: 'POST',
						body: JSON.stringify(payload)
					});
			} catch (err) {
				console.error('Failed to trigger modify notifications', err);
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
		class="flex items-center gap-2 px-3 py-2.25 rounded-3xl bg-navbar transition-colors
			{isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'}"
		on:click={() => {
			if (!isLocked) showTypeDrop = !showTypeDrop;
		}}
		disabled={isLocked}
		title={isLocked
			? isStatusLocked
				? `Type locked — event is ${event?.status?.toLowerCase()}`
				: 'Type locked — alternate version'
			: 'Change event type'}
		aria-label="Change event type"
	>
		<div class="w-3 h-3 rounded-full" style="background-color: {currentTypeColor}"></div>
		<span class="text-sm font-bold text-white whitespace-nowrap">
			{currentType === 'Bazart Nuits' ? 'Nuits Bazart' : currentType}
		</span>
		{#if !isLocked}
			<svg
				class="w-4 h-4 text-gray2 ml-1"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
			>
		{:else}
			<svg
				class="w-3.5 h-3.5 text-gray2 ml-1"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				stroke-width="2"
			>
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
				<path d="M7 11V7a5 5 0 0110 0v4"></path>
			</svg>
		{/if}
	</button>

	{#if showTypeDrop && !isLocked}
		<div
			class="absolute left-0 top-[calc(100%+8px)] w-52 bg-navbar rounded-3xl shadow-xl overflow-hidden py-2 z-[60] border border-gray2/10"
		>
			{#each Object.entries(typeColors) as [typeName, colorHex]}
				<button
					class="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/5 cursor-pointer text-left transition-colors"
					on:click={() => promptModifyType(typeName)}
				>
					<div class="w-3 h-3 rounded-full" style="background-color: {colorHex}"></div>
					<span class="text-sm font-bold text-white"
						>{typeName === 'Bazart Nuits' ? 'Nuits Bazart' : typeName}</span
					>
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
