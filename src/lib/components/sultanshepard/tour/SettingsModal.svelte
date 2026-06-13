<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSCrew, CrewType, MerchDefaultItem, TracklistTrack, RidersSettings } from '$lib/types/tour';
	import { fetchCrew, createCrew, updateCrew, deleteCrew, getSetting, setSetting } from '$lib/services/tourService';

	export let open = false;
	// kept in sync with the page so other components (sections) see fresh data
	export let crew: SSCrew[] = [];
	export let riders: RidersSettings | null = null;
	export let merchDefaults: MerchDefaultItem[] = [];
	export let tracklist: TracklistTrack[] = [];

	const dispatch = createEventDispatcher();

	type Tab = 'crew' | 'merch' | 'tracklist' | 'riders';
	let tab: Tab = 'crew';
	let saving = false;
	let savedFlash = false;

	// Working copy with passport/airlines guaranteed present (avoids undefined in template bindings)
	type CrewDraft = Omit<SSCrew, 'passport' | 'airlines'> & {
		passport: NonNullable<SSCrew['passport']>;
		airlines: NonNullable<SSCrew['airlines']>;
	};

	const SEATS: { v: 'window' | 'aisle'; l: string }[] = [
		{ v: 'window', l: 'Window' },
		{ v: 'aisle', l: 'Aisle' }
	];

	const CREW_TYPES: { value: CrewType; label: string }[] = [
		{ value: 'artist', label: 'Artist' },
		{ value: 'prod', label: 'Production' },
		{ value: 'singer', label: 'Singer' },
		{ value: 'management', label: 'Management' },
		{ value: 'media', label: 'Media' }
	];

	const RIDER_KEYS: { key: string; label: string }[] = [
		{ key: 'artist', label: 'Artist rider' },
		{ key: 'prod', label: 'Prod rider' },
		{ key: 'singer_1', label: 'Singer 1 rider' },
		{ key: 'singer_2', label: 'Singer 2 rider' },
		{ key: 'singer_3', label: 'Singer 3 rider' },
		{ key: 'singer_4', label: 'Singer 4 rider' }
	];

	// ---------- CREW ----------
	let editingCrew: CrewDraft | null = null; // working copy
	let isNewCrew = false;

	function blankCrew(): CrewDraft {
		return {
			id: '',
			name: '',
			role: '',
			crew_type: 'prod',
			salary: 0,
			email: '',
			phone: '',
			passport: {},
			airlines: {},
			seat_preference: 'window',
			is_active: true
		};
	}

	function editCrewMember(c: SSCrew) {
		const copy = structuredClone(c);
		editingCrew = {
			...copy,
			passport: copy.passport ?? {},
			airlines: copy.airlines ?? {},
			is_active: copy.is_active ?? true
		};
		isNewCrew = false;
	}

	function setSeat(v: 'window' | 'aisle') {
		if (!editingCrew) return;
		editingCrew.seat_preference = v;
	}
	function newCrewMember() {
		editingCrew = blankCrew();
		isNewCrew = true;
	}

	async function saveCrewMember() {
		if (!editingCrew || !editingCrew.name.trim()) return;
		saving = true;
		try {
			if (isNewCrew) {
				const { id, ...payload } = editingCrew;
				const created = await createCrew(payload);
				crew = [...crew, created];
			} else {
				const updated = await updateCrew(editingCrew.id, editingCrew);
				crew = crew.map((c) => (c.id === updated.id ? updated : c));
			}
			editingCrew = null;
			flash();
		} catch (e) {
			console.error('Failed to save crew member', e);
		} finally {
			saving = false;
		}
	}

	async function removeCrewMember(c: SSCrew) {
		if (!confirm(`Remove ${c.name} from the crew list?`)) return;
		try {
			await deleteCrew(c.id);
			crew = crew.filter((x) => x.id !== c.id);
			if (editingCrew?.id === c.id) editingCrew = null;
		} catch (e) {
			console.error('Failed to delete crew member', e);
		}
	}

	// ---------- MERCH DEFAULTS ----------
	function addMerchDefault() {
		merchDefaults = [...merchDefaults, { name: '', price: 0, photo_url: '' }];
	}
	function removeMerchDefault(i: number) {
		merchDefaults = merchDefaults.filter((_, idx) => idx !== i);
	}
	async function saveMerchDefaults() {
		saving = true;
		try {
			merchDefaults = merchDefaults.filter((m) => m.name.trim());
			await setSetting('merch_defaults', merchDefaults);
			flash();
		} finally {
			saving = false;
		}
	}

	// ---------- TRACKLIST ----------
	function addTrack() {
		tracklist = [...tracklist, { order: tracklist.length + 1, name: '', notes: '' }];
	}
	function removeTrack(i: number) {
		tracklist = tracklist.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, order: idx + 1 }));
	}
	function moveTrack(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= tracklist.length) return;
		const copy = [...tracklist];
		[copy[i], copy[j]] = [copy[j], copy[i]];
		tracklist = copy.map((t, idx) => ({ ...t, order: idx + 1 }));
	}
	async function saveTracklist() {
		saving = true;
		try {
			tracklist = tracklist.filter((t) => t.name.trim()).map((t, idx) => ({ ...t, order: idx + 1 }));
			await setSetting('tracklist', tracklist);
			flash();
		} finally {
			saving = false;
		}
	}

	// ---------- RIDERS ----------
	// Edit as one textarea per rider, one item per line.
	let riderText: Record<string, string> = {};
	$: if (open && riders && Object.keys(riderText).length === 0) {
		for (const { key } of RIDER_KEYS) riderText[key] = (riders[key] || []).join('\n');
	}
	$: if (!open) riderText = {};

	async function saveRiders() {
		saving = true;
		try {
			const next: RidersSettings = { artist: [], prod: [], singer_1: [], singer_2: [], singer_3: [], singer_4: [] };
			for (const { key } of RIDER_KEYS) {
				next[key] = (riderText[key] || '')
					.split('\n')
					.map((l) => l.trim())
					.filter(Boolean);
			}
			await setSetting('riders', next);
			riders = next;
			flash();
		} finally {
			saving = false;
		}
	}

	function flash() {
		savedFlash = true;
		setTimeout(() => (savedFlash = false), 1500);
	}

	function close() {
		open = false;
		editingCrew = null;
		dispatch('close');
	}

	const TABS: { id: Tab; label: string }[] = [
		{ id: 'crew', label: 'Crew' },
		{ id: 'merch', label: 'Merch Defaults' },
		{ id: 'tracklist', label: 'Tracklist' },
		{ id: 'riders', label: 'Default Riders' }
	];
