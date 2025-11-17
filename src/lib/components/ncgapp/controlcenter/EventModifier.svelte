<script lang="ts">
	import { updateEventProperties } from '$lib/services/controlCenterService';
	import type { UpcomingEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let selectedEvent: UpcomingEvent | null = null;

	// --- State for Badge ---
	let badgeText = '';
	let badgeColor = '';
	let isSaving = false;
	// ---

	let eventActive = true;

	// Theme colors for the badge picker
	const badgeColors = [
		{ name: 'confirmed', hex: '#86EFAC' },
		{ name: 'tentatif', hex: '#FCD34D' },
		{ name: 'proposed', hex: '#FDBA74' },
		{ name: 'problem', hex: '#FCA5A5' },
		{ name: 'info', hex: '#c4b5fd' },
		{ name: 'question', hex: '#93c5fd' }
	];

	// This block runs whenever selectedEvent changes
	$: {
		if (selectedEvent) {
			eventActive = selectedEvent.event_active;

			// Try to parse the event_badge JSON
			if (selectedEvent.event_badge) {
				try {
					// New JSON format: {"text": "...", "color": "..."}
					const parsedBadge = JSON.parse(selectedEvent.event_badge);
					badgeText = parsedBadge.text || '';
					badgeColor = parsedBadge.color || ''; // <-- Restored this line
				} catch (e) {
					// Handle legacy non-JSON badges (just text)
					badgeText = selectedEvent.event_badge;
					badgeColor = ''; // No color info
				}
			} else {
				// No badge, clear fields
				badgeText = '';
				badgeColor = '';
			}
		} else {
			// ADDED: No event selected, clear all fields
			eventActive = true; // Default state
			badgeText = '';
			badgeColor = '';
		}
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

	// --- New Badge Functions ---
	async function handleSaveBadge() {
		if (!selectedEvent || !badgeText || isSaving) return;

		isSaving = true; // Start animation

		// Save badge as a JSON string
		const badgeDataString = JSON.stringify({
			text: badgeText,
			color: badgeColor || ''
		});

		const success = await updateEventProperties(selectedEvent.event_id, {
			event_badge: badgeDataString
		});

		if (success) {
			dispatch('updated');
			// Keep the saving state for a moment to show success
			setTimeout(() => {
				isSaving = false;
			}, 600);
		} else {
			isSaving = false;
		}
	}

	async function handleClearBadge() {
		badgeText = '';
		badgeColor = '';

		if (!selectedEvent) return; // No event to update

		// Clear the badge in the database by setting it to null
		const success = await updateEventProperties(selectedEvent.event_id, {
			event_badge: null
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

	<div class="flex-1 overflow-y-auto px-4 pt-4 mb-4 custom-scroll">
		{#if !selectedEvent}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg
					class="w-12 h-12 text-gray2 mb-3"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path d="M12 1v6m0 6v6m6-11h-6m-6 0H0m11 6h6m-6 0H5" stroke-dasharray="2 2"></path>
				</svg>
				<p class="text-gray2 text-xs">Select an event from the carousel</p>
			</div>
		{:else}
			<div class="space-y-4">
				<div class="space-y-4">
					<div>
						<p class="text-[10px] text-gray3 uppercase font-bold mb-2 block">Status</p>
						<!-- MODIFIED: Thinner button (px-3 py-2) and thinner toggle (h-5) -->
						<button
							type="button"
							on:click={handleToggleActive}
							class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors {eventActive
								? 'bg-lime text-black'
								: 'bg-gray1 text-gray2'}"
						>
							<span class="text-xs font-bold">{eventActive ? 'Active' : 'Inactive'}</span>
							<div
								class="w-10 h-5 rounded-full transition-colors relative {eventActive
									? 'bg-black'
									: 'bg-navbar'}"
							>
								<div
									class="absolute top-0.5 transition-all duration-200 w-4 h-4 rounded-full bg-lime {eventActive
										? 'left-5'
										: 'left-1'}"
								></div>
							</div>
						</button>
					</div>

					<!-- MODIFIED: Badge section -->
					<div>
						<label for="event-badge" class="text-[10px] text-gray3 uppercase font-bold mb-2 block"
							>Badge</label
						>

						<!-- Badge Text Input -->
						<input
							id="event-badge"
							type="text"
							bind:value={badgeText}
							placeholder="e.g. SOLD OUT, NEW"
							class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
						/>

						<!-- Color Picker -->
						<div class="flex flex-wrap gap-2 mt-3">
							{#each badgeColors as color}
								<button
									type="button"
									title={color.name}
									on:click={() => (badgeColor = color.hex)}
									class="w-6 h-6 rounded-full border-2 transition-all {badgeColor === color.hex
										? 'border-lime scale-110'
										: 'border-transparent hover:border-gray2'}"
									style="background-color: {color.hex};"
								>
									<!-- Checkmark for selected color -->
									{#if badgeColor === color.hex}
										<svg
											class="w-4 h-4 text-black m-auto"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M20 6 9 17l-5-5"></path>
										</svg>
									{/if}
								</button>
							{/each}
						</div>

						<!-- Action Buttons -->
						<div class="flex gap-2 mt-3">
							<button
								type="button"
								on:click={handleSaveBadge}
								class="flex-1 px-3 py-2 bg-lime text-black text-xs font-bold rounded-lg hover:opacity-90 hover:cursor-pointer transition-opacity disabled:cursor-not-allowed disabled:bg-gray3 disabled:opacity-50"
								disabled={!badgeText || !badgeColor || isSaving}
							>
								{isSaving ? 'Saving...' : 'Save Badge'}
							</button>
							<button
								type="button"
								on:click={handleClearBadge}
								class="px-3 py-2 bg-gray1 text-white text-xs font-bold rounded-lg hover:bg-problem hover:text-black hover:cursor-pointer transition-colors"
							>
								Clear
							</button>
						</div>
					</div>

					{#if selectedEvent.event_url || selectedEvent.rsvp_url}
						<div>
							<p class="text-[10px] text-gray3 uppercase font-bold mb-2 block">Quick Links</p>
							<div class="space-y-2">
								{#if selectedEvent.event_url}
									<a
										href={selectedEvent.event_url}
										target="_blank"
										rel="noopener noreferrer"
										class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-lime text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
											<polyline points="15 3 21 3 21 9"></polyline>
											<line x1="10" y1="14" x2="21" y2="3"></line>
										</svg>
										View Tickets
									</a>
								{/if}
								{#if selectedEvent.rsvp_url}
									<a
										href={selectedEvent.rsvp_url}
										target="_blank"
										rel="noopener noreferrer"
										class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray1 text-white text-xs font-bold rounded-lg hover:bg-gray2 transition-colors"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
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
