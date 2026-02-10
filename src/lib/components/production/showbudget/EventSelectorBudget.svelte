<script lang="ts">
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import BudgetAddModal from './BudgetAddModal.svelte';
	import BudgetEditModal from './BudgetEditModal.svelte';
	import { portal } from '$lib/utils/portalUtils';

	const dispatch = createEventDispatcher();
	// This list now holds records from 'show_budget' combined with 'event_flyer' and 'event_date'
	let budgetEvents: any[] = [];
	let loading = true;
	let searchTerm = '';
	let selectedBudgetId: number | null = null;
	let isAddModalOpen = false;
	// For Edit Modal
	let isEditModalOpen = false;
	let eventToEdit: any = null;

	onMount(async () => {
		await loadBudgetEvents();
	});

	async function loadBudgetEvents() {
		loading = true;
		try {
			// 1. Fetch all records from show_budget (including event_date for custom events)
			const { data: budgetData, error: budgetError } = await supabase
				.from('show_budget')
				.select('*'); // Select * to get event_date column

			if (budgetError) throw budgetError;

			// 2. Fetch event flyers AND DATES from the 'events' table
			const { data: eventsData, error: eventsError } = await supabase
				.from('events')
				.select('event_id, event_flyer, event_date');

			if (eventsError) throw eventsError;

			// Create a map for quick lookup of event details (flyer and date)
			const eventMap = new Map(eventsData.map((event) => [event.event_id, event]));

			// 3. Combine budget data with flyer data and date
			const combinedEvents = (budgetData || []).map((budgetEvent) => {
				const linkedEvent = budgetEvent.event_id ? eventMap.get(budgetEvent.event_id) : null;

				// Calculate sum of all income columns
				const totalIncome =
					(Number(budgetEvent.income_artist) || 0) +
					(Number(budgetEvent.income_technical) || 0) +
					(Number(budgetEvent.income_hospitality) || 0) +
					(Number(budgetEvent.income_other) || 0);

				// RESOLVE DATE: Use linked event date if available, otherwise use custom date
				const finalDate = linkedEvent?.event_date || budgetEvent.event_date;

				return {
					...budgetEvent,
					// Store the calculated total
					calculated_total: totalIncome,
					event_flyer: linkedEvent ? linkedEvent.event_flyer : null,
					event_date: finalDate // Unified date property
				};
			});

			// 4. SORT: Most recent/upcoming to oldest (Descending)
			budgetEvents = combinedEvents.sort((a, b) => {
				const dateA = new Date(a.event_date || 0).getTime();
				const dateB = new Date(b.event_date || 0).getTime();
				return dateB - dateA;
			});

		} catch (error) {
			console.error('Error loading budget events:', error);
			budgetEvents = [];
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		if (!dateString) return 'No Date';
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return dateString;
		}
	}

	function handleSelectEvent(event: any) {
		selectedBudgetId = event.id;
		dispatch('select', event); // Dispatch the full budget record
	}

	// --- ADD MODAL ---
	function handleAdded() {
		isAddModalOpen = false;
		loadBudgetEvents(); // Reload the list
	}

	// --- EDIT MODAL ---
	function openEditModal(event: any) {
		eventToEdit = event;
		isEditModalOpen = true;
	}

	function handleSave() {
		isEditModalOpen = false;
		loadBudgetEvents(); // Reload the list to show changes
	}

	function handleDelete() {
		isEditModalOpen = false;
		// If the deleted event was the selected one, clear the details panel
		if (selectedBudgetId === eventToEdit?.id) {
			dispatch('select', null);
		}
		loadBudgetEvents();
		// Reload the list
	}

	$: filteredEvents = budgetEvents.filter((event) => {
		const matchesSearch =
			event.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			event.event_id?.toString().includes(searchTerm);
		return matchesSearch;
	});
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold mb-2">Budget Events</h3>
		<div class="flex items-center gap-2 mb-2">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search budget events..."
				class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
			/>
			<button
				type="button"
				on:click={() => (isAddModalOpen = true)}
				class="flex-shrink-0 bg-lime text-black rounded-lg p-2 hover:cursor-pointer hover:bg-lime/90 transition-colors"
				aria-label="Add Budget Event"
			>
				<svg
					class="w-4 h-4"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="3"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scroll">
		{#if loading}
			<div class="space-y-2">
				{#each Array(6) as _}
					<div class="animate-pulse h-20 bg-gray1 rounded-lg"></div>
				{/each}
			</div>
		{:else if filteredEvents.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg
					class="w-12 h-12 text-gray2 mb-2"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="15" y1="9" x2="9" y2="15"></line>
					<line x1="9" y1="9" x2="15" y2="15"></line>
				</svg>
				<p class="text-gray2 text-xs">
					{searchTerm ? 'No events found' : 'No budget events created.'}
				</p>
			</div>
		{:else}
			{#each filteredEvents as event (event.id)}
				<div class="w-full text-left transition-all">
					<div
						class="flex items-center gap-3 p-2 bg-gray1 rounded-lg border-2
						{selectedBudgetId === event.id ? 'border-lime' : 'border-transparent'}
						hover:border-lime/50"
					>
						<button
							class="w-14 h-20 rounded overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer bg-navbar"
							on:click={() => handleSelectEvent(event)}
						>
							{#if event.event_flyer}
								<img
									src={event.event_flyer}
									alt={event.event_name}
									class="w-full h-full object-cover"
									draggable="false"
								/>
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-lime/40 to-gray2/20 flex items-center justify-center">
									<svg class="w-6 h-6 text-lime opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
									</svg>
								</div>
							{/if}
						</button>

						<button
							class="flex-1 min-w-0 text-left cursor-pointer"
							on:click={() => handleSelectEvent(event)}
						>
							<p class="text-xs font-bold text-white truncate">{event.event_name}</p>

							<p class="text-[10px] text-lime font-medium">
								{formatDate(event.event_date)}
							</p>

							{#if event.event_id}
								<p class="text-[10px] text-gray3">Event ID: {event.event_id}</p>
							{:else}
								<p class="text-[10px] text-gray3">Custom Entry</p>
							{/if}

							<div class="mt-1">
								<div class="flex items-center gap-1">
									<span class="text-[10px] text-gray2 font-medium">
										Budget:
										<span class="text-lime">
											${Number(event.calculated_total || 0).toFixed(2)}
										</span>
									</span>
								</div>
							</div>
						</button>

						<button
							type="button"
							on:click={() => openEditModal(event)}
							class="flex-shrink-0 p-2 text-gray2 hover:text-white rounded-full hover:bg-gray2/20 transition-colors"
							aria-label="Edit budget entry"
						>
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="1"></circle>
								<circle cx="19" cy="12" r="1"></circle>
								<circle cx="5" cy="12" r="1"></circle>
							</svg>
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<div use:portal>
	<BudgetAddModal
		bind:isOpen={isAddModalOpen}
		on:success={handleAdded}
		on:close={() => (isAddModalOpen = false)}
	/>
</div>

<div use:portal>
	<BudgetEditModal
		bind:isOpen={isEditModalOpen}
		bind:event={eventToEdit}
		on:save={handleSave}
		on:delete={handleDelete}
		on:close={() => (isEditModalOpen = false)}
	/>
</div>

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}
</style>