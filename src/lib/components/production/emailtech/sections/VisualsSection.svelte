<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { TechEmailForm } from '$lib/types/emailtech';
	import SectionCard from './SectionCard.svelte';

	export let formData: TechEmailForm;
	export let readOnly = false;
	const dispatch = createEventDispatcher();

	// --- 1. VENUE & DEFAULT LOGIC ---
	$: specLabel = formData.specs_links?.[0]?.label || '';
	$: isDSTRKT = specLabel.includes('DSTRKT');
	$: isBazart = specLabel.toLowerCase().includes('bazart');
	$: isNCG = specLabel.includes('NCG') || specLabel.includes('360');
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

	// --- 3. SPONSOR LOGIC (Moved up for reactivity) ---
	const SPONSOR_OPTIONS = [
		{ label: 'None', color: '#52525b' },
		{ label: 'Patron', color: '#ffe089ff' },
		{ label: 'Patron El Alto', color: '#4CC252' },
		{ label: 'Moet Chandon', color: '#ffe089ff' },
		{ label: 'Grey Goose', color: '#E3FFFF' },
		{ label: 'Redbull', color: '#fa7a90ff' },
		{ label: 'Budlight', color: '#087bff' },
		{ label: 'Stella Artois', color: '#E33E19' },
		{ label: 'Corona', color: '#d7b8e8ff' },
		{ label: 'Other', color: '#9ca3af' }
	];

	let showSponsorDropdown = false;

	$: if (formData.sponsor_name === undefined) formData.sponsor_name = 'None';

	$: currentSponsorLabel = (() => {
		if (formData.sponsor_name === 'None') return 'None';
		if (!formData.sponsor_name) return 'Other';
		const match = SPONSOR_OPTIONS.find((opt) => opt.label === formData.sponsor_name);
		return match ? match.label : 'Other';
	})();

	$: currentSponsorColor = (() => {
		if (currentSponsorLabel === 'Other') return '#9ca3af';
		const match = SPONSOR_OPTIONS.find((opt) => opt.label === currentSponsorLabel);
		return match ? match.color : '#52525b';
	})();

	// The Core Fix: Stage specs ONLY override if sponsor is NOT custom.
	$: useStandardLogo = isStandardVenue && currentSponsorLabel !== 'Other';

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
			const parsed = parseTimeFromText(formData.visuals_interior);
			if (parsed) removalTime = parsed;

			if (!useStdLogo) {
				// Allow editing the main body
				const splitContent = formData.visuals_interior.split('\nPlease remove');
				if (splitContent[0]) {
					customInteriorText = splitContent[0];
				}
			} else {
				// Enforce Standard Layout for Interior
				if (isNCG || isDSTRKT) {
					const validTime = removalTime || '00:00';
					formData.visuals_interior = `${standardInteriorText}\nPlease remove show artworks at ${formatTimeDisplay(validTime)} TVS only`;
				}
			}
		} else {
			removalTime = '00:00';
			customInteriorText = standardInteriorText || 'Link: \nStage: \nShow Artwork: ';
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
			const validTime = removalTime || '00:00';
			formData.visuals_interior = `${content}\nPlease remove show artworks at ${formatTimeDisplay(validTime)} TVS only`;
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

	function selectSponsor(option: (typeof SPONSOR_OPTIONS)[0]) {
		formData.sponsor_name = option.label === 'Other' ? '' : option.label;
		showSponsorDropdown = false;
		dispatch('change');
		
		setTimeout(() => {
			updateOutdoorData();
			updateInteriorData();
		}, 0);
	}

	function handleReset() {
		if (readOnly) return;
		outdoorTime = isBazart ? '17:00' : '21:30';
		removalTime = '00:00';
		customLogoName = 'Custom Logo';
		customOutdoorText = projectorLink ? `Link: ${projectorLink}` : 'Link: ';
		customInteriorText = standardInteriorText || 'Link: \nStage: \nShow Artwork: ';
		formData.sponsor_name = 'None';
		formData.sponsor_link = '';

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

<svelte:window
	on:click={(e) => {
		if (showSponsorDropdown && !(e.target as Element).closest('.sponsor-dropdown')) {
			showSponsorDropdown = false;
		}
	}}
/>

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
				<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Exterior Projector</span>

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

					<div class="flex items-center gap-3 mt-1 pl-1">
						<input
							aria-label="Removal Time"
							type="time"
							bind:value={removalTime}
							on:input={updateInteriorData}
							disabled={readOnly}
							class="bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-sm text-white w-[5.5rem] flex-shrink-0 text-center focus:border-lime focus:outline-none transition-colors"
						/>
						<span class="text-sm text-gray2 font-bold">Remove Artwork TVS only</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-4 relative z-0">
			<div class="flex flex-col gap-1.5">
				<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Sponsor</span>

				<div class="relative sponsor-dropdown">
					<button
						type="button"
						disabled={readOnly}
						on:click={() => (showSponsorDropdown = !showSponsorDropdown)}
						class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-sm text-white flex items-center justify-between hover:bg-gray1/50 transition-colors focus:outline-none focus:ring-1 focus:ring-lime cursor-pointer min-h-[46px]"
					>
						<span class="flex items-center gap-2 truncate">
							<span
								class="w-3 h-3 rounded-full flex-shrink-0"
								style="background-color: {currentSponsorColor};"
							></span>
							<span>{currentSponsorLabel}</span>
						</span>

						{#if !readOnly}
							<svg
								class="w-4 h-4 text-gray2 transition-transform {showSponsorDropdown
									? 'rotate-180'
									: ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						{/if}
					</button>

					{#if showSponsorDropdown && !readOnly}
						<div
							transition:fly={{ y: -5, duration: 150 }}
							class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-gray1 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar"
						>
							{#each SPONSOR_OPTIONS as option}
								<button
									type="button"
									on:click={() => selectSponsor(option)}
									class="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-gray1 flex items-center gap-3 transition-colors border-b border-gray1 last:border-0 cursor-pointer"
								>
									<span
										class="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
										style="background-color: {option.color};"
									></span>
									{option.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			{#if currentSponsorLabel === 'Other'}
				<div transition:fly={{ y: -5, duration: 150 }} class="flex flex-col gap-1.5">
					<span class="text-[10px] text-gray2 uppercase font-bold ml-1">Sponsor Name</span>
					<input
						type="text"
						bind:value={formData.sponsor_name}
						on:input={handleChange}
						disabled={readOnly}
						placeholder="Enter sponsor name..."
						class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-sm text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors"
					/>
				</div>
			{/if}

			{#if currentSponsorLabel !== 'None'}
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