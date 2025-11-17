<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let headerText: string;
	export let filterStatus: 'all' | 'HOLD' | 'CONFIRMED' | 'PENDING' = 'all';
	export let filterVenue: 'all' | 'Co-Pro Shows' | 'New City Gas' | 'Bazart' = 'all';
	
	const dispatch = createEventDispatcher();
	
	let showFilters = false;
</script>

<div class="flex flex-col gap-4 mb-8">
	<!-- Main Header Row -->
	<div class="flex justify-between items-center pb-4 border-b border-gray2/20">
		<!-- Left: Today Button -->
		<button
			class="px-4 py-2 bg-transparent text-gray2 border border-gray2 rounded-full font-bold 
			       transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
			on:click={() => dispatch('today')}
		>
			Today
		</button>
		
		<!-- Center: Navigation -->
		<div class="flex items-center gap-4">
			<button
				class="p-2 bg-transparent text-gray2 border border-gray2 rounded-lg 
				       transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
				on:click={() => dispatch('previous')}
				aria-label="Previous period"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			</button>
			
			<h2 class="text-2xl font-bold text-white min-w-[300px] text-center">{headerText}</h2>
			
			<button
				class="p-2 bg-transparent text-gray2 border border-gray2 rounded-lg 
				       transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
				on:click={() => dispatch('next')}
				aria-label="Next period"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>
		</div>
		
		<!-- Right: Action Buttons -->
		<div class="flex items-center gap-3">
			<!-- Add Event Button -->
			<button
				class="px-4 py-2 bg-lime text-black rounded-full font-bold flex items-center gap-2 
				       transition-all hover:bg-lime/90 cursor-pointer"
				on:click={() => dispatch('addEvent')}
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Add Hold
			</button>
			
			<!-- Manage Holds Button -->
			<button
				class="px-4 py-2 bg-transparent text-gray2 border border-gray2 rounded-full font-bold 
				       transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
				on:click={() => dispatch('manageHolds')}
			>
				Manage Holds
			</button>
			
			<!-- Copy Holds Button -->
			<button
				class="p-2 bg-transparent text-gray2 border border-gray2 rounded-full 
				       transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
				on:click={() => dispatch('copyHolds')}
				title="Copy holds to clipboard"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
				</svg>
			</button>
			
			<!-- Filter Button -->
			<button
				class="px-4 py-2 bg-transparent text-gray2 border border-gray2 rounded-full font-bold 
				       flex items-center gap-2 transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
				on:click={() => showFilters = !showFilters}
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
				</svg>
				Filter
				{#if filterStatus !== 'all' || filterVenue !== 'all'}
					<span class="w-2 h-2 bg-lime rounded-full"></span>
				{/if}
			</button>
		</div>
	</div>
	
	<!-- Filters Row (Collapsible) -->
	{#if showFilters}
		<div class="flex items-center gap-4 px-4 py-3 bg-black/30 rounded-xl transition-all">
			<!-- Status Filter -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-bold text-gray2">Status:</span>
				<select
					bind:value={filterStatus}
					on:change={() => dispatch('filterStatusChange', filterStatus)}
					class="px-3 py-1.5 bg-black/50 border border-gray2/30 rounded-full text-white text-sm
					       focus:border-lime focus:outline-none transition-colors cursor-pointer"
				>
					<option value="all">All</option>
					<option value="HOLD">Hold</option>
					<option value="CONFIRMED">Confirmed</option>
					<option value="PENDING">Pending</option>
				</select>
			</div>
			
			<!-- Venue Filter -->
			<div class="flex items-center gap-2">
				<span class="text-sm font-bold text-gray2">Venue:</span>
				<select
					bind:value={filterVenue}
					on:change={() => dispatch('filterVenueChange', filterVenue)}
					class="px-3 py-1.5 bg-black/50 border border-gray2/30 rounded-full text-white text-sm
					       focus:border-lime focus:outline-none transition-colors cursor-pointer"
				>
					<option value="all">All Venues</option>
					<option value="Co-Pro Shows">Co-Pro Shows</option>
					<option value="New City Gas">New City Gas</option>
					<option value="Bazart">Bazart</option>
				</select>
			</div>
			
			<!-- Clear Filters -->
			{#if filterStatus !== 'all' || filterVenue !== 'all'}
				<button
					class="ml-auto px-3 py-1.5 text-sm text-gray2 hover:text-white transition-colors"
					on:click={() => {
						filterStatus = 'all';
						filterVenue = 'all';
						dispatch('filterStatusChange', 'all');
						dispatch('filterVenueChange', 'all');
					}}
				>
					Clear filters
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	select {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23999999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 32px;
	}
	
	select:hover {
		background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23E1FF00' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
	}
</style>