<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { EventAdvance } from '$lib/services/eventsService';

	export let advances: EventAdvance[] = [];
	export let selectedAdvance: EventAdvance | null = null;
	export let loading = false;
	export let isOpen = true;

	const dispatch = createEventDispatcher();
	let searchTerm = '';
	let viewMode: 'LIVE' | 'PAST' = 'LIVE';

	// 🔑 NEW: Watch for realtime updates on the selectedAdvance and patch the main array
	// so the sidebar instantly reflects the W8/W9 name change
	$: if (selectedAdvance) {
		const index = advances.findIndex((a) => a.id === selectedAdvance?.id);
		if (index !== -1 && advances[index] !== selectedAdvance) {
			advances[index] = selectedAdvance;
			advances = [...advances];
		}
	}

	$: filteredAdvances = advances
		.filter((adv) => {
			if (adv.artist_type === 'Local') return false;
			const isLive = adv.event_status === 'LIVE' || !adv.event_status;
			return viewMode === 'LIVE' ? isLive : !isLive;
		})
		.filter((adv) => {
			if (!searchTerm) return true;
			const term = searchTerm.toLowerCase();

			return (
				adv.artist_name.toLowerCase().includes(term) ||
				adv.event_name?.toLowerCase().includes(term) ||
				adv.event_id.toString().includes(term)
			);
		})
		.sort((a, b) => {
			const timeA = a.event_date ? new Date(a.event_date).getTime() : 0;
			const timeB = b.event_date ? new Date(b.event_date).getTime() : 0;
			return viewMode === 'LIVE' ? timeA - timeB : timeB - timeA;
		});

	function selectAdvance(adv: EventAdvance) {
		selectedAdvance = adv;
		dispatch('select', adv);
	}

	function triggerEdit(adv: EventAdvance, event: MouseEvent) {
		event.stopPropagation();
		dispatch('edit', adv);
	}

	// Add this helper function anywhere in your script tag
	function getStatusColor(status: string) {
		switch (status) {
			case 'To Do':
				return 'text-problem'; // Red
			case 'In Progress':
				return 'text-proposed'; // Orange
			case 'Done':
				return 'text-confirmed'; // Green
			case 'Approved':
				return 'text-confirmed'; // Green
			default:
				return 'text-problem';
		}
	}

	// 🔑 Updated Helper to parse contract statuses
	function getContractStats(adv: any) {
		// Check root `adv` object for the folder ID
		const folderId = adv.gdrive_folder_id || adv.gdriveFolderId;
		const hasFolder = !!folderId;

		// Check root `adv` object for contract URLs
		const c1 = adv.original_contract_url || adv.originalContractUrl;
		const c2 = adv.redlined_contract_url || adv.redlinedContractUrl;
		const c3 = adv.signed_contract_url || adv.signedContractUrl;
		const contractCount = [c1, c2, c3].filter((url) => url && url.trim() !== '').length;

		const contractStatus = adv.contract_status || 'To Do';
		const hasAtLeastOneDoc = contractCount > 0;

		// 🔑 NEW: Evaluate Bypass status
		const bypass = adv.bypass === true;
		let bypassName = null;

		if (bypass && contractCount === 1) {
			if (c3 && c3.trim() !== '') bypassName = 'Signed';
			else if (c2 && c2.trim() !== '') bypassName = 'Marked-up';
			else if (c1 && c1.trim() !== '') bypassName = 'Original';
		}

		// Check root `adv` object for Invoice and W8/9 URLs
		const invUrl = adv.invoice_url || adv.invoiceUrl;
		const hasInvoice = !!(invUrl && invUrl.trim() !== '');

		const w89Url = adv.w89_url || adv.w89Url;
		const hasW89 = !!(w89Url && w89Url.trim() !== '');

		// Extract wType safely
		const wType = adv.w_type || adv.wType || 'W8/9';

		return {
			hasFolder,
			contractCount,
			hasInvoice,
			hasW89,
			wType,
			bypassName,
			contractStatus,
			hasAtLeastOneDoc
		};
	}
</script>

<div
	class="w-full flex flex-col h-full bg-navbar border border-gray1 rounded-xl overflow-hidden transition-all duration-300"
