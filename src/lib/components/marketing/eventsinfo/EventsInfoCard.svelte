<script lang="ts">
	// 1. Import createEventDispatcher
	import { createEventDispatcher } from 'svelte';
	import InfoCardTemplate from '$lib/components/marketing/eventsinfo/InfoCardTemplate.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import type { EventAdvance } from '$lib/services/eventsService';

	export let event: EventAdvance;
	export let width: number = 450;
	export let height: number = 300;

	// 2. Create a dispatcher instance
	const dispatch = createEventDispatcher();
	// 3. This function now dispatches an event called 'openvenue'
	function handleSetVenue() {
		dispatch('openvenue', event);
		// It sends the event data with it
	}

	// This function now dispatches an event called 'opengenre'
	function handleSetGenre() {
		dispatch('opengenre', event);
	}

	function formatDisplayDate(dateString: string | null): string {
		if (!dateString) {
			return 'TBD';
		}
		try {
			const utcDate = new Date(dateString);
			if (isNaN(utcDate.getTime())) return dateString;
			const date = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
			return date.toLocaleString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}
</script>

<div
	class="event-card-wrapper rounded-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl"
	style="width: {width}px; height: {height}px;"
>
	<InfoCardTemplate showHeader={false} showFooter={false} contentPadding="p-0">
		<div class="flex p-4 gap-4" style="height: {height}px;">
			<div class="w-2/5 flex flex-col gap-2">
				<div class="flex-1 bg-gray1 rounded-lg overflow-hidden relative">
					{#if event.event_flyer || event.poster}
						<img
							src={event.event_flyer || event.poster}
							alt={event.name}
							class="w-full h-full object-cover"
						/>

						{#if event.event_status}
							<div
								class="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold leading-none
								{event.event_status.toLowerCase() === 'live'
									? 'bg-lime text-black'
									: 'bg-gray-600 text-white'}"
							>
								{event.event_status.toUpperCase()}
							</div>
						{/if}
					{:else}
						<div
							class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray1 to-gray2"
						>
							<svg
								class="w-12 h-12 text-gray2"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
								<circle cx="8.5" cy="8.5" r="1.5" />
								<polyline points="21 15 16 10 5 21" />
							</svg>
							<span class="text-gray2 text-sm mt-2">No Image</span>
						</div>
					{/if}
				</div>
				<div class="bg-gray3 rounded-lg p-2 flex items-center justify-center min-h-[36px]">
					<span class="text-black font-bold text-[15px] text-center leading-tight">
						{formatDisplayDate(event.event_date || event.date)}
					</span>
				</div>
			</div>

			<div class="flex-1 flex flex-col gap-0 py-0">
				<h2 class="text-xl font-normal text-white leading-tight mb-2 line-clamp-2">
					{event.name}
				</h2>
				<div class="w-full h-0 border-t border-gray1 mb-2.5"></div>
				<div class="text-sm flex gap-2 items-center mb-1.5">
					<span class="text-gray3 min-w-[50px]">Event ID:</span>
					<span class="text-white flex-1">{event.event_id || event.id || 'N/A'}</span>
				</div>
        <div class="text-sm flex gap-1 items-center mb-2">
					<span class="text-gray3 min-w-[50px]">Venue:</span>
					<span class="text-white flex-1">
						{#if event.event_venue}
						<Button variant="invisible" on:click={handleSetVenue}>
							<span class="flex items-center gap-2 hover:!text-gray3">
								{event.event_venue}
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</span>
						</Button>
					{:else}
						<Button variant="slim" on:click={handleSetVenue}>Set Venue</Button>
					{/if}
					</span>
				</div>
				<div class="text-sm flex gap-1 items-center mb-1.5">
					<span class="text-gray3 min-w-[50px]">Genre:</span>
					<span class="text-white flex-1">
						{#if event.event_genre}
							<Button variant="invisible" on:click={handleSetGenre}>
								<span class="flex items-center gap-2 hover:!text-gray3">
									{event.event_genre}
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</span>
							</Button>
						{:else}
							<Button variant="slim" on:click={handleSetGenre}>Set Genre</Button>
						{/if}
					</span>
				</div>

			</div>
		</div>
	</InfoCardTemplate>
</div>