<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import TemplatesManager from './modals/TemplatesManager.svelte';
	import {
		getOfferEventDefaults,
		saveOfferEventDefaults
	} from '$lib/services/templateService';
	import {
		getCachedDealPayload,
		setCachedDealPayload
	} from '$lib/components/calendar/page/tabs/deals/eventDealCache';

	// Full-page settings view rendered in place of the tab content (opened via
	// the gear icon). Header: back + title; tabs: Settings / Templates / Event
	// Details. Fixed-height container so it never resizes with its content.
	export let event: any = null;
	export let eventDealData: any = {};
	export let viewedVersionNum: number = 1;

	const dispatch = createEventDispatcher();

	export let activeTab: 'settings' | 'templates' = 'settings';
	// Which Templates section opens first (set when jumping in from Costs tab).
	export let templatesInitialSection: 'text' | 'event' = 'text';

	// ---- Exchange rate / FX markup (event-level, stored in event_deal) ----
	let useCustomRate = false;
	let customRate: number | null = 1.3832; // Offer Rate
	let customSettlementRate: number | null = 1.3832; // Settlement Rate
	// Settlement Rate mirrors the Offer Rate until the user edits it directly.
	let settlementRateTouched = false;
	let fxMarkupEnabled = true;
	let fxMarkupPercent: 5 | 10 = 5;
	const fxMarkupOptions: (5 | 10)[] = [5, 10];
	let saving = false;
	let statusText = '';

	function parseDeal(raw: any): any {
		if (!raw) return {};
		if (typeof raw === 'object') return raw;
		try {
			let p = JSON.parse(raw);
			if (typeof p === 'string') p = JSON.parse(p);
			return p;
		} catch {
			return {};
		}
	}

	$: targetId = event?.calendar?.id || event?.group_id || event?.id;

	// Prefer this session's latest payload over the page-load snapshot.
	const initial = parseDeal(getCachedDealPayload(event, viewedVersionNum) ?? eventDealData);
	useCustomRate = initial?.useCustomRate === true;
	customRate = initial?.customRate || 1.3832;
	customSettlementRate = initial?.customSettlementRate || initial?.customRate || 1.3832;
	settlementRateTouched =
		initial?.customSettlementRate != null &&
		Number(initial.customSettlementRate) !== Number(initial.customRate);
	fxMarkupEnabled = initial?.fxMarkupEnabled !== false;
	fxMarkupPercent = initial?.fxMarkupPercent === 10 ? 10 : 5;

	// ---- Unsaved-changes guard ----
	let savedSnapshot = JSON.stringify({
		useCustomRate,
		customRate,
		customSettlementRate,
		fxMarkupEnabled,
		fxMarkupPercent
	});
	let savedAgeLimit: string | null = null; // set once defaults load
	let savedExpiryDays: number | null = null;
	let showLeaveModal = false;
	let leavingSave = false;

	$: settingsDirty =
		JSON.stringify({
			useCustomRate,
			customRate,
			customSettlementRate,
			fxMarkupEnabled,
			fxMarkupPercent
		}) !== savedSnapshot;
	$: detailsDirty =
		detailsLoaded &&
		savedAgeLimit !== null &&
		(ageLimit !== savedAgeLimit || offerExpiryDays !== savedExpiryDays);
	// Templates tab editor state (bound up from TemplatesManager).
	let templatesRef: any = null;
	let templatesDirty = false;

	$: isDirty = settingsDirty || detailsDirty || templatesDirty;

	export function requestClose() {
		if (isDirty) {
			showLeaveModal = true;
			return;
		}
		dispatch('close');
	}

	async function saveAndLeave() {
		if (leavingSave) return;
		leavingSave = true;
		try {
			if (settingsDirty) await saveSettings();
			if (detailsDirty) await saveEventDetails();
			if (templatesDirty) await templatesRef?.saveCurrent?.();
		} finally {
			leavingSave = false;
			showLeaveModal = false;
			dispatch('close');
		}
	}

	async function saveSettings() {
		if (saving || !targetId) return;
		saving = true;
		statusText = '';
		try {
			// Read-merge-write against the live payload so deals are never lost.
			const cached = getCachedDealPayload(event, viewedVersionNum);
			let payload = parseDeal(cached);
			if (!cached) {
				const { data } = await supabase
					.from('calendar_data')
					.select('event_deal')
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum)
					.maybeSingle();
				payload = parseDeal(data?.event_deal);
			}
			payload = {
				...payload,
				useCustomRate,
				customRate,
				customSettlementRate,
				fxMarkupEnabled,
				fxMarkupPercent
			};

			const { error } = await supabase
				.from('calendar_data')
				.update({ event_deal: payload })
				.eq('calendar_id', targetId)
				.eq('version_number', viewedVersionNum);
			if (error) throw error;

			setCachedDealPayload(event, viewedVersionNum, payload);
			if (event?.calendar_data) event.calendar_data.event_deal = payload;
			savedSnapshot = JSON.stringify({
				useCustomRate,
				customRate,
				customSettlementRate,
				fxMarkupEnabled,
				fxMarkupPercent
			});
			statusText = 'Saved';
		} catch (err) {
			console.error('Failed to save exchange rate settings:', err);
			statusText = 'Save failed';
		} finally {
			saving = false;
		}
	}

	// ---- Event details defaults (Age Limit) ----
	let ageLimit = '18+';
	let offerExpiryDays = 14;
	let savingDetails = false;
	let detailsLoaded = false;
	let detailsStatus = '';

	getOfferEventDefaults().then((d) => {
		ageLimit = d.ageLimit;
		offerExpiryDays = d.offerExpiryDays;
		savedAgeLimit = d.ageLimit;
		savedExpiryDays = d.offerExpiryDays;
		detailsLoaded = true;
	});

	async function saveEventDetails() {
		if (savingDetails) return;
		savingDetails = true;
		detailsStatus = '';
		const ok = await saveOfferEventDefaults({ ageLimit, offerExpiryDays });
		if (ok) {
			savedAgeLimit = ageLimit;
			savedExpiryDays = offerExpiryDays;
		}
		detailsStatus = ok ? 'Saved' : 'Save failed';
		savingDetails = false;
	}

	// Single Save for the merged Settings tab (rate + markup + event details).
	async function saveAll() {
		await saveSettings();
		if (detailsLoaded) await saveEventDetails();
		if (statusText === 'Saved' && detailsStatus !== 'Save failed') statusText = 'Saved';
	}
