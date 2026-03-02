<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';

	export let isOpen = false;
	export let venueId: string | null = null;

	const dispatch = createEventDispatcher();
	let saving = false;

	// Form State
	let venueName = '';
	let location = { street: '', line2: '', city: '', state: '', zip: '', country: '' };
	let timezone = '(UTC-05:00) Eastern Time';
	let logoUrl = '';

	let financials: {
		taxRate: number | null;
		taxType: string;
		currency: string;
		convertToUsd: boolean;
		facilityFee: number | null;
	} = {
		taxRate: null,
		taxType: 'Divisor',
		currency: 'CAD',
		convertToUsd: false,
		facilityFee: null
	};
	let holdSettings = { defaultHoldLevel: 'H2', autoPromote: true };
	let stages = [{ name: 'Main Room', capacity: 2500, color: '#FFB3BA', active: true }];

	// UI State
	let availableLogos: { name: string; url: string }[] = [];
	let showTzDropdown = false;
	let showLogoDropdown = false;
	let showHoldDropdown = false;
	let showPromoteDropdown = false;
	let showCurrencyDropdown = false;
	let showUploadModal = false;
	let isUploadingLogo = false;
	let activeColorPicker: number | null = null;
	let logoBgTheme: 'light' | 'dark' = 'dark';

	// Refs for outside click detection
	let tzRef: HTMLElement;
	let logoRef: HTMLElement;
	let holdRef: HTMLElement;
	let promoteRef: HTMLElement;
	let currencyRef: HTMLElement;
	let colorPickerRef: HTMLElement;

	const timezones = [
		'(UTC-08:00) Pacific Time',
		'(UTC-07:00) Mountain Time',
		'(UTC-06:00) Central Time',
		'(UTC-05:00) Eastern Time',
		'(UTC-04:00) Atlantic Time',
		'(UTC+00:00) Greenwich Mean Time',
		'(UTC+01:00) Central European Time'
	];

	// Pastel matrix (4 rows of 4)
	const pastelColorsMatrix = [
		// Row 1: Light (Derived from your pastels - Higher brightness)
		['#DBEAFE', '#E6F9D7', '#FFF0C4', '#FCD8C4', '#FDBDC7', '#FCE7F3', '#EEDEF6', '#F5F5F5'],

		// Row 2: Pastel (Your specific requested colors)
		['#93C5FD', '#C4EF9B', '#FFE089', '#F8A679', '#FA7A90', '#F9A8D4', '#D7B8E8', '#E4E4E4'],

		// Row 3: Strong (Derived from your pastels - Higher saturation)
		['#3B82F6', '#92D64D', '#FFC107', '#F36E21', '#F73155', '#F472B6', '#B276D8', '#BDBDBB'],

		// Row 4: Fluo / Flash (Derived from your pastels - Neon/Vivid)
		['#00FFFF', '#66FF00', '#FFFF00', '#FF5E00', '#FF003C', '#FF00FF', '#BC13FE', '#2F2F2F']
	];

	// Validation
	$: isFormValid =
		venueName.trim() !== '' &&
		timezone.trim() !== '' &&
		financials.taxRate !== null &&
		financials.currency.trim() !== '' &&
		financials.facilityFee !== null &&
		stages.length > 0 &&
		stages.some((s) => s.name.trim() !== '');

	$: if (isOpen) {
		if (venueId) {
			loadVenueData();
		} else {
			resetForm();
			fetchLogos();
			// Still need to get logos for a new venue
		}
	}

	function resetForm() {
		venueName = '';
		location = { street: '', line2: '', city: '', state: '', zip: '', country: '' };
		timezone = '(UTC-05:00) Eastern Time';
		logoUrl = '';
		financials = {
			taxRate: null,
			taxType: 'Divisor',
			currency: 'CAD',
			convertToUsd: false,
			facilityFee: null
		};
		holdSettings = { defaultHoldLevel: 'H2', autoPromote: true };
		stages = [{ name: 'Main Room', capacity: 2500, color: '#FFB3BA', active: true }];
		activeColorPicker = null;
		logoBgTheme = 'dark';
	}

	async function loadVenueData() {
		const { data } = await supabase
			.from('calendar_settings')
			.select('*')
			.eq('id', venueId)
			.maybeSingle();

		if (data) {
			const p = data.setting_params;
			venueName = data.setting_name;
			location = p.location || location;
			financials = p.financials || financials;
			holdSettings = p.holdSettings || holdSettings;
			stages = p.stages || stages;
			logoUrl = p.logoUrl || logoUrl;
			timezone = p.timezone || timezone;
		}
		await fetchLogos();
	}

	onMount(() => {
		if (isOpen && venueId) loadVenueData();
	});

	async function fetchLogos() {
		const { data, error } = await supabase.storage.from('public-assets').list('calendar/logos');

		if (data && !error) {
			availableLogos = data
				.filter((file) => file.name !== '.emptyFolderPlaceholder')
				.map((file) => {
					const { data: urlData } = supabase.storage
						.from('public-assets')
						.getPublicUrl(`calendar/logos/${file.name}`);
					return { name: file.name, url: urlData.publicUrl };
				});
		}
	}

	function analyzeImageBrightness(url: string) {
		if (!url) return;
		const img = new Image();
		img.crossOrigin = 'Anonymous';
		img.src = url;

		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext('2d');

			if (!ctx) return;

			ctx.drawImage(img, 0, 0);
			try {
				const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

				let r = 0,
					g = 0,
					b = 0,
					count = 0;

				for (let i = 0; i < data.length; i += 4) {
					if (data[i + 3] < 50) continue;

					r += data[i];
					g += data[i + 1];
					b += data[i + 2];
					count++;
				}
				if (count === 0) return;

				r = Math.floor(r / count);
				g = Math.floor(g / count);
				b = Math.floor(b / count);

				const brightness = (r * 299 + g * 587 + b * 114) / 1000;

				logoBgTheme = brightness < 128 ? 'light' : 'dark';
			} catch (e) {
				console.warn('CORS prevented image analysis, defaulting to dark theme.');
			}
		};
	}

	$: if (logoUrl) analyzeImageBrightness(logoUrl);

	function addStage() {
		const randomRow = pastelColorsMatrix[Math.floor(Math.random() * pastelColorsMatrix.length)];
		const randomColor = randomRow[Math.floor(Math.random() * randomRow.length)];

		stages = [...stages, { name: '', capacity: 0, color: randomColor, active: true }];
	}

	async function handleLogoUploadEvent(e: CustomEvent<{ file: File; fileName: string }>) {
		const file = e.detail.file;
		const customName = e.detail.fileName;
		isUploadingLogo = true;

		const path = `logos/${Date.now()}_${customName.replace(/\s+/g, '-')}`;
		const { data, error } = await supabase.storage
			.from('public-assets')
			.upload(`calendar/${path}`, file);

		if (data) {
			const { data: urlData } = supabase.storage
				.from('public-assets')
				.getPublicUrl(`calendar/${path}`);
			logoUrl = urlData.publicUrl;
			await fetchLogos();
			showUploadModal = false;
		}
		isUploadingLogo = false;
	}

	async function saveVenue() {
		if (!isFormValid) return;
		saving = true;
		const payload = {
			setting_name: venueName,
			setting_type: 'VENUE', // <-- NEW
			setting_params: { location, timezone, logoUrl, financials, holdSettings, stages }
		};

		const { error } = venueId
			? await supabase.from('calendar_settings').update(payload).eq('id', venueId)
			: await supabase.from('calendar_settings').insert([payload]);

		if (!error) {
			dispatch('success');
			isOpen = false;
		} else {
			console.error("Failed to save venue:", error);
		}
		saving = false;
	}

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as Node;
		if (showTzDropdown && tzRef && !tzRef.contains(target)) showTzDropdown = false;
		if (showLogoDropdown && logoRef && !logoRef.contains(target)) showLogoDropdown = false;
		if (showHoldDropdown && holdRef && !holdRef.contains(target)) showHoldDropdown = false;
		if (showPromoteDropdown && promoteRef && !promoteRef.contains(target))
			showPromoteDropdown = false;
		if (showCurrencyDropdown && currencyRef && !currencyRef.contains(target))
			showCurrencyDropdown = false;
		if (activeColorPicker !== null && colorPickerRef && !colorPickerRef.contains(target))
			activeColorPicker = null;
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="absolute z-[999]">
	<UploadModal
		bind:isOpen={showUploadModal}
		title="Upload Venue Logo"
		acceptedTypes="image/png, image/jpeg, image/svg+xml, image/webp"
		allowRename={true}
		fileNameTemplate={venueName
			? `${venueName.toLowerCase().replace(/\s+/g, '-')}-logo`
			: 'venue-logo'}
		isUploading={isUploadingLogo}
		on:upload={handleLogoUploadEvent}
		on:close={() => (showUploadModal = false)}
	/>
