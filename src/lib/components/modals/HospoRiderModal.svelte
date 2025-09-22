<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import type { EventAdvance, HospoRiderInfo, OtherRequest } from '$lib/types/events.js';
	import { updateEventAdvance } from '$lib/services/eventsService.js';

	export let isOpen = false;
	export let event: EventAdvance | null = null;
	const dispatch = createEventDispatcher();
	let isSubmitting = false;

	// Define available items for easy configuration
	const spiritOptions = [
		'Patron Reposado', 'Grey Goose', 'Moet Chandon', 
        'Patron Silver', 'Bombay Sapphire', 'Dom Perignon', 
        'Patron El Alto', 'Jameson Whiskey', 'Cava',
        'Patron El Cielo', 'Fireball'
		
	];
	const beerOptions = ['Corona', 'Stella', 'Bud Light', 'Corona 0%'];
	const otherDrinkOptions = [
		 'Red Bull Regular', 'Evian Water', 'Ginger Beer',
         'Red Bull Sugar Free', 'Sparkling Water', 'Whiteclaw',
         'Red Bull Watermelon', 'Perrier' , 'Seltzer',
         'Red Bull Apricot', 'Tonic',  'Soda'
	];
	const juiceOptions = ['Pineapple Juice', 'Cranberry Juice', 'Orange Juice', 'Apple Juice'];
	// Define a consistent type for all selectable items, including custom ones.
	type Item = {
		selected: boolean;
		qty: number;
		isCustom?: boolean;
		name?: string;
	};
	// Define the type for the hospo_rider data structure
	type HospoData = {
		spirits: { [key: string]: Item };
		beers_wine: {
			beers: { [key: string]: Item };
			wine: { [key: string]: Item };
			juice: { [key: string]: Item };
		};
		other_drinks: { [key: string]: Item };
		base: {
			regular_drinks: boolean;
			regular_snacks: boolean;
		};
		custom_requests: OtherRequest[];
		custom_rider_text?: string;
	};
	// Helper function to create default item data
	const createDefaultItemData = (options: string[]): { [key: string]: Item } => {
		return options.reduce((acc, item) => {
			acc[item] = { selected: false, qty: 1 };
			return acc;
		}, {} as { [key: string]: Item });
	};

	const defaultHospoData: HospoData = {
		spirits: createDefaultItemData(spiritOptions),
		beers_wine: {
			beers: createDefaultItemData(beerOptions),
			wine: {},
			juice: createDefaultItemData(juiceOptions)
		},
		other_drinks: createDefaultItemData(otherDrinkOptions),
		base: {
			regular_drinks: true,
			regular_snacks: true
		},
		custom_requests: [],
		custom_rider_text: ''
	};
	let hospoData: HospoData = JSON.parse(JSON.stringify(defaultHospoData));

	// Helper to identify and flag custom items when loading from the DB
	const augmentWithCustomFlag = (items: { [key: string]: Item } = {}, options: string[] = []) => {
		const newItems: { [key: string]: Item } = {};
		for (const [key, itemData] of Object.entries(items)) {
			if (options.includes(key)) {
				newItems[key] = itemData;
				// Predefined item
			} else {
				// Custom item from DB
				newItems[key] = {
					...itemData,
					isCustom: true,
					name: key // The name in the input is the key from the DB
				};
			}
		}
		return newItems;
	};

	$: if (event) {
		try {
			const existingData = typeof event.hospo_rider === 'string'
				? JSON.parse(event.hospo_rider)
				: event.hospo_rider;
			if (existingData) {
				// Augment loaded data to correctly identify custom items before merging
				const augmentedSpirits = augmentWithCustomFlag(existingData.spirits, spiritOptions);
				const augmentedBeers = augmentWithCustomFlag(existingData.beers_wine?.beers, beerOptions);
				const augmentedOtherDrinks = augmentWithCustomFlag(existingData.other_drinks, otherDrinkOptions);
				const augmentedWine = augmentWithCustomFlag(existingData.beers_wine?.wine);
				const augmentedJuice = augmentWithCustomFlag(existingData.beers_wine?.juice, juiceOptions);
				// All wine entries are custom

				// Merge with defaults to ensure all fields exist and are of the correct type
				const mergedData = {
					...defaultHospoData,
					...existingData,
					spirits: { ...defaultHospoData.spirits, ...augmentedSpirits },
					beers_wine: {
						beers: { ...defaultHospoData.beers_wine.beers, ...augmentedBeers },
						wine: { ...defaultHospoData.beers_wine.wine, ...augmentedWine },
						juice: { ...defaultHospoData.beers_wine.juice, ...augmentedJuice }
					},
					other_drinks: { ...defaultHospoData.other_drinks, ...augmentedOtherDrinks },
					base: { ...defaultHospoData.base, ...(existingData.base || {}) },
					custom_requests: existingData.custom_requests || []
				};
				hospoData = mergedData;
			} else {
				hospoData = JSON.parse(JSON.stringify(defaultHospoData));
			}
		} catch (e) {
			console.error('Error parsing hospo_rider:', e);
			hospoData = JSON.parse(JSON.stringify(defaultHospoData));
		}
	}

	function toggleItem(category: 'spirits' | 'beers' | 'other_drinks' | 'juice', item: string) {
		if (category === 'beers') {
			hospoData.beers_wine.beers[item].selected = !hospoData.beers_wine.beers[item].selected;
		} else if (category === 'juice') {
			hospoData.beers_wine.juice[item].selected = !hospoData.beers_wine.juice[item].selected;
		} else {
			hospoData[category][item].selected = !hospoData[category][item].selected;
		}
		// Svelte reactivity fix
		hospoData = { ...hospoData };
	}

	function adjustQty(
		category: 'spirits' | 'beers' | 'other_drinks' | 'wine' | 'juice',
		item: string,
		delta: number
	) {
		if (category === 'beers') {
			const current = hospoData.beers_wine.beers[item];
			current.qty = Math.max(1, (current.qty || 1) + delta);
		} else if (category === 'wine') {
			const current = hospoData.beers_wine.wine[item];
			current.qty = Math.max(1, (current.qty || 1) + delta);
		} else if (category === 'juice') {
			const current = hospoData.beers_wine.juice[item];
			current.qty = Math.max(1, (current.qty || 1) + delta);
		} else {
			const current = hospoData[category][item];
			current.qty = Math.max(1, (current.qty || 1) + delta);
		}
		// Svelte reactivity fix
		hospoData = { ...hospoData };
	}

	function removeCustomItem(
		category: 'spirits' | 'beers' | 'other_drinks' | 'wine' | 'juice',
		key: string
	) {
		if (category === 'beers') {
			delete hospoData.beers_wine.beers[key];
		} else if (category === 'wine') {
			delete hospoData.beers_wine.wine[key];
		} else if (category === 'juice') {
			delete hospoData.beers_wine.juice[key];
		} else {
			delete hospoData[category][key];
		}
		hospoData = { ...hospoData };
	}

	function addSpiritOther() {
		const id = `custom-${Date.now()}`;
		hospoData.spirits[id] = { selected: true, qty: 1, isCustom: true, name: '' };
		hospoData = { ...hospoData };
	}

	function addBeerOther() {
		const id = `custom-${Date.now()}`;
		hospoData.beers_wine.beers[id] = { selected: true, qty: 1, isCustom: true, name: '' };
		hospoData = { ...hospoData };
	}

	function addJuiceOther() {
		const id = `custom-${Date.now()}`;
		hospoData.beers_wine.juice[id] = { selected: true, qty: 1, isCustom: true, name: '' };
		hospoData = { ...hospoData };
	}

	function addDrinkOther() {
		const id = `custom-${Date.now()}`;
		hospoData.other_drinks[id] = { selected: true, qty: 1, isCustom: true, name: '' };
		hospoData = { ...hospoData };
	}

	function addWine() {
		if (Object.keys(hospoData.beers_wine.wine).length === 0) {
			const id = `custom-${Date.now()}`;
			hospoData.beers_wine.wine[id] = { selected: true, qty: 1, isCustom: true, name: '' };
			hospoData = { ...hospoData };
		}
	}

	function addCustomRequestItem() {
		const id = `custom-${Date.now()}`;
		hospoData.custom_requests.push({ id, text: '' });
		hospoData = { ...hospoData };
	}

	function removeCustomRequest(id: string) {
		hospoData.custom_requests = hospoData.custom_requests.filter(req => req.id !== id);
		hospoData = { ...hospoData };
	}

	function updateCustomRequestText(id: string, text: string) {
		const request = hospoData.custom_requests.find(req => req.id === id);
		if (request) {
			request.text = text;
			hospoData = { ...hospoData };
		}
	}

	async function handleSave() {
		if (!event) return;
		isSubmitting = true;
		try {
			// Deep copy the data to avoid modifying the original state
			const cleanedData = JSON.parse(JSON.stringify(hospoData));
			// Helper to process and clean up items
			const processItems = (items: { [key: string]: Item }) => {
				const newItems: any = {};
				for (const [key, item] of Object.entries(items)) {
					const hospoItem = item as Item;
					// When saving a custom item, use its name as the new key
					if (hospoItem.isCustom && hospoItem.name) {
						newItems[hospoItem.name] = { selected: true, qty: hospoItem.qty };
					} else if (!hospoItem.isCustom) {
						newItems[key] = hospoItem;
					}
				}
				return newItems;
			};

			cleanedData.spirits = processItems(cleanedData.spirits);
			cleanedData.beers_wine.beers = processItems(cleanedData.beers_wine.beers);
			cleanedData.beers_wine.wine = processItems(cleanedData.beers_wine.wine);
			cleanedData.beers_wine.juice = processItems(cleanedData.beers_wine.juice);
			cleanedData.other_drinks = processItems(cleanedData.other_drinks);
			
			// Process custom requests
			const newCustomRequests: OtherRequest[] = [];
			cleanedData.custom_requests.forEach((req: OtherRequest & { isCustomItem?: boolean }) => {
				if (req.text) {
					newCustomRequests.push(req);
				}
			});
			cleanedData.custom_requests = newCustomRequests;


			const updates = {
				hospo_rider: JSON.stringify(cleanedData)
			};
			await updateEventAdvance(event.event_id, event.artist_name, updates);
			dispatch('save_success', { updates });
			closeModal();
		} catch (error) {
			console.error('Error saving hospitality rider:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}
</script>

<Modal
	bind:isOpen
	title="Hospitality Rider - {event?.artist_name || 'Event'}"
	maxWidth="max-w-4xl"
	hasFooter={true}
	on:close={closeModal}
>
	{#if event}
		<div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
			<div>
				<h3 class="font-semibold text-white mb-3">Base Items</h3>
				<div class="flex gap-3">
					<button
						type="button"
						on:click={() => { hospoData.base.regular_drinks = !hospoData.base.regular_drinks;
						hospoData = { ...hospoData }; }}
						class="px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border {hospoData.base.regular_drinks ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
					>
						Regular Drinks
					</button>
					<button
						type="button"
						on:click={() => { hospoData.base.regular_snacks = !hospoData.base.regular_snacks;
						hospoData = { ...hospoData }; }}
						class="px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border {hospoData.base.regular_snacks ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
					>
						Regular Snacks
					</button>
				</div>
			</div>

			<div>
				<h3 class="font-semibold text-white mb-3">Spirits</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each Object.entries(hospoData.spirits) as [key, item]}
						{#if !item.isCustom}
							<div class="flex items-center gap-1">
								<button
									type="button"
									on:click={() => toggleItem('spirits', key)}
									class="flex-grow px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border {item.selected ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
								>
									{key}
								</button>
								{#if item.selected}
									<div class="flex items-center gap-1">
										<button
											type="button"
											on:click={() => adjustQty('spirits', key, -1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											-
										</button>
										<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
										<button
											type="button"
											on:click={() => adjustQty('spirits', key, 1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											+
										</button>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center gap-1">
								<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
									<input
										type="text"
										placeholder="Custom..."
										class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
										bind:value={item.name}
									/>
									<button
										type="button"
										on:click={() => removeCustomItem('spirits', key)}
										class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
										aria-label="Remove custom spirit"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										on:click={() => adjustQty('spirits', key, -1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										-
									</button>
									<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
									<button
										type="button"
										on:click={() => adjustQty('spirits', key, 1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										+
									</button>
								</div>
							</div>
						{/if}
					{/each}
					<button
						type="button"
						on:click={addSpiritOther}
						class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
					>
						+ Add Other
					</button>
				</div>
			</div>

			<div>
				<h3 class="font-semibold text-white mb-3">Beers & Wine</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each Object.entries(hospoData.beers_wine.beers) as [key, item]}
						{#if !item.isCustom}
							<div class="flex items-center gap-1">
								<button
									type="button"
									on:click={() => toggleItem('beers', key)}
									class="flex-grow px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border {item.selected ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
								>
									{key}
								</button>
								{#if item.selected}
									<div class="flex items-center gap-1">
										<button
											type="button"
											on:click={() => adjustQty('beers', key, -1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											-
										</button>
										<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
										<button
											type="button"
											on:click={() => adjustQty('beers', key, 1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											+
										</button>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center gap-1">
								<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
									<input
										type="text"
										placeholder="Custom..."
										class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
										bind:value={item.name}
									/>
									<button
										type="button"
										on:click={() => removeCustomItem('beers', key)}
										class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
										aria-label="Remove custom beer"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										on:click={() => adjustQty('beers', key, -1)}
										class="bg-navbar w-5 h-5 rounded text-white 
										flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										-
									</button>
									<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
									<button
										type="button"
										on:click={() => adjustQty('beers', key, 1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										+
									</button>
								</div>
							</div>
						{/if}
					{/each}

					{#each Object.entries(hospoData.beers_wine.wine) as [key, item]}
						<div class="flex items-center gap-1">
							<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
								<input
									type="text"
									placeholder="Enter wine preference..."
									class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
									bind:value={item.name}
								/>
								<button
									type="button"
									on:click={() => removeCustomItem('wine', key)}
									class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
									aria-label="Remove custom wine"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							<div class="flex items-center gap-1">
								<button
									type="button"
									on:click={() => adjustQty('wine', key, -1)}
									class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
								>
									-
								</button>
								<span class="font-mono 
 w-4 text-center text-gray-300 text-xs">{item.qty ||
									1}</span>
								<button
									type="button"
									on:click={() => adjustQty('wine', key, 1)}
									class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
								>
									+
								</button>
							</div>
						</div>
					{/each}

					<button
						type="button"
						on:click={addBeerOther}
						class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
					>
						+ Add Other Beer
					</button>
					
					{#if Object.keys(hospoData.beers_wine.wine).length === 0}
						<button
							type="button"
							on:click={addWine}
							class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
						>
							+ Add Wine
						</button>
					{/if}
				</div>
			</div>

			<div>
				<h3 class="font-semibold text-white mb-3">Juice</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each Object.entries(hospoData.beers_wine.juice) as [key, item]}
						{#if !item.isCustom}
							<div class="flex items-center gap-1">
								<button
									type="button"
									on:click={() => toggleItem('juice', key)}
									class="flex-grow px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border {item.selected ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
								>
									{key}
								</button>
								{#if item.selected}
									<div class="flex items-center gap-1">
										<button
											type="button"
											on:click={() => adjustQty('juice', key, -1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											-
										</button>
										<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
										<button
											type="button"
											on:click={() => adjustQty('juice', key, 1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											+
										</button>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center gap-1">
								<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
									<input
										type="text"
										placeholder="Custom..."
										class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
										bind:value={item.name}
									/>
									<button
										type="button"
										on:click={() => removeCustomItem('juice', key)}
										class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
										aria-label="Remove custom juice"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										on:click={() => adjustQty('juice', key, -1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										-
									</button>
									<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
									<button
										type="button"
										on:click={() => adjustQty('juice', key, 1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										+
									</button>
								</div>
							</div>
						{/if}
					{/each}

					<button
						type="button"
						on:click={addJuiceOther}
						class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
					>
						+ Add Other
					</button>
				</div>
			</div>

			<div>
				<h3 class="font-semibold text-white mb-3">Other Drinks</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each Object.entries(hospoData.other_drinks) as [key, item]}
						{#if !item.isCustom}
							<div class="flex items-center gap-1">
								<button
									type="button"
									on:click={() => toggleItem('other_drinks', key)}
									class="flex-grow px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border {item.selected ? 'bg-lime text-black font-bold border-lime' : 'bg-gray1 text-gray3 border-gray-600 hover:border-lime'}"
								>
									{key}
								</button>
								{#if item.selected}
									<div class="flex items-center gap-1">
										<button
											type="button"
											on:click={() => adjustQty('other_drinks', key, -1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											-
										</button>
										<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
										<button
											type="button"
											on:click={() => adjustQty('other_drinks', key, 1)}
											class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
										>
											+
										</button>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center gap-1">
								<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
									<input
										type="text"
										placeholder="Custom..."
										class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
										bind:value={item.name}
									/>
									<button
										type="button"
										on:click={() => removeCustomItem('other_drinks', key)}
										class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
										aria-label="Remove custom drink"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										on:click={() => adjustQty('other_drinks', key, -1)}
										class="bg-navbar w-5 h-5 rounded text-white 
										flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										-
									</button>
									<span class="font-mono w-4 text-center text-gray-300 text-xs">{item.qty || 1}</span>
									<button
										type="button"
										on:click={() => adjustQty('other_drinks', key, 1)}
										class="bg-navbar w-5 h-5 rounded text-white flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
									>
										+
									</button>
								</div>
							</div>
						{/if}
					{/each}
					<button
						type="button"
						on:click={addDrinkOther}
						class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
					>
						+ Add Other
					</button>
				</div>
			</div>

			<div>
				<h3 class="font-semibold text-white mb-3">Custom Requests</h3>
				<div class="grid grid-cols-3 gap-2">
					{#each hospoData.custom_requests as request (request.id)}
						<div class="flex items-center gap-1 col-span-1">
							<div class="flex-grow flex items-center bg-lime rounded-lg px-2 py-1 gap-1">
								<input
									type="text"
									placeholder="Enter custom request..."
									class="flex-grow bg-transparent text-black font-bold text-xs placeholder-black/50 focus:outline-none min-w-0"
									bind:value={request.text}
									on:input={() => updateCustomRequestText(request.id, request.text)}
								/>
								<button
									type="button"
									on:click={() => removeCustomRequest(request.id)}
									class="text-black hover:text-red-600 cursor-pointer flex-shrink-0"
									aria-label="Remove custom request"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
										<path d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					{/each}
					<button
						type="button"
						on:click={addCustomRequestItem}
						class="px-3 py-1.5 rounded-lg text-xs bg-gray1 text-gray3 border border-gray-600 hover:border-lime transition-colors cursor-pointer"
					>
						+ Add Other
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div slot="footer" class="flex gap-2 justify-end 
	pt-4">
		<button
			class="px-4 py-2 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer text-sm"
			on:click={closeModal}
		>
			Cancel
		</button>
		<button
			class="px-4 py-2 rounded-full transition-colors cursor-pointer text-sm bg-lime text-black hover:opacity-90"
			disabled={isSubmitting}
			on:click={handleSave}
		>
			{isSubmitting ? 'Saving...' : 'Save Changes'}
		</button>
	</div>
</Modal>