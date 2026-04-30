<script lang="ts">
	import { browser } from '$app/environment';
	import { updateEventContract, type EventAdvance } from '$lib/services/eventsService';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase.js';
	import { onDestroy } from 'svelte';
	export let advance: EventAdvance;

	type SubTab = 'Original' | 'Marked-up' | 'Signed';
	// ── Tab Priority Logic ───────────────────────────────────────────────────
	function getDefaultTab(adv: EventAdvance): SubTab {
		if (adv?.signed_contract_url) return 'Signed';
		if (adv?.redlined_contract_url) return 'Marked-up';
		return 'Original';
	}

	let currentTab: SubTab = advance ? getDefaultTab(advance) : 'Original';
	let previousAdvanceId = advance?.id;

	// Automatically update the default tab when a new event is selected
	$: if (advance && advance.id !== previousAdvanceId) {
		previousAdvanceId = advance.id;
		currentTab = getDefaultTab(advance);
	}
	// ─────────────────────────────────────────────────────────────────────────

	let isUploading = false;
	let isDeleting = false;
	let isDragging = false;
	let showDeleteModal = false;

	// ── PDF.js State ─────────────────────────────────────────────────────────
	let isLoadingPdf = false;
	let loadError = '';
	let pdfDoc: any = null;
	let numPages = 0;
	let canvases: HTMLCanvasElement[] = [];
	let pageAspectRatio = 1 / 1.414;

	let zoomLevel: number | 'fit' = 'fit';

	// ── Realtime DB Sync ─────────────────────────────────────────────────────
	let realtimeChannel: any;

	$: if (browser && advance?.contract_id) {
		setupRealtime(advance.contract_id);
	}

	function setupRealtime(contractId: number) {
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}

		realtimeChannel = supabase
			.channel(`contract-${contractId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'events_contract',
					filter: `contract_id=eq.${contractId}`
				},
				(payload) => {
					const newRecord = payload.new;
					advance.original_contract_url = newRecord.original_contract_url;
					advance.redlined_contract_url = newRecord.redlined_contract_url;
					advance.signed_contract_url = newRecord.signed_contract_url;
					advance.bypass = newRecord.bypass;

					advance = { ...advance };
				}
			)
			.subscribe();
	}

	onDestroy(() => {
		if (realtimeChannel && browser) supabase.removeChannel(realtimeChannel);
	});

	// ── Reactive File & Logic States ─────────────────────────────────────────
	$: currentFileUrl = getCurrentFileUrl(currentTab, advance);
	$: currentFileId = currentFileUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null;

	// Fallbacks if file gets deleted while viewing it
	$: {
		if (!advance?.bypass) {
			if (currentTab === 'Marked-up' && !advance?.original_contract_url) currentTab = 'Original';
			if (currentTab === 'Signed' && !advance?.redlined_contract_url) currentTab = 'Marked-up';
		}
	}

	function getCurrentFileUrl(tab: SubTab, adv: EventAdvance) {
		if (tab === 'Original') return adv.original_contract_url;
		if (tab === 'Marked-up') return adv.redlined_contract_url;
		if (tab === 'Signed') return adv.signed_contract_url;
		return null;
	}

	function getDbColumn(tab: SubTab) {
		if (tab === 'Original') return 'original_contract_url';
		if (tab === 'Marked-up') return 'redlined_contract_url';
		if (tab === 'Signed') return 'signed_contract_url';
		return '';
	}

	// ── Zoom Controls ────────────────────────────────────────────────────────
	function zoomIn() {
		if (zoomLevel === 'fit') zoomLevel = 100;
		zoomLevel = Math.min((zoomLevel as number) + 25, 300);
	}
	function zoomOut() {
		if (zoomLevel === 'fit') zoomLevel = 100;
		zoomLevel = Math.max((zoomLevel as number) - 25, 50);
	}
	function fitWidth() {
		zoomLevel = 'fit';
	}

	// ── Bypass Toggle ────────────────────────────────────────────────────────
	async function toggleBypass() {
		if (!advance.contract_id) return;
		const newStatus = !advance.bypass;
		try {
			await updateEventContract(advance.contract_id, { bypass: newStatus });
			advance = { ...advance, bypass: newStatus };
		} catch (err) {
			console.error('Failed to toggle bypass:', err);
		}
	}

	// ── PDF.js Rendering ─────────────────────────────────────────────────────
	async function loadPdf() {
		if (!browser || !currentFileId) return;
		isLoadingPdf = true;
		loadError = '';
		numPages = 0;
		pdfDoc = null;

		try {
			const pdfjsLib = await import('pdfjs-dist');
			const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
			pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
			const res = await fetch(`/api/gdrive?fileId=${currentFileId}`);
			if (!res.ok) throw new Error('Failed to fetch PDF bytes');
			const arrayBuffer = await res.arrayBuffer();
			pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
			numPages = pdfDoc.numPages;

			const page1 = await pdfDoc.getPage(1);
			const vp = page1.getViewport({ scale: 1 });
			pageAspectRatio = vp.width / vp.height;

			setTimeout(() => renderPages(), 0);
		} catch (err: any) {
			console.error('PDF Load Error:', err);
			loadError = 'Failed to render PDF.';
		} finally {
			isLoadingPdf = false;
		}
	}

	async function renderPages() {
		if (!pdfDoc) return;
		for (let i = 1; i <= numPages; i++) {
			const page = await pdfDoc.getPage(i);
			const viewport = page.getViewport({ scale: 2.5 });
			const canvas = canvases[i - 1];

			if (canvas) {
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					await page.render({ canvasContext: ctx, viewport }).promise;
				}
			}
		}
	}

	$: if (currentFileId) {
		loadPdf();
	}

	// ── Uploader ─────────────────────────────────────────────────────────────
	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!advance.gdrive_folder_id) return alert('Please generate a folder first.');
		if (!advance.contract_id) return alert('No contract DB record found.');
		if (currentTab === 'Marked-up')
			return alert('Marked-up files must be managed in the macOS app.');

		const selectedFiles = input.files;
		if (selectedFiles && selectedFiles.length > 0) {
			const file = selectedFiles.item(0) as File;
			if (file) uploadFile(file);
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (!advance.gdrive_folder_id || !advance.contract_id) return;
		if (currentTab === 'Marked-up') return; // Prevent drag & drop on Marked-up entirely

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			const file = droppedFiles.item(0) as File;
			if (file) uploadFile(file);
		}
	}

	async function uploadFile(file: File) {
		isUploading = true;
		const statusMap = { Original: 'Original', 'Marked-up': 'Marked-up', Signed: 'Signed' };
		const fileName = `${advance.event_id}_Contract_${advance.artist_name}_${statusMap[currentTab]}.pdf`;

		const reader = new FileReader();
		reader.onloadend = async () => {
			const base64Data = (reader.result as string).split(',')[1];
			try {
				const res = await fetch('/api/gdrive', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'upload',
						folderId: advance.gdrive_folder_id,
						fileName,
						fileData: base64Data,
						mimeType: file.type
					})
				});
				const data = await res.json();
				if (data.success && data.fileUrl) {
					const dbCol = getDbColumn(currentTab);
					await updateEventContract(advance.contract_id!, { [dbCol]: data.fileUrl });
					advance = { ...advance, [dbCol]: data.fileUrl };
					fitWidth();
				} else {
					alert('Upload failed.');
				}
			} catch (err) {
				console.error('Upload Error:', err);
			} finally {
				isUploading = false;
			}
		};
		reader.readAsDataURL(file);
	}

	// ── Delete ───────────────────────────────────────────────────────────────
	async function confirmDelete() {
		if (!currentFileId || !advance.contract_id) return;
		isDeleting = true;

		try {
			await fetch('/api/gdrive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'delete', fileId: currentFileId })
			});
			const dbCol = getDbColumn(currentTab);
			await updateEventContract(advance.contract_id, { [dbCol]: null });

			advance = { ...advance, [dbCol]: null };
			showDeleteModal = false;
		} catch (err) {
			alert('Failed to delete file.');
		} finally {
			isDeleting = false;
		}
	}

	// Inside <script lang="ts"> in ContractEngine.svelte
	function openAppWithFallback(advanceId: any) {
		const deepLink = `produktred://redline?documentId=${advanceId}`;
		const downloadUrl =
			'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/app-updates/Produkt-Red/ProduktRed_1.1.0.dmg';

		// 1. Try to open the app
		window.location.href = deepLink;

		// 2. Set a timeout to check if the user is still here
		setTimeout(() => {
			// If the document is still visible, the app likely isn't installed
			if (!document.hidden) {
				if (
					confirm("Produkt Red doesn't seem to be installed. Would you like to download it now?")
				) {
					window.location.href = downloadUrl;
				}
			}
		}, 2000);
	}
