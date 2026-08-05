<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetExpenseCategory ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney, subsBudgetedTotal, subsActualTotal, subsHaveActuals } from '$lib/utils/budgetUtils';
	import type { BudgetSubsection as SubsectionType } from '$lib/types/budget';
	import BudgetSubsection from './BudgetSubsection.svelte';
	import { dragging, dropOn, canDrop } from '$lib/utils/budgetDnd';
	import type { StoreKey, DropTarget } from '$lib/utils/budgetDnd';

	export let title: string;
	export let categoryKey: string;
	/** budget store key for this category — used by drag & drop */
	export let storeKey: StoreKey;
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
		console.log('[budget] ui: add section', name, 'in', title);
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
		console.log('[budget] ui: delete section', id, 'in', title);
		subsections = subsections.filter((s) => s.id !== id);
		notifyUpdate();
		notifySave();
	}

	let endActive = false;
	$: endTarget = { kind: 'sections-end', path: { cat: storeKey, sub: -1, item: -1, child: -1 } } as DropTarget;
	function onEndOver(e: DragEvent) {
		if (!canDrop($dragging, endTarget)) return;
		e.preventDefault();
		endActive = true;
	}
	/** dragleave also fires when the pointer crosses into a child element —
	    ignore those so the insertion line doesn't flicker while moving. */
	function reallyLeft(e: DragEvent): boolean {
		const from = e.currentTarget as HTMLElement;
		const to = e.relatedTarget as Node | null;
		return !to || !from.contains(to);
	}

	function onEndDrop(e: DragEvent) {
		if (!endActive) return;
		e.preventDefault();
		endActive = false;
		dropOn(endTarget);
	}

	$: categoryBudgeted = subsBudgetedTotal(subsections);
	$: categoryActual = subsActualTotal(subsections);
	$: hasActuals = subsHaveActuals(subsections);
</script>

<div class="py-3 border-t border-gray1 first:pt-0 first:border-t-0">
	<div class="flex justify-start items-baseline mb-2">
		<h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
		<span class="ml-1 text-sm font-bold text-white">- {formatMoney(categoryBudgeted)}</span>
		{#if hasActuals}
			<span class="ml-2 text-xs font-bold text-confirmed">act. {formatMoney(categoryActual)}</span>
		{/if}
	</div>

	<div class="space-y-2">
		{#each subsections as subsection, si (subsection.id)}
			<BudgetSubsection
				bind:name={subsections[si].name}
				bind:hidden={subsections[si].hidden}
				bind:items={subsections[si].items}
				{categoryKey}
				{storeKey}
				subIndex={si}
				{presetRefreshTrigger}
				on:update={notifyUpdate}
				on:save={notifySave}
				on:delete={() => deleteSubsection(subsection.id)}
			/>
		{/each}

		<!-- drop zone: end of this category's section list -->
		<div
			class="drop-zone {subsections.length === 0 ? 'roomy' : ''} {endActive ? 'active' : ''}"
			on:dragover={onEndOver}
			on:dragleave={(e) => reallyLeft(e) && (endActive = false)}
			on:drop={onEndDrop}
			role="presentation"
		></div>
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

<style>
	.drop-zone {
		height: 10px;
		border-radius: 6px;
		background: transparent;
		transition: background 0.12s ease;
	}
	.drop-zone.roomy { height: 22px; }
	.drop-zone.active { background: rgba(225, 255, 0, 0.35); }
</style>
