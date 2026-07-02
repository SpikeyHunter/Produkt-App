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
		if (uniqueRooms.length === 0) return 'No location set';
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
		return 'No location set';
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
    let redirectShortId = null;
    let currentEventDeleted = false;

    // 1. Process Removals
    if (removedRooms.length > 0) {
        const idsToDelete = groupEvents
            .filter((e) => removedRooms.includes(`${e.venue.category}:::${e.venue.room}`))
            .map((e) => e.id);

        if (idsToDelete.length > 0) {
            await supabase.from('calendar_events').delete().in('id', idsToDelete);
            needsInvalidate = true;

            // Check if the row we are currently looking at was just deleted
            if (idsToDelete.includes(event.id)) {
                currentEventDeleted = true;
                // Try to find a sibling room that wasn't deleted to fall back on
                const survivor = groupEvents.find((e) => !idsToDelete.includes(e.id));
                if (survivor) {
                    redirectShortId = survivor.short_id;
                }
            }
        }
    }

    // 2. Process Additions
    if (addedRooms.length > 0) {
        const uniqueDates = Array.from(new Set(groupEvents.map((e) => e.date)));
        let newRows = [];

        for (const roomKey of addedRooms) {
            const [vName, rName] = roomKey.split(':::');
            const rowsForRoom = uniqueDates.map((date) => ({
                group_id: event.group_id,
                date: date,
                status: event.status === 'CONFIRMED' ? 'CONFIRMED' : 'HOLD',
                hold_level: event.status === 'CONFIRMED' ? null : 'P',
                venue: { category: vName, room: rName },
                time: event.time,
                event_details: event.event_details || {}
            }));
            newRows.push(...rowsForRoom);
        }

        if (newRows.length > 0) {
            // FIX: Chain .select() to the insert query so Supabase returns the newly generated short_ids
            const { data: insertedData, error } = await supabase.from('calendar_events').insert(newRows).select();
            
            if (error) {
                console.error('Error inserting rooms:', error);
            } else {
                needsInvalidate = true;
                // If the active row was deleted and we didn't have a survivor, grab the new row's short_id
                if (currentEventDeleted && !redirectShortId && insertedData && insertedData.length > 0) {
                    redirectShortId = insertedData[0].short_id;
                }
            }
        }
    }

    closeMenu();

    // 3. Handle Navigation Safely
    if (redirectShortId) {
        // We deleted the active row, navigate away to a valid row (prevents the 404)
        goto(`/calendar/${redirectShortId}`);
    } else if (currentEventDeleted) {
        // Edge case: They deleted all rooms and added none. Fallback to main calendar.
        goto(`/calendar`); 
    } else if (needsInvalidate) {
        // They just added a room without deleting the current one. Safe to refresh in place.
        invalidateAll();
    }
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
		class="flex items-center gap-2.5 px-3.5 py-1.25 bg-navbar rounded-3xl hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
		on:click={() => (showPopover ? closeMenu() : openMenu())}
	>
		<svg
			class="w-4 h-4 text-lime shrink-0"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
			<circle cx="12" cy="10" r="3"></circle>
		</svg>
		<div class="text-left leading-tight pr-1 flex flex-col justify-center">
			<span class="text-xs font-black text-white block">{displayLabel}</span>
			<span class="text-[10px] font-medium text-gray2 block">{displayLocation}</span>
		</div>
	</button>

	{#if showPopover}
		<div class="absolute left-0 top-[calc(100%+8px)] w-[300px] bg-navbar rounded-3xl shadow-2xl border border-gray2/20 p-5 z-50 flex flex-col">
			
			<div class="flex justify-between items-center mb-4">
				<h4 class="text-sm font-bold text-white">Select Stage</h4>
				<button
					class="text-[10px] font-bold text-lime hover:text-lime/80 uppercase tracking-wider cursor-pointer transition-colors"
					on:click={() => {
						closeMenu();
						dispatch('openSettings', { venueId: null });
					}}
				>
					+ Add
				</button>
			</div>

			<div class="overflow-y-auto custom-scrollbar flex-1 max-h-[260px] pr-2 -mr-2 mb-2 flex flex-col gap-5">
				{#each filteredVenues as venue}
					{@const stages =
						typeof venue.setting_params === 'string'
							? JSON.parse(venue.setting_params).stages
							: venue.setting_params.stages}
					
					<div class="flex flex-col gap-2">
						<div class="flex justify-between items-center">
							<p class="text-[10px] font-bold text-gray2 uppercase tracking-widest">
								{venue.setting_name}
							</p>
							<button
								class="text-[10px] font-bold text-gray2 hover:text-white uppercase tracking-wider cursor-pointer transition-colors"
								on:click={() => {
									closeMenu();
									dispatch('openSettings', { venueId: venue.id });
								}}
							>
								Edit
							</button>
						</div>

						<div class="flex flex-col gap-1">
							{#if stages && stages.length > 0}
								{#each stages as stage}
									{@const isSelected = draftRooms.includes(`${venue.setting_name}:::${stage.name}`)}
									{@const isDisabled = !isSelected && draftVenue !== null && draftVenue !== venue.setting_name}

									<label
										class="flex items-center gap-3 w-full py-2 px-3 rounded-xl transition-colors border {isSelected ? 'bg-white/5 border-white/10' : 'border-transparent'} {isDisabled
											? 'opacity-40 cursor-not-allowed'
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
												: 'border-gray2/40 bg-transparent'} transition-colors shrink-0"
										>
											{#if isSelected}
												<svg
													class="w-3.5 h-3.5 text-black"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											{/if}
										</div>
										<div class="flex items-center gap-2.5 truncate">
											<span
												class="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
												style="background-color: {stage.color || '#ccc'}"
											></span>
											<span
												class="text-xs font-bold truncate {isSelected
													? 'text-white'
													: 'text-gray2'} {isDisabled ? '' : 'hover:text-white'} transition-colors"
											>
												{stage.name}
											</span>
										</div>
									</label>
								{/each}
							{:else}
								<p class="text-xs text-gray2/50 italic px-2">No stages found.</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="flex gap-3 border-t border-gray2/10 pt-4 mt-2 shrink-0">
				<button
					class="flex-1 py-2 rounded-xl bg-transparent border border-gray2/20 text-gray2 hover:text-white hover:bg-white/5 text-sm font-bold transition-colors cursor-pointer"
					on:click={closeMenu}
				>
					Cancel
				</button>
				<button
					class="flex-1 py-2 rounded-xl text-sm font-bold transition-colors {draftRooms.length > 0 ? 'bg-lime text-black hover:bg-lime/90 cursor-pointer' : 'bg-gray2/10 text-gray2/50 cursor-not-allowed'}"
					on:click={saveChanges}
					disabled={draftRooms.length === 0}
				>
					Save
				</button>
			</div>
		</div>
	{/if}
</div>