</script>

{#if showDeleteModal}
	<div
		use:portal
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
	>
		<div
			class="bg-navbar rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200"
		>
			<h2 class="text-xl font-bold text-white mb-2">Delete {currentTab} PDF?</h2>
			<p class="text-problem text-sm mb-6">
				This will permanently remove the file from Google Drive and the database.
			</p>
			<div class="flex gap-3 justify-end">
				<button
					class="px-5 py-2.5 rounded-full text-sm font-bold text-gray2 border border-gray2 hover:bg-gray1 transition-colors cursor-pointer"
					on:click={() => (showDeleteModal = false)}
					disabled={isDeleting}>Cancel</button
				>
				<button
					class="px-5 py-2.5 rounded-full text-sm font-bold bg-transparent border-2 border-problem text-problem hover:text-red-500 hover:border-red-500 transition-colors disabled:opacity-50 cursor-pointer"
					on:click={confirmDelete}
					disabled={isDeleting}>{isDeleting ? 'Deleting…' : 'Delete File'}</button
				>
			</div>
		</div>
	</div>
{/if}

<div class="flex flex-col h-full relative bg-navbar text-white overflow-hidden">
	<div
		class="absolute top-0 left-0 right-0 h-[50px] bg-navbar border-b border-gray1 px-3 flex items-center gap-4 shrink-0 z-20 select-none shadow-md"
	>
		<div class="flex items-center bg-gray1/40 p-1 rounded-3xl border border-gray1/60 shrink-0">
			{#each ['Original', 'Marked-up', 'Signed'] as tab}
				{@const isDisabled =
					!advance?.bypass &&
					((tab === 'Marked-up' && !advance?.original_contract_url) ||
						(tab === 'Signed' && !advance?.redlined_contract_url))}
				<button
					disabled={isDisabled}
					on:click={() => {
						currentTab = tab as SubTab;
						fitWidth();
					}}
					class="px-4 py-1 text-[11px] font-bold rounded-3xl transition-all
						{isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
						{currentTab === tab
						? 'bg-problem text-black shadow-sm'
						: isDisabled
							? 'text-gray3'
							: 'text-gray3 hover:text-white'}"
				>
					{tab}
				</button>
			{/each}

			{#if advance?.redlined_contract_url}
				<div class="w-[1px] h-4 bg-gray1/60 mx-1"></div>

				<a
					href={`produktred://redline?documentId=${advance.advance_id}`}
					class="px-3 py-1 text-[11px] font-bold rounded-3xl transition-all bg-problem text-black shadow-sm flex items-center gap-1 hover:bg-white hover:text-black"
				>
					<img
						src="/images/ProduktRed-1024x1024.png"
						alt="Produkt Red"
						class="w-3 h-3 rounded-sm object-cover"
					/>
					Open App
				</a>
			{/if}
		</div>

		{#if currentFileId && !isLoadingPdf}
			<div class="flex items-center bg-gray1/40 p-1 rounded-lg border border-gray1/60 shrink-0">
				<button
					on:click={zoomOut}
					class="w-6 h-6 flex items-center justify-center text-gray3 hover:text-white transition-colors cursor-pointer font-bold rounded hover:bg-gray1/60"
					>-</button
				>
				<button
					on:click={fitWidth}
					class="px-2 h-6 flex items-center justify-center text-[11px] text-gray3 hover:text-white transition-colors cursor-pointer font-bold min-w-[50px]"
				>
					{zoomLevel === 'fit' ? 'Fit' : `${zoomLevel}%`}
				</button>
				<button
					on:click={zoomIn}
					class="w-6 h-6 flex items-center justify-center text-gray3 hover:text-white transition-colors cursor-pointer font-bold rounded hover:bg-gray1/60"
					>+</button
				>
			</div>
		{/if}

		<div class="flex items-center gap-2 ml-auto">
			{#if advance?.gdrive_folder_url}
				<button
					on:click={toggleBypass}
					title={advance?.bypass ? 'Lock workflow' : 'Unlock workflow'}
					class="w-7 h-7 flex items-center justify-center rounded-2xl border border-gray1/60 text-gray3 hover:text-white hover:bg-gray1/40 transition-all {advance?.bypass
						? 'text-lime border-lime/50 bg-lime/10 hover:bg-lime/20'
						: ''}"
				>
					{#if advance?.bypass}
						<svg
							class="w-3.5 h-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path
								d="M7 11V7a5 5 0 0 1 9.9-1"
							></path></svg
						>
					{:else}
						<svg
							class="w-3.5 h-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path
								d="M7 11V7a5 5 0 0 1 10 0v4"
							></path></svg
						>
					{/if}
				</button>
				<a
					href={advance.gdrive_folder_url}
					target="_blank"
					title="Open Drive folder"
					class="w-7 h-7 flex items-center justify-center rounded-2xl border border-gray1/60 text-gray3 hover:text-white hover:bg-gray1/40 transition-all"
				>
					<svg
						class="w-3.5 h-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path
							d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
						/></svg
					>
				</a>
			{/if}
			{#if currentFileId}
				<button
					on:click={() => (showDeleteModal = true)}
					title="Delete file"
					class="w-7 h-7 rounded-2xl border border-gray1/60 text-problem/60 hover:text-problem hover:bg-problem/10 flex items-center justify-center cursor-pointer transition-all"
				>
					<svg
						class="w-3 h-3"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						><path
							d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
						/></svg
					>
				</button>
			{/if}
		</div>
	</div>

	<div class="flex-1 relative pt-[50px] bg-[#1e1e1e] overflow-hidden flex flex-col">
		{#if currentFileId}
			{#if isLoadingPdf}
				<div class="flex-1 flex flex-col items-center justify-center gap-4">
					<div
						class="w-8 h-8 border-4 border-gray2 border-t-problem rounded-full animate-spin"
					></div>
					<p class="text-problem font-bold animate-pulse text-sm">Rendering PDF…</p>
				</div>
			{:else if loadError}
				<div class="flex-1 flex flex-col items-center justify-center gap-2 text-problem">
					<p class="font-bold">{loadError}</p>
					<button on:click={loadPdf} class="text-xs underline hover:text-red-400">Retry</button>
				</div>
			{:else}
				<div
					class="w-full h-full overflow-auto custom-scrollbar text-center whitespace-nowrap p-4 lg:p-8"
				>
					<div
						class="inline-block text-left whitespace-normal align-top transition-all duration-200"
						style="width: {zoomLevel === 'fit'
							? '100%'
							: zoomLevel + '%'}; max-width: {zoomLevel === 'fit' ? '1000px' : 'none'};"
					>
						<div class="flex flex-col gap-6 w-full">
							{#each Array(numPages) as _, i}
								<div
									class="relative bg-white shadow-2xl w-full"
									style="aspect-ratio: {pageAspectRatio};"
								>
									<canvas bind:this={canvases[i]} class="w-full h-full block"></canvas>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		{:else if currentTab === 'Marked-up'}
			<div
				class="flex-1 w-full h-full p-8 flex flex-col items-center justify-center bg-transparent"
			>
				<div class="text-center space-y-6 max-w-sm">
					<div
						class="w-24 h-24 mx-auto mb-3 shadow-md rounded-2xl overflow-hidden border border-gray1/50 bg-black/20"
					>
						<img
							src="/images/ProduktRed-1024x1024.png"
							alt="Produkt Red App"
							class="w-full h-full object-cover"
						/>
					</div>
					<div>
						<h3 class="text-xl font-bold text-white mb-2">Open in Produkt Red</h3>
						<p class="text-sm text-gray3 leading-relaxed">
							Contract redlining and AI analysis are handled natively in Produkt macOS application.
						</p>
					</div>
					<div class="flex flex-col gap-3 pt-2">
						<button
							on:click={() => openAppWithFallback(advance.advance_id)}
							class="w-full px-6 py-3 bg-problem text-black text-sm font-bold rounded-full hover:bg-white hover:text-black transition-all shadow-md flex items-center justify-center gap-2"
						>
							Open App
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path
									d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
								/>
							</svg>
						</button>

						<div class="text-xs text-gray3 mt-4">
							Don't have the app?
							<a
								href="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/app-updates/Produkt-Red/ProduktRed_1.1.0.dmg"
								class="text-problem hover:text-white transition-colors ml-1 font-bold underline"
								download
							>
								Click here to install
							</a>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div
				role="region"
				aria-label="Document dropzone"
				on:dragover|preventDefault={() => (isDragging = true)}
				on:dragleave|preventDefault={() => (isDragging = false)}
				on:drop={handleDrop}
				class="flex-1 w-full h-full p-8 flex items-center justify-center {isDragging
					? 'bg-problem/10 border-2 border-dashed border-problem'
					: 'bg-transparent'}"
			>
				{#if isUploading}
					<div class="flex flex-col items-center gap-4">
						<div
							class="w-8 h-8 border-4 border-gray2 border-t-problem rounded-full animate-spin"
						></div>
						<p class="text-problem font-bold animate-pulse text-sm">Uploading to Drive…</p>
					</div>
				{:else}
					<div class="text-center text-gray2 space-y-4">
						<svg
							class="w-12 h-12 mx-auto opacity-50"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
								points="14 2 14 8 20 8"
							/></svg
						>
						<div>
							<p class="text-lg font-bold text-white mb-1">Drag &amp; Drop {currentTab} PDF</p>
							<p class="text-xs italic text-gray3">
								Auto-renames to {advance.event_id}_Contract_{advance.artist_name}_{currentTab}.pdf
							</p>
						</div>
						<div class="pt-4 relative">
							<input
								type="file"
								accept="application/pdf"
								class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								on:change={handleFileSelect}
							/>
							<button
								class="px-6 py-2 bg-gray1 text-white text-sm font-bold rounded-lg hover:bg-gray2 transition-colors pointer-events-none"
								>Browse Files</button
							>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar {
		scrollbar-width: auto !important;
		scrollbar-color: #3f3f46 #1e1e1e !important;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 14px !important;
		height: 14px !important;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #1e1e1e !important;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: #3f3f46 !important;
		border-radius: 8px !important;
		border: 3px solid #1e1e1e !important;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: #52525b !important;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:active {
		background-color: #71717a !important;
	}
</style>
