<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import { supabase } from '$lib/supabase';
	import {
		isReservationsEvent,
		type DailyCount,
		type EventData,
		type EffectiveCount
	} from '$lib/types/dailycount';

	// FIX: Removed `resolveColorCollisions` from imports so it stops overriding database colors!
	import { extractDominantColor } from '$lib/utils/color';

	import Header from '$lib/components/marketing/dailycount/Header.svelte';
	import ControlPanel from '$lib/components/marketing/dailycount/ControlPanel.svelte';
	import DailyChart from '$lib/components/marketing/dailycount/DailyChart.svelte';

	let allEvents: EventData[] = [];
	// Every event row (no keyword filtering) — the pool for "Link to another
	// event", which must include passes etc. Only Réservations are excluded.
	let allEventsRaw: EventData[] = [];
	let dailyCounts: DailyCount[] = [];
	let fullDateRange: string[] = [];
	let dateRange: string[] = [];

	// Sub-filtered range passed to the chart
	let mode: 'LIVE' | 'CUSTOM' = 'LIVE';
	let selectedCustomIds: number[] = [];

	let realtimeChannel: any;
	let eventsChannel: any;
	/** last colour known to be in the database, per event — the base every save checks against */
	let savedColors = new Map<number, string | null>();
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

	$: linkableEvents = allEventsRaw.filter((e) => !isReservationsEvent(e.event_name));

	// Latest raw count per event (the chart keeps using dailyCounts directly).
	$: latestByEvent = (() => {
		const m = new Map<number, DailyCount>();
		for (const c of dailyCounts) m.set(c.event_id, c); // ordered by report_date asc
		return m;
	})();

	// Effective counts = own latest + linked event's latest + reported tickets.
	// Used everywhere a total is displayed (selector, top 3, summary) — never
	// by the chart.
	$: effectiveCounts = (() => {
		const out: Record<number, EffectiveCount> = {};
		for (const e of allEventsRaw) {
			const own = latestByEvent.get(e.event_id);
			const linked = e.linked_event_id ? latestByEvent.get(e.linked_event_id) : undefined;
			const reported = Number(e.reported_count) || 0;
			const base = own?.total || 0;
			const linkedTotal = linked?.total || 0;
			out[e.event_id] = {
				base,
				linked: linkedTotal,
				linkedGa: linked?.ga || 0,
				linkedVip: linked?.vip || 0,
				reported,
				ga: (own?.ga || 0) + (linked?.ga || 0),
				vip: (own?.vip || 0) + (linked?.vip || 0),
				total: base + linkedTotal + reported
			};
		}
		return out;
	})();

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
		if (eventsChannel) supabase.removeChannel(eventsChannel);
		refetchTimers.forEach((t) => clearTimeout(t));
	});

	async function loadData() {
		console.log('[+page.svelte] Fetching events from database on load...');

		const { data: eventData, error: eventError } = await supabase
			.from('events')
			.select(
				'event_id, event_name, event_date, event_status, event_flyer, event_venue, stage_type, color, pinned, linked_event_id, reported_count'
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
			allEventsRaw = eventData as EventData[];
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

						// Only fills an EMPTY colour: if someone else set one meanwhile,
						// nothing is written and their colour is used.
						const { data: filled } = await supabase
							.from('events')
							.update({ color: finalColor })
							.eq('event_id', e.event_id)
							.or('color.is.null,color.eq.')
							.select('color');
						if (!filled || filled.length === 0) {
							const { data: cur } = await supabase.from('events').select('color').eq('event_id', e.event_id).maybeSingle();
							if (cur?.color) finalColor = cur.color.trim();
						}
					}
					savedColors.set(e.event_id, finalColor);
					return { ...e, color: finalColor } as EventData;
				})
			);

			console.log('[+page.svelte] Successfully mapped colors on load.');
			allEvents = eventsWithColors;
			// Keep the raw pool's colors in sync too (used by the link dropdown).
			const colorById = new Map(eventsWithColors.map((e) => [e.event_id, e.color]));
			allEventsRaw = allEventsRaw.map((e) => ({ ...e, color: colorById.get(e.event_id) ?? e.color }));
		}
	}

	function patchEventEverywhere(id: number, patch: Partial<EventData>) {
		allEvents = allEvents.map((ev) => (ev.event_id === id ? { ...ev, ...patch } : ev));
		allEventsRaw = allEventsRaw.map((ev) => (ev.event_id === id ? { ...ev, ...patch } : ev));
		if (selectedEventForInfo && selectedEventForInfo.event_id === id) {
			selectedEventForInfo = { ...selectedEventForInfo, ...patch };
		}
	}

	// Link (or unlink) another event whose tickets fold into this one.
	async function handleLinkChanged(e: CustomEvent<{ id: number; linkedId: number | null }>) {
		const { id, linkedId } = e.detail;
		const previous = allEventsRaw.find((ev) => ev.event_id === id)?.linked_event_id ?? null;
		patchEventEverywhere(id, { linked_event_id: linkedId });
		const { error } = await supabase
			.from('events')
			.update({ linked_event_id: linkedId })
			.eq('event_id', id);
		if (error) {
			console.error('[+page.svelte] Failed to save linked event:', error.message);
			alert(`Failed to link event: ${error.message}`);
			patchEventEverywhere(id, { linked_event_id: previous });
		}
	}

	// Manually reported tickets (summary/totals only — the chart ignores them).
	async function handleReportedCountChanged(e: CustomEvent<{ id: number; count: number }>) {
		const { id, count } = e.detail;
		const previous = allEventsRaw.find((ev) => ev.event_id === id)?.reported_count ?? 0;
		patchEventEverywhere(id, { reported_count: count });
		const { error } = await supabase.from('events').update({ reported_count: count }).eq('event_id', id);
		if (error) {
			console.error('[+page.svelte] Failed to save reported count:', error.message);
			alert(`Failed to save reported count: ${error.message}`);
			patchEventEverywhere(id, { reported_count: previous });
		}
	}

	function addDaysISO(iso: string, days: number): string {
		const d = new Date(`${iso}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + days);
		return d.toISOString().split('T')[0];
	}

	function calculateDateRange(counts: DailyCount[]) {
		if (counts.length === 0) {
			fullDateRange = [];
			return;
		}

		// ISO strings (YYYY-MM-DD) sort lexicographically, no timezone drift.
		const allDates = counts.map((c) => c.report_date);
		const absoluteMin = allDates.reduce((a, b) => (a < b ? a : b));
		const maxDateStr = allDates.reduce((a, b) => (a > b ? a : b));

		// Skip the leading run of zero-ticket days: start ONE DAY BEFORE the first
		// day any active event actually has a count.
		const saleDates = counts.filter((c) => (c.total ?? 0) > 0).map((c) => c.report_date);

		let minDateStr: string;
		if (saleDates.length > 0) {
			const firstSaleDate = saleDates.reduce((a, b) => (a < b ? a : b));
			minDateStr = addDaysISO(firstSaleDate, -1);
			// Never start after the first sale, and never trim past it.
			if (minDateStr > firstSaleDate) minDateStr = firstSaleDate;
		} else {
			// No sales anywhere yet — fall back to the full span.
			minDateStr = absoluteMin;
		}

		const range: string[] = [];
		let current = minDateStr;

		while (current <= maxDateStr) {
			range.push(current);
			current = addDaysISO(current, 1);
		}
		fullDateRange = range;
	}

	// --- events realtime: colour / pin / stage / link / reported count from others ---
	const refetchTimers = new Map<number, ReturnType<typeof setTimeout>>();
	function queueEventRefetch(id: number) {
		if (!allEventsRaw.some((e) => e.event_id === id)) return;
		const old = refetchTimers.get(id);
		if (old) clearTimeout(old);
		refetchTimers.set(
			id,
			setTimeout(async () => {
				refetchTimers.delete(id);
				// re-read the row: realtime payloads can be partial
				const { data } = await supabase
					.from('events')
					.select('event_id, color, pinned, stage_type, linked_event_id, reported_count')
					.eq('event_id', id)
					.maybeSingle();
				if (!data) return;
				const color = data.color ? String(data.color).trim() : null;
				savedColors.set(id, color);
				const patch: Partial<EventData> = {
					pinned: data.pinned,
					stage_type: data.stage_type,
					linked_event_id: data.linked_event_id,
					reported_count: data.reported_count
				};
				if (color) patch.color = color;
				console.info('[dailycount] update from another user', id, patch);
				patchEventEverywhere(id, patch);
			}, 150)
		);
	}

	function setupRealtime() {
		eventsChannel = supabase
			.channel('daily_count_events')
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, (payload: any) => {
				const id = Number(payload?.new?.event_id);
				if (id) queueEventRefetch(id);
			})
			.subscribe();

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
		const { id } = e.detail;
		const color = String(e.detail.color || '').trim().toUpperCase();
		const base = savedColors.has(id) ? savedColors.get(id) ?? null : null;

		// Nothing changed (e.g. the hex field just lost focus): never write.
		if (base && base.toUpperCase() === color) {
			patchEventEverywhere(id, { color: base });
			return;
		}

		patchEventEverywhere(id, { color });

		// Compare-and-set: only replaces the colour this screen last saw. If
		// someone else changed it meanwhile, nothing is overwritten.
		let q = supabase.from('events').update({ color }).eq('event_id', id);
		q = base ? q.eq('color', base) : q.or('color.is.null,color.eq.');
		const { data, error } = await q.select('color');

		if (error) {
			console.error('[dailycount] colour save failed:', error.message);
			alert(`Could not save the colour: ${error.message}`);
			if (base) patchEventEverywhere(id, { color: base });
			return;
		}
		if (data && data.length > 0) {
			savedColors.set(id, color);
			return;
		}

		// 0 rows: either the colour changed under us, or RLS blocked it.
		const { data: cur } = await supabase.from('events').select('color').eq('event_id', id).maybeSingle();
		const remote = cur?.color ? String(cur.color).trim() : null;
		if (remote && remote.toUpperCase() === color) {
			savedColors.set(id, remote);
			return;
		}
		// Same colour, only stored with other spacing/case: not a conflict — retry on the exact stored value.
		if (remote && base && remote.toUpperCase() === base.toUpperCase()) {
			const { data: retry } = await supabase
				.from('events')
				.update({ color })
				.eq('event_id', id)
				.eq('color', cur!.color)
				.select('color');
			if (retry && retry.length > 0) {
				savedColors.set(id, color);
				return;
			}
		}
		if (cur) {
			savedColors.set(id, remote);
			if (remote) patchEventEverywhere(id, { color: remote });
			alert('Someone else just changed this colour — showing theirs now. Pick again to change it.');
		} else {
			alert(`The colour could not be saved (event ${id} not found or not allowed).`);
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
				{effectiveCounts}
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
				{effectiveCounts}
				{linkableEvents}
				{minAvailableDate}
				{maxAvailableDate}
				on:linkChanged={handleLinkChanged}
				on:reportedCountChanged={handleReportedCountChanged}
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