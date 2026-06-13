<script lang="ts">
	export let label = '';
	export let value: string | number | undefined = '';
	export let placeholder = '';
	export let type: 'text' | 'number' | 'time' | 'date' | 'email' | 'url' = 'text';
	export let small = false;

	function onInput(e: Event) {
		const t = e.target as HTMLInputElement;
		value = type === 'number' ? (t.value === '' ? undefined : Number(t.value)) : t.value;
	}
</script>

<label class="block min-w-0">
	{#if label}
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">{label}</span>
	{/if}
	<input
		{type}
		{placeholder}
		value={value ?? ''}
		on:input={onInput}
		on:change
		class="w-full bg-gray1 rounded-xl px-3 text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors {small
			? 'h-9 text-sm'
			: 'h-10 text-sm'}"
	/>
</label>
