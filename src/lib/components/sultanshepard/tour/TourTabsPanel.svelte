<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSTourDate, SSTourData, SSCrew } from '$lib/types/tour';
	import { tabsForType, tabProgress } from './tabs';

	export let selectedDate: SSTourDate | null = null;
	export let tourData: SSTourData | null = null;
	export let crew: SSCrew[] = []
	export let activeTabId: string | null = null;

	const dispatch = createEventDispatcher();

	// Types that don't appear on the map and have no location
	const NO_MAP_TYPES = ['Travel Day', 'Tour Break'];
	$: isNoMap = selectedDate ? NO_MAP_TYPES.includes(selectedDate.type || '') : false;

	$: tabs = selectedDate ? tabsForType(selectedDate.type) : [];

	function progressFor(tabId: string): number {
		if (!tourData) return 0;
		return tabProgress(tabId as any, tourData, crew);
	}
</script>

<div class="flex flex-col h-full bg-navbar rounded-2xl overflow-hidden">
	<div class="px-4 py-3 border-b border-gray1 shrink-0 mb-2">
		<h3 class="text-base font-bold text-white">Tour Data</h3>
		{#if selectedDate}
			<p class="text-[11px] text-gray2 mt-0.5">Select a tab below</p>
		{:else}
			<p class="text-[11px] text-gray2 mt-0.5">Select a date on the left</p>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-0">
		{#if selectedDate}
			<div class="flex flex-col gap-2">

				<!-- Map View — hidden for Travel Day / Tour Break (no location) -->
				{#if !isNoMap}
					<button
						type="button"
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer {activeTabId === 'map'
							? 'bg-lime/10 border-lime/50 text-lime'
							: 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
						on:click={() => dispatch('selectTab', 'map')}
					>
						<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
						</svg>
						<span class="flex-1 text-left text-xs font-bold uppercase tracking-wider">Map View</span>
					</button>
				{/if}

				{#each tabs as tab (tab.id)}
					{@const progress = progressFor(tab.id)}
					<button
						type="button"
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer {activeTabId === tab.id
							? 'bg-lime/10 border-lime/50 text-lime'
							: 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
						on:click={() => dispatch('selectTab', tab.id)}
					>
						<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d={tab.icon} />
						</svg>
						<span class="flex-1 text-left text-xs font-bold uppercase tracking-wider truncate">{tab.label}</span>
						{#if tab.restricted}
							<svg class="w-3 h-3 text-problem shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
							</svg>
						{/if}
						<!-- progress ring -->
						<span class="relative w-6 h-6 shrink-0" title="{progress}%">
							<svg viewBox="0 0 36 36" class="w-6 h-6 -rotate-90">
								<circle cx="18" cy="18" r="15" fill="none" stroke="#2F2F2F" stroke-width="5" />
								<circle
									cx="18" cy="18" r="15"
									fill="none"
									stroke={progress >= 100 ? '#86EFAC' : '#E1FF00'}
									stroke-width="5"
									stroke-linecap="round"
									stroke-dasharray="{(progress / 100) * 94.2} 94.2"
								/>
							</svg>
							{#if progress >= 100}
								<svg class="absolute inset-0 m-auto w-3 h-3 text-confirmed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="h-full flex items-center justify-center text-gray2 text-xs text-center p-4">
				Sections appear here once a date is selected.
			</div>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 4px; }
	.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>