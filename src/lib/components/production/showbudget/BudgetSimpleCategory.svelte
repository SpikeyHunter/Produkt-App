<!--
  BudgetSimpleCategory — flat item list (Artist Fee).
  Now uses the shared BudgetItemRow (flag / Budgeted / Actual / hide / delete).
-->
<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetSimpleCategory ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { formatMoney, itemsBudgetedTotal, itemsActualTotal, itemsHaveActuals, hasChildren, blankItem } from '$lib/utils/budgetUtils';
	import type { Preset, BudgetItem } from '$lib/types/budget';
	import BudgetItemRow from './BudgetItemRow.svelte';
	import { dragging, dropOn, canDrop } from '$lib/utils/budgetDnd';
	import type { StoreKey, DropTarget } from '$lib/utils/budgetDnd';

	let endActive = false;
	$: FLAT_PATH = { cat: storeKey, sub: -1, item: -1, child: -1 };

	export let title: string;
	export let categoryKey: string;
	/** budget store key — 'artist_fee' (kept as a prop for consistency with the other categories) */
	export let storeKey: StoreKey = 'artist_fee';
	export let items: BudgetItem[] = [];
	export let presetRefreshTrigger = 0;

	const dispatch = createEventDispatcher();

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

	function notifyUpdate() {
		dispatch('update');
	}
	function notifySave() {
		dispatch('save');
	}

	function addItem() {
		console.log('[budget] ui: add item in', title);
		items = [...items, blankItem()];
		notifyUpdate();
		notifySave();
	}

	function deleteItem(id: string) {
		items = items.filter((item) => item.id !== id);
		notifyUpdate();
		notifySave();
	}

	function toggleAllSubItems() {
		const anyOpen = items.some((i) => hasChildren(i) && !i.collapsed);
		items = items.map((i) => (hasChildren(i) ? { ...i, collapsed: anyOpen } : i));
		notifyUpdate();
		notifySave();
	}

	$: endTarget = { kind: 'items-end', path: FLAT_PATH } as DropTarget;
	function onEndOver(e: DragEvent) {
		if (!canDrop($dragging, endTarget)) return;
		e.preventDefault();
		e.stopPropagation();
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
		e.stopPropagation();
		endActive = false;
		dropOn(endTarget);
	}

	$: anySubItemsOpen = items.some((i) => hasChildren(i) && !i.collapsed);
	$: hasAnySubItems = items.some((i) => hasChildren(i));
	$: categoryBudgeted = itemsBudgetedTotal(items);
	$: categoryActual = itemsActualTotal(items);
	$: hasActuals = itemsHaveActuals(items);
</script>

<div class="py-3 border-t border-gray1 first:pt-0 first:border-t-0">
	<!-- Category Header -->
	<div class="flex justify-between items-center mb-2">
		<div class="flex items-baseline">
			<h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
			<span class="text-sm ml-1 font-bold text-white">- {formatMoney(categoryBudgeted)}</span>
			{#if hasActuals}
				<span class="ml-2 text-xs font-bold text-confirmed">act. {formatMoney(categoryActual)}</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if hasAnySubItems}
				<button
					type="button"
					on:click={toggleAllSubItems}
					class="px-2 py-0.5 text-gray2 hover:text-lime text-[10px] font-bold uppercase tracking-wider rounded-2xl cursor-pointer transition-colors"
					title={anySubItemsOpen ? 'Hide all sub-items' : 'Show all sub-items'}
				>
					{anySubItemsOpen ? 'Hide sub-items' : 'Show sub-items'}
				</button>
			{/if}
			<button
				type="button"
				on:click={addItem}
				class="px-2 py-0.5 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
			>
				+ Add Fee
			</button>
		</div>
	</div>

	<!-- Item List -->
	<div class="space-y-1">
		{#if items.length > 0}
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
					path={{ cat: storeKey, sub: -1, item: i, child: -1 }}
					on:update={notifyUpdate}
					on:save={notifySave}
					on:delete={() => deleteItem(item.id)}
				/>
			{/each}
		{/if}

		<div
			class="drop-zone {items.length === 0 ? 'roomy' : ''} {endActive ? 'active' : ''}"
			on:dragover={onEndOver}
			on:dragleave={(e) => reallyLeft(e) && (endActive = false)}
			on:drop={onEndDrop}
			role="presentation"
		></div>
	</div>
</div>

<style>
	.drop-zone {
		height: 6px;
		border-radius: 6px;
		background: transparent;
		transition: background 0.12s ease;
	}
	.drop-zone.roomy { height: 22px; }
	.drop-zone.active { background: rgba(225, 255, 0, 0.35); }
	.header-grid {
		display: grid;
		grid-template-columns: 16px 18px 16px minmax(0, 1fr) minmax(62px, 82px) minmax(62px, 82px) minmax(46px, 56px) minmax(44px, 56px) minmax(66px, 78px) 42px;
		gap: 4px;
	}
</style>
