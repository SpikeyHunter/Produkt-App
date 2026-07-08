<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type {
		ImmigrationData,
		ImmigrationCrewRow,
		SSTourData,
		SSTourDate,
		SSCrew
	} from '$lib/types/tour';
	import Toggle from '../ui/Toggle.svelte';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
	import { getAccessToken } from '$lib/stores/auth';

	export let data: ImmigrationData = {};
	export let tourData: SSTourData;
	export let tourDate: SSTourDate | null = null;
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Auto-link rows to crew assigned on this show.
	$: assignedCrew = crew.filter((c) => (tourData.event_details?.crew_ids || []).includes(c.id));
	$: if (data.enabled && assignedCrew.length) syncRows();

	function syncRows() {
		const existing = new Map((data.rows || []).map((r) => [r.crew_id, r]));
		const rows: ImmigrationCrewRow[] = assignedCrew.map(
			(c) => existing.get(c.id) || { crew_id: c.id }
		);
		const same =
			rows.length === (data.rows || []).length &&
			rows.every((r, i) => (data.rows || [])[i]?.crew_id === r.crew_id);
		if (!same) {
			data.rows = rows;
			changed();
		}
	}

	const crewName = (id: string) => crew.find((c) => c.id === id)?.name || 'Unknown';

	function mailto(row: ImmigrationCrewRow): string {
		const member = crew.find((c) => c.id === row.crew_id);
		const subject = encodeURIComponent('Your immigration document for the show');
		const body = encodeURIComponent(
			`Hi ${member?.name || ''},\n\nPlease find your immigration letter/visa document here:\n${row.document_link || '[link]'}\n\nKeep it with your passport when travelling.\n\nThanks,\nS+S Team`
		);
		return `mailto:${member?.email || ''}?subject=${subject}&body=${body}`;
	}

	// ---------- file upload ----------
	let uploadRow: ImmigrationCrewRow | null = null;
	let showUploadModal = false;
	let isUploading = false;
	let previewTargetUrl = '';
	let previewTargetName = '';
	let showPreviewModal = false;

	const isUrl = (s: string) => /^https?:\/\//.test(s || '');
	const isFile = (s: string) =>
		isUrl(s) && s.includes('/storage/v1/object/public/documents/');

	function openUpload(row: ImmigrationCrewRow) {
		uploadRow = row;
		showUploadModal = true;
	}
	function openLink(url: string) {
		if (url) window.open(url, '_blank');
	}
	function openPreview(url: string, name: string) {
		previewTargetUrl = url;
		previewTargetName = name;
		showPreviewModal = true;
	}

	async function handleUploadEvent(e: CustomEvent) {
		if (!uploadRow) return;
		const { file, fileName } = e.detail;
		isUploading = true;
		try {
			const token = await getAccessToken();
			if (!token) throw new Error('Not authenticated.');

			const formData = new FormData();
			formData.append('file', file);

			const member = crew.find((c) => c.id === uploadRow!.crew_id);
			const safeName = (member?.name || 'Crew').replace(/[^a-zA-Z0-9]/g, '_');
			const safeDate = (tourDate?.date || '').replace(/-/g, '');
			const ext = fileName.split('.').pop();
			const customFileName = `Immigration_${safeName}${safeDate ? '_' + safeDate : ''}.${ext}`;

			// → bucket: documents / sultanshepard / immigration /
			formData.append('filePath', `sultanshepard/immigration/${customFileName}`);
			formData.append('bucket', 'documents');

			const res = await fetch('/api/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});
			if (!res.ok) throw new Error('Upload failed');

			const json = await res.json();
			uploadRow.document_link = json.publicUrl;
			changed();
			showUploadModal = false;
		} catch (err) {
			console.error('File upload failed', err);
			alert('Failed to upload file.');
		} finally {
			isUploading = false;
			uploadRow = null;
		}
	}
	// ---------- per-card reset (Reset → Are you sure? → Confirm), keyed by crew_id ----------
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];
	let resetStage: Record<string, 0 | 1 | 2> = {};
	let resetTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function clickReset(row: ImmigrationCrewRow) {
		const id = row.crew_id;
		clearTimeout(resetTimers[id]);
		const stage = resetStage[id] ?? 0;
		if (stage < 2) {
			resetStage = { ...resetStage, [id]: (stage + 1) as 0 | 1 | 2 };
			resetTimers[id] = setTimeout(() => (resetStage = { ...resetStage, [id]: 0 }), 4000);
			return;
		}
		resetStage = { ...resetStage, [id]: 0 };
		// Clear everything but keep the crew link (rows are auto-generated per crew).
		row.info_sent_to_promoter = false;
		row.letter_or_visa_received = false;
		row.sent_to_crew = false;
		row.document_link = '';
		row.eta_required = false;
		row.eta_confirmed = false;
		changed();
	}

	const resetClass = (id: string) => {
		const stage = resetStage[id] ?? 0;
		return `cursor-pointer px-2.5 h-7 rounded-full border text-[10px] font-bold transition-all ${
			stage === 0
				? 'border-gray3/40 text-gray3 hover:border-problem hover:text-problem'
				: stage === 1
					? 'border-problem/60 text-problem'
					: 'border-problem bg-problem text-black'
		}`;
	};

	onDestroy(() => Object.values(resetTimers).forEach((t) => clearTimeout(t)));
