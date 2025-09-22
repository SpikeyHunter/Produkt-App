<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import type { EventAdvance, SoundcheckInfo } from '$lib/types/events.js';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	// --- TYPE DEFINITIONS ---
	interface EquipmentItem {
		selected: boolean;
		qty?: number;
		editableQty?: boolean;
	}
	type EquipmentMap = { [key: string]: EquipmentItem };

	interface OtherRequest {
		id: string;
		text: string;
	}

	interface TechRider {
		selected_mixer: string;
		equipment: EquipmentMap;
		other: OtherRequest[];
	}

	interface SoundcheckInfo {
		enabled: boolean;
		start_time: string;
		end_time: string;
	}

	interface SfxItem {
		enabled: boolean;
		duration?: number;
		qty: number;
	}

	interface SfxRider {
		cryo_jets: SfxItem;
		sparkulars: SfxItem;
		lasers: SfxItem;
		other: OtherRequest[];
	}

	// Props & Dispatcher
	export let event: EventAdvance & { event_venue?: string; artist_name?: string };
	const dispatch = createEventDispatcher();
	// --- STATE ---
	let techRider: TechRider;
	let sfxRider: SfxRider;
	let soundcheck: SoundcheckInfo;
	let saving = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let lastEventId: string = '';
	let lastSavedData: string = '';
	let justCopied = false;
	let showPopup = false;
	let popupMessage = '';
	const defaultTechRider: TechRider = {
		selected_mixer: 'DJM-A9',
		equipment: {
			'CDJ-3000': { selected: true, qty: 4, editableQty: true },
			'RMX-1000': { selected: false, qty: 1, editableQty: false },
			'Wireless Mic': { selected: false, qty: 1, editableQty: true },
			'Wired Mic': { selected: false, qty: 1, editableQty: true },
			'Laptop Stand': { selected: false, qty: 1, editableQty: false }
		},
		other: []
	};
	const defaultSoundcheck: SoundcheckInfo = {
		enabled: false,
		start_time: '20:30',
		end_time: '21:00'
	};

	const defaultSfxRider: SfxRider = {
		cryo_jets: { enabled: false, duration: 120, qty: 4 },
		sparkulars: { enabled: false, duration: 120, qty: 4 },
		lasers: { enabled: false, qty: 2 },
		other: []
	};
	const sfxItems: [keyof Omit<SfxRider, 'other'>, string][] = [
		['cryo_jets', 'Cryo Jets'],
		['sparkulars', 'Sparkulars'],
		['lasers', 'Lasers']
	];
	// --- REACTIVE LOGIC ---

	// Initialize data from event
	function initializeData() {
		if (!event) return;

		const eventKey = `${event.event_id}-${event.artist_name}`;
		const dbTechRider = parseJson(event.tech_rider);
		const dbSfxRider = parseJson(event.sfx_rider);
		const dbSoundcheck = parseJson(event.soundcheck);
		// Deep clone and merge equipment with defaults
		const mergedEquipment = Object.keys(defaultTechRider.equipment).reduce((acc, key) => {
			const defaultItem = defaultTechRider.equipment[key];
			const dbItem = dbTechRider?.equipment?.[key];

			acc[key] = {
				...defaultItem,
				...(dbItem || {})
			};
			return acc;
		}, {} as EquipmentMap);
		techRider = {
			selected_mixer: dbTechRider?.selected_mixer || defaultTechRider.selected_mixer,
			equipment: mergedEquipment,
			other: Array.isArray(dbTechRider?.other) ? dbTechRider.other : []
		};
		// Properly type and merge SFX rider
		sfxRider = {
			cryo_jets: { ...defaultSfxRider.cryo_jets, ...(dbSfxRider?.cryo_jets || {}) },
			sparkulars: { ...defaultSfxRider.sparkulars, ...(dbSfxRider?.sparkulars || {}) },
			lasers: { ...defaultSfxRider.lasers, ...(dbSfxRider?.lasers || {}) },
			other: Array.isArray(dbSfxRider?.other) ? dbSfxRider.other : []
		};

		// Properly type and merge Soundcheck
		soundcheck = {
			...defaultSoundcheck,
			...(dbSoundcheck || {})
		};
		// Store initial state to compare for changes
		lastSavedData = JSON.stringify({ techRider, sfxRider, soundcheck });
		lastEventId = eventKey;
	}

	// Force re-initialization whenever event changes
	$: {
		if (event?.event_id && event.artist_name) {
			const eventKey = `${event.event_id}-${event.artist_name}`;
			if (eventKey !== lastEventId || !techRider || !sfxRider || !soundcheck) {
				initializeData();
			}
		}
	}

	// Generate plain text for clipboard
	$: techRiderCopyText = (() => {
		if (!techRider) return '';

		let text = 'Tech Rider Confirmed:\n';

		// Mixer
		if (techRider.selected_mixer) {
			text += `- 1x ${techRider.selected_mixer}\n`;
		}

		// Equipment
		for (const key in techRider.equipment) {
			const item = techRider.equipment[key];
			if (item.selected) {
				text += `- ${item.qty}x ${key}\n`;
			}
		}

		// Other Requests (integrated directly)
		techRider.other.forEach((req) => {
			if (req.text.trim()) {
				text += `- ${req.text}\n`;
			}
		});

		return text;
	})();
	$: sfxRiderCopyText = (() => {
		if (!sfxRider || (event && event.event_venue !== 'New City Gas')) return '';

		const sfxRequests = [];
		if (sfxRider.cryo_jets.enabled) {
			const durationText =
				sfxRider.cryo_jets.duration === 0 ? 'Empty Tanks' : `${sfxRider.cryo_jets.duration}sec`;
			sfxRequests.push(`- ${sfxRider.cryo_jets.qty}x Cryo Jets (CO2) - ${durationText}`);
		}
		if (sfxRider.sparkulars.enabled) {
			const durationText =
				sfxRider.sparkulars.duration === 0
					? 'Empty Reservoirs'
					: `${sfxRider.sparkulars.duration}sec`;
			sfxRequests.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${durationText}`);
		}
		if (sfxRider.lasers.enabled) {
			sfxRequests.push(`- ${sfxRider.lasers.qty}x Lasers`);
		}

		if (sfxRequests.length === 0 && sfxRider.other.length === 0) {
			return '';
		}

		let text = 'SFX:\n';
		text += sfxRequests.join('\n');

		// Other SFX Requests
		if (sfxRider.other.length > 0) {
			if (sfxRequests.length > 0) {
				text += '\n';
			}
			text += '- Other:\n';
			sfxRider.other.forEach((req) => {
				text += `  - ${req.text}\n`;
			});
		}

		return text;
	})();
	$: fullCopyText = `${techRiderCopyText}\n${sfxRiderCopyText}`.trim();
	// Generate HTML for clipboard
	$: techRiderHtml = (() => {
		if (!techRider) return '';

		let html = '<strong><u>Tech Rider Confirmed:</u></strong><br>';

		if (techRider.selected_mixer) {
			html += `- 1x ${techRider.selected_mixer}<br>`;
		}

		for (const key in techRider.equipment) {
			const item = techRider.equipment[key];
			if (item.selected) {
				html += `- ${item.qty}x ${key}<br>`;
			}
		}

		// Other Requests (integrated directly)
		techRider.other.forEach((req) => {
			if (req.text.trim()) {
				html += `- ${req.text}<br>`;
			}
		});

		return html;
	})();
	$: sfxRiderHtml = (() => {
		if (!sfxRider || (event && event.event_venue !== 'New City Gas')) return '';

		const sfxRequestsHtml = [];
		if (sfxRider.cryo_jets.enabled) {
			const durationText =
				sfxRider.cryo_jets.duration === 0 ? 'Empty Tanks' : `${sfxRider.cryo_jets.duration}sec`;
			sfxRequestsHtml.push(`- ${sfxRider.cryo_jets.qty}x Cryo Jets (CO2) - ${durationText}`);
		}
		if (sfxRider.sparkulars.enabled) {
			const durationText =
				sfxRider.sparkulars.duration === 0
					? 'Empty Reservoirs'
					: `${sfxRider.sparkulars.duration}sec`;
			sfxRequestsHtml.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${durationText}`);
		}
		if (sfxRider.lasers.enabled) {
			sfxRequestsHtml.push(`- ${sfxRider.lasers.qty}x Lasers`);
		}

		// Other SFX Requests (integrated directly)
		sfxRider.other.forEach((req) => {
			if (req.text.trim()) {
				sfxRequestsHtml.push(`- ${req.text}`);
			}
		});

		if (sfxRequestsHtml.length === 0) {
			return '';
		}

		let html = '<strong><u>SFX:</u></strong><br>';
		html += sfxRequestsHtml.join('<br>');

		return html;
	})();
	$: fullCopyHtml = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${techRiderHtml}<br>${sfxRiderHtml}</div>`;
	// --- FUNCTIONS ---
	function parseJson(data: any): any {
		if (!data) return null;
		if (typeof data === 'object') return data;
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch (e) {
				console.warn('Failed to parse JSON:', e);
				return null;
			}
		}
		return null;
	}

	async function saveChanges() {
		if (!event?.event_id || !event.artist_name || !techRider || !sfxRider || !soundcheck) {
			console.warn('Missing required data for saving');
			return;
		}

		const currentData = JSON.stringify({ techRider, sfxRider, soundcheck });
		if (currentData === lastSavedData) {
			console.log('No changes to save');
			return;
		}

		saving = true;
		try {
			const { error } = await supabase
				.from('events_advance')
				.update({ tech_rider: techRider, sfx_rider: sfxRider, soundcheck: soundcheck })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);
			if (error) {
				console.error('❌ Failed to save production details:', error);
			} else {
				lastSavedData = currentData;
				dispatch('datachanged');
			}
		} catch (err) {
			console.error('❌ Unexpected error saving:', err);
		} finally {
			saving = false;
		}
	}

	function scheduleAutoSave() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(saveChanges, 2000);
	}

	// Manual save function for immediate actions
	async function handleImmediateChange() {
		if (debounceTimer) clearTimeout(debounceTimer);
		await saveChanges();
	}

	// Generic function to adjust quantity
	function adjustQty(map: any, key: string, amount: number) {
		const item = map[key];
		if (item?.qty !== undefined) {
			item.qty = Math.max(1, item.qty + amount);
			// Trigger reactivity for the specific map
			if (map === techRider.equipment) techRider = { ...techRider };
			else if (map === sfxRider) sfxRider = { ...sfxRider };
			scheduleAutoSave();
		}
	}

	function adjustDuration(sfxItemKey: keyof Omit<SfxRider, 'other'>, amount: number) {
		const item = sfxRider?.[sfxItemKey];
		if (item?.duration !== undefined) {
			const newDuration = item.duration + amount;
			if (newDuration < 30) {
				item.duration = 0;
			} else {
				item.duration = newDuration;
			}
			sfxRider = { ...sfxRider };
			scheduleAutoSave();
		}
	}

	function toggleSoundcheck() {
		if (soundcheck) {
			soundcheck.enabled = !soundcheck.enabled;
			soundcheck = { ...soundcheck };
			scheduleAutoSave();
		}
	}

	function updateSoundcheckTime(field: 'start_time' | 'end_time', time: string) {
		if (soundcheck) {
			soundcheck[field] = time;
			soundcheck = { ...soundcheck };
			scheduleAutoSave();
		}
	}

	function toggleEquipment(itemName: keyof typeof defaultTechRider.equipment) {
		const item = techRider?.equipment?.[itemName];
		if (item) {
			item.selected = !item.selected;
			techRider = { ...techRider };
			scheduleAutoSave();
		}
	}

	function toggleSfx(sfxKey: keyof Omit<SfxRider, 'other'>) {
		if (sfxRider) {
			sfxRider[sfxKey].enabled = !sfxRider[sfxKey].enabled;
			sfxRider = { ...sfxRider };
			scheduleAutoSave();
		}
	}

	function selectMixer(mixer: string) {
		if (techRider) {
			techRider.selected_mixer = mixer;
			techRider = { ...techRider };
			scheduleAutoSave();
		}
	}

	function addOtherRequest(type: 'tech' | 'sfx') {
		const newItem: OtherRequest = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			text: ''
		};
		if (type === 'tech' && techRider) {
			techRider.other = [...techRider.other, newItem];
			techRider = { ...techRider };
		} else if (type === 'sfx' && sfxRider) {
			sfxRider.other = [...sfxRider.other, newItem];
			sfxRider = { ...sfxRider };
		}
	}

	function removeOtherRequest(id: string, type: 'tech' | 'sfx') {
		if (type === 'tech' && techRider) {
			techRider.other = techRider.other.filter((item) => item.id !== id);
			techRider = { ...techRider };
		} else if (type === 'sfx' && sfxRider) {
			sfxRider.other = sfxRider.other.filter((item: OtherRequest) => item.id !== id);
			sfxRider = { ...sfxRider };
		}
		scheduleAutoSave();
	}

	function updateOtherText(id: string, text: string, type: 'tech' | 'sfx') {
		const rider = type === 'tech' ? techRider : sfxRider;
		if (rider) {
			const item = rider.other.find((i) => i.id === id);
			if (item) {
				item.text = text;
				if (type === 'tech') techRider = { ...techRider };
				else sfxRider = { ...sfxRider };
				scheduleAutoSave();
			}
		}
	}

	async function handleCopyClick(e: MouseEvent) {
		e.stopPropagation();
		if (justCopied || !navigator.clipboard?.write) return;

		try {
			const htmlBlob = new Blob([fullCopyHtml], { type: 'text/html' });
			const textBlob = new Blob([fullCopyText], { type: 'text/plain' });
			const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
			await navigator.clipboard.write([clipboardItem]);

			justCopied = true;
			popupMessage = 'Copied to clipboard!';
			showPopup = true;
			setTimeout(() => {
				justCopied = false;
				showPopup = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			if (techRider && sfxRider && soundcheck) {
				saveChanges();
			}
		}
	});
</script>

<PopupNotification bind:show={showPopup} message={popupMessage} variant="navbar" iconType="success" />

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300"
	style="width: 400px; height: 420px;"
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Production</h2>
		<div class="flex items-center gap-2">
			{#if saving}
				<div class="flex-shrink-0">
					<div class="text-xs text-gray3 animate-pulse">Saving...</div>
				</div>
			{/if}
			{#if techRider && sfxRider && soundcheck}
				<button
					on:click={handleCopyClick}
					class="p-2 text-gray2 hover:text-black rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
					class:hover:bg-lime={!justCopied}
					class:bg-lime={justCopied}
					class:text-black={justCopied}
					aria-label="Copy production details"
					title={justCopied ? 'Copied!' : 'Copy production details'}
				>
					{#if justCopied}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if techRider && sfxRider && soundcheck}
		<div class="px-6 py-2 h-full space-y-3 text-sm overflow-y-auto pr-3">
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<span class="font-semibold text-gray-200 text-sm">Soundcheck</span>
						<button
							type="button"
							class="rounded-xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2"
							class:bg-lime={soundcheck.enabled}
							class:text-black={soundcheck.enabled}
							class:font-bold={soundcheck.enabled}
							class:bg-gray1={!soundcheck.enabled}
							class:text-gray3={!soundcheck.enabled}
							on:click={toggleSoundcheck}
							disabled={saving}
						>
							{soundcheck.enabled ? 'Yes' : 'No'}
						</button>
					</div>
					{#if soundcheck.enabled}
						<div class="flex items-center gap-1 text-xs">
							<input
								type="time"
								bind:value={soundcheck.start_time}
								on:change={scheduleAutoSave}
								class="bg-gray1 text-gray-300 rounded-lg hover:cursor-pointer focus:cursor-pointer px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-lime"
							/>
							<span class="text-gray-400">-</span>
							<input
								type="time"
								bind:value={soundcheck.end_time}
								on:change={scheduleAutoSave}
								class="bg-gray1 text-gray-300 rounded-lg hover:cursor-pointer focus:cursor-pointer px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-lime"
							/>
						</div>
					{/if}
				</div>

				<h3 class="font-semibold text-gray-200 text-sm">Tech Rider</h3>

				<div class="grid grid-cols-3 gap-2">
					{#each ['DJM-A9', 'DJM-V10', 'DJM-900-NXS2'] as mixer}
						<button
							type="button"
							on:click={() => selectMixer(mixer)}
							class="flex items-center justify-center text-xs px-2 py-1 rounded-lg cursor-pointer border border-transparent transition-all {techRider.selected_mixer === mixer
								? 'bg-lime text-black font-bold'
								: 'bg-gray1 text-gray3 hover:border-lime'}"
						>
							{mixer}
						</button>
					{/each}
				</div>

				<div class="space-y-2">
					{#each [['CDJ-3000', 'RMX-1000', 'Laptop Stand'], ['Wireless Mic', 'Wired Mic']] as row}
						<div class="flex gap-2">
							{#each row as name}
								{@const details = techRider.equipment[name]}
								{#if details}
									<div
										class="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg border border-transparent transition-all flex-grow cursor-pointer {details.selected
											? 'bg-lime text-black font-bold'
											: 'bg-gray1 text-gray3 hover:border-lime'}"
									>
										<button
											type="button"
											on:click={() => toggleEquipment(name)}
											class="flex-grow text-left cursor-pointer"
										>
											{name}
										</button>
										{#if details.selected && details.editableQty}
											<div class="flex items-center gap-1 ml-2">
												<button
													type="button"
													on:click|stopPropagation={() => adjustQty(techRider.equipment, name, -1)}
													class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
												>
													-
												</button>
												<span class="font-mono w-4 text-center text-black">{details.qty}</span>
												<button
													type="button"
													on:click|stopPropagation={() => adjustQty(techRider.equipment, name, 1)}
													class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
												>
													+
												</button>
											</div>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>

				<div class="space-y-1.5">
					{#each techRider.other as item (item.id)}
						<div class="flex items-center gap-2">
							<input
								type="text"
								placeholder="Enter request..."
								class="w-full bg-gray1 p-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-lime"
								bind:value={item.text}
								on:input={() => updateOtherText(item.id, item.text, 'tech')}
							/>
							<button
								type="button"
								class="flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer"
								aria-label="Remove request"
								on:click={() => removeOtherRequest(item.id, 'tech')}
							>
								<svg
									class="w-3.5 h-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M3 6h18" />
									<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
									<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
									<line x1="10" y1="11" x2="10" y2="17" />
									<line x1="14" y1="11" x2="14" y2="17" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
				<button
					type="button"
					on:click={() => addOtherRequest('tech')}
					class="w-full text-xs bg-gray1 text-gray3 border border-transparent hover:border-lime py-1 rounded-lg transition-all cursor-pointer"
				>
					+ Add Other Request
				</button>
			</div>

			<div class="space-y-1.5 pt-1">
				<h3 class="font-semibold text-gray-200 text-sm">SFX</h3>
				{#if event && event.event_venue === 'New City Gas'}
					<div class="grid grid-cols-3 gap-2 items-start">
						{#each sfxItems as [key, name]}
							{@const item = sfxRider[key]}
							{#if item}
								<div class="flex flex-col gap-1">
									<button
										type="button"
										on:click={() => toggleSfx(key)}
										class="flex items-center justify-center text-xs px-3 py-1 rounded-lg hover:cursor-pointer border border-transparent transition-all {item.enabled
											? 'bg-lime text-black font-bold'
											: 'bg-gray1 text-gray3 hover:border-lime'}"
									>
										<span>{name}</span>
									</button>
									{#if item.enabled && item.duration !== undefined}
										<div
											class="flex items-center justify-center gap-1 text-xs bg-gray1 rounded-lg p-1"
										>
											<button
												type="button"
												on:click={() => adjustDuration(key, -30)}
												class="bg-navbar w-5 h-5 rounded hover:bg-gray-700 transition-colors text-white cursor-pointer"
											>
												-
											</button>
											<span class="font-mono w-10 text-center text-gray-300">
												{item.duration === 0 ? 'Empty' : `${item.duration}s`}
											</span>
											<button
												type="button"
												on:click={() => adjustDuration(key, 30)}
												class="bg-navbar w-5 h-5 rounded hover:bg-gray-700 transition-colors text-white cursor-pointer"
											>
												+
											</button>
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					<div class="space-y-1.5">
						{#each sfxRider.other as item (item.id)}
							<div class="flex items-center gap-2">
								<input
									type="text"
									placeholder="Enter SFX request..."
									class="w-full bg-gray1 p-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-lime"
									bind:value={item.text}
									on:input={() => updateOtherText(item.id, item.text, 'sfx')}
								/>
								<button
									type="button"
									class="flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer"
									aria-label="Remove SFX request"
									on:click={() => removeOtherRequest(item.id, 'sfx')}
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M3 6h18" />
										<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
										<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
										<line x1="10" y1="11" x2="10" y2="17" />
										<line x1="14" y1="11" x2="14" y2="17" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
					<button
						type="button"
						on:click={() => addOtherRequest('sfx')}
						class="w-full text-xs bg-gray1 text-gray3 border border-transparent hover:border-lime py-1 rounded-lg transition-all cursor-pointer"
					>
						+ Add Other SFX
					</button>
				{:else}
					<div class="flex items-center justify-center py-4 text-gray3 text-sm">
						No SFX possible for this show
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex items-center justify-center h-full text-gray3">Loading...</div>
	{/if}
</div>

<style lang="postcss">
	@tailwind base;
	@tailwind components;
	@tailwind utilities;
</style>