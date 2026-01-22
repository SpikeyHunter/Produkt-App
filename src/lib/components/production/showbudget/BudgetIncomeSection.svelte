<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let label: string;
	export let amount: number | null;

	const dispatch = createEventDispatcher();
	
	let inputElement: HTMLInputElement;
	let isFocused = false;
	let displayValue = '';

	// When amount changes from parent (DB load) or formatting
	$: if (!isFocused) {
		// formatMoney returns "27,500.00$", we replace "$" with "" so it fits our UI
		displayValue = amount !== null && amount !== undefined 
			? formatMoney(amount).replace('$', '') 
			: '';
	}

	function handleFocus() {
		isFocused = true;
		// Show raw number for editing
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
			// Sanitize and evaluate (math support: "100+100")
			const sanitized = displayValue.replace(/[^0-9+\-*/.()\s]/g, '');
			const result = new Function('return ' + sanitized)();

			if (!isNaN(result) && isFinite(result)) {
				amount = result;
				dispatch('update');
			}
		} catch (e) {
			console.warn('Invalid math expression', e);
		}

		// Re-format on blur (e.g. "27,500.00")
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
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>