<!--
  FIXED:
  - Added 'export let presetRefreshTrigger' so it can accept the prop.
  - 'categoryKey' is now correctly used.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney } from '$lib/utils/budgetUtils';
	import BudgetSubsection from './BudgetSubsection.svelte';

	export let title: string;
	export let categoryKey: string;
	export let subsections: { id: string; name: string; items: any[] }[] = [];
	export let presetRefreshTrigger = 0; // Added missing export

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

	$: categoryTotal = subsections.reduce((acc, subsection) => {
		const subsectionTotal = (subsection.items || []).reduce(
			(itemAcc, item) => itemAcc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
			0
		);
		return acc + subsectionTotal;
	}, 0);
</script>

<div class="py-4 border-t border-gray1 first:pt-0 first:border-t-0">
	<div class="flex justify-left items-left mb-3">
		<h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
		<span class="ml-1 text-sm font-bold text-white">- {formatMoney(categoryTotal)}</span>
	</div>

	<div class="space-y-3">
		{#each subsections as subsection (subsection.id)}
			<BudgetSubsection
				bind:name={subsection.name}
				bind:items={subsection.items}
				{categoryKey}
				{presetRefreshTrigger}
				on:update={notifyUpdate}
				on:save={notifySave}
				on:delete={() => deleteSubsection(subsection.id)}
			/>
		{/each}
	</div>

	<div class="flex gap-2 mt-4">
		<input
			type="text"
			bind:value={newSubName}
			placeholder="New section name"
			class="flex-1 bg-black/15 text-white rounded-2xl px-3 py-1.5 text-sm placeholder-gray3"
		/>
		<button
			type="button"
			on:click={addSubsection}
			disabled={newSubName.trim() === ''}
			class="px-3 py-1.5 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer disabled:opacity-50"
		>
			+ Add Section
		</button>
	</div>
</div>