<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetSubsection ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { formatMoney, itemsBudgetedTotal, itemsActualTotal, itemsHaveActuals, hasChildren, blankItem } from '$lib/utils/budgetUtils';
	import { supabase } from '$lib/supabase.js';
	import type { Preset, BudgetItem } from '$lib/types/budget';
	import BudgetItemRow from './BudgetItemRow.svelte';
	import { dragging, beginDrag, endDrag, dropOn, canDrop, edgeFromEvent } from '$lib/utils/budgetDnd';
	import type { StoreKey, DropTarget } from '$lib/utils/budgetDnd';

	export let name: string;
	export let hidden: boolean = false;
	/** preset category ('technical' | 'hospitality' | 'other' | 'artist_fee') */
	export let categoryKey: string;
	/** budget store key — where this section lives, for drag & drop */
	export let storeKey: StoreKey;
	/** index of this section within its category */
	export let subIndex: number;
	export let items: BudgetItem[] = [];
	export let presetRefreshTrigger = 0;

	// drag & drop
	let sectionEl: HTMLElement;
	let cardEl: HTMLElement;
	let dropEdge: 'before' | 'after' | null = null;
	let endActive = false;

	const dispatch = createEventDispatcher();
	let isEditingName = false;

	let availablePresets: Preset[] = [];

	onMount(() => {
		loadPresets();
	});

	$: if (presetRefreshTrigger >= 0) {
		loadPresets();
	}

	async function loadPresets() {
		const { data, error } = await supabase
			.from('show_expenses')
			.select('*')
			.eq('category', categoryKey)
			.order('name');
		if (error) console.error('Error loading presets:', error);
		else availablePresets = (data as Preset[]) || [];
	}

	function focus(node: HTMLElement) {
		node.focus();
	}

	function notifyUpdate() {
		dispatch('update');
	}
	function notifySave() {
		dispatch('save');
	}
	function change() {
		notifyUpdate();
		notifySave();
	}

	function addItem() {
		console.log('[budget] ui: add item in section', name);
		items = [...items, blankItem()];
		change();
	}

	/** Fold / unfold every sub-item list in this section at once. */
	function toggleAllSubItems() {
		const anyOpen = items.some((i) => hasChildren(i) && !i.collapsed);
		items = items.map((i) => (hasChildren(i) ? { ...i, collapsed: anyOpen } : i));
		change();
	}

	/* ---------------------------------------------------------- drag & drop */

	$: selfTarget = { kind: 'section', path: { cat: storeKey, sub: subIndex, item: -1, child: -1 } } as DropTarget;
	$: endTarget = { kind: 'items-end', path: { cat: storeKey, sub: subIndex, item: -1, child: -1 } } as DropTarget;

	function onDragStart(e: DragEvent) {
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', name);
			e.dataTransfer.effectAllowed = 'move';
			// drag the whole card, not just the little grip icon
			if (cardEl) e.dataTransfer.setDragImage(cardEl, 24, 18);
		}
		beginDrag({
			kind: 'section',
			path: { cat: storeKey, sub: subIndex, item: -1, child: -1 },
			label: name || 'Section',
			hasKids: false
		});
	}
	function onDragEnd() {
		dropEdge = null;
		endDrag();
	}
	function onDragOver(e: DragEvent) {
		if (!$dragging) return;
		// item drops are handled by the rows / end zone inside
		if ($dragging.kind !== 'section') return;
		const edge = edgeFromEvent(e, sectionEl);
		if (!canDrop($dragging, { ...selfTarget, edge })) return;
		e.preventDefault();
		e.stopPropagation();
		dropEdge = edge;
	}
	/** dragleave also fires when the pointer crosses into a child element —
	    ignore those so the insertion line doesn't flicker while moving. */
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
	function onEndOver(e: DragEvent) {
		if (!canDrop($dragging, endTarget)) return;
		e.preventDefault();
		e.stopPropagation();
		endActive = true;
	}
	function onEndDrop(e: DragEvent) {
		if (!endActive) return;
		e.preventDefault();
		e.stopPropagation();
		endActive = false;
		dropOn(endTarget);
	}

	$: anySubItemsOpen = items.some((i) => hasChildren(i) && !i.collapsed);
	$: hasAnySubItems = items.some((i) => hasChildren(i));
	$: isDragged = $dragging?.kind === 'section' && $dragging.path.cat === storeKey && $dragging.path.sub === subIndex;

	function deleteItem(id: string) {
		console.log('[budget] ui: delete item', id, 'in section', name);
		items = items.filter((item) => item.id !== id);
		change();
	}

	function handleNameBlur() {
		isEditingName = false;
		notifySave();
	}

	function toggleHidden() {
		hidden = !hidden;
		change();
	}

	$: subsectionBudgeted = itemsBudgetedTotal(items);
	$: subsectionActual = itemsActualTotal(items);
	$: hasActuals = itemsHaveActuals(items);
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
		class="bg-navbar p-2 rounded-xl transition-opacity duration-150 {hidden ? 'opacity-50' : ''} {isDragged ? 'opacity-30' : ''}"
	>
	<!-- Subsection Header -->
	<div class="flex justify-between items-center gap-2 {hidden ? '' : 'mb-2'}">
		<div class="flex items-center gap-1.5 min-w-0 flex-1">
		<button
			type="button"
			draggable="true"
			on:dragstart={onDragStart}
			on:dragend={onDragEnd}
			class="grip w-4 h-5 flex items-center justify-center text-gray2/40 hover:text-white transition-colors flex-shrink-0"
			title="Drag to reorder this section"
			aria-label="Drag to move section"
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="4" y1="8" x2="20" y2="8" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="16" x2="20" y2="16" />
			</svg>
		</button>
		{#if isEditingName}
			<input
				type="text"
				bind:value={name}
				on:blur={handleNameBlur}
				class="bg-gray1 text-white rounded px-2 py-0.5 text-sm font-bold"
				use:focus
				on:keydown={(e) => {
					if (e.key === 'Enter') handleNameBlur();
				}}
			/>
		{:else}
			<div class="min-w-0 truncate">
				<button
					type="button"
					class="text-white font-bold text-sm cursor-pointer hover:text-lime"
					on:click={() => (isEditingName = true)}
				>
					{name}
				</button>
				{#if !hidden}
					<span class="text-sm font-medium text-lime">- {formatMoney(subsectionBudgeted)}</span>
					{#if hasActuals}
						<span class="text-xs font-medium text-problem ml-1">act. {formatMoney(subsectionActual)}</span>
					{/if}
				{:else}
					<span class="text-xs text-gray2 ml-1">(hidden — excluded from totals)</span>
				{/if}
			</div>
		{/if}
		</div>
		<div class="flex items-center gap-1.5 flex-shrink-0">
			{#if !hidden && hasAnySubItems}
				<button
					type="button"
					on:click={toggleAllSubItems}
					class="px-2 py-0.5 text-gray2 hover:text-lime text-[10px] font-bold uppercase tracking-wider rounded-2xl cursor-pointer transition-colors"
					title={anySubItemsOpen ? 'Hide all sub-items in this section' : 'Show all sub-items in this section'}
				>
					{anySubItemsOpen ? 'Hide sub-items' : 'Show sub-items'}
				</button>
			{/if}
			{#if !hidden}
				<button
					type="button"
					on:click={addItem}
					class="px-2 py-0.5 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
				>
					+ Add Item
				</button>
			{/if}
			<button
				type="button"
				on:click={toggleHidden}
				class="w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-colors {hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
				title={hidden ? 'Show section' : 'Hide section (exclude from totals + export)'}
				aria-label="Toggle section visibility"
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
				on:click={() => dispatch('delete')}
				class="w-6 h-6 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer transition-colors"
				title="Delete section"
				aria-label="Delete section"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
				</svg>
			</button>
		</div>
	</div>

	{#if !hidden}
		<div class="space-y-1">
			{#if items.length > 0}
				<!-- Header Row -->
				<div class="header-grid text-gray2 text-[10px] uppercase tracking-wider px-0.5">
					<div></div>
					<div></div>
					<div></div>
					<div class="pl-2 truncate">Item</div>
					<div class="pl-2 truncate">Budgeted $</div>
					<div class="pl-2 truncate">Actual $</div>
					<div class="text-center">Qty</div>
					<div class="pl-2 truncate">Unit</div>
					<div class="pl-2 truncate">Total</div>
					<div></div>
				</div>
				{#each items as item, i (item.id)}
					<BudgetItemRow
						bind:item={items[i]}
						{availablePresets}
						path={{ cat: storeKey, sub: subIndex, item: i, child: -1 }}
						on:update={notifyUpdate}
						on:save={notifySave}
						on:delete={() => deleteItem(item.id)}
					/>
				{/each}
			{/if}

			<!-- drop zone: end of this section's list (also catches drops on an empty section) -->
			<div
				class="drop-zone {items.length === 0 ? 'roomy' : ''} {endActive ? 'active' : ''}"
				on:dragover={onEndOver}
				on:dragleave={(e) => reallyLeft(e) && (endActive = false)}
				on:drop={onEndDrop}
				role="presentation"
			></div>
		</div>
	{/if}
	</div>
</div>

<style>
	.header-grid {
		display: grid;
		grid-template-columns: 16px 18px 16px minmax(0, 1fr) minmax(62px, 82px) minmax(62px, 82px) minmax(46px, 56px) minmax(44px, 56px) minmax(66px, 78px) 42px;
		gap: 4px;
	}
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
	.drop-zone {
		height: 6px;
		border-radius: 6px;
		background: transparent;
		transition: background 0.12s ease;
	}
	.drop-zone.roomy { height: 22px; }
	.drop-zone.active { background: rgba(225, 255, 0, 0.35); }
</style>
