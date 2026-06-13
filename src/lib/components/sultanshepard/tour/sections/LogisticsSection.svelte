<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LogisticsData, SSTourData, SSCrew, RidersSettings, TransportRow, GuestlistEntry } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';
	import Select from '../ui/Select.svelte';

	export let data: LogisticsData = {};
	export let tourData: SSTourData;
	export let crew: SSCrew[] = [];
	export let riders: RidersSettings | null = null; // defaults from Settings

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Singers on this show (from Event Details / crew)
	$: assignedCrew = crew.filter((c) => (tourData.event_details?.crew_ids || []).includes(c.id));
	$: singersCount = tourData.event_details?.singers_enabled
		? (tourData.event_details?.singers || []).length
		: assignedCrew.filter((c) => c.crew_type === 'singer').length;

	function loadDefaults() {
		if (!riders) return;
		data.artist_hospo = [...(riders.artist || [])];
		data.prod_hospo = [...(riders.prod || [])];
		const sh: Record<string, string[]> = {};
		for (let i = 1; i <= singersCount; i++) {
			sh[`singer_${i}`] = [...(riders[`singer_${i}`] || [])];
		}
		data.singer_hospo = sh;
		changed();
	}

	function listEditor(value: string[] | undefined): string {
		return (value || []).join('\n');
	}
	function parseList(text: string): string[] {
		return text.split('\n').map((s) => s.trim()).filter(Boolean);
	}

	function addTransport() {
		data.transports = [...(data.transports || []), { id: uid(), name: '', from: '', to: '', how: '', time: '', notes: '' }];
		changed();
	}
	function removeTransport(row: TransportRow) {
		data.transports = (data.transports || []).filter((t) => t.id !== row.id);
		changed();
	}

	function addGuest() {
		data.guestlist = [...(data.guestlist || []), { id: uid(), first: '', last: '', plus_one: false, tier: 'GA' }];
		changed();
	}
	function removeGuest(g: GuestlistEntry) {
		data.guestlist = (data.guestlist || []).filter((x) => x.id !== g.id);
		changed();
	}

	type Tier = 'GA' | 'VIP' | 'AA';
	const TIERS: Tier[] = ['GA', 'VIP', 'AA'];

	$: alloc = data.guestlist_allocation || {};
	$: usedByTier = (data.guestlist || []).reduce<Record<string, number>>((acc, g) => {
		const n = 1 + (g.plus_one ? 1 : 0);
		acc[g.tier] = (acc[g.tier] || 0) + n;
		return acc;
	}, {});
</script>

