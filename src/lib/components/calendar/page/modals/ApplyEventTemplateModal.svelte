<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import {
		listEventTemplates,
		templateCategoryHasContent,
		EVENT_TEMPLATE_CATEGORIES,
		type EventTemplate,
		type EventTemplateCategory
	} from '$lib/services/templateService';

	// Apply Event Template (header 3-dots): pick a template, review every
	// category (expandable, toggleable), then load the toggled-on rows into
	// this event's viewed version.
	export let isOpen = false;
	export let event: any = null;
	export let viewedVersionNum: number = 1;

	const dispatch = createEventDispatcher();

	let templates: EventTemplate[] = [];
	let loading = false;
	let applying = false;
	let errorText = '';
	let selected: EventTemplate | null = null;
	let toggles: Record<string, boolean> = {};
	let expanded: Record<string, boolean> = {};
	// true = Add (append to existing rows) / false = Overwrite (replace section).
	let modes: Record<string, boolean> = {};

	$: targetId = event?.calendar?.id || event?.group_id || event?.id;

	$: if (isOpen) load();

	async function load() {
		selected = null;
		errorText = '';
		loading = true;
		templates = await listEventTemplates();
		loading = false;
	}

	function selectTemplate(t: EventTemplate) {
		selected = t;
		toggles = {};
		expanded = {};
		for (const cat of EVENT_TEMPLATE_CATEGORIES) {
			// Empty categories are off by default (nothing to load anyway).
			toggles[cat] = templateCategoryHasContent(t, cat);
			expanded[cat] = false;
		}
		// Default Add/Overwrite per section from the template's own setting.
		modes = {
			'Fixed Costs': t.addMode?.fixed !== false,
			'Variable Costs': t.addMode?.variable !== false,
			'Ticket Scaling': t.addMode?.tickets !== false
		};
	}

	function categorySummary(t: EventTemplate, cat: EventTemplateCategory): string {
		if (cat === 'Fixed Costs') {
			const n = t.fixedCosts.reduce((s, g) => s + g.costs.length, 0);
			return n ? `${n} costs in ${t.fixedCosts.length} group${t.fixedCosts.length === 1 ? '' : 's'}` : 'Empty';
		}
		if (cat === 'Variable Costs') {
			return t.variableCosts.length ? `${t.variableCosts.length} costs` : 'Empty';
		}
		return t.tickets.length ? `${t.tickets.length} tiers` : 'Empty';
	}

	const money = (v: number) =>
		(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	function parseMaybe(raw: any): any {
		if (!raw) return null;
		if (typeof raw === 'object') return raw;
		try {
			let p = JSON.parse(raw);
			if (typeof p === 'string') p = JSON.parse(p);
			return p;
		} catch {
			return null;
		}
	}

	async function apply() {
		if (!selected || applying || !targetId) return;
		applying = true;
		errorText = '';
		try {
			const { data } = await supabase
				.from('calendar_data')
				.select('event_cost, event_revenue')
				.eq('calendar_id', targetId)
				.eq('version_number', viewedVersionNum)
				.maybeSingle();

			const update: any = {};

			if (toggles['Fixed Costs'] || toggles['Variable Costs']) {
				const cost = parseMaybe(data?.event_cost) || {};
				// "Add" appends to what's there; "Overwrite" replaces the section.
				let fixedCosts =
					toggles['Fixed Costs'] && !modes['Fixed Costs']
						? []
						: Array.isArray(cost.fixedCosts)
							? cost.fixedCosts
							: [];
				let variableCosts =
					toggles['Variable Costs'] && !modes['Variable Costs']
						? []
						: Array.isArray(cost.variableCosts)
							? cost.variableCosts
							: [];

				if (toggles['Fixed Costs']) {
					for (const g of selected.fixedCosts) {
						fixedCosts.push({
							id: crypto.randomUUID(),
							category: g.category || 'General',
							type: g.type || '(No Type)',
							costs: g.costs.map((c) => ({
								id: crypto.randomUUID(),
								name: c.name || 'Unnamed',
								qty: Number(c.qty) || 0,
								cost: Number(c.cost) || 0,
								estimatedInternal:
									c.estimatedInternal != null
										? Number(c.estimatedInternal) || 0
										: (Number(c.qty) || 0) * (Number(c.cost) || 0),
								actualInternal: 0,
								externalSettlement: 0,
								internalNotes: c.internalNotes || '',
								externalNotes: c.externalNotes || '',
								reported: c.reported !== false
							}))
						});
					}
				}
				if (toggles['Variable Costs']) {
					for (const v of selected.variableCosts) {
						variableCosts.push({
							id: crypto.randomUUID(),
							name: v.name || 'Unnamed',
							type: v.type || 'Flat',
							internalAmount: Number(v.amount) || 0,
							externalAmount: Number(v.amount) || 0,
							reported: true
						});
					}
				}
				update.event_cost = { ...cost, fixedCosts, variableCosts };
			}

			if (toggles['Ticket Scaling']) {
				const revenue = parseMaybe(data?.event_revenue) || {};
				const tickets = modes['Ticket Scaling']
					? Array.isArray(revenue.tickets)
						? revenue.tickets
						: []
					: [];
				for (const r of selected.tickets) {
					tickets.push({
						id: crypto.randomUUID(),
						name: r.name || 'Tier',
						allotment: Number(r.allotment) || 0,
						comps: Number(r.comps) || 0,
						kills: Number(r.kills) || 0,
						price: Number(r.price) || 0,
						estSold: Number(r.estSold) || 0,
						sold: 0,
						extSold: 0,
						ticketFees: 0
					});
				}
				update.event_revenue = { ...revenue, tickets };
			}

			if (Object.keys(update).length > 0) {
				const { error } = await supabase
					.from('calendar_data')
					.update(update)
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum);
				if (error) throw error;
			}

			dispatch('applied');
			isOpen = false;
		} catch (err) {
			console.error('❌ [templates] Failed to apply event template:', err);
			errorText = 'Failed to apply the template.';
		} finally {
			applying = false;
		}
	}

	$: anyToggled = selected ? EVENT_TEMPLATE_CATEGORIES.some((c) => toggles[c]) : false;
