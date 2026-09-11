<!--
  BudgetIncomeSectionCard — one income section and its lines.

    Technical                              13,000.00$
      Labour 6,000 · Rentals 2,000 · Audio 5,000

  Drag the grip to reorder. With no lines of its own the total is typed
  straight into the header; add lines and it becomes their sum.

  Link icon lime  = this money is reserved for its expense category only.
  Link icon grey3 = it covers any expense, wherever the budget runs over.

  Custom budgets only — the standard types keep their fixed income fields.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatMoney, sectionIncomeTotal } from '$lib/utils/budgetUtils';
	import type { BudgetItem } from '$lib/types/budget';
	import BudgetIncomeRow from './BudgetIncomeRow.svelte';
	import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';
	import { dragging, beginDrag, endDrag, dropOn, canDrop, edgeFromEvent } from '$lib/utils/budgetDnd';
	import type { DropTarget } from '$lib/utils/budgetDnd';

	export let name: string;
	export let hidden = false;
	export let items: BudgetItem[] = [];
	export let fenced = false;
	/** typed straight in while the section has no lines */
	export let amount: number | null = null;
	/** position in the income list — used by drag & drop */
	export let subIndex = 0;
	/** it points at a category at all */
	export let hasCategory = true;
	/** its lines can own an expense section (category exists and holds sections) */
	export let canLinkLines = true;
	export let categoryLabel = '';

	const dispatch = createEventDispatcher();
	let isEditingName = false;

	/* ------------------------------- reordering ------------------------------ */

	let sectionEl: HTMLElement;
	let cardEl: HTMLElement;
	let dropEdge: 'before' | 'after' | null = null;

	$: selfTarget = {
		kind: 'section',
		path: { cat: 'income', sub: subIndex, item: -1, child: -1 }
	} as DropTarget;

	function onDragStart(e: DragEvent) {
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', name);
			e.dataTransfer.effectAllowed = 'move';
			if (cardEl) e.dataTransfer.setDragImage(cardEl, 24, 18);
		}
		beginDrag({
			kind: 'section',
			path: { cat: 'income', sub: subIndex, item: -1, child: -1 },
			label: name || 'Budget section',
			hasKids: false
		});
	}
	function onDragEnd() {
		dropEdge = null;
		endDrag();
	}
	function onDragOver(e: DragEvent) {
		if ($dragging?.kind !== 'section') return;
		const edge = edgeFromEvent(e, sectionEl);
		if (!canDrop($dragging, { ...selfTarget, edge })) return;
		e.preventDefault();
		e.stopPropagation();
		dropEdge = edge;
	}
	/** dragleave also fires when the pointer crosses into a child element. */
	function reallyLeft(e: DragEvent): boolean {
		const from = e.currentTarget as HTMLElement;
		const to = e.relatedTarget as Node | null;
		return !to || !from.contains(to);
	}
	function onDrop(e: DragEvent) {
		if (!dropEdge) return;
		e.preventDefault();
		e.stopPropagation();
		const edge = dropEdge;
		dropEdge = null;
		dropOn({ ...selfTarget, edge });
	}

	const notifyUpdate = () => dispatch('update');
	const notifySave = () => dispatch('save');

	function focus(node: HTMLElement) {
		node.focus();
	}

	function toggleHidden() {
		hidden = !hidden;
		notifyUpdate();
		notifySave();
	}

	function handleNameBlur() {
		isEditingName = false;
		dispatch('rename');
	}

	$: hasLines = (items || []).length > 0;
	$: sectionTotal = sectionIncomeTotal({ items, amount } as any);
	$: isDragged =
		$dragging?.kind === 'section' &&
		$dragging.path.cat === 'income' &&
		$dragging.path.sub === subIndex;
	$: linkTitle = !hasCategory
		? 'This budget isn’t tied to one category — it covers every expense'
		: fenced
			? `Reserved for ${categoryLabel || 'this category'} only — click to let it cover any expense`
			: `Covers any expense — click to reserve it for ${categoryLabel || 'this category'}`;
</script>

<div
	class="relative"
	bind:this={sectionEl}
	on:dragover={onDragOver}
	on:dragleave={(e) => reallyLeft(e) && (dropEdge = null)}
	on:drop={onDrop}
	role="listitem"
