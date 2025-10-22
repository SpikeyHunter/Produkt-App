<!-- /src/lib/components/booking/artistavailability/BookingFilter.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let filters: any = {};
	const dispatch = createEventDispatcher();

	// Common
	let viewType: 'artist' | 'event' = filters.viewType || 'event';

	// Event Filters
	let dateFilter: 'upcoming' | 'past' = filters.dateFilter || 'upcoming';
	let quickDateFilter: 'all' | 'week' | 'month' | 'year' = filters.quickDateFilter || 'all';
	let country = filters.country || '';
	let city = filters.city || '';
	let venue = filters.venue || '';

	// Artist Filters
	let artistDateFilter: 'all' | 'upcoming' | 'past' = filters.artistDateFilter || 'all';
	let sortOrder = filters.sortOrder || 'name_asc';

	function updateFilters() {
		let dateRange = null;
		if (viewType === 'event' && dateFilter === 'upcoming' && quickDateFilter !== 'all') {
			const now = new Date();
			let start = new Date();
			let end = new Date();
			if (quickDateFilter === 'week') {
				const firstDay = now.getDate() - now.getDay();
				start = new Date(now.setDate(firstDay));
				end = new Date(now.setDate(firstDay + 6));
			} else if (quickDateFilter === 'month') {
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			} else if (quickDateFilter === 'year') {
				start = new Date(now.getFullYear(), 0, 1);
				end = new Date(now.getFullYear(), 11, 31);
			}
			dateRange = { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
		}

		const newFilters = {
			viewType,
			country,
			city,
			venue,
			dateFilter,
			quickDateFilter,
			dateRange,
			artistDateFilter,
			sortOrder
		};
		dispatch('filtersChange', newFilters);
	}

	function handleViewTypeChange(newType: 'artist' | 'event') {
		if (viewType === newType) return;
		viewType = newType;
		clearLocalState(); // Reset filters on view change
		updateFilters();
	}
	
	export function clearFilters() {
		clearLocalState();
		updateFilters();
	}

	function clearLocalState() {
		country = '';
		city = '';
		venue = '';
		dateFilter = 'upcoming';
		quickDateFilter = 'all';
		artistDateFilter = 'all';
		sortOrder = 'name_asc';
	}

	// Reactive statements to auto-update on changes
	$: viewType, updateFilters();
	$: country, updateFilters();
	$: city, updateFilters();
	$: venue, updateFilters();
	$: dateFilter, (quickDateFilter = 'all'), updateFilters();
	$: quickDateFilter, updateFilters();
	$: artistDateFilter, updateFilters();
	$: sortOrder, updateFilters();
</script>

<div class="space-y-6">
    <!-- View Type -->
	<div>
		<div class="text-gray2 text-xs font-bold block mb-2">View</div>
		<div class="flex items-center gap-2 p-1 bg-gray1 rounded-lg w-full">
			<button
				class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {viewType === 'event' ? 'bg-lime text-black' : 'text-white hover:bg-gray2 hover:text-black'}"
				on:click={() => handleViewTypeChange('event')}>Events</button
			>
			<button
				class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {viewType === 'artist' ? 'bg-lime text-black' : 'text-white hover:bg-gray2 hover:text-black'}"
				on:click={() => handleViewTypeChange('artist')}>Artists</button
			>
		</div>
	</div>

	<!-- Conditional Filters -->
	{#if viewType === 'event'}
        <div>
            <div class="text-gray2 text-xs font-bold block mb-2">Timeframe</div>
            <div class="flex items-center gap-2 p-1 bg-gray1 rounded-lg w-full">
                <button on:click={() => dateFilter = 'upcoming'} class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {dateFilter==='upcoming' ? 'bg-lime text-black' : 'text-white hover:bg-gray2'}">Upcoming</button>
                <button on:click={() => dateFilter = 'past'} class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {dateFilter==='past' ? 'bg-lime text-black' : 'text-white hover:bg-gray2'}">Past</button>
            </div>
        </div>

		{#if dateFilter === 'upcoming'}
			<div class="flex flex-wrap gap-2">
				<button on:click={() => quickDateFilter = 'all'} class:bg-lime={quickDateFilter==='all'} class:text-black={quickDateFilter==='all'} class="px-3 py-1 rounded-lg text-xs font-bold bg-gray1 text-white hover:bg-gray2 hover:text-black transition-colors">All</button>
				<button on:click={() => quickDateFilter = 'week'} class:bg-lime={quickDateFilter==='week'} class:text-black={quickDateFilter==='week'} class="px-3 py-1 rounded-lg text-xs font-bold bg-gray1 text-white hover:bg-gray2 hover:text-black transition-colors">This Week</button>
				<button on:click={() => quickDateFilter = 'month'} class:bg-lime={quickDateFilter==='month'} class:text-black={quickDateFilter==='month'} class="px-3 py-1 rounded-lg text-xs font-bold bg-gray1 text-white hover:bg-gray2 hover:text-black transition-colors">This Month</button>
				<button on:click={() => quickDateFilter = 'year'} class:bg-lime={quickDateFilter==='year'} class:text-black={quickDateFilter==='year'} class="px-3 py-1 rounded-lg text-xs font-bold bg-gray1 text-white hover:bg-gray2 hover:text-black transition-colors">This Year</button>
			</div>
		{/if}

		<div>
			<label class="text-gray2 text-xs font-bold block mb-2" for="country-filter">Country</label>
			<input id="country-filter" type="text" bind:value={country} placeholder="e.g. Canada" class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"/>
		</div>
		<div>
			<label class="text-gray2 text-xs font-bold block mb-2" for="city-filter">City</label>
			<input id="city-filter" type="text" bind:value={city} placeholder="e.g. Montreal" class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"/>
		</div>
		<div>
			<label class="text-gray2 text-xs font-bold block mb-2" for="venue-filter">Venue</label>
			<input id="venue-filter" type="text" bind:value={venue} placeholder="e.g. Bazart" class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"/>
		</div>

	{:else} <!-- Artist View Filters -->
		<div>
			<div class="text-gray2 text-xs font-bold block mb-2">Shows</div>
            <div class="flex items-center gap-2 p-1 bg-gray1 rounded-lg w-full">
                <button on:click={() => artistDateFilter = 'all'} class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {artistDateFilter==='all' ? 'bg-lime text-black' : 'text-white hover:bg-gray2'}">All Time</button>
                <button on:click={() => artistDateFilter = 'upcoming'} class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {artistDateFilter==='upcoming' ? 'bg-lime text-black' : 'text-white hover:bg-gray2'}">Upcoming</button>
                <button on:click={() => artistDateFilter = 'past'} class="flex-1 px-4 py-1 rounded-md text-xs font-bold transition-colors {artistDateFilter==='past' ? 'bg-lime text-black' : 'text-white hover:bg-gray2'}">Past</button>
            </div>
		</div>
		<div>
			<label class="text-gray2 text-xs font-bold block mb-2" for="sort-order">Sort Artists</label>
			<select id="sort-order" bind:value={sortOrder} class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-lime appearance-none">
				<option value="name_asc">Name (A-Z)</option>
				<option value="name_desc">Name (Z-A)</option>
			</select>
		</div>
	{/if}
</div>
