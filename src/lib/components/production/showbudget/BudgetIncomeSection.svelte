<!--
  MODIFIED:
  - Added 'on:input' to notify parent of changes instantly.
  - 'on:blur' (on blur) now dispatches 'save'.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let data: { label: string; amount: number };

	const dispatch = createEventDispatcher();

	function handleInput() {
		dispatch('update'); // For instant totals
	}

	function handleSave() {
		dispatch('save'); // For DB save
	}
</script>

<div>
	<label for={data.label} class="text-gray2 text-xs uppercase tracking-wider mb-1 block">
		{data.label}
	</label>
	<div class="relative">
		<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray2">$</span>
		<input
			type="number"
			id={data.label}
			bind:value={data.amount}
			on:input={handleInput}
			on:blur={handleSave}
			placeholder="0.00"
			class="w-full bg-navbar text-white rounded-lg pl-8 pr-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
		/>
	</div>
</div>

<style>
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>