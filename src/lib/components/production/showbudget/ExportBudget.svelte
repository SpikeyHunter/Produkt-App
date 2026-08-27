<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] ExportBudget ui-v4 loaded');
</script>

<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import type { Writable, Readable } from 'svelte/store';
	import BudgetIncomeSection from './BudgetIncomeSection.svelte';
	import BudgetTotals from './BudgetTotals.svelte';
	import PresetManager from './PresetManager.svelte';
	import BudgetPdfTemplate from './BudgetPdfTemplate.svelte';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import {
		itemsBudgetedTotal,
		itemsActualTotal,
		itemsHaveActuals,
		subsBudgetedTotal,
		subsActualTotal,
		subsHaveActuals
	} from '$lib/utils/budgetUtils';
	import type { ExportOptions } from '$lib/types/budget';
	import { env } from '$env/dynamic/public';
	import { portal } from '$lib/utils/portalUtils';

	export let selectedEvent: any = null;
	export let budgetStore: Writable<any>;
	export let isExporting = false;
	// REAL saving state from the sync engine (not a fake timer anymore)
	export let savingState: Readable<'idle' | 'saving' | 'saved' | 'error'>;

	const dispatch = createEventDispatcher();
	let isPresetModalOpen = false;
	let sheetContainer: HTMLDivElement;
	let showExportOptions = false;

	const budgetTypeOptions = ['Tour Prod', 'Internal Prod', 'Complete Prod'];
	const amountOptions: { value: ExportOptions['amounts']; label: string }[] = [
		{ value: 'both', label: 'Budgeted + Actual' },
		{ value: 'budgeted', label: 'Budgeted only' },
		{ value: 'actual', label: 'Actual only' }
	];

	// Export options (hidden rows/sections are always excluded automatically)
	let exportOptions: ExportOptions = {
		amounts: 'both',
		sections: { artist_fee: true, technical: true, hospitality: true, other_expenses: true },
		includeIncome: true
	};

	function handleSave(key: string) {
		if (!$budgetStore) return;
		dispatch('save', { key });
	}

	function handleBudgetTypeSelect(e: CustomEvent) {
		if (!$budgetStore) return;
		$budgetStore.budget_type = e.detail;
		handleSave('budget_type');
	}

	function handleIncomeUpdate() {
		if (!$budgetStore) return;
		$budgetStore = $budgetStore;
	}

	// Variables
	$: budgetType = $budgetStore?.budget_type || 'Tour Prod';

	$: incomeTotalBudget = Number($budgetStore?.income_total_budget) || 0;
	$: incomeArtist = Number($budgetStore?.income_artist) || 0;
	$: incomeTechnical = Number($budgetStore?.income_technical) || 0;
	$: incomeHospitality = Number($budgetStore?.income_hospitality) || 0;
	$: incomeOther = Number($budgetStore?.income_other) || 0;

	$: totalIncome = (() => {
		if (budgetType === 'Internal Prod') return incomeTotalBudget;
		if (budgetType === 'Tour Prod') return incomeTechnical + incomeHospitality + incomeOther;
		return incomeArtist + incomeTechnical + incomeHospitality + incomeOther;
	})();

	// Budgeted expenses (hidden rows/sections excluded by the utils)
	$: expenseArtist = itemsBudgetedTotal($budgetStore?.artist_fee);
	$: expenseTechnical = subsBudgetedTotal($budgetStore?.technical);
	$: expenseHospitality = subsBudgetedTotal($budgetStore?.hospitality);
	$: expenseOther = subsBudgetedTotal($budgetStore?.other_expenses);

	$: totalExpenses = (() => {
		const base = expenseTechnical + expenseHospitality + expenseOther;
		if (budgetType === 'Complete Prod') return base + expenseArtist;
		return base;
	})();

	// Actual expenses (actual falls back to budgeted per line)
	$: actualArtist = itemsActualTotal($budgetStore?.artist_fee);
	$: actualTechnical = subsActualTotal($budgetStore?.technical);
	$: actualHospitality = subsActualTotal($budgetStore?.hospitality);
	$: actualOther = subsActualTotal($budgetStore?.other_expenses);

	$: actualExpenses = (() => {
		const base = actualTechnical + actualHospitality + actualOther;
		if (budgetType === 'Complete Prod') return base + actualArtist;
		return base;
	})();

	$: hasActuals =
		itemsHaveActuals($budgetStore?.artist_fee) ||
		subsHaveActuals($budgetStore?.technical) ||
		subsHaveActuals($budgetStore?.hospitality) ||
		subsHaveActuals($budgetStore?.other_expenses);

	$: netTotal = totalIncome - totalExpenses;
	$: actualNet = totalIncome - actualExpenses;

	$: applyTaxes = $budgetStore?.apply_taxes === true;

	function toggleTaxes() {
		if (!$budgetStore) return;
		$budgetStore.apply_taxes = !$budgetStore.apply_taxes;
		handleSave('apply_taxes');
	}

	// ---- Print-version PDF (8.5 x 11 in, black on white) -------------------
	// Generated fully client-side (html2canvas + jsPDF) because the server
	// pipeline ignores @page and imposes its own page size. Rules:
	//  - true Letter pages: 8.5 x 11 in, 0.45in margins
	//  - real light theme: white background, black text, gray secondary — not
	//    an inverted/grayscaled dark theme
	//  - a section never gets cut: it either fits, is squeezed a little
	//    (down to 88%), or moves whole to the next page; a section taller
	//    than a full page is sliced (nothing is ever lost)
	//  - a heading directly above a section travels with it
	// Requires: npm i jspdf html2canvas (loaded lazily, only when used)
	let isPrinting = false;

	const PRINT_LIGHT_CSS = `
		#budget-print-root, #budget-print-root #budget-pdf-root { background: #ffffff !important; }
		#budget-print-root * {
			color: #000 !important;
			background-color: transparent !important;
			background-image: none !important;
			border-color: rgba(0, 0, 0, 0.35) !important;
			box-shadow: none !important;
			text-shadow: none !important;
		}
		#budget-print-root .pdf-section {
			background-color: #fff !important;
			border: 1px solid rgba(0, 0, 0, 0.4) !important;
		}
		#budget-print-root [class*='text-gray'] { color: #555 !important; }
	`;

	/** html2canvas ignores CSS filters, so the white-on-transparent lockup is
	 *  inverted at the pixel level to print black. CORS failures leave it as-is. */
	async function invertImages(root: HTMLElement) {
		const imgs = Array.from(root.querySelectorAll('img'));
		await Promise.all(
			imgs.map(
				(img) =>
					new Promise<void>((resolve) => {
						const src = img.src;
						const pic = new Image();
						pic.crossOrigin = 'anonymous';
						pic.onload = () => {
							try {
								const c = document.createElement('canvas');
								c.width = pic.naturalWidth;
								c.height = pic.naturalHeight;
								const ctx = c.getContext('2d')!;
								ctx.drawImage(pic, 0, 0);
								const d = ctx.getImageData(0, 0, c.width, c.height);
								for (let i = 0; i < d.data.length; i += 4) {
									d.data[i] = 255 - d.data[i];
									d.data[i + 1] = 255 - d.data[i + 1];
									d.data[i + 2] = 255 - d.data[i + 2];
								}
								ctx.putImageData(d, 0, 0);
								img.src = c.toDataURL('image/png');
							} catch (e) {
								console.log('[budget] print-pdf: logo invert skipped (CORS)', e);
							}
							resolve();
						};
						pic.onerror = () => resolve();
						pic.src = src;
					})
			)
		);
	}

	async function handlePrintPdf() {
		if (!$budgetStore || !selectedEvent || isPrinting) return;
		isPrinting = true;
		console.log('[budget] print-pdf: building 8.5x11 B&W client-side');
		await tick();

		const sheetElement = sheetContainer?.querySelector('#budget-pdf-root');
		if (!sheetElement) {
			console.error('[budget] print-pdf: template not found');
			isPrinting = false;
			return;
		}

		// Lazy-load the generators so the page never pays for them otherwise
		let jsPDFmod: any, html2canvas: any;
		try {
			[jsPDFmod, html2canvas] = await Promise.all([import('jspdf'), import('html2canvas')]);
		} catch (e) {
			console.error('[budget] print-pdf: missing dependencies — run: npm i jspdf html2canvas', e);
			alert('Print export needs two packages. Run: npm i jspdf html2canvas');
			isPrinting = false;
			return;
		}
		const JsPDF = jsPDFmod.jsPDF || jsPDFmod.default;
		const h2c = html2canvas.default || html2canvas;

		// Off-screen clone at the exact printable width, in the light theme
		document.getElementById('budget-print-root')?.remove();
		const root = document.createElement('div');
		root.id = 'budget-print-root';
		const style = document.createElement('style');
		style.textContent = PRINT_LIGHT_CSS;
		root.appendChild(style);
		root.appendChild(sheetElement.cloneNode(true));
		document.body.appendChild(root);

		const inner = root.querySelector('#budget-pdf-root') as HTMLElement;
		inner.style.minHeight = '0';

		// Colors are forced INLINE on every element — html2canvas honors inline
		// styles unconditionally, whereas stylesheet overrides proved flaky
		// (white-on-white text disappeared in the first attempt).
		root.querySelectorAll('*').forEach((node) => {
			const el = node as HTMLElement;
			const cls = typeof el.className === 'string' ? el.className : '';
			if (/text-gray/.test(cls)) el.style.setProperty('color', '#555555', 'important');
			else el.style.setProperty('color', '#000000', 'important');
			if (el !== inner) el.style.setProperty('background-color', 'transparent', 'important');
		});
		inner.style.setProperty('background-color', '#ffffff', 'important');

		// Capture at the template's NATURAL width (it hard-codes 8.5in = 816px)
		// and map proportionally onto the 7.6in printable area. Cropping to the
		// printable width was what cut off the right column.
		await invertImages(root);

		const W = Math.max(inner.getBoundingClientRect().width, 600);
		root.style.width = W + 'px';
		const PAGE_H = W * ((11 - 2 * 0.45) / 7.6); // page height in capture px
		const MIN_ZOOM = 0.88;

		try {
			// 1. Squeeze: a section slightly taller than a page shrinks to fit
			let squeezed = 0;
			root.querySelectorAll('.pdf-section').forEach((node) => {
				const el = node as HTMLElement;
				const h = el.offsetHeight;
				if (h > PAGE_H && h * MIN_ZOOM <= PAGE_H) {
					(el.style as any).zoom = String(Math.max(MIN_ZOOM, PAGE_H / h - 0.01));
					squeezed++;
				}
			});

			// 2. Page plan: greedy-pack sections; break BEFORE a section that
			// would cross a page edge. A heading right above it comes along.
			const rootRect = root.getBoundingClientRect();
			const atoms: { top: number; bottom: number }[] = [];
			root.querySelectorAll('.pdf-section').forEach((node) => {
				const el = node as HTMLElement;
				const r = el.getBoundingClientRect();
				let top = r.top - rootRect.top;
				const prev = el.previousElementSibling as HTMLElement | null;
				if (prev && !prev.classList.contains('pdf-section')) {
					const pr = prev.getBoundingClientRect();
					const prevTop = pr.top - rootRect.top;
					if (top - prevTop < 160) top = prevTop; // heading sticks to its section
				}
				atoms.push({ top, bottom: r.bottom - rootRect.top });
			});
			atoms.sort((a, b) => a.top - b.top);

			const totalH = root.scrollHeight;
			const cuts: number[] = [0];
			let pageStart = 0;
			for (const a of atoms) {
				if (a.bottom - pageStart > PAGE_H && a.top > pageStart + 1) {
					cuts.push(a.top);
					pageStart = a.top;
				}
			}
			cuts.push(totalH);
			console.log('[budget] print-pdf: sections squeezed:', squeezed, '| pages planned:', cuts.length - 1);

			// 3. Rasterize once at 2x, slice into Letter pages
			const SCALE = 2;
			const canvas = await h2c(root, {
				scale: SCALE,
				width: W,
				windowWidth: Math.ceil(W) + 40,
				backgroundColor: '#ffffff',
				useCORS: true
			});

			const pdf = new JsPDF({ unit: 'in', format: [8.5, 11] });
			const M = 0.45;
			let first = true;
			for (let i = 0; i < cuts.length - 1; i++) {
				// a single planned slice taller than a page (a huge section) is
				// chopped into page-height pieces so nothing is lost
				for (let y = cuts[i]; y < cuts[i + 1]; y += PAGE_H) {
					const sliceH = Math.min(PAGE_H, cuts[i + 1] - y);
					if (sliceH < 4) continue; // skip sub-pixel remainders
					const page = document.createElement('canvas');
					page.width = Math.floor(W * SCALE);
					page.height = Math.floor(sliceH * SCALE);
					const ctx = page.getContext('2d')!;
					ctx.fillStyle = '#ffffff';
					ctx.fillRect(0, 0, page.width, page.height);
					ctx.drawImage(canvas, 0, y * SCALE, page.width, page.height, 0, 0, page.width, page.height);
					if (!first) pdf.addPage([8.5, 11]);
					first = false;
					pdf.addImage(page.toDataURL('image/jpeg', 0.94), 'JPEG', M, M, 7.6, (sliceH / W) * 7.6);
				}
			}

			const artistName = selectedEvent.event_name || 'Event';
			const eventDate = selectedEvent.event_date || new Date().toISOString().split('T')[0];
			const cleanFileName = `${eventDate} - ${artistName} - Budget Print.pdf`.replace(/[^\w\s.-]/g, '');
			pdf.save(cleanFileName);
			console.log('[budget] print-pdf: saved', cleanFileName);
		} catch (error) {
			console.error('[budget] print-pdf: failed', error);
			alert('Failed to generate print PDF.');
		} finally {
			document.getElementById('budget-print-root')?.remove();
			isPrinting = false;
		}
	}

	// PDF Logic
	async function handleGeneratePdf() {
		if (!$budgetStore || !selectedEvent) return;
		isExporting = true;
		console.log('[budget] pdf: export started');

		// Let Svelte finish rendering the hidden template first — otherwise a
		// change made right before clicking (export options, a just-typed value)
		// wouldn't be in the HTML we capture.
		await tick();

		const sheetElement = sheetContainer?.querySelector('#budget-pdf-root');
		if (!sheetElement) {
			console.error('PDF Template not found');
			isExporting = false;
			return;
		}

		const htmlContent = sheetElement.outerHTML;
		const artistName = selectedEvent.event_name || 'Event';
		const eventDate = selectedEvent.event_date || new Date().toISOString().split('T')[0];
		const cleanFileName = `${eventDate} - ${artistName} - Budget.pdf`.replace(/[^\w\s.-]/g, '');
		// Unique name for the *server/storage* side so every export writes a new
		// object instead of hitting an already-uploaded (stale) one. The file the
		// browser saves still uses cleanFileName.
		const stamp = Date.now();
		const uniqueFileName = cleanFileName.replace(/\.pdf$/i, `-${stamp}.pdf`);

		try {
			const response = await fetch('/api/generate-advance-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					artistName,
					eventDate,
					fileName: uniqueFileName,
					cacheBust: stamp
				})
			});

			console.log('[budget] pdf: server responded', response.status);
			if (!response.ok) throw new Error('PDF Generation Failed');
			const result = await response.json();

			if (result.path) {
				// `t=` busts the storage CDN cache — without it the public URL can
				// serve a previously generated copy of the same path.
				const downloadUrl =
					`${env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${result.path}` +
					`?download=${encodeURIComponent(cleanFileName)}&t=${stamp}`;
				const link = document.createElement('a');
				link.href = downloadUrl;
				link.setAttribute('download', cleanFileName);
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
		} catch (error) {
			console.error('Error generating PDF:', error);
			alert('Failed to generate PDF.');
		} finally {
			isExporting = false;
		}
	}
