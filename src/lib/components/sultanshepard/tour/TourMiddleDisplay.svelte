<script lang="ts">
	import { onDestroy } from 'svelte';
	import type {
		SSTour,
		SSTourDate,
		SSTourData,
		SSCrew,
		TourDataTab,
		RidersSettings,
		MerchDefaultItem,
		TracklistTrack
	} from '$lib/types/tour';
	import { fetchTourData, saveTabData } from '$lib/services/tourService';
	import { tabsForType, tabProgress } from './tabs';
	import TourMapView from './TourMapView.svelte';
	import SectionCard from './ui/SectionCard.svelte';

	import EventDetailsSection from './sections/EventDetailsSection.svelte';
	import ShowBudgetSection from './sections/ShowBudgetSection.svelte';
	import VenueInfoSection from './sections/VenueInfoSection.svelte';
	import ProductionSection from './sections/ProductionSection.svelte';
	import SetListSection from './sections/SetListSection.svelte';
	import LogisticsSection from './sections/LogisticsSection.svelte';
	import MerchSection from './sections/MerchSection.svelte';
	import MediaSection from './sections/MediaSection.svelte';
	import ImmigrationSection from './sections/ImmigrationSection.svelte';
	import TodoSection from './sections/TodoSection.svelte';
	import NotesSection from './sections/NotesSection.svelte';
	import TravelDaySection from './sections/TravelDaySection.svelte';
	import TourBreakSection from './sections/TourBreakSection.svelte';
	import SimpleNotesSection from './sections/SimpleNotesSection.svelte';

	export let currentTour: SSTour | null = null;
	export let tourDates: SSTourDate[] = [];
	export let selectedDateId: string | null = null;
	export let crew: SSCrew[] = [];
	export let riders: RidersSettings | null = null;
	export let merchDefaults: MerchDefaultItem[] = [];
	export let tracklist: TracklistTrack[] = [];
	export let localCrewTemplate: { qty: number; role: string }[] = [];

	// shared with parent / tabs panel for progress rings + active state
	export let tourData: SSTourData | null = null;
	export let activeTabId: string | null = 'map';

	let loading = false;
	let savingTabs = new Set<TourDataTab>();
	let loadToken = 0;

	$: selectedDate = tourDates.find((d) => d.id === selectedDateId) || null;
	$: tabs = selectedDate ? tabsForType(selectedDate.type) : [];
	$: activeTab = tabs.find((t) => t.id === activeTabId) || null;

	// ---- load tab data when the selected date changes ----
	$: if (selectedDateId) handleDateChange(selectedDateId);
	$: if (!selectedDateId) {
		tourData = null;
		activeTabId = 'map';
	}

	function handleDateChange(dateId: string) {
		// if the active tab doesn't exist for the new date's type, fall back to map
		const date = tourDates.find((d) => d.id === dateId);
		const validTabs = date ? tabsForType(date.type).map((t) => t.id) : [];
		if (activeTabId !== 'map' && !validTabs.includes(activeTabId as TourDataTab)) {
			activeTabId = 'map';
		}
		loadData(dateId);
	}

	async function loadData(dateId: string) {
		const token = ++loadToken;
		loading = true;
		try {
			const fetched = await fetchTourData(dateId);
			if (token !== loadToken) return; // user switched again
			tourData = fetched;
		} catch (e) {
			console.error('Failed to load tour data', e);
			if (token === loadToken) tourData = null;
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	// ---- debounced autosave per tab ----
	const timers: Partial<Record<TourDataTab, ReturnType<typeof setTimeout>>> = {};

	function tabChanged(tab: TourDataTab) {
		if (!tourData) return;
		tourData = { ...tourData }; // trigger reactivity for progress rings + cross-tab links
		clearTimeout(timers[tab]);
		timers[tab] = setTimeout(() => flush(tab), 800);
	}

	async function flush(tab: TourDataTab) {
		if (!tourData || !selectedDateId) return;
		const dateId = selectedDateId;
		const payload = tourData[tab];
		savingTabs = new Set(savingTabs).add(tab);
		try {
			await saveTabData(dateId, tab, payload);
		} catch (e) {
			console.error(`Failed to save ${tab}`, e);
		} finally {
			savingTabs.delete(tab);
			savingTabs = new Set(savingTabs);
		}
	}

	onDestroy(() => {
		// flush anything pending so edits aren't lost when navigating away
		(Object.keys(timers) as TourDataTab[]).forEach((tab) => {
			clearTimeout(timers[tab]);
			flush(tab);
		});
	});

	// Called by +page.svelte when a tab is clicked in the right panel.
	// (Kept the name so the page wiring doesn't change — it now switches the view.)
	export function scrollTo(tabId: string) {
		activeTabId = tabId;
	}
</script>

<div class="flex flex-col flex-1 min-h-0 min-w-0 h-full">
	{#if !currentTour}
		<div class="flex-1 flex items-center justify-center bg-navbar rounded-2xl">
			<p class="text-gray2 font-bold uppercase tracking-widest text-xs">No Tour Selected</p>
		</div>
	{:else if activeTabId === 'map' || !selectedDate}
		<!-- MAP — fills the whole container -->
		<div class="flex-1 min-h-0 bg-navbar rounded-2xl overflow-hidden relative">
			{#key currentTour.id}
				<TourMapView {tourDates} bind:selectedDateId />
			{/key}
		</div>
	{:else if loading || !tourData}
		<div class="flex-1 flex flex-col bg-navbar rounded-2xl overflow-hidden">
			<div class="px-5 py-3 border-b border-gray1 flex items-center gap-3 shrink-0">
				<span class="text-sm font-black text-lime uppercase tracking-wider">{selectedDate.type}</span>
				<span class="text-sm text-white font-bold truncate">{selectedDate.venue || '—'}</span>
				<span class="text-xs text-gray2 ml-auto shrink-0">{selectedDate.date}</span>
			</div>
			<div class="flex-1 flex items-center justify-center">
				<p class="text-gray2 text-sm italic">
					{loading ? `Loading ${selectedDate.venue || selectedDate.date}…` : 'No data'}
				</p>
			</div>
		</div>
	{:else if activeTab}
		<!-- SINGLE SECTION — fills the whole container, scrolls internally -->
		<div class="flex flex-col flex-1 min-h-0 gap-3">
			<!-- date header -->
			<div class="bg-navbar rounded-2xl px-5 py-3 flex items-center gap-3 shrink-0">
				<span class="text-sm font-black text-lime uppercase tracking-wider">{selectedDate.type}</span>
				<span class="text-sm text-white font-bold truncate">{selectedDate.venue || '—'}</span>
				<span class="text-xs text-gray2 ml-auto shrink-0">{selectedDate.date}</span>
			</div>

			{#key selectedDate.id + activeTab.id}
				<div class="flex-1 min-h-0">
					<SectionCard
						id="card-{activeTab.id}"
						title={activeTab.label}
						icon={activeTab.icon}
						restricted={activeTab.restricted}
						progress={tabProgress(activeTab.id, tourData, crew)}
						saving={savingTabs.has(activeTab.id)}
					>
						{#if activeTab.id === 'event_details'}
							<EventDetailsSection
								bind:data={tourData.event_details}
								{crew}
								tourDate={selectedDate}
								on:change={() => tabChanged('event_details')}
							/>
						{:else if activeTab.id === 'show_budget'}
							<ShowBudgetSection bind:data={tourData.show_budget} {tourData} {crew} on:change={() => tabChanged('show_budget')} />
						{:else if activeTab.id === 'venue_info'}
							<VenueInfoSection bind:data={tourData.venue_info} {tourData} {crew} on:change={() => tabChanged('venue_info')} />
						{:else if activeTab.id === 'production'}
							<ProductionSection bind:data={tourData.production} {localCrewTemplate} on:change={() => tabChanged('production')} />
						{:else if activeTab.id === 'set_list'}
							<SetListSection bind:data={tourData.set_list} {tracklist} on:change={() => tabChanged('set_list')} />
						{:else if activeTab.id === 'logistics'}
							<LogisticsSection bind:data={tourData.logistics} {tourData} {crew} {riders} on:change={() => tabChanged('logistics')} />
						{:else if activeTab.id === 'merch'}
							<MerchSection bind:data={tourData.merch} {merchDefaults} on:change={() => tabChanged('merch')} />
						{:else if activeTab.id === 'media'}
							<MediaSection bind:data={tourData.media} {tourData} tourDate={selectedDate} on:change={() => tabChanged('media')} />
						{:else if activeTab.id === 'immigration'}
							<ImmigrationSection bind:data={tourData.immigration} {tourData} {crew} on:change={() => tabChanged('immigration')} />
						{:else if activeTab.id === 'todos'}
							<TodoSection bind:data={tourData.todos} on:change={() => tabChanged('todos')} />
						{:else if activeTab.id === 'notes'}
							<NotesSection bind:data={tourData.notes} on:change={() => tabChanged('notes')} />
						{:else if activeTab.id === 'travel'}
							<TravelDaySection bind:data={tourData.travel} {crew} tourDate={selectedDate} on:change={() => tabChanged('travel')} />
						{:else if activeTab.id === 'break_info'}
							<TourBreakSection bind:data={tourData.break_info} on:change={() => tabChanged('break_info')} />
						{:else if activeTab.id === 'pickup_info'}
							<SimpleNotesSection
								bind:data={tourData.pickup_info}
								placeholder="{selectedDate.type} instructions, address details, contact…"
								on:change={() => tabChanged('pickup_info')}
							/>
						{:else if activeTab.id === 'custom_info'}
							<SimpleNotesSection
								bind:data={tourData.custom_info}
								placeholder="What is happening on this day?"
								on:change={() => tabChanged('custom_info')}
							/>
						{/if}
					</SectionCard>
				</div>
			{/key}
		</div>
	{/if}
</div>