</script>

{#if open}
	<div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" on:click|self={close} role="presentation">
		<div class="bg-navbar rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
			<!-- header -->
			<div class="flex items-center gap-3 px-6 py-4 border-b border-gray1 shrink-0">
				<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
					<line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
					<line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
					<line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
				</svg>
				<h2 class="text-lg font-bold text-white flex-1">App Settings</h2>
				{#if savedFlash}
					<span class="text-xs font-bold text-confirmed">Saved ✓</span>
				{/if}
				<button class="text-gray2 hover:text-white transition" on:click={close} aria-label="Close">
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
				</button>
			</div>

			<!-- tabs -->
			<div class="flex gap-1 px-6 pt-3 border-b border-gray1 shrink-0">
				{#each TABS as t}
					<button
						class="px-4 py-2 text-sm font-bold rounded-t-lg transition {tab === t.id ? 'bg-black/40 text-lime' : 'text-gray2 hover:text-white'}"
						on:click={() => (tab = t.id)}
					>
						{t.label}
					</button>
				{/each}
			</div>

			<!-- body -->
			<div class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
				<!-- ============ CREW ============ -->
				{#if tab === 'crew'}
					{#if !editingCrew}
						<div class="space-y-2">
							<button class="px-4 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition" on:click={newCrewMember}>
								+ Add crew member
							</button>
							{#each crew as c (c.id)}
								<div class="flex items-center gap-3 bg-black/30 border border-gray1 rounded-xl px-4 py-3 group">
									<div class="flex-1 min-w-0">
										<p class="text-sm font-bold text-white truncate">
											{c.name}
											{#if c.is_active === false}<span class="text-gray2 font-normal text-xs">(inactive)</span>{/if}
										</p>
										<p class="text-xs text-gray2 truncate">{c.role || '—'} · {c.crew_type} · ${c.salary ?? 0}/show</p>
									</div>
									<span class="text-xs text-gray2 truncate hidden md:block max-w-[180px]">{c.email || ''}</span>
									<button class="text-gray2 hover:text-lime transition" on:click={() => editCrewMember(c)} aria-label="Edit">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									<button class="text-gray2 hover:text-problem transition opacity-0 group-hover:opacity-100" on:click={() => removeCrewMember(c)} aria-label="Delete">
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
									</button>
								</div>
							{:else}
								<p class="text-sm text-gray2 italic">No crew yet — add your first member.</p>
							{/each}
						</div>
					{:else}
						<!-- crew edit form -->
						<div class="space-y-4">
							<button class="text-xs text-gray2 hover:text-white transition" on:click={() => (editingCrew = null)}>← Back to list</button>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Name *</span>
									<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.name} />
								</label>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Role</span>
									<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" placeholder="Tour Manager, FOH, LD…" bind:value={editingCrew.role} />
								</label>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Type</span>
									<select class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.crew_type}>
										{#each CREW_TYPES as t}<option value={t.value}>{t.label}</option>{/each}
									</select>
								</label>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Salary / show (USD)</span>
									<input type="number" class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.salary} />
								</label>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Email</span>
									<input type="email" class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.email} />
								</label>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Phone</span>
									<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.phone} />
								</label>
							</div>

							<!-- passport -->
							<div class="bg-black/30 border border-gray1 rounded-xl p-4 space-y-3">
								<h4 class="text-xs font-black uppercase tracking-wider text-gray3">Passport</h4>
								<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">Number</span>
										<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.passport.number} />
									</label>
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">Country</span>
										<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.passport.country} />
									</label>
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">Expiry</span>
										<input type="date" class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.passport.expiry} />
									</label>
								</div>
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Passport photo URL</span>
									<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" placeholder="https:// (link to photo — Supabase Storage upload can be added later)" bind:value={editingCrew.passport.photo_url} />
								</label>
								{#if editingCrew.passport.photo_url}
									<img src={editingCrew.passport.photo_url} alt="Passport" class="h-24 rounded-lg border border-gray1 object-cover" />
								{/if}
							</div>

							<!-- airlines + seat -->
							<div class="bg-black/30 border border-gray1 rounded-xl p-4 space-y-3">
								<h4 class="text-xs font-black uppercase tracking-wider text-gray3">Airline loyalty numbers</h4>
								<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">Air Canada</span>
										<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.airlines.air_canada} />
									</label>
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">United</span>
										<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.airlines.united} />
									</label>
									<label class="block">
										<span class="text-[10px] uppercase tracking-wider text-gray2">Delta</span>
										<input class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime" bind:value={editingCrew.airlines.delta} />
									</label>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-[10px] uppercase tracking-wider text-gray2">Seat preference</span>
									<div class="flex rounded-lg overflow-hidden border border-gray1">
										{#each SEATS as s}
											<button
												class="px-3 py-1.5 text-xs font-bold transition {editingCrew.seat_preference === s.v ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
												on:click={() => setSeat(s.v)}
											>
												{s.l}
											</button>
										{/each}
									</div>
								</div>
							</div>

							<label class="flex items-center gap-2 text-sm text-gray3">
								<input type="checkbox" class="accent-lime" bind:checked={editingCrew.is_active} />
								Active (shows up in crew pickers)
							</label>

							<div class="flex gap-3">
								<button
									class="px-5 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
									disabled={saving || !editingCrew.name.trim()}
									on:click={saveCrewMember}
								>
									{saving ? 'Saving…' : isNewCrew ? 'Create member' : 'Save changes'}
								</button>
								<button class="px-4 py-2 rounded-lg border border-gray1 text-gray3 text-sm hover:border-gray2 transition" on:click={() => (editingCrew = null)}>
									Cancel
								</button>
							</div>
						</div>
					{/if}

				<!-- ============ MERCH DEFAULTS ============ -->
				{:else if tab === 'merch'}
					<div class="space-y-3">
						<p class="text-xs text-gray2">Default merch items loaded into each show's Merch tab.</p>
						{#each merchDefaults as item, i}
							<div class="flex items-center gap-2">
								<input class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime" placeholder="Item name (T-shirt, Hoodie, Vinyl…)" bind:value={item.name} />
								<input type="number" class="w-24 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-lime" placeholder="Price" bind:value={item.price} />
								<input class="w-48 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime hidden md:block" placeholder="Photo URL" bind:value={item.photo_url} />
								<button class="text-gray2 hover:text-problem transition" on:click={() => removeMerchDefault(i)} aria-label="Remove">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{/each}
						<div class="flex gap-3">
							<button class="text-xs text-gray2 hover:text-lime transition" on:click={addMerchDefault}>+ Add item</button>
							<button class="ml-auto px-5 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40" disabled={saving} on:click={saveMerchDefaults}>
								{saving ? 'Saving…' : 'Save merch defaults'}
							</button>
						</div>
					</div>

				<!-- ============ TRACKLIST ============ -->
				{:else if tab === 'tracklist'}
					<div class="space-y-3">
						<p class="text-xs text-gray2">Default set list template — loadable into any show's Set List tab.</p>
						{#each tracklist as track, i}
							<div class="flex items-center gap-2">
								<span class="w-6 text-xs font-black text-gray2 text-right shrink-0">{i + 1}.</span>
								<input class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime" placeholder="Track name" bind:value={track.name} />
								<input class="w-56 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime hidden md:block" placeholder="Notes" bind:value={track.notes} />
								<div class="flex flex-col">
									<button class="text-gray2 hover:text-lime transition disabled:opacity-20" disabled={i === 0} on:click={() => moveTrack(i, -1)} aria-label="Move up">
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg>
									</button>
									<button class="text-gray2 hover:text-lime transition disabled:opacity-20" disabled={i === tracklist.length - 1} on:click={() => moveTrack(i, 1)} aria-label="Move down">
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
									</button>
								</div>
								<button class="text-gray2 hover:text-problem transition" on:click={() => removeTrack(i)} aria-label="Remove">
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{/each}
						<div class="flex gap-3">
							<button class="text-xs text-gray2 hover:text-lime transition" on:click={addTrack}>+ Add track</button>
							<button class="ml-auto px-5 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40" disabled={saving} on:click={saveTracklist}>
								{saving ? 'Saving…' : 'Save tracklist'}
							</button>
						</div>
					</div>

				<!-- ============ RIDERS ============ -->
				{:else if tab === 'riders'}
					<div class="space-y-4">
						<p class="text-xs text-gray2">One item per line. These are loaded as defaults in each show's Logistics tab.</p>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each RIDER_KEYS as r}
								<label class="block">
									<span class="text-[10px] uppercase tracking-wider text-gray2">{r.label}</span>
									<textarea
										rows="6"
										class="mt-1 w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime resize-y"
										placeholder={'12x water bottles\n6x towels\n…'}
										bind:value={riderText[r.key]}
									></textarea>
								</label>
							{/each}
						</div>
						<button class="px-5 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40" disabled={saving} on:click={saveRiders}>
							{saving ? 'Saving…' : 'Save riders'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}