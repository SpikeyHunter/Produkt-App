<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSTour, SSTourDate, TourBudget, TourBudgetSection, TourBudgetItem } from '$lib/types/tour';
	import { saveTourBudget } from '$lib/services/tourService';

	export let open = false;
	export let tour: SSTour | null = null;
	export let tourDates: SSTourDate[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	let budget: TourBudget = {};
	let saving = false;
	let dirty = false;
	let lastTourId: string | null = null;

	// (re)load budget when the modal opens for a tour
	$: if (open && tour && tour.id !== lastTourId) {
		lastTourId = tour.id;
		budget = structuredClone(tour.budget || {});
		if (!budget.target_per_show) budget.target_per_show = 15000;
		if (!budget.sections?.length) {
			budget.sections = [
				{ id: uid(), name: 'Solotech', items: [] },
				{ id: uid(), name: 'Décors', items: [] },
				{ id: uid(), name: 'Transport', items: [] }
			];
		}
		if (!budget.bus) budget.bus = [];
		if (!budget.preproduction) budget.preproduction = [];
		dirty = false;
	}
	$: if (!open) lastTourId = null;

	const changed = () => {
		budget = { ...budget };
		dirty = true;
	};

	// ---- totals ----
	const sumItems = (items: TourBudgetItem[] = []) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

	$: showCount = tourDates.filter((d) => (d.type || 'Tour Date') === 'Tour Date').length;
	$: sectionsTotal = (budget.sections || []).reduce((s, sec) => s + sumItems(sec.items), 0);
	$: busTotal = sumItems(budget.bus);
	$: preproTotal = sumItems(budget.preproduction);
	$: grandTotal = sectionsTotal + busTotal + preproTotal;
	$: target = (budget.target_per_show || 15000) * showCount;
	$: perShow = showCount > 0 ? sectionsTotal / showCount : 0;
	$: overTarget = showCount > 0 && sectionsTotal > target;

	const cad = (n: number) =>
		n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });

	// ---- mutations ----
	function addSection() {
		budget.sections = [...(budget.sections || []), { id: uid(), name: 'New section', items: [] }];
		changed();
	}
	function removeSection(id: string) {
		budget.sections = (budget.sections || []).filter((s) => s.id !== id);
		changed();
	}
	function addItem(section: TourBudgetSection) {
		section.items = [...section.items, { id: uid(), label: '', amount: 0 }];
		changed();
	}
	function removeItem(section: TourBudgetSection, id: string) {
		section.items = section.items.filter((i) => i.id !== id);
		changed();
	}
	function addExtra(list: 'bus' | 'preproduction') {
		budget[list] = [...(budget[list] || []), { id: uid(), label: '', amount: 0 }];
		changed();
	}
	function removeExtra(list: 'bus' | 'preproduction', id: string) {
		budget[list] = (budget[list] || []).filter((i) => i.id !== id);
		changed();
	}

	async function save() {
		if (!tour) return;
		saving = true;
		try {
			await saveTourBudget(tour.id, budget);
			dirty = false;
			dispatch('saved', budget);
		} catch (e) {
			console.error('Failed to save tour budget', e);
		} finally {
			saving = false;
		}
	}

	function close() {
		open = false;
		dispatch('close');
	}
</script>

