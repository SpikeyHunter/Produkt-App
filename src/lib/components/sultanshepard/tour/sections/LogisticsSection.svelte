<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type {
		LogisticsData,
		SSTourData,
		SSCrew,
		RidersSettings,
		TourRole,
		RoleRider,
		TransportRow,
		GuestlistEntry
	} from '$lib/types/tour';
	import DatePickerCompact from '$lib/components/buttons/DatePickerCompact.svelte';
	import HospoEditorModal, {
		cloneWithDefaults,
		selectedItemsByCategory,
		countSelected
	} from '$lib/components/sultanshepard/tour/settings/HospoEditorModal.svelte';

	export let data: LogisticsData = {};
	export let tourData: SSTourData;
	export let crew: SSCrew[] = [];
	export let riders: RidersSettings | null = null; // tour-level template from Settings

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// ---------- roles (live from Event Details) ----------
	// Singers come from event_details.singer_crew_ids (gated by singers_enabled),
	// mapped to real crew names. This recomputes whenever Event Details or the crew
	// list changes, so cards appear/disappear in real time. Capped at 4 (singer_1..4).
	$: assignedSingers = tourData.event_details?.singers_enabled
		? (tourData.event_details?.singer_crew_ids || [])
				.map((id) => crew.find((c) => c.id === id))
				.filter((c): c is SSCrew => !!c)
				.slice(0, 4)
		: [];

	$: hospoRoles = [
		{ id: 'artist' as TourRole, label: 'Artist' },
		{ id: 'prod' as TourRole, label: 'Production' },
		...assignedSingers.map((c, i) => ({
			id: `singer_${i + 1}` as TourRole,
			label: c?.name || `Singer ${i + 1}`
		}))
	];

	// ---------- hospitality modal ----------
	let hospoOpen = false;
	let hospoRole: TourRole = 'artist';
	let hospoLabel = '';
	let hospoRider: RoleRider | undefined;
	let hospoDefaults: RoleRider | undefined;

	function openHospo(role: TourRole, label: string) {
		hospoRole = role;
		hospoLabel = label;
		hospoRider = data.hospo?.[role];
		hospoDefaults = riders?.[role];
		hospoOpen = true;
	}
	function onHospoSave(e: CustomEvent<RoleRider>) {
		data.hospo = { ...(data.hospo || {}), [hospoRole]: e.detail };
		changed();
	}

	// Load the tour template (with its selected items) into EVERY role at once.
	function loadAllTemplates() {
		if (!riders) return;
		const next: Partial<Record<TourRole, RoleRider>> = { ...(data.hospo || {}) };
		for (const r of hospoRoles) {
			next[r.id] = cloneWithDefaults(riders[r.id]);
		}
		data.hospo = next;
		changed();
	}

	// ---------- diner (custom dropdown) ----------
	const MEAL_OPTIONS = [
		{ value: 'uber', label: 'Uber Eats' },
		{ value: 'catering', label: 'Catering' },
		{ value: 'restaurant', label: 'Restaurant' },
		{ value: 'other', label: 'Other' }
	];
	let dinerOpen = false;
	$: dinerLabel = MEAL_OPTIONS.find((o) => o.value === data.meal_mode)?.label;
	function setMeal(value: string) {
		data.meal_mode = value as LogisticsData['meal_mode'];
		dinerOpen = false;
		changed();
	}

	// ---------- transports ----------
	const TRANSPORT_TYPES = [
		'Arrival', 'Departure', 'Soundcheck', 'Post-SC', 'Show', 'Post-Show', 'Diner', 'Transfer', 'Other'
	];
	let openTypeFor: string | null = null;

	function typeColor(type: string | undefined): string {
		switch (type) {
			case 'Arrival':
			case 'Departure':
				return 'bg-question text-black';
			case 'Soundcheck':
			case 'Post-SC':
				return 'bg-info text-black';
			case 'Show':
			case 'Post-Show':
				return 'bg-problem text-black';
			case 'Diner':
				return 'bg-tentatif text-black';
			case 'Transfer':
				return 'bg-gray2 text-black';
			case 'Other':
				return 'bg-gray3 text-black';
			default:
				return '';
		}
	}

	function addTransport() {
		data.transports = [
			...(data.transports || []),
			{ id: uid(), type: '', date: '', name: '', from: '', to: '', how: '', time: '', notes: '' }
		];
		changed();
	}
	function removeTransport(row: TransportRow) {
		data.transports = (data.transports || []).filter((t) => t.id !== row.id);
		changed();
	}
	function setTransportType(row: TransportRow, value: string) {
		row.type = value;
		openTypeFor = null;
		changed();
	}

	function handleWindowClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		if (openTypeFor && !t.closest('.tp-type')) openTypeFor = null;
		if (dinerOpen && !t.closest('.diner-mode')) dinerOpen = false;
	}

	// ---------- guestlist ----------
	type Tier = 'GA' | 'VIP' | 'AA';
	const TIERS: Tier[] = ['GA', 'VIP', 'AA'];

	function addGuest(tier: Tier) {
		data.guestlist = [...(data.guestlist || []), { id: uid(), first: '', last: '', plus_one: false, tier }];
		changed();
	}
	function removeGuest(g: GuestlistEntry) {
		data.guestlist = (data.guestlist || []).filter((x) => x.id !== g.id);
		changed();
	}

	$: alloc = data.guestlist_allocation || {};
	$: byTier = (() => {
		const m: Record<Tier, GuestlistEntry[]> = { GA: [], VIP: [], AA: [] };
		for (const g of data.guestlist || []) (m[g.tier as Tier] ||= []).push(g);
		return m;
	})();
	$: usedByTier = (data.guestlist || []).reduce<Record<string, number>>((acc, g) => {
		acc[g.tier] = (acc[g.tier] || 0) + 1 + (g.plus_one ? 1 : 0);
		return acc;
	}, {});

	function setAlloc(tier: Tier, raw: string) {
		const clean = raw.replace(/[^0-9]/g, '');
		const next = { ...alloc };
		if (clean === '') delete next[tier];
		else next[tier] = parseInt(clean, 10);
		data.guestlist_allocation = next;
		changed();
	}

	// ---------- per-section reset (Reset → Are you sure? → Confirm) ----------
	type Section = 'hospo' | 'diner' | 'transport' | 'guestlist';
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];
	let resetStage: Record<Section, 0 | 1 | 2> = { hospo: 0, diner: 0, transport: 0, guestlist: 0 };
	let resetTimers: Partial<Record<Section, ReturnType<typeof setTimeout>>> = {};

	function clickReset(section: Section, clear: () => void) {
		clearTimeout(resetTimers[section]);
		if (resetStage[section] < 2) {
			resetStage = { ...resetStage, [section]: (resetStage[section] + 1) as 0 | 1 | 2 };
			resetTimers[section] = setTimeout(() => (resetStage = { ...resetStage, [section]: 0 }), 4000);
			return;
		}
		resetStage = { ...resetStage, [section]: 0 };
		clear();
	}

	const resetHospo = () => { data.hospo = {}; data.artist_hospo = undefined; data.prod_hospo = undefined; data.singer_hospo = undefined; changed(); };
	const resetDiner = () => { data.meal_mode = undefined; data.meal_notes = ''; changed(); };
	const resetTransport = () => { data.transports = []; changed(); };
	const resetGuestlist = () => { data.guestlist = []; data.guestlist_allocation = {}; changed(); };

	const resetClass = (s: Section) =>
		`cursor-pointer px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
			resetStage[s] === 0
				? 'border-gray3/40 text-gray3 hover:border-problem hover:text-problem'
				: resetStage[s] === 1
					? 'border-problem/60 text-problem'
					: 'border-problem bg-problem text-black'
		}`;

	onDestroy(() => Object.values(resetTimers).forEach((t) => clearTimeout(t)));

	const inputCls =
		'w-full bg-black/20 rounded-full px-3 py-1 text-xs text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60 transition-colors';
