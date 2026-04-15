<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { SSTourDate } from '$lib/types/tour';

	export let dates: SSTourDate[] = [];
	export let selectedDateId: string | null = null;

	let searchValue = '';
	const dispatch = createEventDispatcher();

	let typeColors: Record<string, string> = {
		'Tour Date': '#E1FF00',
		'Stop': '#E4E4E4',
		'Pickup': '#86EFAC',
		'Return': '#FCA5A5'
	};

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('user_settings')
				.eq('id', user.id)
				.single();

			if (profile?.user_settings?.tour_type_colors) {
				typeColors = { ...typeColors, ...profile.user_settings.tour_type_colors };
			}
		}
	});

	$: filteredDates = dates.filter((d) => {
		const addressString = d.address?.full_address || '';
		return (
			addressString.toLowerCase().includes(searchValue.toLowerCase()) ||
			(d.venue && d.venue.toLowerCase().includes(searchValue.toLowerCase()))
		);
	});

	function getTypeColor(type?: string) {
		const t = type || 'Tour Date';
		return typeColors[t] || typeColors['Tour Date'] || '#E1FF00';
	}
</script>

<div class="flex flex-col h-full bg-navbar rounded-2xl overflow-hidden">
	<div class="p-4 border-b border-gray1 space-y-4 flex-shrink-0 w-full overflow-hidden box-border">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold text-white">Tour Dates</h3>
			<button
				class="px-3 py-1 flex items-center justify-center rounded-full bg-lime text-black hover:opacity-90 transition-opacity cursor-pointer flex-shrink-0 text-sm font-bold whitespace-nowrap"
				aria-label="Add Tour Date"
				on:click={() => dispatch('addDate', { type: 'Tour Date' })}
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
				placeholder="Search venue or address"
				bind:value={searchValue}
				class="w-full bg-gray1 rounded-3xl pl-11 pr-4 h-8 text-sm text-white placeholder-gray2 outline-none border-none focus:ring-0 focus:outline-none transition-colors"
			/>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-3 custom-scrollbar min-h-0">
		{#if filteredDates.length > 0}
			<div class="space-y-2">
				{#each filteredDates as date}
					<div class="relative group">
						<button
							class="w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 {selectedDateId === date.id
								? 'bg-lime/10 border-lime/50 border'
								: 'bg-gray1 border border-transparent hover:border-gray2'}"
							on:click={() => (selectedDateId = date.id)}
						>
							<div class="w-8 shrink-0 flex items-center justify-center">
								<div 
									class="w-7 h-7 rounded-full text-[#1a1a1a] flex items-center justify-center text-xs font-black border border-[#1a1a1a] shadow-sm"
									style="background-color: {getTypeColor(date.type)};"
								>
									{dates.findIndex(d => d.id === date.id) + 1}
								</div>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<div class="text-lime text-[11px] font-bold uppercase tracking-wider shrink-0">
										{new Date(date.date).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC'
										})}
									</div>
									{#if date.type && date.type !== 'Tour Date'}
										<span class="text-[9px] font-bold px-1.5 py-0.5 rounded text-[#1a1a1a] shrink-0" style="background-color: {getTypeColor(date.type)}; opacity: 0.9;">
											{date.type}
										</span>
									{/if}
								</div>
								<div class="text-white font-bold text-sm truncate pr-8">{date.venue}</div>
								<div class="text-gray2 text-xs truncate">
									{date.address?.full_address || 'No address provided'}
								</div>
							</div>
						</button>

						<button
							class="absolute top-1/2 -translate-y-1/2 right-3 p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
							aria-label="Edit date"
							on:click|stopPropagation={() => dispatch('editDate', { date })}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<div class="h-full flex flex-col items-center justify-center text-gray2 text-sm p-4 text-center">
				No dates found. Add your first date to this tour!
			</div>
		{/if}
	</div>

	<div class="p-3 border-t border-gray1 flex items-center justify-center gap-6 bg-gray1/20 shrink-0">
        <div class="relative group">
            <button aria-label="Add Stop" class="w-8 h-8 rounded-full flex items-center justify-center text-[#1a1a1a] transition-transform hover:scale-110 cursor-pointer shadow-lg"
                    style="background-color: {getTypeColor('Stop')};"
                    on:click={() => dispatch('addDate', { type: 'Stop' })}>
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
            </button>
            <div class="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[9px] font-black text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg uppercase tracking-wider"
                 style="background-color: {getTypeColor('Stop')};">
                Stop
            </div>
        </div>

        <div class="relative group">
            <button aria-label="Add Pickup" class="w-8 h-8 rounded-full flex items-center justify-center text-[#1a1a1a] transition-transform hover:scale-110 cursor-pointer shadow-lg"
                    style="background-color: {getTypeColor('Pickup')};"
                    on:click={() => dispatch('addDate', { type: 'Pickup' })}>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4v16l10-8-10-8zm10 0v16l10-8-10-8z"/></svg>
            </button>
            <div class="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[9px] font-black text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg uppercase tracking-wider"
                 style="background-color: {getTypeColor('Pickup')};">
                Pickup
            </div>
        </div>

        <div class="relative group">
            <button aria-label="Add Return" class="w-8 h-8 rounded-full flex items-center justify-center text-[#1a1a1a] transition-transform hover:scale-110 cursor-pointer shadow-lg"
                    style="background-color: {getTypeColor('Return')};"
                    on:click={() => dispatch('addDate', { type: 'Return' })}>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4v16L10 12l10-8zM10 4v16L0 12l10-8z"/></svg>
            </button>
            <div class="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[9px] font-black text-[#1a1a1a] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg uppercase tracking-wider"
                 style="background-color: {getTypeColor('Return')};">
                Return
            </div>
        </div>
    </div>
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