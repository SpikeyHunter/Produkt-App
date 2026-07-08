<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { MerchDefaultItem } from '$lib/types/tour';
	import { setSetting } from '$lib/services/tourService';

	export let merchDefaults: MerchDefaultItem[] = [];

	// Export action so the SettingsModal can manage the "Add Merch Item" button
	// in its header, mirroring TourCrew's triggerNew() pattern.
	export function triggerNew() {
		addMerchDefault();
	}

	const dispatch = createEventDispatcher();

	// Shared input styling — borderless, rounded-full (matches TourCrew)
	const inputCls =
		'w-full bg-black/40 rounded-full px-4 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition';
	const labelCls = 'text-[10px] uppercase tracking-wider text-gray2';

	const SIZES = [ 'S', 'M', 'L', 'XL', '2XL'] as const;
	const ALL_SIZE = 'ALL';

	// ---------- autosave ----------
	// Debounced so we're not hitting the API on every keystroke, and we never
	// strip blank-named rows out of the *live* array (that was deleting newly
	// added items before you could type a name into them). Blanks are only
	// dropped from the payload actually sent to setSetting.
	let saveTimer: ReturnType<typeof setTimeout>;
	let savingState: 'idle' | 'saving' | 'saved' = 'idle';
	let initialized = false;

	function scheduleSave() {
		if (!initialized) return; // don't fire on initial prop hydration
		clearTimeout(saveTimer);
		saveTimer = setTimeout(commitSave, 600);
	}

	async function commitSave() {
		savingState = 'saving';
		try {
			const payload = merchDefaults.filter((m) => m.name.trim());
			await setSetting('merch_defaults', payload);
			dispatch('saved');
			savingState = 'saved';
			setTimeout(() => (savingState = 'idle'), 1500);
		} catch (e) {
			console.error('Failed to autosave merch defaults', e);
			savingState = 'idle';
		}
	}

	// Mark as initialized after first tick so the reactive trigger below
	// doesn't autosave immediately on mount/prop hydration.
	queueMicrotask(() => (initialized = true));

	// Any mutation to merchDefaults (add/remove/edit/size toggle) re-triggers this.
	$: merchDefaults, scheduleSave();

	onDestroy(() => clearTimeout(saveTimer));

	function addMerchDefault() {
		merchDefaults = [...merchDefaults, { name: '', price: 0, photo_url: '', sizes: [] }];
	}

	function removeMerchDefault(i: number) {
		merchDefaults = merchDefaults.filter((_, idx) => idx !== i);
	}

	function toggleAllSize(item: MerchDefaultItem) {
		item.sizes = item.sizes?.includes(ALL_SIZE) ? [] : [ALL_SIZE];
		merchDefaults = merchDefaults;
	}

	function toggleSize(item: MerchDefaultItem, size: string) {
		const sizes = (item.sizes ?? []).filter((s) => s !== ALL_SIZE);
		item.sizes = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size];
		merchDefaults = merchDefaults;
	}
</script>

<div class="space-y-4">
	<p class="text-xs text-gray2">Default merch items loaded into each show's Merch tab.</p>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each merchDefaults as item, i}
			<div class="bg-black/30 rounded-2xl p-3.5 relative group">
				<button
					class="cursor-pointer absolute top-2.5 right-2.5 text-gray2 hover:text-problem transition opacity-0 group-hover:opacity-100"
					on:click={() => removeMerchDefault(i)}
					aria-label="Remove item"
				>
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>

				<label class="block pr-5">
					<span class={labelCls}>Item Name</span>
					<input
						class="mt-1 {inputCls}"
						placeholder="T-shirt, Hoodie, Vinyl…"
						bind:value={item.name}
					/>
				</label>

				<label class="block mt-2.5">
					<span class={labelCls}>Price</span>
					<div class="relative mt-1">
						<span
							class="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray2 pointer-events-none"
							>USD$</span
						>
						<input
							type="number"
							min="0"
							step="0.01"
							class="{inputCls} pl-14"
							bind:value={item.price}
							on:focus={(e) => e.currentTarget.select()}
						/>
					</div>
				</label>

				<div class="mt-2.5">
					<span class={labelCls}>Sizes Available</span>
					<div class="flex flex-wrap gap-1.5 mt-1.5">
						<button
							type="button"
							class="cursor-pointer px-3 py-1 rounded-full text-[11px] font-bold border transition {item.sizes?.includes(
								ALL_SIZE
							)
								? 'bg-lime text-black border-lime'
								: 'border-gray2/40 text-gray2 hover:border-gray2'}"
							on:click={() => toggleAllSize(item)}
						>
							All-Size
						</button>
						{#each SIZES as size}
							<button
								type="button"
								class="cursor-pointer px-3 py-1 rounded-full text-[11px] font-bold border transition {item.sizes?.includes(
									size
								)
									? 'bg-lime text-black border-lime'
									: 'border-gray2/40 text-gray2 hover:border-gray2'}"
								on:click={() => toggleSize(item, size)}
							>
								{size}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if merchDefaults.length === 0}
		<div
			class="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray1 rounded-2xl"
		>
			<p class="text-sm text-gray2 italic mb-3">No merch items yet — add your first one.</p>
			<button
				class="cursor-pointer px-4 py-2 rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition"
				on:click={addMerchDefault}
			>
				+ Add Merch Item
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-end pt-2">
		<span
			class="text-xs font-bold transition {savingState === 'idle'
				? 'text-transparent'
				: savingState === 'saving'
					? 'text-gray2'
					: 'text-lime'}"
		>
			
		</span>
	</div>
</div>