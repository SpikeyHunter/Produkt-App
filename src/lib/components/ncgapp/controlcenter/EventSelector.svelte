<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSourceEvents } from '$lib/services/controlCenterService';
	import type { SourceEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let sourceEvents: SourceEvent[] = [];
	let loading = true;
	let searchTerm = '';

	export let excludeEventIds: number[] = [];

	onMount(async () => {
		await loadEvents();
	});

	async function loadEvents() {
		loading = true;
		sourceEvents = await fetchSourceEvents();
		loading = false;
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	function handleAddEvent(event: SourceEvent) {
		dispatch('add', event);
	}

	function handleDragStart(event: DragEvent, sourceEvent: SourceEvent) {
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'copy';
			event.dataTransfer.setData('application/json', JSON.stringify(sourceEvent));
		}
	}

	$: filteredEvents = sourceEvents.filter((event) => {
		const matchesSearch = event.event_name.toLowerCase().includes(searchTerm.toLowerCase());
		const notExcluded = !excludeEventIds.includes(event.event_id);
		return matchesSearch && notExcluded;
	});
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold mb-2">Available Events</h3>
		<input type="text" bind:value={searchTerm} placeholder="Search events..." class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime" />
	</div>

	<div class="flex-1 overflow-y-auto px-3 pt-4 mb-4 space-y-2 custom-scroll">
		{#if loading}
			<div class="space-y-2">
				{#each Array(8) as _}
					<div class="animate-pulse h-16 bg-gray1 rounded-lg"></div>
				{/each}
			</div>
		{:else if filteredEvents.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="15" y1="9" x2="9" y2="15"></line>
					<line x1="9" y1="9" x2="15" y2="15"></line>
				</svg>
				<p class="text-gray2 text-xs">{searchTerm ? 'No matches found' : 'All events added'}</p>
			</div>
		{:else}
			{#each filteredEvents as event (event.event_id)}
				<div role="button" tabindex="0" draggable="true" on:dragstart={(e) => handleDragStart(e, event)} class="group relative cursor-grab active:cursor-grabbing">
					<button type="button" on:click={() => handleAddEvent(event)} class="w-full flex items-center gap-2 p-2 bg-gray1 rounded-lg hover:bg-lime hover:text-black transition-all text-left border-2 border-transparent hover:border-lime">
						<div class="w-12 h-16 rounded overflow-hidden bg-navbar flex-shrink-0">
							{#if event.event_flyer}
								<img src={event.event_flyer} alt={event.event_name} class="w-full h-full object-cover" draggable="false" />
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-lime/20 to-lime/10 flex items-center justify-center">
									<svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
									</svg>
								</div>
							{/if}
						</div>

						<div class="flex-1 min-w-0">
							<p class="text-xs font-bold text-white group-hover:text-black truncate">{event.event_name}</p>
							<p class="text-[10px] text-gray2 group-hover:text-black/70">{formatDate(event.event_date)}</p>
							{#if event.event_venue}
								<p class="text-[10px] text-gray3 group-hover:text-black/50 truncate">{event.event_venue}</p>
							{/if}
						</div>
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}
</style>