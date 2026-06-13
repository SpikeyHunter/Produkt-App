<script lang="ts">
	import CostGroup from './CostGroup.svelte';
	import { slide } from 'svelte/transition';

	export let fixedCosts: any[] = [];
	export let currency: string = 'CAD';
	export let triggerSave: () => void;
	export let expanded: boolean = true;

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
			<div>/ Actual: <span class="text-white">{formatCurrency(totals.actual, currency)}</span></div>
		</div>
	</div>

	{#if expanded}
		<div transition:slide|local class=" px-0 pb-6 rounded-b-xl border-t border-gray1/10">
			<div class="flex justify-end pb-4 pt-4">
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
					<CostGroup bind:group {currency} onRemove={() => removeGroup(group.id)} {triggerSave} />
				{/each}
			</div>
		</div>
	{/if}
</section>