</div>

{#if isOpen}
	<div
		class="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
		transition:fade
	>
		<div
			class="bg-[#212121] border border-[#BDBDBB]/20 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
			transition:fly={{ y: 20 }}
		>
			<div class="p-6 border-b border-[#BDBDBB]/10 flex justify-between items-center bg-[#212121]">
				<h2 class="text-xl font-bold text-[#F7F7F7]">
					{venueId ? 'Edit Venue Settings' : 'New Venue Settings'}
				</h2>
				<button
					type="button"
					class="text-[#BDBDBB] hover:text-[#F7F7F7] transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg
					>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-[#1a1a1a]">
				<section class="space-y-4">
					<h3 class="text-sm font-black text-[#E1FF00] uppercase tracking-widest">General Info</h3>

					<div class="grid grid-cols-2 gap-5">
						<div>
							<label
								for="venueName"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>Venue Name <span class="text-[#E1FF00]">*</span></label
							>
							<input
								id="venueName"
								type="text"
								bind:value={venueName}
								placeholder="Enter venue name"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
						<div class="relative w-full" bind:this={tzRef}>
							<label
								for="tz-btn"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>Venue Time Zone <span class="text-[#E1FF00]">*</span></label
							>
							<button
								id="tz-btn"
								type="button"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center"
								on:click={() => (showTzDropdown = !showTzDropdown)}
							>
								<span class="truncate">{timezone}</span>
								<svg
									class="w-4 h-4 transition-transform {showTzDropdown ? 'rotate-180' : ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
								>
							</button>
							{#if showTzDropdown}
								<div
									class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl shadow-xl z-[60] max-h-48 overflow-y-auto custom-scrollbar overflow-hidden"
								>
									{#each timezones as tz}
										<button
											type="button"
											class="w-full px-4 py-3 text-sm text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 border-b border-[#BDBDBB]/10 last:border-0 cursor-pointer"
											on:click={() => {
												timezone = tz;
												showTzDropdown = false;
											}}
										>
											{tz}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-2 gap-5">
						<div>
							<label
								for="street"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>Street Address</label
							>
							<input
								id="street"
								type="text"
								bind:value={location.street}
								placeholder="123 Main St"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
						<div>
							<label
								for="line2"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>Address Line 2</label
							>
							<input
								id="line2"
								type="text"
								bind:value={location.line2}
								placeholder="Suite 100"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
					</div>

					<div class="grid grid-cols-4 gap-5">
						<div>
							<label for="city" class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>City</label
							>
							<input
								id="city"
								type="text"
								bind:value={location.city}
								placeholder="City"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
						<div>
							<label
								for="state"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>State/Prov</label
							>
							<input
								id="state"
								type="text"
								bind:value={location.state}
								placeholder="State"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
						<div>
							<label for="zip" class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
								>Zip/Postal</label
							>
							<input
								id="zip"
								type="text"
								bind:value={location.zip}
								placeholder="H0H 0H0"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
						<div>
							<label
								for="country"
								class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1">Country</label
							>
							<input
								id="country"
								type="text"
								bind:value={location.country}
								placeholder="Country"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm"
							/>
						</div>
					</div>
				</section>

				<section class="space-y-4 border-t border-[#BDBDBB]/10 pt-4">
					<h3 class="text-sm font-black text-[#E1FF00] uppercase tracking-widest">Venue Logo</h3>

					<div class="grid grid-cols-2 gap-5 items-start">
						<div class="relative w-full" bind:this={logoRef}>
							<button
								id="logo-btn"
								type="button"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center"
								on:click={() => (showLogoDropdown = !showLogoDropdown)}
							>
								<span class="truncate {logoUrl ? '' : 'text-[#BDBDBB]/50'}">
									{logoUrl
										? availableLogos.find((l) => l.url === logoUrl)?.name || 'Selected Logo'
										: 'Select or upload a logo...'}
								</span>
								<svg
									class="w-4 h-4 transition-transform {showLogoDropdown ? 'rotate-180' : ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
								>
							</button>

							{#if showLogoDropdown}
								<div
									class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl shadow-xl z-[60] overflow-hidden max-h-56 overflow-y-auto custom-scrollbar"
								>
									<button
										type="button"
										class="w-full px-4 py-3 text-sm font-bold text-[#BDBDBB] text-left hover:bg-[#BDBDBB]/10 border-b border-[#BDBDBB]/10 cursor-pointer flex items-center gap-3"
										on:click={() => {
											logoUrl = '';
											showLogoDropdown = false;
										}}
									>
										<svg
											class="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<circle cx="12" cy="12" r="10"></circle>
											<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
										</svg>
										NONE
									</button>

									{#each availableLogos as logo}
										<button
											type="button"
											class="w-full px-4 py-3 text-sm text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 border-b border-[#BDBDBB]/10 cursor-pointer flex items-center gap-3"
											on:click={() => {
												logoUrl = logo.url;
												showLogoDropdown = false;
											}}
										>
											<img
												src={logo.url}
												alt=""
												class="w-6 h-6 rounded object-contain bg-white/10"
											/>
											<span class="truncate">{logo.name}</span>
										</button>
									{/each}

									<button
										type="button"
										class="w-full px-4 py-3 text-sm font-bold text-[#E1FF00] text-center hover:bg-[#E1FF00]/10 cursor-pointer block"
										on:click={() => {
											showUploadModal = true;
											showLogoDropdown = false;
										}}
									>
										+ Upload New Logo
									</button>
								</div>
							{/if}
						</div>

						{#if logoUrl}
							<div
								class="w-full h-32 rounded-2xl flex items-center justify-center border border-[#BDBDBB]/20 transition-colors duration-500 shadow-inner overflow-hidden"
								style="background-color: {logoBgTheme === 'light' ? '#E4E4E4' : '#1a1a1a'}"
							>
								<img
									src={logoUrl}
									alt="Logo Preview"
									class="max-w-full max-h-full object-contain p-4"
								/>
							</div>
						{:else}
							<div
								class="w-full h-32 rounded-2xl flex items-center justify-center border border-dashed border-[#BDBDBB]/30 bg-[#2F2F2F]/20"
							>
								<span class="text-[#BDBDBB]/40 text-xs font-bold uppercase tracking-widest"
									>No Logo Selected</span
								>
							</div>
						{/if}
					</div>
				</section>

				<div class="grid grid-cols-2 gap-10 border-t border-[#BDBDBB]/10 pt-8">
					<section class="space-y-4">
						<div class="flex justify-between items-center">
							<h3 class="text-sm font-black text-[#E1FF00] uppercase tracking-widest">
								Stages / Rooms <span class="text-[#E1FF00] text-xs">*</span>
							</h3>
							<button
								type="button"
								class="text-[#E1FF00] font-bold text-xs hover:underline cursor-pointer"
								on:click={addStage}>+ Add</button
							>
						</div>
						<div class="space-y-3 relative w-full" bind:this={colorPickerRef}>
							{#each stages as stage, i}
								<div
									class="flex items-center gap-3 bg-[#2F2F2F] px-3 py-2.5 rounded-2xl border border-[#BDBDBB]/20"
								>
									<input
										type="text"
										bind:value={stage.name}
										placeholder="Stage Name"
										class="flex-[2] bg-transparent text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:outline-none text-sm font-bold w-full"
									/>

									<input
										type="number"
										min="0"
										bind:value={stage.capacity}
										placeholder="Cap"
										class="w-16 bg-black/20 rounded-xl text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:outline-none px-2 py-1.5 text-sm text-center hide-arrows"
									/>

									<div class="relative flex items-center justify-center pl-1">
										<button
											type="button"
											class="w-6 h-6 rounded-full shadow-inner border border-[#F7F7F7]/20 cursor-pointer hover:scale-110 transition-transform"
											style="background-color: {stage.color}"
											on:click={() => (activeColorPicker = activeColorPicker === i ? null : i)}
											aria-label="Pick color"
										></button>

										{#if activeColorPicker === i}
											<div
												class="absolute right-0 top-[calc(100%+12px)] w-auto bg-[#212121] p-3 rounded-2xl border border-[#BDBDBB]/20 flex flex-col gap-2.5 z-[60] shadow-2xl"
												transition:fade={{ duration: 150 }}
											>
												{#each pastelColorsMatrix as row}
													<div class="flex gap-2.5">
														{#each row as color}
															<button
																type="button"
																class="w-7 h-7 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-sm"
																style="background-color: {color}"
																on:click={() => {
																	stage.color = color;
																	activeColorPicker = null;
																}}
																aria-label={color}
															></button>
														{/each}
													</div>
												{/each}
											</div>
										{/if}
									</div>
									<button
										type="button"
										class="text-[#BDBDBB] hover:text-[#FCA5A5] p-1.5 cursor-pointer transition-colors"
										on:click={() => (stages = stages.filter((_, idx) => idx !== i))}
										aria-label="Remove Stage"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
											><path
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/></svg
										>
									</button>
								</div>
							{/each}
						</div>
					</section>

					<section class="space-y-4">
						<h3 class="text-sm font-black text-[#E1FF00] uppercase tracking-widest">
							Holds & Templates
						</h3>
						<div class="space-y-5 bg-[#2F2F2F]/50 p-5 rounded-[20px] border border-[#BDBDBB]/10">
							<div class="relative w-full" bind:this={holdRef}>
								<label
									for="hold-btn"
									class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
									>Default Hold Level</label
								>
								<button
									id="hold-btn"
									type="button"
									class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center"
									on:click={() => (showHoldDropdown = !showHoldDropdown)}
								>
									<span>{holdSettings.defaultHoldLevel}</span>
									<svg
										class="w-4 h-4 transition-transform {showHoldDropdown ? 'rotate-180' : ''}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</button>
								{#if showHoldDropdown}
									<div
										class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl shadow-xl z-[60] max-h-48 overflow-y-auto custom-scrollbar"
									>
										{#each Array.from({ length: 5 }, (_, i) => `H${i + 1}`) as lvl}
											<button
												type="button"
												class="w-full px-4 py-3 text-sm font-bold text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 border-b border-[#BDBDBB]/10 last:border-0 cursor-pointer"
												on:click={() => {
													holdSettings.defaultHoldLevel = lvl;
													showHoldDropdown = false;
												}}
											>
												{lvl}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div class="relative w-full" bind:this={promoteRef}>
								<label
									for="promote-btn"
									class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
									>Auto Promote Holds</label
								>
								<button
									id="promote-btn"
									type="button"
									class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center"
									on:click={() => (showPromoteDropdown = !showPromoteDropdown)}
								>
									<span>{holdSettings.autoPromote ? 'YES' : 'NO'}</span>
									<svg
										class="w-4 h-4 transition-transform {showPromoteDropdown ? 'rotate-180' : ''}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</button>
								{#if showPromoteDropdown}
									<div
										class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl shadow-xl z-[60] overflow-hidden"
									>
										<button
											type="button"
											class="w-full px-4 py-3 text-sm font-bold text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 border-b border-[#BDBDBB]/10 cursor-pointer"
											on:click={() => {
												holdSettings.autoPromote = true;
												showPromoteDropdown = false;
											}}>YES</button
										>
										<button
											type="button"
											class="w-full px-4 py-3 text-sm font-bold text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 cursor-pointer"
											on:click={() => {
												holdSettings.autoPromote = false;
												showPromoteDropdown = false;
											}}>NO</button
										>
									</div>
								{/if}
							</div>

							<div class="w-full">
								<label
									for="template-btn"
									class="block text-xs font-bold text-[#BDBDBB] uppercase mb-1.5 ml-1"
									>Default Template</label
								>
								<button
									id="template-btn"
									type="button"
									disabled
									class="w-full bg-[#2F2F2F]/50 border border-[#BDBDBB]/10 rounded-2xl px-4 py-3 text-[#BDBDBB]/50 cursor-not-allowed text-sm text-left flex justify-between items-center italic"
								>
									<span>Coming soon...</span>
									<svg
										class="w-4 h-4 opacity-50"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</button>
							</div>
						</div>
					</section>
				</div>

				<section class="space-y-4 pt-4 border-t border-[#BDBDBB]/10">
					<h3 class="text-sm font-black text-[#E1FF00] uppercase tracking-widest">Financials</h3>
					<div class="grid grid-cols-4 gap-6">
						<div class="space-y-3">
							<div>
								<label for="taxRate" class="block text-xs font-bold text-[#BDBDBB] mb-1.5 ml-1"
									>Tax Rate % <span class="text-[#E1FF00]">*</span></label
								>
								<input
									id="taxRate"
									type="number"
									min="0"
									step="0.001"
									placeholder="0%"
									bind:value={financials.taxRate}
									class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm hide-arrows"
								/>
							</div>
							<div>
								<span class="block text-xs font-bold text-[#BDBDBB] mb-1.5 ml-1">Tax Type</span>
								<div class="flex bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl p-1 h-[46px]">
									<button
										type="button"
										class="flex-1 text-xs font-bold rounded-xl transition-colors cursor-pointer {financials.taxType ===
										'Divisor'
											? 'bg-[#E1FF00] text-[#000000]'
											: 'text-[#F7F7F7] hover:bg-[#BDBDBB]/10'}"
										on:click={() => (financials.taxType = 'Divisor')}>Divisor</button
									>
									<button
										type="button"
										class="flex-1 text-xs font-bold rounded-xl transition-colors cursor-pointer {financials.taxType ===
										'Multiplier'
											? 'bg-[#E1FF00] text-[#000000]'
											: 'text-[#F7F7F7] hover:bg-[#BDBDBB]/10'}"
										on:click={() => (financials.taxType = 'Multiplier')}>Multiplier</button
									>
								</div>
							</div>
						</div>

						<div>
							<label for="currency-btn" class="block text-xs font-bold text-[#BDBDBB] mb-1.5 ml-1"
								>Currency <span class="text-[#E1FF00]">*</span></label
							>
							<div class="relative w-full" bind:this={currencyRef}>
								<button
									id="currency-btn"
									type="button"
									class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center"
									on:click={() => (showCurrencyDropdown = !showCurrencyDropdown)}
								>
									<span>{financials.currency}</span>
									<svg
										class="w-4 h-4 transition-transform {showCurrencyDropdown ? 'rotate-180' : ''}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</button>
								{#if showCurrencyDropdown}
									<div
										class="absolute top-[calc(100%+8px)] left-0 w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl shadow-xl z-[70] overflow-hidden"
									>
										{#each ['CAD', 'USD', 'EUR', 'GBP'] as curr}
											<button
												type="button"
												class="w-full px-4 py-3 text-sm text-[#F7F7F7] text-left hover:bg-[#E1FF00]/10 border-b border-[#BDBDBB]/10 last:border-0 cursor-pointer transition-colors"
												on:click={() => {
													financials.currency = curr;
													showCurrencyDropdown = false;
												}}>{curr}</button
											>
										{/each}
									</div>
								{/if}
							</div>
						</div>

						<div>
							<span class="block text-xs font-bold text-[#BDBDBB] mb-1.5 ml-1">Convert to USD$</span>
							<button
								type="button"
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm text-left flex justify-between items-center font-bold h-[46px]"
								on:click={() => (financials.convertToUsd = !financials.convertToUsd)}
							>
								<span class="text-[#F7F7F7]">{financials.convertToUsd ? 'YES' : 'NO'}</span>
								<div
									class="w-9 h-5 rounded-full relative transition-colors {financials.convertToUsd
										? 'bg-[#E1FF00]'
										: 'bg-[#1a1a1a]'}"
								>
									<div
										class="w-3 h-3 bg-white rounded-full absolute top-1 transition-transform {financials.convertToUsd
											? 'translate-x-5 bg-black'
											: 'translate-x-1'}"
									></div>
								</div>
							</button>
						</div>

						<div>
							<label for="facilityFee" class="block text-xs font-bold text-[#BDBDBB] mb-1.5 ml-1"
								>Facility Fee ($) <span class="text-[#E1FF00]">*</span></label
							>
							<input
								id="facilityFee"
								type="number"
								min="0"
								step="0.01"
								placeholder="0.00"
								bind:value={financials.facilityFee}
								class="w-full bg-[#2F2F2F] border border-[#BDBDBB]/20 rounded-2xl px-4 py-3 text-[#F7F7F7] placeholder-[#BDBDBB]/40 focus:border-[#E1FF00] focus:outline-none transition-colors cursor-pointer text-sm hide-arrows"
							/>
						</div>
					</div>
				</section>
			</div>

			<div class="p-6 border-t border-[#BDBDBB]/10 flex gap-4 bg-[#212121] justify-end">
				<button
					type="button"
					class="py-3 px-6 bg-gray3 text-black hover:bg-gray3/80 font-bold text-sm rounded-3xl hover:bg- transition-colors cursor-pointer"
					on:click={() => (isOpen = false)}>Cancel</button
				>
				<button
					type="button"
					class="py-3 px-6 font-black text-sm rounded-3xl transition-colors shadow-lg {isFormValid
						? 'bg-[#E1FF00] text-[#000000] hover:bg-[#E1FF00]/90 cursor-pointer'
						: 'bg-[#2F2F2F] text-[#BDBDBB] opacity-50 cursor-not-allowed'}"
					on:click={saveVenue}
					disabled={saving || !isFormValid}
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.2);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}

	/* Hide number input arrows completely */
	.hide-arrows::-webkit-outer-spin-button,
	.hide-arrows::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.hide-arrows {
		appearance: textfield;
		-moz-appearance: textfield;
		-webkit-appearance: none;
	}
</style>