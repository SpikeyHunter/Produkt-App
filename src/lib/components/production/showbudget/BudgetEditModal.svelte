<!--
  NEW COMPONENT: BudgetEditModal
  - Allows editing event_name (for custom), budget, and notes.
  - Allows linking/unlinking/changing the associated event_id.
  - Allows deleting the show_budget row.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;
	export let event: any = null; // This is the show_budget record
	const dispatch = createEventDispatcher();

	// Form state
	let budgetName = '';
	let linkedEventId: number | null = null;
	let linkedEventName: string | null = null; // Store event name for display
	let isSubmitting = false;
	let showDeleteConfirm = false;

	// Event linking state
	let linkSearchValue = '';
	let showEventDropdown = false;
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];
	let loadingEvents = false;

	// Reset form when modal opens/closes or event changes
	$: if (event && isOpen) {
		resetForm();
		loadAvailableEvents(); // Load potential events
	}

	function resetForm() {
		budgetName = event?.event_name || '';
		linkedEventId = event?.event_id || null;
		linkedEventName = event?.event_id ? event.event_name : null;

		isSubmitting = false;
		showDeleteConfirm = false;
		linkSearchValue = '';
		showEventDropdown = false;
	}

	async function loadAvailableEvents() {
		loadingEvents = true;
		try {
			// 1. Get all event_ids that are *already* linked in show_budget
			//    (excluding the one we are currently editing)
			const { data: budgetData, error: budgetError } = await supabase
				.from('show_budget')
				.select('event_id')
				.not('event_id', 'is', null)
				.not('id', 'eq', event.id); // Exclude self

			if (budgetError) throw budgetError;
			const linkedEventIds = (budgetData || []).map((b) => b.event_id);

			const today = new Date().toISOString().split('T')[0];

			// 2. Fetch LIVE events (today -> future) not in the linked list
			const { data: liveData, error: liveError } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.gte('event_date', today)
				.not('event_id', 'in', `(${linkedEventIds.join(',')})`)
				.order('event_date', { ascending: true });

			if (liveError) throw liveError;

			// 3. Fetch PAST events (recent -> oldest) not in the linked list
			const { data: pastData, error: pastError } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.lt('event_date', today)
				.not('event_id', 'in', `(${linkedEventIds.join(',')})`)
				.order('event_date', { ascending: false });

			if (pastError) throw pastError;

			const allEvents = [...(liveData || []), ...(pastData || [])];

			// 4. Filter out events with excluded keywords
			const excludeKeywords = [
				'test', 'réservations', 'pass', 'event', 'template',
				'produktworld', 'piknic', 'oktoberfest'
			];
			const filteredData = (allEvents || []).filter(
				(event) =>
					!excludeKeywords.some((keyword) => event.event_name.toLowerCase().includes(keyword))
			);

			availableEvents = filteredData;
			filteredEvents = availableEvents;
		} catch (error) {
			console.error('Error loading available events:', error);
		} finally {
			loadingEvents = false;
		}
	}

	function closeModal() {
		dispatch('close');
	}

	async function handleSave() {
		if (!event) return;

		isSubmitting = true;
		try {
			// If it's a custom entry (no event_id), we use the budgetName field.
			// If it's linked, the name is forced to match the event.
			const finalEventName = linkedEventId ? linkedEventName : budgetName;

			const { error } = await supabase
				.from('show_budget')
				.update({
					event_name: finalEventName,
					event_id: linkedEventId
					// Budget and notes are removed from this modal
				})
				.eq('id', event.id);

			if (error) throw error;

			dispatch('save');
			closeModal();
		} catch (error) {
			console.error('Error saving budget:', error);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!event) return;
		isSubmitting = true;
		try {
			const { error } = await supabase.from('show_budget').delete().eq('id', event.id);

			if (error) throw error;

			dispatch('delete');
			closeModal();
		} catch (error) {
			console.error('Error deleting budget:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function confirmDelete() {
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest) {
			if (!(event.target as Element).closest('.dropdown-container')) {
				showEventDropdown = false;
			}
		}
	}

	function handleSelectEvent(eventToLink: any) {
		linkedEventId = eventToLink.event_id;
		linkedEventName = eventToLink.event_name;
		budgetName = eventToLink.event_name; // Sync name
		showEventDropdown = false;
		linkSearchValue = eventToLink.event_name;
	}

	function handleUnlink() {
		linkedEventId = null;
		linkedEventName = null;
		// Keep budgetName as is, but now it's editable
		showEventDropdown = false;
		linkSearchValue = '';
	}

	function formatEventDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			return dateString;
		}
	}

	$: filteredEvents = availableEvents.filter(
		(event) =>
			event.event_name.toLowerCase().includes(linkSearchValue.toLowerCase()) ||
			event.event_id.toString().includes(linkSearchValue)
	);

	$: isFormValid = budgetName.trim().length > 0;
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Edit Budget Entry"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		{#if event}
			<!-- Event Name (Editable only if custom) -->
			<div>
				<p class="font-normal text-lime mb-2">Entry Name</p>
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime
          {linkedEventId ? 'opacity-50 cursor-not-allowed' : ''}"
					placeholder="Enter custom entry name"
					bind:value={budgetName}
					disabled={!!linkedEventId}
				/>
				{#if linkedEventId}
					<p class="text-xs text-gray2 mt-1 ml-1">
						Name is synced from the linked event.
					</p>
				{/if}
			</div>

			<!-- Link Event Section -->
			<div class="dropdown-container relative">
				<div class="flex justify-between items-center mb-2">
					<p class="font-normal text-lime">Linked Event</p>
					{#if linkedEventId}
						<button type="button" on:click={handleUnlink} class="text-xs text-red-500 hover:underline">
							Unlink Event
						</button>
					{/if}
				</div>

				<div class="relative">
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-10"
						placeholder={linkedEventId ? linkedEventName : 'Search to link event...'}
						bind:value={linkSearchValue}
						on:focus={() => (showEventDropdown = true)}
					/>
					<div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
						<button
							type="button"
							class="cursor-pointer"
							aria-label="Toggle dropdown"
							on:click={() => (showEventDropdown = !showEventDropdown)}
						>
							<svg
								class="w-4 h-4 text-lime transition-transform {showEventDropdown
									? 'rotate-180'
									: ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M6 9l6 6 6-6" />
							</svg>
						</button>
					</div>
				</div>

				{#if showEventDropdown}
					<div
						class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto custom-scroll"
					>
						{#if loadingEvents}
							<div class="p-4 text-center text-gray2">Loading events...</div>
						{:else if filteredEvents.length === 0}
							<div class="p-4 text-center text-gray2">No unlinked events found.</div>
						{:else}
							{#each filteredEvents as eventToLink}
								<button
									type="button"
									class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
									on:click={() => handleSelectEvent(eventToLink)}
								>
									<div class="flex items-center gap-3">
										<div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">
											{#if eventToLink.event_flyer}
												<img
													src={eventToLink.event_flyer}
													alt={eventToLink.event_name}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div
													class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"
												>
													<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor">
														<path
															d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
														/>
													</svg>
												</div>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="font-medium truncate">{eventToLink.event_name}</p>
											<p class="text-sm opacity-70">
												{formatEventDate(eventToLink.event_date)} • ID: {eventToLink.event_id}
											</p>
										</div>
									</div>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Budget and Notes have been removed from this modal -->

			<!-- Delete Confirmation -->
			{#if showDeleteConfirm}
				<div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
					<div class="flex items-center gap-2 mb-2">
						<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
					</div>
					<p class="text-red-300 text-sm mb-3">
						Are you sure you want to delete this budget entry? This action cannot be undone.
					</p>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
							on:click={cancelDelete}
						>
							Cancel
						</button>
						<button
							class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
							disabled={isSubmitting}
							on:click={handleDelete}
						>
							{isSubmitting ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-between">
		{#if !showDeleteConfirm}
			<button
				class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
				disabled={isSubmitting}
				on:click={confirmDelete}
			>
				Delete Entry
			</button>
		{:else}
			<div></div>
		{/if}

		<div class="flex gap-3">
			<button
				class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
				on:click={closeModal}
			>
				Cancel
			</button>
			<button
				class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				class:bg-lime={isFormValid && !isSubmitting}
				class:text-black={isFormValid && !isSubmitting}
				class:bg-gray1={!isFormValid || isSubmitting}
				class:text-gray2={!isFormValid || isSubmitting}
				class:hover:bg-lime={isFormValid && !isSubmitting}
				disabled={!isFormValid || isSubmitting || showDeleteConfirm}
				on:click={handleSave}
			>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</div>
</Modal>

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
	/* Removed unused textarea and input[type=number] styles */
</style>