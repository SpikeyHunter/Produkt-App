<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import type { EventAdvance } from '$lib/types/events';

	export let event: EventAdvance;

	interface TimetableEntry {
		id: string;
		time: string;
		artist: string;
		notes: string;
		status: string;
		length: string;
	}

	// Parse timetable data
	$: timetable = parseTimetable(event);

	function parseTimetable(eventData: EventAdvance): TimetableEntry[] {
		// First check if timetable exists in the event object directly
		if (eventData.timetable && Array.isArray(eventData.timetable)) {
			return eventData.timetable;
		}

		// Otherwise return empty array
		return [];
	}
	function isHighlightedArtist(artistName: string): boolean {
		return event.artist_name ? artistName.toLowerCase() === event.artist_name.toLowerCase() : false;
	}
</script>

<Section title="RUNNING ORDER" class="h-full flex flex-col">
	<ContentBox class="!bg-black/15 !p-0 overflow-hidden h-full flex flex-col">
		{#if timetable.length > 0}
			<div class="h-full flex flex-col justify-evenly">
				{#each timetable as item}
					{@const isHighlighted = isHighlightedArtist(item.artist)}

					<div class={isHighlighted ? 'bg-lime/10 border-l-3 border-lime' : ''}>
						<div class="flex items-center px-5 py-1">
							<span class="text-sm w-28 {isHighlighted ? 'text-lime' : 'text-gray2'}">
								{@html item.time || '&nbsp;'}
							</span>
							<span class="text-sm {isHighlighted ? 'text-lime' : 'text-white'}">
								{item.artist}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex items-center justify-center h-full text-gray2 text-sm">
				No running order available
			</div>
		{/if}
	</ContentBox>
</Section>