{#if open && tour}
	<!-- backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
		on:click|self={close}
		role="presentation"
	>
		<div class="bg-navbar rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
			<!-- header -->
			<div class="flex items-center gap-3 px-6 py-4 border-b border-gray1 shrink-0">
				<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
				</svg>
				<div class="flex-1 min-w-0">
					<h2 class="text-lg font-bold text-white truncate">Tour Budget — {tour.name}</h2>
					<p class="text-[10px] uppercase tracking-widest text-gray2">Production · CAD · Restricted</p>
				</div>
				<span class="text-[9px] font-black uppercase tracking-widest text-problem bg-problem/10 px-2 py-0.5 rounded-md shrink-0">
					Restricted
				</span>
				<button class="text-gray2 hover:text-white transition shrink-0" on:click={close} aria-label="Close">
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- target summary -->
			<div class="px-6 py-3 border-b border-gray1 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
				<div>
					<p class="text-[10px] uppercase tracking-wider text-gray2">Target / show</p>
					<div class="flex items-center gap-1">
						<input
							type="number"
							class="w-24 bg-black/40 border border-gray1 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-lime"
							bind:value={budget.target_per_show}
							on:input={changed}
						/>
						<span class="text-xs text-gray2">CAD</span>
					</div>
				</div>
				<div>
					<p class="text-[10px] uppercase tracking-wider text-gray2">Show dates</p>
					<p class="text-lg font-black text-white">{showCount}</p>
				</div>
				<div>
					<p class="text-[10px] uppercase tracking-wider text-gray2">Total target</p>
					<p class="text-lg font-black text-white">{cad(target)}</p>
				</div>
				<div>
					<p class="text-[10px] uppercase tracking-wider text-gray2">Per show (actual)</p>
					<p class="text-lg font-black {overTarget ? 'text-problem' : 'text-confirmed'}">
						{showCount > 0 ? cad(perShow) : '—'}
					</p>
				</div>
			</div>

			<!-- body -->
			<div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
				<!-- per-show production sections -->
				{#each budget.sections || [] as section (section.id)}
					<div class="bg-black/30 border border-gray1 rounded-xl p-4 space-y-2">
						<div class="flex items-center gap-2">
							<input
								class="flex-1 bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-lime"
								bind:value={section.name}
								on:input={changed}
							/>
							<span class="text-sm font-black text-lime shrink-0">{cad(sumItems(section.items))}</span>
							<button class="text-gray2 hover:text-problem transition shrink-0" on:click={() => removeSection(section.id)} aria-label="Remove section">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>
						{#each section.items as item (item.id)}
							<div class="flex items-center gap-2">
								<input
									class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime"
									placeholder="Item"
									bind:value={item.label}
									on:input={changed}
								/>
								<input
									type="number"
									class="w-28 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-lime"
									bind:value={item.amount}
									on:input={changed}
								/>
								<button class="text-gray2 hover:text-problem transition" on:click={() => removeItem(section, item.id)} aria-label="Remove item">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{/each}
						<button class="text-xs text-gray2 hover:text-lime transition" on:click={() => addItem(section)}>
							+ Add item
						</button>
					</div>
				{/each}
				<button
					class="w-full py-2 rounded-xl border border-dashed border-gray1 text-sm text-gray2 hover:border-lime hover:text-lime transition"
					on:click={addSection}
				>
					+ Add section
				</button>

				<!-- target check -->
				<div class="rounded-xl px-4 py-3 flex items-center gap-3 {overTarget ? 'bg-problem/10 border border-problem/40' : 'bg-confirmed/10 border border-confirmed/40'}">
					<span class="w-2.5 h-2.5 rounded-full {overTarget ? 'bg-problem' : 'bg-confirmed'}"></span>
					<p class="text-sm {overTarget ? 'text-problem' : 'text-confirmed'} font-bold flex-1">
						Production: {cad(sectionsTotal)} vs target {cad(target)}
						{#if showCount > 0}
							({overTarget ? '+' : ''}{cad(sectionsTotal - target)})
						{:else}
							— add Tour Dates to compute the target
						{/if}
					</p>
				</div>

				<!-- Bus -->
				<div class="bg-black/30 border border-gray1 rounded-xl p-4 space-y-2">
					<div class="flex items-center gap-2">
						<h3 class="flex-1 text-sm font-bold text-white">🚌 Bus <span class="text-gray2 font-normal text-xs">(separate — not counted against per-show target)</span></h3>
						<span class="text-sm font-black text-lime">{cad(busTotal)}</span>
					</div>
					{#each budget.bus || [] as item (item.id)}
						<div class="flex items-center gap-2">
							<input class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime" placeholder="Item" bind:value={item.label} on:input={changed} />
							<input type="number" class="w-28 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-lime" bind:value={item.amount} on:input={changed} />
							<button class="text-gray2 hover:text-problem transition" on:click={() => removeExtra('bus', item.id)} aria-label="Remove item">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>
					{/each}
					<button class="text-xs text-gray2 hover:text-lime transition" on:click={() => addExtra('bus')}>+ Add item</button>
				</div>

				<!-- Preproduction -->
				<div class="bg-black/30 border border-gray1 rounded-xl p-4 space-y-2">
					<div class="flex items-center gap-2">
						<h3 class="flex-1 text-sm font-bold text-white">Preproduction <span class="text-gray2 font-normal text-xs">(separate)</span></h3>
						<span class="text-sm font-black text-lime">{cad(preproTotal)}</span>
					</div>
					{#each budget.preproduction || [] as item (item.id)}
						<div class="flex items-center gap-2">
							<input class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime" placeholder="Item" bind:value={item.label} on:input={changed} />
							<input type="number" class="w-28 bg-black/40 border border-gray1 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-lime" bind:value={item.amount} on:input={changed} />
							<button class="text-gray2 hover:text-problem transition" on:click={() => removeExtra('preproduction', item.id)} aria-label="Remove item">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>
					{/each}
					<button class="text-xs text-gray2 hover:text-lime transition" on:click={() => addExtra('preproduction')}>+ Add item</button>
				</div>
			</div>

			<!-- footer -->
			<div class="px-6 py-4 border-t border-gray1 flex items-center gap-3 shrink-0">
				<p class="text-sm text-gray3 flex-1">
					Grand total: <span class="font-black text-white">{cad(grandTotal)}</span>
				</p>
				<button class="px-4 py-2 rounded-lg border border-gray1 text-gray3 text-sm hover:border-gray2 transition" on:click={close}>
					Close
				</button>
				<button
					class="px-5 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
					disabled={saving || !dirty}
					on:click={save}
				>
					{saving ? 'Saving…' : dirty ? 'Save budget' : 'Saved'}
				</button>
			</div>
		</div>
	</div>
{/if}