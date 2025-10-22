<!-- /src/lib/components/booking/artistavailability/ControlPanel.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import BookingFilter from './BookingFilter.svelte';
	import BookingSync from './BookingSync.svelte';

	export let filters: any = {};

	const dispatch = createEventDispatcher();
	let bookingFilterComponent: BookingFilter;

	function forward(event: CustomEvent) {
		dispatch(event.type, event.detail);
	}

	function clearAllFilters() {
		if (bookingFilterComponent) {
			bookingFilterComponent.clearFilters();
		}
	}
</script>

<div class="bg-navbar border border-gray1 rounded-xl p-4 h-full overflow-y-auto">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-white text-lg font-bold">Filters</h3>
		<button on:click={clearAllFilters} class="text-gray2 hover:text-lime transition-colors text-xs">
			Clear All
		</button>
	</div>

	<div class="space-y-6">
		<BookingFilter bind:this={bookingFilterComponent} {filters} on:filtersChange={forward} />

		<div class="pt-4 border-t border-gray1">
			<div class="text-gray2 text-xs font-bold block mb-2">Actions</div>
			<!-- Removed the invalid bind:syncMessage directive -->
			<BookingSync on:syncComplete={forward} />
		</div>
	</div>
</div>
