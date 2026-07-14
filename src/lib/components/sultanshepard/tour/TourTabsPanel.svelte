<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSTourDate, SSTourData, SSCrew } from '$lib/types/tour';
	import { tabsForType, tabProgress, isTabInactive, notesActivePriorities, NOTE_PRIORITY_TEXT_CLASS } from './tabs';
	import { getRingColorClass, getRingDashArray, RING_RADIUS } from './progress';

	export let selectedDate: SSTourDate | null = null;
	export let tourData: SSTourData | null = null;
	export let crew: SSCrew[] = [];
	export let activeTabId: string | null = null;

	const dispatch = createEventDispatcher();

	// Geometry for the notes tab's subdividing PIE (filled disc, not a ring):
	// a circle drawn at half the radius with a stroke-width equal to the full
	// diameter fills solid from center to edge, so each dash segment reads as
	// a filled wedge instead of a thin arc.
	const NOTES_FILL_RADIUS = RING_RADIUS / 2;
	const NOTES_FILL_CIRCUMFERENCE = 2 * Math.PI * NOTES_FILL_RADIUS;
	const NOTES_WEDGE_GAP = 1.5; // px gap between wedges when subdivided

	// Types that don't appear on the map and have no location
	const NO_MAP_TYPES = ['Travel Day', 'Tour Break'];
	$: isNoMap = selectedDate ? NO_MAP_TYPES.includes(selectedDate.type || '') : false;

	$: tabs = selectedDate ? tabsForType(selectedDate.type) : [];

	function progressFor(tabId: string, data: SSTourData | null, crewList: SSCrew[]): number {
		if (!data) return 0;
		return tabProgress(tabId as any, data, crewList);
	}
</script>

