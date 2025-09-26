<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { portal } from '$lib/utils/portalUtils.js';
	import { supabase } from '$lib/supabase.js';
	import type { EventAdvance, HospoRiderInfo } from '$lib/types/events.js';
	import HospoRiderModal from '$lib/components/modals/HospoRiderModal.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	export let event: EventAdvance & { event_venue?: string; artist_name?: string };

	const dispatch = createEventDispatcher();

	// --- TYPE DEFINITIONS ---
	// Define a type for rider items to help TypeScript
	type HospoItem = { qty?: number; selected?: boolean };

	// Create a more complete local type to include new properties
	type CompleteHospoRiderInfo = HospoRiderInfo & {
		beers_wine?: {
			beers?: { [key: string]: HospoItem };
			wine?: { [key: string]: HospoItem };
			juice?: { [key: string]: HospoItem };
		};
		rider_sent_to_mihir?: boolean; // Added property
	};

	// --- STATE ---
	let hospoRider: HospoRiderInfo | null = null;
	let saving = false;
	let showHospoModal = false;
	let justCopied = false;
	let showPopup = false;
	let popupMessage = '';

	// --- LOGIC ---

	// Parse hospo_rider from event
	function parseHospoRider(eventData: typeof event) {
		if (!eventData?.hospo_rider) {
			return null;
		}

		try {
			const parsed =
				typeof eventData.hospo_rider === 'string'
					? JSON.parse(eventData.hospo_rider)
					: eventData.hospo_rider;
			// Set default for the new property if it doesn't exist
			if (typeof parsed.rider_sent_to_mihir === 'undefined') {
				parsed.rider_sent_to_mihir = false;
			}
			return parsed;
		} catch (e) {
			console.error('Error parsing hospo_rider:', e);
			return null;
		}
	}

	// Initialize and update hospo rider from event
	$: hospoRider = parseHospoRider(event);

	// Cast to the more complete type for use in the component
	$: completeHospoRider = hospoRider as CompleteHospoRiderInfo | null;

	// --- DATABASE FUNCTIONS ---
	async function saveHospoChanges() {
		if (!event?.event_id || !event.artist_name || !hospoRider) {
			console.warn('Missing required data for saving');
			return;
		}
		saving = true;
		try {
			const { error } = await supabase
				.from('events_advance')
				.update({ hospo_rider: hospoRider })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);

			if (error) {
				console.error('❌ Failed to save hospitality details:', error);
			} else {
				// Dispatch event to notify parent of data change
				dispatch('datachanged');
			}
		} catch (err) {
			console.error('❌ Unexpected error saving hospitality details:', err);
		} finally {
			saving = false;
		}
	}

	function toggleRiderSentStatus() {
		if (completeHospoRider) {
			completeHospoRider.rider_sent_to_mihir = !completeHospoRider.rider_sent_to_mihir;
			hospoRider = { ...completeHospoRider }; // Trigger reactivity
			saveHospoChanges();
		}
	}

	// --- CLIPBOARD TEXT GENERATION ---

	// Generate plain text for clipboard
	$: hospoRiderCopyText = (() => {
		if (!completeHospoRider) return '';

		let text = 'Hospitality Rider:\n';
		text += `${event?.event_venue || 'Venue'} will provide:\n`;
		text += '- 1x shared green room\n';

		// Spirits
		const selectedSpirits = Object.entries(completeHospoRider.spirits || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedSpirits.forEach((spirit) => {
			text += `- ${spirit}\n`;
		});

		// Beers
		const selectedBeers = Object.entries(completeHospoRider.beers_wine?.beers || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedBeers.forEach((beer) => {
			text += `- ${beer}\n`;
		});

		// Wine
		const wineItems = (completeHospoRider.beers_wine?.wine || {}) as { [key: string]: HospoItem };
		const selectedWine = Object.entries(wineItems).map(
			([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`
		);
		selectedWine.forEach((wine) => {
			text += `- ${wine}\n`;
		});

		// Juice
		const selectedJuice = Object.entries(completeHospoRider.beers_wine?.juice || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedJuice.forEach((juice) => {
			text += `- ${juice}\n`;
		});

		// Other Drinks
		const selectedDrinks = Object.entries(completeHospoRider.other_drinks || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		if (selectedDrinks.length > 0) {
			selectedDrinks.forEach((drink) => {
				text += `- ${drink}\n`;
			});
		}

		// Base items
		if (completeHospoRider.base.regular_drinks) {
			text += '- Beers, RedBull, Water, Coconut water, Soft drinks\n';
		}
		if (completeHospoRider.base.regular_snacks) {
			text += '- Snacks: Proteins bar, Nuts, Gum, Chips, Granola bar, etc.\n';
		}

		// Custom requests
		if (completeHospoRider.custom_requests?.length > 0) {
			completeHospoRider.custom_requests.forEach((req) => {
				if (req.text.trim()) {
					text += `- ${req.text}\n`;
				}
			});
		}

		// Custom rider text
		if (completeHospoRider.custom_rider_text?.trim()) {
			text += '\n' + completeHospoRider.custom_rider_text + '\n';
		}

		return text;
	})();

	// Generate HTML for clipboard
	$: hospoRiderHtml = (() => {
		if (!completeHospoRider) return '';

		let html = '<strong><u>Hospitality Rider:</u></strong><br>';
		html += `${event?.event_venue || 'Venue'} will provide:<br>`;
		html += '- 1x shared green room<br>';

		// Spirits
		const selectedSpirits = Object.entries(completeHospoRider.spirits || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedSpirits.forEach((spirit) => {
			html += `- ${spirit}<br>`;
		});

		// Beers
		const selectedBeers = Object.entries(completeHospoRider.beers_wine?.beers || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedBeers.forEach((beer) => {
			html += `- ${beer}<br>`;
		});

		// Wine
		const wineItems = (completeHospoRider.beers_wine?.wine || {}) as { [key: string]: HospoItem };
		const selectedWine = Object.entries(wineItems).map(
			([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`
		);
		selectedWine.forEach((wine) => {
			html += `- ${wine}<br>`;
		});

		// Juice
		const selectedJuice = Object.entries(completeHospoRider.beers_wine?.juice || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		selectedJuice.forEach((juice) => {
			html += `- ${juice}<br>`;
		});

		// Other Drinks
		const selectedDrinks = Object.entries(completeHospoRider.other_drinks || {})
			.filter(([, item]) => item.selected)
			.map(([name, item]) => `${item.qty && item.qty > 1 ? `${item.qty}x ` : '1x '}${name}`);
		if (selectedDrinks.length > 0) {
			selectedDrinks.forEach((drink) => {
				html += `- ${drink}<br>`;
			});
		}

		// Base items
		if (completeHospoRider.base.regular_drinks) {
			html += '- Beers, RedBull, Water, Coconut water, Soft drinks<br>';
		}
		if (completeHospoRider.base.regular_snacks) {
			html += '- Snacks: Proteins bar, Nuts, Gum, Chips, Granola bar, etc.<br>';
		}

		// Custom requests
		if (completeHospoRider.custom_requests?.length > 0) {
			completeHospoRider.custom_requests.forEach((req) => {
				if (req.text.trim()) {
					html += `- ${req.text}<br>`;
				}
			});
		}

		// Custom rider text
		if (completeHospoRider.custom_rider_text?.trim()) {
			html += '<br>' + completeHospoRider.custom_rider_text.replace(/\n/g, '<br>') + '<br>';
		}

		return html;
	})();

	$: fullCopyHtml = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${hospoRiderHtml}</div>`;

	// --- EVENT HANDLERS ---
	async function handleCopyClick(e: MouseEvent) {
		e.stopPropagation();
		if (justCopied || !navigator.clipboard?.write) return;

		try {
			const htmlBlob = new Blob([fullCopyHtml], { type: 'text/html' });
			const textBlob = new Blob([hospoRiderCopyText], { type: 'text/plain' });
			const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
			await navigator.clipboard.write([clipboardItem]);

			justCopied = true;
			popupMessage = 'Copied to clipboard!';
			showPopup = true;
			setTimeout(() => {
				justCopied = false;
				showPopup = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	}

	function handleHospoUpdate(e: CustomEvent) {
		// Update the local event object with the new hospo_rider data
		if (event && e.detail?.updates?.hospo_rider) {
			event = { ...event, hospo_rider: e.detail.updates.hospo_rider };
		}
		// Refresh event data after modal saves
		dispatch('datachanged');
	}

	// Count selected items
	$: selectedCount = (() => {
		if (!completeHospoRider) return 0;

		let count = 0;

		// Count base items
		if (completeHospoRider.base?.regular_drinks) count++;
		if (completeHospoRider.base?.regular_snacks) count++;

		// Count selected spirits
		count += Object.values(completeHospoRider.spirits || {}).filter((item) => item.selected).length;

		// Count selected beers & juice
		count += Object.values(completeHospoRider.beers_wine?.beers || {}).filter(
			(item) => item.selected
		).length;
		count += Object.values(completeHospoRider.beers_wine?.juice || {}).filter(
			(item) => item.selected
		).length;
		count += Object.keys(completeHospoRider.beers_wine?.wine || {}).length;

		// Count selected other drinks
		count += Object.values(completeHospoRider.other_drinks || {}).filter(
			(item) => item.selected
		).length;

		// Count custom requests
		count += (completeHospoRider.custom_requests || []).filter((req) => req.text?.trim()).length;

		return count;
	})();
</script>

<PopupNotification bind:show={showPopup} message={popupMessage} variant="navbar" iconType="success" />

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300"
	style="width: 300px; height: 420px;"
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Hospitality</h2>
		<div class="flex items-center gap-2">
			{#if saving}
				<div class="flex-shrink-0">
					<div class="text-xs text-gray3 animate-pulse">Saving...</div>
				</div>
			{/if}
			{#if completeHospoRider}
				<span class="text-xs text-gray3">{selectedCount} items</span>
				<button
					on:click={handleCopyClick}
					class="p-2 text-gray2 hover:text-black rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
					class:hover:bg-lime={!justCopied}
					class:bg-lime={justCopied}
					class:text-black={justCopied}
					aria-label="Copy hospitality details"
					title={justCopied ? 'Copied!' : 'Copy hospitality details'}
				>
					{#if justCopied}
						<svg
							class="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							stroke-width="2.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<div class="px-6 py-4 h-full flex flex-col gap-4 overflow-y-auto">
		<div class="flex gap-2">
			<button
				on:click={() => (showHospoModal = true)}
				class="flex-1 text-xs bg-gray1 text-gray3 border border-transparent hover:bg-lime hover:text-black transition-colors py-2 rounded-2xl transition-all cursor-pointer"
			>
				Configure Rider
			</button>

			<button
				type="button"
				on:click={toggleRiderSentStatus}
				disabled={saving}
				class="flex-1 text-xs border border-transparent transition-colors py-2 rounded-2xl transition-all cursor-pointer {completeHospoRider?.rider_sent_to_mihir
					? 'bg-lime text-black font-bold'
					: 'bg-gray1 text-gray3 hover:text-black hover:bg-lime'}"
			>
				{completeHospoRider?.rider_sent_to_mihir ? 'Sent to Mihir' : 'Rider not sent'}
			</button>
		</div>

		{#if completeHospoRider && selectedCount > 0}
			<div class="space-y-2">
				{#if completeHospoRider.base.regular_drinks || completeHospoRider.base.regular_snacks}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-2">Base Items</h3>
						<div class="flex flex-wrap gap-1">
							{#if completeHospoRider.base.regular_drinks}
								<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full"
									>Regular Drinks</span
								>
							{/if}
							{#if completeHospoRider.base.regular_snacks}
								<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full"
									>Regular Snacks</span
								>
							{/if}
						</div>
					</div>
				{/if}

				{#if Object.values(completeHospoRider.spirits || {}).some((item) => item.selected)}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-2">Spirits</h3>
						<div class="flex flex-wrap gap-1">
							{#each Object.entries(completeHospoRider.spirits || {}) as [name, item]}
								{#if item.selected}
									<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full">
										{item.qty || 1}x {name}
									</span>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if Object.values(completeHospoRider.beers_wine?.beers || {}).some((item) => item.selected) || Object.keys(completeHospoRider.beers_wine?.wine || {}).length > 0 || Object.values(completeHospoRider.beers_wine?.juice || {}).some((item) => item.selected)}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-2">Beers, Wine & Juice</h3>
						<div class="flex flex-wrap gap-1">
							{#each Object.entries(completeHospoRider.beers_wine?.beers || {}) as [name, item]}
								{#if item.selected}
									<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full">
										{item.qty || 1}x {name}
									</span>
								{/if}
							{/each}
							{#each Object.entries(completeHospoRider.beers_wine?.juice || {}) as [name, item]}
								{#if item.selected}
									<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full">
										{item.qty || 1}x {name}
									</span>
								{/if}
							{/each}
							{#each Object.entries( (completeHospoRider.beers_wine?.wine || {}) as { [key: string]: HospoItem } ) as [name, item]}
								<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full">
									{item.qty || 1}x {name}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if Object.values(completeHospoRider.other_drinks || {}).some((item) => item.selected)}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-2">Other Drinks</h3>
						<div class="flex flex-wrap gap-1">
							{#each Object.entries(completeHospoRider.other_drinks || {}) as [name, item]}
								{#if item.selected}
									<span class="px-2 py-0.5 bg-gray1 text-gray-300 text-xs rounded-full">
										{item.qty || 1}x {name}
									</span>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if completeHospoRider.custom_requests?.length > 0}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-2">Custom Requests</h3>
						<div class="space-y-1">
							{#each completeHospoRider.custom_requests as req}
								{#if req.text.trim()}
									<div class="text-xs text-gray-300">• {req.text}</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if completeHospoRider.custom_rider_text?.trim()}
					<div>
						<h3 class="text-xs font-semibold text-gray3 mb-1">Custom Rider</h3>
						<div class="text-xs text-gray-300 whitespace-pre-wrap">
							{completeHospoRider.custom_rider_text}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center justify-center flex-1 text-gray3 text-sm">
				No hospitality rider configured
			</div>
		{/if}
	</div>
</div>

{#if showHospoModal}
	<div use:portal>
		<HospoRiderModal
			bind:isOpen={showHospoModal}
			{event}
			on:save_success={handleHospoUpdate}
			on:close={() => (showHospoModal = false)}
		/>
	</div>
{/if}

<style lang="postcss">
	@tailwind base;
	@tailwind components;
	@tailwind utilities;
</style>