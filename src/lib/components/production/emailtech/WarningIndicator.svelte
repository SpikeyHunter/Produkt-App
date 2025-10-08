<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Warning } from '$lib/services/warningService';

	export let warnings: Warning[] = [];

	const dispatch = createEventDispatcher();

	let showTooltip = false;

	function handleFix() {
		dispatch('fix');
		showTooltip = false;
	}
</script>

<div
	role="group"
	class="relative"
	on:mouseenter={() => (showTooltip = true)}
	on:mouseleave={() => (showTooltip = false)}
>
	{#if warnings.length === 0}
		<div
			class="flex items-center gap-2 text-xs text-lime"
			title="Content is synced with event data"
		>
			<svg
				class="w-4 h-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
				<polyline points="22 4 12 14.01 9 11.01" />
			</svg>
			<span>Synced</span>
		</div>
	{:else}
		<div class="flex items-center gap-2 text-xs text-problem animate-pulse cursor-pointer">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
				/>
			</svg>
			<span>{warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}</span>
		</div>

		{#if showTooltip}
			<div
				class="absolute top-full left-0 mt-2 w-80 bg-navbar border border-gray1 rounded-lg shadow-xl z-50 p-3"
			>
				<div class="text-white font-bold text-sm mb-2">Data Mismatches Found</div>
				<ul class="space-y-2 max-h-60 overflow-y-auto pr-1">
					{#each warnings as warning}
						<li class="text-xs text-gray2 border-l-2 border-problem pl-2">
							{warning.message}
						</li>
					{/each}
				</ul>
				<button
					on:click={handleFix}
					class="w-full bg-lime text-black rounded px-3 py-1.5 text-xs font-bold mt-3 hover:bg-white transition-colors"
				>
					Fix All Warnings
				</button>
			</div>
		{/if}
	{/if}
</div>