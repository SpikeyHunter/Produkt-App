<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { updateEventAdvance, deleteEventAdvance, updateEvent } from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;
	export let event: any = null;
	const dispatch = createEventDispatcher();

	let artistName = '';
	let artistType = '';
	let selectedEvent: any = null;
	let searchValue = '';
	let isSubmitting = false;
	let showDeleteConfirm = false;
	let showDropdown = false;
	let showEventDropdown = false;
	let showVenueDropdown = false;
	let customArtistType = '';
	let isCustomEvent = false;
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];
	let hasLoadedEvents = false;
	let venue = '';
	let customVenue = '';
	const artistTypeOptions = ['Headliner', 'Support', 'Local', 'Other'];
	const venueOptions = ['New City Gas', 'Bazart', 'Other'];
	// Reset form when modal opens/closes or event changes
	$: if (event && isOpen && !hasLoadedEvents) {
		artistName = event?.artist_name || ''; // <-- CORRECTED LINE
		const currentEventId = event?.id?.split('-')[0] || '';
		const eventArtistType = event?.artist_type || '';
		// Initialize venue from event data
		const eventVenue = event?.event_venue || event?.venue || '';
		if (eventVenue) {
			const knownVenue = venueOptions.find(v => v.toLowerCase() === eventVenue.toLowerCase());
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else {
				venue = 'Other';
				customVenue = eventVenue;
			}
		} else {
			venue = '';
			customVenue = '';
		}
		
		// Load events once and set selected event
		loadEvents().then(() => {
			// Find the matching event in availableEvents
			selectedEvent = availableEvents.find(e => e.event_id.toString() === currentEventId) || null;
			if (selectedEvent) {
				searchValue = selectedEvent.event_name;
				isCustomEvent = false;
			} else {
				// Custom event or event not found
				searchValue = 'Custom Event';
				isCustomEvent = true;
			}
			hasLoadedEvents = true;
		}).catch(() => {
			// If loading fails, assume custom event
			searchValue = 'Custom Event';
			isCustomEvent = true;
			hasLoadedEvents = true;
		});
		// Check if the artist type is one of our predefined options
		if (artistTypeOptions.includes(eventArtistType)) {
			artistType = eventArtistType;
			customArtistType = '';
		} else if (eventArtistType) {
			artistType = 'Other';
			customArtistType = eventArtistType;
		} else {
			artistType = '';
			customArtistType = '';
		}
		
		showDeleteConfirm = false;
		showDropdown = false;
		showEventDropdown = false;
		showVenueDropdown = false;
	}

	$: if (searchValue && !isCustomEvent) {
		filteredEvents = availableEvents.filter(event =>
			event.event_name.toLowerCase().includes(searchValue.toLowerCase()) ||
			event.event_id.toString().includes(searchValue)
		);
	} else {
		filteredEvents = availableEvents;
	}

	async function loadEvents() {
		try {
			const { data, error } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer')
				.eq('event_status', 'LIVE')
				.order('event_date', { ascending: true });
			if (error) {
				console.error('Error loading events:', error);
				availableEvents = [];
				return;
			}

			availableEvents = data || [];
		} catch (error) {
			console.error('Error loading events:', error);
			availableEvents = [];
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		artistName = '';
		artistType = '';
		selectedEvent = null;
		searchValue = '';
		customArtistType = '';
		venue = '';
		customVenue = '';
		isSubmitting = false;
		showDeleteConfirm = false;
		showDropdown = false;
		showEventDropdown = false;
		showVenueDropdown = false;
		isCustomEvent = false;
		hasLoadedEvents = false;
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
	}

	function toggleEventDropdown() {
		showEventDropdown = !showEventDropdown;
	}

	function selectVenue(selectedVenue: string) {
		venue = selectedVenue;
		showVenueDropdown = false;
		if (selectedVenue !== 'Other') {
			customVenue = '';
		}
	}

	function toggleVenueDropdown() {
		showVenueDropdown = !showVenueDropdown;
	}

	async function handleSave() {
		if (!artistName.trim() || (!selectedEvent && !isCustomEvent) || !event) return;

		isSubmitting = true;
		try {
			/** @type {string} */
			const originalEventIdStr = event.id?.split('-')[0] || '';
			/** @type {string} */
			const originalArtistName = event.id?.split('-').slice(1).join('-') || '';
			const updates = {
				event_id: selectedEvent ? selectedEvent.event_id : -1, // Use -1 for custom events
				artist_name: artistName.trim(),
				artist_type: artistType === 'Other' ?
					customArtistType.trim() || undefined : artistType || undefined
			};

			await updateEventAdvance(parseInt(originalEventIdStr), originalArtistName, updates);
			// Update venue in the events table if venue was changed
			const finalVenue = venue === 'Other' ? customVenue.trim() : venue;
			if (finalVenue && (selectedEvent || parseInt(originalEventIdStr) !== -1)) {
				const eventIdToUpdate = selectedEvent ? selectedEvent.event_id : parseInt(originalEventIdStr);
				await updateEvent(eventIdToUpdate, { event_venue: finalVenue });
			}

			dispatch('save', {
				eventId: parseInt(originalEventIdStr),
				originalArtistName: originalArtistName,
				updates,
				event: {
					...event,
					id: `${updates.event_id}-${artistName.trim()}`,
					name: artistName.trim(),
					artist_type: artistType === 'Other' ? customArtistType.trim() || null : artistType || null,
					venue: finalVenue,
					event_venue: finalVenue
				}
			});
			closeModal();
		} catch (error) {
			console.error('Error saving event:', error);
		} finally {
			isSubmitting = false;
		}
	}

	// UPDATED handleDelete function
	async function handleDelete() {
		if (!event) return;
		isSubmitting = true;
		try {
			// More robust parsing of the event ID
			const eventParts = event.id?.split('-') || [];
			const eventIdStr = eventParts[0] || '';
			const originalArtistName = eventParts.slice(1).join('-') || '';
			
			console.log('Deleting event with:', {
				fullId: event.id,
				eventIdStr,
				originalArtistName,
				parsedEventId: parseInt(eventIdStr)
			});
			// Validate that we have both required parameters
			if (!eventIdStr || !originalArtistName) {
				console.error('Invalid event ID format:', event.id);
				throw new Error('Invalid event ID format');
			}

			// Pass the file URLs to the service function for cleanup
			await deleteEventAdvance(
				parseInt(eventIdStr),
				originalArtistName,
				event.contract_url,
				event.passport_info
			);
			dispatch('delete', {
				eventId: parseInt(eventIdStr),
				artistName: originalArtistName,
				event
			});

			closeModal();
		} catch (error) {
			console.error('Error deleting event:', error);
			// Optionally show an error message to the user
			alert('Failed to delete event. Please check the console for details.');
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

	function selectArtistType(type: string) {
		artistType = type;
		showDropdown = false;
		if (type !== 'Other') {
			customArtistType = '';
		}
	}

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest && !(event.target as Element).closest('.dropdown-container')) {
			showDropdown = false;
			showEventDropdown = false;
			showVenueDropdown = false;
		}
	}

	function formatEventDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			// Fix timezone offset
			return date.toLocaleDateString('en-US', { 
				month: 'long', 
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			return dateString;
		}
	}

	$: isFormValid = artistName.trim().length > 0 && 
					 (selectedEvent || isCustomEvent) &&
					 (artistType !== 'Other' || customArtistType.trim().length > 0) &&
					 (venue !== 'Other' || customVenue.trim().length > 0) &&
					 venue.trim().length > 0;
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Edit Event"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		{#if event}
			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Select Event</p>
				<div class="relative">
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"
						placeholder={selectedEvent ?
							selectedEvent.event_name : (isCustomEvent ? 'Custom Event' : 'Search for an event')}
						bind:value={searchValue}
						on:focus={() => showEventDropdown = true}
						on:input={() => {
							if (selectedEvent) {
								selectedEvent = null;
								isCustomEvent = false;
							}
							showEventDropdown = true;
						}}
					/>
					<div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
						{#if (selectedEvent || isCustomEvent || searchValue)}
							<button
								type="button"
								class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer"
								on:click={() => {
									selectedEvent = null;
									searchValue = '';
									isCustomEvent = false;
									showEventDropdown = false;
								}}
								aria-label="Clear selection"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"/>
									<line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
						{/if}
						<button
							type="button"
							class="cursor-pointer"
							aria-label="Toggle dropdown"
							on:click={toggleEventDropdown}
						>
							<svg 
								class="w-4 h-4 text-lime transition-transform {showEventDropdown ? 'rotate-180' : ''}" 
								viewBox="0 0 24 24" 
								fill="none" 
								stroke="currentColor" 
								stroke-width="2"
							>
								<path d="M6 9l6 6 6-6"/>
							</svg>
						</button>
					</div>
				</div>

				{#if showEventDropdown}
					<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
						<button
							type="button"
							class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1"
							on:click={selectCustomEvent}
						>
							<div class="flex items-center gap-3">
								<div class="w-12 h-12 bg-gray1 rounded-lg flex items-center justify-center">
									<svg class="w-6 h-6 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="12" y1="5" x2="12" y2="19"/>
										<line x1="5" y1="12" x2="19" y2="12"/>
									</svg>
								</div>
								<div>
									<p class="font-medium">Custom Event</p>
									<p class="text-sm opacity-70">Event not in Tixr system</p>
								</div>
							</div>
						</button>

						{#each filteredEvents as eventOption}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectEvent(eventOption)}
							>
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">
										{#if eventOption.event_flyer}
											<img src={eventOption.event_flyer} alt={eventOption.event_name} class="w-full h-full object-cover" />
										{:else}
											<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center">
												<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
												</svg>
											</div>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-medium truncate">{eventOption.event_name}</p>
										<p class="text-sm opacity-70">{formatEventDate(eventOption.event_date)} • ID: {eventOption.event_id}</p>
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

			<div>
				<p class="font-normal text-lime mb-2">Artist Name</p>
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
					placeholder="Enter artist name"
					bind:value={artistName}
				/>
			</div>

			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Artist Type</p>
				<button
					type="button"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
					on:click={toggleDropdown}
				>
					<span class={artistType ? 'text-white' : 'text-gray2'}>
						{#if artistType === 'Other' && customArtistType}
							{customArtistType}
						{:else if artistType}
							{artistType}
						{:else}
							Select artist type
						{/if}
					</span>
					<svg 
						class="w-4 h-4 text-lime transition-transform {showDropdown ? 'rotate-180' : ''}" 
						viewBox="0 0 24 24" 
						fill="none" 
						stroke="currentColor" 
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6"/>
					</svg>
				</button>

				{#if showDropdown}
					<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10">
						{#each artistTypeOptions as option}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectArtistType(option)}
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if artistType === 'Other'}
				<div>
					<p class="font-normal text-lime mb-2">Custom Artist Type</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						placeholder="Enter custom artist type"
						bind:value={customArtistType}
					/>
				</div>
			{/if}

			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Venue</p>
				<button
					type="button"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
					on:click={toggleVenueDropdown}
				>
					<span class={venue ? 'text-white' : 'text-gray2'}>
						{#if venue}
							{venue === 'Other' && customVenue ? `${venue}: ${customVenue}` : venue}
						{:else}
							Select venue
						{/if}
					</span>
					<svg 
						class="w-4 h-4 text-lime transition-transform {showVenueDropdown ? 'rotate-180' : ''}" 
						viewBox="0 0 24 24" 
						fill="none" 
						stroke="currentColor" 
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6"/>
					</svg>
				</button>

				{#if showVenueDropdown}
					<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10">
						{#each venueOptions as option}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectVenue(option)}
							>
								{option}
							</button>
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

			{#if showDeleteConfirm}
				<div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
					<div class="flex items-center gap-2 mb-2">
						<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
						</svg>
						<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
					</div>
					<p class="text-red-300 text-sm mb-3">
						Are you sure you want to delete this event entry? This action cannot be undone.
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
				Delete Event
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