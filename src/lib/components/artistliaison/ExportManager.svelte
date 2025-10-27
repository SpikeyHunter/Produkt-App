<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let selectedEvent: any = null;
	export let isExporting = false;

	function handleExport() {
		if (!selectedEvent) return;
		
		dispatch('export', {
			event: selectedEvent
		});
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold">Export Options</h3>
	</div>

	<div class="flex-1 overflow-y-auto p-3 custom-scroll">
		{#if !selectedEvent}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14 2 14 8 20 8"></polyline>
					<line x1="12" y1="18" x2="12" y2="12"></line>
					<line x1="9" y1="15" x2="15" y2="15"></line>
				</svg>
				<p class="text-gray2 text-xs">Select an event to enable export</p>
			</div>
		{:else}
			<div class="space-y-4">
				<!-- Event Summary -->
				<div class="bg-gray1 rounded-lg p-3">
					<p class="text-gray2 text-[10px] font-medium mb-1">Selected Event</p>
					<p class="text-white text-xs font-bold">{selectedEvent.event_name}</p>
					<p class="text-gray3 text-[10px]">{selectedEvent.totalAdvances || 0} artists</p>
				</div>

				<!-- Export Button -->
				<button
					type="button"
					on:click={handleExport}
					disabled={isExporting}
					class="w-full bg-lime text-black font-bold text-sm py-3 rounded-lg hover:bg-lime/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isExporting}
						<span class="flex items-center justify-center gap-2">
							<div class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></div>
							Exporting...
						</span>
					{:else}
						Export as PDF
					{/if}
				</button>

				<!-- Additional Info -->
				<div class="text-center">
					<p class="text-gray3 text-[10px]">
						Export will generate a PDF of the artist liaison sheet as displayed
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>