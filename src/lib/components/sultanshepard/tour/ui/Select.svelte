<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label = '';
	export let value: string | undefined = undefined;
	export let options: { value: string; label: string }[] = [];
	export let placeholder = 'Select...';

	const dispatch = createEventDispatcher();

	let open = false;
	let container: HTMLElement;

	$: selected = options.find((o) => o.value === value) || null;

	function pick(v: string) {
		value = v;
		open = false;
		dispatch('change', v);
	}

	function clickOutside(e: MouseEvent) {
		if (open && container && !container.contains(e.target as Node)) open = false;
	}
</script>

<svelte:window on:click={clickOutside} />

<div class="block min-w-0">
	{#if label}
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">{label}</span>
	{/if}
	<div class="relative" bind:this={container}>
		<button
			type="button"
			class="bg-gray2 text-black rounded-xl px-3 py-1.5 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
			on:click={() => (open = !open)}
			aria-haspopup="listbox"
			aria-expanded={open}
		>
			<span class="truncate {selected ? '' : 'text-gray-500'}">
				{selected ? selected.label : placeholder}
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
				class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-[9999] w-max min-w-full overflow-hidden"
				role="listbox"
			>
				{#each options as opt}
					<button
						type="button"
						role="option"
						aria-selected={opt.value === value}
						class="block w-full px-3 py-1.5 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap {opt.value === value ? 'text-lime' : ''}"
						on:click={() => pick(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>