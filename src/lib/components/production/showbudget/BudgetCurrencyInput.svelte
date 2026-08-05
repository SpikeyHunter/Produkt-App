<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetCurrencyInput ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let value: number | null = null;
	export let placeholder = '0.00';
	export let disabled = false;
	let className = '';
	export { className as class };

	const dispatch = createEventDispatcher();
	let focused = false;

	// Typing: strip non-numeric chars and update the real number value
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const raw = input.value.replace(/[^0-9.]/g, '');
		value = raw ? parseFloat(raw) : null;
		dispatch('input');
	}

	function handleFocus() {
		focused = true;
	}

	function handleBlur() {
		focused = false;
		dispatch('blur');
	}

	// Focused: raw number ("1000"). Blurred: formatted ("1,000.00$").
	// Also reacts to external changes (realtime sync / undo) while not focused.
	$: displayValue = focused ? (value ?? '') : value != null ? formatMoney(value) : '';
</script>

<input
	type="text"
	value={displayValue}
	{disabled}
	on:input={handleInput}
	on:focus={handleFocus}
	on:blur={handleBlur}
	{placeholder}
	class={className}
/>
