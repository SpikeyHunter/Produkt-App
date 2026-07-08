<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { RidersSettings, RoleRider, TourRole, RiderCategory, RiderCategoryItems } from '$lib/types/tour';
	import { setSetting } from '$lib/services/tourService';

	export let riders: RidersSettings | null = null;

	const dispatch = createEventDispatcher();

	const ROLES: { id: TourRole; label: string }[] = [
		{ id: 'artist', label: 'Artist' },
		{ id: 'prod', label: 'Production' },
		{ id: 'singer_1', label: 'Singer 1' },
		{ id: 'singer_2', label: 'Singer 2' },
		{ id: 'singer_3', label: 'Singer 3' },
		{ id: 'singer_4', label: 'Singer 4' }
	];

	// Hardcoded defaults per category — fewer options than the full advance-page
	// rider since this is a simpler tour-level template. More can be added later
	// by extending these arrays; anything the user adds beyond these via "+ Add
	// other" is just an additional key in the same category map.
	const DEFAULTS: Record<RiderCategory, string[]> = {
		dj_booth: ['Pre-washed hand towels', 'Large electric fans'],
		spirits: ['Don Julio 1942', 'Grey Goose', 'Bombay Sapphire'],
		drinks: [
			'Still Water',
			'Eska',
			'Evian',
			'Fiji',
			'Stella Artois',
			'Corona',
			'Red Wine',
			'White Wine'
		],
		snacks: ['Bag of Doritos', 'Assorted Fruits', 'Assorted Veggies', 'Nuts', 'Protein Bars', 'Gum'],
		misc: ['Ice', 'Glasses', 'Straws', 'Hand Towels', 'Electric Fans']
	};

	const CATEGORY_META: { id: RiderCategory; label: string }[] = [
		{ id: 'dj_booth', label: 'Stage/Booth' },
		{ id: 'spirits', label: 'Spirits' },
		{ id: 'drinks', label: 'Drinks' },
		{ id: 'snacks', label: 'Snacks' },
		{ id: 'misc', label: 'Others' }
	];

	function blankRoleRider(): RoleRider {
		return { dj_booth: {}, spirits: {}, drinks: {}, snacks: {}, misc: {} };
	}

	function blankRiders(): RidersSettings {
		return {
			artist: blankRoleRider(),
			prod: blankRoleRider(),
			singer_1: blankRoleRider(),
			singer_2: blankRoleRider(),
			singer_3: blankRoleRider(),
			singer_4: blankRoleRider()
		};
	}

	// Defensive: riders may be null on first load, or a role key may be
	// missing if this is the first time loading post-migration.
	$: safeRiders = riders ?? blankRiders();

	function selectedItemsByCategory(
		role: TourRole
	): { cat: RiderCategory; label: string; items: { label: string; qty: number }[] }[] {
		const r = safeRiders[role];
		if (!r) return [];
		return CATEGORY_META.map((cat) => {
			const items: { label: string; qty: number }[] = [];
			for (const [name, item] of Object.entries(r[cat.id] || {})) {
				if (item.selected) items.push({ label: name, qty: item.qty || 1 });
			}
			return { cat: cat.id, label: cat.label, items };
		}).filter((group) => group.items.length > 0);
	}

	function isCustom(cat: RiderCategory, name: string) {
		return !DEFAULTS[cat].includes(name);
	}

	function cloneWithDefaults(r: RoleRider): RoleRider {
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

	// ---------- editing state ----------
	let editingRole: TourRole | null = null;
	let draft: RoleRider | null = null;
	let customDraftName: Record<RiderCategory, string> = {
		dj_booth: '',
		spirits: '',
		drinks: '',
		snacks: '',
		misc: ''
	};

	function openRole(role: TourRole) {
		editingRole = role;
		draft = cloneWithDefaults(safeRiders[role]);
		customDraftName = { dj_booth: '', spirits: '', drinks: '', snacks: '', misc: '' };
	}

	function backToList() {
		// Flush any pending debounced save immediately so leaving the role
		// view never drops a change made just before navigating away.
		clearTimeout(saveTimer);
		if (editingRole && draft) commitSave();
		editingRole = null;
		draft = null;
	}

	function toggleItem(cat: RiderCategory, name: string) {
		if (!draft) return;
		draft[cat][name].selected = !draft[cat][name].selected;
		draft = { ...draft };
		scheduleSave();
	}

	function adjustQty(cat: RiderCategory, name: string, delta: number) {
		if (!draft) return;
		const item = draft[cat][name];
		item.qty = Math.max(1, (item.qty || 1) + delta);
		draft = { ...draft };
		scheduleSave();
	}

	function addCustomItem(cat: RiderCategory) {
		if (!draft) return;
		const name = (customDraftName[cat] || '').trim();
		if (!name || draft[cat][name]) return;
		draft[cat] = { ...draft[cat], [name]: { selected: true, qty: 1 } };
		customDraftName[cat] = '';
		draft = { ...draft };
		scheduleSave();
	}

	function removeCustomItem(cat: RiderCategory, name: string) {
		if (!draft) return;
		const { [name]: _, ...rest } = draft[cat];
		draft[cat] = rest;
		draft = { ...draft };
		scheduleSave();
	}

	// ---------- autosave ----------
	// Debounced so rapid toggles/qty clicks don't hit the API on every click.
	let saveTimer: ReturnType<typeof setTimeout>;
	let savingState: 'idle' | 'saving' | 'saved' = 'idle';

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(commitSave, 600);
	}

	async function commitSave() {
		if (!editingRole || !draft) return;
		const next: RidersSettings = { ...safeRiders, [editingRole]: draft };
		riders = next;
		savingState = 'saving';
		try {
			await setSetting('riders', next);
			dispatch('saved');
			savingState = 'saved';
			setTimeout(() => (savingState = 'idle'), 1500);
		} catch (err) {
			console.error('Failed to autosave rider', err);
			savingState = 'idle';
		}
	}

	onDestroy(() => clearTimeout(saveTimer));
