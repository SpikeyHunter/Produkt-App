<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let headerText: string;

	const dispatch = createEventDispatcher();
</script>

<div class="flex justify-between items-center mb-8 pb-4 border-b border-gray2/20">
	<button
		class="px-4 py-2 bg-transparent text-gray2 border border-gray2 rounded-4xl font-bold transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
		on:click={() => dispatch('today')}>Today</button
	>
	<div class="flex items-center gap-4">
		<button
			class="p-2 bg-transparent text-gray2 border border-gray2 rounded-lg transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
			on:click={() => dispatch('previous')}
			aria-label="Previous period"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><polyline points="15 18 9 12 15 6"></polyline></svg
			>
		</button>
		<h2 class="text-2xl font-bold text-white min-w-[300px] text-center">{headerText}</h2>
		<button
			class="p-2 bg-transparent text-gray2 border border-gray2 rounded-lg transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
			on:click={() => dispatch('next')}
			aria-label="Next period"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><polyline points="9 18 15 12 9 6"></polyline></svg
			>
		</button>
	</div>
	<div class="flex items-center gap-3">
		<button
			class="p-2 bg-transparent text-gray2 border border-gray2 rounded-4xl transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
			aria-label="Settings"
		>
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
		</button>
		<button
			class="px-4 py-2 bg-transparent text-gray2 border border-gray2 rounded-4xl font-bold flex items-center gap-2 transition-all hover:bg-lime hover:text-black hover:border-lime cursor-pointer"
			aria-label="Filter events"
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
			Filter
		</button>
	</div>
</div>