>
	<div class="p-2 border-b border-gray1 space-y-2 bg-navbar sticky top-0 z-10">
		<div class="flex gap-1 bg-black/30 p-1 rounded-3xl cursor-pointer">
			<button
				class="flex-1 font-bold cursor-pointer rounded-3xl transition-all {viewMode === 'LIVE'
					? 'bg-lime text-black shadow-sm'
					: 'text-gray2 hover:text-white'} {isOpen ? 'text-xs py-1.5' : 'text-[10px] py-1'}"
				on:click={() => (viewMode = 'LIVE')}
				title="LIVE"
			>
				{isOpen ? 'LIVE' : 'L'}
			</button>
			<button
				class="flex-1 font-bold cursor-pointer rounded-3xl transition-all {viewMode === 'PAST'
					? 'bg-lime text-black shadow-sm'
					: 'text-gray2 hover:text-white'} {isOpen ? 'text-xs py-1.5' : 'text-[10px] py-1'}"
				on:click={() => (viewMode = 'PAST')}
				title="PAST"
			>
				{isOpen ? 'PAST' : 'P'}
			</button>
		</div>

		{#if isOpen}
			<div class="animate-in fade-in slide-in-from-top-2 duration-300">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Search artists, events, or IDs"
					class="w-full bg-black/20 text-white rounded-3xl px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition-all"
				/>
			</div>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto overflow-x-hidden">
		{#if loading}
			<div class="p-8 flex justify-center">
				<div
					class="animate-spin w-5 h-5 border-2 border-lime border-t-transparent rounded-full"
				></div>
			</div>
		{:else if filteredAdvances.length > 0}
			<div class="flex flex-col">
				{#each filteredAdvances as adv (adv.id)}
					{@const isSelected = selectedAdvance?.id === adv.id}

					<div
						role="button"
						tabindex="0"
						on:click={() => selectAdvance(adv)}
						on:keydown={(e) => e.key === 'Enter' && selectAdvance(adv)}
						class="group relative w-full text-left hover:bg-gray1 transition-all duration-200 flex items-center border-b border-gray1 last:border-b-0 cursor-pointer
							{isSelected ? 'bg-gray1/50 border-l-4 border-l-lime' : 'border-l-4 border-l-transparent'} 
							{isOpen ? 'p-3 gap-3' : 'p-2 justify-center px-0'}"
						title={!isOpen ? adv.artist_name : ''}
					>
						<div
							class="relative bg-black rounded flex-shrink-0 overflow-hidden aspect-square border border-gray1/50 transition-all duration-300 {isOpen
								? 'w-12 h-12'
								: 'w-10 h-10'}"
						>
							{#if adv.poster}
								<img src={adv.poster} alt={adv.event_name} class="w-full h-full object-cover" />
							{:else}
								<div class="w-full h-full bg-gray1 flex items-center justify-center">
									<svg
										class="w-5 h-5 text-gray2"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<rect x="3" y="3" width="18" height="18" rx="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</svg>
								</div>
							{/if}
						</div>

						{#if isOpen}
							<div class="flex-1 min-w-0 pr-2 space-y-0.5 animate-in fade-in duration-300">
								<div
									class="text-white text-sm font-bold truncate group-hover:text-lime transition-colors"
								>
									{adv.artist_name}
								</div>
								<div class="text-gray2 text-[11px] truncate">
									{adv.date}
								</div>
								<div class="text-gray3 text-[10px] font-mono truncate">
									ID: {adv.event_id === -1 ? 'N/A' : adv.event_id}
								</div>
							</div>

							{@const stats = getContractStats(adv)}
							<div
								class="flex flex-col items-end pr-1 justify-center min-w-max animate-in fade-in duration-300 space-y-[3px]"
							>
								{#if !stats.hasFolder}
									<div class="text-problem/80 text-[10px] font-bold">No Folder</div>
								{:else}
									{#if stats.bypassName}
										<div
											class="text-[10px] font-semibold font-mono {stats.bypassName === 'Signed'
												? 'text-confirmed'
												: stats.bypassName === 'Marked-up'
													? 'text-proposed'
													: 'text-gray3'}"
										>
											{stats.bypassName}
										</div>
									{:else}
										<div
											class="text-[10px] font-semibold font-mono {stats.contractCount === 3
												? 'text-confirmed'
												: stats.contractCount === 0
													? 'text-problem'
													: 'text-proposed'}"
										>
											Contract {stats.contractCount}/3
										</div>
									{/if}

									{#if stats.hasAtLeastOneDoc}
										<div class="flex items-center justify-end gap-1">
											<span class="line-through text-[9px] text-red-500">Redline:</span>
											<span class="text-[9px] font-bold {getStatusColor(stats.contractStatus)}">
												{stats.contractStatus}
											</span>
										</div>
									{/if}

									<div
										class="text-[9px] font-medium {stats.hasInvoice
											? 'text-confirmed'
											: 'text-problem'}"
									>
										Invoice: {stats.hasInvoice ? 'YES' : 'NO'}
									</div>

									<div
										class="text-[9px] font-medium {stats.hasW89
											? 'text-confirmed'
											: 'text-problem'}"
									>
										{stats.wType}: {stats.hasW89 ? 'YES' : 'NO'}
									</div>
								{/if}
							</div>

							<div
								class="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<button
									type="button"
									aria-label="Edit contract advance"
									class="p-1.5 text-gray1 rounded hover:text-black cursor-pointer transition-colors bg-lime group-hover:bg-lime shadow-sm"
									on:click|stopPropagation={(e) => triggerEdit(adv, e)}
								>
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
									</svg>
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="p-6 text-center text-gray2 text-xs italic">
				{#if isOpen}
					{searchTerm
						? 'No matching advances found.'
						: `No ${viewMode.toLowerCase()} advances available.`}
				{:else}
					No data.
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	::-webkit-scrollbar {
		width: 6px;
	}
	::-webkit-scrollbar-track {
		background: var(--color-navbar);
	}
	::-webkit-scrollbar-thumb {
		background: var(--color-gray1);
		border-radius: 3px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: var(--color-gray2);
	}
</style>
