<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import Button from '$lib/components/buttons/Button.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import { fade, fly } from 'svelte/transition';

	export let isOpen = false;
	export let editData: any = null;

	let existingSettlementIds: Set<string | number> = new Set();

	const dispatch = createEventDispatcher();
	const ALL_SIZES = ['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
	const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

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

	let isSubmitting = false;
	let showDeleteConfirm = false;

	// Event Searching State
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];
	let searchValue = '';
	let showEventDropdown = false;

	// Form State
	let isCustomEvent = false;
	let selectedEvent: any = null;
	let eventName = '';
	let eventDate = '';
	let eventFlyer = '';
	let currency = 'CAD';
	let selectedSizes: string[] = [...DEFAULT_SIZES];

	// Formatted Inputs
	let venuePct = 20;
	let venuePctDisplay = '20%';
	let sellerRate = 140;
	let sellerRateDisplay = '140.00$';

	$: if (isOpen) {
		showDeleteConfirm = false;
		if (editData) loadEditData();
		else resetForm();
		loadExistingSettlements(); // <-- ADD THIS LINE
		loadEvents();
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
		const { data } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_flyer')
			.eq('event_status', 'LIVE')
			.order('event_date', { ascending: true });

		if (data) {
			availableEvents = data.filter((e) => {
				const lowerName = (e.event_name || '').toLowerCase();
				return !excludeKeywords.some((kw) => lowerName.includes(kw));
			});
		} else {
			availableEvents = [];
		}
	}
	async function loadExistingSettlements() {
		const { data } = await supabase
			.from('merch_settlements')
			.select('event_id')
			.not('event_id', 'is', null);

		if (data) {
			existingSettlementIds = new Set(data.map((d) => d.event_id));
		} else {
			existingSettlementIds = new Set();
		}
	}

	function resetForm() {
		isCustomEvent = false;
		selectedEvent = null;
		searchValue = '';
		eventName = '';
		eventDate = '';
		eventFlyer = '';
		currency = 'CAD';
		venuePct = 20;
		venuePctDisplay = '20%';
		sellerRate = 140;
		sellerRateDisplay = '140.00$';
		selectedSizes = [...DEFAULT_SIZES];
	}

	function loadEditData() {
		isCustomEvent = editData.is_custom;
		selectedEvent = isCustomEvent
			? null
			: {
					event_id: editData.event_id,
					event_name: editData.event_name,
					event_flyer: editData.event_flyer
				};
		searchValue = editData.event_name;
		eventName = editData.event_name;
		eventDate = editData.event_date;
		eventFlyer = editData.event_flyer || '';
		currency = editData.currency || 'CAD';
		venuePct = editData.venue_cut_pct ?? 20;
		venuePctDisplay = `${venuePct}%`;
		sellerRate = editData.seller_rate ?? 140;
		sellerRateDisplay = `${sellerRate.toFixed(2)}$`;

		selectedSizes = editData.sizes || [...DEFAULT_SIZES];
	}

	function toggleSize(size: string) {
		if (selectedSizes.includes(size)) {
			selectedSizes = selectedSizes.filter((s) => s !== size);
		} else {
			selectedSizes = [...selectedSizes, size];
			selectedSizes.sort((a, b) => ALL_SIZES.indexOf(a) - ALL_SIZES.indexOf(b));
		}
	}

	function selectEvent(event: any) {
		selectedEvent = event;
		searchValue = event.event_name;
		eventName = event.event_name;
		eventDate = event.event_date;
		eventFlyer = event.event_flyer || '';
		isCustomEvent = false;
		showEventDropdown = false;
	}

	function selectCustomEvent() {
		selectedEvent = null;
		isCustomEvent = true;
		searchValue = '';
		eventName = '';
		eventDate = '';
		eventFlyer = '';
		showEventDropdown = false;
	}

	function formatEventDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
		} catch (error) {
			return dateString;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			event.target &&
			(event.target as Element).closest &&
			!(event.target as Element).closest('.dropdown-container')
		) {
			showEventDropdown = false;
		}
	}

	// Formatters
	function formatVenue() {
		let num = parseFloat(venuePctDisplay.replace(/[^0-9.]/g, ''));
		if (isNaN(num)) num = 0;
		venuePct = num;
		venuePctDisplay = `${num}%`;
	}
	function unformatVenue() {
		venuePctDisplay = venuePct.toString();
	}

	function formatSeller() {
		let num = parseFloat(sellerRateDisplay.replace(/[^0-9.]/g, ''));
		if (isNaN(num)) num = 0;
		sellerRate = num;
		sellerRateDisplay = `${num.toFixed(2)}$`;
	}
	function unformatSeller() {
		sellerRateDisplay = sellerRate.toString();
	}

	async function handleSubmit() {
		const finalEventName = isCustomEvent ? searchValue.trim() : eventName;
		if (!finalEventName || !eventDate || selectedSizes.length === 0) return;

		isSubmitting = true;

		const payload: any = {
			event_id: isCustomEvent ? null : selectedEvent?.event_id,
			is_custom: isCustomEvent,
			event_name: finalEventName,
			event_date: eventDate,
			event_flyer: eventFlyer,
			currency,
			venue_cut_pct: venuePct,
			seller_rate: sellerRate,
			sizes: selectedSizes
		};

		if (editData) {
			const { data: currentData } = await supabase
				.from('merch_settlements')
				.select('items')
				.eq('id', editData.id)
				.single();
			let updatedItems = currentData?.items || [];
			updatedItems = updatedItems.map((item: any) => {
				// Check all possible sizes to catch unselected ones
				ALL_SIZES.forEach((sz) => {
					if (selectedSizes.includes(sz)) {
						// Keep existing values or initialize to 0 if newly selected
						if (item.qty[sz] === undefined) item.qty[sz] = 0;
						if (item.finals[sz] === undefined) item.finals[sz] = 0;
						if (item.sales[sz] === undefined) item.sales[sz] = 0;
					} else {
						// Force to 0 if the size was unselected
						if (item.qty) item.qty[sz] = 0;
						if (item.finals) item.finals[sz] = 0;
						if (item.sales) item.sales[sz] = 0;
					}
				});
				return item;
			});

			payload.items = updatedItems;

			await supabase.from('merch_settlements').update(payload).eq('id', editData.id);
		} else {
			await supabase.from('merch_settlements').insert([payload]);
		}

		isSubmitting = false;
		dispatch('success');
		isOpen = false;
	}

	async function handleDelete() {
		isSubmitting = true;
		await supabase.from('merch_settlements').delete().eq('id', editData.id);
		isSubmitting = false;
		dispatch('deleted', editData.id);
		isOpen = false;
	}

	$: isFormValid =
		(selectedEvent || (isCustomEvent && searchValue.trim() && eventDate.trim())) &&
		selectedSizes.length > 0;