</script>

{#if !editingRole}
	<div class="space-y-3">
		<p class="text-xs text-gray2">
			Default hospitality riders per role — loaded into each show's Logistics tab.
		</p>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
			{#each ROLES as role}
				{@const groups = selectedItemsByCategory(role.id)}
				{@const totalCount = groups.reduce((n, g) => n + g.items.length, 0)}
				<button
					type="button"
					class="cursor-pointer text-left bg-black/30 hover:bg-black/40 transition rounded-2xl p-3.5"
					on:click={() => openRole(role.id)}
				>
					<div class="flex items-center justify-between mb-2.5">
						<span class="text-[10px] font-black uppercase tracking-wider text-lime">
							{role.label}
						</span>
						<span class="text-[10px] text-gray2"
							>{totalCount} item{totalCount === 1 ? '' : 's'}</span
						>
					</div>

					{#if groups.length > 0}
						<div class="space-y-2">
							{#each groups as group}
								<div>
									<div class="text-[10px] font-bold text-gray3 uppercase tracking-wider mb-0.5">
										{group.label}:
									</div>
									{#each group.items as it}
										<div class="text-xs text-gray2 leading-snug">
											{it.qty}x {it.label}
										</div>
									{/each}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-gray2 italic">No items configured yet.</p>
					{/if}
				</button>
			{/each}
		</div>

		<div class="flex items-center justify-end pt-1">
			<span
				class="text-xs font-bold transition {savingState === 'idle'
					? 'text-transparent'
					: savingState === 'saving'
						? 'text-gray2'
						: 'text-lime'}"
			>
				{savingState === 'saving' ? 'Saving…' : savingState === 'saved' ? 'Saved ✓' : '—'}
			</span>
		</div>
	</div>
{:else if draft}
	<div>
		<div class="flex items-center justify-between mb-6">
			<button
				class="cursor-pointer text-xs text-black hover:text-black bg-gray3 py-1 px-2.5 rounded-full transition"
				on:click={backToList}>← Back to list</button
			>
			<span
				class="text-xs font-bold transition {savingState === 'idle'
					? 'text-transparent'
					: savingState === 'saving'
						? 'text-gray2'
						: 'text-lime'}"
			>
				{savingState === 'saving' ? 'Saving…' : savingState === 'saved' ? 'Saved ✓' : '—'}
			</span>
		</div>

		<div class="space-y-4">
			{#each CATEGORY_META as cat}
				<div>
					<h3 class="text-[10px] font-bold text-gray2 mb-1.5 uppercase tracking-wider">
						{cat.label}
					</h3>
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
						{#each Object.entries(draft[cat.id]) as [name, item]}
							{#if isCustom(cat.id, name)}
								<div class="flex items-center bg-lime rounded-full overflow-hidden">
									<span
										class="flex-1 min-w-0 text-left pl-3 py-1.5 text-xs font-bold text-black truncate"
									>
										{name}
									</span>
									<div class="flex items-center gap-0.5 pr-1 shrink-0">
										<button
											type="button"
											class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs"
											on:click={() => adjustQty(cat.id, name, -1)}
											aria-label="Decrease quantity"
										>
											−
										</button>
										<span class="text-xs font-mono font-bold text-black w-4 text-center"
											>{item.qty || 1}</span
										>
										<button
											type="button"
											class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs"
											on:click={() => adjustQty(cat.id, name, 1)}
											aria-label="Increase quantity"
										>
											+
										</button>
										<button
											type="button"
											class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center"
											on:click={() => removeCustomItem(cat.id, name)}
											aria-label="Remove {name}"
										>
											<svg
												class="w-3 h-3"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
											>
										</button>
									</div>
								</div>
							{:else}
								<div
									class="flex items-center rounded-full border overflow-hidden transition {item.selected
										? 'bg-lime border-lime'
										: 'border-gray2/40 hover:border-gray2'}"
								>
									<button
										type="button"
										class="cursor-pointer flex-1 min-w-0 text-left pl-3 py-1.5 text-xs font-bold truncate {item.selected
											? 'text-black'
											: 'text-gray2'}"
										on:click={() => toggleItem(cat.id, name)}
									>
										{name}
									</button>
									{#if item.selected}
										<div class="flex items-center gap-0.5 pr-1 shrink-0">
											<button
												type="button"
												class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs"
												on:click={() => adjustQty(cat.id, name, -1)}
												aria-label="Decrease quantity"
											>
												−
											</button>
											<span class="text-xs font-mono font-bold text-black w-4 text-center"
												>{item.qty || 1}</span
											>
											<button
												type="button"
												class="cursor-pointer w-5 h-5 rounded-full text-black/70 hover:text-black hover:bg-black/10 transition flex items-center justify-center text-xs"
												on:click={() => adjustQty(cat.id, name, 1)}
												aria-label="Increase quantity"
											>
												+
											</button>
										</div>
									{/if}
								</div>
							{/if}
						{/each}

						<div
							class="flex items-center gap-1 rounded-full border border-dashed border-gray2/40 px-3 py-1.5"
						>
							<input
								class="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-gray2/50 focus:outline-none"
								placeholder="Add other…"
								bind:value={customDraftName[cat.id]}
								on:keydown={(e) => e.key === 'Enter' && addCustomItem(cat.id)}
							/>
							<button
								type="button"
								class="cursor-pointer text-xs font-bold text-gray2 hover:text-lime transition shrink-0"
								on:click={() => addCustomItem(cat.id)}
							>
								+
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}