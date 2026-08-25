<script lang="ts">
	// Custom dropdown (replaces native <select>) styled to the app theme.
	export let options: { value: string; label: string; class?: string; divider?: boolean }[] = [];
	export let value: string = '';
	export let placeholder = 'Select...';
	export let small = false; // compact variant for toolbars / table rows
	export let widthClass = 'w-full';
	export let onChange: ((v: string) => void) | null = null;

	let open = false;
	let root: HTMLDivElement;

	$: selected = options.find((o) => o.value === value);

	function pick(v: string) {
		value = v;
		open = false;
		onChange?.(v);
	}

	function clickOutside(node: HTMLElement) {
		const handler = (e: MouseEvent) => {
			if (!node.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', handler, true);
		return { destroy: () => document.removeEventListener('click', handler, true) };
	}
</script>

<div class="relative {widthClass}" bind:this={root} use:clickOutside>
	<button
		type="button"
		on:click={() => (open = !open)}
		class="w-full flex items-center justify-between gap-2 bg-gray1 text-white font-bold focus:outline-none cursor-pointer {small
			? 'text-xs rounded-lg px-2.5 py-1.5'
			: 'text-sm rounded-xl px-3.5 py-2'}"
	>
		<span class="truncate {selected ? '' : 'text-gray2'}">{selected?.label ?? placeholder}</span>
		<svg
			class="w-3.5 h-3.5 shrink-0 text-gray2 {open ? 'rotate-180' : ''}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
	</button>

	{#if open}
		<div
			class="absolute left-0 top-full mt-1 min-w-full w-max max-w-[280px] bg-gray1 border border-navbar rounded-xl shadow-2xl z-[90] overflow-hidden"
		>
			<div class="max-h-64 overflow-y-auto custom-scrollbar py-1">
				{#each options as o (o.value)}
					<button
						type="button"
						on:click={() => pick(o.value)}
						class="w-full text-left px-3.5 py-2 transition-colors cursor-pointer {o.class ??
							(small ? 'text-xs font-bold' : 'text-sm font-bold')} {o.divider
							? 'border-t border-navbar'
							: ''} {o.value === value
							? 'text-lime bg-navbar/60'
							: 'text-white hover:text-lime hover:bg-navbar'}"
					>
						{o.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
