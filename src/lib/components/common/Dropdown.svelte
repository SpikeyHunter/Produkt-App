<script lang="ts">
	import { portal } from '$lib/utils/portalUtils';

	// Custom dropdown (replaces native <select>) styled to the app theme.
	// The menu is portaled to <body> with fixed positioning so it's never
	// clipped by scrollable/overflow-hidden parents (tables, modals).
	export let options: { value: string; label: string; class?: string; divider?: boolean }[] = [];
	export let value: string = '';
	export let placeholder = 'Select...';
	export let small = false; // compact variant for toolbars / table rows
	export let widthClass = 'w-full';
	export let onChange: ((v: string) => void) | null = null;

	let open = false;
	let btnEl: HTMLButtonElement;
	let menuEl: HTMLDivElement | null = null;
	let menuStyle = '';

	$: selected = options.find((o) => o.value === value);

	const MENU_MAX = 260; // px, matches max-h below

	function openMenu() {
		if (!btnEl) return;
		const r = btnEl.getBoundingClientRect();
		const spaceBelow = window.innerHeight - r.bottom;
		const openUp = spaceBelow < MENU_MAX + 12 && r.top > spaceBelow;
		menuStyle =
			`position: fixed; left: ${r.left}px; min-width: ${r.width}px; ` +
			(openUp ? `bottom: ${window.innerHeight - r.top + 4}px;` : `top: ${r.bottom + 4}px;`);
		open = true;
	}

	function toggle() {
		if (open) open = false;
		else openMenu();
	}

	function pick(v: string) {
		value = v;
		open = false;
		onChange?.(v);
	}

	function onDocClick(e: MouseEvent) {
		if (!open) return;
		const t = e.target as Node;
		if (btnEl?.contains(t) || menuEl?.contains(t)) return;
		open = false;
	}

	// A fixed menu would drift if the page scrolls/resizes underneath it.
	function closeIfOpen() {
		if (open) open = false;
	}
</script>

<svelte:window
	on:click|capture={onDocClick}
	on:resize={closeIfOpen}
	on:scroll|capture={(e) => {
		if (open && !menuEl?.contains(e.target as Node)) open = false;
	}}
	on:keydown={(e) => e.key === 'Escape' && closeIfOpen()}
/>

<div class="relative {widthClass}">
	<button
		type="button"
		bind:this={btnEl}
		on:click={toggle}
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
</div>

{#if open}
	<div
		use:portal
		bind:this={menuEl}
		style={menuStyle}
		class="w-max max-w-[280px] bg-gray1 border border-navbar rounded-xl shadow-2xl z-[10050] overflow-hidden"
	>
		<div class="max-h-[260px] overflow-y-auto custom-scrollbar py-1">
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
