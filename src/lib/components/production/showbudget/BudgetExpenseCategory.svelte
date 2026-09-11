<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetExpenseCategory ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney, formatShort, subsBudgetedTotal, subsActualTotal, subsHaveActuals } from '$lib/utils/budgetUtils';
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
	/** custom categories can be renamed, switched off and deleted */
	export let editable = false;
	/** created by an income section: the name follows it and can't be edited here */
	export let owned = false;
	export let hidden = false;
	/** money fenced to this category (and what has been spent against it) */
	export let allocation: { allocated: number; spent: number } | null = null;
	/** per-section allocations, keyed by section id */
	export let sectionAllocations: Map<string, { allocated: number; spent: number }> = new Map();

	const dispatch = createEventDispatcher();
	let newSubName = '';
	let isEditingTitle = false;

	function focusNode(node: HTMLElement) {
		node.focus();
	}

	function commitTitle() {
		isEditingTitle = false;
		dispatch('update');
		dispatch('save');
	}

	function toggleHidden() {
		hidden = !hidden;
		dispatch('update');
		dispatch('save');
	}

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
	$: allocLeft = allocation ? allocation.allocated - allocation.spent : 0;
</script>

<div class="py-3 border-t border-gray1 first:pt-0 first:border-t-0 {hidden ? 'opacity-50' : ''}">
	<div class="flex justify-between items-baseline gap-2 mb-2">
		<div class="flex items-baseline gap-1 min-w-0 flex-wrap">
			{#if editable && !owned && isEditingTitle}
				<input
					type="text"
					bind:value={title}
					on:blur={commitTitle}
					on:keydown={(e) => e.key === 'Enter' && commitTitle()}
					use:focusNode
					class="bg-gray1 text-lime rounded px-2 py-0.5 text-sm font-bold uppercase"
				/>
			{:else if editable && !owned}
				<button type="button" class="text-lime font-bold text-sm uppercase cursor-pointer hover:text-white" on:click={() => (isEditingTitle = true)}>
					{title || 'Untitled'}
				</button>
			{:else if owned}
				<h4 class="text-lime font-bold text-sm uppercase" title="Created by the budget section of the same name — rename it there">
					{title || 'Untitled'}
				</h4>
			{:else}
				<h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
			{/if}
			<span class="ml-1 text-sm font-bold text-white">- {formatMoney(categoryBudgeted)}</span>
			{#if hasActuals}
				<span class="ml-1 text-xs font-bold text-problem">act. {formatMoney(categoryActual)}</span>
			{/if}
			{#if allocation}
				<span
					class="ml-1 px-1.5 py-[1px] rounded-2xl text-sm font-bold {allocLeft < 0 ? 'bg-problem/20 text-problem' : 'bg-confirmed/15 text-confirmed'}"
					title="Budget earmarked for this category (sections with their own allocation are counted separately)"
				>
					{formatShort(allocation.allocated)} allocated · {allocLeft < 0
						? `over by ${formatShort(-allocLeft)}`
						: `${formatShort(allocLeft)} left`}
				</span>
			{/if}
		</div>

		{#if editable}
			<div class="flex items-center gap-1 flex-shrink-0">
				<button
					type="button"
					on:click={toggleHidden}
					class="w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors {hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
					title={hidden ? 'Show category' : 'Hide category (exclude from totals + export)'}
					aria-label="Toggle category visibility"
				>
					{#if hidden}
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
							<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
							<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
							<line x1="1" y1="1" x2="23" y2="23" />
						</svg>
					{:else}
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
							<circle cx="12" cy="12" r="3" />
						</svg>
					{/if}
				</button>
				<button
					type="button"
					on:click={() => dispatch('deleteCategory')}
					disabled={owned}
					class="w-6 h-6 flex items-center justify-center rounded transition-colors {owned
						? 'text-gray2/30 cursor-not-allowed'
						: 'text-gray2 hover:text-problem cursor-pointer'}"
					title={owned ? 'Comes from a budget section — delete it there' : 'Delete this category'}
					aria-label="Delete category"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
						<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
					</svg>
				</button>
			</div>
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
				allocation={sectionAllocations.get(subsection.id) || null}
				owned={!!subsection.ownedBy}
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
