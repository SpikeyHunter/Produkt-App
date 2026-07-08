<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import type { SSTourDate } from '$lib/types/tour';
	import { TOUR_DATE_TYPES } from '$lib/types/tour';
	import { initUserSettings, typeColors } from '$lib/stores/userSettings';

	export let dates: SSTourDate[] = [];
	export let selectedDateId: string | null = null;

	let searchValue = '';
	let activeFilter: string | null = null;
	let settingsReady = false;
	const dispatch = createEventDispatcher();

	onMount(async () => {
		await initUserSettings();
		settingsReady = true;
	});

	// Reactive alias — colors passed as argument to getTypeColor so Svelte
	// tracks it as a template dependency and re-renders on any store change.
	$: colors = $typeColors;

	function getTypeColor(type: string | undefined, c: Record<string, string>) {
		const t = type || 'Tour Date';
		return c[t] || c['Tour Date'] || '#E1FF00';
	}

	// For a Travel Day, split into the linked show name + Arrival/Departure.
	// Prefers the stored link; falls back to parsing the "Arrival - X" venue string.
	function travelParts(d: SSTourDate): { name: string; dir: string } | null {
		if ((d.type || 'Tour Date') !== 'Travel Day') return null;
		if (d.linked_date_id) {
			const show = dates.find((x) => x.id === d.linked_date_id);
			if (show) {
				return { name: show.venue, dir: d.date > show.date ? 'Departure' : 'Arrival' };
			}
		}
		const m = (d.venue || '').match(/^(Arrival|Departure)\s*-\s*(.+)$/i);
		if (m) return { name: m[2], dir: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() };
		return { name: d.venue, dir: '' };
	}

	function toggleFilter(type: string) {
		activeFilter = activeFilter === type ? null : type;
	}

	// Toggle selection — clicking an already-selected date deselects it
	function toggleSelect(id: string) {
		selectedDateId = selectedDateId === id ? null : id;
	}

	// A linked Travel Day numbers itself by the SHOW it's attached to, so both
	// travel days (arrival + departure) carry the same number as the tour date.
	function effectiveDate(d: SSTourDate): string {
		if ((d.type || 'Tour Date') === 'Travel Day' && d.linked_date_id) {
			const show = dates.find((x) => x.id === d.linked_date_id);
			if (show) return show.date;
		}
		return d.date;
	}

	// Add this reactive declaration
	$: dayNumberMap = (() => {
		const seen = new Map<string, number>();
		let counter = 1;
		for (const d of filteredDates) {
			if ((d.type || 'Tour Date') === 'Tour Break') continue;
			const key = effectiveDate(d);
			if (!seen.has(key)) {
				seen.set(key, counter++);
			}
		}
		return seen;
	})();

	$: filteredDates = dates.filter((d) => {
		const addressString = d.address?.full_address || '';
		const matchesSearch =
			addressString.toLowerCase().includes(searchValue.toLowerCase()) ||
			(d.venue && d.venue.toLowerCase().includes(searchValue.toLowerCase())) ||
			(d.type && d.type.toLowerCase().includes(searchValue.toLowerCase()));
		const matchesFilter = !activeFilter || (d.type || 'Tour Date') === activeFilter;
		return matchesSearch && matchesFilter;
	});

	const FILTER_TYPES: { type: string; label: string; icon: string }[] = [
		{
			type: 'Tour Date',
			label: 'Tour Date',
			icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
		},
		{
			type: 'Travel Day',
			label: 'Travel Day',
			icon: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'
		},
		{
			type: 'Tour Break',
			label: 'Tour Break',
			icon: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3'
		},
		{
			type: 'Pickup',
			label: 'Pickup',
			icon: 'M12 19V5M5 12l7-7 7 7'
		},
		{
			type: 'Dropoff',
			label: 'Dropoff',
			icon: 'M12 5v14M19 12l-7 7-7-7'
		},
		{
			type: 'Other',
			label: 'Other',
			icon: 'M12 8v0M12 12v0M12 16v0M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'
		}
	];
</script>

