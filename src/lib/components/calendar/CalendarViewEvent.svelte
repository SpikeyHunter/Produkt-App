<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { CalendarEvent } from '$lib/types/types';
	import { tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	export let show: boolean;
	export let event: CalendarEvent | null;

	let dialogEl: HTMLDivElement;

	const dispatch = createEventDispatcher();

	const statusStyles: Record<string, string> = {
		HOLD: 'bg-tentatif text-black',
		CONFIRMED: 'bg-confirmed text-black'
	};

	const eventTypeIcons: Record<string, string> = {
		Show: '🎸',
		Corpo: '💼',
		Other: '🎉'
	};

	// All keydown logic is now in one place.
	function handleKeydown(e: KeyboardEvent) {
		// Closes the modal on Escape
		if (e.key === 'Escape') {
			e.preventDefault();
			closeModal();
		}
	}

	function closeModal() {
		show = false;
		dispatch('close');
	}

	function handleEdit() {
		dispatch('edit', { event });
		closeModal();
	}

	// This reactive block automatically focuses the dialog when it becomes visible.
	$: if (show && dialogEl) {
		// We use tick() to wait for the DOM to update before focusing.
		tick().then(() => {
			dialogEl.focus();
		});
	}
</script>

	{#if show && event}
	<!-- Modal Portal - Ensure it's rendered at the top level -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		bind:this={dialogEl}
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 outline-none"
		style="z-index: 9999;"
		transition:fade={{ duration: 250, easing: cubicOut }}
		on:click={closeModal}
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="event-title"
		tabindex="-1"
	>
		<div
			class="bg-gray1 rounded-2xl max-w-lg w-full relative shadow-2xl border border-gray2/20 transform"
			transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
			on:click|stopPropagation
			role="document"
		>
			<!-- Header -->
			<div class="flex items-start justify-between p-6 pb-4 border-b border-gray2/20">
				<div class="flex items-center gap-3">
					<span class="text-2xl">{eventTypeIcons[event.event_type]}</span>
					<div>
						<h3 id="event-title" class="text-xl font-bold text-white">{event.title}</h3>
						{#if event.artist_name}
							<p class="text-sm text-gray2 mt-1">{event.artist_name}</p>
						{/if}
					</div>
				</div>
				<button
					class="p-2 text-gray-400 hover:text-white hover:bg-gray2/10 rounded-lg transition-colors"
					on:click={closeModal}
					aria-label="Close modal"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-6 space-y-4">
				<!-- Status -->
				<div class="flex items-center gap-3">
					<span class="text-sm font-semibold text-gray2">Status:</span>
					<span class="px-3 py-1 rounded-full text-xs font-bold {statusStyles[event.status]}">
						{event.status}
					</span>
				</div>

				<!-- Date & Time -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<span class="text-sm font-semibold text-gray2">Date:</span>
						<p class="text-white mt-1">
							{new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</p>
					</div>
					{#if event.start_time}
						<div>
							<span class="text-sm font-semibold text-gray2">Time:</span>
							<p class="text-white mt-1">
								{event.start_time}{#if event.end_time} - {event.end_time}{/if}
							</p>
						</div>
					{/if}
				</div>

				<!-- Venue Information -->
				{#if event.venue_category || event.venue_room}
					<div>
						<span class="text-sm font-semibold text-gray2">Venue:</span>
						<p class="text-white mt-1">
							{event.venue_category || ''}
							{#if event.venue_category && event.venue_room} - {/if}
							{event.venue_room || ''}
						</p>
					</div>
				{/if}

				<!-- Event Type -->
				<div>
					<span class="text-sm font-semibold text-gray2">Event Type:</span>
					<p class="text-white mt-1">{event.event_type}</p>
				</div>

				<!-- Notes -->
				{#if event.notes}
					<div>
						<span class="text-sm font-semibold text-gray2">Notes:</span>
						<p class="text-gray3 mt-1 text-sm leading-relaxed">{event.notes}</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex gap-3 p-6 pt-4 border-t border-gray2/20">
				<button
					class="flex-1 px-4 py-2 bg-lime text-black font-bold rounded-lg hover:bg-lime/90 transition-colors cursor-pointer"
					on:click={handleEdit}
				>
					Edit Event
				</button>
				<button
					class="flex-1 px-4 py-2 bg-gray2/20 text-gray2 font-bold rounded-lg hover:bg-gray2/30 transition-colors cursor-pointer"
					on:click={closeModal}
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}