</script>

<svelte:window on:click={handleClickOutside} />

{#if isOpen}
	<div
		use:portal
		class="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 150 }}
			on:click={() => (isOpen = false)}
			role="button"
			tabindex="-1"
			on:keypress={(e) => e.key === 'Escape' && (isOpen = false)}
			aria-label="Close modal"
		></div>

		<div
			class="relative bg-navbar border border-gray2/20 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[700px] max-h-[90vh]"
			in:fly={{ y: 20, duration: 300 }}
			out:fly={{ y: 20, duration: 200 }}
		>
			<div class="flex items-center justify-between px-6 py-5 border-b border-gray2/20 shrink-0">
				<h2 class="text-xl font-bold text-white">
					{editData ? 'Edit Settlement' : 'Create Merch Settlement'}
				</h2>
				<button
					type="button"
					on:click={() => (isOpen = false)}
					class="p-2 text-gray2 hover:text-white rounded-full hover:bg-gray1 transition-colors cursor-pointer"
					aria-label="Close"
				>
					<svg
						class="w-5 h-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
					>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scroll flex flex-col">
				{#if !isCustomEvent}
					<div class="dropdown-container relative z-10">
						<p class="text-lime text-sm font-bold mb-2 block">Search Events</p>
						<div class="relative">
							<input
								id="event-search"
								type="text"
								class="w-full bg-gray1/50 border-2 border-gray2/50 rounded-3xl px-4 py-3 text-white font-bold outline-none placeholder-gray2 focus:border-lime transition-colors pr-16"
								placeholder={selectedEvent
									? selectedEvent.event_name
									: 'Search for an event or select custom'}
								bind:value={searchValue}
								on:focus={() => (showEventDropdown = true)}
								on:click|stopPropagation={() => (showEventDropdown = true)}
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
										class="p-1.5 text-gray2 hover:text-lime rounded-full hover:bg-gray2/20 transition-colors cursor-pointer"
										on:click|stopPropagation={() => {
											selectedEvent = null;
											searchValue = '';
											showEventDropdown = false;
										}}
										aria-label="Clear selection"
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><line x1="18" y1="6" x2="6" y2="18" /><line
												x1="6"
												y1="6"
												x2="18"
												y2="18"
											/></svg
										>
									</button>
								{/if}
								<button
									type="button"
									class="p-1.5 cursor-pointer text-lime"
									aria-label="Toggle dropdown"
									on:click|stopPropagation={() => (showEventDropdown = !showEventDropdown)}
								>
									<svg
										class="w-4 h-4 transition-transform {showEventDropdown ? 'rotate-180' : ''}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
									>
								</button>
							</div>
						</div>

						{#if showEventDropdown}
							<div
								class="mt-2 bg-gray1 border border-lime rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto overflow-hidden absolute w-full"
							>
								<button
									type="button"
									class="w-full px-5 py-4 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray2/20"
									on:click={() => selectCustomEvent()}
								>
									<div class="flex items-center gap-4">
										<div class="w-12 h-12 bg-navbar rounded-xl flex items-center justify-center">
											<svg
												class="w-6 h-6 text-lime"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												><line x1="12" y1="5" x2="12" y2="19" /><line
													x1="5"
													y1="12"
													x2="19"
													y2="12"
												/></svg
											>
										</div>
										<div>
											<p class="font-bold">Custom Merch Event</p>
											<p class="text-sm opacity-70">Settlement for non-Tixr events</p>
										</div>
									</div>
								</button>
								{#each filteredEvents as evt}
									{@const isSettled = existingSettlementIds.has(evt.event_id)}
									<button
										type="button"
										class="w-full px-5 py-3 text-left transition-colors border-b border-gray2/20 last:border-b-0
											{isSettled
											? 'opacity-50 cursor-not-allowed bg-gray1/30 text-gray2'
											: 'text-white hover:bg-lime/40  cursor-pointer'}"
										on:click={() => {
											if (!isSettled) selectEvent(evt);
										}}
										disabled={isSettled}
									>
										<div class="flex items-center gap-4">
											<div
												class="w-12 h-12 rounded-xl overflow-hidden bg-navbar flex-shrink-0 {isSettled
													? 'grayscale'
													: ''}"
											>
												{#if evt.event_flyer}
													<img
														src={evt.event_flyer}
														alt={evt.event_name}
														class="w-full h-full object-cover"
													/>
												{:else}
													<div
														class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"
													>
														<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="currentColor"
															><path
																d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
															/></svg
														>
													</div>
												{/if}
											</div>
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2">
													<p class="font-bold truncate {isSettled ? 'text-gray2' : 'text-white'}">
														{evt.event_name}
													</p>
													{#if isSettled}
														<span
															class="text-[10px] font-bold px-2 py-0.5 border border-confirmed text-confirmed rounded-full whitespace-nowrap"
														>
															Already added
														</span>
													{/if}
												</div>
												<p class="text-sm {isSettled ? 'text-gray2' : 'opacity-100'}">
													{formatEventDate(evt.event_date)} • ID: {evt.event_id}
												</p>
											</div>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<div class="space-y-5">
						<div class="flex items-center gap-3">
							<button
								type="button"
								class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
								on:click={() => {
									isCustomEvent = false;
									searchValue = '';
									eventDate = '';
								}}
								aria-label="Back to search"
								><svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg
								></button
							>
							<h3 class="text-lg font-bold text-white">Create Custom Settlement</h3>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div>
								<label for="custom-name" class="text-lime text-sm font-bold mb-2 block"
									>Event Name</label
								>
								<input
									id="custom-name"
									type="text"
									class="w-full bg-gray1/50 border border-gray2/50 rounded-xl px-4 py-3 text-white font-bold outline-none placeholder-gray2 focus:border-lime transition-colors"
									placeholder="Enter custom event name"
									bind:value={searchValue}
								/>
							</div>
							<div>
								<p class="text-lime text-sm font-bold mb-2 block">Event Date</p>
								<DatePicker
									bind:value={eventDate}
									placeholder="Select event date"
									variant="input"
									width="w-full"
									height="h-[48px]"
								/>
							</div>
						</div>
					</div>
				{/if}

				{#if !selectedEvent && !isCustomEvent}
					<div class="flex-1 flex flex-col items-center justify-center text-gray2/50 mt-10">
						<svg
							class="w-16 h-16 mb-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
							/>
						</svg>
						<p class="text-xl font-bold text-gray2">Select event or create a custom one</p>
					</div>
				{/if}

				{#if selectedEvent || isCustomEvent}
					<div class="flex flex-col md:flex-row gap-6 animate-in fade-in duration-300">
						<div class="w-full md:w-1/4">
							<div
								class="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-gray1 shadow-lg border border-gray2/20"
							>
								{#if selectedEvent?.event_flyer}
									<img
										src={selectedEvent.event_flyer}
										alt="Flyer"
										class="w-full h-full object-cover"
									/>
								{:else}
									<div
										class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/10 flex items-center justify-center"
									>
										<svg
											class="w-12 h-12 text-lime opacity-50"
											viewBox="0 0 24 24"
											fill="currentColor"
											><path
												d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
											/></svg
										>
									</div>
								{/if}
							</div>
						</div>
						<div class="w-full md:w-3/4 space-y-6">
							<div>
								<h3 class="text-2xl font-black text-white">
									{isCustomEvent ? searchValue || 'Custom Event' : selectedEvent?.event_name}
								</h3>
								<p class="text-gray2 mt-1">
									{isCustomEvent && eventDate
										? formatEventDate(eventDate)
										: selectedEvent
											? formatEventDate(eventDate)
											: ''}
								</p>
							</div>

							<div class="flex flex-wrap items-start gap-5">
								<div class="w-36">
									<p class="text-lime text-sm font-bold block mb-2">Currency</p>
									<div class="relative w-full">
										<select
											bind:value={currency}
											class="w-full bg-gray1/50 border border-gray2/50 rounded-xl pl-4 pr-10 py-2.5 text-white appearance-none focus:outline-none focus:border-lime transition-colors h-[46px] cursor-pointer font-bold text-sm"
										>
											<option value="CAD" class="bg-navbar text-white">CAD</option>
											<option value="USD" class="bg-navbar text-white">USD</option>
											<option value="EUR" class="bg-navbar text-white">EUR</option>
										</select>
										<div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
											<svg
												class="w-4 h-4 text-gray2"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
											>
										</div>
									</div>
								</div>
								<div class="w-32">
									<label for="venue-pct" class="text-lime text-sm font-bold block mb-2"
										>Venue Cut (%)</label
									>
									<input
										id="venue-pct"
										type="text"
										bind:value={venuePctDisplay}
										on:blur={formatVenue}
										on:focus={unformatVenue}
										class="w-full bg-gray1/50 border border-gray2/50 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-lime transition-colors h-[46px]"
									/>
								</div>
								<div class="w-40">
									<label for="seller-rate" class="text-lime text-sm font-bold block mb-2"
										>Seller Rate</label
									>
									<input
										id="seller-rate"
										type="text"
										bind:value={sellerRateDisplay}
										on:blur={formatSeller}
										on:focus={unformatSeller}
										class="w-full bg-gray1/50 border border-gray2/50 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-lime transition-colors h-[46px]"
									/>
								</div>
							</div>

							<div>
								<p class="text-lime text-sm font-bold block mb-3">Tracked Sizes</p>
								<div class="flex flex-wrap gap-2">
									{#each ALL_SIZES as size}
										<button
											type="button"
											on:click={() => toggleSize(size)}
											class="px-4 py-2 rounded-xl text-sm font-bold border transition-colors cursor-pointer {selectedSizes.includes(
												size
											)
												? 'bg-lime text-black border-lime'
												: 'bg-transparent text-gray2 border-gray2/50 hover:border-lime hover:text-white'}"
										>
											{size}
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div
				class="p-6 border-t border-gray2/20 flex justify-between items-center bg-gray1 rounded-b-3xl relative z-0 shrink-0"
			>
				<div>
					{#if editData}
						{#if showDeleteConfirm}
							<div class="flex items-center gap-3">
								<button
									type="button"
									on:click={() => (showDeleteConfirm = false)}
									class="px-6 py-2.5 text-gray3 border-2 border-gray3 rounded-3xl font-bold hover:bg-gray3 hover:text-black hover:border-gray3 transition-colors cursor-pointer"
									>Cancel</button
								>
								<button
									type="button"
									class="px-6 py-2.5 text-problem border-2 border-problem rounded-3xl font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors cursor-pointer"
									on:click={handleDelete}>Confirm Delete</button
								>
							</div>
						{:else}
							<button
								type="button"
								on:click={() => (showDeleteConfirm = true)}
								class="px-6 py-2.5 text-problem border-2 border-problem rounded-3xl font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors cursor-pointer"
								>Delete Settlement</button
							>
						{/if}
					{/if}
				</div>

				<div class="flex gap-3">
					<button
						type="button"
						class="px-6 py-2.5 bg-gray3 text-black font-bold rounded-full hover:bg-gray2 transition-colors cursor-pointer"
						on:click={() => (isOpen = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="px-6 py-2.5 font-bold rounded-full transition-colors {isFormValid &&
						!isSubmitting
							? 'bg-lime text-black hover:bg-lime/90 cursor-pointer'
							: 'bg-gray1 text-gray2 cursor-not-allowed border border-gray2/50'}"
						disabled={!isFormValid || isSubmitting}
						on:click={handleSubmit}
					>
						{isSubmitting ? 'Saving...' : editData ? 'Save' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: var(--color-lime-rgb);
		border-radius: 3px;
	}
</style>