>
	{#if dropEdge}
		<div class="drop-line" class:bottom={dropEdge === 'after'}></div>
	{/if}

<div
	bind:this={cardEl}
	class="bg-navbar p-2 rounded-lg {hidden ? 'opacity-50' : ''} {isDragged ? 'opacity-30' : ''}"
>
	<!-- grip · link · name · total -->
	<div class="flex items-center gap-1">
		<button
			type="button"
			draggable="true"
			on:dragstart={onDragStart}
			on:dragend={onDragEnd}
			class="grip w-3 h-5 flex items-center justify-center text-gray2/40 hover:text-white transition-colors flex-shrink-0"
			title="Drag to reorder this budget section"
			aria-label="Drag to move budget section"
		>
			<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<line x1="4" y1="8" x2="20" y2="8" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="16" x2="20" y2="16" />
			</svg>
		</button>
		<button
			type="button"
			on:click={() => hasCategory && dispatch('togglefence')}
			disabled={!hasCategory}
			class="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-colors {hasCategory
				? 'cursor-pointer hover:bg-white/5'
				: 'cursor-default opacity-40'} {fenced ? 'text-lime' : 'text-gray3'}"
			title={linkTitle}
			aria-label="Reserve this budget for its category"
			aria-pressed={fenced}
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
				<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
				{#if !fenced}
					<line x1="3" y1="3" x2="21" y2="21" />
				{/if}
			</svg>
		</button>

		{#if isEditingName}
			<input
				type="text"
				bind:value={name}
				on:blur={handleNameBlur}
				on:keydown={(e) => e.key === 'Enter' && handleNameBlur()}
				class="flex-1 min-w-0 bg-gray1 text-white rounded px-1.5 py-0.5 text-xs font-bold"
				use:focus
			/>
		{:else}
			<button
				type="button"
				class="flex-1 min-w-0 text-left text-white font-bold text-xs truncate cursor-pointer hover:text-lime"
				on:click={() => (isEditingName = true)}
				title="Rename — the expense category follows this name"
			>
				{name || 'Untitled'}
			</button>
		{/if}

		{#if !hidden && hasLines}
			<span
				class="text-confirmed text-xs font-bold whitespace-nowrap"
				title="Sum of the lines below"
			>{formatMoney(sectionTotal)}</span>
		{/if}

		<button
			type="button"
			on:click={toggleHidden}
			class="w-4 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0 transition-colors {hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
			title={hidden ? 'Switch this section back on' : "Switch off (doesn't apply to this budget)"}
			aria-label="Toggle income section"
		>
			{#if hidden}
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
					<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
					<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
					<line x1="1" y1="1" x2="23" y2="23" />
				</svg>
			{:else}
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			{/if}
		</button>
		<button
				type="button"
				on:click={() => dispatch('delete')}
				class="w-4 h-5 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer flex-shrink-0 transition-colors"
				title="Delete this income section (and its empty expense category)"
				aria-label="Delete income section"
			>
				<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
				</svg>
			</button>
	</div>

	{#if hidden}
		<div class="pl-10 mt-1 text-gray2 text-[10px]">off — excluded from this budget</div>
	{:else}
		{#if !hasLines}
			<!-- no lines yet: the section's amount is typed straight in, on its own line -->
			<div class="pl-10 pr-10 mt-1 flex items-center gap-1.5">
				<span class="text-gray2 text-[10px] uppercase tracking-wider">Amount</span>
				<BudgetCurrencyInput
					bind:value={amount}
					on:input={notifyUpdate}
					on:blur={notifySave}
					class="w-[86px] ml-auto bg-gray1 text-confirmed rounded-lg px-2 py-1 text-right text-[11px] font-bold placeholder-gray2"
				/>
			</div>
		{/if}
		<div class="mt-1.5 space-y-1">
			{#each items as item, i (item.id)}
				<BudgetIncomeRow
					bind:item={items[i]}
					canLink={canLinkLines}
					{categoryLabel}
					on:update={notifyUpdate}
					on:save={notifySave}
					on:rename={() => dispatch('renameline', i)}
					on:togglelink={() => dispatch('togglelink', i)}
					on:delete={() => dispatch('deleteline', i)}
				/>
			{/each}
		</div>

		<button
			type="button"
			on:click={() => dispatch('addline')}
			class="mt-1.5 px-2 py-0.5 bg-lime text-black text-[11px] font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
		>
			+ Item
		</button>
	{/if}
</div>
</div>

<style>
	.grip { cursor: grab; }
	.grip:active { cursor: grabbing; }
	.drop-line {
		position: absolute;
		left: 0;
		right: 0;
		top: -4px;
		height: 2px;
		border-radius: 9999px;
		background: #e1ff00;
		box-shadow: 0 0 6px rgba(225, 255, 0, 0.6);
		z-index: 10;
		pointer-events: none;
	}
	.drop-line.bottom { top: auto; bottom: -4px; }
</style>
