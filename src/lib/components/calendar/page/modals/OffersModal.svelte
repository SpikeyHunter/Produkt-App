<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';

	export let isOpen = false;
	export let event: any = null; // <-- ADD THIS
	export let eventDealData: any = {}; // <-- ADD THIS

	const dispatch = createEventDispatcher();
	let saving = false;
	let settingId: string | null = null;

	// Setting State
	let useCustomRate = false;
	let customRate: number | null = 1.3832;

	// FX offer markup: a buffer added on top of the FX rate when generating an
	// offer sheet (event-level). Defaults to 5%, optionally 10%.
	let fxMarkupEnabled = true;
	let fxMarkupPercent: 5 | 10 = 5;
	const fxMarkupOptions: (5 | 10)[] = [5, 10];

	$: if (isOpen) {
		loadSettings();
	}

	async function loadSettings() {
		// Read directly from the passed-in event_deal data
		useCustomRate = eventDealData?.useCustomRate === true;
		customRate = eventDealData?.customRate || 1.3832;

		// Default ON at 5% for events that have never saved the setting.
		fxMarkupEnabled = eventDealData?.fxMarkupEnabled !== false;
		fxMarkupPercent = eventDealData?.fxMarkupPercent === 10 ? 10 : 5;
	}

	async function saveSettings() {
		saving = true;

		const targetId = event?.calendar?.id || event?.group_id || event?.id;
		const currentVersion = event?.calendar?.current_version || 1;

		// 1. SAFELY PARSE THE DATA FIRST
		let parsedData = {};
		if (typeof eventDealData === 'string') {
			try {
				parsedData = JSON.parse(eventDealData);
			} catch (e) {}
		} else {
			parsedData = eventDealData || {};
		}

		// 2. SPREAD THE PARSED OBJECT
		const updatedDealData = {
			...parsedData,
			useCustomRate,
			customRate,
			fxMarkupEnabled,
			fxMarkupPercent
		};

		if (targetId) {
			const { error } = await supabase
				.from('calendar_data')
				.update({ event_deal: updatedDealData })
				.eq('calendar_id', targetId)
				.eq('version_number', currentVersion);

			if (!error) {
				dispatch('success', updatedDealData);
				isOpen = false;
			} else {
				console.error('Failed to save exchange rate settings:', error);
			}
		}
		saving = false;
	}
</script>

{#if isOpen}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="p-6 border-b border-gray2/10 flex justify-between items-center">
				<h2 class="text-2xl font-bold text-white tracking-wide">Settings</h2>
				<button
					type="button"
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="p-8 space-y-8 flex-1">
				<div>
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-[15px] font-bold text-white">Custom Exchange Rate</span>

							<button
								type="button"
								aria-label="Toggle Custom Exchange Rate"
								aria-pressed={useCustomRate}
								class="w-11 h-6 rounded-full relative transition-colors duration-200 ease-in-out cursor-pointer flex items-center px-1 {useCustomRate
									? 'bg-lime'
									: 'bg-gray1'}"
								on:click={() => (useCustomRate = !useCustomRate)}
							>
								<div
									class="w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out {useCustomRate
										? 'translate-x-5 bg-black'
										: 'translate-x-0 bg-gray2'}"
								></div>
							</button>
						</div>

						<div
							class="transition-all duration-200 {useCustomRate
								? 'opacity-100'
								: 'opacity-40 pointer-events-none'}"
						>
							<label
								for="exchangeRate"
								class="block text-[11px] font-bold text-gray2 mb-2 ml-1 uppercase tracking-widest"
							>
								Exchange Rate (USD > CAD)
							</label>
							<input
								id="exchangeRate"
								type="number"
								step="0.0001"
								min="0"
								bind:value={customRate}
								disabled={!useCustomRate}
								class="w-full bg-gray1 rounded-3xl px-4 py-3 text-[15px] font-bold text-white placeholder-gray2 focus:outline-none transition-colors hide-arrows"
							/>
						</div>

						<div class="ml-1">
							{#if useCustomRate}
								<p class="text-[13px] text-lime font-bold">
									You're currently using a custom exchange rate USD > CAD of {customRate || '0.00'}
								</p>
							{:else}
								<p class="text-[13px] text-gray2 font-bold">
									You're currently using today's exchange rate USD > CAD
								</p>
							{/if}
						</div>
					</div>
				</div>

				<div class="border-t border-gray2/10 pt-8">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-[15px] font-bold text-white">FX Offer Markup</span>

							<button
								type="button"
								aria-label="Toggle FX Offer Markup"
								aria-pressed={fxMarkupEnabled}
								class="w-11 h-6 rounded-full relative transition-colors duration-200 ease-in-out cursor-pointer flex items-center px-1 {fxMarkupEnabled
									? 'bg-lime'
									: 'bg-gray1'}"
								on:click={() => (fxMarkupEnabled = !fxMarkupEnabled)}
							>
								<div
									class="w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out {fxMarkupEnabled
										? 'translate-x-5 bg-black'
										: 'translate-x-0 bg-gray2'}"
								></div>
							</button>
						</div>

						<div
							class="transition-all duration-200 {fxMarkupEnabled
								? 'opacity-100'
								: 'opacity-40 pointer-events-none'}"
						>
							<span
								class="block text-[11px] font-bold text-gray2 mb-2 ml-1 uppercase tracking-widest"
							>
								Markup Added to FX Rate
							</span>
							<div class="grid grid-cols-2 gap-3">
								{#each fxMarkupOptions as pct (pct)}
									<button
										type="button"
										disabled={!fxMarkupEnabled}
										class="py-3 rounded-3xl text-[15px] font-black transition-colors cursor-pointer {fxMarkupPercent ===
										pct
											? 'bg-lime text-black'
											: 'bg-gray1 text-gray2 hover:text-white'}"
										on:click={() => (fxMarkupPercent = pct)}
									>
										+{pct}%
									</button>
								{/each}
							</div>
						</div>

						<div class="ml-1">
							{#if fxMarkupEnabled}
								<p class="text-[13px] text-lime font-bold">
									A {fxMarkupPercent}% buffer is added to the FX rate when an offer sheet is
									generated.
								</p>
							{:else}
								<p class="text-[13px] text-gray2 font-bold">
									Offers use the raw FX rate with no markup.
								</p>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="p-6 flex gap-4 justify-end">
				<button
					type="button"
					class="py-3 px-8 bg-gray3 text-black hover:bg-white font-bold text-[15px] rounded-full transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="py-3 px-8 font-black text-[15px] rounded-full transition-colors bg-lime text-black hover:opacity-80 cursor-pointer"
					on:click={saveSettings}
					disabled={saving}
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Hide number input arrows completely */
	.hide-arrows::-webkit-outer-spin-button,
	.hide-arrows::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.hide-arrows {
		appearance: textfield;
		-moz-appearance: textfield;
		-webkit-appearance: none;
	}
</style>
