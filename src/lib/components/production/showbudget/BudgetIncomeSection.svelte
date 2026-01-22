<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let label: string;
	export let amount: number | null;

	const dispatch = createEventDispatcher();
	
	let inputElement: HTMLInputElement;
	let isFocused = false;
	let displayValue = '';

	// Initialize display value on load
	$: if (!isFocused) {
		// We format the money but remove the '$' symbol because we have a static icon for it
		displayValue = amount !== null && amount !== undefined 
			? formatMoney(amount).replace('$', '') 
			: '';
	}

	function handleFocus() {
		isFocused = true;
		// Show raw number for editing/math
		displayValue = amount !== null && amount !== undefined ? amount.toString() : '';
	}

	function handleBlur() {
		isFocused = false;
		evaluateMathAndSet();
		dispatch('save');
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			inputElement.blur();
		}
	}

	function evaluateMathAndSet() {
		if (!displayValue || displayValue.trim() === '') {
			amount = null;
			displayValue = '';
			dispatch('update');
			return;
		}

		try {
			// 1. Sanitize: Allow numbers, operators (+-*/), parenthesis, and decimals
			const sanitized = displayValue.replace(/[^0-9+\-*/.()\s]/g, '');

			// 2. Evaluate Math
			const result = new Function('return ' + sanitized)();

			// 3. Set Amount
			if (!isNaN(result) && isFinite(result)) {
				amount = result;
				dispatch('update');
			}
		} catch (e) {
			console.warn('Invalid math expression', e);
		}

		// 4. Update Display (Strip the $ so we don't have duplicates)
		if (amount !== null) {
			displayValue = formatMoney(amount).replace('$', '');
		}
	}
</script>

<div>
	<label for={label} class="text-gray2 text-xs uppercase tracking-wider mb-1 block">
		{label}
	</label>
	<div class="relative">
		<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray2">$</span>
		
		<input
			type="text"
			id={label}
			bind:this={inputElement}
			bind:value={displayValue}
			on:focus={handleFocus}
			on:blur={handleBlur}
			on:keydown={handleKeyDown}
			placeholder="0.00"
			class="w-full bg-navbar text-white rounded-lg pl-8 pr-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
		/>
	</div>
</div>

<style>
	/* Removes up/down arrows from number inputs in some browsers (though we are using type="text" now) */
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>