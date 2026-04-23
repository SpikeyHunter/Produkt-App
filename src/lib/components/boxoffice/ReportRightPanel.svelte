<script lang="ts">
	import { createEventDispatcher, mount, unmount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { COMPLETED_BY_NAMES, BOX_OFFICE_CATEGORIES } from '$lib/components/boxoffice/defaults';
	import { supabase } from '$lib/supabase';
	import ReportPDFTemplate from './ReportPDFTemplate.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { portal } from '$lib/utils/portalUtils';

	export let reportData: any;
	export let selectedEvent: any;
	export let isBookingUser = false;

	const dispatch = createEventDispatcher();
	let showDropdown = false;

	// Modal & PDF State
	let isDownloadModalOpen = false;
	let isDownloading = false;
	let hiddenPdfContainer: HTMLElement;

	// --- NEW: Row Limit State ---
	$: rowLimit = reportData?.row_limit || 30;

	$: summary = calculateTotals(reportData);

	function calculateTotals(data: any) {
		let sold = 0;
		let scanned = 0;
		let gross = 0;
		let onlineSold = 0;
		let onlineScanned = 0;
		let otherItems: { name: string; settle: number }[] = [];

		BOX_OFFICE_CATEGORIES.forEach((cat) => {
			if (cat === 'other') {
				if (data && data[cat]) {
					data[cat].forEach((item: any) => {
						if (item.ticket || (item.sold && item.sold > 0)) {
							const itemSold = item.sold || 0;
							const settle = (item.price || 0) * itemSold;
							otherItems.push({ name: item.ticket || 'Unnamed Item', settle });
						}
					});
				}
				return;
			}

			let catSold = 0;
			let catScanned = 0;

			if (data && data[cat]) {
				data[cat].forEach((item: any) => {
					const itemSold = item.sold || 0;
					let itemScanned = item.scanned || 0;

					if (cat === 'table_tickets' && !(item.ticket || '').toLowerCase().includes('prepaid')) {
						itemScanned = itemSold;
					}

					catSold += itemSold;
					catScanned += itemScanned;
					gross += (item.price || 0) * itemSold;
				});
			}

			if (cat === 'door') catScanned = catSold;

			sold += catSold;
			scanned += catScanned;

			if (cat === 'online') {
				onlineSold = catSold;
				onlineScanned = catScanned;
			}
		});

		let net = gross / 1.14975;
		let onlineEntryPct = onlineSold > 0 ? (onlineScanned / onlineSold) * 100 : 0;
		let noShowPct = onlineSold > 0 ? Math.max(0, 100 - onlineEntryPct) : 0;

		return { sold, scanned, gross, net, noShowPct, otherItems };
	}

	function formatCurrency(val: number) {
		return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
	}

	function handleNameSelect(name: string) {
		let currentSelected = Array.isArray(reportData?.completed_by)
			? [...reportData.completed_by]
			: [];
		if (currentSelected.includes(name)) {
			currentSelected = currentSelected.filter((n) => n !== name);
		} else {
			currentSelected.push(name);
		}
		dispatch('update', { completed_by: currentSelected });
	}

	function handleClickOutside(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('.completed-by-dropdown')) {
			showDropdown = false;
		}
	}

	// --- NEW: Row Limit Logic ---
	function handleRowLimitChange(delta: number) {
		const newVal = rowLimit + delta;
		if (newVal >= 10 && newVal <= 30) {
			dispatch('update', { row_limit: newVal });
		}
	}

	// --- PDF GENERATION LOGIC ---
	async function executeDownload(theme: 'bw' | 'color') {
		if (!selectedEvent || !reportData.completed_by?.length) return;
		isDownloading = true;

		try {
			// 1. Render Svelte component to hidden DOM element (PASSING rowLimit)
			const comp = mount(ReportPDFTemplate, {
				target: hiddenPdfContainer,
				props: { reportData, selectedEvent, theme, rowLimit }
			});

			await new Promise((resolve) => setTimeout(resolve, 150));
			const htmlContent = hiddenPdfContainer.innerHTML;

			// 2. Clean up
			unmount(comp);
			hiddenPdfContainer.innerHTML = '';

			// 3. Increment Version & Delete Old PDF
            let currentVersion = 1;

            if (reportData?.pdf_url) {
                try {
                    // Extract version number like _v1.pdf
                    const match = reportData.pdf_url.match(/_v(\d+)\.pdf$/);
                    if (match) {
                        currentVersion = parseInt(match[1], 10) + 1;
                    } else {
                        currentVersion = 2; // If an old file exists without v tag, next is v2
                    }

                    // Extract exact Supabase Storage path to delete it
                    const urlObj = new URL(reportData.pdf_url);
                    const pathParts = urlObj.pathname.split('/public/documents/');
                    if (pathParts.length === 2) {
                        const oldFilePath = decodeURIComponent(pathParts[1]);
                        const { error: deleteErr } = await supabase.storage.from('documents').remove([oldFilePath]);
                        if (deleteErr) console.warn("Supabase Delete Error:", deleteErr);
                    }
                } catch (err) {
                    console.warn("Could not parse or delete old PDF:", err);
                }
            }

			// 4. Setup Dynamic Naming with standard V1, V2 format
			const dateStr = selectedEvent.event_date || 'TBD';
			const cleanName = (selectedEvent.event_name || 'Event').replace(/[^a-zA-Z0-9-]/g, '-');
			const fileName = `${dateStr}_Scan-Report_${cleanName}_v${currentVersion}.pdf`;
			const filePath = `scan_reports/${fileName}`;

			// 5. Fetch the PDF from our backend API
			const response = await fetch('/api/download-report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ htmlContent, theme })
			});

			if (!response.ok) throw new Error('PDF backend generation failed');
			const pdfBlob = await response.blob();

			// 6. Upload to Supabase Storage
			const { error: uploadError } = await supabase.storage
				.from('documents')
				.upload(filePath, pdfBlob, {
					contentType: 'application/pdf',
					upsert: true
				});

			if (uploadError) throw uploadError;

			// 7. Get Public URL & Save to Database
			const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
			dispatch('update', { pdf_url: urlData.publicUrl });

			// Close modal and let them use the buttons
			isDownloadModalOpen = false;

		} catch (error) {
			console.error('Failed to generate PDF:', error);
			alert('Failed to generate PDF. Check console for details.');
		} finally {
			isDownloading = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div bind:this={hiddenPdfContainer} class="hidden"></div>

<div class="h-full bg-navbar flex flex-col overflow-y-auto custom-scrollbar">
	<div class="p-4 border-b border-gray1/50 flex flex-col gap-3">
		<h3 class="text-xs font-bold text-gray3 uppercase tracking-wider">Actions</h3>

		<button
			class="w-full py-2 rounded-3xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer {reportData
				? 'border-lime border-2 text-lime hover:bg-lime hover:text-black'
				: 'bg-gray1 text-gray3 opacity-50 cursor-not-allowed'}"
			disabled={!reportData}
			on:click={() => dispatch('openTixrImport')}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
				></path></svg
			>
			Import from TIXR
		</button>

		{#if !reportData?.completed_by?.length}
			<div class="text-[10px] text-problem font-bold text-center italic mt-1">
				Select team members to enable export
			</div>
		{/if}

		<button
			class="w-full py-2.5 rounded-3xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer {!reportData
				?.completed_by?.length ||
				isDownloading
				? 'bg-gray1 text-gray3 cursor-not-allowed'
				: 'bg-gray1 text-gray3 border-gray1 border-2 hover:border-gray3 hover:text-white'}"
			disabled={!reportData?.completed_by?.length || isDownloading}
			on:click={() => (isDownloadModalOpen = true)}
		>
			{#if isDownloading}
				<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
				Generating...
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					></path></svg
				>
				Generate Report
			{/if}
		</button>

		<div class="mt-2 mb-1 flex justify-between items-center px-1">
            <span class="text-[10px] text-gray2 uppercase font-bold tracking-wider">Row Limit per Page:</span>
            <div class="flex items-center gap-2">
                <button
                    aria-label="Decrease row limit"
                    class="w-6 h-6 rounded-full bg-gray1/50 flex items-center justify-center text-white hover:bg-gray1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    disabled={rowLimit <= 10}
                    on:click={() => handleRowLimitChange(-1)}
                >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                </button>
                <span class="text-white font-mono text-sm min-w-[20px] text-center">{rowLimit}</span>
                <button
                    aria-label="Increase row limit"
                    class="w-6 h-6 rounded-full bg-gray1/50 flex items-center justify-center text-white hover:bg-gray1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    disabled={rowLimit >= 30}
                    on:click={() => handleRowLimitChange(1)}
                >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </button>
            </div>
        </div>

		{#if reportData?.pdf_url}
			<div class="grid grid-cols-2 gap-3 mt-1">
				<button
					class="py-2.5 text-[10px] uppercase font-bold text-lime border-2 border-lime/20 bg-lime/5 hover:bg-lime/10 rounded-3xl transition-colors cursor-pointer"
					on:click={() => dispatch('viewPdf')}
				>
					View PDF
				</button>
				<a
					href={reportData.pdf_url}
					target="_blank"
					class="py-2.5 text-[10px] uppercase font-bold text-gray2 border-2 border-gray1 hover:border-gray2 hover:text-white rounded-3xl transition-colors cursor-pointer text-center block"
					download
				>
					Download
				</a>
			</div>
		{/if}
	</div>

	<div class="p-4 flex-1">
		<h3 class="text-xs font-bold text-gray3 mb-4 uppercase tracking-wider">Report Info</h3>

		<div class="block mb-4 relative completed-by-dropdown">
			<span class="text-[10px] text-gray2 uppercase font-bold block mb-1">Completed By</span>
			<button
				type="button"
				class="w-full bg-black/40 border border-transparent rounded-3xl px-3 py-2 text-sm flex justify-between items-center focus:outline-none focus:border-lime transition-colors {reportData?.status ===
				'approved'
					? 'opacity-50 cursor-not-allowed text-gray2'
					: 'cursor-pointer text-white'}"
				on:click={() => {
					if (reportData?.status !== 'approved') showDropdown = !showDropdown;
				}}
				disabled={reportData?.status === 'approved'}
			>
				<span
					class="{reportData?.completed_by?.length ? 'text-white' : 'text-gray2'} truncate pr-2"
				>
					{reportData?.completed_by?.length
						? reportData.completed_by.join(', ')
						: 'Select Team Members...'}
				</span>
				<svg
					class="w-4 h-4 transition-transform flex-shrink-0 {showDropdown ? 'rotate-180' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg
				>
			</button>

			{#if showDropdown && reportData?.status !== 'approved'}
				<div
					transition:fly={{ y: -5, duration: 150 }}
					class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-gray1 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col"
				>
					<div class="max-h-48 overflow-y-auto custom-scrollbar py-1">
						{#each COMPLETED_BY_NAMES as name}
							<button
								type="button"
								class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray1 transition-colors cursor-pointer {reportData?.completed_by?.includes(
									name
								)
									? 'text-lime font-bold bg-gray1/30'
									: ''}"
								on:click={() => handleNameSelect(name)}
							>
								<div class="flex items-center justify-between">
									<span>{name}</span>
									{#if reportData?.completed_by?.includes(name)}
										<svg
											class="w-4 h-4 text-lime"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M5 13l4 4L19 7"
											></path></svg
										>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		{#if reportData?.status === 'approved'}
			<div class="mt-4 p-3 rounded-lg bg-[#86EFAC]/10 border border-[#86EFAC]/30">
				<p class="text-[10px] text-[#86EFAC] uppercase font-bold mb-1">Approved By</p>
				<p class="text-sm text-white font-medium">{reportData.approved_by}</p>
				<p class="text-xs text-gray2 mt-1">{new Date(reportData.approved_at).toLocaleString()}</p>
			</div>
		{/if}
	</div>

	{#if isBookingUser}
		<div class="p-5 bg-black/10 border-t border-gray1/50 mt-auto">
			<h3 class="text-lg font-bold text-gray3 mb-4 uppercase tracking-wider text-center">
				Report Summary
			</h3>

			<div class="flex justify-between items-center mb-3 text-sm">
				<span class="text-gray2">Total Sold</span>
				<span class="text-white font-bold">{summary.sold}</span>
			</div>

			<div class="flex justify-between items-center mb-3 text-sm">
				<span class="text-gray2">Total Scanned</span>
				<span class="text-white font-bold">{summary.scanned}</span>
			</div>

			<div class="flex justify-between items-center mb-4 text-sm">
				<span class="text-gray2">No Show</span>
				<span class="text-problem font-bold">{summary.noShowPct.toFixed(2)}%</span>
			</div>

			<div class="pt-4 border-t border-gray1 flex flex-col gap-2">
				<div class="flex justify-between items-center">
					<span class="text-gray3 font-bold tracking-wide text-md">Total Gross</span>
					<span class="text-white font-bold text-lg">{formatCurrency(summary.gross)}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-lime font-black tracking-wide text-lg">Total Net</span>
					<span class="text-lime font-black text-xl">{formatCurrency(summary.net)}</span>
				</div>
			</div>

			{#if summary.otherItems && summary.otherItems.length > 0}
				<div class="pt-4 mt-4 border-t border-gray1/50 flex flex-col gap-2">
					<h4 class="text-sm text-lime uppercase tracking-wider font-bold mb-1">
						Additional Items
					</h4>
					{#each summary.otherItems as item}
						<div class="flex justify-between items-center text-sm">
							<span class="text-gray3 ml-2">{item.name}</span>
							<span class="text-white font-mono">{formatCurrency(item.settle)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="p-5 bg-black/20 border-t border-gray2/20 mt-auto text-center">
			<p class="text-xs text-gray2 italic">Summary details restricted.</p>
		</div>
	{/if}
</div>

<div use:portal>
	<Modal
		bind:isOpen={isDownloadModalOpen}
		on:close={() => !isDownloading && (isDownloadModalOpen = false)}
		title="Download PDF Report"
		maxWidth="max-w-md"
	>
		<div class="p-2 text-center flex flex-col items-center">
			<div class="mb-6 space-y-1">
				<p class="text-gray2 text-sm">Choose the styling format for your PDF download.</p>
				<p class="text-gray2 text-sm">The file will be exported in 8.5" x 11" format.</p>
			</div>

			{#if isDownloading}
				<div class="flex flex-col items-center justify-center py-6 gap-4">
					<div class="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
					<p class="text-white font-bold">Generating PDF...</p>
				</div>
			{:else}
				<div class="flex gap-4 justify-center w-full mt-2">
					<button
						on:click={() => executeDownload('bw')}
						class="flex flex-col items-center justify-center p-6 rounded-3xl bg-gray1 border-2 border-transparent hover:border-gray2 transition-all cursor-pointer w-full"
					>
						<div
							class="w-12 h-12 rounded-lg border border-gray2 mb-3 bg-[linear-gradient(135deg,#ffffff_50%,#000000_50%)]"
						></div>
						<span class="text-white font-bold text-sm">Black & White</span>
					</button>

					<button
						on:click={() => executeDownload('color')}
						class="flex flex-col items-center justify-center p-6 rounded-3xl bg-gray1 border-2 border-transparent hover:border-lime transition-all cursor-pointer w-full"
					>
						<div class="w-12 h-12 rounded-lg border-2 border-lime/50 mb-3 bg-gradient-to-br from-lime via-lime to-confirmed"></div>
						<span class="text-white font-bold text-sm">Full Color</span>
					</button>
				</div>

				<div class="mt-8 flex justify-center">
					<button
						on:click={() => (isDownloadModalOpen = false)}
						class="bg-gray1 text-white hover:bg-gray2 hover:text-black border border-gray2 text-sm font-bold px-5 py-2.5 rounded-3xl transition-colors shadow-md cursor-pointer flex items-center gap-2"
					>
						Cancel
					</button>
				</div>
			{/if}
		</div>
	</Modal>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray1, #333);
		border-radius: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-gray2, #666);
	}
</style>