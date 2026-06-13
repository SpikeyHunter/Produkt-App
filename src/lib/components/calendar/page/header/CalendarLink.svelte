<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';

	export let event: any;
	const dispatch = createEventDispatcher();

	let isOpen = false;
	let isSubmitting = false;
	let linkedEventName = '';
	let currentlyLinkedEvent: any = null;

	let searchValue = '';
	let showEventDropdown = false;
	let selectedEvent: any = null;
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];

	let showPastEvents = false;
	let isCustomEvent = false;
	let customEventDate = '';
	let venue = '';
	let customVenue = '';
	let showVenueDropdown = false;

	const venueOptions = ['New City Gas', 'Bazart', 'Other'];
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

	// Using the group_id from the calendar event to link them (with the same
	// fallback chain used elsewhere, e.g. DealsTab's save target).
	$: calendarId = event?.group_id || event?.calendar?.id || event?.id;

	onMount(() => {
		checkCurrentLink();
	});

	async function checkCurrentLink() {
		if (!calendarId) return;
		try {
			const { data, error } = await supabase
				.from('events')
				.select('*')
				.eq('calendar_link', calendarId)
				.limit(1) // Resilient if duplicates ever exist (maybeSingle errors on >1 row)
				.maybeSingle(); // Prevents the 406 Error when empty

			if (error) throw error;

			if (data) {
				linkedEventName = data.event_name;
				currentlyLinkedEvent = data;
			} else {
				linkedEventName = '';
				currentlyLinkedEvent = null;
			}
		} catch (err) {
			console.error('Error fetching calendar link:', err);
		}
	}

	// Initialize the form exactly ONCE per modal open. This must NOT be a plain
	// `$: if (isOpen)` block: reading isCustomEvent inside such a block makes it
	// a reactive dependency, so clicking "Custom Event" (which sets
	// isCustomEvent = true) re-triggered the block and resetForm() instantly
	// reverted the custom form — which is why custom creation never worked.
	let wasOpen = false;
	$: if (isOpen && !wasOpen) {
		wasOpen = true;
		initializeForm();
	} else if (!isOpen && wasOpen) {
		wasOpen = false;
	}

	function initializeForm() {
		loadEvents();
		if (currentlyLinkedEvent) {
			selectedEvent = currentlyLinkedEvent;
			searchValue = currentlyLinkedEvent.event_name || '';
			isCustomEvent = !!currentlyLinkedEvent.is_custom;
			if (isCustomEvent) {
				customEventDate = currentlyLinkedEvent.event_date || '';
			}
			const knownVenue = venueOptions.find(
				(v) => v.toLowerCase() === (currentlyLinkedEvent.event_venue || '').toLowerCase()
			);
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else if (currentlyLinkedEvent.event_venue) {
				venue = 'Other';
				customVenue = currentlyLinkedEvent.event_venue;
			}
		} else {
			resetForm();
		}
	}

	$: if (searchValue && !isCustomEvent) {
		filteredEvents = availableEvents.filter(
			(e) =>
				(e.event_name || '').toLowerCase().includes(searchValue.toLowerCase()) ||
				e.event_id.toString().includes(searchValue)
		);
	} else {
		filteredEvents = availableEvents;
	}

	function resetForm() {
		searchValue = '';
		selectedEvent = null;
		isCustomEvent = false;
		customEventDate = '';
		venue = '';
		customVenue = '';
	}

	async function loadEvents() {
		try {
			let query = supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue, is_custom');

			if (showPastEvents) {
				query = query
					.in('event_status', ['LIVE', 'PAST'])
					.order('event_date', { ascending: false });
			} else {
				query = query.eq('event_status', 'LIVE').order('event_date', { ascending: true });
			}

			const { data, error } = await query;
			if (error) throw error;

			availableEvents = (data || []).filter(
				(e) =>
					!excludeKeywords.some((keyword) =>
						(e.event_name || '').toLowerCase().includes(keyword)
					) || e.event_id === currentlyLinkedEvent?.event_id
			);
		} catch (error) {
			console.error('Error loading events:', error);
		}
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

	function selectEvent(e: any) {
		selectedEvent = e;
		searchValue = e.event_name || '';
		showEventDropdown = false;
		isCustomEvent = e.is_custom || false;
		if (e.event_venue) {
			const knownVenue = venueOptions.find((v) => v.toLowerCase() === e.event_venue.toLowerCase());
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else {
				venue = 'Other';
				customVenue = e.event_venue;
			}
		} else {
			venue = '';
			customVenue = '';
		}
	}

	function selectCustomEvent() {
		selectedEvent = null;
		isCustomEvent = true;
		showEventDropdown = false;
		searchValue = currentlyLinkedEvent?.is_custom ? currentlyLinkedEvent.event_name || '' : '';
		customEventDate = currentlyLinkedEvent?.is_custom ? currentlyLinkedEvent.event_date || '' : '';
	}

	function selectVenue(selectedVenue: string) {
		venue = selectedVenue;
		showVenueDropdown = false;
		if (selectedVenue !== 'Other') customVenue = '';
	}

	function closeModal() {
		isOpen = false;
	}

	function handleClickOutside(e: MouseEvent) {
		if (e.target && (e.target as Element).closest) {
			if (
				!(e.target as Element).closest('.dropdown-container') &&
				!(e.target as Element).closest('.datepicker-container')
			) {
				showEventDropdown = false;
				showVenueDropdown = false;
			}
		}
	}

	async function handleSave() {
		if (!isFormValid || isSubmitting) return;

		// Without a calendar id the insert would create an orphaned event that
		// never shows as linked. Fail loudly instead of silently.
		if (!calendarId) {
			alert('Could not determine the calendar event ID. Please refresh and try again.');
			return;
		}

		isSubmitting = true;
		try {
			const finalVenue = venue === 'Other' ? customVenue.trim() : venue;

			// Unlink old event if changing to a new one
			if (
				currentlyLinkedEvent &&
				currentlyLinkedEvent.event_id !== selectedEvent?.event_id &&
				(!isCustomEvent || currentlyLinkedEvent.is_custom !== isCustomEvent)
			) {
				const { error: unlinkError } = await supabase
					.from('events')
					.update({ calendar_link: null })
					.eq('event_id', currentlyLinkedEvent.event_id);
				if (unlinkError) throw unlinkError;
			}

			if (isCustomEvent) {
				// Update existing custom linked event
				if (
					currentlyLinkedEvent &&
					currentlyLinkedEvent.is_custom &&
					(!selectedEvent || selectedEvent.event_id === currentlyLinkedEvent.event_id)
				) {
					const { error: updateError } = await supabase
						.from('events')
						.update({
							event_name: searchValue.trim(),
							event_date: customEventDate,
							event_venue: finalVenue
						})
						.eq('event_id', currentlyLinkedEvent.event_id);

					if (updateError) throw updateError;
				} else {
					// Insert new custom linked event (same pattern as EventAddModal,
					// with .select() so we can verify the row was actually created).
					const { data: newEventData, error: insertError } = await supabase
						.from('events')
						.insert([
							{
								event_name: searchValue.trim(),
								event_date: customEventDate,
								event_venue: finalVenue,
								event_status: 'LIVE',
								is_custom: true,
								calendar_link: calendarId
							}
						])
						.select('event_id');

					if (insertError) {
						console.error('❌ Error creating custom event:', insertError);
						throw insertError;
					}
					if (!newEventData?.[0]?.event_id) {
						throw new Error('Custom event insert returned no row (check RLS policies).');
					}
				}
			} else if (selectedEvent) {
				// Update existing Tixr event with the calendar_link
				const { error: linkError } = await supabase
					.from('events')
					.update({
						calendar_link: calendarId,
						event_venue: finalVenue
					})
					.eq('event_id', selectedEvent.event_id);

				if (linkError) throw linkError;
			}

			await checkCurrentLink();
			dispatch('success');
			closeModal();
		} catch (error: any) {
			console.error('Error saving calendar link:', error);
			alert(`Database Error: ${error.message || 'Check console for details.'}`);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleUnlink() {
		if (!currentlyLinkedEvent || isSubmitting) return;
		isSubmitting = true;
		try {
			const { error } = await supabase
				.from('events')
				.update({ calendar_link: null })
				.eq('event_id', currentlyLinkedEvent.event_id);
			if (error) throw error;

			await checkCurrentLink();
			dispatch('success');
			closeModal();
		} catch (error: any) {
			console.error('Error unlinking:', error);
			alert(`Error unlinking event: ${error.message}`);
		} finally {
			isSubmitting = false;
		}
	}

	// Safely evaluate validity so it doesn't crash Svelte reactivity if an object is temporarily undefined
	$: isFormValid =
		(selectedEvent || (isCustomEvent && searchValue && searchValue.trim() && customEventDate)) &&
		(venue !== 'Other' || (customVenue && customVenue.trim())) &&
		venue &&
		venue.trim();
</script>

<svelte:window on:click={handleClickOutside} />

<button
	class="flex items-center gap-2 px-4 py-2.5 rounded-3xl bg-navbar shadow-lg border border-gray2/10 transition-colors hover:bg-white/5 cursor-pointer mr-2"
	on:click={() => (isOpen = true)}
>
	<svg
		class="w-4 h-4 {linkedEventName ? 'text-lime' : 'text-gray2'}"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
	>
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
	</svg>
	<span class="text-sm font-bold {linkedEventName ? 'text-lime' : 'text-white'}">
		{linkedEventName ? 'Event Linked' : 'Link Event'}
	</span>
</button>

<Modal
	bind:isOpen
	title="Link Event to Calendar"
	maxWidth="max-w-2xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-6">
		{#if !isCustomEvent}
			<div class="dropdown-container relative">
				<div class="flex items-center justify-between mb-2">
					<p class="font-normal text-lime">Search Events</p>
					<label class="flex items-center gap-2 cursor-pointer relative z-10">
						<span class="text-xs text-gray2 font-bold uppercase tracking-wider">Show Past</span>
						<div
							class="relative w-8 h-4 bg-gray1 rounded-full transition-colors duration-200"
							class:bg-lime={showPastEvents}
						>
							<div
								class="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200"
								class:translate-x-4={showPastEvents}
							></div>
						</div>
						<input
							type="checkbox"
							class="sr-only"
							bind:checked={showPastEvents}
							on:change={loadEvents}
						/>
					</label>
				</div>
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
					<div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
						{#if selectedEvent || searchValue}
							<button
								type="button"
								class="p-1 text-gray2 hover:text-lime rounded-full cursor-pointer"
								aria-label="Clear selection"
								on:click={() => {
									selectedEvent = null;
									searchValue = '';
									showEventDropdown = false;
								}}
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
								>
							</button>
						{/if}
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
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
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
										><line x1="12" y1="5" x2="12" y2="19" /><line
											x1="5"
											y1="12"
											x2="19"
											y2="12"
										/></svg
									>
								</div>
								<div>
									<p class="font-medium">Custom Event</p>
									<p class="text-sm opacity-70">Link a custom event not on Tixr</p>
								</div>
							</div>
						</button>
						{#each filteredEvents as evt}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectEvent(evt)}
							>
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">
										{#if evt.event_flyer}
											<img
												src={evt.event_flyer}
												alt={evt.event_name}
												class="w-full h-full object-cover"
											/>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-medium truncate">{evt.event_name}</p>
										<p class="text-sm opacity-70">
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
			<div class="space-y-4">
				<div class="flex items-center gap-3 mb-4">
					<button
						type="button"
						class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
						aria-label="Go back"
						on:click={() => {
							isCustomEvent = false;
							searchValue = '';
							customEventDate = '';
							selectedEvent = null;
						}}
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg
						>
					</button>
					<h3 class="text-lg font-bold text-white">Create a Custom Event</h3>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="font-normal text-lime mb-2">Event Name</p>
						<input
							type="text"
							class="w-full h-12 bg-transparent border border-lime rounded-full px-4 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
							placeholder="Enter custom event name"
							bind:value={searchValue}
						/>
					</div>
					<div>
						<p class="font-normal text-lime mb-2">Event Date</p>
						<div
							class="border border-lime rounded-full px-4 h-12 flex items-center datepicker-container"
						>
							<DatePicker
								bind:value={customEventDate}
								placeholder="Select event date"
								variant="slim"
								width="w-full"
								height="h-12"
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="dropdown-container relative w-1/2">
			<p class="font-normal text-lime mb-2">Venue</p>
			<button
				type="button"
				class="w-full h-12 bg-transparent border border-lime rounded-full px-4 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
				on:click={() => (showVenueDropdown = !showVenueDropdown)}
			>
				<span class={venue ? 'text-white' : 'text-gray2'}>
					{#if venue}{venue === 'Other' && customVenue
							? `${venue}: ${customVenue}`
							: venue}{:else}Select venue{/if}
				</span>
				<svg
					class="w-4 h-4 text-lime transition-transform {showVenueDropdown ? 'rotate-180' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
				>
			</button>
			{#if showVenueDropdown}
				<div
					class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"
				>
					{#each venueOptions as option}
						<button
							type="button"
							class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
							on:click={() => selectVenue(option)}>{option}</button
						>
					{/each}
				</div>
			{/if}
			{#if venue === 'Other'}
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime mt-2"
					placeholder="Enter custom venue"
					bind:value={customVenue}
				/>
			{/if}
		</div>
	</div>

	<div slot="footer" class="flex justify-between">
		<div>
			{#if currentlyLinkedEvent}
				<button
					class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
					disabled={isSubmitting}
					on:click={handleUnlink}
				>
					Unlink Event
				</button>
			{/if}
		</div>
		<div class="flex gap-3">
			<button
				class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
				on:click={closeModal}>Cancel</button
			>
			<button
				class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				class:bg-lime={isFormValid && !isSubmitting}
				class:text-black={isFormValid && !isSubmitting}
				class:bg-gray1={!isFormValid || isSubmitting}
				class:text-gray2={!isFormValid || isSubmitting}
				disabled={!isFormValid || isSubmitting}
				on:click={handleSave}
			>
				{isSubmitting ? 'Saving...' : 'Save Link'}
			</button>
		</div>
	</div>
</Modal>