</script>

<div class="flex-1 flex flex-col min-h-0 bg-navbar">
	<!-- Content: fixed area, scrolls internally so the view never resizes -->
	<div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
		{#if activeTab === 'settings'}
			<div class="max-w-5xl">
				<div class="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-6 [&>div]:max-w-xl">
					<!-- Column 1: exchange rate -->
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

						<div class="transition-opacity duration-200 {useCustomRate ? 'opacity-100' : 'opacity-40 pointer-events-none'}">
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="exchangeRate" class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">
										Offer Rate
									</label>
									<input
										id="exchangeRate"
										type="number"
										step="0.0001"
										min="0"
										bind:value={customRate}
										disabled={!useCustomRate}
										on:input={() => {
											if (!settlementRateTouched) customSettlementRate = customRate;
										}}
										class="w-full bg-gray1 rounded-3xl px-4 py-2.5 text-[15px] font-bold text-white placeholder-gray2 focus:outline-none"
									/>
								</div>
								<div>
									<label for="settlementRate" class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">
										Settlement Rate
									</label>
									<input
										id="settlementRate"
										type="number"
										step="0.0001"
										min="0"
										bind:value={customSettlementRate}
										disabled={!useCustomRate}
										on:input={() => (settlementRateTouched = true)}
										class="w-full bg-gray1 rounded-3xl px-4 py-2.5 text-[15px] font-bold text-white placeholder-gray2 focus:outline-none"
									/>
								</div>
							</div>
						</div>

						<p class="text-[12px] font-bold ml-1 min-h-[18px] {useCustomRate ? 'text-lime' : 'text-gray2'}">
							{useCustomRate
								? `Offers use ${customRate || '0.00'} · settlements use ${customSettlementRate || '0.00'}`
								: "Using today's exchange rate — the rate actually used is saved on each generated offer and settlement"}
						</p>
						{#if useCustomRate && !settlementRateTouched}
							<p class="text-[11px] text-gray2 font-bold ml-1">
								The Settlement Rate copies the Offer Rate until you edit it.
							</p>
						{/if}
					</div>

					<!-- Column 2: FX markup + Age Limit under it -->
					<div class="space-y-6">
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

							<div class="transition-opacity duration-200 {fxMarkupEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}">
								<div class="grid grid-cols-2 gap-3">
									{#each fxMarkupOptions as pct (pct)}
										<button
											type="button"
											disabled={!fxMarkupEnabled}
											class="py-2.5 rounded-3xl text-[15px] font-black transition-colors cursor-pointer {fxMarkupPercent === pct
												? 'bg-lime text-black'
												: 'bg-gray1 text-gray2 hover:text-white'}"
											on:click={() => (fxMarkupPercent = pct)}
										>
											+{pct}%
										</button>
									{/each}
								</div>
							</div>

							<p class="text-[12px] font-bold ml-1 min-h-[18px] {fxMarkupEnabled ? 'text-lime' : 'text-gray2'}">
								{fxMarkupEnabled
									? `A ${fxMarkupPercent}% buffer is added to the FX rate on offer sheets.`
									: 'Offers use the raw FX rate with no markup.'}
							</p>
						</div>

						<div class="space-y-2">
							<span class="text-[15px] font-bold text-white block">Age Limit</span>
							<input
								id="ageLimit"
								type="text"
								bind:value={ageLimit}
								placeholder="18+"
								disabled={!detailsLoaded}
								class="w-full bg-gray1 rounded-3xl px-4 py-2.5 text-[15px] font-bold text-white placeholder-gray2 focus:outline-none"
							/>
							<p class="text-[12px] text-gray2 font-bold ml-1 min-h-[18px]">
								Shown in the Event Details section of every offer sheet.
							</p>
						</div>

						<div class="space-y-2">
							<span class="text-[15px] font-bold text-white block">Offers Expiring Time</span>
							<input
								id="offerExpiryDays"
								type="number"
								min="1"
								bind:value={offerExpiryDays}
								placeholder="14"
								disabled={!detailsLoaded}
								class="w-full bg-gray1 rounded-3xl px-4 py-2.5 text-[15px] font-bold text-white placeholder-gray2 focus:outline-none"
							/>
							<p class="text-[12px] text-gray2 font-bold ml-1 min-h-[18px]">
								Days before an offer expires — "OFFER EXPIRES {offerExpiryDays || 14} CALENDAR DAYS
								FROM "OFFER SENT" DATE."
							</p>
						</div>
					</div>
				</div>

				<div class="flex items-center gap-4 justify-end pt-4 max-w-5xl">
					<span class="text-xs font-bold min-w-[70px] text-right {statusText === 'Saved' && detailsStatus !== 'Save failed'
						? 'text-lime'
						: 'text-problem'}">{detailsStatus === 'Save failed' ? 'Save failed' : statusText}</span>
					<button
						type="button"
						class="py-2.5 px-8 font-black text-[15px] rounded-full transition-colors bg-lime text-black hover:opacity-80 cursor-pointer disabled:opacity-50"
						on:click={saveAll}
						disabled={saving || savingDetails}
					>
						{saving || savingDetails ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		{:else if activeTab === 'templates'}
			<div class="max-w-6xl">
				<TemplatesManager
					initialSection={templatesInitialSection}
					bind:this={templatesRef}
					bind:dirtyOut={templatesDirty}
				/>
			</div>
		{/if}
	</div>
</div>

{#if showLeaveModal}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-navbar rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="p-8 text-center">
				<div class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-5">
					<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
						<line x1="12" y1="9" x2="12" y2="13"></line>
						<line x1="12" y1="17" x2="12.01" y2="17"></line>
					</svg>
				</div>
				<h3 class="text-xl font-black text-white mb-2 tracking-wide">Unsaved Changes</h3>
				<p class="text-gray2 text-sm font-bold leading-relaxed">
					Are you sure you wanna leave without saving?
				</p>
			</div>
			<div class="p-6 flex gap-3 justify-center bg-black/20">
				<button
					type="button"
					class="px-5 py-3 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
					on:click={() => (showLeaveModal = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-5 py-3 bg-gray1 text-problem text-sm font-bold rounded-full hover:bg-problem/10 transition-colors cursor-pointer whitespace-nowrap"
					on:click={() => {
						showLeaveModal = false;
						dispatch('close');
					}}
				>
					Leave Anyway
				</button>
				<button
					type="button"
					disabled={leavingSave}
					class="px-5 py-3 bg-lime text-black text-sm font-black rounded-full hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap disabled:opacity-50"
					on:click={saveAndLeave}
				>
					{leavingSave ? 'Saving...' : 'Save Now'}
				</button>
			</div>
		</div>
	</div>
{/if}
