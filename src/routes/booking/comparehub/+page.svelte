<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { supabase } from '$lib/supabase';
	
	// Components
	import EventsPanel from '$lib/components/marketing/comparehub/EventsPanel.svelte';
	import DropBox from '$lib/components/marketing/comparehub/DropBox.svelte';
	import PrevBox from '$lib/components/marketing/comparehub/PrevBox.svelte';
	import InfoBox from '$lib/components/marketing/comparehub/InfoBox.svelte';

	// Services & Types
	import { fetchEventSalesStats, fetchAggregateSalesStats, fetchSalesForDate, fetchAggregateSalesForDate } from '$lib/services/compareService';
	import { type CompareEventData, type SalesStats } from '$lib/types/compare';

	const COLUMN_MIN_WIDTH = '290px'; 

	let loading = true;
	let allEvents: CompareEventData[] = [];
	
	// Data
	let mainEvents: (CompareEventData | null)[] = [null, null, null];
	let compareEvents: CompareEventData[][] = [[], [], []];

	// Stats
	let mainStats: (SalesStats | null)[] = [null, null, null];
	let compareStats: (SalesStats | null)[] = [null, null, null];
	let mainTodayStats: (SalesStats | null)[] = [null, null, null];
	let compareTodayStats: (SalesStats | null)[] = [null, null, null];

	// Filter
	let currentFilter: 'LIVE' | 'PAST' = 'LIVE';
	let searchQuery = '';
	let referenceDateValue: string = new Date().toISOString().split('T')[0];
	let useCustomDate = false;

	// Computed
	$: availableEvents = allEvents.filter(e => {
		if (mainEvents.some(m => m && m.event_id === e.event_id)) return false;
		if (compareEvents.some(list => list.some(c => c.event_id === e.event_id))) return false;
		return true;
	});

	onMount(async () => {
		await loadEventsList();
		loading = false;
	});

	function formatEventDate(dateString: string): string {
		if (!dateString) return '';
		const d = new Date(dateString + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	async function loadEventsList() {
		const { data } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_status, event_flyer')
			.order('event_date', { ascending: false });

		if (data) {
			allEvents = data.map(e => ({
				event_id: e.event_id,
				name: e.event_name,
				event_date: e.event_date,
				status: (e.event_status || 'PAST') as 'LIVE' | 'PAST',
				flyer_url: e.event_flyer
			}));
		}
	}

	async function onMainDrop(index: number, event: CompareEventData) {
		mainEvents[index] = event;
		mainStats[index] = await fetchEventSalesStats(event.event_id);
		await updateColumnRefDateStats(index);
		if (compareEvents[index].length > 0) await loadComparisonData(index);
	}

	function removeMain(index: number) {
		mainEvents[index] = null;
		compareEvents[index] = [];
		mainStats[index] = null;
		compareStats[index] = null;
		mainTodayStats[index] = null;
		compareTodayStats[index] = null;
	}

	async function onCompareDrop(index: number, event: CompareEventData) {
		if (!mainEvents[index]) return;
		compareEvents[index] = [...compareEvents[index], event];
		await loadComparisonData(index);
	}

	async function removeCompare(index: number, eventId: number) {
		compareEvents[index] = compareEvents[index].filter(e => e.event_id !== eventId);
		if (compareEvents[index].length === 0) {
			compareStats[index] = null;
			compareTodayStats[index] = null;
		} else {
			await loadComparisonData(index);
		}
	}

	async function updateColumnRefDateStats(index: number) {
		const event = mainEvents[index];
		if (!event) return;
		const targetDate = new Date(referenceDateValue + 'T00:00:00');
		mainTodayStats[index] = await fetchSalesForDate(event.event_id, targetDate);
	}

	async function loadComparisonData(index: number) {
		const events = compareEvents[index];
		if (!events.length) return;
		const ids = events.map(e => e.event_id);
		
		// Fetch Aggregate (SUM)
		compareStats[index] = await fetchAggregateSalesStats(ids);
		
		const refDate = new Date(referenceDateValue + 'T00:00:00');
		const targetDate = new Date(refDate);
		targetDate.setFullYear(refDate.getFullYear() - 1);
		
		compareTodayStats[index] = await fetchAggregateSalesForDate(ids, targetDate);
	}

	async function handleDateChange(e: CustomEvent) {
		referenceDateValue = e.detail;
		for (let i = 0; i < 3; i++) {
			if (mainEvents[i]) {
				await updateColumnRefDateStats(i);
				if (compareEvents[i].length > 0) await loadComparisonData(i);
			}
		}
	}
</script>

<svelte:head>
	<title>Compare Hub</title>
</svelte:head>

<MainLayout pageTitle="Compare Hub">
	<div class="h-full w-full bg-gray1 text-white overflow-x-auto overflow-y-hidden custom-scrollbar">
		<div class="flex flex-row p-6 gap-6 h-full items-start min-w-min">
			<div class="flex gap-6 h-full">
				{#each [0, 1, 2] as i}
					<div 
						class="flex-1 flex flex-col gap-4" 
						style="min-width: {COLUMN_MIN_WIDTH}"
						in:fade={{ delay: i * 100 }}
					>
						<DropBox 
							boxIndex={i}
							eventData={mainEvents[i]}
							{formatEventDate}
							onDrop={(e) => onMainDrop(i, e)}
							onRemove={() => removeMain(i)}
						/>

						<div class="flex flex-col">
							<span class="text-[10px] font-bold text-gray2 ml-1 uppercase tracking-wide mb-1">Compare with (Previous Year)</span>
							<PrevBox 
								boxIndex={i}
								mainEventId={mainEvents[i]?.event_id || null}
								compareEvents={compareEvents[i]}
								onDrop={(e) => onCompareDrop(i, e)}
								onRemove={(id) => removeCompare(i, id)}
							/>
						</div>

						<InfoBox 
							mainStats={mainStats[i]}
							compareStats={compareStats[i]}
							mainTodayStats={mainTodayStats[i]}
							compareTodayStats={compareTodayStats[i]}
							compareCount={compareEvents[i].length}
						/>
					</div>
				{/each}
			</div>

			<div class="w-[340px] shrink-0 h-[760px]">
				<EventsPanel 
					events={availableEvents}
					bind:currentFilter
					bind:searchQuery
					bind:referenceDateValue
					bind:useCustomDate
					{formatEventDate}
					on:dateChange={handleDateChange}
				/>
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		height: 10px;
		width: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		border-radius: 5px;
		border: 2px solid var(--color-gray1);
		opacity: 0.5;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>