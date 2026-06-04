<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { supabase } from '$lib/supabase';
	import type { DailyCount, EventData } from '$lib/types/dailycount';

	// FIX: Removed `resolveColorCollisions` from imports so it stops overriding database colors!
	import { extractDominantColor } from '$lib/utils/color';

	import Header from '$lib/components/marketing/dailycount/Header.svelte';
	import ControlPanel from '$lib/components/marketing/dailycount/ControlPanel.svelte';
	import DailyChart from '$lib/components/marketing/dailycount/DailyChart.svelte';

	let allEvents: EventData[] = [];
	let dailyCounts: DailyCount[] = [];
	let fullDateRange: string[] = [];
	let dateRange: string[] = [];

	// Sub-filtered range passed to the chart
	let mode: 'LIVE' | 'CUSTOM' = 'LIVE';
	let selectedCustomIds: number[] = [];

	let realtimeChannel: any;
	let selectedEventForInfo: EventData | null = null;
	let latestCountForSelected: DailyCount | null = null;

	// Filter dates
	let filterStartDate = '';
	let filterEndDate = '';
	const excludeKeywords = [
		'test',
		'réservations',
		'pass',
		'event',
		'template',
		'produktworld',
		'piknic',
		'oktoberfest',
		'race week'
	];

	$: eventsWithData = allEvents.filter((e) => {
		const countsForEvent = dailyCounts.filter((c) => c.event_id === e.event_id);
		if (countsForEvent.length === 0) return false;
		const latest = countsForEvent[countsForEvent.length - 1];
		return latest.total >= 0;
	});

	$: activeEvents =
		mode === 'LIVE'
			? eventsWithData.filter((e) => e.event_status === 'LIVE' || e.pinned)
			: eventsWithData.filter((e) => selectedCustomIds.includes(e.event_id) || e.pinned);

	$: {
		const activeCounts = dailyCounts.filter((c) =>
			activeEvents.some((e) => e.event_id === c.event_id)
		);
		calculateDateRange(activeCounts);
	}

	$: minAvailableDate = fullDateRange.length > 0 ? fullDateRange[0] : '';
	$: maxAvailableDate = fullDateRange.length > 0 ? fullDateRange[fullDateRange.length - 1] : '';

	$: {
		if (filterStartDate && filterEndDate) {
			dateRange = fullDateRange.filter((d) => d >= filterStartDate && d <= filterEndDate);
		} else {
			dateRange = fullDateRange;
		}
	}

	$: if (selectedEventForInfo) {
		const counts = dailyCounts.filter((c) => c.event_id === selectedEventForInfo!.event_id);
		latestCountForSelected = counts.length > 0 ? counts[counts.length - 1] : null;
	}

	onMount(async () => {
		await loadData();
		setupRealtime();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
	});

	async function loadData() {
		console.log('[+page.svelte] Fetching events from database on load...');

		const { data: eventData, error: eventError } = await supabase
			.from('events')
			.select(
				'event_id, event_name, event_date, event_status, event_flyer, event_venue, stage_type, color, pinned'
			);

		if (eventError) {
			console.error('[+page.svelte] Failed to fetch events:', eventError);
		}

		const { data: countData } = await supabase
			.from('daily_count')
			.select('*')
			.order('report_date', { ascending: true });

		if (countData) dailyCounts = countData as DailyCount[];

		if (eventData) {
			const validEvents = eventData.filter((e) => {
				if (e.pinned) return true; // ALWAYS keep pinned events

				const nameLower = e.event_name.toLowerCase();
				return !excludeKeywords.some((kw) => nameLower.includes(kw));
			});

			const eventsWithColors = await Promise.all(
				validEvents.map(async (e) => {
					let finalColor = e.color ? e.color.trim() : null;

					if (!finalColor || finalColor === '') {
						if (e.event_flyer) finalColor = await extractDominantColor(e.event_flyer);
						else finalColor = '#00FFFF';

						await supabase.from('events').update({ color: finalColor }).eq('event_id', e.event_id);
					}
					return { ...e, color: finalColor } as EventData;
				})
			);

			console.log('[+page.svelte] Successfully mapped colors on load.');
			allEvents = eventsWithColors;
		}
	}

	function calculateDateRange(counts: DailyCount[]) {
		if (counts.length === 0) {
			fullDateRange = [];
			return;
		}
		const dates = counts.map((c) => new Date(c.report_date).getTime());
		const minDate = new Date(Math.min(...dates));
		const maxDate = new Date(Math.max(...dates));

		const range = [];
		let current = new Date(minDate);

		while (current <= maxDate) {
			range.push(current.toISOString().split('T')[0]);
			current.setDate(current.getDate() + 1);
		}
		fullDateRange = range;
	}

	function setupRealtime() {
		realtimeChannel = supabase
			.channel('daily_count_updates')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_count' }, async () => {
				const { data } = await supabase
					.from('daily_count')
					.select('*')
					.order('report_date', { ascending: true });
				if (data) dailyCounts = data as DailyCount[];
			})
			.subscribe();
	}

	function handleSelectionChange(e: CustomEvent<number[]>) {
		selectedCustomIds = e.detail;
	}

	function handleEventClicked(e: CustomEvent<EventData>) {
		selectedEventForInfo = e.detail;
	}

	function handleDateRangeChanged(e: CustomEvent<{ startDate: string; endDate: string }>) {
		filterStartDate = e.detail.startDate;
		filterEndDate = e.detail.endDate;
	}

	async function handlePinToggle(e: CustomEvent<{ id: number; pinned: boolean }>) {
		const { id, pinned } = e.detail;

		// 1. Update UI instantly
		allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, pinned } : ev));

		if (selectedEventForInfo && selectedEventForInfo.event_id === id) {
			selectedEventForInfo = { ...selectedEventForInfo, pinned };
		}

		// 2. Save to database
		const { error } = await supabase.from('events').update({ pinned }).eq('event_id', id);

		if (error) {
			console.error('[+page.svelte] Failed to toggle pin:', error.message);
			alert(`Failed to pin event: ${error.message}`);
			// Revert if it failed
			allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, pinned: !pinned } : ev));
		}
	}

	async function handleColorChange(e: CustomEvent<{ id: number; color: string }>) {
		const { id, color } = e.detail;

		allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, color } : ev));

		if (selectedEventForInfo && selectedEventForInfo.event_id === id) {
			selectedEventForInfo = { ...selectedEventForInfo, color };
		}

		const { data, error } = await supabase
			.from('events')
			.update({ color: color })
			.eq('event_id', id)
			.select();

		if (error) {
			console.error('[+page.svelte] Supabase Error:', error.message);
			alert(`Database error: ${error.message}`);
		} else if (!data || data.length === 0) {
			console.warn(`[+page.svelte] WARNING: Supabase returned no errors, but 0 rows were updated.`);
			alert(
				`Update failed silently! Check if Event ID ${id} exists, or if your Supabase Row-Level Security (RLS) policies are blocking UPDATE actions.`
			);
		}
	}

	async function handleStageTypeChange(e: CustomEvent<{ id: number; stage_type: any }>) {
		const { id, stage_type } = e.detail;
		allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, stage_type } : ev));

		if (selectedEventForInfo && selectedEventForInfo.event_id === id) {
			selectedEventForInfo = { ...selectedEventForInfo, stage_type };
		}

		await supabase.from('events').update({ stage_type }).eq('event_id', id);
	}
</script>

<svelte:head>
	<title>Daily Count</title>
</svelte:head>

<MainLayout pageTitle="Daily Count">
	<div class="h-full w-full bg-gray1 text-white overflow-x-hidden flex flex-col p-6">
		<Header />

		<div class="flex gap-6 h-full flex-1 min-h-0 overflow-hidden">
			<DailyChart
				{dailyCounts}
				{activeEvents}
				{dateRange}
				on:eventClicked={handleEventClicked}
				on:unselectEvent={() => (selectedEventForInfo = null)}
			/>

			<ControlPanel
				events={eventsWithData}
				{activeEvents}
				{dailyCounts}
				bind:mode
				bind:selectedCustomIds
				{selectedEventForInfo}
				{latestCountForSelected}
				{minAvailableDate}
				{maxAvailableDate}
				on:selectionChanged={handleSelectionChange}
				on:closeInfoPanel={() => (selectedEventForInfo = null)}
				on:colorChanged={handleColorChange}
				on:stageTypeChanged={handleStageTypeChange}
				on:dateRangeFilterChanged={handleDateRangeChanged}
				on:pinToggled={handlePinToggle}
			/>
		</div>
	</div>
</MainLayout>