</script>

{#if isOpen}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[85vh]"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="p-6 border-b border-gray2/10 flex justify-between items-center shrink-0">
				<h2 class="text-2xl font-bold text-white tracking-wide">
					{selected ? selected.name : 'Apply Event Template'}
				</h2>
				<button
					type="button"
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
				{#if loading}
					<p class="text-gray2 font-bold text-sm py-6 text-center">Loading templates...</p>
				{:else if !selected}
					{#each templates as t (t.id)}
						<button
							type="button"
							on:click={() => selectTemplate(t)}
							class="flex items-center justify-between bg-gray1 rounded-2xl px-4 py-3 text-left hover:bg-gray1/60 transition-colors cursor-pointer group"
						>
							<div class="min-w-0">
								<p class="text-white font-bold text-sm group-hover:text-lime transition-colors truncate">
									{t.name}
								</p>
								<p class="text-gray2 text-xs font-medium mt-0.5">
									{EVENT_TEMPLATE_CATEGORIES.filter((c) => templateCategoryHasContent(t, c)).join(', ') || 'Empty'}
								</p>
							</div>
							<span class="text-xs font-black uppercase tracking-widest text-gray2 group-hover:text-lime transition-colors shrink-0">
								Select →
							</span>
						</button>
					{:else}
						<p class="text-gray2 text-sm font-bold py-4 text-center">
							No event templates yet — create one in Settings → Templates.
						</p>
					{/each}
				{:else}
					<p class="text-gray2 text-xs font-bold mb-1">
						Toggle the categories to load into <span class="text-white">Version {viewedVersionNum}</span> —
						<span class="text-white">Add</span> appends to what's there,
						<span class="text-white">Overwrite</span> replaces the section.
					</p>
					{#each EVENT_TEMPLATE_CATEGORIES as cat (cat)}
						{@const hasContent = templateCategoryHasContent(selected, cat)}
						<div class="bg-gray1/50 rounded-2xl overflow-hidden">
							<div class="flex items-center justify-between px-4 py-3 gap-3">
								<button
									type="button"
									on:click={() => (expanded[cat] = !expanded[cat])}
									class="flex items-center gap-2 min-w-0 cursor-pointer text-left flex-1"
								>
									<svg
										class="w-4 h-4 text-lime transition-transform shrink-0 {expanded[cat] ? 'rotate-90' : ''}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg
									>
									<span class="text-sm font-black text-white">{cat}</span>
									<span class="text-[11px] font-bold text-gray2 truncate">{categorySummary(selected, cat)}</span>
								</button>
								{#if toggles[cat] && hasContent}
									<div class="flex items-center rounded-full bg-black/40 p-0.5 shrink-0">
										<button
											type="button"
											class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer {modes[cat]
												? 'bg-lime text-black'
												: 'text-gray2 hover:text-white'}"
											on:click={() => (modes[cat] = true)}
										>
											Add
										</button>
										<button
											type="button"
											class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer {!modes[cat]
												? 'bg-lime text-black'
												: 'text-gray2 hover:text-white'}"
											on:click={() => (modes[cat] = false)}
										>
											Overwrite
										</button>
									</div>
								{/if}
								<button
									type="button"
									role="switch"
									aria-checked={toggles[cat]}
									aria-label={`Toggle ${cat}`}
									disabled={!hasContent}
									on:click={() => hasContent && (toggles[cat] = !toggles[cat])}
									class="relative inline-flex h-5 w-10 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out {!hasContent
										? 'bg-[#333] opacity-40 cursor-not-allowed'
										: toggles[cat]
											? 'bg-lime cursor-pointer'
											: 'bg-[#444] cursor-pointer'}"
								>
									<span
										aria-hidden="true"
										class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out {toggles[cat]
											? 'translate-x-5'
											: 'translate-x-0'}"
									></span>
								</button>
							</div>

							{#if expanded[cat]}
								<div class="px-4 pb-3 text-xs text-gray2 font-medium" transition:slide={{ duration: 150 }}>
									{#if cat === 'Fixed Costs'}
										{#each selected.fixedCosts as g}
											<p class="font-bold text-gray3 mt-1">{g.category}</p>
											{#each g.costs as c}
												<p class="flex justify-between py-0.5"><span>{c.name}</span><span>{c.qty} × ${money(c.cost)}</span></p>
											{/each}
										{:else}
											<p class="py-1">Empty</p>
										{/each}
									{:else if cat === 'Variable Costs'}
										{#each selected.variableCosts as v}
											<p class="flex justify-between py-0.5"><span>{v.name}</span><span>{v.type} · {money(v.amount)}</span></p>
										{:else}
											<p class="py-1">Empty</p>
										{/each}
									{:else}
										{#each selected.tickets as t}
											<p class="flex justify-between py-0.5"><span>{t.name}</span><span>{t.allotment} @ ${money(t.price)}</span></p>
										{:else}
											<p class="py-1">Empty</p>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
					{#if errorText}
						<p class="text-problem text-xs font-bold mt-1">{errorText}</p>
					{/if}
				{/if}
			</div>

			<div class="p-5 border-t border-gray2/10 flex justify-between items-center shrink-0">
				{#if selected}
					<button
						type="button"
						on:click={() => (selected = null)}
						class="px-5 py-2.5 bg-gray1 text-white font-bold text-sm rounded-full hover:text-lime transition-colors cursor-pointer"
					>
						← Back
					</button>
					<div class="flex gap-3">
						<button
							type="button"
							on:click={() => (isOpen = false)}
							class="px-6 py-2.5 bg-gray3 text-black hover:bg-white font-bold text-sm rounded-full transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="button"
							on:click={apply}
							disabled={applying || !anyToggled}
							class="px-6 py-2.5 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
						>
							{applying ? 'Applying...' : 'Apply Template'}
						</button>
					</div>
				{:else}
					<span></span>
					<button
						type="button"
						on:click={() => (isOpen = false)}
						class="px-6 py-2.5 bg-gray3 text-black hover:bg-white font-bold text-sm rounded-full transition-colors cursor-pointer"
					>
						Close
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
