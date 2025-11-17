<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { CalendarEvent } from '$lib/types/calendar-types';
	import { tick } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let show: boolean;
	export let event: CalendarEvent | null;

	let dialogEl: HTMLDivElement;
	let copying = false;

	const dispatch = createEventDispatcher();

	const statusStyles: Record<string, string> = {
		HOLD: 'bg-orange-500/30 text-orange-200 border border-orange-500/50',
		CONFIRMED: 'bg-lime/30 text-lime border border-lime/50',
		PENDING: 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/50',
		CANCELLED: 'bg-red-500/30 text-red-200 border border-red-500/50'
	};
	const holdLevelStyles: Record<string, string> = {
		H1: 'bg-red-500/30 text-red-200',
		H2: 'bg-orange-500/30 text-orange-200',
		H3: 'bg-yellow-500/30 text-yellow-200',
		H4: 'bg-green-500/30 text-green-200',
		H5: 'bg-blue-500/30 text-blue-200',
		H6: 'bg-purple-500/30 text-purple-200',
		P: 'bg-gray-500/30 text-gray-200'
	};
	const eventTypeIcons: Record<string, string> = {
		Show: '🎸',
		Corpo: '💼',
		Other: '🎉'
	};

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeModal();
		}

		// Fix for a11y_click_events_have_key_events:
		// Provide a keyboard equivalent for the `on:click={closeModal}` on the backdrop.
		// If the backdrop `div` (dialogEl) is focused, 'Enter' or 'Space'
		// should also close the modal, just like a click.
		if (e.key === 'Enter' || e.key === ' ') {
			// We check e.target to make sure this only fires if the dialogEl
			// (the backdrop) itself is the target, not a button inside it.
			if (e.target === dialogEl) {
				e.preventDefault();
				closeModal();
			}
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

	async function handleConfirm() {
		if (!event) return;
		try {
			const { error } = await supabase
				.from('calendar_events')
				.update({
					status: 'CONFIRMED',
					hold_level: null
				})
				.eq('calendar_event_id', event.calendar_event_id);

			if (error) throw error;

			dispatch('update');
			closeModal();
		} catch (err) {
			console.error('Error confirming event:', err);
		}
	}

	async function copyEventInfo() {
		if (!event) return;

		copying = true;
		let clipboardText = `Event: ${event.title}\n`;
		if (event.artist_name) clipboardText += `Artist: ${event.artist_name}\n`;
		clipboardText += `Date: ${new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})}\n`;
		if (event.start_time) {
			clipboardText += `Time: ${event.start_time}`;
			if (event.end_time) clipboardText += ` - ${event.end_time}`;
			clipboardText += '\n';
		}
		clipboardText += `Status: ${event.status}`;
		if (event.hold_level) clipboardText += ` (${event.hold_level})`;
		clipboardText += '\n';
		if (event.venue_category) {
			clipboardText += `Venue: ${event.venue_category}`;
			if (event.venue_room) clipboardText += ` - ${event.venue_room}`;
			clipboardText += '\n';
		}
		if (event.notes) clipboardText += `\nNotes: ${event.notes}`;

		try {
			await navigator.clipboard.writeText(clipboardText);
			setTimeout(() => (copying = false), 1000);
		} catch (err) {
			console.error('Failed to copy:', err);
			copying = false;
		}
	}

	$: if (show && dialogEl) {
		tick().then(() => {
			dialogEl.focus();
		});
	}
</script>

{#if show && event}
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
			<div class="flex items-start justify-between p-6 pb-4 border-b border-gray2/20">
				<div class="flex items-start gap-3 flex-1">
					<span class="text-2xl mt-1">{eventTypeIcons[event.event_type]}</span>
					<div class="flex-1">
						<h3 id="event-title" class="text-xl font-bold text-white flex items-center gap-2">
							{event.title}
							{#if event.is_challenge}
								<span class="text-red-400 text-sm" title="Challenge">⚡</span>
							{/if}
							{#if event.is_target}
								<span class="text-green-400 text-sm" title="Target">🎯</span>
							{/if}
							{#if event.is_matinee}
								<span class="text-blue-400 text-xs px-2 py-0.5 bg-blue-500/20 rounded-full"
									>Matinee</span
								>
							{/if}
						</h3>
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

			<div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
				<div class="flex items-center gap-3 flex-wrap">
					<div class="flex items-center gap-2">
						<span class="text-sm font-semibold text-gray2">Status:</span>
						<span class="px-3 py-1 rounded-full text-xs font-bold {statusStyles[event.status]}">
							{event.status}
						</span>
					</div>

					{#if event.hold_level}
						<div class="flex items-center gap-2">
							<span class="text-sm font-semibold text-gray2">Hold:</span>
							<span
								class="px-3 py-1 rounded-full text-xs font-bold {holdLevelStyles[event.hold_level]}"
							>
								{event.hold_level}
							</span>
						</div>
					{/if}
				</div>

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

				{#if event.tour_name || event.contact_name}
					<div class="grid grid-cols-2 gap-4">
						{#if event.tour_name}
							<div>
								<span class="text-sm font-semibold text-gray2">Tour:</span>
								<p class="text-white mt-1">{event.tour_name}</p>
							</div>
						{/if}
						{#if event.contact_name}
							<div>
								<span class="text-sm font-semibold text-gray2">Contact:</span>
								<p class="text-white mt-1">
									{event.contact_name}
									{#if event.contact_email}
										<br /><span class="text-sm text-gray3">{event.contact_email}</span>
									{/if}
									{#if event.contact_phone}
										<br /><span class="text-sm text-gray3">{event.contact_phone}</span>
									{/if}
								</p>
							</div>
						{/if}
					</div>
				{/if}

				<div>
					<span class="text-sm font-semibold text-gray2">Event Type:</span>
					<p class="text-white mt-1">{event.event_type}</p>
				</div>

				{#if event.notes}
					<div>
						<span class="text-sm font-semibold text-gray2">Notes:</span>
						<p class="text-gray3 mt-1 text-sm leading-relaxed whitespace-pre-wrap">
							{event.notes}
						</p>
					</div>
				{/if}

				<div class="pt-3 border-t border-gray2/10 text-xs text-gray2">
					{#if event.created_at}
						Created: {new Date(event.created_at).toLocaleDateString()}
					{/if}
					{#if event.updated_at && event.updated_at !== event.created_at}
						• Updated: {new Date(event.updated_at).toLocaleDateString()}
					{/if}
				</div>
			</div>

			<div class="flex gap-3 p-6 pt-4 border-t border-gray2/20">
				{#if event.status === 'HOLD' || event.status === 'PENDING'}
					<button
						class="flex-1 px-4 py-2 bg-lime text-black font-bold rounded-xl 
						       hover:bg-lime/90 transition-colors cursor-pointer"
						on:click={handleConfirm}
					>
						Confirm Hold
					</button>
				{/if}
				<button
					class="flex-1 px-4 py-2 bg-gray2/20 text-white font-bold rounded-xl 
					       hover:bg-gray2/30 transition-colors cursor-pointer"
					on:click={handleEdit}
				>
					Edit Event
				</button>
				<button
					class="px-4 py-2 bg-gray2/20 text-white font-bold rounded-xl 
					       hover:bg-gray2/30 transition-colors cursor-pointer
					       {copying ? 'bg-lime/30 text-lime' : ''}"
					on:click={copyEventInfo}
					title="Copy event details"
				>
					{#if copying}
						✓
					{:else}
						<svg
							class="w-5 h-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom animations for smooth transitions */
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Apply animations when modal opens */
	[role='dialog'] {
		animation: fadeIn 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	[role='document'] {
		animation: slideUp 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}
</style>