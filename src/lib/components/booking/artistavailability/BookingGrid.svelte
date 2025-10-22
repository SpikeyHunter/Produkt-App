<!-- /src/lib/components/booking/artistavailability/BookingGrid.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { BookingArtist, BookingEvent } from '$lib/types/booking';
	import BookingCard from './BookingCard.svelte';
	import ArtistCard from './ArtistCard.svelte';
	import { flip } from 'svelte/animate';

	export let items: (BookingArtist | BookingEvent)[] = [];
	export let type: 'artist' | 'event' = 'event';
	export let totalCount = 0;
	export let isLoading = false;
	export let hasMore = true;

	const dispatch = createEventDispatcher();
	let sentinel: HTMLDivElement;

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting && hasMore && !isLoading) {
				dispatch('loadMore');
			}
		});

		if (sentinel) observer.observe(sentinel);

		return () => {
			if (sentinel) observer.unobserve(sentinel);
		};
	});
</script>

<div class="bg-navbar border border-gray1 rounded-xl h-full flex flex-col">
	<!-- Header -->
	<div class="p-4 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-lg font-bold capitalize">{type}s</h3>
		<p class="text-gray2 text-xs mt-1">
			{#if isLoading && items.length === 0}
				Loading {type}s...
			{:else if totalCount > 0}
				Showing {items.length.toLocaleString()} of {totalCount.toLocaleString()} {type}s
			{:else if !isLoading}
				No {type}s found for the current filters.
			{/if}
		</p>
	</div>

	<!-- Grid Content -->
	<div class="flex-1 overflow-auto p-6">
		{#if items.length > 0}
			<!-- FIXED SIZE GRID WITH AUTO-FIT AND CENTERED -->
			<div class="grid gap-3 justify-center" style="grid-template-columns: repeat(auto-fill, minmax(320px, 320px));">
				{#each items as item (item.id)}
					<div animate:flip={{ duration: 300 }}>
						{#if type === 'event'}
							<BookingCard data={item as BookingEvent} />
						{:else}
							<ArtistCard data={item as BookingArtist} on:click={() => dispatch('artistClick', item)} />
						{/if}
					</div>
				{/each}
			</div>
		{:else if isLoading}
			<!-- Initial Loading State -->
			<div class="flex justify-center items-center h-full">
				<div class="flex flex-col items-center gap-3">
					<svg class="w-8 h-8 text-lime animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path d="M21 12a9 9 0 11-6.219-8.56" />
					</svg>
					<p class="text-gray2 text-sm">Loading {type}s...</p>
				</div>
			</div>
		{:else}
			<!-- Empty State Message -->
			<div class="flex flex-col items-center justify-center h-full text-center">
				<div class="text-6xl mb-4">{type === 'event' ? '📅' : '🎤'}</div>
				<p class="text-gray2 text-sm">No {type}s found</p>
				<p class="text-gray2 text-xs mt-1">Try adjusting your filters or search terms.</p>
			</div>
		{/if}

		<!-- Loading Spinner for pagination -->
		{#if isLoading && items.length > 0}
			<div class="flex justify-center items-center p-4 mt-4">
				<svg class="w-6 h-6 text-lime animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
			</div>
		{/if}

		<!-- End of List Message -->
		{#if !hasMore && items.length > 0}
			<p class="text-center text-gray2 text-xs py-4">End of results</p>
		{/if}

		<!-- Sentinel for Intersection Observer -->
		<div bind:this={sentinel} class="h-1"></div>
	</div>
</div>