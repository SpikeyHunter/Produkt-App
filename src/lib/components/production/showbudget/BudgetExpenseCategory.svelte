<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney, subsBudgetedTotal, subsActualTotal, subsHaveActuals } from '$lib/utils/budgetUtils';
	import type { BudgetSubsection as SubsectionType } from '$lib/types/budget';
	import BudgetSubsection from './BudgetSubsection.svelte';

	export let title: string;
	export let categoryKey: string;
	export let subsections: SubsectionType[] = [];
	export let presetRefreshTrigger = 0;

	const dispatch = createEventDispatcher();
	let newSubName = '';

	function notifyUpdate() {
		dispatch('update');
	}
	function notifySave() {
		dispatch('save');
	}

	function addSubsection() {
		if (newSubName.trim() === '') return;
		const name = newSubName.trim();
		subsections = [
			...subsections,
			{
				id: crypto.randomUUID(),
				name: name,
				hidden: false,
				items: []
			}
		];
		newSubName = '';
		notifyUpdate();
		notifySave();
	}

	function deleteSubsection(id: string) {
		subsections = subsections.filter((s) => s.id !== id);
		notifyUpdate();
		notifySave();
	}

	$: categoryBudgeted = subsBudgetedTotal(subsections);
	$: categoryActual = subsActualTotal(subsections);
	$: hasActuals = subsHaveActuals(subsections);
</script>

<div class="py-3 border-t border-gray1 first:pt-0 first:border-t-0">
	<div class="flex justify-left items-baseline mb-2">
		<h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
		<span class="ml-1 text-sm font-bold text-white">- {formatMoney(categoryBudgeted)}</span>
		{#if hasActuals}
			<span class="ml-2 text-xs font-bold text-confirmed">act. {formatMoney(categoryActual)}</span>
		{/if}
	</div>

	<div class="space-y-2">
		{#each subsections as subsection (subsection.id)}
			<BudgetSubsection
				bind:name={subsection.name}
				bind:hidden={subsection.hidden}
				bind:items={subsection.items}
				{categoryKey}
				{presetRefreshTrigger}
				on:update={notifyUpdate}
				on:save={notifySave}
				on:delete={() => deleteSubsection(subsection.id)}
			/>
		{/each}
	</div>

	<div class="flex gap-2 mt-3">
		<input
			type="text"
			bind:value={newSubName}
			placeholder="New section name"
			on:keydown={(e) => {
				if (e.key === 'Enter') addSubsection();
			}}
			class="flex-1 bg-black/15 text-white rounded-2xl px-3 py-1 text-sm placeholder-gray3"
		/>
		<button
			type="button"
			on:click={addSubsection}
			disabled={newSubName.trim() === ''}
			class="px-3 py-1 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer disabled:opacity-50"
		>
			+ Add Section
		</button>
	</div>
</div>