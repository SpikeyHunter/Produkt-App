<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let value = '';
	export let placeholder = 'Search Spotify or type custom artist...';

	const dispatch = createEventDispatcher();

	let searchQuery = value;
	let results: any[] = [];
	let isLoading = false;
	let isOpen = false;
	let debounceTimer: ReturnType<typeof setTimeout>;

	// Sync external value changes
	$: if (value !== searchQuery && !isOpen) {
		searchQuery = value;
	}

	async function searchSpotify(query: string) {
		if (!query.trim()) {
			results = [];
			return;
		}

		isLoading = true;
		try {
			// NOTE: We call an internal API route to keep the Spotify token secure
			const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
			if (res.ok) {
				const data = await res.json();
				results = data.artists.items;
			}
		} catch (error) {
			console.error("Spotify search failed:", error);
		} finally {
			isLoading = false;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		isOpen = true;
		value = searchQuery; // Optimistically bind the custom typed value

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			searchSpotify(searchQuery);
		}, 300); // 300ms debounce
	}

	function selectArtist(artist: any) {
		searchQuery = artist.name;
		value = artist.name;
		isOpen = false;
		dispatch('select', { artist });
	}

	function selectCustom() {
		value = searchQuery;
		isOpen = false;
		dispatch('select', { artist: { name: searchQuery, isCustom: true } });
	}

	// Action to handle clicking outside the dropdown
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
	<input 
		type="text" 
		bind:value={searchQuery}
		on:input={handleInput}
		on:focus={() => isOpen = true}
		{placeholder} 
		class="w-full bg-black border-transparent rounded-3xl px-6 py-3.5 text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition-all"
	/>

	{#if isLoading}
		<div class="absolute right-5 top-4 w-4 h-4 border-2 border-gray2 border-t-lime rounded-full animate-spin"></div>
	{/if}

	{#if isOpen && (searchQuery.length > 0)}
		<div class="absolute z-50 w-full mt-2 bg-gray1 border border-navbar rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto flex flex-col">
			
			{#each results as artist}
				<button 
					class="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-lime/10 hover:text-lime transition-colors cursor-pointer border-b border-navbar/50 last:border-0"
					on:click={() => selectArtist(artist)}
				>
					{#if artist.images && artist.images.length > 0}
						<img src={artist.images[artist.images.length - 1].url} alt={artist.name} class="w-10 h-10 rounded-full object-cover bg-black" />
					{:else}
						<div class="w-10 h-10 rounded-full bg-black flex items-center justify-center text-gray2 text-xs">?</div>
					{/if}
					<div class="flex-1 truncate font-bold">{artist.name}</div>
				</button>
			{/each}

			{#if !isLoading}
				<button 
					class="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-lime/10 hover:text-lime transition-colors cursor-pointer bg-black/20"
					on:click={selectCustom}
				>
					<div class="w-10 h-10 rounded-full bg-black border border-dashed border-gray2 flex items-center justify-center text-lime font-bold">+</div>
					<div class="flex-1 truncate">
						<span class="block text-xs text-gray2 font-normal">Use custom artist:</span>
						<span class="font-bold">"{searchQuery}"</span>
					</div>
				</button>
			{/if}
		</div>
	{/if}
</div>