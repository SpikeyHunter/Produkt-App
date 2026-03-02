<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import VenueSettingsModal from '$lib/components/calendar/VenueSettingsModal.svelte';

	export let isOpen = false;

	let venues: any[] = [];
	let loading = true;

	let showVenueModal = false;
	let selectedVenueId: string | null = null;

	async function fetchVenues() {
		loading = true;
		const { data, error } = await supabase
			.from('calendar_settings')
			.select('*')
			.eq('setting_type', 'VENUE')
			.order('setting_name', { ascending: true });

		if (!error && data) {
			venues = data;
		}
		loading = false;
	}

	$: if (isOpen) {
		fetchVenues();
	}

	function getVenueColor(venue: any) {
		const stages = venue?.setting_params?.stages;
		if (stages && Array.isArray(stages) && stages.length > 0 && stages[0].color) {
			return stages[0].color;
		}
		return '#BDBDBB'; // Default fallback color
	}

	function openVenueModal(id: string | null = null) {
		selectedVenueId = id;
		// By NOT closing the parent modal and letting this stack on top,
		// we completely eliminate the flickering/glitching effect.
		showVenueModal = true;
	}

	function handleVenueSuccess() {
		fetchVenues();
	}

	function closeModal() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div use:portal class="fixed inset-0 z-[90] flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/80 backdrop-blur-sm"
			transition:fade={{ duration: 200 }}
			on:click={closeModal}
			aria-hidden="true"
		></div>

		<div
			class="bg-gray1 border border-gray2/20 rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 flex flex-col max-h-[90vh]"
			transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
		>
			<div class="flex items-center justify-between p-6 border-b border-gray2/10 shrink-0">
				<h2 class="text-xl font-black text-white uppercase tracking-wide">Calendar Settings</h2>
				<button
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={closeModal}
					aria-label="Close modal"
				>
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8">
				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">Venues</h3>
						<button
							class="px-4 py-2 bg-lime text-black font-bold text-xs rounded-full hover:bg-lime/90 transition-all shadow-lg shadow-lime/10 cursor-pointer"
							on:click={() => openVenueModal(null)}
						>
							+ Add Venue
						</button>
					</div>

					{#if loading}
						<div class="flex justify-center p-8">
							<div class="w-8 h-8 border-4 border-lime/20 border-t-lime rounded-full animate-spin"></div>
						</div>
					{:else if venues.length === 0}
						<div class="p-8 border border-dashed border-gray2/30 rounded-2xl text-center">
							<p class="text-gray2 text-sm font-bold">No venues configured yet.</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each venues as venue}
								<button 
									type="button"
									class="w-full text-left bg-black/30 border border-gray2/20 rounded-2xl p-4 flex items-center justify-between hover:border-lime/50 transition-colors cursor-pointer group"
									on:click={() => openVenueModal(venue.id)}
								>
									<div class="flex items-center gap-4">
										<div 
											class="w-5 h-5 rounded-full shadow-sm transition-transform group-hover:scale-110" 
											style="background-color: {getVenueColor(venue)}"
										></div>
										<div>
											<p class="text-white font-bold text-sm">{venue.setting_name}</p>
											<p class="text-gray2 text-xs">{venue.setting_params?.location?.city || 'No Location'}</p>
										</div>
									</div>
									<div class="text-gray2 group-hover:text-white transition-colors p-2">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
										</svg>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}

<VenueSettingsModal
	bind:isOpen={showVenueModal}
	venueId={selectedVenueId}
	on:success={handleVenueSuccess}
/>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>