</script>

<svelte:window on:click={handleWindowClick} />

<div class="space-y-6">
	<!-- ============ HOSPITALITY ============ -->
	<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-4">
		<div class="flex items-center justify-between flex-wrap gap-2">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray2">Hospitality</span>
			<div class="flex items-center gap-2">
				<button type="button" class={resetClass('hospo')} on:click={() => clickReset('hospo', resetHospo)}>{RESET_LABELS[resetStage.hospo]}</button>
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadAllTemplates}>Load template (all)</button>
			</div>
		</div>

		<!-- 3-col cards: artist, production, singer 1 → row 1; singer 2 → row 2 (one col) -->
		<div class="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
			{#each hospoRoles as role (role.id)}
				{@const rider = data.hospo?.[role.id]}
				{@const groups = selectedItemsByCategory(rider)}
				{@const total = countSelected(rider)}
				<button type="button" class="cursor-pointer text-left bg-black/30 hover:bg-black/40 transition rounded-2xl p-3.5" on:click={() => openHospo(role.id, role.label)}>
					<div class="flex items-center justify-between mb-2.5">
						<span class="text-[10px] font-black uppercase tracking-wider text-lime truncate">{role.label}</span>
						<span class="text-[10px] text-gray2 shrink-0">{total} item{total === 1 ? '' : 's'}</span>
					</div>
					{#if groups.length > 0}
						<div class="space-y-2">
							{#each groups as group}
								<div>
									<div class="text-[10px] font-bold text-gray3 uppercase tracking-wider mb-0.5">{group.label}:</div>
									{#each group.items as it}
										<div class="text-xs text-gray2 leading-snug">{it.qty}x {it.label}</div>
									{/each}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-xs text-gray2 italic">Tap to add items.</p>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- ============ LUNCH / DINER ============ -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray2">Lunch / Diner</span>
			<button type="button" class={resetClass('diner')} on:click={() => clickReset('diner', resetDiner)}>{RESET_LABELS[resetStage.diner]}</button>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 items-end">
			<label class="block">
				<span class="block text-[12px] font-bold uppercase tracking-wider text-gray2 mb-1.5">Mode</span>
				<div class="diner-mode relative">
					<button type="button" class="w-full bg-gray1 rounded-full px-4 h-10 text-sm text-left flex items-center justify-between gap-2 outline-none border border-transparent focus:border-lime/60 hover:border-lime/40 transition" on:click|stopPropagation={() => (dinerOpen = !dinerOpen)}>
						<span class={dinerLabel ? 'text-white' : 'text-gray2'}>{dinerLabel || 'Select…'}</span>
						<svg class="w-4 h-4 text-gray2 transition-transform {dinerOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
					</button>
					{#if dinerOpen}
						<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-2xl shadow-xl z-30 overflow-hidden">
							{#each MEAL_OPTIONS as opt}
								<button type="button" class="block w-full px-4 py-2 text-left text-sm font-bold transition cursor-pointer border-b border-gray1 last:border-b-0 {data.meal_mode === opt.value ? 'bg-lime text-black' : 'text-white hover:bg-lime hover:text-black'}" on:click={() => setMeal(opt.value)}>{opt.label}</button>
							{/each}
						</div>
					{/if}
				</div>
			</label>
			<label class="block">
				<span class="block text-[12px] font-bold uppercase tracking-wider text-gray2 mb-1.5">Details</span>
				<input
					class="w-full bg-gray1 rounded-full px-4 h-10 text-sm text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60"
					placeholder="Uber link, restaurant name, catering contact…"
					bind:value={data.meal_notes}
					on:input={changed}
				/>
			</label>
		</div>
	</div>

	<!-- ============ TRANSPORT ============ -->
	<div>
		<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray2">Transport</span>
			<div class="flex items-center gap-2">
				<button type="button" class={resetClass('transport')} on:click={() => clickReset('transport', resetTransport)}>{RESET_LABELS[resetStage.transport]}</button>
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addTransport}>+ Add transport</button>
			</div>
		</div>

		{#if (data.transports || []).length > 0}
			<div class="hidden md:grid grid-cols-[120px_120px_80px_110px_1fr_1fr_140px_1.3fr_auto] gap-2 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray3">
				<div>Type</div><div>Date</div><div>Time</div><div>Driver</div><div>From</div><div>To</div><div>Pax Name(s)</div><div>Notes</div><div></div>
			</div>
		{/if}

		<div class="space-y-1">
			{#each data.transports || [] as t (t.id)}
				<div class="grid grid-cols-2 md:grid-cols-[120px_120px_80px_110px_1fr_1fr_140px_1.3fr_auto] gap-2 items-center bg-gray1/30 rounded-full px-2 py-1">
					<!-- Type dropdown (colour-coded once chosen) -->
					<div class="tp-type relative">
						<button type="button" class="w-full rounded-full px-3 py-1 text-xs text-left flex items-center justify-between gap-1 border border-transparent transition {t.type ? typeColor(t.type) + ' font-bold' : 'bg-black/20 text-white hover:border-lime/40'}" on:click|stopPropagation={() => (openTypeFor = openTypeFor === t.id ? null : t.id)}>
							<span class={t.type ? '' : 'text-gray2'}>{t.type || 'Type'}</span>
							<svg class="w-3 h-3 transition-transform {openTypeFor === t.id ? 'rotate-180' : ''} {t.type ? 'text-black' : 'text-gray2'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
						</button>
						{#if openTypeFor === t.id}
							<div class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-xl shadow-xl z-20 w-max min-w-full overflow-hidden">
								{#each TRANSPORT_TYPES as opt}
									<button type="button" class="flex items-center gap-2 w-full px-3 py-1 text-left text-white hover:bg-lime hover:text-black transition cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap" on:click={() => setTransportType(t, opt)}>
										<span class="inline-block w-2 h-2 rounded-full {typeColor(opt).split(' ')[0]}"></span>
										{opt}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<DatePickerCompact variant="pill" bind:value={t.date} placeholder="Date" width="w-full" on:change={changed} />
					<input type="time" bind:value={t.time} class="w-full bg-black/20 rounded-full px-2 py-1 text-xs text-white outline-none border border-transparent focus:border-lime/60" on:change={changed} />
					<input bind:value={t.how} placeholder="Driver" class={inputCls} on:input={changed} />
					<input bind:value={t.from} placeholder="From" class={inputCls} on:input={changed} />
					<input bind:value={t.to} placeholder="To" class={inputCls} on:input={changed} />
					<input bind:value={t.name} placeholder="Names" class={inputCls} on:input={changed} />
					<input bind:value={t.notes} placeholder="Notes" class={inputCls} on:input={changed} />
					<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer shrink-0 justify-self-end" aria-label="Remove" on:click={() => removeTransport(t)}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- ============ GUESTLIST ============ -->
	<div>
		<div class="flex items-center justify-between mb-2 flex-wrap gap-2">
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray2">Guestlist</span>
			<button type="button" class={resetClass('guestlist')} on:click={() => clickReset('guestlist', resetGuestlist)}>{RESET_LABELS[resetStage.guestlist]}</button>
		</div>

		<!-- full width, three equal-size columns: GA / VIP / AA -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
			{#each TIERS as tier}
				<div class="bg-gray1/20 border border-gray1 rounded-2xl p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-[11px] font-black uppercase tracking-wider text-lime">{tier}</span>
						<button type="button" class="text-[11px] font-bold text-lime hover:opacity-80 cursor-pointer" on:click={() => addGuest(tier)}>+ Add</button>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-[10px] font-bold uppercase tracking-wider text-gray2 whitespace-nowrap">{tier} Allocation</span>
						<input
							type="text"
							inputmode="numeric"
							class="w-12 bg-gray1 rounded-full px-2 h-6 text-[11px] text-white text-center outline-none border border-transparent focus:border-lime/60"
							value={alloc[tier] ?? ''}
							on:change={(e) => setAlloc(tier, (e.target as HTMLInputElement).value)}
						/>
						<span class="text-[10px] {(usedByTier[tier] || 0) > (alloc[tier] ?? Infinity) ? 'text-problem font-bold' : 'text-gray3'}">
							{usedByTier[tier] || 0}{alloc[tier] !== undefined ? `/${alloc[tier]}` : ''}
						</span>
					</div>

					<div class="space-y-1">
						{#each byTier[tier] as g (g.id)}
							<div class="flex flex-wrap items-center gap-1">
								<input bind:value={g.first} placeholder="First" class="flex-1 min-w-[56px] bg-black/20 rounded-full px-2.5 h-7 text-[11px] text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60" on:input={changed} />
								<input bind:value={g.last} placeholder="Last" class="flex-1 min-w-[56px] bg-black/20 rounded-full px-2.5 h-7 text-[11px] text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60" on:input={changed} />
								<button type="button" class="shrink-0 px-2 h-7 rounded-full text-[11px] font-bold border transition-colors cursor-pointer {g.plus_one ? 'bg-lime/15 border-lime text-lime' : 'bg-gray1 border-transparent text-gray2'}" on:click={() => { g.plus_one = !g.plus_one; changed(); }}>+1</button>
								<button type="button" class="shrink-0 text-gray2 hover:text-problem p-0.5 cursor-pointer" aria-label="Remove" on:click={() => removeGuest(g)}>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<HospoEditorModal
	isOpen={hospoOpen}
	roleLabel={hospoLabel}
	rider={hospoRider}
	defaults={hospoDefaults}
	on:save={onHospoSave}
	on:close={() => (hospoOpen = false)}
/>