<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import HotelTrackerModal from './HotelTrackerModal.svelte';

	export let selectedId: number | null = null;
	const dispatch = createEventDispatcher();

	let trackers: any[] = [];
	let loading = true;
	let searchTerm = '';
	let isModalOpen = false;
	let editData: any = null;

	onMount(() => {
		const init = async () => {
			await loadTrackers(); // Initial load (shows spinner)
		};
		init();

		const subscription = supabase
			.channel('hotel_tracker_list')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'hotel_tracker' },
				() => {
					loadTrackers(true); // Pass true to update silently (no spinner)
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(subscription);
		};
	});

	// EXPORTED so parent can trigger refresh on grid save
	export async function loadTrackers(silent = false) {
		if (!silent) loading = true;
		// Ensure we select tracker_data to calculate totals
		const { data, error } = await supabase
			.from('hotel_tracker')
			.select('*')
			.order('start_date', { ascending: true });

		if (!error) {
			trackers = data || [];
		}
		// Only turn off loading if we turned it on (keeps UI stable)
		if (!silent) loading = false;
	}

	function handleSelect(item: any) {
		selectedId = item.id;
		dispatch('select', item);
	}

	function openAddModal() {
		editData = null;
		isModalOpen = true;
	}

	function openEditModal(e: Event, item: any) {
		e.stopPropagation();
		editData = item;
		isModalOpen = true;
	}

	function handleTrackerDeleted(id: number) {
		loadTrackers();
		if (selectedId === id) {
			selectedId = null;
			dispatch('select', null); // Clears grid and URL in parent
		}
		isModalOpen = false;
	}

	$: filteredTrackers = trackers.filter((t) =>
		t.name.toLowerCase().includes(searchTerm.toLowerCase())
	);

	function formatDate(date: string) {
		if (!date) return '';
		const d = new Date(date);
		d.setDate(d.getDate() + 1);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// --- NEW: Calculate Totals for Display ---
	function calculateStats(tracker: any) {
		let total = 0;
		const data = tracker.tracker_data || {};

		// Parse nested JSONB data: Date -> Hotel -> RoomType -> RoomIndex -> rate
		Object.values(data).forEach((dateObj: any) => {
			if (!dateObj) return;
			Object.values(dateObj).forEach((hotelObj: any) => {
				if (!hotelObj) return;
				Object.values(hotelObj).forEach((typeObj: any) => {
					if (!typeObj) return;
					Object.values(typeObj).forEach((roomObj: any) => {
						if (roomObj && roomObj.rate) {
							// Remove '$' and commas, parse float
							const val = parseFloat(roomObj.rate.replace(/[^0-9.-]+/g, ''));
							if (!isNaN(val)) total += val;
						}
					});
				});
			});
		});
		// Calculate Days
		const start = new Date(tracker.start_date);
		const end = new Date(tracker.end_date);
		const diffTime = Math.abs(end.getTime() - start.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
		// Inclusive

		const avgPerDay = diffDays > 0 ? total / diffDays : 0;
		return {
			total: total.toLocaleString('en-US', {
				style: 'currency',
				currency: 'USD',
				maximumFractionDigits: 0
			}),
			perDay: avgPerDay.toLocaleString('en-US', {
				style: 'currency',
				currency: 'USD',
				maximumFractionDigits: 0
			})
		};
	}
</script>

<div
	class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden"
>
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold mb-2">Hotel Trackers</h3>
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search an event"
				class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
			/>
			<button
				type="button"
				on:click={openAddModal}
				class="bg-gray3 text-black p-2 rounded-xl hover:bg-lime transition-colors cursor-pointer"
				aria-label="Create new tracker"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 4.5v15m7.5-7.5h-15"
					/></svg
				>
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-2 space-y-2 custom-scroll">
		{#if loading}
			<div class="text-center text-gray2 text-xs py-4">Loading...</div>
		{:else if filteredTrackers.length === 0}
			<div class="text-center text-gray2 text-xs py-4">No trackers found.</div>
		{:else}
			{#each filteredTrackers as item (item.id)}
				{@const stats = calculateStats(item)}
				<div
					class="group relative flex items-center gap-3 p-2 rounded-lg border-2 hover:border-gray2/30 cursor-pointer transition-all {selectedId ===
					item.id
						? 'border-lime bg-gray1/50'
						: 'border-transparent bg-gray1/50'}"
					on:click={() => handleSelect(item)}
					role="button"
					tabindex="0"
					on:keypress={(e) => {
						if (e.key === 'Enter') handleSelect(item);
					}}
				>
					<div class="w-12 h-16 bg-black rounded overflow-hidden flex-shrink-0">
						{#if item.flyer_image}
							<img
								src={item.flyer_image}
								alt={item.name}
								class="w-full h-full object-cover"
							/>
						{:else}
							<div class="w-full h-full flex items-center justify-center bg-gray2/20">
								<svg
									class="w-6 h-6 text-gray2"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1"
										d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
									/></svg
								>
							</div>
						{/if}
					</div>

					<div class="flex-1 min-w-0">
						<p class="text-sm font-bold text-white truncate">{item.name}</p>
						<p class="text-xs text-lime mb-1">
							{formatDate(item.start_date)} - {formatDate(item.end_date)}
						</p>
						<div class="flex items-center gap-2 border-t border-gray2/20 pt-1 mt-1">
							<div class="flex flex-col">
								<span class="text-[10px] text-gray3 uppercase font-bold">Total</span>
								<span class="text-xs text-white font-mono">{stats.total}</span>
							</div>
							<div class="w-px h-6 bg-gray2/20"></div>
							<div class="flex flex-col">
								<span class="text-[10px] text-gray3 uppercase font-bold">Per Day</span>
								<span class="text-xs text-white font-mono">{stats.perDay}</span>
							</div>
						</div>
					</div>

					<div class="absolute right-2 top-2 flex gap-1">
						<button
							type="button"
							class="p-1.5 text-gray2 hover:text-lime bg-navbar rounded-full hover:cursor-pointer"
							on:click={(e) => openEditModal(e, item)}
							aria-label="Edit tracker"
						>
							<svg
								class="w-3 h-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
								/></svg
							>
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<HotelTrackerModal
	bind:isOpen={isModalOpen}
	{editData}
	on:success={() => loadTrackers()}
	on:deleted={(e) => handleTrackerDeleted(e.detail)}
	on:close={() => (isModalOpen = false)}
/>