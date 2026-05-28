<script lang="ts">
	import type { CompEntry, CompTicketData, CompType } from '$lib/types/comptickets';
	import type { Writable } from 'svelte/store';
	import { extractGuestListData, extractGuestListDataFallback, hasEmailAddress } from '$lib/services/compPasteService';

	export let data: Writable<CompTicketData>;
	let openSections: Record<CompType, boolean> = { ga_comps: true, vip_comps: true, other_comps: false };
	let pasteTexts: Record<CompType, string> = { ga_comps: '', vip_comps: '', other_comps: '' };
	let processingPaste: Record<CompType, boolean> = { ga_comps: false, vip_comps: false, other_comps: false };
	let pasteErrors: Record<CompType, string> = { ga_comps: '', vip_comps: '', other_comps: '' };
	let clearAllConfirm: Record<CompType, boolean> = { ga_comps: false, vip_comps: false, other_comps: false };
	// --- Core Logic ---

	function commitChanges(mutator: (draft: CompTicketData) => void) {
		data.update(currentData => {
			const draft = {
				...currentData,
				ga_comps: [...(currentData.ga_comps || [])],
				vip_comps: [...(currentData.vip_comps || [])],
				other_comps: [...(currentData.other_comps || [])],
				comp_status: { ...currentData.comp_status }
			};
			
			mutator(draft);

			draft.ga_comps = draft.ga_comps.filter(entry => !isEntryEmpty(entry));
			draft.vip_comps = draft.vip_comps.filter(entry => !isEntryEmpty(entry));
			draft.other_comps = draft.other_comps.filter(entry => !isEntryEmpty(entry));

			const hasAnyUnsentComps = 
				draft.ga_comps.some(c => !c.sent) || 
				draft.vip_comps.some(c => !c.sent) || 
				draft.other_comps.some(c => !c.sent);

			if (hasAnyUnsentComps && draft.comp_status.status === 'None') {
				draft.comp_status.status = 'Progress';
			} else if (!draft.ga_comps.length && !draft.vip_comps.length && !draft.other_comps.length) {
				draft.comp_status.status = 'None';
			}
			
			return draft;
		});
	}

	// --- Event Handlers ---

	function handleBlur() {
		commitChanges(() => {});
	}

	// MODIFIED: Accepts the entry object itself instead of an index to avoid errors with sorted lists.
	function removeEntry(type: CompType, entryToRemove: CompEntry) {
		commitChanges(draft => {
			if (draft[type]) {
				// Filter out the specific entry object.
				draft[type] = draft[type].filter(entry => entry !== entryToRemove);
			}
		});
	}

	function handleClearAll(type: CompType) {
		if (clearAllConfirm[type]) {
			commitChanges(draft => {
				draft[type] = draft[type].filter(entry => entry.sent);
			});
			clearAllConfirm[type] = false;
		} else {
			clearAllConfirm[type] = true;
			setTimeout(() => { clearAllConfirm[type] = false; }, 3000);
		}
	}

	async function handleKeyPress(event: KeyboardEvent, type: CompType) {
		if (event.key === 'Enter') {
			event.preventDefault();
			const text = pasteTexts[type];
			if (!text.trim()) return;
			
			await processGuestListText(text, type);
		}
	}

	async function handlePaste(event: ClipboardEvent, type: CompType) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text/plain') || '';
		if (!text.trim()) return;

		await processGuestListText(text, type);
	}

	async function processGuestListText(text: string, type: CompType) {
		pasteErrors[type] = '';
		if (!hasEmailAddress(text)) {
			pasteErrors[type] = 'Please enter valid guest list data with at least one email address.';
			setTimeout(() => { pasteErrors[type] = ''; }, 4000);
			return;
		}

		processingPaste[type] = true;
		let extractedEntries: Omit<CompEntry, 'sent' | 'added_by'>[] = [];
		try {
			extractedEntries = await extractGuestListData(text);
		} catch (aiError) {
			console.warn('AI extraction failed, using fallback:', aiError);
			try {
				extractedEntries = extractGuestListDataFallback(text);
			} catch (fallbackError: any) {
				pasteErrors[type] = fallbackError.message || 'Failed to process guest list data.';
				setTimeout(() => { pasteErrors[type] = ''; }, 4000);
				processingPaste[type] = false;
				return;
			}
		}

		const newEntries: CompEntry[] = extractedEntries.map(entry => ({
			...entry,
			sent: false,
			added_by: 'Charles'
		}));

		if (newEntries.length > 0) {
			commitChanges(draft => {
				draft[type] = [...(draft[type] || []), ...newEntries];
			});
			pasteTexts[type] = '';
		}
		
		processingPaste[type] = false;
	}

	// --- Utility Functions ---

	function isEntryEmpty(entry: CompEntry): boolean {
		return !entry.firstName?.trim() && !entry.lastName?.trim() && !entry.email?.trim();
	}
	
	function getTotalQuantity(type: CompType): number {
		const entries = $data[type];
		if (!Array.isArray(entries)) return 0;
		return entries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
	}

	function toggleSection(section: CompType) {
		openSections[section] = !openSections[section];
	}

	// --- Reactive Computations ---

	$: totalComps = getTotalQuantity('ga_comps') + getTotalQuantity('vip_comps') + getTotalQuantity('other_comps');
	$: gaComps = $data.ga_comps ?? [];
	$: vipComps = $data.vip_comps ?? [];
	$: otherComps = $data.other_comps ?? [];
	
	// NEW: Create reactive sorted lists. This keeps sent items at the bottom.
	// The spread operator `[...]` creates a copy so the original store data is not mutated.
	const sortFn = (a: CompEntry, b: CompEntry) => (a.sent ? 1 : 0) - (b.sent ? 1 : 0);
	$: sortedGaComps = [...gaComps].sort(sortFn);
	$: sortedVipComps = [...vipComps].sort(sortFn);
	$: sortedOtherComps = [...otherComps].sort(sortFn);
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl overflow-hidden">
	<div class="p-4 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between">
			<h3 class="text-white text-sm font-bold">Comp Management</h3>
			<div class="text-xs text-gray2">
				Total: <span class="text-lime font-bold">{totalComps}</span> comps
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4 space-y-3 comp-scroll">
		{#each [
			{ type: 'ga_comps' as CompType, title: 'GA Comps', color: '#86EFAC', entries: sortedGaComps },
			{ type: 'vip_comps' as CompType, title: 'VIP Comps', color: '#FCD34D', entries: sortedVipComps },
			{ type: 'other_comps' as CompType, title: $data.comp_status.other_comps_name || '', isCustom: true, color: '#c4b5fd', entries: sortedOtherComps }
		] as section}
			<div class="bg-gray1 rounded-lg overflow-hidden">
				<button on:click={() => toggleSection(section.type)} class="w-full p-3 text-left flex justify-between items-center border-2 border-gray1 rounded-md hover:border-lime transition-colors cursor-pointer group">
					<div class="flex items-center gap-3 flex-1 min-w-0">
						<div class="w-1 h-8 rounded-full flex-shrink-0" style="background-color: {section.color};"></div>
						{#if section.isCustom}
							<input type="text" bind:value={$data.comp_status.other_comps_name} placeholder="Enter custom category" class="bg-transparent text-white font-bold text-sm focus:outline-none flex-1 min-w-0 group-hover:text-lime placeholder-gray3" on:click={(e) => e.stopPropagation()} on:blur={handleBlur}/>
						{:else}
							<span class="text-white text-sm font-bold group-hover:text-white">{section.title}</span>
						{/if}
						<span class="text-xs text-gray3 group-hover:text-white">({getTotalQuantity(section.type)})</span>
					</div>
					<svg class="w-5 h-5 text-gray3 transition-transform flex-shrink-0 group-hover:text-lime {openSections[section.type] ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="6 9 12 15 18 9" />
					</svg>
				</button>

				{#if openSections[section.type]}
					<div class="p-2 border-t border-navbar space-y-0">
						{#if section.entries.some(e => !e.sent)}
							<div class="flex justify-end">
								<button type="button" on:click|stopPropagation={() => handleClearAll(section.type)} class="text-xs font-bold transition-colors cursor-pointer pr-2 py-1.5 rounded-lg {clearAllConfirm[section.type] ? 'text-problem hover:text-red-400' : 'text-gray-400 hover:text-problem'}">
									{clearAllConfirm[section.type] ? 'Clear Unsent?' : 'Clear Unsent'}
								</button>
							</div>
						{/if}

						<div class="relative">
							<div class="mb-3 bg-navbar rounded-3xl border-2 border-gray2 focus-within:border-lime transition-colors">
								<input 
									type="text" 
									bind:value={pasteTexts[section.type]} 
									on:paste={(e) => handlePaste(e, section.type)}
									on:keypress={(e) => handleKeyPress(e, section.type)}
									placeholder="Paste or type and press Enter to add new comps..." 
									disabled={processingPaste[section.type]} 
									class="w-full bg-transparent text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none disabled:opacity-50"
								/>
							</div>
							{#if processingPaste[section.type]}
								<div class="absolute right-3 top-1/2 -translate-y-1/2">
									<div class="animate-spin w-4 h-4 border-2 border-lime border-t-transparent rounded-full"></div>
								</div>
							{/if}
							{#if pasteErrors[section.type]}
								<div class="mt-1 text-xs text-problem">
									{pasteErrors[section.type]}
								</div>
							{/if}
						</div>

						{#if section.entries.length === 0}
							<div class="text-center py-6 text-gray2 text-xs">No comps added yet</div>
						{:else}
							<div class="space-y-1 mb-2">
								{#each section.entries as entry, i (entry.email + i)}
									<div class="grid grid-cols-12 gap-1 items-center transition-opacity" class:opacity-50={entry.sent}>
										<input type="text" bind:value={entry.firstName} on:blur={handleBlur} placeholder="First Name" class="col-span-3 bg-navbar text-white rounded-3xl px-3 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime disabled:cursor-not-allowed" disabled={entry.sent}/>
										<input type="text" bind:value={entry.lastName} on:blur={handleBlur} placeholder="Last Name" class="col-span-3 bg-navbar text-white rounded-3xl px-3 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime disabled:cursor-not-allowed" disabled={entry.sent}/>
										<input type="email" bind:value={entry.email} on:blur={handleBlur} placeholder="Email" class="col-span-4 bg-navbar text-white rounded-3xl px-3 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime disabled:cursor-not-allowed" disabled={entry.sent}/>
										<input type="number" min="1" bind:value={entry.quantity} on:blur={handleBlur} placeholder="1" class="col-span-1 bg-navbar text-center text-white rounded-3xl px-2 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime disabled:cursor-not-allowed" disabled={entry.sent}/>
										<div class="col-span-1 flex items-center justify-center">
											{#if !entry.sent}
												<button type="button" on:click|stopPropagation={() => removeEntry(section.type, entry)} class="text-problem hover:text-red-400 font-bold text-xl cursor-pointer" title="Remove entry">×</button>
											{:else}
												<svg class="w-4 h-4 text-confirmed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
													<title>Sent</title>
													<polyline points="20 6 9 17 4 12" />
												</svg>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.comp-scroll::-webkit-scrollbar { width: 6px; }
	.comp-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
	.comp-scroll::-webkit-scrollbar-thumb { background: #e1ff00; border-radius: 3px; }
	.comp-scroll::-webkit-scrollbar-thumb:hover { background: #f0ff4d; }
	input[type="number"]::-webkit-inner-spin-button, 
	input[type="number"]::-webkit-outer-spin-button { 
		-webkit-appearance: none;
		appearance: none;
		margin: 0; 
	}
	input[type="number"] { 
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>