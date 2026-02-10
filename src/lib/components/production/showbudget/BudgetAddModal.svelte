<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;
	const dispatch = createEventDispatcher();

	// Event selection
	let searchValue = '';
	let showEventDropdown = false;
	let selectedEvent: any = null;
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];
	let addedEventIds: Set<number> = new Set();

	// Form state
	let isSubmitting = false;
	let isCustomEvent = false;

	$: if (isOpen) {
		loadEvents();
		resetForm();
	}

	$: if (searchValue && !isCustomEvent) {
		filteredEvents = availableEvents.filter(
			(event) =>
				event.event_name.toLowerCase().includes(searchValue.toLowerCase()) ||
				event.event_id.toString().includes(searchValue)
		);
	} else {
		filteredEvents = availableEvents;
	}

	async function loadEvents() {
		try {
			const { data: budgets, error: budgetError } = await supabase
				.from('show_budget')
				.select('event_id')
				.not('event_id', 'is', null);

			if (budgetError) console.error('Error loading existing budgets:', budgetError);

			if (budgets) {
				addedEventIds = new Set(budgets.map((b) => b.event_id));
			}

			const today = new Date().toISOString().split('T')[0];
			// Fetch LIVE events
			const { data: liveData, error: liveError } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.gte('event_date', today)
				.order('event_date', { ascending: true });

			if (liveError) throw liveError;

			// Fetch PAST events
			const { data: pastData, error: pastError } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.lt('event_date', today)
				.order('event_date', { ascending: false });

			if (pastError) throw pastError;

			const allEvents = [...(liveData || []), ...(pastData || [])];

			const excludeKeywords = [
				'test',
				'réservations',
				'pass',
				'event',
				'template',
				'produktworld',
				'piknic',
				'oktoberfest'
			];

			const filteredData = (allEvents || []).filter(
				(event) =>
					!excludeKeywords.some((keyword) => event.event_name.toLowerCase().includes(keyword))
			);

			availableEvents = filteredData.map((event) => ({
				...event,
				isAdded: addedEventIds.has(event.event_id)
			}));
		} catch (error) {
			console.error('Error loading events:', error);
		}
	}

	function resetForm() {
		searchValue = '';
		selectedEvent = null;
		isCustomEvent = false;
		showEventDropdown = false;
		isSubmitting = false;
	}

	function selectEvent(event: any) {
		selectedEvent = event;
		searchValue = event.event_name;
		showEventDropdown = false;
		isCustomEvent = false;
	}

	function selectCustomEvent() {
		selectedEvent = null;
		isCustomEvent = true;
		showEventDropdown = false;
		searchValue = '';
	}

	function closeModal() {
		dispatch('close');
		resetForm();
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

	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest) {
			if (!(event.target as Element).closest('.dropdown-container')) {
				showEventDropdown = false;
			}
		}
	}

	async function handleSubmit() {
		if (!isFormValid || isSubmitting) return;

		isSubmitting = true;

		try {
			// SCHEMA MATCHING:
			// Initialize all required columns to prevent NOT NULL errors.
			const baseData = {
				expenses_artist_fee: [],
				expenses_technical: [],
				expenses_hospitality: [],
				expenses_other: [],
				income_artist: 0,
				income_technical: 0,
				income_hospitality: 0,
				income_other: 0,
				income_total_budget: 0,
				budget_type: 'Complete Prod' // Updated from 'draft'
			};

			let insertData: any = {};

			if (isCustomEvent) {
				insertData = {
					...baseData,
					event_name: searchValue.trim(),
					event_id: null
				};
			} else if (selectedEvent) {
				insertData = {
					...baseData,
					event_id: selectedEvent.event_id,
					event_name: selectedEvent.event_name
				};
			}

			const { data, error: insertError } = await supabase
				.from('show_budget')
				.insert([insertData])
				.select();

			if (insertError) {
				console.error('❌ Error creating budget entry:', insertError);
				throw insertError;
			}

			dispatch('success');
			closeModal();
		} catch (error) {
			console.error('❌ Error submitting budget entry:', error);
		} finally {
			isSubmitting = false;
		}
	}

	$: isFormValid = selectedEvent || (isCustomEvent && searchValue.trim() !== '');
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Add Budget Event"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-6">
		{#if !isCustomEvent}
			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Search Events to Add</p>
				<div class="relative">
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"
						placeholder={selectedEvent
							? selectedEvent.event_name
							: 'Search for an event or select custom'}
						bind:value={searchValue}
						on:focus={() => (showEventDropdown = true)}
						on:input={() => {
							if (selectedEvent) selectedEvent = null;
							showEventDropdown = true;
						}}
					/>
					<div
						class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2"
					>
						{#if selectedEvent || searchValue}
							<button
								type="button"
								class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer"
								on:click={() => {
									selectedEvent = null;
									searchValue = '';
									showEventDropdown = false;
								}}
								aria-label="Clear selection"
								title="Clear selection"
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						{/if}
						<button
							type="button"
							class="cursor-pointer"
							on:click={() => (showEventDropdown = !showEventDropdown)}
							aria-label="Toggle dropdown"
							title="Toggle dropdown"
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
						class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto"
					>
						<button
							type="button"
							class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1"
							on:click={selectCustomEvent}
						>
							<div class="flex items-center gap-3">
								<div class="w-12 h-12 bg-gray1 rounded-lg flex items-center justify-center">
									<svg
										class="w-6 h-6 text-lime"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
								</div>
								<div>
									<p class="font-medium">Custom Budget Entry</p>
									<p class="text-sm opacity-70">
										Create a budget entry without linking an event
									</p>
								</div>
							</div>
						</button>

						{#each filteredEvents as event}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white transition-colors cursor-pointer border-b border-gray1 last:border-b-0
								{event.isAdded
									? 'opacity-50 cursor-not-allowed'
									: 'hover:bg-lime hover:text-black'}"
								on:click={() => selectEvent(event)}
								disabled={event.isAdded}
							>
								<div class="flex items-center gap-3">
									<div
										class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0"
									>
										{#if event.event_flyer}
											<img
												src={event.event_flyer}
												alt={event.event_name}
												class="w-full h-full object-cover"
											/>
										{:else}
											<div
												class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"
											>
												<svg
													class="w-4 h-4 text-lime"
													viewBox="0 0 24 24"
													fill="currentColor"
												>
													<path
														d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
													/>
												</svg>
											</div>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<p class="font-medium truncate">{event.event_name}</p>
											{#if event.isAdded}
												<span
													class="px-2 py-0.5 text-xs font-bold text-black bg-lime rounded-full flex-shrink-0"
												>
													Budget started
												</span>
											{/if}
										</div>
										<p class="text-sm opacity-70">
											{formatEventDate(event.event_date)} • ID: {event.event_id}
										</p>
									</div>
								</div>
							</button>
						{/each}
						{#if searchValue && filteredEvents.length === 0}
							<div class="px-4 py-6 text-center text-gray2">
								<p>No events found matching "{searchValue}"</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<div class="space-y-4">
				<div class="flex items-center gap-3 mb-4">
					<button
						type="button"
						class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
						on:click={() => {
							isCustomEvent = false;
							searchValue = '';
						}}
						aria-label="Back to search"
						title="Back to search"
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M19 12H5" />
							<path d="M12 19l-7-7 7-7" />
						</svg>
					</button>
					<h3 class="text-lg font-bold text-white">Create a Custom Budget Entry</h3>
				</div>
				<div>
					<p class="font-normal text-lime mb-2">Entry Name</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						placeholder="Enter custom entry name"
						bind:value={searchValue}
					/>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-end">
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
			disabled={!isFormValid || isSubmitting}
			on:click={handleSubmit}
		>
			{isSubmitting ? 'Adding...' : 'Add Budget Entry'}
		</button>
	</div>
</Modal>