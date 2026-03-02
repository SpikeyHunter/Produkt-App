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

	// FILTER: Ensure we only process settings that are explicitly labeled as venues.
	// Fallback to empty array prevents JS map/filter crashes if venues is briefly undefined during HMR.
	$: filteredVenues = venues?.filter((v: any) => v.setting_type === 'VENUE') || [];

	$: uniqueRooms = Array.from(
		new Set(
			groupEvents
				.filter((e) => e.status !== 'HIDDEN')
				.map((e) => `${e.venue.category}:::${e.venue.room}`)
		)
	);

	$: displayLabel = (() => {
		if (uniqueRooms.length === 0) return 'Select Stage';
		const firstRoom = uniqueRooms[0].split(':::');
		
		if (uniqueRooms.length === 1) return `${firstRoom[1]} - ${firstRoom[0]}`;
		
		return `${firstRoom[1]} - ${firstRoom[0]} +${uniqueRooms.length - 1}`;
	})();

	$: displayLocation = (() => {
		if (uniqueRooms.length === 0) return '';
		const firstCategory = uniqueRooms[0].split(':::')[0];
		
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

	async function toggleVenue(vName: string, rName: string) {
		const roomKey = `${vName}:::${rName}`;
		const isSelected = uniqueRooms.includes(roomKey);

		if (isSelected) {
			if (uniqueRooms.length === 1) return;
			const idsToDelete = groupEvents
				.filter((e) => e.venue.category === vName && e.venue.room === rName)
				.map((e) => e.id);

			// Prevent 400 Bad Request error by making sure the array isn't empty
			if (idsToDelete.length > 0) {
				await supabase.from('calendar_events').delete().in('id', idsToDelete);
			}

			if (idsToDelete.includes(event.id)) {
				const survivor = groupEvents.find((e) => !idsToDelete.includes(e.id));
				if (survivor) goto(`/calendar/${survivor.short_id}`);
			} else {
				invalidateAll();
			}
		} else {
			const uniqueDates = Array.from(new Set(groupEvents.map((e) => e.date)));
			const newRows = uniqueDates.map((date) => ({
				group_id: event.group_id,
				creator_name: event.creator_name,
				date: date,
				status: event.status === 'CONFIRMED' ? 'CONFIRMED' : 'HOLD',
				hold_level: event.status === 'CONFIRMED' ? null : 'P',
				venue: { category: vName, room: rName },
				time: event.time
			}));

			await supabase.from('calendar_events').insert(newRows);
			invalidateAll();
		}
	}

	function handleWindowClick(e: MouseEvent) {
		if (showPopover && popupRef && !popupRef.contains(e.target as Node)) {
			showPopover = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative" bind:this={popupRef}>
	<button
		class="flex items-center gap-2 px-3 py-1 bg-navbar border border-gray2/20 rounded-full hover:bg-white/5 transition-colors shadow-sm cursor-pointer"
		on:click={() => (showPopover = !showPopover)}
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
			class="absolute left-0 top-[calc(100%+8px)] w-64 bg-navbar border border-gray2/20 rounded-xl shadow-xl overflow-hidden z-50 max-h-[350px] overflow-y-auto custom-scrollbar"
		>
			<div
				class="p-3 border-b border-gray2/10 bg-gray1 sticky top-0 flex justify-between items-center"
			>
				<span class="text-[10px] font-black text-gray2 uppercase tracking-widest"
					>Select Venue(s)</span
				>
				<button
					class="text-[10px] font-bold text-lime hover:underline uppercase cursor-pointer"
					on:click={() => {
						showPopover = false;
						dispatch('openSettings', { venueId: null });
					}}>+ Add</button
				>
			</div>

			{#each filteredVenues as venue}
				{@const stages =
					typeof venue.setting_params === 'string'
						? JSON.parse(venue.setting_params).stages
						: venue.setting_params.stages}
				<div class="p-3 border-b border-gray2/10 last:border-0">
					<div class="flex justify-between items-center mb-2">
						<p class="text-xs font-bold text-white uppercase tracking-wide">{venue.setting_name}</p>
						<button
							class="text-[10px] font-bold text-lime hover:underline uppercase cursor-pointer"
							on:click={() => {
								showPopover = false;
								dispatch('openSettings', { venueId: venue.id });
							}}>Edit</button
						>
					</div>

					{#if stages && stages.length > 0}
						{#each stages as stage}
							{@const isSelected = uniqueRooms.includes(`${venue.setting_name}:::${stage.name}`)}
							<label
								class="flex items-center gap-3 w-full py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer {isSelected &&
								uniqueRooms.length === 1
									? 'opacity-50 cursor-not-allowed'
									: ''}"
							>
								<input
									type="checkbox"
									class="hidden"
									checked={isSelected}
									on:change={() => toggleVenue(venue.setting_name, stage.name)}
									disabled={isSelected && uniqueRooms.length === 1}
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
										class="text-xs font-bold text-gray2 {isSelected
											? 'text-white'
											: 'hover:text-white'} transition-colors"
										>{stage.name} - {venue.setting_name}</span
									>
								</div>
							</label>
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>