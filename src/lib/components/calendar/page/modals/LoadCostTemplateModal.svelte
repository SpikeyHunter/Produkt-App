<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { portal } from '$lib/utils/portalUtils';
	import {
		listEventTemplates,
		templateCategoryHasContent,
		type EventTemplate
	} from '$lib/services/templateService';
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let templates: EventTemplate[] = [];
	let loading = false;

	$: if (isOpen) load();

	async function load() {
		loading = true;
		// Costs tab loads templates that carry fixed and/or variable costs.
		templates = (await listEventTemplates()).filter(
			(t) =>
				templateCategoryHasContent(t, 'Fixed Costs') ||
				templateCategoryHasContent(t, 'Variable Costs')
		);
		loading = false;
	}

	/** Expands a template into the full event_cost line shape (fresh ids). */
	function applyTemplate(t: EventTemplate) {
		const fixedCosts = t.fixedCosts.map((g) => ({
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
		}));

		const variableCosts = t.variableCosts.map((v) => ({
			id: crypto.randomUUID(),
			name: v.name || 'Unnamed',
			type: v.type || 'Flat',
			internalAmount: Number(v.amount) || 0,
			externalAmount: Number(v.amount) || 0,
			reported: true
		}));

		dispatch('apply', {
			fixedCosts,
			variableCosts,
			templateName: t.name,
			// Per-section Add/Overwrite behavior stored on the template.
			modes: { fixed: t.addMode?.fixed !== false, variable: t.addMode?.variable !== false }
		});
		isOpen = false;
	}

	function modeSummary(t: EventTemplate): string {
		const parts: string[] = [];
		if (t.fixedCosts.some((g) => g.costs.length > 0))
			parts.push(`fixed ${t.addMode?.fixed !== false ? 'adds' : 'overwrites'}`);
		if (t.variableCosts.length > 0)
			parts.push(`variable ${t.addMode?.variable !== false ? 'adds' : 'overwrites'}`);
		return parts.join(' · ');
	}

	// Jumps to Settings > Templates > Event Templates (page listens for this).
	function openManageTemplates() {
		isOpen = false;
		window.dispatchEvent(new CustomEvent('produkt:openEventTemplates'));
	}
</script>

{#if isOpen}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[85vh]"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="p-6 border-b border-gray2/10 flex justify-between items-center shrink-0">
				<h2 class="text-2xl font-bold text-white tracking-wide">Load Template</h2>
				<button
					type="button"
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
				{#if loading}
					<p class="text-gray2 font-bold text-sm py-6 text-center">Loading templates...</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each templates as t (t.id)}
							<button
								type="button"
								on:click={() => applyTemplate(t)}
								class="flex items-center justify-between bg-gray1 rounded-2xl px-4 py-3 text-left hover:bg-gray1/60 transition-colors cursor-pointer group"
							>
								<div>
									<p class="text-white font-bold text-sm group-hover:text-lime transition-colors">
										{t.name}
									</p>
									<p class="text-gray2 text-xs font-medium mt-0.5">
										{t.fixedCosts.reduce((s, g) => s + g.costs.length, 0)} fixed ·
										{t.variableCosts.length} variable — {modeSummary(t)}
									</p>
								</div>
								<span class="text-xs font-black uppercase tracking-widest text-gray2 group-hover:text-lime transition-colors">
									Apply →
								</span>
							</button>
						{:else}
							<p class="text-gray2 text-sm font-bold py-4 text-center">
								No cost templates yet — create one via Manage Templates.
							</p>
						{/each}
					</div>
				{/if}
			</div>

			<div class="p-5 border-t border-gray2/10 flex justify-between items-center shrink-0">
				<button
					type="button"
					on:click={openManageTemplates}
					class="px-5 py-2.5 bg-gray1 text-white font-bold text-sm rounded-full hover:text-lime transition-colors cursor-pointer"
				>
					Manage Templates
				</button>
				<button
					type="button"
					on:click={() => (isOpen = false)}
					class="px-6 py-2.5 bg-gray3 text-black hover:bg-white font-bold text-sm rounded-full transition-colors cursor-pointer"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
