<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { supabase } from '$lib/supabase';
	import type { DailyCount, EventData } from '$lib/types/dailycount';
	import { extractDominantColor, resolveColorCollisions } from '$lib/utils/color';

	import Header from '$lib/components/booking/dailycount/Header.svelte';
	import ControlPanel from '$lib/components/booking/dailycount/ControlPanel.svelte';
	import DailyChart from '$lib/components/booking/dailycount/DailyChart.svelte';

	let allEvents: EventData[] = [];
	let dailyCounts: DailyCount[] = [];
	let dateRange: string[] = [];
	let mode: 'LIVE' | 'CUSTOM' = 'LIVE';
	let selectedCustomIds: number[] = [];
	let realtimeChannel: any;
	let selectedEventForInfo: EventData | null = null;
	let latestCountForSelected: DailyCount | null = null;

	const excludeKeywords = [
		'test',
		'réservations',
		'pass',
		'event',
		'template',
		'produktworld',
		'piknic',
		'oktoberfest'
	];

	$: eventsWithData = allEvents.filter((e) => {
		const countsForEvent = dailyCounts.filter((c) => c.event_id === e.event_id);
		if (countsForEvent.length === 0) return false;
		const latest = countsForEvent[countsForEvent.length - 1];
		return latest.total > 0;
	});

	$: activeEvents =
		mode === 'LIVE'
			? eventsWithData.filter((e) => e.event_status === 'LIVE')
			: eventsWithData.filter((e) => selectedCustomIds.includes(e.event_id));

	$: {
		const activeCounts = dailyCounts.filter((c) =>
			activeEvents.some((e) => e.event_id === c.event_id)
		);
		calculateDateRange(activeCounts);
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
		const { data: eventData } = await supabase
			.from('events')
			.select(
				'event_id, event_name, event_date, event_status, event_flyer, event_venue, stage_type, color'
			);

		const { data: countData } = await supabase
			.from('daily_count')
			.select('*')
			.order('report_date', { ascending: true });

		if (countData) dailyCounts = countData as DailyCount[];

		if (eventData) {
			const validEvents = eventData.filter((e) => {
				const nameLower = e.event_name.toLowerCase();
				return !excludeKeywords.some((kw) => nameLower.includes(kw));
			});

			const eventsWithColors = await Promise.all(
				validEvents.map(async (e) => {
					let finalColor = e.color;

					if (!finalColor) {
						if (e.event_flyer) finalColor = await extractDominantColor(e.event_flyer);
						else finalColor = '#00FFFF';

						await supabase.from('events').update({ color: finalColor }).eq('event_id', e.event_id);
					}
					return { ...e, color: finalColor } as EventData;
				})
			);

			allEvents = resolveColorCollisions(eventsWithColors);
		}
	}

	function calculateDateRange(counts: DailyCount[]) {
		if (counts.length === 0) {
			dateRange = [];
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
		dateRange = range;
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

	async function handleColorChange(e: CustomEvent<{ id: number; color: string }>) {
		const { id, color } = e.detail;
		allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, color } : ev));

		if (selectedEventForInfo && selectedEventForInfo.event_id === id) {
			selectedEventForInfo.color = color;
		}
		await supabase.from('events').update({ color }).eq('event_id', id);
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
				{selectedEventForInfo}
				on:eventClicked={handleEventClicked}
				on:unselectEvent={() => (selectedEventForInfo = null)}
			/>

			<ControlPanel
				events={eventsWithData}
				bind:mode
				bind:selectedCustomIds
				{selectedEventForInfo}
				{latestCountForSelected}
				on:selectionChanged={handleSelectionChange}
				on:closeInfoPanel={() => (selectedEventForInfo = null)}
				on:colorChanged={handleColorChange}
			/>
		</div>
	</div>
</MainLayout>
