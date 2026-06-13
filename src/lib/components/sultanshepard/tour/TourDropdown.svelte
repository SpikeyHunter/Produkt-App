<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSTour } from '$lib/types/tour';

	export let tours: SSTour[] = [];
	export let selectedTourId: string | null = null;

	const dispatch = createEventDispatcher();

	let open = false;
	let container: HTMLElement;

	$: selected = tours.find((t) => t.id === selectedTourId) || null;

	// Group tours by year for the menu
	$: grouped = tours.reduce<Record<number, SSTour[]>>((acc, t) => {
		(acc[t.year] = acc[t.year] || []).push(t);
		return acc;
	}, {});
	$: years = Object.keys(grouped).map(Number).sort((a, b) => b - a);

	function pick(id: string) {
		selectedTourId = id;
		dispatch('change', id);
		open = false;
	}

	function clickOutside(e: MouseEvent) {
		if (open && container && !container.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window on:click={clickOutside} />

<div class="relative" bind:this={container}>
	<button
		type="button"
		class="bg-gray2 text-black rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2"
		on:click={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="max-w-[220px] truncate">
			{#if selected}{selected.year} — {selected.name}{:else}Select tour{/if}
		</span>
		<svg
			class="w-3 h-3 shrink-0 transition-transform {open ? 'rotate-180' : ''}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M6 9l6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 mt-1 bg-navbar border border-navbar rounded-2xl shadow-xl z-[9999] w-max min-w-full max-h-[60vh] overflow-y-auto"
			role="listbox"
		>
			{#each years as year}
				<div class="px-3 pt-2 pb-1 text-[12px] font-black bg-gray1 uppercase tracking-widest text-gray2 border-b border-gray1">
					{year}
				</div>
				{#each grouped[year] as tour}
					<button
						type="button"
						role="option"
						aria-selected={tour.id === selectedTourId}
						class="block w-full px-3 py-2 text-left transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap {tour.id === selectedTourId
							? 'text-lime'
							: 'text-white'} hover:bg-lime hover:text-black"
						on:click={() => pick(tour.id)}
					>
						{tour.name}
						<span class="font-normal opacity-70">
							· {new Date(tour.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
							– {new Date(tour.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
						</span>
					</button>
				{/each}
			{/each}
		</div>
	{/if}
</div>