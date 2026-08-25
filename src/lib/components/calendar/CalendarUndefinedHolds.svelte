<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import { getNextAvailableHold } from '$lib/utils/holdManager';
	import { syncLinkedDateFromCalendar } from '$lib/services/calendarEventLink';
	import type { VenueSettings, HoldLevel } from '$lib/types/calendar-types';

	// Undefined Holds: events created with Date Bypass (no date yet). The modal
	// itself transforms into the date picker (no second overlay) — dates only,
	// the hold is never confirmed here.
	export let isOpen = false;
	export let events: any[] = [];
	export let venues: VenueSettings[] = [];

	const dispatch = createEventDispatcher();

	let view: 'list' | 'define' = 'list';
	let activeRow: any = null;
	let search = '';
	let saving = false;
	let errorText = '';

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	function titleOf(r: any): string {
		return r.calendar?.title || '(No Title)';
	}

	function typeOf(r: any): string | null {
		const d = r.calendar?.details;
		try {
			const parsed = typeof d === 'string' ? JSON.parse(d) : d;
			return parsed?.type || null;
		} catch {
			return null;
		}
	}

	function parseVenue(r: any): { category: string; room: string } {
		const v = typeof r.venue === 'string' ? JSON.parse(r.venue || '{}') : r.venue || {};
		return { category: v.category || '', room: v.room || '' };
	}

	function venueLabel(r: any): string {
		const v = parseVenue(r);
		return [v.category, v.room].filter(Boolean).join(' / ') || 'TBD';
	}

	$: rows = events
		.filter((r) => titleOf(r).toLowerCase().includes(search.toLowerCase()))
		.slice()
		.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));

	// ---------------- Define view (embedded date picker) ----------------
	const todayStr = new Date().toISOString().split('T')[0];
	let stagedDates: string[] = [];
	let viewMonth = new Date(todayStr + 'T00:00:00');
	let holdMode: 'auto' | 'manual' = 'auto';
	let manualLevel: string = 'H1';
	const holdLevelsGrid = ['P', ...Array.from({ length: 20 }, (_, i) => `H${i + 1}`)];

	$: daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
	$: firstDayIndex = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

	function openDefine(row: any) {
		activeRow = row;
		stagedDates = [];
		holdMode = 'auto';
		manualLevel = 'H1';
		errorText = '';
		viewMonth = new Date(todayStr + 'T00:00:00');
		view = 'define';
	}

	function backToList() {
		view = 'list';
		activeRow = null;
	}

	function toggleDate(dayNum: number) {
		const target = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		stagedDates = stagedDates.includes(target)
			? stagedDates.filter((d) => d !== target)
			: [...stagedDates, target];
	}

	// Confirmed-event dots (same behavior as the header DateSelector)
	let dbConfirmedEvents: any[] = [];
	async function fetchMonthConfirmed(date: Date) {
		const start = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
		const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
		const { data } = await supabase
			.from('calendar_events')
			.select('date, calendar(details)')
			.in('status', ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'])
			.gte('date', start)
			.lte('date', end);
		dbConfirmedEvents = data || [];
	}
	$: if (view === 'define' && viewMonth) fetchMonthConfirmed(viewMonth);

	function getUniqueDotColors(dayEvents: any[]): string[] {
		const colors = new Set<string>();
		dayEvents.forEach((e) => {
			const cal = Array.isArray(e.calendar) ? e.calendar[0] : e.calendar;
			let type = null;
			try {
				const d = cal?.details ? (typeof cal.details === 'string' ? JSON.parse(cal.details) : cal.details) : null;
				type = d?.type;
			} catch {
				/* noop */
			}
			if (type && type !== 'Other' && typeColors[type]) colors.add(typeColors[type]);
		});
		return Array.from(colors);
	}

	async function saveDefine() {
		if (!activeRow || saving || stagedDates.length === 0) return;
		saving = true;
		errorText = '';
		try {
			const dates = [...stagedDates].sort();
			const v = parseVenue(activeRow);

			// Hold level per date: manual choice, or automatic — slot under the
			// last existing hold on that date/room.
			let holdFor: (d: string) => string | null;
			if (holdMode === 'manual') {
				holdFor = () => manualLevel;
			} else {
				const { data: dayEvents } = await supabase
					.from('calendar_events')
					.select('date, status, hold_level, venue')
					.in('date', dates);
				holdFor = (d) =>
					getNextAvailableHold({
						date: d,
						category: v.category,
						room: v.room,
						existingEvents: (dayEvents || []).filter((e: any) => e.date === d) as any,
						isPriority: false,
						venues
					}) as HoldLevel;
			}

			const group = events.filter((e) => e.group_id === activeRow.group_id);
			const updates: { id: string; date: string; hold_level: string | null }[] = [];
			const inserts: any[] = [];
			dates.forEach((d, i) => {
				const lvl = holdFor(d);
				if (i < group.length) updates.push({ id: group[i].id, date: d, hold_level: lvl });
				else
					inserts.push({
						group_id: activeRow.group_id,
						date: d,
						status: 'HOLD',
						hold_level: lvl,
						venue: activeRow.venue,
						time: activeRow.time,
						event_details: activeRow.event_details
					});
			});

			for (const u of updates) {
				const { error } = await supabase
					.from('calendar_events')
					.update({ date: u.date, hold_level: u.hold_level })
					.eq('id', u.id);
				if (error) throw error;
			}
			if (inserts.length > 0) {
				const { error } = await supabase.from('calendar_events').insert(inserts);
				if (error) throw error;
			}
			await syncLinkedDateFromCalendar(activeRow.group_id);

			dispatch('refresh');
			backToList();
		} catch (err: any) {
			console.error('❌ [undefined-holds] Failed to define dates:', err);
			errorText = 'Failed to define the dates.';
		} finally {
			saving = false;
		}
	}
</script>

{#if isOpen}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
		on:click|self={() => (isOpen = false)}
		role="none"
	>
		<div
			class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden h-[620px] max-h-[85vh]"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="p-6 border-b border-gray2/10 flex justify-between items-center gap-4 shrink-0">
				<div class="flex items-center gap-3 min-w-0">
					{#if view === 'define'}
						<button
							type="button"
							class="w-8 h-8 rounded-full bg-gray1 flex items-center justify-center text-gray2 hover:text-white transition-colors cursor-pointer shrink-0"
							on:click={backToList}
							aria-label="Back"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
						</button>
					{/if}
					<div class="min-w-0">
						<h2 class="text-2xl font-bold text-white tracking-wide truncate">
							{view === 'define' ? titleOf(activeRow) : 'Undefined Holds'}
						</h2>
						<p class="text-gray2 text-xs font-bold mt-1 truncate">
							{view === 'define'
								? `Define date(s) for this hold — ${venueLabel(activeRow)}`
								: `${events.length} hold${events.length === 1 ? '' : 's'} without an event date — define dates to place them on the calendar.`}
						</p>
					</div>
				</div>
				<button
					type="button"
					class="text-gray2 hover:text-white transition-colors cursor-pointer shrink-0"
					on:click={() => (isOpen = false)}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>

			{#if view === 'list'}
				<div class="px-6 pt-4 shrink-0">
					<div class="relative">
						<svg
							class="w-4 h-4 text-gray2 absolute left-3.5 top-1/2 -translate-y-1/2"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg
						>
						<input
							type="text"
							bind:value={search}
							placeholder="Search holds"
							class="w-full bg-gray1 rounded-3xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray2 focus:outline-none"
						/>
					</div>
				</div>

				<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
					{#each rows as row (row.id)}
						{@const t = typeOf(row)}
						<div class="flex items-center gap-3 bg-gray1 rounded-2xl px-4 py-3">
							{#if t}
								<span
									class="text-[10px] font-bold px-2.5 py-1 rounded-full text-black shrink-0"
									style="background-color: {typeColors[t] || '#828282'};"
								>
									{t === 'Bazart Nuits' ? 'Nuits Bazart' : t}
								</span>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="text-white font-bold text-sm truncate">{titleOf(row)}</p>
								<p class="text-gray2 text-[11px] font-bold truncate mt-0.5">{venueLabel(row)}</p>
							</div>
							<button
								type="button"
								class="px-4 py-2 bg-lime text-black text-xs font-black rounded-full hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
								on:click={() => openDefine(row)}
							>
								Define Date(s)
							</button>
							<button
								type="button"
								title="View event"
								class="flex items-center gap-1.5 px-4 py-2 bg-navbar border border-lime/40 text-lime text-xs font-black rounded-full hover:bg-lime/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
								on:click={() => {
									isOpen = false;
									goto(`/calendar/${row.short_id || row.id}`);
								}}
							>
								View Event
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<line x1="7" y1="17" x2="17" y2="7"></line>
									<polyline points="7 7 17 7 17 17"></polyline>
								</svg>
							</button>
						</div>
					{:else}
						<p class="text-gray2 text-sm font-bold py-8 text-center">
							{search ? 'No holds match your search.' : 'No undefined holds — every hold has a date.'}
						</p>
					{/each}
				</div>
			{:else}
				<!-- Define view: the modal becomes the date picker -->
				<div class="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center gap-5">
					<div class="w-[320px]">
						<div class="flex justify-between items-center mb-4">
							<button
								aria-label="Previous month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() => (viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() - 1)))}
								><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button
							>
							<span class="text-sm font-bold text-white tracking-wide"
								>{viewMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span
							>
							<button
								aria-label="Next month"
								class="p-1 hover:bg-white/5 rounded cursor-pointer"
								on:click={() => (viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() + 1)))}
								><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button
							>
						</div>

						<div class="grid grid-cols-7 gap-1 text-center mb-2">
							{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}<div class="text-[10px] font-bold text-gray2">{d}</div>{/each}
						</div>
						<div class="grid grid-cols-7 gap-1.5 text-center">
							{#each Array(firstDayIndex) as _}<div></div>{/each}
							{#each Array(daysInMonth) as _, i}
								{@const dayNum = i + 1}
								{@const targetDate = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
								{@const isSelected = stagedDates.includes(targetDate)}
								{@const uniqueColors = getUniqueDotColors(dbConfirmedEvents.filter((e) => e.date === targetDate))}
								{@const hasDots = isSelected || uniqueColors.length > 0}
								<button
									class="w-8 h-8 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer {isSelected
										? 'border-2 border-lime text-white'
										: 'text-gray2 hover:bg-white/5'}"
									on:click={() => toggleDate(dayNum)}
								>
									<span class="leading-none transition-transform {hasDots ? '-mt-1 mb-1' : ''}">{dayNum}</span>
									{#if hasDots}
										<div class="absolute bottom-[3px] flex gap-[1.5px] justify-center w-[24px] flex-wrap pointer-events-none">
											{#if isSelected}
												<div class="w-[4.5px] h-[4.5px] rounded-full shrink-0 bg-lime"></div>
											{:else}
												{#each uniqueColors as colorHex}
													<div class="w-[4.5px] h-[4.5px] rounded-full opacity-90 shrink-0" style="background-color: {colorHex};"></div>
												{/each}
											{/if}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					<!-- Hold level: automatic (next slot under existing holds) or manual -->
					<div class="w-full max-w-[420px]">
						<span class="block text-[10px] font-black uppercase tracking-widest text-gray2 mb-2 text-center">Hold Level</span>
						<div class="flex p-1 bg-black/40 rounded-xl border border-gray2/10 max-w-[280px] mx-auto">
							<button
								type="button"
								class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer {holdMode === 'auto'
									? 'bg-lime text-black'
									: 'text-gray2 hover:text-white'}"
								on:click={() => (holdMode = 'auto')}>Automatic</button
							>
							<button
								type="button"
								class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer {holdMode === 'manual'
									? 'bg-lime text-black'
									: 'text-gray2 hover:text-white'}"
								on:click={() => (holdMode = 'manual')}>Manual</button
							>
						</div>
						{#if holdMode === 'auto'}
							<p class="text-[10px] text-gray2 font-bold text-center mt-2">
								Placed under the last existing hold on each date.
							</p>
						{:else}
							<div class="grid grid-cols-7 gap-1 mt-3 max-w-[300px] mx-auto">
								{#each holdLevelsGrid as lvl (lvl)}
									<button
										type="button"
										class="aspect-square rounded flex items-center justify-center text-[10px] font-bold border transition-colors cursor-pointer {manualLevel === lvl
											? 'bg-lime text-black border-lime'
											: 'bg-navbar text-white border-gray2/10 hover:bg-lime/20'}"
										on:click={() => (manualLevel = lvl)}
									>
										{lvl.replace('H', '') || lvl}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if errorText}
						<p class="text-problem text-xs font-bold">{errorText}</p>
					{/if}
				</div>

				<div class="p-5 border-t border-gray2/10 flex gap-3 justify-center shrink-0">
					<button
						type="button"
						class="px-6 py-2.5 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 transition-colors cursor-pointer"
						on:click={backToList}>Cancel</button
					>
					<button
						type="button"
						disabled={saving || stagedDates.length === 0}
						class="px-6 py-2.5 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
						on:click={saveDefine}
					>
						{saving
							? 'Defining...'
							: `Define ${stagedDates.length || ''} Date${stagedDates.length === 1 ? '' : 's'}`}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
