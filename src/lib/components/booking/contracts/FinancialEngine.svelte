<script lang="ts">
	import { browser } from '$app/environment';
	import { updateEventContract, type EventAdvance } from '$lib/services/eventsService';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase.js';
	import { onDestroy } from 'svelte';

	export let advance: EventAdvance;
	export let tab: 'Invoice' | 'W8_9';

	let isUploading = false;
	let isDeleting = false;
	let isDragging = false;
	let showDeleteModal = false;

	let selectedInvoiceIndex = 0;

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
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);

		realtimeChannel = supabase
			.channel(`finance-${contractId}`)
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
					advance.invoice_url = newRecord.invoice_url;
					advance.w89_url = newRecord.w89_url;
					advance.w_type = newRecord.w_type;
					advance = { ...advance };
				}
			)
			.subscribe();
	}

	onDestroy(() => {
		if (realtimeChannel && browser) supabase.removeChannel(realtimeChannel);
	});

	// ── Reactive File & Logic States ─────────────────────────────────────────
	$: invoiceUrls = Array.isArray(advance?.invoice_url)
		? advance.invoice_url
		: advance?.invoice_url
			? [advance.invoice_url]
			: [];

	$: currentFileUrl =
		tab === 'Invoice' ? invoiceUrls[selectedInvoiceIndex] || null : advance?.w89_url;
	$: currentFileId = currentFileUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || null;

	$: fileNameDisplay =
		tab === 'Invoice'
			? `${advance.event_id}_Invoice_${advance.artist_name}${selectedInvoiceIndex > 0 ? `_${selectedInvoiceIndex + 1}` : ''}.pdf`
			: `${advance.event_id}_${advance.w_type || 'W8_9'}_${advance.artist_name}.pdf`;

	// Reset the index when switching tabs to show the first invoice
	$: if (tab) {
		selectedInvoiceIndex = 0;
	}

	function getDbColumn() {
		return tab === 'Invoice' ? 'invoice_url' : 'w89_url';
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
				if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
			}
		}
	}

	$: if (currentFileId || tab) {
		loadPdf();
		fitWidth();
	}

	// ── Uploader & OCR Detection ─────────────────────────────────────────────
	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (!advance.gdrive_folder_id) return alert('Please generate a folder first.');
		if (!advance.contract_id) return alert('No contract DB record found.');

		const selectedFiles = input.files;
		if (selectedFiles && selectedFiles.length > 0) {
			uploadFile(selectedFiles.item(0) as File);
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (!advance.gdrive_folder_id || !advance.contract_id) return;

		const droppedFiles = e.dataTransfer?.files;
		if (droppedFiles && droppedFiles.length > 0) {
			uploadFile(droppedFiles.item(0) as File);
		}
	}

	async function processOcrDetection(file: File): Promise<string> {
		const uName = file.name.toUpperCase();
		if (uName.includes('W8') || uName.includes('W-8')) return 'W8';
		if (uName.includes('W9') || uName.includes('W-9')) return 'W9';

		try {
			const pdfjsLib = await import('pdfjs-dist');
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
			const page = await pdf.getPage(1);
			const viewport = page.getViewport({ scale: 1.5 });
			const canvas = document.createElement('canvas');
			canvas.width = viewport.width;
			canvas.height = viewport.height;

			const ctx = canvas.getContext('2d');
			// FIX: Ensure ctx is not null to satisfy TypeScript
			if (!ctx) throw new Error('Failed to get 2D context from canvas');
			await page.render({ canvasContext: ctx, viewport } as any).promise;

			const base64Image = canvas.toDataURL('image/jpeg');
			const res = await fetch('/api/w89-ocr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ imageUrl: base64Image })
			});
			const data = await res.json();
			return data.type || 'W8'; // Fallback
		} catch (error) {
			console.error('OCR extraction failed', error);
			return 'W8'; // Fallback
		}
	}

	async function uploadFile(file: File) {
		isUploading = true;
		let detectedType = 'W8_9';

		if (tab === 'W8_9') {
			detectedType = await processOcrDetection(file);
		}

		const fileName =
			tab === 'Invoice'
				? `${advance.event_id}_Invoice_${advance.artist_name}${invoiceUrls.length > 0 ? `_${invoiceUrls.length + 1}` : ''}.pdf`
				: `${advance.event_id}_${detectedType}_${advance.artist_name}.pdf`;

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
					let updates: any = {};
					if (tab === 'Invoice') {
						const newUrls = [...invoiceUrls, data.fileUrl];
						updates = { invoice_url: newUrls };
					} else {
						updates = { w89_url: data.fileUrl, w_type: detectedType };
					}

					await updateEventContract(advance.contract_id!, updates);
					advance = { ...advance, ...updates };

					if (tab === 'Invoice') selectedInvoiceIndex = invoiceUrls.length; // Length is the index of the newly added item

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

			let updates: any = {};
			if (tab === 'Invoice') {
				let newUrls = [...invoiceUrls];
				newUrls.splice(selectedInvoiceIndex, 1);
				updates = { invoice_url: newUrls.length > 0 ? newUrls : null };
			} else {
				updates = { w89_url: null, w_type: null };
			}

			await updateEventContract(advance.contract_id, updates);
			advance = { ...advance, ...updates };

			if (tab === 'Invoice') {
				selectedInvoiceIndex = 0;
			}
			showDeleteModal = false;
		} catch (err) {
			alert('Failed to delete file.');
		} finally {
			isDeleting = false;
		}
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
			<h2 class="text-xl font-bold text-white mb-2">
				Delete {tab === 'Invoice' ? 'Invoice' : 'W8/W9'} PDF?
			</h2>
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
		{#if currentFileId}
			<div class="flex items-center px-2 py-1 shrink-0 overflow-hidden">
				<svg
					class="w-4 h-4 text-lime mr-2 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline
						points="14 2 14 8 20 8"
					></polyline></svg
				>
				<span class="text-sm font-bold text-white truncate max-w-[250px]">{fileNameDisplay}</span>
			</div>
		{:else}
			<div class="flex items-center px-2 py-1 shrink-0">
				<span class="text-sm font-bold text-gray3"
					>{tab === 'Invoice' ? 'Upload Invoice' : 'Upload W8 or W9'}</span
				>
			</div>
		{/if}

		{#if currentFileId && !isLoadingPdf}
			<div
				class="flex items-center bg-gray1/40 p-1 rounded-lg border border-gray1/60 shrink-0 ml-4"
			>
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
			{#if tab === 'Invoice'}
				<div class="relative group mr-2">
					{#if invoiceUrls.length <= 1}
						<button
							class="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-gray1/20 hover:bg-gray1/40 border border-gray1/60 transition-colors cursor-pointer"
							on:click={() => (selectedInvoiceIndex = invoiceUrls.length)}
						>
							<span class="text-[11px] font-bold text-white">+ Add Invoice</span>
						</button>
						{:else}
						<button class="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-gray1/20 hover:bg-gray1/40 border border-gray1/60 transition-colors cursor-pointer">
							<span class="text-[11px] font-bold text-white">
								{selectedInvoiceIndex < invoiceUrls.length ? `Invoice ${selectedInvoiceIndex + 1}` : 'Add Invoice'}
							</span>
							<svg class="w-3.5 h-3.5 text-gray2 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6" /></svg>
						</button>
						
						<div class="absolute right-0 top-full pt-2 w-32 hidden group-hover:block z-[60]">
							<div class="bg-navbar border border-gray1/40 rounded-2xl shadow-xl overflow-hidden py-1.5">
								{#each invoiceUrls as _, i}
									<button
										class="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors"
										on:click={() => selectedInvoiceIndex = i}
									>
										<span class="text-[11px] font-bold {selectedInvoiceIndex === i ? 'text-lime' : 'text-white'}">Invoice {i + 1}</span>
									</button>
								{/each}
								<div class="w-full h-[1px] bg-gray1/40 my-1"></div>
								<button
									class="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-white/5 cursor-pointer transition-colors"
									on:click={() => selectedInvoiceIndex = invoiceUrls.length}
								>
									<span class="text-[11px] font-bold text-gray3 hover:text-white">+ Add Invoice</span>
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if advance?.gdrive_folder_url}
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
						<p class="text-problem font-bold animate-pulse text-sm">
							{tab === 'W8_9' ? 'Analyzing & Uploading to Drive…' : 'Uploading to Drive…'}
						</p>
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
							<p class="text-lg font-bold text-white mb-1">
								Drag &amp; Drop {tab === 'Invoice' ? 'Invoice' : 'W8 or W9'} PDF
							</p>
							<p class="text-xs italic text-gray3">
								{tab === 'Invoice'
									? `Auto-renames to ${advance.event_id}_Invoice_${advance.artist_name}${invoiceUrls.length > 0 ? `_${invoiceUrls.length + 1}` : ''}.pdf`
									: `Auto-renames based on form type (W8 or W9).`}
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
