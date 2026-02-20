<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, VenueSettings, StageConfig } from '$lib/types/calendar-types';

	export let event: CalendarEvent;
	export let venues: VenueSettings[];

	let showPopover = false;
	let popupRef: HTMLElement;

	$: displayLocation = (() => {
		if (!event.venue.category) return '';
		const vObj = venues.find(v => v.setting_name === event.venue.category);
		if (vObj) {
			let params = typeof vObj.setting_params === 'string' ? JSON.parse(vObj.setting_params) : vObj.setting_params;
			return `${params.location?.city || ''}, ${params.location?.state || ''}`;
		}
		return '';
	})();

	async function selectVenue(vName: string, rName: string) {
		showPopover = false;
		if (event.venue.category === vName && event.venue.room === rName) return;
		
		await supabase.from('calendar_events')
			.update({ venue: { category: vName, room: rName } })
			.eq('id', event.id);
			
		invalidateAll();
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
		on:click={() => showPopover = !showPopover}
	>
		<div class="w-6 h-6 rounded-full bg-lime/10 flex items-center justify-center text-lime">
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
		</div>
		<div class="text-left leading-tight pr-2">
			<p class="text-[11px] font-black text-white">{event.venue.category || 'Select'} {event.venue.room || 'Stage'}</p>
			{#if displayLocation}<p class="text-[9px] font-bold text-gray2">{displayLocation}</p>{/if}
		</div>
	</button>

	{#if showPopover}
		<div class="absolute left-0 top-[calc(100%+8px)] w-64 bg-navbar border border-gray2/20 rounded-xl shadow-xl overflow-hidden z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
			<div class="p-3 border-b border-gray2/10 bg-gray1 sticky top-0">
				<span class="text-[10px] font-black text-gray2 uppercase tracking-widest">Select Venue</span>
			</div>
			
			{#each venues as venue}
				{@const stages = typeof venue.setting_params === 'string' ? JSON.parse(venue.setting_params).stages : venue.setting_params.stages}
				<div class="p-3 border-b border-gray2/10 last:border-0">
					<p class="text-xs font-bold text-white uppercase tracking-wide mb-2">{venue.setting_name}</p>
					{#if stages && stages.length > 0}
						{#each stages as stage}
							<button 
								class="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors text-left cursor-pointer"
								on:click={() => selectVenue(venue.setting_name, stage.name)}
							>
								<div class="w-2 h-2 rounded-full shadow-sm" style="background-color: {stage.color || '#ccc'}"></div>
								<span class="text-xs font-bold text-gray2 hover:text-white transition-colors">{stage.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>