</script>


<svelte:head>
	{#if true}
		<style>
			/* Off-screen layout root used to measure sections at the exact
			   printable width (8.5in - 2 x 0.45in margins) before PDF export */
			#budget-print-root {
				position: absolute;
				left: -12000px;
				top: 0;
				width: max-content;
				background: #ffffff;
			}
		</style>
	{/if}
</svelte:head>

<div class="hidden" aria-hidden="true" bind:this={sheetContainer}>
	{#if $budgetStore && selectedEvent}
		<BudgetPdfTemplate budgetData={$budgetStore} event={selectedEvent} options={exportOptions} />
	{/if}
</div>

<div class="h-full flex flex-col bg-navbar border border-white/[0.07] rounded-xl overflow-hidden export-details-container">
	{#if !selectedEvent}
		<div class="flex-1 flex flex-col items-center justify-center h-full text-center p-4">
			<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
				<polyline points="14 2 14 8 20 8"></polyline>
				<line x1="12" y1="18" x2="12" y2="12"></line>
				<line x1="9" y1="15" x2="15" y2="15"></line>
			</svg>
			<p class="text-gray2 text-xs">Select an event to view its summary</p>
		</div>
	{:else}
		{#if $budgetStore}
			<div class="p-3 border-b border-gray1 shrink-0">
				<div class="flex justify-between items-center mb-3">
					<h2 class="text-white text-lg font-bold truncate">Budget Info</h2>
					<span
						class="text-xs transition-all shrink-0 ml-2
						{$savingState === 'saved' ? 'text-confirmed' : ''}
						{$savingState === 'saving' ? 'text-gray2' : ''}
						{$savingState === 'error' ? 'text-problem font-bold' : ''}
						{$savingState === 'idle' ? 'text-transparent' : ''}"
					>
						{#if $savingState === 'saving'}Saving...{:else if $savingState === 'saved'}Saved!{:else if $savingState === 'error'}Save failed — retrying on next edit{:else}.{/if}
					</span>
				</div>

				<div class="mb-2">
					<DropdownButton
						value={$budgetStore.budget_type || 'Tour Prod'}
						options={budgetTypeOptions}
						on:select={handleBudgetTypeSelect}
						width="w-auto"
						buttonClass="bg-gray1 !text-white border border-gray2/20"
					/>
				</div>

				<button type="button" on:click={() => (isPresetModalOpen = true)} class="w-full px-3 py-1.5 bg-gray1 text-lime text-xs font-bold rounded hover:bg-gray2/20 cursor-pointer">
					Manage Presets
				</button>
			</div>

			<div class="flex-1 flex flex-col justify-between overflow-y-auto custom-scroll p-3">
				<div class="space-y-3">
					<div class="bg-gray1 rounded-lg p-3">
						<h3 class="text-white font-bold text-base mb-2 pb-2 border-b border-gray2/20">
							Budget / Income (+)
						</h3>

						<div class="grid grid-cols-1 gap-3">
							{#if budgetType === 'Internal Prod'}
								<BudgetIncomeSection
									label="Total Budget"
									bind:amount={$budgetStore.income_total_budget}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_total_budget')}
								/>
							{:else}
								{#if budgetType === 'Complete Prod'}
									<BudgetIncomeSection
										label="Artist Fee"
										bind:amount={$budgetStore.income_artist}
										on:update={handleIncomeUpdate}
										on:save={() => handleSave('income_artist')}
									/>
								{/if}

								<BudgetIncomeSection
									label="Technical"
									bind:amount={$budgetStore.income_technical}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_technical')}
								/>
								<BudgetIncomeSection
									label="Hospitality"
									bind:amount={$budgetStore.income_hospitality}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_hospitality')}
								/>
								<BudgetIncomeSection
									label="Other Expenses"
									bind:amount={$budgetStore.income_other}
									on:update={handleIncomeUpdate}
									on:save={() => handleSave('income_other')}
								/>
							{/if}
						</div>
					</div>

					<div class="bg-gray1 rounded-lg p-3">
						<BudgetTotals
							{totalIncome}
							{totalExpenses}
							{netTotal}
							{actualExpenses}
							{actualNet}
							{hasActuals}
							{incomeArtist}
							{expenseArtist}
							{incomeTechnical}
							{expenseTechnical}
							{incomeHospitality}
							{expenseHospitality}
							{incomeOther}
							{expenseOther}
							{budgetType}
							{incomeTotalBudget}
							{applyTaxes}
							onToggleTaxes={toggleTaxes}
						/>
					</div>
				</div>

				<div class="mt-3">
					<!-- Export options -->
					<button
						type="button"
						on:click={() => (showExportOptions = !showExportOptions)}
						class="w-full text-center text-xs text-gray2 hover:text-white mb-2 transition-colors flex items-center justify-center gap-1 cursor-pointer"
					>
						Export Options
						<svg class="w-3 h-3 transform transition-transform {showExportOptions ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showExportOptions}
						<div transition:slide|local={{ duration: 150 }} class="bg-gray1 rounded-lg p-3 mb-2 space-y-3 text-xs">
							<div>
								<p class="text-gray2 uppercase tracking-wider mb-1.5">Amounts</p>
								<div class="flex flex-col gap-1">
									{#each amountOptions as opt}
										<label class="flex items-center gap-2 text-white cursor-pointer">
											<input type="radio" bind:group={exportOptions.amounts} value={opt.value} class="accent-[#e1ff00]" />
											{opt.label}
										</label>
									{/each}
								</div>
							</div>
							<div>
								<p class="text-gray2 uppercase tracking-wider mb-1.5">Sections</p>
								<div class="flex flex-col gap-1">
									{#if budgetType === 'Complete Prod'}
										<label class="flex items-center gap-2 text-white cursor-pointer">
											<input type="checkbox" bind:checked={exportOptions.sections.artist_fee} class="accent-[#e1ff00]" />
											Artist Fee
										</label>
									{/if}
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.technical} class="accent-[#e1ff00]" />
										Technical
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.hospitality} class="accent-[#e1ff00]" />
										Hospitality
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.sections.other_expenses} class="accent-[#e1ff00]" />
										Other Expenses
									</label>
									<label class="flex items-center gap-2 text-white cursor-pointer">
										<input type="checkbox" bind:checked={exportOptions.includeIncome} class="accent-[#e1ff00]" />
										Income section
									</label>
								</div>
								<p class="text-gray2/70 mt-1.5">Hidden lines and hidden sections are always excluded.</p>
							</div>
						</div>
					{/if}

					<div class="flex gap-2">
					<button type="button" on:click={handleGeneratePdf} disabled={isExporting} class="flex-1 bg-gray3 text-black font-bold text-sm py-2.5 rounded-3xl hover:bg-lime transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
						{#if isExporting}
							<span class="flex items-center justify-center gap-2">
								<div class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-3xl"></div>
								Exporting...
							</span>
						{:else}
							Export as PDF
						{/if}
					</button>
					<button
						type="button"
						on:click={handlePrintPdf}
						disabled={isPrinting}
						title="Export print version — 8.5 x 11 in, black and white, light background"
						aria-label="Export print version PDF"
						class="px-4 bg-gray1 text-white font-bold text-sm py-2.5 rounded-3xl hover:bg-lime hover:text-black transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
					>
						{#if isPrinting}
							<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
						{:else}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="6 9 6 2 18 2 18 9" />
								<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
								<rect x="6" y="14" width="12" height="8" />
							</svg>
						{/if}
					</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex-1 flex flex-col items-center justify-center h-full text-center p-4">
				<div class="animate-spin w-8 h-8 border-2 border-lime border-t-transparent rounded-full mb-3"></div>
				<p class="text-gray2 text-xs">Loading budget...</p>
			</div>
		{/if}
	{/if}
</div>

<div use:portal>
	<PresetManager bind:isOpen={isPresetModalOpen} on:close={() => (isPresetModalOpen = false)} on:presetsChanged={() => dispatch('presetsChanged')} />
</div>

<style>
	.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
	.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
	.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.animate-spin { animation: spin 1s linear infinite; }
</style>