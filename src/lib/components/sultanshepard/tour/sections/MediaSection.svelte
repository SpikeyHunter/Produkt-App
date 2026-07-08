<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { MediaData, SSTourData, SSTourDate, InterviewRow } from '$lib/types/tour';
	import Toggle from '../ui/Toggle.svelte';

	export let data: MediaData = {};
	export let tourData: SSTourData;
	export let tourDate: SSTourDate | null = null;

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// ---------- media crew (live from Event Details) ----------
	$: ed = tourData.event_details || {};
	$: mediaCrew = ed.media_crew_enabled ? ed.media_crew || [] : [];
	$: hasPhotographer = mediaCrew.some((m) => /photograph/i.test(m.role || ''));
	$: hasVideographer = mediaCrew.some((m) => /videograph/i.test(m.role || ''));
	$: hasAnyMedia = mediaCrew.length >= 1;

	// Ensure brief objects exist so reads/writes are safe.
	let init = false;
	$: if (!init && data) {
		if (!data.photographer) data.photographer = {};
		if (!data.videographer) data.videographer = {};
		init = true;
	}

	const BRIEFS = [
		{ key: 'photographer' as const, title: 'Photographer Brief' },
		{ key: 'videographer' as const, title: 'Videographer Brief' }
	];
	const briefAvailable = (key: 'photographer' | 'videographer') =>
		key === 'photographer' ? hasPhotographer : hasVideographer;

	function setBrief(key: 'photographer' | 'videographer', patch: Partial<MediaData['photographer']>) {
		data[key] = { ...(data[key] || {}), ...patch };
		changed();
	}

	// copy / email — wired later
	async function copyBrief(key: 'photographer' | 'videographer') {
		try {
			await navigator.clipboard.writeText(data[key]?.notes || '');
		} catch (e) {
			console.error(e);
		}
	}
	function emailBrief(key: 'photographer' | 'videographer') {
		const subject = encodeURIComponent(`${key === 'photographer' ? 'Photo' : 'Video'} Brief — ${tourDate?.venue || ''} ${tourDate?.date || ''}`);
		const body = encodeURIComponent(data[key]?.notes || '');
		window.location.href = `mailto:?subject=${subject}&body=${body}`;
	}

	// ---------- interview / M&G rows (shared shape) ----------
	function addRow(list: 'interviews' | 'meet_greets') {
		data[list] = [
			...(data[list] || []),
			{ id: uid(), name: '', hours: '', length: '', photo: false, video: false, recording: false, people: 0, notes: '' } as InterviewRow
		];
		changed();
	}
	function removeRow(list: 'interviews' | 'meet_greets', row: InterviewRow) {
		data[list] = (data[list] || []).filter((r) => r.id !== row.id);
		changed();
	}
	function setPax(row: InterviewRow, e: Event) {
		const v = (e.target as HTMLInputElement).value;
		row.people = v === '' ? 0 : parseInt(v, 10) || 0;
		changed();
	}

	// ---------- per-section reset (Reset → Are you sure? → Confirm) ----------
	type Section = 'photographer' | 'videographer' | 'interviews' | 'mg';
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];
	let resetStage: Record<Section, 0 | 1 | 2> = { photographer: 0, videographer: 0, interviews: 0, mg: 0 };
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
	const resetBrief = (key: 'photographer' | 'videographer') => () =>
		setBrief(key, { link_received: false, link: '', notes: '' });
	const resetInterviews = () => { data.interviews = []; changed(); };
	const resetMG = () => { data.meet_greets = []; changed(); };

	const resetClass = (s: Section) =>
		`cursor-pointer px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all ${
			resetStage[s] === 0
				? 'border-gray3/40 text-gray3 hover:border-problem hover:text-problem'
				: resetStage[s] === 1
					? 'border-problem/60 text-problem'
					: 'border-problem bg-problem text-black'
		}`;

	onDestroy(() => Object.values(resetTimers).forEach((t) => clearTimeout(t)));

	const rowInput =
		'bg-gray1 rounded-full px-3 h-8 text-xs text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60 transition-colors';
	const pill = (on: boolean) =>
		`shrink-0 px-2.5 h-8 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
			on ? 'bg-lime/15 border-lime text-lime' : 'bg-gray1 border-transparent text-gray2'
		}`;
</script>

