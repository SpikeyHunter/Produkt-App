<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { TechEmailForm } from '$lib/types/emailtech';
	import SectionCard from './SectionCard.svelte';

	export let formData: TechEmailForm;
	export let readOnly = false;
	/** main event's venue / name — decides which venue defaults apply */
	export let venue: string | null = null;
	export let eventName: string = '';
	const dispatch = createEventDispatcher();

	// --- 1. VENUE & DEFAULT LOGIC ---
	// Venue from the event itself (specs are configurable, so their labels
	// can't be relied on); the spec label only helps spot DSTRKT / 360.
	$: specLabel = (formData.specs_links?.[0]?.label || '').toUpperCase().replace(/\s/g, '');
	$: nameUpper = (eventName || '').toUpperCase().replace(/\s/g, '');
	$: isDSTRKT = specLabel.includes('DSTRKT') || nameUpper.includes('DSTRKT');
	$: isBazart = (venue || '').toLowerCase().includes('bazart') || specLabel.includes('BAZART');
	$: isNCG = !isDSTRKT && !isBazart && ((venue || '').toLowerCase().includes('new city gas') || specLabel.includes('NCG') || specLabel.includes('360') || specLabel.includes('MAINSTAGE'));
	$: isStandardVenue = isDSTRKT || isBazart || isNCG;

	// Default logo name logic
	$: projectorLink = isDSTRKT
		? 'https://link.produkt.ca/dstrkt-projector'
		: isNCG
			? 'https://link.produkt.ca/ncg-projector'
			: '';

	$: standardLogoName = (() => {
		if (isBazart) return 'Gobo Bazart';
		if (isDSTRKT) return 'DSTRKT Animation';
		return 'NCG Animation';
	})();

	// Default interior text logic
	$: standardInteriorText = isDSTRKT
		? 'Link: https://link.produkt.ca/ncg-tv\nDSTRKT: Folder #2\nShow Artwork: Folder #3'
		: 'Link: https://link.produkt.ca/ncg-tv\nNCG: Folder #1\nShow Artwork: Folder #3';

	// --- 2. LOCAL STATE ---
	let outdoorTime = '';
	let customLogoName = 'Custom Logo';
	let customOutdoorText = 'Link: ';
	let customInteriorText = 'Link: \nStage: \nShow Artwork: ';
	let removalTime = '';
	// the whole remove-artwork sentence, editable; the time is appended: "<text> at 12:00 AM"
	const DEFAULT_REMOVAL = 'Please remove show artworks on TVS only';
	let removalText = DEFAULT_REMOVAL;
	$: removalOff = !!formData.artwork_removal_off;

	/** "\n<text> at 12:00 AM", or '' when the line is off */
	function removalLine(time: string): string {
		if (formData.artwork_removal_off) return '';
		return `\n${(removalText || DEFAULT_REMOVAL).trim()} at ${formatTimeDisplay(time || '00:00')}`;
	}

	/** Split the interior text into its body and the remove-artwork line (last line). */
	function splitRemoval(full: string): { body: string; text: string; time: string } | null {
		const lines = String(full || '').split('\n');
		const last = (lines[lines.length - 1] || '').trim();
		const body = lines.slice(0, -1).join('\n');
		// current format: "<text> at 12:00 AM"
		let m = last.match(/^(.*\S)\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\s*$/i);
		if (m) return { body, text: m[1], time: parseTimeFromText(m[2]) || '00:00' };
		// older format: "Please remove show artworks at 12:00 AM TVS only"
		m = last.match(/^Please remove show artworks at\s+(\d{1,2}:\d{2}\s*[AP]M)\s*(.*)$/i);
		if (m) return { body, text: `Please remove show artworks on ${m[2].trim() || 'TVS only'}`, time: parseTimeFromText(m[1]) || '00:00' };
		return null;
	}
	function toggleRemoval() {
		if (readOnly) return;
		formData.artwork_removal_off = !formData.artwork_removal_off;
		updateInteriorData();
	}

	// --- 3. SPONSOR (typed by hand, no list) ---
	$: if (formData.sponsor_name === undefined) formData.sponsor_name = '';
	$: if (formData.sponsor_name === 'None') formData.sponsor_name = '';
	$: hasSponsor = !!(formData.sponsor_name || '').trim();

	// Venue defaults fill the projector/TV texts unless "Custom" is on.
	$: useStandardLogo = isStandardVenue && !formData.visuals_custom;

	function toggleCustom() {
		if (readOnly) return;
		formData.visuals_custom = !formData.visuals_custom;
		dispatch('change');
		setTimeout(() => {
			updateOutdoorData();
			updateInteriorData();
		}, 0);
	}

	// --- 4. SYNC LOGIC ---
	$: {
		if (formData && typeof useStandardLogo === 'boolean') {
			syncOutdoorFromProp(useStandardLogo);
			syncInteriorFromProp(useStandardLogo);
		}
	}

	function syncOutdoorFromProp(useStdLogo: boolean) {
		if (formData.projector_outdoor) {
			const parsed = parseTimeFromText(formData.projector_outdoor);
			if (parsed) outdoorTime = parsed;

			if (!useStdLogo) {
				// Parse custom content for text areas
				const lines = formData.projector_outdoor.split('\n');
				const firstLine = lines[0] || '';
				const parts = firstLine.split(' - ');
				if (parts.length > 1) {
					const extractedName = parts.slice(1).join(' - ');
					if (extractedName) customLogoName = extractedName;
				} else if (firstLine && !parsed) {
					customLogoName = firstLine;
				}
				
				if (lines.length > 1) {
					customOutdoorText = lines.slice(1).join('\n');
				} else {
					customOutdoorText = projectorLink ? `Link: ${projectorLink}` : 'Link: ';
				}
			} else {
				// Enforce Standard Layout
				const currentText = formData.projector_outdoor;
				const needsUpgrade =
					!currentText.includes(standardLogoName) ||
					(projectorLink && !currentText.includes(projectorLink));

				if (needsUpgrade) {
					let outdoorText = `${formatTimeDisplay(outdoorTime)} - ${standardLogoName}`;
					if (projectorLink) {
						outdoorText += `\nLink: ${projectorLink}`;
					}
					formData.projector_outdoor = outdoorText;
				}
			}
		} else {
			outdoorTime = isBazart ? '17:00' : '21:30';
			customLogoName = standardLogoName || 'Custom Logo';
			customOutdoorText = projectorLink ? `Link: ${projectorLink}` : 'Link: ';
			
			let outdoorText = `${formatTimeDisplay(outdoorTime)} - ${useStdLogo ? standardLogoName : customLogoName}`;
			if (useStdLogo && projectorLink) {
				outdoorText += `\nLink: ${projectorLink}`;
			}
			formData.projector_outdoor = outdoorText;
		}
	}

	function syncInteriorFromProp(useStdLogo: boolean) {
		if (formData.visuals_interior) {
			const rem = splitRemoval(formData.visuals_interior);
			if (rem) {
				removalTime = rem.time;
				removalText = rem.text;
			}

			if (!useStdLogo) {
				// Allow editing the main body
				const bodyOnly = rem ? rem.body : formData.visuals_interior;
				if (bodyOnly) customInteriorText = bodyOnly;
			} else {
				// Enforce Standard Layout for Interior
				if (isNCG || isDSTRKT) {
					formData.visuals_interior = `${standardInteriorText}${removalLine(removalTime)}`;
				}
			}
		} else {
			removalTime = '00:00';
			customInteriorText = standardInteriorText || 'Link: \nStage: \nShow Artwork: ';

			// Bazart never uses this field — leave it empty (updateInteriorData
			// also clears it for Bazart on user interaction).
			if (!isBazart) {
				const content = useStdLogo && (isNCG || isDSTRKT) ? standardInteriorText : customInteriorText;
				formData.visuals_interior = `${content}${removalLine(removalTime)}`;
			}
		}
	}

	// --- 5. UPDATE FUNCTIONS ---
	function updateOutdoorData() {
		const validTime = outdoorTime || (isBazart ? '17:00' : '21:30');
		const name = useStandardLogo ? standardLogoName : customLogoName;

		let outdoorText = `${formatTimeDisplay(validTime)} - ${name}`;

		if (useStandardLogo && projectorLink) {
			outdoorText += `\nLink: ${projectorLink}`;
		} else if (!useStandardLogo) {
			if (customOutdoorText.trim() !== '') {
				outdoorText += `\n${customOutdoorText}`;
			}
		}

		formData.projector_outdoor = outdoorText;
		dispatch('change');
	}

	function updateInteriorData() {
		if (isBazart) {
			formData.visuals_interior = '';
		} else {
			const content = useStandardLogo && (isNCG || isDSTRKT) ? standardInteriorText : customInteriorText;
			formData.visuals_interior = `${content}${removalLine(removalTime)}`;
		}
		dispatch('change');
	}

	function formatTimeDisplay(time: string) {
		if (!time) return '';
		const [h, m] = time.split(':').map(Number);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
	}

	function parseTimeFromText(text: string): string | null {
		if (!text) return null;
		const match12 = text.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
		if (match12) {
			const timePart = match12[1];
			const period = match12[2].toUpperCase();
			let [h, m] = timePart.split(':').map(Number);
			if (period === 'PM' && h < 12) h += 12;
			if (period === 'AM' && h === 12) h = 0;
			return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
		}
		const match24 = text.match(/(\d{1,2}:\d{2})/);
		return match24 ? match24[1] : null;
	}

	function adjustHeight(el: HTMLTextAreaElement) {
		el.style.height = 'auto';
		el.style.height = el.scrollHeight + 'px';
	}

	function handleReset() {
		if (readOnly) return;
		outdoorTime = isBazart ? '17:00' : '21:30';
		removalTime = '00:00';
		removalText = DEFAULT_REMOVAL;
		formData.artwork_removal_off = false;
		customLogoName = 'Custom Logo';
		customOutdoorText = projectorLink ? `Link: ${projectorLink}` : 'Link: ';
		customInteriorText = standardInteriorText || 'Link: \nStage: \nShow Artwork: ';
		formData.sponsor_name = '';
		formData.sponsor_link = '';
		formData.sponsor_notes = '';
		formData.visuals_custom = false;

		updateOutdoorData();
		updateInteriorData();
	}

	function handleToggle(e: CustomEvent) {
		dispatch('toggle', e.detail);
	}
	
	function handleChange() {
		updateOutdoorData();
		dispatch('change');
	}
