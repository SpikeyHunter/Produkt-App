<script lang="ts">
	import { updateEventProperties } from '$lib/services/controlCenterService';
	import type { UpcomingEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let selectedEvent: UpcomingEvent | null = null;

	let eventBadge = '';
	let eventActive = true;

	$: if (selectedEvent) {
		eventBadge = selectedEvent.event_badge || '';
		eventActive = selectedEvent.event_active;
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	async function handleToggleActive() {
		if (!selectedEvent) return;

		eventActive = !eventActive;
		const success = await updateEventProperties(selectedEvent.event_id, {
			event_active: eventActive
		});

		if (success) {
			dispatch('updated');
		}
	}

	async function handleBadgeChange() {
		if (!selectedEvent) return;

		const success = await updateEventProperties(selectedEvent.event_id, {
			event_badge: eventBadge || null
		});

		if (success) {
			dispatch('updated');
		}
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold">Event Modifiers</h3>
	</div>

	<div class="flex-1 overflow-y-auto p-4 custom-scroll">
		{#if !selectedEvent}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"></circle>
					<path d="M12 1v6m0 6v6m6-11h-6m-6 0H0m11 6h6m-6 0H5" stroke-dasharray="2 2"></path>
				</svg>
				<p class="text-gray2 text-xs">Select an event from the carousel</p>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="space-y-3">
					<div>
						<p class="text-[10px] text-gray3 uppercase font-bold mb-1 block">Event Name</p>
						<p class="text-sm text-white font-bold">{selectedEvent.event_name}</p>
					</div>

					<div>
						<p class="text-[10px] text-gray3 uppercase font-bold mb-1 block">Event Date</p>
						<p class="text-xs text-gray2">{formatDate(selectedEvent.event_date)}</p>
					</div>

					{#if selectedEvent.event_venue}
						<div>
							<p class="text-[10px] text-gray3 uppercase font-bold mb-1 block">Venue</p>
							<p class="text-xs text-gray2">{selectedEvent.event_venue}</p>
						</div>
					{/if}
				</div>

				<div class="border-t border-gray1 my-4"></div>

				<div class="space-y-4">
					<div>
						<p class="text-[10px] text-gray3 uppercase font-bold mb-2 block">Status</p>
						<button type="button" on:click={handleToggleActive} class="w-full flex items-center justify-between p-3 rounded-lg transition-colors {eventActive ? 'bg-lime text-black' : 'bg-gray1 text-gray2'}">
							<span class="text-xs font-bold">{eventActive ? 'Active' : 'Inactive'}</span>
							<div class="w-10 h-6 rounded-full transition-colors relative {eventActive ? 'bg-black' : 'bg-navbar'}">
								<div class="absolute top-1 transition-all duration-200 w-4 h-4 rounded-full bg-lime {eventActive ? 'left-5' : 'left-1'}"></div>
							</div>
						</button>
					</div>

					<div>
						<label for="event-badge" class="text-[10px] text-gray3 uppercase font-bold mb-2 block">Badge</label>
						<input id="event-badge" type="text" bind:value={eventBadge} on:blur={handleBadgeChange} placeholder="e.g. SOLD OUT, NEW" class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime" />
						<p class="text-[10px] text-gray3 mt-1">Appears on event poster</p>
					</div>

					{#if selectedEvent.event_url || selectedEvent.rsvp_url}
						<div>
							<p class="text-[10px] text-gray3 uppercase font-bold mb-2 block">Quick Links</p>
							<div class="space-y-2">
								{#if selectedEvent.event_url}
									<a href={selectedEvent.event_url} target="_blank" rel="noopener noreferrer" class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lime text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
											<polyline points="15 3 21 3 21 9"></polyline>
											<line x1="10" y1="14" x2="21" y2="3"></line>
										</svg>
										View Tickets
									</a>
								{/if}
								{#if selectedEvent.rsvp_url}
									<a href={selectedEvent.rsvp_url} target="_blank" rel="noopener noreferrer" class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray1 text-white text-xs font-bold rounded-lg hover:bg-gray2 transition-colors">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
											<polyline points="15 3 21 3 21 9"></polyline>
											<line x1="10" y1="14" x2="21" y2="3"></line>
										</svg>
										View RSVP
									</a>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
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