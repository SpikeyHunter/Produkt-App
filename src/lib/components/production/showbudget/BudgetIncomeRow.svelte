<!--
  BudgetIncomeRow — one budget line inside an income section.

  One amount, no budgeted/actual split: income is what you were given.
  The link icon is the whole allocation control — lime means this money only
  pays for its own expense section (created and named for it automatically),
  grey3 means it goes into the section's pot like everything else.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BudgetItem } from '$lib/types/budget';
	import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';

	export let item: BudgetItem;
	/** false when the parent section isn't tied to a category that holds sections */
	export let canLink = true;
	/** what the link would reserve this line for, for the tooltip */
	export let categoryLabel = '';

	const dispatch = createEventDispatcher();

	const notifyUpdate = () => dispatch('update');
	const notifySave = () => dispatch('save');

	function commitOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
	}

	$: linked = item.fenced === true;
	$: linkTitle = !canLink
		? 'This section isn’t reserved for a category, so its lines can’t be reserved either'
		: linked
			? `Reserved for its own expense section in ${categoryLabel || 'this category'} — click to pool it back`
			: `Click to give this line its own expense section in ${categoryLabel || 'this category'}`;
</script>

<!-- link and delete sit either side of the whole card, centred on it -->
<div class="rounded-lg bg-black/15 p-1.5 flex items-center gap-1">
	<button
		type="button"
		on:click={() => canLink && dispatch('togglelink')}
		disabled={!canLink}
		class="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors {canLink
			? 'cursor-pointer hover:bg-white/5'
			: 'cursor-default opacity-40'} {linked ? 'text-lime' : 'text-gray3'}"
		title={linkTitle}
		aria-label="Reserve this budget line for its own expense section"
		aria-pressed={linked}
	>
		<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			{#if !linked}
				<line x1="3" y1="3" x2="21" y2="21" />
			{/if}
		</svg>
	</button>

	<div class="flex-1 min-w-0 space-y-1">
		<input
			type="text"
			bind:value={item.name}
			on:input={notifyUpdate}
			on:keydown={commitOnEnter}
			on:blur={() => dispatch('rename')}
			placeholder="Line name"
			class="w-full min-w-0 bg-gray1 text-white rounded-lg px-2 py-1 text-[11px] font-bold placeholder-gray2"
		/>

		<div class="flex items-center gap-1.5">
			<span class="text-gray2 text-[10px] uppercase tracking-wider">Amount</span>
			<BudgetCurrencyInput
				bind:value={item.price}
				on:input={notifyUpdate}
				on:blur={notifySave}
				class="w-[86px] ml-auto bg-gray1 text-confirmed rounded-lg px-2 py-1 text-right text-[11px] placeholder-gray2"
			/>
		</div>
	</div>

	<button
		type="button"
		on:click={() => dispatch('delete')}
		class="w-4 h-5 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer flex-shrink-0 transition-colors"
		title="Delete this line"
		aria-label="Delete budget line"
	>
		<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
			<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
			<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
		</svg>
	</button>
</div>
