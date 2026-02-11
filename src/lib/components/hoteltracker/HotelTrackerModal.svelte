<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import DatePickerCompact from '$lib/components/buttons/DatePickerCompact.svelte';

	export let isOpen = false;
	export let editData: any = null;

	const dispatch = createEventDispatcher();

	// --- Types ---
	interface HotelConfigItem {
		selected: boolean;
		customHotelName: string; 
		rooms: { [key: string]: number };
		customNames: { [key: string]: string };
	}

	interface HotelConfig {
		[key: string]: HotelConfigItem;
	}

	// --- Constants ---
	const HOTEL_OPTIONS: { [key: string]: string[] } = {
		'Alt Hotel': ['One Queen Bed', 'Two Queen Bed', 'Corner One Queen Bed', 'Other'],
		'Monville': ['Standard Room', 'Deluxe Suite', 'Corner Suite', 'Suite Monville', 'Other'],
		'W Hotel': ['Wonderful King', 'Two Queen Beds', 'Fantastic Suite', 'Wow Suite', 'Other'],
		'Other': ['Room Type 1', 'Room Type 2', 'Room Type 3', 'Room Type 4'] 
	};

	// --- State ---
	let name = '';
	let startDate = '';
	let endDate = '';
	let selectedFlyer = '';
	let isSubmitting = false;
    let confirmDelete = false;

	// Modal States
	let showFlyerModal = false;
	let flyers: any[] = [];
	let loadingFlyers = false;
	const excludeKeywords = ['test', 'réservations', 'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'];

	// Hotel Config State
	let hotelConfig: HotelConfig = {
		'Alt Hotel': { selected: false, customHotelName: '', rooms: {}, customNames: {} },
		'Monville': { selected: false, customHotelName: '', rooms: {}, customNames: {} },
		'W Hotel': { selected: false, customHotelName: '', rooms: {}, customNames: {} },
		'Other': { selected: false, customHotelName: '', rooms: {}, customNames: {} }
	};

	// --- Reactivity ---
    // Watch for changes to isOpen to trigger data loading
	$: if (isOpen) {
        confirmDelete = false; 
		if (editData) {
            // Use a small timeout to ensure DOM is ready or just run immediately
			loadEditData();
		} else {
			resetForm();
		}
	}

    // --- Helper to clear ONLY the hotel configuration ---
    function resetConfig() {
        Object.keys(hotelConfig).forEach(key => {
			hotelConfig[key].selected = false;
			hotelConfig[key].customHotelName = '';
			hotelConfig[key].rooms = {};
			hotelConfig[key].customNames = {};
			HOTEL_OPTIONS[key].forEach(opt => {
				hotelConfig[key].rooms[opt] = 0;
			});
		});
    }

	// --- Form Management ---
	function resetForm() {
		name = '';
		startDate = '';
		endDate = '';
		selectedFlyer = '';
		resetConfig();
	}

	function loadEditData() {
        // 1. Reset the config to clean slate
        resetConfig();

        // 2. Load basic fields from the database object
        // Note: Supabase returns keys in snake_case matching your DB columns
		name = editData.name || '';
		startDate = editData.start_date || '';
		endDate = editData.end_date || '';
		selectedFlyer = editData.flyer_image || '';

        // 3. Hydrate configuration
		if (editData.configuration) {
			editData.configuration.forEach((h: any) => {
				let hotelKey = h.name;
				let isCustomHotel = false;

                // Check if the hotel name from DB matches our hardcoded options
				if (!HOTEL_OPTIONS[hotelKey]) {
					hotelKey = 'Other';
					isCustomHotel = true;
				}

				if (hotelConfig[hotelKey]) {
					hotelConfig[hotelKey].selected = true;
					
					if (isCustomHotel) {
						hotelConfig[hotelKey].customHotelName = h.name;
					}

					h.rooms.forEach((r: any) => {
						if (HOTEL_OPTIONS[hotelKey].includes(r.type)) {
                            // Standard room type
							hotelConfig[hotelKey].rooms[r.type] = r.count;
						} else {
							// Handling custom room names
							if (isCustomHotel) {
                                // For custom hotels, find the first generic slot that corresponds
								const slot = HOTEL_OPTIONS['Other'].find(opt => hotelConfig['Other'].rooms[opt] === 0);
								if (slot) {
									hotelConfig['Other'].rooms[slot] = r.count;
									hotelConfig['Other'].customNames[slot] = r.type;
								}
							} else {
								// Standard hotel, custom room (e.g. "Other" renamed)
								if (HOTEL_OPTIONS[hotelKey].includes('Other')) {
									hotelConfig[hotelKey].rooms['Other'] = r.count;
									hotelConfig[hotelKey].customNames['Other'] = r.type;
								}
							}
						}
					});
				}
			});
		}
	}

	// --- Flyer Logic ---
	async function openFlyerModal() {
		showFlyerModal = true;
		if (flyers.length === 0) {
			loadingFlyers = true;
			const { data, error } = await supabase
				.from('events')
				.select('event_name, event_flyer, event_date')
				.not('event_flyer', 'is', null)
				.order('event_date', { ascending: false });

			if (!error && data) {
				flyers = data.filter(e => {
					const lowerName = e.event_name.toLowerCase();
					return !excludeKeywords.some(k => lowerName.includes(k.toLowerCase()));
				});
			}
			loadingFlyers = false;
		}
	}

	function selectFlyer(url: string) {
		selectedFlyer = url;
		showFlyerModal = false;
	}

	// --- Room Logic ---
	function toggleHotel(hotelName: string) {
		hotelConfig[hotelName].selected = !hotelConfig[hotelName].selected;
		hotelConfig = { ...hotelConfig };
	}

	function updateRoomCount(hotel: string, type: string, delta: number) {
		const current = hotelConfig[hotel].rooms[type] || 0;
		const newVal = Math.max(0, current + delta);
		hotelConfig[hotel].rooms[type] = newVal;
		hotelConfig = { ...hotelConfig };
	}

    // --- Actions ---
	async function handleDelete() {
		if (!editData || !editData.id) return;
        
        if (!confirmDelete) {
            confirmDelete = true;
            return;
        }

		isSubmitting = true;
		const { error } = await supabase
			.from('hotel_tracker')
			.delete()
			.eq('id', editData.id);

		isSubmitting = false;
		if (error) {
			console.error('Error deleting:', error);
		} else {
			dispatch('success'); 
            dispatch('close');
            dispatch('deleted', editData.id);
		}
	}

	async function handleSubmit() {
		if (!name || !startDate || !endDate) return;
		isSubmitting = true;

		const finalConfiguration = Object.keys(hotelConfig)
			.filter(k => hotelConfig[k].selected)
			.map(k => {
				const activeRooms = Object.entries(hotelConfig[k].rooms)
					.filter(([_, count]) => count > 0)
					.map(([type, count]) => {
						let finalType = type;
						// Handle Custom Names
						const customName = hotelConfig[k].customNames[type];
						if (customName && customName.trim() !== '') {
							finalType = customName.trim();
						}
						return { type: finalType, count };
					});
				
				let finalHotelName = k;
				if (k === 'Other' && hotelConfig[k].customHotelName.trim()) {
					finalHotelName = hotelConfig[k].customHotelName.trim();
				}

				return {
					name: finalHotelName,
					rooms: activeRooms
				};
			})
			.filter(h => h.rooms.length > 0);

		const payload = {
			name,
			start_date: startDate,
			end_date: endDate,
			flyer_image: selectedFlyer,
			configuration: finalConfiguration
		};

		try {
			if (editData) {
				const { error } = await supabase
					.from('hotel_tracker')
					.update(payload)
					.eq('id', editData.id);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('hotel_tracker')
					.insert([payload]);
				if (error) throw error;
			}
			dispatch('success'); 
			closeModal();
		} catch (err) {
			console.error('Error saving:', err);
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
        confirmDelete = false;
	}
</script>

{#if isOpen}
	<div use:portal class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
		<div 
			class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
			in:fade={{ duration: 200 }} 
			out:fade={{ duration: 150 }}
			on:click={closeModal}
			role="button"
            tabindex="-1"
            on:keypress={(e) => e.key === 'Enter' && closeModal()}
		></div>

		<div 
			class="relative bg-navbar border border-gray1 rounded-xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh]"
			in:fly={{ y: 20, duration: 300 }}
			out:fly={{ y: 20, duration: 200 }}
		>
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray1">
				<h2 class="text-xl font-bold text-white">{editData ? "Edit Tracker" : "Create Hotel Tracker"}</h2>
				<button 
					type="button"
					on:click={closeModal}
					class="p-2 text-gray2 hover:text-white rounded-full hover:bg-gray1 transition-colors cursor-pointer"
                    aria-label="Close"
				>
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scroll">
				
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div class="md:col-span-1">
						<label for="evt-name" class="text-lime text-sm font-bold mb-2 block">Event Name</label>
						<input 
							id="evt-name" 
							type="text" 
							bind:value={name} 
							class="w-full bg-[#1A1A1A] border border-gray1 rounded-lg px-4 py-2.5 text-white placeholder-gray2 focus:border-lime focus:ring-1 focus:ring-lime outline-none transition-all" 
							placeholder="e.g. Osheaga 2026" 
						/>
					</div>
					<div class="md:col-span-1">
						<p class="text-lime text-sm font-bold mb-2 block">Start Date</p>
						<DatePickerCompact 
							bind:value={startDate} 
							variant="outline" 
							width="w-full"
                            height="h-[46px]"
							placeholder="Select Start Date"
						/>
					</div>
					<div class="md:col-span-1">
						<p class="text-lime text-sm font-bold mb-2 block">End Date</p>
						<DatePickerCompact 
							bind:value={endDate} 
							variant="outline" 
							width="w-full"
                            height="h-[46px]"
							placeholder="Select End Date"
						/>
					</div>
				</div>

				<div>
					<h3 class="text-lime text-sm font-bold mb-4">Hotel Selection & Room Configuration</h3>
					
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
						{#each Object.entries(HOTEL_OPTIONS) as [hotelName, options]}
							{@const isActive = hotelConfig[hotelName].selected}
							<div class="flex flex-col gap-2">
								<button 
									type="button"
									class="w-full py-3 px-4 rounded-lg font-bold text-left transition-all border cursor-pointer
									{isActive 
										? 'bg-lime text-black border-lime' 
										: 'bg-[#1A1A1A] text-gray2 border-gray1 hover:border-lime hover:text-white'}"
									on:click={() => toggleHotel(hotelName)}
								>
									<div class="flex items-center justify-between">
										<span>{hotelName}</span>
										{#if isActive}
											<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
										{/if}
									</div>
								</button>

								{#if isActive}
									<div class="bg-gray1/20 border border-gray1 rounded-lg p-3 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
										
										{#if hotelName === 'Other'}
											<div class="mb-3">
												<label for="custom-hotel-{hotelName}" class="text-[10px] uppercase text-lime font-bold mb-1 block">Custom Hotel Name</label>
												<input 
                                                    id="custom-hotel-{hotelName}"
													type="text"
													bind:value={hotelConfig[hotelName].customHotelName}
													placeholder="Enter Hotel Name..."
													class="w-full bg-[#1A1A1A] border border-gray1 rounded px-2 py-1.5 text-xs text-white focus:border-lime outline-none"
												/>
											</div>
										{/if}

										{#each options as roomType}
											{@const count = hotelConfig[hotelName].rooms[roomType] || 0}
											<div class="bg-[#1A1A1A] rounded border border-gray1/50 p-2 flex flex-col gap-2">
												<div class="flex items-center justify-between">
													{#if hotelName === 'Other'}
														<input 
															type="text"
															bind:value={hotelConfig[hotelName].customNames[roomType]}
															placeholder={roomType}
															class="text-xs text-white font-medium bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-32 placeholder-gray3"
                                                            aria-label="Custom room name"
														/>
													{:else}
														<span class="text-xs text-gray3 font-medium truncate pr-2" title={roomType}>{roomType}</span>
													{/if}

													<div class="flex items-center gap-1 bg-gray1 rounded p-0.5">
														<button 
															type="button"
															class="w-6 h-6 rounded flex items-center justify-center text-gray2 hover:bg-lime hover:text-black transition-colors cursor-pointer"
															on:click={() => updateRoomCount(hotelName, roomType, -1)}
                                                            aria-label="Decrease count"
														>-</button>
														<span class="w-6 text-center text-white text-xs font-mono">{count}</span>
														<button 
															type="button"
															class="w-6 h-6 rounded flex items-center justify-center text-gray2 hover:bg-lime hover:text-black transition-colors cursor-pointer"
															on:click={() => updateRoomCount(hotelName, roomType, 1)}
                                                            aria-label="Increase count"
														>+</button>
													</div>
												</div>

												{#if hotelName !== 'Other' && (roomType === 'Other' || roomType === 'Custom') && count > 0}
													<input 
														type="text" 
														placeholder="Enter room name..."
														class="w-full bg-black/30 border border-gray1/50 rounded px-2 py-1 text-[10px] text-white focus:border-lime outline-none placeholder-gray2/50"
														bind:value={hotelConfig[hotelName].customNames[roomType]}
													/>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div class="border-t border-gray1 pt-6">
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-lime text-sm font-bold">Flyer Attribution</h3>
							<p class="text-gray2 text-xs mt-1">Select a flyer to associate with this tracker.</p>
						</div>
						
						{#if !selectedFlyer}
							<button 
								type="button"
								class="px-4 py-2 border border-lime text-lime rounded-full hover:bg-lime hover:text-black transition-all cursor-pointer text-sm font-bold flex items-center gap-2"
								on:click={openFlyerModal}
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>
								Add Flyer
							</button>
						{/if}
					</div>

					{#if selectedFlyer}
						<div class="flex items-start gap-4 animate-in fade-in">
							<div class="relative group w-32 aspect-[2/3] rounded-lg overflow-hidden border-2 border-lime">
								<img src={selectedFlyer} alt="Selected Flyer" class="w-full h-full object-cover" />
								<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
									<button 
                                        type="button"
										class="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform cursor-pointer"
										title="Change Flyer"
										on:click={openFlyerModal}
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="M9 18l3-3-3-3"/></svg>
									</button>
									<button 
                                        type="button"
										class="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform cursor-pointer"
										title="Remove"
										on:click={() => selectedFlyer = ''}
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
									</button>
								</div>
							</div>
							<div class="pt-2">
								<p class="text-white text-sm font-bold">Flyer Selected</p>
								<p class="text-gray2 text-xs">Click the image to change or remove.</p>
							</div>
						</div>
					{/if}
				</div>

			</div>

			<div class="p-6 border-t border-gray1 flex justify-between items-center gap-3 bg-navbar rounded-b-xl">
                <div>
                    {#if editData}
                        <button 
                            type="button"
                            class="px-4 py-2.5 font-bold transition-all cursor-pointer flex items-center gap-2 {confirmDelete ? 'text-white bg-red-600 rounded-lg' : 'text-red-500 hover:text-red-400'}"
                            on:click={handleDelete}
                        >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            {confirmDelete ? 'Are you sure?' : 'Delete'}
                        </button>
                    {/if}
                </div>

                <div class="flex gap-3">
                    <button 
                        type="button"
                        class="px-6 py-2.5 text-gray2 font-bold hover:text-white transition-colors cursor-pointer"
                        on:click={closeModal}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        class="px-8 py-2.5 bg-lime text-black rounded-full font-bold hover:bg-lime/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                        on:click={handleSubmit}
                        disabled={isSubmitting || !name || !startDate || !endDate}
                    >
                        {isSubmitting ? 'Saving...' : (editData ? 'Save Changes' : 'Create Tracker')}
                    </button>
                </div>
			</div>
		</div>
	</div>

	{#if showFlyerModal}
		<div use:portal class="fixed inset-0 z-[60] flex items-center justify-center p-4">
			<div 
				class="absolute inset-0 bg-black/50 backdrop-blur-sm"
				on:click={() => showFlyerModal = false}
                role="button"
                tabindex="-1"
                on:keydown={(e) => e.key === 'Escape' && (showFlyerModal = false)}
			></div>
			<div 
				class="relative bg-navbar border border-gray1 rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl pointer-events-auto"
				in:fly={{ y: 20, duration: 200 }}
			>
				<div class="p-4 border-b border-gray1 flex items-center justify-between">
					<h3 class="text-white font-bold text-lg">Select Event Flyer</h3>
					<button 
                        type="button"
						class="px-4 py-1.5 border border-lime text-lime rounded-full text-sm font-bold hover:bg-lime hover:text-black transition-colors cursor-pointer"
						on:click={() => showFlyerModal = false}
					>
						Close
					</button>
				</div>
				
				<div class="flex-1 overflow-y-auto p-4 custom-scroll">
					{#if loadingFlyers}
						<div class="flex items-center justify-center h-64">
							<div class="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
						</div>
					{:else}
						<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
							{#each flyers as flyer}
								<button 
									type="button"
									class="relative group aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-lime transition-all cursor-pointer"
									on:click={() => selectFlyer(flyer.event_flyer)}
								>
									<img src={flyer.event_flyer} alt={flyer.event_name} class="w-full h-full object-cover" />
									<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-8">
										<p class="text-white text-xs font-bold truncate">{flyer.event_name}</p>
									</div>
									{#if selectedFlyer === flyer.event_flyer}
										<div class="absolute inset-0 bg-lime/20 flex items-center justify-center">
											<div class="bg-lime text-black rounded-full p-2">
												<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
											</div>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	.custom-scroll::-webkit-scrollbar { width: 6px; }
	.custom-scroll::-webkit-scrollbar-thumb { background: #e1ff00; border-radius: 3px; }
	.custom-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
</style>