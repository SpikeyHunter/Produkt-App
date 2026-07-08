<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { ProductionData, LocalCrewItem, SSTourDate } from '$lib/types/tour';
	import Toggle from '../ui/Toggle.svelte';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
	import { supabase } from '$lib/supabase';

	export let data: ProductionData = {};
	export let tourDate: SSTourDate | undefined = undefined;
	export let localCrewTemplate: any = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// --- STAGEHANDS RATE (single source of truth) ---
	// The rate lives ONLY here, on production.stagehands_rate_total. The Show
	// Budget tab renders a linked row derived from this same field, so editing
	// in either tab updates the other. Clearing it here makes the linked line in
	// Show Budget disappear; deleting that line in Show Budget clears this field.
	// There is no separate copy stored in show_budget.other_expenses.
	function onRateInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value.replace(/[^0-9.]/g, '');
		const num = val ? parseFloat(val) : 0;
		data.stagehands_rate_total = num > 0 ? num : undefined;
		changed(); // reassigns `data` (production) so Show Budget reacts + autosaves
	}

	const fmtCurrency = (n: number | undefined) => {
		if (!n) return '';
		return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
	};

	// --- RESET / CLEAR CREW ---
	let crewResetStage: 0 | 1 | 2 = 0;
	let crewResetTimer: ReturnType<typeof setTimeout>;
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];

	function clickResetCrew() {
		clearTimeout(crewResetTimer);
		if (crewResetStage < 2) {
			crewResetStage++;
			crewResetTimer = setTimeout(() => (crewResetStage = 0), 4000);
			return;
		}
		crewResetStage = 0;
		data.local_crew = [];
		changed();
	}

	onDestroy(() => {
		clearTimeout(crewResetTimer);
	});

	// --- LOCAL CREW ---

	// Extracts template robustly handling double-stringified JSON
	function getParsedTemplate() {
		let rawData = null;
		if (Array.isArray(localCrewTemplate) && localCrewTemplate.length > 0) {
			if (localCrewTemplate[0].key === 'local_crew_template') rawData = localCrewTemplate[0].data;
			else if (localCrewTemplate[0].qty !== undefined) rawData = localCrewTemplate;
		} else if (localCrewTemplate && localCrewTemplate.key === 'local_crew_template') {
			rawData = localCrewTemplate.data;
		}

		while (typeof rawData === 'string') {
			try {
				rawData = JSON.parse(rawData);
			} catch (e) {
				break;
			}
		}
		return Array.isArray(rawData) && rawData.length > 0 ? rawData : null;
	}

	function loadTemplate() {
		const tpl = getParsedTemplate() || [
			{ qty: 2, role: 'Tech LD' },
			{ qty: 2, role: 'Video' },
			{ qty: 4, role: 'Stagehands' },
			{ qty: 1, role: 'Carpenter' },
			{ qty: 1, role: 'Forklift' }
		];

		data.local_crew = tpl.map((t: any) => ({ id: uid(), qty: t.qty, role: t.role }));
		changed();
	}

	// Auto-load once when network data populates, IF data is pristine (undefined)
	let hasAutoLoaded = false;
	$: if (
		!hasAutoLoaded &&
		localCrewTemplate &&
		(Array.isArray(localCrewTemplate)
			? localCrewTemplate.length > 0
			: Object.keys(localCrewTemplate).length > 0)
	) {
		if (data.local_crew === undefined) {
			loadTemplate();
		}
		hasAutoLoaded = true;
	}

	function addLocalCrew() {
		data.local_crew = [...(data.local_crew || []), { id: uid(), qty: 1, role: '' }];
		changed();
	}

	function removeLocalCrew(item: LocalCrewItem) {
		data.local_crew = (data.local_crew || []).filter((c) => c.id !== item.id);
		changed();
	}

	function adjustQty(item: LocalCrewItem, delta: number) {
		const n = item.qty + delta;
		if (n >= 1) item.qty = n;
		changed();
	}

	// --- AUTO FORMATTERS ---
	function formatTime(input: string): string | null {
		const cleaned = (input || '').replace(/\s/g, '').toUpperCase();
		const patterns = [/^(\d{1,2}):?(\d{2})?(AM|PM)?$/, /^(\d{1,2})(AM|PM)$/];
		for (const pattern of patterns) {
			const match = cleaned.match(pattern);
			if (match) {
				let hours = parseInt(match[1]);
				const minutes = match[2] && /^\d+$/.test(match[2]) ? parseInt(match[2]) : 0;
				let period = match[3] || (match[2] && !/^\d+$/.test(match[2]) ? match[2] : '') || '';
				if (!period.includes('AM') && !period.includes('PM')) {
					if (hours >= 8 && hours <= 11) period = 'AM';
					else if (hours === 12) period = 'PM';
					else period = 'PM';
				}
				if (hours === 0) hours = 12;
				if (hours > 12) {
					hours -= 12;
					period = 'PM';
				}
				return `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
			}
		}
		return null;
	}

	function handleTimeBlur(field: 'load_in_time' | 'load_out_time') {
		const formatted = formatTime(data[field] || '');
		if (formatted) data[field] = formatted;
		changed();
	}

	function formatFeetInches(val: string): string {
		if (!val) return '';
		const numbers = val.split(/[^0-9]+/).filter(Boolean);
		if (numbers.length === 1) return `${numbers[0]}'`;
		if (numbers.length >= 2) return `${numbers[0]}' ${numbers[1]}"`;
		return val;
	}

	function handleDimensionBlur(field: keyof ProductionData) {
		const val = data[field] as string;
		if (val) data[field] = formatFeetInches(val) as any;
		changed();
	}

	// --- CUSTOM DROPDOWN (Artist Specs) ---
	let activeDropdown: 'artist_specs' | null = null;
	let dropdownNodeSpecs: HTMLElement;

	function toggleDropdown() {
		activeDropdown = activeDropdown === 'artist_specs' ? null : 'artist_specs';
	}

	function selectSpecsStatus(val: 'to_send' | 'sent') {
		data.artist_specs_status = val;
		activeDropdown = null;
		changed();
	}

	function handleWindowClick(e: MouseEvent) {
		if (
			activeDropdown === 'artist_specs' &&
			dropdownNodeSpecs &&
			!dropdownNodeSpecs.contains(e.target as Node)
		) {
			activeDropdown = null;
		}
	}

	// --- FILE UPLOAD / MODALS ---
	let uploadTarget: 'venue_specs_link' | 'pixel_map_link' | null = null;
	let showUploadModal = false;
	let isUploading = false;
	let previewTargetUrl = '';
	let previewTargetName = '';
	let showPreviewModal = false;

	function openUpload(target: 'venue_specs_link' | 'pixel_map_link') {
		uploadTarget = target;
		showUploadModal = true;
	}
	// The exact base name this upload will be saved as (no extension) — shown
	// in the modal's preview so it never lies about the real stored filename.
	$: pendingUploadName = uploadTarget
		? `${formatFileDate(tourDate?.date)}_${slugifyVenue(tourDate?.venue)}_${
				uploadTarget === 'venue_specs_link' ? 'Venue-Specs' : 'Pixel-Map'
			}`
		: '';

	function openLink(url: string) {
		if (url) window.open(url, '_blank');
	}

	function openPreview(url: string, name: string) {
		previewTargetUrl = url;
		previewTargetName = name;
		showPreviewModal = true;
	}

	// ---- storage helpers (Venue Specs / Pixel Map) ----
	// Uploads go straight to Supabase Storage from the browser (no app-server
	// round trip), which avoids request-body size limits (413 errors) on
	// hosted server routes. Files are named "{DD-Mon}_{Venue-Name}_<Kind>.ext"
	// and stored at documents/sstour/venuespecs/ or documents/sstour/pixelmaps/.
	function formatFileDate(dateStr?: string): string {
		if (!dateStr) return 'Date';
		try {
			const dt = new Date(dateStr + 'T00:00:00');
			const day = String(dt.getDate()).padStart(2, '0');
			const month = dt.toLocaleDateString('en-US', { month: 'short' });
			return `${day}-${month}`; // e.g. "26-Feb"
		} catch {
			return 'Date';
		}
	}
	function slugifyVenue(venue?: string): string {
		return (
			(venue || 'Venue')
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-zA-Z0-9-]/g, '') || 'Venue'
		);
	}
	function buildStoragePath(dir: string, baseName: string, date: SSTourDate | undefined, ext: string): string {
		const dateLabel = formatFileDate(date?.date);
		const venueLabel = slugifyVenue(date?.venue);
		return `sstour/${dir}/${dateLabel}_${venueLabel}_${baseName}.${ext}`;
	}
	// Extracts the storage object path (bucket-relative) from a Supabase public URL.
	function storagePathFromUrl(url: string): string | null {
		const marker = '/object/public/documents/';
		const idx = url.indexOf(marker);
		if (idx === -1) return null;
		return decodeURIComponent(url.slice(idx + marker.length));
	}
	async function deleteStoredFile(url: string): Promise<boolean> {
		if (!isFile(url)) return true; // pasted (non-uploaded) links have nothing to delete
		const path = storagePathFromUrl(url);
		if (!path) return true;
		try {
			const { error } = await supabase.storage.from('documents').remove([path]);
			if (error) {
				console.error('Failed to delete stored file:', error.message);
				return false;
			}
			return true;
		} catch (err) {
			console.error('Failed to delete stored file:', err);
			return false;
		}
	}
	// The real filename this URL was stored as (the last path segment) — used
	// so downloads/previews show the actual file, not a generic hardcoded label.
	function fileNameFromUrl(url: string, fallback: string): string {
		const path = storagePathFromUrl(url);
		if (!path) return fallback;
		const parts = path.split('/');
		return decodeURIComponent(parts[parts.length - 1] || fallback);
	}

	async function handleUploadEvent(e: CustomEvent) {
		if (!uploadTarget) return;
		const target = uploadTarget;
		const { file, fileName } = e.detail;
		isUploading = true;

		try {
			const dir = target === 'venue_specs_link' ? 'venuespecs' : 'pixelmaps';
			const baseName = target === 'venue_specs_link' ? 'Venue-Specs' : 'Pixel-Map';
			const ext = (fileName.split('.').pop() || 'pdf').toLowerCase();
			const path = buildStoragePath(dir, baseName, tourDate, ext);

			const { error: uploadError } = await supabase.storage
				.from('documents')
				.upload(path, file, { upsert: true, cacheControl: '3600' });
			if (uploadError) throw uploadError;

			const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);

			// Re-uploading (venue/date since changed, new filename) should orphan
			// whatever file used to be stored here rather than leave it stranded.
			const prevLink = data[target];
			if (prevLink && prevLink !== pub.publicUrl) await deleteStoredFile(prevLink);

			data[target] = pub.publicUrl;
			changed();
			showUploadModal = false;
		} catch (err) {
			console.error('File upload failed', err);
			alert('Failed to upload file.');
		} finally {
			isUploading = false;
			uploadTarget = null;
		}
	}

	function isUrl(str: string) {
		return /^https?:\/\//.test(str || '');
	}

	function isFile(str: string) {
		return isUrl(str) && str.includes('supabase.co/storage/v1/object/public/documents/sstour/');
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
	<div class="space-y-6">
		<div class="bg-gray1/30 rounded-xl p-3 space-y-2">
			<span class="block text-[13px] font-bold uppercase tracking-wider text-lime"
				>Artist Specs</span
			>

			<div class="flex flex-wrap items-center gap-6">
				<div bind:this={dropdownNodeSpecs} class="relative">
					<button
						type="button"
						class="bg-black/20 rounded-full pl-4 pr-10 h-8 text-sm outline-none border border-transparent flex items-center justify-between cursor-pointer font-bold transition-colors {data.artist_specs_status ===
						'sent'
							? 'text-confirmed focus:border-confirmed/60'
							: 'text-problem focus:border-problem/60'}"
						on:click|stopPropagation={toggleDropdown}
					>
						<span>{data.artist_specs_status === 'sent' ? 'Sent' : 'To Send'}</span>
						<svg
							class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none {data.artist_specs_status ===
							'sent'
								? 'text-confirmed'
								: 'text-problem'}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					</button>

					{#if activeDropdown === 'artist_specs'}
						<div
							class="absolute top-full mt-1.5 left-0 w-32 bg-[#2A2A2A] rounded-xl shadow-lg overflow-hidden z-50 border border-gray1/60 py-1"
						>
							<button
								type="button"
								class="w-full text-left px-3 py-2 text-sm text-problem font-bold hover:bg-gray1/60 transition-colors"
								on:click={() => selectSpecsStatus('to_send')}>To Send</button
							>
							<button
								type="button"
								class="w-full text-left px-3 py-2 text-sm text-confirmed font-bold hover:bg-gray1/60 transition-colors"
								on:click={() => selectSpecsStatus('sent')}>Sent</button
							>
						</div>
					{/if}
				</div>

				{#if data.artist_specs_status === 'sent'}
					<Toggle
						label="Confirmed by venue"
						checked={data.artist_specs_confirmed}
						on:change={(e) => {
							data.artist_specs_confirmed = e.detail;
							changed();
						}}
					/>
				{/if}
			</div>

			<textarea
				class="w-full bg-black/20 rounded-2xl px-3 py-2 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none mt-2"
				placeholder="Artist specs notes"
				rows="1"
				bind:value={data.artist_specs_notes}
				on:input={changed}
			></textarea>
		</div>

		<div class="bg-gray1/30 rounded-xl p-3 space-y-4">
			<Toggle
				label="Power confirmed"
				checked={data.power_confirmed}
				on:change={(e) => {
					data.power_confirmed = e.detail;
					changed();
				}}
			/>
			<textarea
				class="w-full bg-black/20 rounded-2xl px-3 py-2 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none mt-2"
				placeholder="Specific Notes (amps, distro, location)"
				rows="2"
				bind:value={data.power_notes}
				on:input={changed}
			></textarea>
		</div>

		<div class="bg-gray1/30 rounded-xl p-3">
			<div class="flex items-center justify-between mb-1">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime"
					>Local Crew / Stagehands</span
				>
				<div class="flex items-center gap-2">
					{#if (data.local_crew || []).length > 0}
						<button
							type="button"
							class="cursor-pointer px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all {crewResetStage ===
							0
								? 'border-gray3/40 text-gray3 hover:border-problem hover:text-problem'
								: crewResetStage === 1
									? 'border-problem/60 text-problem'
									: 'border-problem bg-problem text-black'}"
							on:click={clickResetCrew}
						>
							{RESET_LABELS[crewResetStage]}
						</button>
					{:else}
						<button
							type="button"
							class="px-3 py-1 rounded-full bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
							on:click={loadTemplate}>Load template</button
						>
					{/if}
					<button
						type="button"
						class="cursor-pointer px-3 py-1 rounded-full bg-lime text-black text-xs font-bold hover:brightness-110 transition-all"
						on:click={addLocalCrew}>+ Add</button
					>
				</div>
			</div>

			<div class="space-y-3 mb-2">
				<div>
					<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1"
						>Fixed Rate USD$</span
					>
					<input
						type="text"
						class="w-32 bg-black/30 rounded-full px-4 h-9 text-sm text-lime font-mono placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
						placeholder="$0.00"
						value={fmtCurrency(data.stagehands_rate_total)}
						on:blur={onRateInput}
						on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					/>
				</div>

				<div class="flex flex-wrap items-end gap-x-4 gap-y-4">
					<div class="flex items-center gap-2">
						<div>
							<span
								class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1"
								>Load In</span
							>
							<input
								class="w-20 bg-black/20 rounded-full px-1 h-9 text-sm text-white placeholder-gray2/40 outline-none text-center border border-transparent focus:border-lime/60 transition-colors"
								placeholder="12:00PM"
								bind:value={data.load_in_time}
								on:blur={() => handleTimeBlur('load_in_time')}
							/>
						</div>
						<div
							class="transition-opacity pt-6 {data.load_in_time
								? 'opacity-100'
								: 'opacity-0 pointer-events-none'} flex items-center"
						>
							<Toggle
								label="Confirm"
								checked={data.load_in_confirmed}
								on:change={(e) => {
									data.load_in_confirmed = e.detail;
									changed();
								}}
							/>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<div>
							<span
								class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1"
								>Load Out</span
							>
							<input
								class="w-20 bg-black/20 rounded-full px-1 h-9 text-sm text-white placeholder-gray2/40 outline-none text-center border border-transparent focus:border-lime/60 transition-colors"
								placeholder="11:30PM"
								bind:value={data.load_out_time}
								on:blur={() => handleTimeBlur('load_out_time')}
							/>
						</div>
						<div
							class="transition-opacity pt-6 {data.load_out_time
								? 'opacity-100'
								: 'opacity-0 pointer-events-none'} flex items-center"
						>
							<Toggle
								label="Confirm"
								checked={data.load_out_confirmed}
								on:change={(e) => {
									data.load_out_confirmed = e.detail;
									changed();
								}}
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="space-y-1.5 pt-4 border-t border-gray1/60">
				{#each data.local_crew || [] as item (item.id)}
					<div class="flex items-center gap-2">
						<div class="flex items-center bg-black/40 rounded-full h-8 px-1">
							<button
								type="button"
								class="px-2 hover:text-white text-gray2 font-bold cursor-pointer"
								on:click={() => adjustQty(item, -1)}>−</button
							>
							<span class="text-xs text-white font-mono w-4 text-center">{item.qty}</span>
							<button
								type="button"
								class="px-2 hover:text-white text-gray2 font-bold cursor-pointer"
								on:click={() => adjustQty(item, 1)}>+</button
							>
						</div>
						<input
							class="flex-1 bg-black/20 rounded-full px-3 h-8 text-sm text-white placeholder-gray2/50 outline-none border border-transparent focus:border-lime/60 transition-colors"
							bind:value={item.role}
							placeholder="Role"
							on:input={changed}
						/>
						<button
							type="button"
							class="text-gray2 hover:text-problem p-1.5 cursor-pointer shrink-0"
							aria-label="Remove"
							on:click={() => removeLocalCrew(item)}
						>
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
							>
						</button>
					</div>
				{:else}
					<p
						class="text-xs text-problem/80 font-bold bg-problem/10 rounded-xl px-3 py-2 text-center"
					>
						Nothing confirmed, please add crew.
					</p>
				{/each}
			</div>
		</div>
	</div>

	<div class="space-y-6">
		<div class="bg-gray1/30 rounded-xl p-3 space-y-6">
			<span class="block text-[13px] font-bold uppercase tracking-wider text-lime">Venue Specs</span
			>

			<div>
				<span class="block text-[11px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1"
					>Specs File / Link</span
				>
				<div
					class="relative group border border-dashed {data.venue_specs_link
						? 'border-lime/40 bg-lime/5'
						: 'border-gray2/40 hover:border-lime/60'} rounded-2xl p-2 flex items-center gap-2 transition-colors"
				>
					{#if isFile(data.venue_specs_link || '')}
						<div class="flex-1 px-2 text-sm text-lime truncate select-none">Venue Specs File</div>
						<button
							type="button"
							class="shrink-0 px-3 py-1.5 rounded-xl bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
							on:click={() => openPreview(data.venue_specs_link || '', fileNameFromUrl(data.venue_specs_link || '', 'Venue Specs'))}
						>
							Preview PDF
						</button>
						<button
							type="button"
							class="shrink-0 p-1.5 text-gray2 hover:text-problem transition-colors cursor-pointer"
							on:click={async () => {
								const link = data.venue_specs_link;
								if (link) {
									const ok = await deleteStoredFile(link);
									if (!ok) {
										alert('Failed to delete the file from storage. The link was not removed — please try again.');
										return;
									}
								}
								data.venue_specs_link = '';
								changed();
							}}
							title="Remove File"
						>
							<svg
								class="w-5 h-5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
							>
						</button>
					{:else}
						<input
							class="flex-1 bg-transparent px-2 h-8 text-sm text-white placeholder-gray2/50 outline-none {isUrl(
								data.venue_specs_link || ''
							)
								? 'text-lime'
								: ''}"
							placeholder="Paste a link or drop a file here"
							bind:value={data.venue_specs_link}
							on:input={changed}
						/>

						{#if data.venue_specs_link && isUrl(data.venue_specs_link)}
							<button
								type="button"
								class="shrink-0 px-3 py-1.5 rounded-xl bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex items-center gap-1"
								on:click={() => openLink(data.venue_specs_link || '')}
							>
								Open Link <svg
									class="w-3 h-3"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><path
										d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
									/></svg
								>
							</button>
							<button
								type="button"
								class="shrink-0 p-1.5 text-gray2 hover:text-problem transition-colors cursor-pointer"
								on:click={async () => {
									const link = data.venue_specs_link;
									if (link) {
										const ok = await deleteStoredFile(link);
										if (!ok) {
											alert('Failed to delete the file from storage. The link was not removed — please try again.');
											return;
										}
									}
									data.venue_specs_link = '';
									changed();
								}}
								title="Clear Link"
							>
								<svg
									class="w-5 h-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
								>
							</button>
						{:else if !data.venue_specs_link}
							<button
								type="button"
								class="shrink-0 px-3 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-lime hover:text-black transition-all cursor-pointer"
								on:click={() => openUpload('venue_specs_link')}
							>
								Upload File
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-3 gap-3">
				<div>
					<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1"
						>Stage Height</span
					>
					<input
						class="w-full bg-black/20 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors text-center"
						bind:value={data.stage_height}
						placeholder="e.g. 4' 6&quot;"
						on:blur={() => handleDimensionBlur('stage_height')}
					/>
				</div>
				<div>
					<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1"
						>Stage Width</span
					>
					<input
						class="w-full bg-black/20 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors text-center"
						bind:value={data.stage_width}
						placeholder="e.g. 40'"
						on:blur={() => handleDimensionBlur('stage_width')}
					/>
				</div>
				<div>
					<span class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1"
						>Stage Depth</span
					>
					<input
						class="w-full bg-black/20 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors text-center"
						bind:value={data.stage_depth}
						placeholder="e.g. 24'"
						on:blur={() => handleDimensionBlur('stage_depth')}
					/>
				</div>
			</div>

			<div class="pt-2 border-t border-gray1/60 space-y-4">
				<div class="flex items-center justify-between gap-x-4">
					<Toggle
					label="LED Wall"
					checked={data.led_wall}
					on:change={(e) => {
						data.led_wall = e.detail;
						changed();
					}}
				/>
					<Toggle label="Elevator" checked={data.elevator} on:change={(e) => { data.elevator = e.detail; changed(); }} />
					<Toggle label="Forklift" checked={data.forklift} on:change={(e) => { data.forklift = e.detail; changed(); }} />
					<Toggle label="Rig" checked={data.rigging} on:change={(e) => { data.rigging = e.detail; changed(); }} />
				

				
				</div>
				{#if data.led_wall}
					<div class="grid grid-cols-2 gap-3 mt-4">
						<div>
							<span
								class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1"
								>LED Width</span
							>
							<input
								class="w-full bg-black/20 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors text-center"
								bind:value={data.led_width}
								placeholder="e.g. 30'"
								on:blur={() => handleDimensionBlur('led_width')}
							/>
						</div>
						<div>
							<span
								class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1 pl-1"
								>LED Height</span
							>
							<input
								class="w-full bg-black/20 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors text-center"
								bind:value={data.led_height}
								placeholder="e.g. 15'"
								on:blur={() => handleDimensionBlur('led_height')}
							/>
						</div>
					</div>

					<div>
						<span
							class="block text-[10px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1"
							>Pixel Map</span
						>
						<div
							class="relative group border border-dashed {data.pixel_map_link
								? 'border-lime/40 bg-lime/5'
								: 'border-gray2/40 hover:border-lime/60'} rounded-2xl p-2 flex items-center gap-2 transition-colors"
						>
							{#if isFile(data.pixel_map_link || '')}
								<div class="flex-1 px-2 text-sm text-lime truncate select-none">Pixel Map File</div>
								<button
									type="button"
									class="shrink-0 px-3 py-1.5 rounded-xl bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
									on:click={() => openPreview(data.pixel_map_link || '', fileNameFromUrl(data.pixel_map_link || '', 'Pixel Map'))}
								>
									Preview PDF
								</button>
								<button
									type="button"
									class="shrink-0 p-1.5 text-gray2 hover:text-problem transition-colors cursor-pointer"
									on:click={async () => {
										const link = data.pixel_map_link;
										if (link) {
											const ok = await deleteStoredFile(link);
											if (!ok) {
												alert('Failed to delete the file from storage. The link was not removed — please try again.');
												return;
											}
										}
										data.pixel_map_link = '';
										changed();
									}}
									title="Remove File"
								>
									<svg
										class="w-5 h-5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
									>
								</button>
							{:else}
								<input
									class="flex-1 bg-transparent px-2 h-8 text-sm text-white placeholder-gray2/50 outline-none {isUrl(
										data.pixel_map_link || ''
									)
										? 'text-lime'
										: ''}"
									placeholder="Paste a link or drop a file here"
									bind:value={data.pixel_map_link}
									on:input={changed}
								/>

								{#if data.pixel_map_link && isUrl(data.pixel_map_link)}
									<button
										type="button"
										class="shrink-0 px-3 py-1.5 rounded-xl bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer flex items-center gap-1"
										on:click={() => openLink(data.pixel_map_link || '')}
									>
										Open Link <svg
											class="w-3 h-3"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><path
												d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
											/></svg
										>
									</button>
									<button
										type="button"
										class="shrink-0 p-1.5 text-gray2 hover:text-problem transition-colors cursor-pointer"
										on:click={async () => {
											const link = data.pixel_map_link;
											if (link) {
												const ok = await deleteStoredFile(link);
												if (!ok) {
													alert('Failed to delete the file from storage. The link was not removed — please try again.');
													return;
												}
											}
											data.pixel_map_link = '';
											changed();
										}}
										title="Clear Link"
									>
										<svg
											class="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
										>
									</button>
								{:else if !data.pixel_map_link}
									<button
										type="button"
										class="shrink-0 px-3 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-lime hover:text-black transition-all cursor-pointer"
										on:click={() => openUpload('pixel_map_link')}
									>
										Upload File
									</button>
								{/if}
							{/if}
						</div>
					</div>

					<textarea
						class="w-full bg-black/20 rounded-2xl px-3 py-2 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none"
						placeholder="Specific notes"
						rows="1"
						bind:value={data.venue_specs_notes}
						on:input={changed}
					></textarea>
				{/if}
			</div>
		</div>
	</div>
</div>

<UploadModal
	isOpen={showUploadModal}
	{isUploading}
	title="Upload File"
	acceptedTypes=".pdf,.jpg,.jpeg,.png,.zip"
	fileNameTemplate={pendingUploadName}
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