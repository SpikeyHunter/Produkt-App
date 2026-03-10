<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let selectedArtist: {
		name: string;
		id?: string | number;
		picture?: string;
		isCustom?: boolean;
	} | null = null;
	export let placeholder = 'Search for an artist';

	const fallbackIcon =
		'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png';

	const dispatch = createEventDispatcher();

	let searchQuery = '';
	let results: any[] = [];
	let isLoading = false;
	let isOpen = false;
	let debounceTimer: ReturnType<typeof setTimeout>;

	const searchCache = new Map<string, any[]>();

	async function searchArtist(query: string) {
		const trimmedQuery = query.trim().toLowerCase();

		if (!trimmedQuery) {
			results = [];
			return;
		}

		if (searchCache.has(trimmedQuery)) {
			results = searchCache.get(trimmedQuery)!;
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(trimmedQuery)}&limit=6`);
			if (res.ok) {
				const data = await res.json();
				results = data.data;
				searchCache.set(trimmedQuery, results);
			}
		} catch (error) {
			console.error('Artist search failed:', error);
		} finally {
			isLoading = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		isOpen = true;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchArtist(searchQuery);
		}, 150);
	}

	function selectArtist(artist: any) {
		// 🚀 THE UPGRADE: Map to the highest quality image available
		selectedArtist = {
			name: artist.name,
			id: artist.id,
			picture:
				artist.picture_xl ||
				artist.picture_big ||
				artist.picture_medium ||
				artist.picture ||
				fallbackIcon,
			isCustom: false
		};
		searchQuery = '';
		isOpen = false;
		dispatch('select', { artist: selectedArtist });
	}

	function selectCustom() {
		selectedArtist = {
			name: searchQuery,
			isCustom: true,
			picture: fallbackIcon
		};
		searchQuery = '';
		isOpen = false;
		dispatch('select', { artist: selectedArtist });
	}

	// 🚀 THE UPGRADE: Function to remove the selected artist and go back to searching
	function clearSelection() {
		selectedArtist = null;
		searchQuery = '';
		dispatch('clear');
	}

	function editSelection() {
		if (selectedArtist) {
			searchQuery = selectedArtist.name; // Keep the name in the search bar
			selectedArtist = null; // Remove the locked selection
			isOpen = true; // Open the dropdown
			dispatch('clear'); // Tell the parent component we are editing
		}
	}

	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
				isOpen = false;
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}
</script>

<div class="relative w-full" use:clickOutside>
	{#if selectedArtist}
		<div
			class="w-full bg-black/40 border border-gray2/20 rounded-2xl p-1.5 pl-2 flex items-center justify-between transition-all cursor-pointer hover:border-gray2/50"
			on:click={editSelection}
			on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); editSelection(); }}
			role="button"
			tabindex="0"
		>
			<div class="flex items-center gap-3">
				<img
					src={selectedArtist.picture}
					alt={selectedArtist.name}
					class="w-8 h-8 rounded-full object-cover bg-black"
					loading="lazy"
				/>
				<div class="flex-1 truncate font-bold text-white text-sm">{selectedArtist.name}</div>
			</div>
			<button
				type="button"
				class="w-8 h-8 flex items-center justify-center text-gray2 hover:text-problem cursor-pointer transition-colors rounded-full hover:bg-problem/10 z-10"
				on:click|stopPropagation={clearSelection}
				aria-label="Remove artist"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
					></line></svg>
			</button>
		</div>
		{:else}
		<input
			type="text"
			bind:value={searchQuery}
			on:input={handleInput}
			on:focus={() => (isOpen = true)}
			{placeholder}
			class="w-full bg-navbar border-transparent text-sm rounded-2xl pl-3 pr-10 py-2.5 text-white placeholder:text-gray2/50 focus:outline-none focus:ring-2 focus:ring-lime transition-all"
		/>

		{#if isLoading}
			<div
				class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray2 border-t-lime rounded-full animate-spin"
			></div>
		{:else if searchQuery.length > 0}
			<button
				type="button"
				class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-gray2 hover:text-problem cursor-pointer transition-colors rounded-full hover:bg-problem/10 z-10"
				on:click={() => {
					searchQuery = '';
					isOpen = false;
				}}
				aria-label="Clear search"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
					></line></svg>
			</button>
		{/if}
	{/if}

	{#if isOpen && searchQuery.length > 0 && !selectedArtist}
		<div
			class="absolute z-50 w-full mt-2 bg-gray1 border border-navbar rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto flex flex-col"
		>
			<button
				type="button"
				class="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-lime/10 hover:text-lime transition-colors cursor-pointer bg-black/20 border-b border-navbar/50"
				on:click={selectCustom}
			>
				<img
					src={fallbackIcon}
					alt="Custom Artist"
					class="w-10 h-10 rounded-full object-cover bg-black"
					loading="lazy"
				/>
				<div class="flex-1 truncate">
					<span class="block text-xs text-gray2 font-normal">Use custom artist:</span>
					<span class="font-bold">"{searchQuery}"</span>
				</div>
			</button>

			{#each results as artist}
				<button
					type="button"
					class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-lime/10 hover:text-lime transition-colors cursor-pointer border-b border-navbar/50 last:border-0"
					on:click={() => selectArtist(artist)}
				>
					<img
						src={artist.picture_xl || artist.picture_big || artist.picture_small || fallbackIcon}
						alt={artist.name}
						class="w-10 h-10 rounded-full object-cover bg-black"
						loading="lazy"
					/>
					<div class="flex-1 truncate font-bold">{artist.name}</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
