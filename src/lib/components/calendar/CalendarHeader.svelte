<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let headerText: string;
	const dispatch = createEventDispatcher();
</script>

<div class="flex items-center justify-between p-4 border-b border-[#BDBDBB]/10 shrink-0">
	<button class="px-6 py-2.5 text-sm text-[#BDBDBB] border border-[#BDBDBB]/30 rounded-2xl font-bold transition-all hover:bg-[#F7F7F7] hover:text-[#000000] cursor-pointer" on:click={() => dispatch('today')}>Today</button>
	
	<div class="flex items-center gap-4">
		<button class="p-2 text-[#BDBDBB] hover:text-[#F7F7F7] transition-all cursor-pointer rounded-full hover:bg-[#2F2F2F]" on:click={() => dispatch('previous')} aria-label="Previous">
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
		</button>
		<h2 class="text-2xl font-bold text-[#F7F7F7] min-w-[260px] text-center">{headerText}</h2>
		<button class="p-2 text-[#BDBDBB] hover:text-[#F7F7F7] transition-all cursor-pointer rounded-full hover:bg-[#2F2F2F]" on:click={() => dispatch('next')} aria-label="Next">
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
		</button>
	</div>
	
	<div class="flex items-center gap-3">
		<button class="px-6 py-2.5 bg-[#E1FF00] text-[#000000] rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-[#E1FF00]/90 transition-all shadow-sm cursor-pointer" on:click={() => dispatch('addEvent')}>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
			Add Event
		</button>
	</div>
</div>