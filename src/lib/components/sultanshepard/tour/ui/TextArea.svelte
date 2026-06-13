<script lang="ts">
	export let label = '';
	export let value: string | undefined = '';
	export let placeholder = '';
	export let rows = 3;
</script>

<label class="block min-w-0">
	{#if label}
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">{label}</span>
	{/if}
	<textarea
		{rows}
		{placeholder}
		bind:value
		on:change
		class="w-full bg-gray1 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors resize-y"
	></textarea>
</label>