<div class="space-y-6">
	<!-- Hospitality -->
	<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-4">
		<div class="flex items-center justify-between">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Hospitality</span>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadDefaults}>Load defaults (riders)</button>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">Artist Hospo <span class="normal-case font-normal">(one item per line)</span></span>
				<textarea
					rows="4"
					class="w-full bg-gray1 rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-transparent focus:border-lime/60 resize-y"
					value={listEditor(data.artist_hospo)}
					on:change={(e) => { data.artist_hospo = parseList((e.target as HTMLTextAreaElement).value); changed(); }}
				></textarea>
			</label>
			<label class="block">
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">Prod Hospo</span>
				<textarea
					rows="4"
					class="w-full bg-gray1 rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-transparent focus:border-lime/60 resize-y"
					value={listEditor(data.prod_hospo)}
					on:change={(e) => { data.prod_hospo = parseList((e.target as HTMLTextAreaElement).value); changed(); }}
				></textarea>
			</label>
		</div>
		{#if singersCount > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each Array.from({ length: singersCount }, (_, i) => i + 1) as n}
					<label class="block">
						<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-1.5">Singer {n} Hospo</span>
						<textarea
							rows="3"
							class="w-full bg-gray1 rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-transparent focus:border-lime/60 resize-y"
							value={listEditor(data.singer_hospo?.[`singer_${n}`])}
							on:change={(e) => {
								data.singer_hospo = { ...(data.singer_hospo || {}), [`singer_${n}`]: parseList((e.target as HTMLTextAreaElement).value) };
								changed();
							}}
						></textarea>
					</label>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-gray2 italic">Singer hospo appears here based on singers assigned in Event Details.</p>
		{/if}
	</div>

	<!-- Lunch / Diner -->
	<div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-start">
		<Select
			label="Lunch / Diner"
			options={[
				{ value: 'uber', label: 'Uber Eats link' },
				{ value: 'catering', label: 'Catering' },
				{ value: 'restaurant', label: 'Restaurant' },
				{ value: 'other', label: 'Other' }
			]}
			bind:value={data.meal_mode}
			on:change={changed}
		/>
		<TextArea label="Details" bind:value={data.meal_notes} placeholder="Uber link, restaurant name, catering contact…" rows={2} on:change={changed} />
	</div>

	<!-- Transport -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Transport</span>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addTransport}>+ Add transport</button>
		</div>
		<div class="space-y-2">
			{#each data.transports || [] as t (t.id)}
				<div class="grid grid-cols-2 md:grid-cols-[110px_1fr_1fr_1fr_110px_90px_1fr_auto] gap-2 items-center bg-gray1/30 rounded-xl p-2">
					<Field small type="date" bind:value={t.date} on:change={changed} />
					<Field small bind:value={t.name} placeholder="Who" on:change={changed} />
					<Field small bind:value={t.from} placeholder="From" on:change={changed} />
					<Field small bind:value={t.to} placeholder="To" on:change={changed} />
					<Field small bind:value={t.how} placeholder="Driver/Uber…" on:change={changed} />
					<Field small type="time" bind:value={t.time} on:change={changed} />
					<Field small bind:value={t.notes} placeholder="Notes" on:change={changed} />
					<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeTransport(t)}>✕</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Guestlist -->
	<div>
		<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Guestlist</span>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addGuest}>+ Add name</button>
		</div>

		<div class="flex flex-wrap gap-4 mb-3">
			{#each TIERS as tier}
				<label class="flex items-center gap-2 text-xs text-gray2">
					{tier} allocation
					<input
						type="number" min="0"
						class="w-16 bg-gray1 rounded-lg px-2 h-7 text-xs text-white outline-none border border-transparent focus:border-lime/60"
						value={alloc[tier] ?? ''}
						on:change={(e) => {
							data.guestlist_allocation = { ...alloc, [tier]: Number((e.target as HTMLInputElement).value) || 0 };
							changed();
						}}
					/>
					<span class="{(usedByTier[tier] || 0) > (alloc[tier] ?? Infinity) ? 'text-problem font-bold' : 'text-gray3'}">
						{usedByTier[tier] || 0}{alloc[tier] !== undefined ? ` / ${alloc[tier]}` : ''}
					</span>
				</label>
			{/each}
		</div>

		<div class="space-y-1.5">
			{#each data.guestlist || [] as g (g.id)}
				<div class="grid grid-cols-[1fr_1fr_auto_110px_auto] gap-2 items-center">
					<Field small bind:value={g.first} placeholder="First" on:change={changed} />
					<Field small bind:value={g.last} placeholder="Last" on:change={changed} />
					<button
						type="button"
						class="px-2.5 h-9 rounded-xl text-xs font-bold border transition-colors cursor-pointer {g.plus_one ? 'bg-lime/15 border-lime text-lime' : 'bg-gray1 border-transparent text-gray2'}"
						on:click={() => { g.plus_one = !g.plus_one; changed(); }}
					>+1</button>
					<Select options={[{ value: 'GA', label: 'GA' }, { value: 'VIP', label: 'VIP' }, { value: 'AA', label: 'AA' }]} bind:value={g.tier} on:change={changed} />
					<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeGuest(g)}>✕</button>
				</div>
			{/each}
		</div>
	</div>
</div>