<script lang="ts">
	import CostGroup from './CostGroup.svelte';
	import { slide } from 'svelte/transition';

	export let fixedCosts: any[] = [];
	export let currency: string = 'CAD';
	export let triggerSave: () => void;
	export let onLoadTemplate: (() => void) | null = null;
	export let expanded: boolean = true;
	// Template editor variant: no Actual column/summary, optional per-section
	// "Add Instead of Overwrite" toggle in the header.
	export let templateMode: boolean = false;
	export let addModeToggle: boolean | null = null;
	export let onAddModeChange: ((v: boolean) => void) | null = null;

	let showGroupDropdown = false;
	const categories = ['General', 'Production','Marketing', 'Talent', 'Sponsor', 'Additional'];

	$: totals = fixedCosts.reduce(
		(acc, group) => {
			if (!group) return acc; // Guard against a momentarily undefined group

			const groupTotals = (group.costs || []).reduce(
				(gAcc: any, cost: any) => {
					const offerBudget = (Number(cost.qty) || 0) * (Number(cost.cost) || 0);

					// Always sum Estimated and Actual regardless of the toggle
					gAcc.estimated += Number(cost.estimatedInternal) || 0;
					gAcc.actual += Number(cost.actualInternal) || 0;

					// Only sum Offer Budget if reported (toggled on)
					if (cost.reported) {
						gAcc.offerBudget += offerBudget;
					}

					return gAcc;
				},
				{ offerBudget: 0, estimated: 0, actual: 0 }
			);

			acc.offerBudget += groupTotals.offerBudget;
			acc.estimated += groupTotals.estimated;
			acc.actual += groupTotals.actual;
			return acc;
		},
		{ offerBudget: 0, estimated: 0, actual: 0 }
	);

	const formatCurrency = (amount: number, currencyCode: string) => {
		try {
			const safeCode = currencyCode || 'CAD';

			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: safeCode,
				currencyDisplay: 'narrowSymbol'
			}).format(amount || 0);
			return `${safeCode} ${num}`;

		} catch (e) {
			return `CAD $${amount || 0}`;
		}
	};

	function addGroup(category: string) {
		const newGroup = {
			id: crypto.randomUUID(),
			category,
			type: '(No Type)',
			costs: []
		};

		fixedCosts = [...fixedCosts, newGroup];
		showGroupDropdown = false;
		triggerSave();
	}

	function removeGroup(id: string) {
		fixedCosts = fixedCosts.filter((g) => g.id !== id);
		triggerSave();

	}

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.new-group-dropdown')) {
			showGroupDropdown = false;

		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<section class="flex flex-col">
	<div
		class="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none px-4 py-3 rounded-t-xl transition-colors view-only-exception {expanded
			? 'bg-gray1/80'
			: 'hover:bg-gray1'}"
		role="button"
		tabindex="0"
		on:click={() => (expanded = !expanded)}
		on:keydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
	>
		<div class="flex items-center gap-2">
			<svg
				class="w-6 h-6 text-lime transition-transform {expanded ? 'rotate-90' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"
				></path></svg
			>
			<h3 class="text-xl font-black text-lime tracking-wide">Fixed Costs</h3>
		</div>

		<div class="flex items-center gap-6 text-sm font-bold text-gray2">
			<div>
				Offer Budget: <span class="text-white">{formatCurrency(totals.offerBudget, currency)}</span>
			</div>
			<div>
				/ Estimated: <span class="text-white">{formatCurrency(totals.estimated, currency)}</span>
			</div>
			{#if !templateMode}
				<div>/ Actual: <span class="text-white">{formatCurrency(totals.actual, currency)}</span></div>
			{/if}
			{#if addModeToggle !== null}
				<div
					class="flex items-center gap-2 ml-2"
					role="none"
					on:click|stopPropagation
					on:keydown|stopPropagation
				>
					<span class="text-xs font-bold {addModeToggle ? 'text-white' : 'text-gray2'}"
						>Add Instead of Overwrite</span
					>
					<button
						type="button"
						role="switch"
						aria-checked={addModeToggle}
						aria-label="Add instead of overwrite"
						on:click|stopPropagation={() => onAddModeChange?.(!addModeToggle)}
						class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none {addModeToggle
							? 'bg-lime'
							: 'bg-[#444]'}"
					>
						<span
							aria-hidden="true"
							class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {addModeToggle
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if expanded}
		<div transition:slide|local class=" px-0 pb-6 rounded-b-xl border-t border-gray1/10">
			<div class="flex justify-end items-center gap-3 pb-4 pt-4">
				{#if onLoadTemplate}
					<button
						on:click={onLoadTemplate}
						class="px-4.5 py-2.5 bg-gray1 text-gray3 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:text-lime hover:cursor-pointer transition-colors"
					>
						Load Template
					</button>
				{/if}
				<div class="relative new-group-dropdown">
					<button
						on:click={() => (showGroupDropdown = !showGroupDropdown)}
						class="px-4.5 py-2.5 bg-gray1 text-gray3 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:text-lime hover:cursor-pointer transition-colors"
					>
						New Cost Group
					</button>

					{#if showGroupDropdown}
						<div
							class="absolute right-0 mt-2 w-34 bg-gray1 border border-navbar rounded-xl shadow-xl z-50 overflow-hidden"
						>
							{#each categories as cat}
								<button
									on:click={() => addGroup(cat)}
									class="w-full text-left px-4 py-3 text-sm text-white hover:text-lime hover:bg-navbar hover:cursor-pointer transition-colors"
								>
									{cat}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-8">
				{#each fixedCosts as group (group.id)}
					<CostGroup bind:group {currency} onRemove={() => removeGroup(group.id)} {triggerSave} {templateMode} />
				{/each}
			</div>
		</div>
	{/if}
</section>