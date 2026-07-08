<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { setSetting } from '$lib/services/tourService';

	const dispatch = createEventDispatcher();
	export let localCrewTemplate: any = [];

	let items: { qty: number; role: string }[] = [];
	let prevTemplateStr = '';

	// ------------------------------------------------------------------
	// Bulletproof template normalizer.
	// Handles every shape the prop can arrive in:
	//   - array of DB rows:  [{ key:'local_crew_template', data:'[...]' }]
	//   - single DB row:     { key:'local_crew_template', data:'[...]' }
	//   - bare data string:  '[{"qty":1,"role":"Forklift"}]'   <-- was breaking
	//   - double-stringified: '"[{\\"qty\\":1,...}]"'
	//   - already-parsed:    [{ qty:1, role:'Forklift' }]
	// Also tolerates a `.value` column instead of `.data`.
	// ------------------------------------------------------------------
	function normalizeTemplate(input: any): { qty: number; role: string }[] {
		let raw: any = input;

		// Unwrap setting-row container shapes (array of rows OR single row).
		if (Array.isArray(raw)) {
			if (raw.length === 0) return [];
			const first = raw[0];
			if (first && typeof first === 'object' && first.key === 'local_crew_template') {
				raw = first.data ?? first.value;
			}
			// otherwise assume it's already an array of items; falls through
		} else if (raw && typeof raw === 'object' && raw.key === 'local_crew_template') {
			raw = raw.data ?? raw.value;
		}

		// Unwrap (possibly multiply) stringified JSON.
		let guard = 0;
		while (typeof raw === 'string' && guard++ < 5) {
			const s = raw.trim();
			if (!s) return [];
			try {
				raw = JSON.parse(s);
			} catch {
				return [];
			}
		}

		if (!Array.isArray(raw)) return [];

		// Keep only well-formed rows and coerce types.
		return raw
			.filter((r) => r && typeof r === 'object' && ('role' in r || 'qty' in r))
			.map((r: any) => ({
				qty: Number(r.qty) > 0 ? Number(r.qty) : 1,
				role: String(r.role ?? '')
			}));
	}

	// Recompute only when the incoming prop actually changes, so we never
	// clobber in-progress edits the user is making to `items`.
	$: {
		const currentStr = JSON.stringify(localCrewTemplate);
		if (currentStr !== prevTemplateStr) {
			prevTemplateStr = currentStr;
			items = normalizeTemplate(localCrewTemplate);
		}
	}

	let saving = false;
	let saveTimer: ReturnType<typeof setTimeout>;

	export function triggerNew() {
		items = [...items, { qty: 1, role: '' }];
		triggerAutoSave();
	}

	function removeRow(index: number) {
		items = items.filter((_, i) => i !== index);
		triggerAutoSave();
	}

	function updateQty(index: number, delta: number) {
		const newVal = items[index].qty + delta;
		if (newVal >= 1) {
			items[index].qty = newVal;
			items = items; // ensure reactivity on in-place mutation
			triggerAutoSave();
		}
	}

	function triggerAutoSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(save, 800); // 800ms debounce
	}

	async function save() {
		saving = true;
		try {
			// Save the items array as-is so we don't accidentally delete
			// the new row the user just added before they can type in it.
			const payload = items.map((i) => ({ qty: i.qty, role: i.role }));

			// Save directly via tourService
			await setSetting('local_crew_template', payload);

			// IMPORTANT: Sync the exported prop so the parent component (SettingsModal)
			// knows about the updated data and doesn't overwrite our state with stale data.
			localCrewTemplate = payload;
			prevTemplateStr = JSON.stringify(localCrewTemplate);

			dispatch('saved', items);
		} catch (e) {
			console.error('[TourProduction] CRITICAL ERROR: Failed to save local crew template:', e);
		} finally {
			saving = false;
		}
	}

	onDestroy(() => {
		clearTimeout(saveTimer);
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between pb-4 border-b border-gray1">
		<div>
			<h3 class="text-sm font-bold text-white uppercase tracking-wider">Local Crew Defaults</h3>
			<p class="text-xs text-gray2 mt-1">Define the default stagehand requirements loaded for new shows.</p>
		</div>
		<div class="text-xs font-bold text-gray2 h-5 flex items-center">
			{#if saving}
				<span class="text-lime animate-pulse">Saving...</span>
			{/if}
		</div>
	</div>

	<div class="space-y-2 w-full lg:w-1/3 md:w-1/2">
		{#each items as item, i}
			<div class="flex items-center gap-3 bg-gray1/30 rounded-2xl p-2 pl-4">
				<div class="flex items-center bg-black/40 rounded-full h-9 shrink-0">
					<button type="button" aria-label="Decrease quantity" title="Decrease quantity" class="px-3 hover:text-white text-gray2 font-bold cursor-pointer transition-colors" on:click={() => updateQty(i, -1)}>−</button>
					<span class="text-sm text-white font-mono w-4 text-center select-none">{item.qty}</span>
					<button type="button" aria-label="Increase quantity" title="Increase quantity" class="px-3 hover:text-white text-gray2 font-bold cursor-pointer transition-colors" on:click={() => updateQty(i, 1)}>+</button>
				</div>
				<input
					class="flex-1 min-w-0 bg-transparent border-none text-sm text-white placeholder-gray2 outline-none px-2"
					placeholder="Role (e.g. Stagehands)"
					bind:value={item.role}
					on:input={triggerAutoSave}
				/>
				<button type="button" aria-label="Remove role" title="Remove role" class="p-2 text-gray2 hover:text-problem transition-colors cursor-pointer shrink-0" on:click={() => removeRow(i)}>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
				</button>
			</div>
		{:else}
			<p class="text-sm text-gray2 italic">No default local crew defined. Click "+ Add Local Crew" to create a default template.</p>
		{/each}
	</div>
</div>