<div class="flex flex-col h-full bg-navbar rounded-2xl overflow-hidden">
	<div
		class="px-2 2xl:px-4 py-3 border-b border-gray1 shrink-0 mb-2 flex flex-col items-center 2xl:items-start"
	>
		<h3 class="hidden 2xl:block text-base font-bold text-white">Tour Data</h3>
		<h3 class="2xl:hidden text-[11px] font-bold text-white uppercase tracking-wider">Tabs</h3>

		{#if selectedDate}
			<p class="hidden 2xl:block text-[11px] text-gray2 mt-0.5">Select a tab below</p>
		{:else}
			<p class="hidden 2xl:block text-[11px] text-gray2 mt-0.5">Select a date on the left</p>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-2 2xl:p-2.5 custom-scrollbar min-h-0">
		{#if selectedDate}
			<div class="flex flex-col gap-2.5">
				{#if !isNoMap}
					<button
						type="button"
						class="group relative w-full flex items-center justify-center 2xl:justify-start gap-2 2xl:gap-3 p-1.5 2xl:px-3 2xl:py-1.5 rounded-xl border transition-all cursor-pointer {activeTabId ===
						'map'
							? 'bg-lime/10 border-lime/50 text-lime'
							: 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
						on:click={() => dispatch('selectTab', 'map')}
					>
						<svg
							class="w-5 h-5 shrink-0"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
							/>
						</svg>
						<span
							class="hidden 2xl:block flex-1 text-left text-xs font-bold uppercase tracking-wider"
							>Map View</span
						>

						<div
							class="2xl:hidden absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1.5 bg-[#2A2A2A] text-white text-[10px] font-bold uppercase tracking-wider rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-lg border border-gray1 transition-opacity"
						>
							Map View
						</div>
					</button>
				{/if}

				{#each tabs as tab (tab.id)}
					{@const progress = progressFor(tab.id, tourData, crew)}
					{@const inactive = tourData ? isTabInactive(tab.id, tourData) : false}
					{@const ringColorClass = inactive ? 'text-gray2/50' : getRingColorClass(progress)}
					{@const ringDashArray = getRingDashArray(inactive ? 0 : progress)}
					{@const noteWedges = tab.id === 'notes' && tourData ? notesActivePriorities(tourData) : []}
					<button
						type="button"
						class="group relative w-full flex items-center justify-center 2xl:justify-start gap-2 2xl:gap-3 p-1.5 2xl:px-3 2xl:py-1.5 rounded-xl border transition-all cursor-pointer {activeTabId ===
						tab.id
							? 'bg-lime/10 border-lime/50 text-lime'
							: 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
						on:click={() => dispatch('selectTab', tab.id)}
					>
						<div class="relative shrink-0 flex items-center justify-center">
							<svg
								class="w-5 h-5 shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d={tab.icon} />
							</svg>

							{#if tab.restricted}
								<div class="2xl:hidden absolute -bottom-1 -right-1 bg-navbar rounded-full">
									<svg
										class="w-2.5 h-2.5 text-problem"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<rect x="3" y="11" width="18" height="11" rx="2" /><path
											d="M7 11V7a5 5 0 0 1 10 0v4"
										/>
									</svg>
								</div>
							{/if}
						</div>

						<span
							class="hidden 2xl:block flex-1 text-left text-xs font-bold uppercase tracking-wider truncate"
							>{tab.label}</span
						>
						{#if tab.restricted}
							<svg
								class="hidden 2xl:block w-3 h-3 text-problem shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" /><path
									d="M7 11V7a5 5 0 0 1 10 0v4"
								/>
							</svg>
						{/if}

						<div
							class="relative w-6 h-6 shrink-0 flex items-center justify-center"
							title="{progress}%"
						>
							<svg viewBox="0 0 36 36" class="absolute inset-0 w-full h-full -rotate-90">
								<circle
									cx="18"
									cy="18"
									r={RING_RADIUS}
									fill="none"
									stroke="#2F2F2F"
									stroke-width="4"
								/>
								{#if tab.id === 'notes' && noteWedges.length > 0}
									{#each noteWedges as priority, i (priority)}
										<circle
											cx="18"
											cy="18"
											r={NOTES_FILL_RADIUS}
											fill="none"
											class={NOTE_PRIORITY_TEXT_CLASS[priority]}
											stroke="currentColor"
											stroke-width={RING_RADIUS}
											stroke-dasharray={`${Math.max(
												NOTES_FILL_CIRCUMFERENCE / noteWedges.length -
													(noteWedges.length > 1 ? NOTES_WEDGE_GAP : 0),
												0
											)} ${NOTES_FILL_CIRCUMFERENCE}`}
											stroke-dashoffset={-(i * (NOTES_FILL_CIRCUMFERENCE / noteWedges.length))}
											style="transition: stroke-dasharray 0.4s ease, stroke 0.4s ease;"
										/>
									{/each}
								{:else}
									<circle
										cx="18"
										cy="18"
										r={RING_RADIUS}
										fill="none"
										class={ringColorClass}
										stroke="currentColor"
										stroke-width="4"
										stroke-linecap="round"
										stroke-dasharray={ringDashArray}
										style="transition: stroke-dasharray 0.4s ease, stroke 0.4s ease;"
									/>
								{/if}
							</svg>

							{#if tab.id === 'notes'}
								{#if noteWedges.length === 0}
									<span class="text-[9px] font-bold z-10 text-gray2/50">–</span>
								{/if}
							{:else}
								{#if !inactive && progress >= 100}
									<svg
										class="w-3 h-3 text-confirmed z-10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="3"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M20 6L9 17l-5-5" />
									</svg>
								{:else}
									<span class="text-[9px] font-bold z-10 {ringColorClass}"
										>{inactive ? '–' : progress}</span
									>
								{/if}
							{/if}
						</div>

						<div
							class="2xl:hidden absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1.5 bg-[#2A2A2A] text-white text-[10px] font-bold uppercase tracking-wider rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100] shadow-lg border border-gray1 transition-opacity"
						>
							{tab.label}
							{#if tab.restricted}(Restricted){/if}
						</div>
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