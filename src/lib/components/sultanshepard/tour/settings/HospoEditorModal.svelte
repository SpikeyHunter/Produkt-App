<script context="module" lang="ts">
	import type { RoleRider, RiderCategory, RiderCategoryItems } from '$lib/types/tour';

	// Catalog — identical to TourRiders so the show picker exposes every option.
	export const DEFAULTS: Record<RiderCategory, string[]> = {
		dj_booth: ['Pre-washed hand towels', 'Large electric fans'],
		spirits: ['Don Julio 1942', 'Grey Goose', 'Bombay Sapphire'],
		drinks: ['Still Water', 'Eska', 'Evian', 'Fiji', 'Stella Artois', 'Corona', 'Red Wine', 'White Wine'],
		snacks: ['Bag of Doritos', 'Assorted Fruits', 'Assorted Veggies', 'Nuts', 'Protein Bars', 'Gum'],
		misc: ['Ice', 'Glasses', 'Straws', 'Hand Towels', 'Electric Fans']
	};

	export const CATEGORY_META: { id: RiderCategory; label: string }[] = [
		{ id: 'dj_booth', label: 'Stage/Booth' },
		{ id: 'spirits', label: 'Spirits' },
		{ id: 'drinks', label: 'Drinks' },
		{ id: 'snacks', label: 'Snacks' },
		{ id: 'misc', label: 'Others' }
	];

	export function blankRoleRider(): RoleRider {
		return { dj_booth: {}, spirits: {}, drinks: {}, snacks: {}, misc: {} };
	}

	export function isCustom(cat: RiderCategory, name: string) {
		return !DEFAULTS[cat].includes(name);
	}

	// Full catalog + a rider's existing items (defaults shown unselected unless
	// already present, with their selected state preserved). Same merge TourRiders
	// uses, so passing a template rider here keeps its SELECTED items selected.
	export function cloneWithDefaults(r: RoleRider | undefined): RoleRider {
		const result = {} as RoleRider;
		for (const cat of Object.keys(DEFAULTS) as RiderCategory[]) {
			const existing = r?.[cat] ?? {};
			const merged: RiderCategoryItems = {};
			for (const name of DEFAULTS[cat]) {
				merged[name] = existing[name] ? { ...existing[name] } : { selected: false, qty: 1 };
			}
			for (const [name, item] of Object.entries(existing)) {
				if (!(name in merged)) merged[name] = { ...item };
			}
			result[cat] = merged;
		}
		return result;
	}

	export function selectedItemsByCategory(
		r: RoleRider | undefined
	): { cat: RiderCategory; label: string; items: { label: string; qty: number }[] }[] {
		if (!r) return [];
		return CATEGORY_META.map((cat) => {
			const items: { label: string; qty: number }[] = [];
			for (const [name, item] of Object.entries(r[cat.id] || {})) {
				if (item.selected) items.push({ label: name, qty: item.qty || 1 });
			}
			return { cat: cat.id, label: cat.label, items };
		}).filter((g) => g.items.length > 0);
	}

	export function countSelected(r: RoleRider | undefined): number {
		return selectedItemsByCategory(r).reduce((n, g) => n + g.items.length, 0);
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';

	export let isOpen = false;
	export let roleLabel = '';
	export let rider: RoleRider | undefined = undefined; // this show's saved rider
	export let defaults: RoleRider | undefined = undefined; // tour-level template (Settings riders)

	const dispatch = createEventDispatcher();

	let draft: RoleRider = blankRoleRider();
	let customDraftName: Record<RiderCategory, string> = {
		dj_booth: '', spirits: '', drinks: '', snacks: '', misc: ''
	};

	// Seed exactly once per open. The guard is flipped INSIDE the block so Svelte's
	// dependency ordering can't run it before the seed (the previous two-reactive
	// `lastOpen` pattern did exactly that, leaving the catalog empty).
	let seeded = false;
	$: if (isOpen) {
		if (!seeded) {
			draft = cloneWithDefaults(rider);
			customDraftName = { dj_booth: '', spirits: '', drinks: '', snacks: '', misc: '' };
			seeded = true;
		}
	} else {
		seeded = false;
	}

	// Load the tour template for this role — keeps its SELECTED items selected.
	function loadTemplate() {
		draft = cloneWithDefaults(defaults);
	}

	function toggleItem(cat: RiderCategory, name: string) {
		draft[cat][name].selected = !draft[cat][name].selected;
		draft = { ...draft };
	}
	function adjustQty(cat: RiderCategory, name: string, delta: number) {
		const item = draft[cat][name];
		item.qty = Math.max(1, (item.qty || 1) + delta);
		draft = { ...draft };
	}
	function addCustomItem(cat: RiderCategory) {
		const name = (customDraftName[cat] || '').trim();
		if (!name || draft[cat][name]) return;
		draft[cat] = { ...draft[cat], [name]: { selected: true, qty: 1 } };
		customDraftName[cat] = '';
		draft = { ...draft };
	}
	function removeCustomItem(cat: RiderCategory, name: string) {
		const { [name]: _, ...rest } = draft[cat];
		draft[cat] = rest;
		draft = { ...draft };
	}

	function save() {
		dispatch('save', draft);
		dispatch('close');
	}
</script>

<Modal {isOpen} on:close title={`Hospitality — ${roleLabel}`} maxWidth="max-w-3xl" hasFooter={true}>
	<div class="p-4 space-y-4">
		{#each CATEGORY_META as cat}
			<div>
				<h3 class="text-[10px] font-bold text-gray2 mb-1.5 uppercase tracking-wider">{cat.label}</h3>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
					{#each Object.entries(draft[cat.id]) as [name, item]}
						{#if isCustom(cat.id, name)}
							<div class="flex items-center bg-lime rounded-full overflow-hidden">
								<span class="flex-1 min-w-0 text-left pl-3 py-1.5 text-xs font-bold text-black truncate">{name}</span>
								<div class="flex items-center gap-0.5 pr-1 shrink-0">
									<button type="button" class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs" on:click={() => adjustQty(cat.id, name, -1)} aria-label="Decrease quantity">−</button>
									<span class="text-xs font-mono font-bold text-black w-4 text-center">{item.qty || 1}</span>
									<button type="button" class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs" on:click={() => adjustQty(cat.id, name, 1)} aria-label="Increase quantity">+</button>
									<button type="button" class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center" on:click={() => removeCustomItem(cat.id, name)} aria-label="Remove {name}">
										<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
									</button>
								</div>
							</div>
						{:else}
							<div class="flex items-center rounded-full border overflow-hidden transition {item.selected ? 'bg-lime border-lime' : 'border-gray2/40 hover:border-gray2'}">
								<button type="button" class="cursor-pointer flex-1 min-w-0 text-left pl-3 py-1.5 text-xs font-bold truncate {item.selected ? 'text-black' : 'text-gray2'}" on:click={() => toggleItem(cat.id, name)}>{name}</button>
								{#if item.selected}
									<div class="flex items-center gap-0.5 pr-1 shrink-0">
										<button type="button" class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs" on:click={() => adjustQty(cat.id, name, -1)} aria-label="Decrease quantity">−</button>
										<span class="text-xs font-mono font-bold text-black w-4 text-center">{item.qty || 1}</span>
										<button type="button" class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs" on:click={() => adjustQty(cat.id, name, 1)} aria-label="Increase quantity">+</button>
									</div>
								{/if}
							</div>
						{/if}
					{/each}

					<div class="flex items-center gap-1 rounded-full border border-dashed border-gray2/40 px-3 py-1.5">
						<input class="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-gray2/50 focus:outline-none" placeholder="Add other…" bind:value={customDraftName[cat.id]} on:keydown={(e) => e.key === 'Enter' && addCustomItem(cat.id)} />
						<button type="button" class="cursor-pointer text-xs font-bold text-gray2 hover:text-lime transition shrink-0" on:click={() => addCustomItem(cat.id)}>+</button>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div slot="footer" class="flex justify-between items-center w-full p-4 gap-3">
		<button type="button" class="px-4 py-2.5 rounded-full bg-gray3 text-black text-sm font-bold hover:brightness-110 transition cursor-pointer" on:click={loadTemplate}>Load template</button>
		<div class="flex items-center gap-3">
			<button type="button" class="px-5 py-2.5 rounded-full bg-navbar border border-gray2 text-gray2 text-sm font-bold hover:text-white transition cursor-pointer" on:click={() => dispatch('close')}>Cancel</button>
			<button type="button" class="px-6 py-2.5 rounded-full bg-lime text-black text-sm font-bold hover:brightness-110 transition cursor-pointer" on:click={save}>Done</button>
		</div>
	</div>
</Modal>