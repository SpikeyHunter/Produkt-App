<!--
  BudgetItemRow — one budget line (and, recursively, its sub-items).

  Columns: [grip] [flag] [+] [item name] [Budgeted $] [Actual $] [qty] [unit] [total] [hide] [delete]
   - Grip:   drag handle. Move lines within a section, across sections and across
             categories; drop onto another line's sub-list to nest it.
   - Flag:   warning triangle -> line rendered in problem color.
   - "+":    adds a sub-item. Once a line has sub-items it becomes a
             "sub-item section": Budgeted/Actual are the sum of its children and
             are no longer typed in directly (Qty and Unit stay editable).
   - Eye:    hides the line (excluded from totals + PDF).
-->
<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetItemRow ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		formatMoney,
		itemBudgetedTotal,
		itemActualTotal,
		itemBudgetedUnit,
		itemActualUnit,
		itemHasActual,
		hasChildren,
		blankItem
	} from '$lib/utils/budgetUtils';
	import {
		dragging,
		beginDrag,
		endDrag,
		dropOn,
		canDrop,
		edgeFromEvent
	} from '$lib/utils/budgetDnd';
	import type { DragPath, DropTarget } from '$lib/utils/budgetDnd';
	import type { BudgetItem, Preset } from '$lib/types/budget';
	import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';

	export let item: BudgetItem;
	export let availablePresets: Preset[] = [];
	/** Where this line lives — used by drag & drop */
	export let path: DragPath;
	/** true when this row is a sub-item (indented, can't have its own sub-items) */
	export let isChild = false;

	const dispatch = createEventDispatcher();
	const unitOptions = ['Item', 'Hour', 'Day'];

	let showPresets = false;
	let showUnits = false;
	let nameSearch = '';

	// drag & drop
	let rowEl: HTMLElement;
	let gridEl: HTMLElement;
	let dropEdge: 'before' | 'after' | null = null;

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

	function handleNameFocus() {
		showPresets = true;
		showUnits = false;
		nameSearch = item.name;
	}
	function handleNameBlur() {
		setTimeout(() => (showPresets = false), 150);
		notifySave();
	}
	/** Enter commits the field (same as clicking away) */
	function commitOnEnter(e: KeyboardEvent) {
		if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
	}
	function selectPreset(preset: Preset) {
		item.name = preset.name;
		if (!kids) item.price = preset.price;
		item.quantity = preset.quantity ?? 1;
		item.unit = preset.unit || 'Item';
		showPresets = false;
		nameSearch = '';
		change();
	}

	function handleUnitFocus() {
		showUnits = true;
		showPresets = false;
	}
	function handleUnitBlur() {
		setTimeout(() => (showUnits = false), 150);
		notifySave();
	}
	function selectUnit(unit: string) {
		item.unit = unit;
		showUnits = false;
		change();
	}

	function toggleFlag() {
		item.flagged = !item.flagged;
		change();
	}
	function toggleHidden() {
		item.hidden = !item.hidden;
		change();
	}

	function addChild() {
		if (!Array.isArray(item.children)) item.children = [];
		item.children = [...item.children, blankItem()];
		item.collapsed = false;
		change();
	}
	function deleteChild(id: string) {
		item.children = (item.children || []).filter((c) => c.id !== id);
		change();
	}
	function toggleCollapsed() {
		item.collapsed = !item.collapsed;
		change();
	}

	/* ---------------------------------------------------------- drag & drop */

	function onDragStart(e: DragEvent) {
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', item.id);
			e.dataTransfer.effectAllowed = 'move';
			// drag the whole line, not just the little grip icon
			if (gridEl) e.dataTransfer.setDragImage(gridEl, 24, 12);
		}
		beginDrag({
			kind: isChild ? 'child' : 'item',
			path,
			label: item.name || 'Untitled line',
			hasKids: kids
		});
	}
	function onDragEnd() {
		dropEdge = null;
		endDrag();
	}

	$: selfTarget = {
		kind: isChild ? 'child' : 'item',
		path
	} as DropTarget;

	function onDragOver(e: DragEvent) {
		if (!$dragging) return;
		const edge = edgeFromEvent(e, rowEl);
		if (!canDrop($dragging, { ...selfTarget, edge })) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dropEdge = edge;
	}
	/** dragleave also fires when the pointer crosses into a child element —
	    ignore those so the insertion line doesn't flicker while moving. */
	function reallyLeft(e: DragEvent): boolean {
		const from = e.currentTarget as HTMLElement;
		const to = e.relatedTarget as Node | null;
		return !to || !from.contains(to);
	}

	function onDragLeave(e: DragEvent) {
		if (reallyLeft(e)) dropEdge = null;
	}
	function onDrop(e: DragEvent) {
		if (!dropEdge) return;
		e.preventDefault();
		e.stopPropagation();
		const edge = dropEdge;
		dropEdge = null;
		dropOn({ ...selfTarget, edge });
	}

	/** Drop zone at the end of this line's sub-item list */
	let childEndActive = false;
	$: childEndTarget = { kind: 'children-end', path } as DropTarget;
	function onChildEndOver(e: DragEvent) {
		if (!canDrop($dragging, childEndTarget)) return;
		e.preventDefault();
		e.stopPropagation();
		childEndActive = true;
	}
	function onChildEndDrop(e: DragEvent) {
		if (!childEndActive) return;
		e.preventDefault();
		e.stopPropagation();
		childEndActive = false;
		dropOn(childEndTarget);
	}

	$: groupedFilteredPresetArray = Object.entries(
		(availablePresets || [])
			.filter((p) => p.name.toLowerCase().includes(nameSearch.toLowerCase()))
			.reduce(
				(acc, preset) => {
					const type = preset.type || 'Uncategorized';
					if (!acc[type]) acc[type] = [];
					acc[type].push(preset);
					return acc;
				},
				{} as { [type: string]: Preset[] }
			)
	);

	$: kids = hasChildren(item);
	$: budgTotal = itemBudgetedTotal(item);
	$: actTotal = itemActualTotal(item);
	$: hasActual = itemHasActual(item);
	$: rowText = item.flagged ? 'text-problem' : 'text-white';
	// Flagged: inputs get the problem tint (not the whole row)
	$: inputBg = item.flagged ? 'bg-problem/15' : 'bg-gray1';
	$: isDragged =
		$dragging &&
		$dragging.kind === (isChild ? 'child' : 'item') &&
		$dragging.path.cat === path.cat &&
		$dragging.path.sub === path.sub &&
		$dragging.path.item === path.item &&
		(!isChild || $dragging.path.child === path.child);
