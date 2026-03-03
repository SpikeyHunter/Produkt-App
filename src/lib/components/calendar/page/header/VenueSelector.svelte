<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { createEventDispatcher } from 'svelte';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';

	export let event: CalendarEvent;
	export let groupEvents: CalendarEvent[];
	export let venues: VenueSettings[];

	const dispatch = createEventDispatcher();

	let showPopover = false;
	let popupRef: HTMLElement;

	// 1. Filter venues to only include setting_type === 'VENUE'
	$: filteredVenues = venues.filter((v) => v.setting_type === 'VENUE');

	// The actual saved rooms from the database
	$: uniqueRooms = Array.from(
		new Set(
			groupEvents
				.filter((e) => e.status !== 'HIDDEN')
				.map((e) => `${e.venue.category}:::${e.venue.room}`)
		)
	);

	// The temporary state for the UI before saving
	let draftRooms: string[] = [];

	$: displayLabel = (() => {
		if (uniqueRooms.length === 0) return 'Select Stage';
		const firstRoom = uniqueRooms[0].split(':::');

		if (uniqueRooms.length === 1) return `${firstRoom[1]} - ${firstRoom[0]}`;

		return `${firstRoom[1]} - ${firstRoom[0]} +${uniqueRooms.length - 1}`;
	})();

	$: displayLocation = (() => {
		if (uniqueRooms.length === 0) return '';
		const firstCategory = uniqueRooms[0].split(':::')[0];

		// Use filteredVenues to ensure we match a real venue
		const vObj = filteredVenues.find((v) => v.setting_name === firstCategory);

		if (vObj) {
			let params =
				typeof vObj.setting_params === 'string'
					? JSON.parse(vObj.setting_params)
					: vObj.setting_params;
			const loc = params.location || {};

			return [loc.city, loc.country].filter((part) => part && part.trim() !== '').join(', ');
		}
		return '';
	})();

	function openMenu() {
		draftRooms = [...uniqueRooms];
		showPopover = true;
	}

	function closeMenu() {
		showPopover = false;
		draftRooms = [];
	}
	// Track the current venue so we can block other venues
	$: draftVenue = draftRooms.length > 0 ? draftRooms[0].split(':::')[0] : null;

	function toggleDraftVenue(vName: string, rName: string) {
		const roomKey = `${vName}:::${rName}`;
		const isSelected = draftRooms.includes(roomKey);

		if (isSelected) {
			// Allow unselecting
			draftRooms = draftRooms.filter((r) => r !== roomKey);
		} else {
			// Prevent selecting if it's a DIFFERENT venue
			if (draftVenue && draftVenue !== vName) return;

			// Allow selecting multiple rooms by adding to the array
			draftRooms = [...draftRooms, roomKey];
		}
	}

	async function saveChanges() {
		const addedRooms = draftRooms.filter((r) => !uniqueRooms.includes(r));
		const removedRooms = uniqueRooms.filter((r) => !draftRooms.includes(r));

		let needsInvalidate = false;

		// 1. Process Removals (Works fine)
		if (removedRooms.length > 0) {
			const idsToDelete = groupEvents
				.filter((e) => removedRooms.includes(`${e.venue.category}:::${e.venue.room}`))
				.map((e) => e.id);

			if (idsToDelete.length > 0) {
				await supabase.from('calendar_events').delete().in('id', idsToDelete);
				needsInvalidate = true;

				if (idsToDelete.includes(event.id)) {
					const survivor = groupEvents.find((e) => !idsToDelete.includes(e.id));

					if (survivor) {
						goto(`/calendar/${survivor.short_id}`);
						closeMenu();
						return;
					}
				}
			}
		}

		// 2. Process Additions (Fixed 400 error)
		if (addedRooms.length > 0) {
			const uniqueDates = Array.from(new Set(groupEvents.map((e) => e.date)));

			let newRows = [];

			for (const roomKey of addedRooms) {
				const [vName, rName] = roomKey.split(':::');

				const rowsForRoom = uniqueDates.map((date) => ({
					group_id: event.group_id,
					// REMOVED creator_name: event.creator_name to fix the 400 error!
					date: date,
					status: event.status === 'CONFIRMED' ? 'CONFIRMED' : 'HOLD',
					hold_level: event.status === 'CONFIRMED' ? null : 'P',
					venue: { category: vName, room: rName },
					time: event.time,
					event_details: event.event_details || {} // Keep event details synced
				}));

				newRows.push(...rowsForRoom);
			}

			if (newRows.length > 0) {
				const { error } = await supabase.from('calendar_events').insert(newRows);
				if (error) console.error('Error inserting rooms:', error);
				else needsInvalidate = true;
			}
		}

		if (needsInvalidate) {
			invalidateAll();
		}

		closeMenu();
	}

	function handleWindowClick(e: MouseEvent) {
		if (showPopover && popupRef && !popupRef.contains(e.target as Node)) {
			closeMenu();
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative" bind:this={popupRef}>
	<button
		class="flex items-center gap-2 px-3 py-1 bg-navbar border border-gray2/20 rounded-full hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
		on:click={() => (showPopover ? closeMenu() : openMenu())}
	>
		<div class="w-6 h-6 rounded-full bg-lime/10 flex items-center justify-center text-lime">
			<svg
				class="w-3.5 h-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle
					cx="12"
					cy="10"
					r="3"
				></circle></svg
			>
		</div>
		<div class="text-left leading-tight pr-2">
			<p class="text-[11px] font-black text-white">{displayLabel}</p>
			{#if displayLocation}<p class="text-[9px] font-bold text-gray2">{displayLocation}</p>{/if}
		</div>
	</button>

	{#if showPopover}
		<div
			class="absolute left-0 top-[calc(100%+8px)] w-64 bg-navbar border border-gray2/20 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col max-h-[400px]"
		>
			<div
				class="p-3 border-b border-gray2/10 bg-gray1 sticky top-0 flex justify-between items-center z-10"
			>
				<span class="text-[10px] font-black text-gray2 uppercase tracking-widest">Select Stage</span
				>
				<button
					class="text-[10px] font-bold text-lime hover:underline uppercase cursor-pointer"
					on:click={() => {
						closeMenu();
						dispatch('openSettings', { venueId: null });
					}}>+ Add</button
				>
			</div>

			<div class="overflow-y-auto custom-scrollbar flex-1">
				{#each filteredVenues as venue}
					{@const stages =
						typeof venue.setting_params === 'string'
							? JSON.parse(venue.setting_params).stages
							: venue.setting_params.stages}
					<div class="p-3 border-b border-gray2/10 last:border-0">
						<div class="flex justify-between items-center mb-2">
							<p class="text-xs font-bold text-white uppercase tracking-wide">
								{venue.setting_name}
							</p>
							<button
								class="text-[10px] font-bold text-lime hover:underline uppercase cursor-pointer"
								on:click={() => {
									closeMenu();
									dispatch('openSettings', { venueId: venue.id });
								}}>Edit</button
							>
						</div>

						{#if stages && stages.length > 0}
							{#each stages as stage}
								{@const isSelected = draftRooms.includes(`${venue.setting_name}:::${stage.name}`)}
								{@const isDisabled =
									!isSelected && draftVenue !== null && draftVenue !== venue.setting_name}

								<label
									class="flex items-center gap-3 w-full py-1.5 px-2 rounded-lg transition-colors {isDisabled
										? 'opacity-50 cursor-not-allowed'
										: 'hover:bg-white/5 cursor-pointer'}"
								>
									<input
										type="checkbox"
										class="hidden"
										checked={isSelected}
										disabled={isDisabled}
										on:change={() => toggleDraftVenue(venue.setting_name, stage.name)}
									/>
									<div
										class="flex items-center justify-center w-4 h-4 rounded border {isSelected
											? 'bg-lime border-lime'
											: 'border-gray2/50 bg-transparent'} transition-colors"
									>
										{#if isSelected}<svg
												class="w-3.5 h-3.5 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="3"
												stroke-linecap="round"
												stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
											>{/if}
									</div>
									<div class="flex items-center gap-2">
										<span
											class="w-2.5 h-2.5 rounded-full shadow-sm"
											style="background-color: {stage.color || '#ccc'}"
										></span>
										<span
											class="text-xs font-bold {isSelected
												? 'text-white'
												: 'text-gray2'} {isDisabled ? '' : 'hover:text-white'} transition-colors"
											>{stage.name}</span
										>
									</div>
								</label>
							{/each}
						{/if}
					</div>
				{/each}
			</div>

			<div
				class="p-3 border-t border-gray2/10 bg-gray1 flex justify-end gap-2 sticky bottom-0 z-10"
			>
				<button
					class="px-3 py-1.5 text-xs font-bold bg-gray3 rounded-3xl text-black hover:bg-gray3/80 transition-colors cursor-pointer"
					on:click={closeMenu}
				>
					Cancel
				</button>
				<button
					class="px-4 py-1.5 text-xs font-bold bg-lime text-black rounded-3xl hover:bg-lime/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					on:click={saveChanges}
					disabled={draftRooms.length === 0}
				>
					Confirm
				</button>
			</div>
		</div>
	{/if}
</div>