</script>

<div class="space-y-3">
	<Toggle label="Immigration needed for this show" checked={data.enabled} on:change={(e) => { data.enabled = e.detail; changed(); }} />

	{#if data.enabled}
		{#if !assignedCrew.length}
			<p class="text-xs text-tentatif">Assign crew in <span class="font-bold">Event Details</span> — immigration cards are generated per crew member automatically.</p>
		{/if}

		<!-- 2-column card grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
			{#each data.rows || [] as row (row.crew_id)}
				<div class="bg-gray1/30 rounded-xl p-3 space-y-2">
					<div class="flex items-center justify-between gap-2">
						<span class="text-sm font-bold text-white truncate">{crewName(row.crew_id)}</span>
						<div class="flex items-center gap-1.5 shrink-0">
							<button type="button" class={resetClass(row.crew_id)} on:click={() => clickReset(row)}>
								{RESET_LABELS[resetStage[row.crew_id] ?? 0]}
							</button>
							<a
								class="shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-lime text-lime hover:bg-lime/10 transition cursor-pointer"
								href={mailto(row)}
								title="Email crew member"
								aria-label="Email crew member"
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
							</a>
						</div>
					</div>

					<!-- status toggles (compact, chained) -->
					<div class="flex flex-col gap-2.5 py-1">
						<div><Toggle label="Info sent to promoter" checked={row.info_sent_to_promoter} on:change={(e) => { row.info_sent_to_promoter = e.detail; changed(); }} /></div>
						{#if row.info_sent_to_promoter}
							<div><Toggle label="Letter / visa received" checked={row.letter_or_visa_received} on:change={(e) => { row.letter_or_visa_received = e.detail; changed(); }} /></div>
						{/if}
						{#if row.letter_or_visa_received}
							<div><Toggle label="Sent to crew member" checked={row.sent_to_crew} on:change={(e) => { row.sent_to_crew = e.detail; changed(); }} /></div>
						{/if}
						<div><Toggle label="ETA required" checked={row.eta_required} on:change={(e) => { row.eta_required = e.detail; changed(); }} /></div>
						{#if row.eta_required}
							<div><Toggle label="ETA confirmed" checked={row.eta_confirmed} on:change={(e) => { row.eta_confirmed = e.detail; changed(); }} /></div>
						{/if}
					</div>

					<!-- document upload / link (once letter received) -->
					{#if row.letter_or_visa_received}
						<div>
							<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1">Document</span>
							<div class="relative border border-dashed {row.document_link ? 'border-lime/40 bg-lime/5' : 'border-gray2/40 hover:border-lime/60'} rounded-xl p-1.5 flex items-center gap-1.5 transition-colors">
								{#if isFile(row.document_link || '')}
									<span class="flex-1 px-2 text-xs text-lime truncate select-none">Document file</span>
									<button type="button" class="shrink-0 px-2.5 h-7 rounded-full bg-gray3 text-black text-[11px] font-bold hover:brightness-110 transition cursor-pointer" on:click={() => openPreview(row.document_link || '', 'Immigration Document')}>Preview</button>
									<button type="button" class="shrink-0 p-1 text-gray2 hover:text-problem cursor-pointer" title="Remove" on:click={() => { row.document_link = ''; changed(); }}>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
									</button>
								{:else}
									<input
										class="flex-1 bg-transparent px-2 h-7 text-xs text-white placeholder-gray2/50 outline-none {isUrl(row.document_link || '') ? 'text-lime' : ''}"
										placeholder="Paste a link or upload…"
										bind:value={row.document_link}
										on:input={changed}
									/>
									{#if row.document_link && isUrl(row.document_link)}
										<button type="button" class="shrink-0 px-2.5 h-7 rounded-full bg-gray3 text-black text-[11px] font-bold hover:brightness-110 transition cursor-pointer flex items-center gap-1" on:click={() => openLink(row.document_link || '')}>
											Open <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
										</button>
										<button type="button" class="shrink-0 p-1 text-gray2 hover:text-problem cursor-pointer" title="Clear" on:click={() => { row.document_link = ''; changed(); }}>
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
										</button>
									{:else if !row.document_link}
										<button type="button" class="shrink-0 px-2.5 h-7 rounded-full bg-black text-white text-[11px] font-bold hover:bg-lime hover:text-black transition cursor-pointer" on:click={() => openUpload(row)}>Upload</button>
									{/if}
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<UploadModal
	isOpen={showUploadModal}
	{isUploading}
	title="Upload Immigration Document"
	acceptedTypes=".pdf,.jpg,.jpeg,.png,.zip"
	fileNameTemplate="Immigration_Document"
	on:upload={handleUploadEvent}
	on:close={() => (showUploadModal = false)}
/>

{#if showPreviewModal}
	<PreviewModal
		isOpen={showPreviewModal}
		fileName={previewTargetName}
		fileUrl={previewTargetUrl}
		showDeleteButton={false}
		on:close={() => (showPreviewModal = false)}
	/>
{/if}