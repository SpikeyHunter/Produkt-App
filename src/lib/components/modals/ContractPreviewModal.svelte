<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { portal } from '$lib/utils/portalUtils';

	export let isOpen = false;
	export let event: any = {};

	const dispatch = createEventDispatcher();

	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	// 1. Bulletproof priority check (safeguards against the string "null" or empty spaces)
	$: contractUrl = 
		(event?.signed_contract_url && event.signed_contract_url !== 'null' ? event.signed_contract_url : null) || 
		(event?.redlined_contract_url && event.redlined_contract_url !== 'null' ? event.redlined_contract_url : null) || 
		(event?.original_contract_url && event.original_contract_url !== 'null' ? event.original_contract_url : null) || 
		(event?.contract_url && event.contract_url !== 'null' ? event.contract_url : '');
	
	// 2. Extract GDrive file ID to route through the SvelteKit proxy
	$: fileId = contractUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null;
	$: pdfSrc = fileId ? `/api/gdrive?fileId=${fileId}#view=FitH` : `${contractUrl}?v=${Date.now()}#view=FitH`;
</script>

{#if isOpen}
	<div 
		use:portal 
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
	>
		<div 
			transition:fly={{ y: 40, duration: 300 }}
			class="relative w-full max-w-[95vw] lg:max-w-5xl bg-navbar border border-gray1 rounded-2xl flex flex-col shadow-2xl overflow-hidden" 
			style="max-height: 90vh;"
		>
			
			<div class="flex items-center justify-between p-4 border-b border-gray1 bg-navbar z-10">
				<h2 class="text-white font-bold text-lg truncate pr-4">
					Contract - {event?.artist_name || 'Unknown'}
				</h2>
				
				<div class="flex items-center gap-3">
					<a
						href="/booking/contracts"
						class="bg-lime text-black px-4 py-2 flex items-center justify-center gap-2 rounded-3xl font-bold text-sm hover:opacity-80 transition-opacity shadow-sm"
						aria-label="View in Contracts Dashboard"
					>
						<span>View in Contracts</span>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
						</svg>
					</a>

					<button 
						on:click={closeModal} 
						class="p-2 rounded-lg text-gray2 hover:bg-gray2 hover:text-black transition-colors"
						aria-label="Close modal"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div 
				class="relative w-full bg-gray1/30 p-2 sm:p-4 overflow-hidden flex-1" 
				style="height: calc(90vh - 80px); min-height: 400px;"
			>
				{#if contractUrl}
					{#key pdfSrc}
						<iframe
							src={pdfSrc}
							class="w-full h-full rounded-lg border border-gray1 bg-white shadow-inner"
							title="Contract PDF Viewer"
							loading="lazy"
						></iframe>
					{/key}
				{:else}
					<div class="w-full h-full flex flex-col items-center justify-center text-gray2 bg-gray1/20 rounded-lg">
						<svg class="w-12 h-12 mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
							<polyline points="14 2 14 8 20 8"></polyline>
							<line x1="16" y1="13" x2="8" y2="13"></line>
							<line x1="16" y1="17" x2="8" y2="17"></line>
							<polyline points="10 9 9 9 8 9"></polyline>
						</svg>
						<p class="font-medium">No contract file available.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}