<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let value: number | null = null;
	export let placeholder = '0.00';
	// Allow passing class from parent
	let className = '';
	export { className as class };

	const dispatch = createEventDispatcher();
	let focused = false;

	// Handle typing: strip non-numeric chars and update the real number value
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		// Allow only numbers and one decimal point
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

	// Reactive statement to control what is shown in the box
	// If focused: show raw number (e.g. "1000")
	// If blurred: show formatted string (e.g. "1,000.00$")
	$: displayValue = focused 
		? (value ?? '') 
		: (value != null ? formatMoney(value) : '');
</script>

<input
	type="text"
	value={displayValue}
	on:input={handleInput}
	on:focus={handleFocus}
	on:blur={handleBlur}
	{placeholder}
	class={className}
/>