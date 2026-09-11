<!--
  BudgetIncomePanel — the money coming in, and what it is allowed to pay for.

  Custom budgets only — the standard types keep their fixed income fields.
  Here you name your own sections, and each one creates the matching expense
  category, so the two sides can never drift apart.

      Technical                        13,000.00$
        Labour 6,000 · Rentals 2,000 · Audio 5,000

  Link icon lime = reserved for that expense section only.
  Link icon grey = pooled, so it covers an overrun anywhere.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Writable } from 'svelte/store';
	import {
		formatMoney,
		blankIncomeLine,
		blankIncomeSection,
		incomeSectionViews,
		incomeSectionsTotal,
		expenseCategoriesOf
	} from '$lib/utils/budgetUtils';
	import {
		canLinkLine,
		linkLine,
		unlinkLine,
		syncLineName,
		releaseLine,
		createCategoryFor,
		syncSectionName,
		releaseSection
	} from '$lib/utils/budgetPairing';
	import type { BudgetSubsection } from '$lib/types/budget';
	import BudgetIncomeSectionCard from './BudgetIncomeSectionCard.svelte';
	import { dragging, dropOn, canDrop } from '$lib/utils/budgetDnd';
	import type { DropTarget } from '$lib/utils/budgetDnd';

	export let budgetStore: Writable<any>;

	const dispatch = createEventDispatcher();
	let newName = '';
	let endActive = false;

	/* Dropping a section past the last one. */
	const endTarget = {
		kind: 'sections-end',
		path: { cat: 'income', sub: -1, item: -1, child: -1 }
	} as DropTarget;
	function onEndOver(e: DragEvent) {
		if (!canDrop($dragging, endTarget)) return;
		e.preventDefault();
		endActive = true;
	}
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

	/** Commit a mutation made straight on the store object. */
	function commit(keys: string[] = []) {
		budgetStore.update((s) => (s ? { ...s } : s));
		for (const key of new Set(['income_sections', ...keys])) dispatch('save', { key });
	}

	const notifyUpdate = () => budgetStore.update((s) => (s ? { ...s } : s));
	const notifySave = () => dispatch('save', { key: 'income_sections' });

	function addSection() {
		const clean = newName.trim();
		if (!clean) return;
		const state = $budgetStore;
		const section = blankIncomeSection(clean, null);
		state.income = [...(state.income || []), section];
		// A custom income section owns an expense category of the same name.
		const keys = createCategoryFor(state, section);
		newName = '';
		commit(keys);
	}

	function deleteSection(section: BudgetSubsection) {
		const state = $budgetStore;
		const keys = releaseSection(state, section);
		state.income = (state.income || []).filter((s: BudgetSubsection) => s.id !== section.id);
		commit(keys);
	}

	function renameSection(section: BudgetSubsection) {
		commit(syncSectionName($budgetStore, section));
	}

	function toggleFence(section: BudgetSubsection) {
		section.fenced = !section.fenced;
		commit();
	}

	function addLine(section: BudgetSubsection) {
		section.items = [...(section.items || []), blankIncomeLine()];
		commit();
	}

	function toggleLink(section: BudgetSubsection, index: number) {
		const state = $budgetStore;
		const line = section.items[index];
		const keys = line.fenced ? unlinkLine(state, section, line) : linkLine(state, section, line);
		commit(keys);
	}

	function renameLine(section: BudgetSubsection, index: number) {
		commit(syncLineName($budgetStore, section, section.items[index]));
	}

	function deleteLine(section: BudgetSubsection, index: number) {
		const state = $budgetStore;
		const line = section.items[index];
		const keys = releaseLine(state, section, line);
		section.items = section.items.filter((i: any) => i.id !== line.id);
		commit(keys);
	}

	$: state = $budgetStore;
	$: views = state ? incomeSectionViews(state) : [];
	$: categories = state ? expenseCategoriesOf(state) : [];
	$: labelFor = (target: string | null | undefined) =>
		target ? categories.find((c) => `cat:${c.key}` === target)?.label || '' : '';
	$: totalBudgeted = incomeSectionsTotal(views.map((v) => v.section));
</script>

<div class="bg-gray1 rounded-lg p-3">
	<div class="flex items-baseline justify-between gap-2 mb-2 pb-2 border-b border-gray2/20">
		<h3 class="text-white font-bold text-sm">Budget / Income (+)</h3>
		<span class="text-confirmed font-bold text-sm">{formatMoney(totalBudgeted)}</span>
	</div>

	<div class="space-y-2">
		{#each views as view (view.section.id)}
			{@const target = view.section.target}
			<BudgetIncomeSectionCard
				bind:name={$budgetStore.income[view.index].name}
				bind:hidden={$budgetStore.income[view.index].hidden}
				bind:items={$budgetStore.income[view.index].items}
				bind:amount={$budgetStore.income[view.index].amount}
				subIndex={view.index}
				fenced={view.section.fenced === true}
				hasCategory={!!target}
				canLinkLines={canLinkLine(state, view.section)}
				categoryLabel={labelFor(target)}
				on:update={notifyUpdate}
				on:save={notifySave}
				on:rename={() => renameSection(view.section)}
				on:delete={() => deleteSection(view.section)}
				on:togglefence={() => toggleFence(view.section)}
				on:addline={() => addLine(view.section)}
				on:togglelink={(e) => toggleLink(view.section, e.detail)}
				on:renameline={(e) => renameLine(view.section, e.detail)}
				on:deleteline={(e) => deleteLine(view.section, e.detail)}
			/>
		{/each}

		<div
			class="drop-zone {endActive ? 'active' : ''}"
			on:dragover={onEndOver}
			on:dragleave={(e) => reallyLeft(e) && (endActive = false)}
			on:drop={onEndDrop}
			role="presentation"
		></div>
	</div>

	{#if views.length === 0}
		<p class="text-gray2 text-[11px] leading-snug mt-2">
			No budget sections yet. Add one below — it creates the matching expense category on
			the left, so you can budget against it straight away.
		</p>
	{/if}

	<div class="flex gap-1.5 mt-2.5">
		<input
			type="text"
			bind:value={newName}
			placeholder="New budget section"
			on:keydown={(e) => e.key === 'Enter' && addSection()}
			class="flex-1 min-w-0 bg-black/15 text-white rounded-2xl px-2.5 py-1 text-[11px] placeholder-gray3"
		/>
		<button
			type="button"
			on:click={addSection}
			disabled={newName.trim() === ''}
			class="px-2.5 py-1 bg-lime text-black text-[11px] font-bold rounded-2xl hover:bg-lime/90 cursor-pointer disabled:opacity-50 flex-shrink-0"
		>
			+ Add
		</button>
	</div>
</div>

<style>
	.drop-zone { height: 8px; border-radius: 6px; background: transparent; transition: background 0.12s ease; }
	.drop-zone.active { background: rgba(225, 255, 0, 0.35); }
</style>