<!-- Root has NO overflow-hidden so footer tooltips render outside -->
<div class="flex flex-col h-full bg-navbar rounded-2xl">
	<!-- Header -->
	<div
		class="p-4 border-b border-gray1 space-y-4 flex-shrink-0 w-full box-border rounded-t-2xl overflow-hidden"
	>
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold text-white">Tour Dates</h3>
			<button
				class="px-3 py-1 flex items-center justify-center rounded-full bg-lime text-black hover:opacity-90 transition-opacity cursor-pointer flex-shrink-0 text-sm font-bold whitespace-nowrap"
				aria-label="Add Tour Date"
				on:click={() => dispatch('addDate', { type: activeFilter || 'Tour Date' })}
			>
				<span>+ Add Date</span>
			</button>
		</div>

		<div class="w-full max-w-full overflow-hidden relative">
			<svg
				class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray2 pointer-events-none"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				type="text"
				placeholder="Search event date"
				bind:value={searchValue}
				class="w-full bg-gray1 rounded-3xl pl-11 pr-4 h-8 text-sm text-white placeholder-gray2 outline-none border-none focus:ring-0 focus:outline-none transition-colors"
			/>
		</div>

		{#if activeFilter}
			<div transition:scale={{ duration: 150, start: 0.9 }} class="flex items-center gap-2">
				<span
					class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md text-[#1a1a1a] flex items-center gap-1.5"
					style="background-color: {getTypeColor(activeFilter, colors)};"
				>
					{activeFilter}
					<button
						class="cursor-pointer hover:opacity-70 transition-opacity"
						aria-label="Clear filter"
						on:click={() => (activeFilter = null)}
					>
						<svg
							class="w-3 h-3"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"><path d="M18 6L6 18M6 6l12 12" /></svg
						>
					</button>
				</span>
				<span class="text-gray2 text-[10px] uppercase tracking-wider"
					>{filteredDates.length} shown</span
				>
			</div>
		{/if}
	</div>

	<!-- List -->
	<div class="flex-1 overflow-y-auto p-3 custom-scrollbar min-h-0">
		{#if filteredDates.length > 0}
			<div class="space-y-2">
				{#each filteredDates as date (date.id)}
					{@const tp = travelParts(date)}
					<div
						class="relative group"
						animate:flip={{ duration: 200 }}
						transition:scale|local={{ duration: 150, start: 0.95 }}
					>
						<button
							class="w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 {selectedDateId ===
							date.id
								? 'border'
								: 'bg-gray1 border border-transparent hover:border-gray2'}"
							style={selectedDateId === date.id
								? `background-color: ${getTypeColor(date.type, colors)}18; border-color: ${getTypeColor(date.type, colors)}80;`
								: ''}
							on:click={() => toggleSelect(date.id)}
						>
							<div class="w-8 shrink-0 flex items-center justify-center">
								<div
									class="w-7 h-7 rounded-full text-[#1a1a1a] flex items-center justify-center text-xs font-black border border-[#1a1a1a] shadow-sm transition-colors duration-300"
									style="background-color: {getTypeColor(date.type, colors)};"
								>
									{#if (date.type || 'Tour Date') === 'Tour Break'}
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
									</svg>
								{:else}
									{dayNumberMap.get(effectiveDate(date)) ?? ''}
								{/if}
								</div>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<div
										class="text-[11px] font-bold uppercase tracking-wider shrink-0"
										style="color: {getTypeColor(date.type, colors)};"
									>
										{new Date(date.date).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC'
										})}
									</div>
									{#if date.type && date.type !== 'Tour Date'}
										<span
											class="text-[9px] font-bold px-1.5 py-0.5 rounded text-[#1a1a1a] shrink-0 transition-colors duration-300"
											style="background-color: {getTypeColor(date.type, colors)}; opacity: 0.9;"
										>
											{date.type}
										</span>
									{/if}
								</div>
								{#if tp && tp.dir}
									<div
										class="text-[10px] font-bold uppercase tracking-wider mb-0.5"
										style="color: {getTypeColor(date.type, colors)};"
									>
										{tp.dir}
									</div>
								{/if}
								<div class="text-white font-bold text-sm truncate pr-8">
									{tp ? tp.name : date.venue}
								</div>
								{#if !tp}
									<div class="text-gray2 text-xs truncate">
										{#if date.type === 'Tour Break'}
											{date.notes || ''}
										{:else if date.address?.city}
											{date.address.city}{date.address.country ? `, ${date.address.country}` : ''}
										{/if}
									</div>
								{/if}
							</div>
						</button>

						<button
							class="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
							aria-label="Edit date"
							on:click|stopPropagation={() => dispatch('editDate', { date })}
						>
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div
				in:scale={{ duration: 150, start: 0.95 }}
				class="h-full flex flex-col items-center justify-center text-gray2 text-sm p-4 text-center"
			>
				{#if activeFilter}
					No "{activeFilter}" dates found.
				{:else}
					No dates found. Add your first date to this tour!
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer filter buttons — z-[9999] + overflow-visible so tooltips escape container -->
	{#if settingsReady}
		<div
			class="relative z-[50] overflow-visible p-3 border-t border-gray1 flex items-center justify-center gap-1.5 bg-gray1/20 shrink-0 rounded-b-2xl"
		>
			{#each FILTER_TYPES as f, i}
				{@const isActive = activeFilter === f.type}
				{@const isRight = i >= FILTER_TYPES.length / 2}
				<div class="relative group">
					<button
						aria-label="Filter {f.label}"
						aria-pressed={isActive}
						class="w-8 h-8 rounded-full flex items-center justify-center text-[#1a1a1a] cursor-pointer shadow-lg transition-all duration-200 ease-out
							{isActive
							? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]'
							: activeFilter
								? 'opacity-35 scale-90 hover:opacity-80 hover:scale-100'
								: 'hover:scale-110'}"
						style="background-color: {getTypeColor(f.type, colors)};"
						on:click={() => toggleFilter(f.type)}
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d={f.icon} />
						</svg>
					</button>

					<!-- Tooltip: left-half anchors left (grows right), right-half anchors right (grows left) -->
					<div
						class="absolute z-[9999] -top-9 px-2 py-1 rounded-md text-[9px] font-black text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg uppercase tracking-wider"
						style="
							background-color: {getTypeColor(f.type, colors)};
							{isRight ? 'right: 0; left: auto;' : 'left: 0; right: auto;'}
						"
					>
						{isActive ? `Clear ${f.label}` : f.label}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Placeholder footer (same height) while settings load -->
		<div class="p-3 border-t border-gray1 shrink-0 rounded-b-2xl h-[56px] bg-gray1/20"></div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 2px;
	}
</style>