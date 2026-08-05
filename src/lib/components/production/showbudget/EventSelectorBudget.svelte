<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import BudgetAddModal from './BudgetAddModal.svelte';
	import BudgetEditModal from './BudgetEditModal.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import {
		formatDisplay,
		normalizeItems,
		normalizeSubsections,
		itemsBudgetedTotal,
		subsBudgetedTotal,
		incomeTotalFor
	} from '$lib/utils/budgetUtils';

	const dispatch = createEventDispatcher();

	// Live override from the page: the net of the budget currently open in the
	// display. Updates on every keystroke — no need to wait for save + realtime.
	export let liveNetId: number | null = null;
	export let liveNet: number | null = null;
	let budgetEvents: any[] = [];
	let loading = true;
	let searchTerm = '';
	let selectedBudgetId: number | null = null;
	let isAddModalOpen = false;
	let isEditModalOpen = false;
	let eventToEdit: any = null;

	let channel: ReturnType<typeof supabase.channel> | null = null;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		await loadBudgetEvents(true);

		// Live list: any change to show_budget (from this window, another window,
		// or another user) refreshes the cards — totals included.
		channel = supabase
			.channel('show_budget_list')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'show_budget' }, () => {
				if (refreshTimer) clearTimeout(refreshTimer);
				refreshTimer = setTimeout(() => loadBudgetEvents(false), 400);
			})
			.subscribe();
	});

	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
		if (refreshTimer) clearTimeout(refreshTimer);
	});

	function safeParse(input: any) {
		if (typeof input === 'string') {
			try {
				return JSON.parse(input);
			} catch {
				return [];
			}
		}
		return input || [];
	}

	/** Budgeted expenses total of the sheet — the number that actually reflects the budget. */
	function sheetTotal(row: any): number {
		const type = row.budget_type || 'Tour Prod';
		const base =
			subsBudgetedTotal(normalizeSubsections(safeParse(row.expenses_technical))) +
			subsBudgetedTotal(normalizeSubsections(safeParse(row.expenses_hospitality))) +
			subsBudgetedTotal(normalizeSubsections(safeParse(row.expenses_other)));
		if (type === 'Complete Prod') {
			return base + itemsBudgetedTotal(normalizeItems(safeParse(row.expenses_artist_fee)));
		}
		return base;
	}

	/** Net = income − budgeted expenses (same math as the totals panel). */
	function sheetNet(row: any): number {
		return incomeTotalFor(row) - sheetTotal(row);
	}

	// Live values passed as arguments so Svelte re-runs this in the template
	// whenever liveNetId / liveNet change (dependency tracking is per-expression).
	function displayNet(event: any, id: number | null, net: number | null): number {
		if (id !== null && net !== null && event.id === id) return net;
		return event.calculated_net || 0;
	}

	function netColor(net: number): string {
		if (net < 0) return 'text-problem';
		if (net > 0) return 'text-confirmed';
		return 'text-gray2';
	}

	async function loadBudgetEvents(showSpinner = true) {
		if (showSpinner) loading = true;
		try {
			const { data: budgetData, error: budgetError } = await supabase
				.from('show_budget')
				.select('*');
			if (budgetError) throw budgetError;

			const { data: eventsData, error: eventsError } = await supabase
				.from('events')
				.select('event_id, event_flyer, event_date');
			if (eventsError) throw eventsError;

			const eventMap = new Map(eventsData.map((event) => [event.event_id, event]));

			const combinedEvents = (budgetData || []).map((budgetEvent) => {
				const linkedEvent = budgetEvent.event_id ? eventMap.get(budgetEvent.event_id) : null;
				const finalDate = linkedEvent?.event_date || budgetEvent.event_date;
				return {
					...budgetEvent,
					calculated_total: sheetTotal(budgetEvent),
					calculated_net: sheetNet(budgetEvent),
					event_flyer: linkedEvent ? linkedEvent.event_flyer : null,
					event_date: finalDate
				};
			});

			budgetEvents = combinedEvents.sort((a, b) => {
				const dateA = new Date(a.event_date || 0).getTime();
				const dateB = new Date(b.event_date || 0).getTime();
				return dateB - dateA;
			});
		} catch (error) {
			console.error('Error loading budget events:', error);
			if (showSpinner) budgetEvents = [];
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		if (!dateString) return 'No Date';
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return dateString;
		}
	}

	function handleSelectEvent(event: any) {
		selectedBudgetId = event.id;
		dispatch('select', event);
	}

	function handleAdded() {
		isAddModalOpen = false;
		loadBudgetEvents(false);
	}

	function openEditModal(event: any) {
		eventToEdit = event;
		isEditModalOpen = true;
	}

	function handleSave() {
		isEditModalOpen = false;
		loadBudgetEvents(false);
	}

	function handleDelete() {
		isEditModalOpen = false;
		if (selectedBudgetId === eventToEdit?.id) {
			selectedBudgetId = null;
			dispatch('select', null);
		}
		loadBudgetEvents(false);
	}

	$: filteredEvents = budgetEvents.filter((event) => {
		const matchesSearch =
			event.event_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			event.event_id?.toString().includes(searchTerm);
		return matchesSearch;
	});
</script>

<div class="h-full flex flex-col bg-navbar border border-white/[0.07] rounded-xl overflow-hidden">
	<div class="p-2.5 border-b border-gray1 flex-shrink-0">
		<h3 class="text-white text-sm font-bold mb-2">Budget Events</h3>
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search budget events..."
				class="w-full bg-gray1 text-white rounded-lg px-3 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime"
			/>
			<button
				type="button"
				on:click={() => (isAddModalOpen = true)}
				class="flex-shrink-0 bg-lime text-black rounded-lg p-1.5 hover:cursor-pointer hover:bg-lime/90 transition-colors"
				aria-label="Add Budget Event"
			>
				<svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scroll">
		{#if loading}
			<div class="space-y-1.5">
				{#each Array(8) as _}
					<div class="animate-pulse h-12 bg-gray1 rounded-lg"></div>
				{/each}
			</div>
		{:else if filteredEvents.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-10 h-10 text-gray2 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
						class="flex items-center gap-2 p-1.5 bg-gray1 rounded-lg border transition-colors
						{selectedBudgetId === event.id
							? 'border-lime/70 shadow-[0_0_0_1px_rgba(225,255,0,0.25)]'
							: 'border-transparent hover:border-white/15'}"
					>
						<button
							class="w-9 h-12 rounded overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer bg-navbar"
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
									<svg class="w-4 h-4 text-lime opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
									</svg>
								</div>
							{/if}
						</button>

						<button
							class="flex-1 min-w-0 text-left cursor-pointer"
							on:click={() => handleSelectEvent(event)}
						>
							<p class="text-[11px] font-bold text-white truncate leading-tight">{event.event_name}</p>
							<p class="text-[10px] text-lime font-medium leading-tight">
								{formatDate(event.event_date)}
							</p>
							<p class="text-[10px] text-gray2 font-medium leading-tight">
								Net:
								<span class={netColor(displayNet(event, liveNetId, liveNet))}>{formatDisplay(displayNet(event, liveNetId, liveNet))}</span>
							</p>
						</button>

						<button
							type="button"
							on:click={() => openEditModal(event)}
							class="flex-shrink-0 p-1.5 text-gray2 hover:text-white rounded-full hover:bg-gray2/20 transition-colors"
							aria-label="Edit budget entry"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
	.custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
	.custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
	.custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
	.custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
</style>