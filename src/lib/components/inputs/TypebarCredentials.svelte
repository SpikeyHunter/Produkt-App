<script>
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';

	export let variant = 'username'; // 'username', 'password', or 'text'
	export let placeholder = '';
	export let value = '';
	export let label = '';
	export let width = 'w-full';
	export let height = 'py-3'; // New height prop - default is smaller than py-4
	export let disabled = false;

	let showPassword = false;
	let isFocused = false;
	let inputId = `input-${Math.random().toString(36).substr(2, 9)}`;

	const dispatch = createEventDispatcher();

	$: inputType = variant === 'password' && !showPassword ? 'password' : 'text';

	$: classes = [
		// Base styles with customizable height
		`px-6 ${height} border-2 rounded-full transition-all duration-200 font-bold pr-12`,

		// Border and text colors based on focus - TEXT IS NOW ALWAYS BLACK
		variant === 'clear-lime'
			? 'border-lime text-lime placeholder-gray2 bg-transparent' // Always lime for clear-lime variant
			: isFocused
				? 'border-lime text-black placeholder-gray2 bg-white'
				: 'border-gray2 text-black placeholder-gray2 bg-white ', // Original logic

		// Width
		width,

		// Disabled state
		disabled && 'opacity-50 cursor-not-allowed bg-gray3'
	]
		.filter(Boolean)
		.join(' ');

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function handleFocus(event) {
		isFocused = true;
		dispatch('focus', event);
	}

	function handleBlur(event) {
		isFocused = false;
		dispatch('blur', event);
	}

	function handleInput(event) {
		dispatch('input', event);
	}
</script>

<div class="space-y-2">
	<!-- Label -->
	{#if label}
		<label for={inputId} class="block text-gray1 font-medium text-lg">
			{label}
		</label>
	{/if}

	<!-- Input Container -->
	<div class="relative">
		<input
			id={inputId}
			type={inputType}
			{placeholder}
			bind:value
			class={classes}
			{disabled}
			on:input={handleInput}
			on:focus={handleFocus}
			on:blur={handleBlur}
			on:keydown
		/>

		<!-- Password Eye Toggle -->
		{#if variant === 'password'}
			<button
				type="button"
				class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray2 hover:text-gray1 transition-colors duration-200"
				on:click={togglePasswordVisibility}
			>
				{#if showPassword}
					<!-- Eye Open (password visible) -->
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
						<path
							fill-rule="evenodd"
							d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else}
					<!-- Eye Closed (password hidden) -->
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
							clip-rule="evenodd"
						/>
						<path
							d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"
						/>
					</svg>
				{/if}
			</button>
		{/if}
	</div>
</div>
