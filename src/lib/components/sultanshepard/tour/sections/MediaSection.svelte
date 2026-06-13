<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { MediaData, SSTourData, SSTourDate, InterviewRow } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
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

	$: photographer = tourData.event_details?.photographer;
	$: photographerEnabled = tourData.event_details?.photographer_enabled === true;

	// Hard-coded brief template, auto-filled from event info
	$: briefBody = buildBrief();
	function buildBrief(): string {
		const ed = tourData.event_details || {};
		const setTimes = (ed.set_times || []).filter((s) => s.time).map((s) => `- ${s.label}: ${s.time}`).join('\n');
		return [
			`Hi ${photographer?.name || ''},`,
			'',
			`Photo brief — ${tourDate?.venue || ''}, ${tourDate?.address?.city || ''} (${tourDate?.date || ''})`,
			'',
			`Venue: ${tourDate?.venue || ''}`,
			`Address: ${tourDate?.address?.full_address || ''}`,
			`Entrance / Accreditation: ${ed.artist_entrance || 'TBC'}`,
			'',
			'Set times:',
			setTimes || '- TBC',
			'',
			'Restrictions: No flash during performance. First 3 songs from pit unless told otherwise.',
			'Deadline: Selects within 48h, full gallery within 7 days.',
			'Rate: As agreed.',
			'',
			'Thanks!',
			'S+S Team'
		].join('\n');
	}

	function mailtoLink(): string {
		const subject = encodeURIComponent(`Photo Brief — ${tourDate?.venue || ''} ${tourDate?.date || ''}`);
		const body = encodeURIComponent(briefBody);
		return `mailto:${photographer?.email || ''}?subject=${subject}&body=${body}`;
	}

	async function copyBrief() {
		try {
			await navigator.clipboard.writeText(briefBody);
		} catch (e) {
			console.error(e);
		}
	}

	function addRow(list: 'interviews' | 'meet_greets') {
		data[list] = [...(data[list] || []), { id: uid(), name: '', hours: '', length: '', photo: false, video: false, recording: false, people: 0, notes: '' } as InterviewRow];
		changed();
	}
	function removeRow(list: 'interviews' | 'meet_greets', row: InterviewRow) {
		data[list] = (data[list] || []).filter((r) => r.id !== row.id);
		changed();
	}
</script>

<div class="space-y-6">
	<!-- Photographer -->
	<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-3">
		<div class="flex items-center justify-between flex-wrap gap-2">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Photographer <span class="text-lime normal-case">· linked to Event Details</span></span>
			{#if photographerEnabled && photographer}
				<span class="text-xs text-white">{photographer.name} <span class="text-gray2">{photographer.email || ''}</span></span>
			{/if}
		</div>

		{#if photographerEnabled}
			<div class="flex flex-wrap items-center gap-6">
				<Toggle label="Link received" checked={data.photo_link_received} on:change={(e) => { data.photo_link_received = e.detail; changed(); }} />
				<Toggle label="Brief sent" checked={data.brief_sent} on:change={(e) => { data.brief_sent = e.detail; changed(); }} />
			</div>
			{#if data.photo_link_received}
				<Field label="Gallery / Photos Link" type="url" bind:value={data.photo_link} placeholder="https://…" on:change={changed} />
			{/if}

			<details class="group">
				<summary class="text-xs font-bold text-lime cursor-pointer select-none">Preview brief (auto-filled from event info)</summary>
				<pre class="mt-2 bg-navbar rounded-xl p-3 text-xs text-gray3 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">{briefBody}</pre>
			</details>
			<div class="flex gap-3">
				<button type="button" class="px-4 h-9 rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 cursor-pointer" on:click={copyBrief}>Copy brief</button>
				<a class="px-4 h-9 rounded-full border border-gray2 text-gray3 text-xs font-bold flex items-center hover:bg-gray2 hover:text-black transition-colors" href={mailtoLink()}>Send by email</a>
			</div>
		{:else}
			<p class="text-xs text-gray2 italic">Enable the photographer in Event Details to manage the brief here.</p>
		{/if}
	</div>

	<!-- Interviews -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<Toggle label="Interviews" checked={data.interviews_enabled ?? false} on:change={(e) => { data.interviews_enabled = e.detail; changed(); }} />
			{#if data.interviews_enabled}
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={() => addRow('interviews')}>+ Add interview</button>
			{/if}
		</div>
		{#if data.interviews_enabled}
			<div class="space-y-2">
				{#each data.interviews || [] as row (row.id)}
					<div class="grid grid-cols-2 md:grid-cols-[1fr_90px_90px_auto_auto_auto_1fr_auto] gap-2 items-center bg-gray1/30 rounded-xl p-2">
						<Field small bind:value={row.name} placeholder="Outlet / Name" on:change={changed} />
						<Field small type="time" bind:value={row.hours} on:change={changed} />
						<Field small bind:value={row.length} placeholder="Length" on:change={changed} />
						<Toggle label="Photo" checked={row.photo} on:change={(e) => { row.photo = e.detail; changed(); }} />
						<Toggle label="Video" checked={row.video} on:change={(e) => { row.video = e.detail; changed(); }} />
						<Toggle label="Rec" checked={row.recording} on:change={(e) => { row.recording = e.detail; changed(); }} />
						<Field small bind:value={row.notes} placeholder="Notes" on:change={changed} />
						<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeRow('interviews', row)}>✕</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Meet & Greet -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<Toggle label="Meet & Greet" checked={data.meet_greet_enabled ?? false} on:change={(e) => { data.meet_greet_enabled = e.detail; changed(); }} />
			{#if data.meet_greet_enabled}
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={() => addRow('meet_greets')}>+ Add M&G</button>
			{/if}
		</div>
		{#if data.meet_greet_enabled}
			<div class="space-y-2">
				{#each data.meet_greets || [] as row (row.id)}
					<div class="grid grid-cols-2 md:grid-cols-[1fr_90px_90px_auto_auto_90px_1fr_auto] gap-2 items-center bg-gray1/30 rounded-xl p-2">
						<Field small bind:value={row.name} placeholder="Name" on:change={changed} />
						<Field small type="time" bind:value={row.hours} on:change={changed} />
						<Field small bind:value={row.length} placeholder="Length" on:change={changed} />
						<Toggle label="Photo" checked={row.photo} on:change={(e) => { row.photo = e.detail; changed(); }} />
						<Toggle label="Video" checked={row.video} on:change={(e) => { row.video = e.detail; changed(); }} />
						<Field small type="number" bind:value={row.people} placeholder="# ppl" on:change={changed} />
						<Field small bind:value={row.notes} placeholder="Notes" on:change={changed} />
						<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeRow('meet_greets', row)}>✕</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