</script>

<SectionCard
	title="Visuals & Video"
	id="visuals"
	isVisible={formData.visible_sections['visuals']}
	on:toggle={handleToggle}
	on:reset={handleReset}
>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<div class="flex flex-col gap-6">
			
			<div class="flex flex-col gap-1.5">
				<div class="flex items-center justify-between">
					<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Exterior Projector</span>
					{#if isStandardVenue && !readOnly}
						<button type="button" on:click={toggleCustom}
							class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border transition-colors cursor-pointer
							{formData.visuals_custom ? 'bg-lime text-black border-lime' : 'border-gray1 text-gray2 hover:text-white hover:border-gray2'}"
							title="Type the projector / TV texts yourself instead of the venue defaults">
							Custom
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-3 pl-1">
					<input
						aria-label="Outdoor Time"
						type="time"
						bind:value={outdoorTime}
						on:input={updateOutdoorData}
						disabled={readOnly}
						class="bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-sm text-white w-[5.5rem] flex-shrink-0 text-center focus:border-lime focus:outline-none transition-colors"
					/>

					{#if useStandardLogo}
						<span class="text-sm text-gray2 font-bold select-none truncate">{standardLogoName}</span>
					{:else}
						<input
							aria-label="Custom Logo Name"
							type="text"
							bind:value={customLogoName}
							on:input={updateOutdoorData}
							disabled={readOnly}
							class="bg-transparent border-b border-gray1 px-2 py-1 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-colors flex-1 min-w-0"
							placeholder="Logo Name"
						/>
					{/if}
				</div>

				{#if useStandardLogo && projectorLink}
					<div
						class="bg-gray1/20 border border-gray1 rounded-2xl p-3 text-xs text-gray3 font-mono leading-relaxed whitespace-pre-wrap select-text mt-2"
					>
						Link: {projectorLink}
					</div>
				{:else if !useStandardLogo}
					<textarea
						bind:value={customOutdoorText}
						on:input={(e) => {
							adjustHeight(e.target as HTMLTextAreaElement);
							updateOutdoorData();
						}}
						disabled={readOnly}
						rows="2"
						placeholder="Link: "
						class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-xs text-white font-mono leading-relaxed focus:border-lime focus:outline-none placeholder-gray2/50 resize-none overflow-hidden mt-2"
					></textarea>
				{/if}
			</div>

			{#if !isBazart}
				<div class="flex flex-col gap-1.5" transition:fly={{ y: -5, duration: 200 }}>
					<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Interior / TVS</span>

					{#if useStandardLogo && (isDSTRKT || isNCG)}
						<div
							class="bg-gray1/20 border border-gray1 rounded-2xl p-3 text-xs text-gray3 font-mono leading-relaxed whitespace-pre-wrap select-text"
						>
							{standardInteriorText}
						</div>
					{:else}
						<textarea
							bind:value={customInteriorText}
							on:input={(e) => {
								adjustHeight(e.target as HTMLTextAreaElement);
								updateInteriorData();
							}}
							disabled={readOnly}
							rows="3"
							class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-xs text-white font-mono leading-relaxed focus:border-lime focus:outline-none placeholder-gray2/50 resize-none overflow-hidden"
						></textarea>
					{/if}

					<!-- remove-artwork line: "<text> at <time>" — one editable sentence; toggle off to drop it -->
					<div class="flex flex-col gap-1.5 mt-1 pl-1 {removalOff ? 'opacity-50' : ''}">
						<div class="flex items-center gap-3">
							<button
								type="button"
								role="switch"
								aria-checked={!removalOff}
								aria-label="Include the remove-artwork line"
								disabled={readOnly}
								on:click={toggleRemoval}
								class="relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer {removalOff ? 'bg-gray2' : 'bg-lime'}"
							>
								<span class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-black shadow transition {removalOff ? 'translate-x-0' : 'translate-x-3'}"></span>
							</button>
							<span class="text-[10px] text-gray2 uppercase font-bold">Remove artwork at</span>
							<input
								aria-label="Removal Time"
								type="time"
								bind:value={removalTime}
								on:input={updateInteriorData}
								disabled={readOnly || removalOff}
								class="bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-sm text-white w-[5.5rem] flex-shrink-0 text-center focus:border-lime focus:outline-none transition-colors"
							/>
						</div>
						<input
							aria-label="Remove-artwork sentence"
							type="text"
							bind:value={removalText}
							on:input={updateInteriorData}
							disabled={readOnly || removalOff}
							placeholder={DEFAULT_REMOVAL}
							class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-colors"
						/>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-4 relative z-0">
			<div class="flex flex-col gap-1.5">
				<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Sponsor / Branding</span>
				<input
					type="text"
					bind:value={formData.sponsor_name}
					on:input={handleChange}
					disabled={readOnly}
					placeholder="None — type a sponsor name (e.g. Patron, Red Bull)…"
					class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-sm text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
				/>
			</div>

			{#if hasSponsor}
				<div transition:fly={{ y: -5, duration: 150 }} class="flex flex-col gap-1.5">
					<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Sponsor Visuals Link</span>
					<input
						type="text"
						bind:value={formData.sponsor_link}
						on:input={handleChange}
						disabled={readOnly}
						placeholder="Paste link to visuals..."
						class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-xs text-lime placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
					/>
				</div>
				<div transition:fly={{ y: -5, duration: 150 }} class="flex flex-col gap-1.5">
					<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Sponsor Notes</span>
					<textarea
						bind:value={formData.sponsor_notes}
						on:input={(e) => {
							adjustHeight(e.target as HTMLTextAreaElement);
							dispatch('change');
						}}
						disabled={readOnly}
						rows="2"
						placeholder="Logo placement, timing, bar branding…"
						class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-xs text-white leading-relaxed focus:border-lime focus:outline-none placeholder-gray2/50 resize-none overflow-hidden"
					></textarea>
				</div>
			{/if}
		</div>
	</div>
</SectionCard>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #555;
		border-radius: 2px;
	}
</style>