</script>

<div class="relative" bind:this={rowEl} on:dragover={onDragOver} on:dragleave={onDragLeave} on:drop={onDrop} role="listitem">
	{#if dropEdge}
		<div class="drop-line" class:bottom={dropEdge === 'after'}></div>
	{/if}

	<div
		bind:this={gridEl}
		class="row-grid items-center rounded-lg px-0.5 transition-opacity duration-150
		{item.hidden ? 'opacity-40' : ''} {isDragged ? 'opacity-30' : ''}"
		in:fade|local={{ duration: 150 }}
	>
		<!-- Drag handle -->
		<button
			type="button"
			draggable="true"
			on:dragstart={onDragStart}
			on:dragend={onDragEnd}
			class="grip w-4 h-5 flex items-center justify-center text-gray2/40 hover:text-white transition-colors"
			title="Drag to move — reorder, move to another section, or drop on a line to nest it"
			aria-label="Drag to move line"
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="4" y1="8" x2="20" y2="8" />
				<line x1="4" y1="12" x2="20" y2="12" />
				<line x1="4" y1="16" x2="20" y2="16" />
			</svg>
		</button>

		<!-- Flag -->
		<button
			type="button"
			on:click={toggleFlag}
			class="w-[18px] h-5 flex items-center justify-center cursor-pointer transition-colors
			{item.flagged ? 'text-problem' : 'text-gray2/50 hover:text-gray2'}"
			title={item.flagged ? 'Unflag line' : 'Flag line to be revised'}
			aria-label="Flag line"
		>
			<!-- warning triangle with exclamation mark -->
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill={item.flagged ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
				<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linejoin="round" />
				<line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" stroke={item.flagged ? '#1a1a1a' : 'currentColor'} />
				<circle cx="12" cy="16.5" r="0.5" fill={item.flagged ? '#1a1a1a' : 'currentColor'} stroke={item.flagged ? '#1a1a1a' : 'currentColor'} stroke-width="1.5" />
			</svg>
		</button>

		<!-- Add sub-item (top-level lines only) -->
		{#if isChild}
			<div></div>
		{:else}
			<button
				type="button"
				on:click={addChild}
				class="w-4 h-5 flex items-center justify-center cursor-pointer text-gray2/50 hover:text-lime transition-colors"
				title="Add a sub-item (breaks this cost down)"
				aria-label="Add sub-item"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
		{/if}

		<!-- Name (+ collapse chevron / sub-item indent) -->
		<div class="relative min-w-0 flex items-center" style={isChild ? 'padding-left: 14px' : ''}>
			{#if isChild}
				<span class="absolute left-1 top-1/2 -translate-y-1/2 text-gray2/30 text-[10px] leading-none select-none" aria-hidden="true">└</span>
			{/if}
			{#if kids}
				<button
					type="button"
					on:click={toggleCollapsed}
					class="w-4 h-5 -ml-0.5 mr-0.5 flex items-center justify-center text-gray2 hover:text-lime transition-transform duration-150 flex-shrink-0"
					style={item.collapsed ? 'transform: rotate(-90deg)' : ''}
					title={item.collapsed ? 'Show sub-items' : 'Hide sub-items'}
					aria-label="Toggle sub-items"
				>
					<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>
			{/if}
			<input
				type="text"
				bind:value={item.name}
				disabled={item.hidden}
				on:focus={handleNameFocus}
				on:input={(e) => {
					nameSearch = e.currentTarget.value;
					change();
				}}
				on:blur={handleNameBlur}
				placeholder="Type or select preset"
				class="w-full min-w-0 {inputBg} {rowText} {kids ? 'font-semibold' : ''} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
			/>
			{#if showPresets && groupedFilteredPresetArray.length > 0}
				<div class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-white/10 rounded-lg shadow-xl z-20 max-h-32 overflow-y-auto custom-scroll">
					{#each groupedFilteredPresetArray as [type, presets]}
						<div class="px-3 py-1 text-lime text-xs font-bold uppercase tracking-wider">{type}</div>
						{#each presets as preset}
							<button
								type="button"
								class="w-full text-left px-3 py-1 text-white hover:bg-lime hover:text-black cursor-pointer text-[12px]"
								on:mousedown={() => selectPreset(preset)}
							>
								{preset.name}
							</button>
						{/each}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Budgeted $ — computed (read-only) when the line has sub-items -->
		{#if kids}
			<div
				class="w-full rounded-lg px-2 py-1 text-[12px] bg-white/[0.03] border border-dashed border-white/10 {rowText} truncate cursor-default"
				title="Sum of sub-items"
			>
				{formatMoney(itemBudgetedUnit(item))}
			</div>
		{:else}
			<BudgetCurrencyInput
				bind:value={item.price}
				disabled={item.hidden}
				on:input={notifyUpdate}
				on:blur={notifySave}
				class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
			/>
		{/if}

		<!-- Actual $ — computed (read-only) when the line has sub-items -->
		{#if kids}
			<div
				class="w-full rounded-lg px-2 py-1 text-[12px] bg-white/[0.03] border border-dashed border-white/10 {hasActual ? 'text-problem' : rowText} truncate cursor-default"
				title="Sum of sub-items"
			>
				{formatMoney(itemActualUnit(item))}
			</div>
		{:else}
			<BudgetCurrencyInput
				bind:value={item.actual}
				disabled={item.hidden}
				on:input={notifyUpdate}
				on:blur={notifySave}
				class="w-full {inputBg} {hasActual ? 'text-problem' : rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2/60"
			/>
		{/if}

		<!-- Qty -->
		<input
			type="number"
			min="0"
			max="99999"
			step="1"
			bind:value={item.quantity}
			disabled={item.hidden}
			on:input={(e) => {
				// keep quantities sane (and inside the column) — 5 digits max
				const n = Number(e.currentTarget.value);
				if (n > 99999) item.quantity = 99999;
				notifyUpdate();
			}}
			on:keydown={commitOnEnter}
			on:blur={notifySave}
			placeholder="1"
			class="w-full min-w-0 {inputBg} {rowText} rounded-lg px-1 py-1 text-[12px] placeholder-gray2 text-center"
		/>

		<!-- Unit -->
		<div class="relative">
			<input
				type="text"
				bind:value={item.unit}
				disabled={item.hidden}
				on:focus={handleUnitFocus}
				on:input={notifyUpdate}
				on:keydown={commitOnEnter}
				on:blur={handleUnitBlur}
				placeholder="Item"
				class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
			/>
			{#if showUnits}
				<div class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-white/10 rounded-lg shadow-xl z-20 max-h-32 overflow-y-auto custom-scroll">
					{#each unitOptions as unit}
						<button
							type="button"
							class="w-full text-left px-3 py-1 text-white hover:bg-lime hover:text-black cursor-pointer text-[12px]"
							on:mousedown={() => selectUnit(unit)}
						>
							{unit}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Totals: budgeted (and actual underneath when set) -->
		<div class="text-left leading-tight pl-2">
			<div class="{rowText} text-[12px] font-medium whitespace-nowrap">{formatMoney(budgTotal)}</div>
			{#if hasActual}
				<div class="text-problem text-[10px] font-medium whitespace-nowrap">{formatMoney(actTotal)}</div>
			{/if}
		</div>

		<!-- Actions: hide + delete -->
		<div class="flex items-center justify-end gap-0.5">
			<button
				type="button"
				on:click={toggleHidden}
				class="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0 transition-colors {item.hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
				title={item.hidden ? 'Show line (include in totals)' : 'Hide line (exclude from totals)'}
				aria-label="Toggle line visibility"
			>
				{#if item.hidden}
					<!-- eye-off -->
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
						<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
						<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
						<line x1="1" y1="1" x2="23" y2="23" />
					</svg>
				{:else}
					<!-- eye -->
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				{/if}
			</button>
			<button
				type="button"
				on:click={() => dispatch('delete')}
				class="w-5 h-5 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer flex-shrink-0 transition-colors"
				title="Delete line"
				aria-label="Delete line"
			>
				<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Sub-items -->
	{#if kids && !item.collapsed && !item.hidden}
		<div class="space-y-1 pt-1" transition:slide|local={{ duration: 160 }}>
			{#each item.children as child, ci (child.id)}
				<svelte:self
					bind:item={item.children[ci]}
					{availablePresets}
					isChild={true}
					path={{ cat: path.cat, sub: path.sub, item: path.item, child: ci }}
					on:update={notifyUpdate}
					on:save={notifySave}
					on:delete={() => deleteChild(child.id)}
				/>
			{/each}
			<!-- drop zone at the end of the sub-item list -->
			<div
				class="drop-zone {childEndActive ? 'active' : ''}"
				on:dragover={onChildEndOver}
				on:dragleave={(e) => reallyLeft(e) && (childEndActive = false)}
				on:drop={onChildEndDrop}
				role="presentation"
			></div>
		</div>
	{/if}
</div>

<style>
	.row-grid {
		display: grid;
		grid-template-columns: 16px 18px 16px minmax(0, 1fr) minmax(62px, 82px) minmax(62px, 82px) minmax(46px, 56px) minmax(44px, 56px) minmax(66px, 78px) 42px;
		gap: 4px;
	}
	.grip {
		cursor: grab;
	}
	.grip:active {
		cursor: grabbing;
	}
	.drop-line {
		position: absolute;
		left: 0;
		right: 0;
		top: -2px;
		height: 2px;
		border-radius: 9999px;
		background: #e1ff00;
		box-shadow: 0 0 6px rgba(225, 255, 0, 0.6);
		z-index: 10;
		pointer-events: none;
	}
	.drop-line.bottom {
		top: auto;
		bottom: -2px;
	}
	.drop-zone {
		height: 6px;
		border-radius: 6px;
		background: transparent;
		transition: background 0.12s ease;
	}
	.drop-zone.active { background: rgba(225, 255, 0, 0.35); }
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
	.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
	.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
</style>