<div class="space-y-4">
	<!-- ============ ROW 1 — Brief cards (Photographer · Videographer) ============ -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		{#each BRIEFS as b}
			{@const available = briefAvailable(b.key)}
			{@const brief = data[b.key] || {}}
			<div class="bg-gray1/20 border border-gray1 rounded-xl p-3 space-y-2 {available ? '' : 'opacity-50'}">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2 min-w-0">
						{#if available}
							<Toggle label="" checked={brief.enabled ?? false} on:change={(e) => setBrief(b.key, { enabled: e.detail })} />
						{/if}
						<span class="text-[11px] font-bold uppercase tracking-wider text-lime truncate">{b.title}</span>
					</div>
					<div class="flex items-center gap-1 shrink-0">
						{#if available && brief.enabled}
							<button type="button" class={resetClass(b.key)} on:click={() => clickReset(b.key, resetBrief(b.key))}>{RESET_LABELS[resetStage[b.key]]}</button>
						{/if}
						<button type="button" class="p-1.5 text-gray2 hover:text-lime cursor-pointer" aria-label="Copy brief" title="Copy" on:click={() => copyBrief(b.key)}>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
						</button>
						<button type="button" class="p-1.5 text-gray2 hover:text-lime cursor-pointer" aria-label="Email brief" title="Email" on:click={() => emailBrief(b.key)}>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
						</button>
					</div>
				</div>

				{#if !available}
					<p class="text-xs text-gray2 italic">Please add media to crew to enable this.</p>
				{:else if brief.enabled}
					<div class="flex items-center gap-3">
						<Toggle label="Link received" checked={brief.link_received ?? false} on:change={(e) => setBrief(b.key, { link_received: e.detail })} />
					</div>
					{#if brief.link_received}
						<input class="w-full {rowInput} h-9" type="url" placeholder="Paste link…" value={brief.link || ''} on:input={(e) => setBrief(b.key, { link: (e.target as HTMLInputElement).value })} />
					{/if}
					<div>
						<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1">Brief Notes</span>
						<textarea
							rows="2"
							class="w-full bg-gray1 rounded-2xl px-3 py-2 text-xs text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none"
							placeholder="Extra notes…"
							value={brief.notes || ''}
							on:input={(e) => setBrief(b.key, { notes: (e.target as HTMLTextAreaElement).value })}
						></textarea>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- ============ ROW 2 — Interviews · Meet & Greet ============ -->
	<div class="grid grid-cols-1 gap-4">
		<!-- Interviews -->
		<div class={hasAnyMedia ? '' : 'opacity-50'}>
			<div class="flex items-center justify-between mb-2 gap-2 {hasAnyMedia ? '' : 'pointer-events-none'}">
				<Toggle label="Interviews" checked={data.interviews_enabled ?? false} on:change={(e) => { data.interviews_enabled = e.detail; changed(); }} />
				{#if hasAnyMedia && data.interviews_enabled}
					<div class="flex items-center gap-2">
						<button type="button" class={resetClass('interviews')} on:click={() => clickReset('interviews', resetInterviews)}>{RESET_LABELS[resetStage.interviews]}</button>
						<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={() => addRow('interviews')}>+ Add interview</button>
					</div>
				{/if}
			</div>

			{#if !hasAnyMedia}
				<p class="text-xs text-gray2 italic">Please add media to crew to enable this.</p>
			{:else if data.interviews_enabled}
				<div class="space-y-1.5">
					{#each data.interviews || [] as row (row.id)}
						<div class="flex flex-wrap items-center gap-2 bg-gray1/30 rounded-xl p-2">
							<input class="flex-1 min-w-[120px] {rowInput}" bind:value={row.name} placeholder="Outlet / Name" on:input={changed} />
							<input class="w-[92px] {rowInput}" type="time" bind:value={row.hours} on:change={changed} />
							<input class="w-[80px] {rowInput}" bind:value={row.length} placeholder="Length" on:input={changed} />
							<button type="button" class={pill(!!row.photo)} on:click={() => { row.photo = !row.photo; changed(); }}>Photo</button>
							<button type="button" class={pill(!!row.video)} on:click={() => { row.video = !row.video; changed(); }}>Video</button>
							<button type="button" class={pill(!!row.recording)} on:click={() => { row.recording = !row.recording; changed(); }}>Rec</button>
							<input class="flex-1 min-w-[120px] {rowInput}" bind:value={row.notes} placeholder="Notes" on:input={changed} />
							<button type="button" class="shrink-0 text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeRow('interviews', row)}>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>
					{:else}
						<p class="text-xs text-gray2 italic">No interviews yet — add one.</p>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Meet & Greet -->
		<div class={hasAnyMedia ? '' : 'opacity-50'}>
			<div class="flex items-center justify-between mb-2 gap-2 {hasAnyMedia ? '' : 'pointer-events-none'}">
				<Toggle label="Meet & Greet" checked={data.meet_greet_enabled ?? false} on:change={(e) => { data.meet_greet_enabled = e.detail; changed(); }} />
				{#if hasAnyMedia && data.meet_greet_enabled}
					<div class="flex items-center gap-2">
						<button type="button" class={resetClass('mg')} on:click={() => clickReset('mg', resetMG)}>{RESET_LABELS[resetStage.mg]}</button>
						<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={() => addRow('meet_greets')}>+ Add M&G</button>
					</div>
				{/if}
			</div>

			{#if !hasAnyMedia}
				<p class="text-xs text-gray2 italic">Please add media to crew to enable this.</p>
			{:else if data.meet_greet_enabled}
				<div class="space-y-1.5">
					{#each data.meet_greets || [] as row (row.id)}
						<div class="flex flex-wrap items-center gap-2 bg-gray1/30 rounded-xl p-2">
							<input class="flex-1 min-w-[120px] {rowInput}" bind:value={row.name} placeholder="Name" on:input={changed} />
							<input class="w-[92px] {rowInput}" type="time" bind:value={row.hours} on:change={changed} />
							<input class="w-[80px] {rowInput}" bind:value={row.length} placeholder="Length" on:input={changed} />
							<button type="button" class={pill(!!row.photo)} on:click={() => { row.photo = !row.photo; changed(); }}>Photo</button>
							<button type="button" class={pill(!!row.video)} on:click={() => { row.video = !row.video; changed(); }}>Video</button>
							<input class="no-spin w-[64px] {rowInput} text-center" type="number" placeholder="# Pax" value={row.people ?? ''} on:input={(e) => setPax(row, e)} />
							<input class="flex-1 min-w-[120px] {rowInput}" bind:value={row.notes} placeholder="Notes" on:input={changed} />
							<button type="button" class="shrink-0 text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeRow('meet_greets', row)}>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
							</button>
						</div>
					{:else}
						<p class="text-xs text-gray2 italic">No meet &amp; greets yet — add one.</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.no-spin::-webkit-inner-spin-button,
	.no-spin::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.no-spin {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>