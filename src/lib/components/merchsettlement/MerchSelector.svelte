<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import MerchModal from './MerchModal.svelte';

	export let selectedId: number | null = null;
	const dispatch = createEventDispatcher();

	let settlements: any[] = [];
	let loading = true;
	let searchTerm = '';
	let isModalOpen = false;
	let editData: any = null;

	onMount(() => {
		loadSettlements();

		const subscription = supabase
			.channel('merch_settlements_list')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'merch_settlements' }, () => {
				loadSettlements(true);
			})
			.subscribe();

		return () => supabase.removeChannel(subscription);
	});

	export async function loadSettlements(silent = false) {
		if (!silent) loading = true;

		// Fetch all records; sorting is handled on the client-side
		const { data, error } = await supabase.from('merch_settlements').select('*');

		if (!error) settlements = data || [];

		if (!silent) loading = false;
	}

	function handleSelect(item: any) {
		selectedId = item.id;
		dispatch('select', item);
	}

	function formatDate(dateString: string) {
		if (!dateString) return '';
		const d = new Date(dateString);
		d.setDate(d.getDate() + 1);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	$: filteredSettlements = settlements
		.filter((s) => {
			// Apply the search term filter
			return s.event_name.toLowerCase().includes(searchTerm.toLowerCase());
		})
		.sort((a, b) => {
			// Sort exclusively descending: Most recent to oldest
			const dateA = new Date(a.event_date).getTime();
			const dateB = new Date(b.event_date).getTime();
			return dateB - dateA;
		});
</script>

<div class="h-full flex flex-col bg-navbar rounded-3xl overflow-hidden">
	<div class="p-4 border-b border-gray2/20 flex-shrink-0">
		<h3 class="text-white text-2xl px-4 mb-4 font-bold">Merch Settlements</h3>

		<div class="flex items-center gap-2 mb-4">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search settlements"
				class="w-full bg-gray1 border-2 border-gray1 text-white rounded-full px-4 py-2 text-xs placeholder-gray2 focus:border-lime transition-all"
			/>
		</div>
		<div class="flex items-center justify-evenly">
			<span class="mr-10 ml-1">Event List</span>
			<button
				type="button"
				on:click={() => {
					editData = null;
					isModalOpen = true;
				}}
				class="flex items-center gap-1.5 bg-gray3 text-black px-3 py-1 rounded-full hover:bg-lime transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
				aria-label="Create new settlement"
			>
				<span>Add Settlement</span>
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
		{#if loading}
			<div class="text-center text-gray2 text-xs py-6">Loading...</div>
		{:else if filteredSettlements.length === 0}
			<div class="text-center text-gray2 text-xs py-6 rounded-2xl m-2">
				No settlements found.
			</div>
		{:else}
			{#each filteredSettlements as item (item.id)}
				<div
					class="w-full text-left group relative flex items-center gap-3 p-2.5 rounded-2xl border hover:border-gray2/50 cursor-pointer transition-all {selectedId === item.id ? 'border-lime border-2 bg-gray1/80' : 'border-transparent bg-gray1/40'}"
					on:click={() => handleSelect(item)}
					role="button"
					tabindex="0"
					on:keydown={(e) => e.key === 'Enter' && handleSelect(item)}
					aria-label="Select settlement for {item.event_name}"
				>
					<div class="w-12 h-16 bg-black rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
						{#if item.event_flyer}
							<img
								src={item.event_flyer}
								alt={item.event_name}
								class="w-full h-full object-cover"
							/>
						{:else}
							<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/10 flex items-center justify-center">
								<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
								</svg>
							</div>
						{/if}
					</div>
					<div class="flex-1 min-w-0 pr-6">
						<p class="text-sm font-bold text-white truncate">{item.event_name}</p>
						<p class="text-xs text-lime mt-1 font-medium">{formatDate(item.event_date)}</p>
					</div>
					<button
						type="button"
						on:click|stopPropagation={() => {
							editData = item;
							isModalOpen = true;
						}}
						class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray2 hover:text-lime hover:bg-navbar rounded-full transition-colors cursor-pointer"
						aria-label="Edit settlement"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>

<MerchModal
	bind:isOpen={isModalOpen}
	{editData}
	on:success={() => loadSettlements()}
	on:deleted={(e) => {
		if (selectedId === e.detail) {
			selectedId = null;
			dispatch('select', null);
		}
		loadSettlements();
	}}
/>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		border-radius: 4px;
	}
</style>