<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	export let label = '';
	export let checked: boolean | undefined = false;
	const dispatch = createEventDispatcher();

	function toggle() {
		checked = !checked;
		dispatch('change', checked);
	}
</script>

<button
	type="button"
	class="flex items-center gap-2.5 cursor-pointer group"
	on:click={toggle}
	role="switch"
	aria-checked={!!checked}
>
	<span
		class="relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 {checked
			? 'bg-lime'
			: 'bg-gray1 group-hover:bg-gray1/70'}"
	>
		<span
			class="absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all {checked
				? 'left-[18px]'
				: 'left-0.5 ring-1 ring-white/10'}"
		></span>
	</span>
	{#if label}
		<span class="text-[12px] uppercase font-bold {checked ? 'text-gray3' : 'text-gray2/20'}">{label}</span>
	{/if}
</button>