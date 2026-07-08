<script lang="ts">
	import { getRingColorClass, getRingDashArray, RING_RADIUS } from '../progress';

	export let id: string;
	export let title: string;
	export let icon = '';
	export let progress = 0;
	export let restricted = false;
	export let saving = false;
	export let inactive = false; // grayed "N/A" state, synced with the tab ring

	// Identical logic to TourTabsPanel so the card ring and the tab ring always match.
	$: ringColorClass = inactive ? 'text-gray2/50' : getRingColorClass(progress);
	$: ringDashArray = getRingDashArray(inactive ? 0 : progress);
</script>

<!-- Fills its container; content scrolls internally if needed -->
<section {id} class="bg-navbar rounded-2xl overflow-hidden h-full flex flex-col min-h-0">
	<header class="flex items-center gap-3 px-5 py-4 border-b border-gray1 select-none shrink-0">
		{#if icon}
			<svg class="w-4 h-4 text-lime shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d={icon} />
			</svg>
		{/if}
		<h3 class="text-base font-bold text-white flex-1 truncate">{title}</h3>

		{#if restricted}
			<span class="text-[9px] font-black uppercase tracking-widest text-problem bg-problem/10 px-2 py-0.5 rounded-md shrink-0">
				Restricted
			</span>
		{/if}

		{#if saving}
			<span class="text-[10px] text-gray2 italic shrink-0">Saving…</span>
		{/if}

		<!-- progress ring -->
		<div class="relative w-7 h-7 shrink-0 flex items-center justify-center" title={inactive ? 'Not in use' : `${progress}% complete`}>
			<svg viewBox="0 0 36 36" class="absolute inset-0 w-7 h-7 -rotate-90">
				<circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="#2F2F2F" stroke-width="4" />
				<circle
					cx="18" cy="18" r={RING_RADIUS} fill="none"
					class={ringColorClass}
					stroke="currentColor"
					stroke-width="4" stroke-linecap="round"
					stroke-dasharray={ringDashArray}
					style="transition: stroke-dasharray 0.4s ease, stroke 0.4s ease;"
				/>
			</svg>
			{#if !inactive && progress >= 100}
				<svg class="w-3.5 h-3.5 text-confirmed z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
					<path d="M20 6L9 17l-5-5" />
				</svg>
			{:else}
				<span class="z-10 text-[8px] font-black {ringColorClass}">{inactive ? '–' : progress}</span>
			{/if}
		</div>
	</header>

	<div class="flex-1 min-h-0 overflow-y-auto p-5 custom-scrollbar">
		<slot />
	</div>
</section>

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 4px; }
	.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>