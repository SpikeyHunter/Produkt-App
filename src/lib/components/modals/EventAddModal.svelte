<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import { supabase } from '$lib/supabase.js';
	import { createEventAdvance } from '$lib/services/eventsService.js';

	export let isOpen = false;
	const dispatch = createEventDispatcher();

	// Event selection
	let searchValue = '';
	let showEventDropdown = false;
	let selectedEvent: any = null;
	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];

	// Artists management
	let artists: Array<{
		id: string;
		name: string;
		type: string;
		customType: string;
		showTypeDropdown: boolean;
	}> = [];

	// Venue selection
	let venue = '';
	let customVenue = '';
	let showVenueDropdown = false;

	// Custom event fields
	let customEventDate = '';

	// Form state
	let isSubmitting = false;
	let isCustomEvent = false;

	const artistTypeOptions = ['Headliner', 'Support', 'Local', 'Other'];
	const venueOptions = ['New City Gas', 'Bazart', 'Other'];

	$: if (isOpen) {
		loadEvents();
		resetForm();
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
			// Ensure event_venue is selected when fetching events.
			const { data, error } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.eq('event_status', 'LIVE')
				.order('event_date', { ascending: true });
			if (error) {
				console.error('Error loading events:', error);
				return;
			}
			availableEvents = data || [];
		} catch (error) {
			console.error('Error loading events:', error);
		}
	}

	function resetForm() {
		searchValue = '';
		selectedEvent = null;
		artists = [createEmptyArtist()];
		venue = '';
		customVenue = '';
		customEventDate = '';
		isCustomEvent = false;
		showEventDropdown = false;
		showVenueDropdown = false;
		isSubmitting = false;
	}

	function createEmptyArtist() {
		return {
			id: Math.random().toString(36).substr(2, 9),
			name: '',
			type: '',
			customType: '',
			showTypeDropdown: false
		};
	}

	function selectEvent(event: any) {
		selectedEvent = event;
		searchValue = event.event_name;
		showEventDropdown = false;
		isCustomEvent = false;

		// If the selected event has a venue, pre-populate the venue fields.
		if (event.event_venue) {
			const knownVenue = venueOptions.find(v => v.toLowerCase() === event.event_venue.toLowerCase());
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else {
				venue = 'Other';
				customVenue = event.event_venue;
			}
		} else {
			// Reset venue fields if the selected event has no venue.
			venue = '';
			customVenue = '';
		}
	}

	function selectCustomEvent() {
		selectedEvent = null;
		isCustomEvent = true;
		showEventDropdown = false;
		searchValue = '';
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

	function addArtist() {
		if (artists.length < 5) {
			artists = [...artists, createEmptyArtist()];
		}
	}

	function removeArtist(artistId: string) {
		if (artists.length > 1) {
			artists = artists.filter(artist => artist.id !== artistId);
		}
	}

	function selectArtistType(artistId: string, type: string) {
		artists = artists.map(artist => {
			if (artist.id === artistId) {
				return {
					...artist,
					type,
					customType: type !== 'Other' ? '' : artist.customType,
					showTypeDropdown: false
				};
			}
			return artist;
		});
	}

	function toggleArtistTypeDropdown(artistId: string) {
		artists = artists.map(artist => ({
			...artist,
			showTypeDropdown: artist.id === artistId ? !artist.showTypeDropdown : false
		}));
	}

	function selectVenue(selectedVenue: string) {
		venue = selectedVenue;
		showVenueDropdown = false;
		if (selectedVenue !== 'Other') {
			customVenue = '';
		}
	}

	function toggleEventDropdown() {
		showEventDropdown = !showEventDropdown;
	}

	function toggleVenueDropdown() {
		showVenueDropdown = !showVenueDropdown;
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest) {
			if (!(event.target as Element).closest('.dropdown-container') && !(event.target as Element).closest('.datepicker-container')) {
				showEventDropdown = false;
				showVenueDropdown = false;
				artists = artists.map(artist => ({ ...artist, showTypeDropdown: false }));
			}
		}
	}

	async function handleSubmit() {
		if (!isFormValid || isSubmitting) return;

		isSubmitting = true;
		try {
			const finalVenue = venue === 'Other' ? customVenue.trim() : venue;
			let currentEventId = isCustomEvent ? null : selectedEvent?.event_id;

			// Handle custom event creation or updating an existing event's venue.
			if (isCustomEvent) {
				// A new, custom event is being created. Insert it into the 'events' table.
				const { data: newEventData, error: insertError } = await supabase
					.from('events')
					.insert([
						{
							event_name: searchValue.trim(),
							event_date: customEventDate,
							event_venue: finalVenue, // Correctly store the venue with the event.
							event_status: 'LIVE' 
						}
					])
					.select('event_id');

				if (insertError) {
					console.error('❌ Error creating custom event:', insertError);
					throw insertError;
				}
				currentEventId = newEventData?.[0]?.event_id;
			} else if (selectedEvent && finalVenue) {
				// An existing event was selected and a venue was chosen. Update the event record.
				const { error: updateError } = await supabase
					.from('events')
					.update({ event_venue: finalVenue }) // Correctly update the venue on the event.
					.eq('event_id', selectedEvent.event_id);

				if (updateError) {
					console.error('❌ Error updating event venue:', updateError);
					throw updateError;
				}
			}

			// With the event ID secured (either new or existing), create an advance record for each artist.
			for (const artist of validArtists) {
				const artistType = artist.type === 'Other' ? artist.customType.trim() : artist.type;
				await createEventAdvance(
					currentEventId,
					artist.name.trim(),
					artistType || undefined,
					undefined, // The venue is now stored on the event table, so it's not needed here.
					undefined,
					undefined
				);
			}

			dispatch('success');
			closeModal();
		} catch (error) {
			console.error('❌ Error submitting event advance from the frontend:', error);
		} finally {
			isSubmitting = false;
		}
	}

	$: validArtists = artists.filter(artist =>
		artist.name.trim() &&
		(artist.type !== 'Other' || artist.customType.trim())
	);
	$: isFormValid =
		(selectedEvent || (isCustomEvent && searchValue.trim() && customEventDate.trim())) &&
		validArtists.length > 0 &&
		(venue !== 'Other' || customVenue.trim()) &&
		venue.trim();
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Select an event to advance"
	maxWidth="max-w-4xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-6">
		<!-- Event Search/Selection or Custom Event -->
		{#if !isCustomEvent}
			<!-- Normal Event Search -->
			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Search Events</p>
				<div class="relative">
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"
						placeholder={selectedEvent ? selectedEvent.event_name : 'Search for an event or select custom'}
						bind:value={searchValue}
						on:focus={() => showEventDropdown = true}
						on:input={() => {
							if (selectedEvent) {
								selectedEvent = null;
							}
							showEventDropdown = true;
						}}
					/>
					<div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
						{#if (selectedEvent || searchValue)}
							<button
								type="button"
								class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer"
								on:click={() => {
									selectedEvent = null;
									searchValue = '';
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
							on:click={() => showEventDropdown = !showEventDropdown}
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
						<!-- Custom Event Option -->
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
									<p class="font-medium">Custom Advance Event</p>
									<p class="text-sm opacity-70">Create advance without specific event</p>
								</div>
							</div>
						</button>

						<!-- Event Options -->
						{#each filteredEvents as event}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectEvent(event)}
							>
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">
										{#if event.event_flyer}
											<img src={event.event_flyer} alt={event.event_name} class="w-full h-full object-cover" />
										{:else}
											<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center">
												<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor">
													<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
												</svg>
											</div>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<p class="font-medium truncate">{event.event_name}</p>
										<p class="text-sm opacity-70">{formatEventDate(event.event_date)} • ID: {event.event_id}</p>
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
			<!-- Custom Event Fields -->
			<div class="space-y-4">
				<!-- Go Back Button and Title -->
				<div class="flex items-center gap-3 mb-4">
					<button
						type="button"
						class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
						on:click={() => {
							isCustomEvent = false;
							searchValue = '';
							customEventDate = '';
						}}
						aria-label="Back to search"
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M19 12H5"/>
							<path d="M12 19l-7-7 7-7"/>
						</svg>
					</button>
					<h3 class="text-lg font-bold text-white">Create a Custom Event</h3>
				</div>

				<!-- Event Name -->
				<div>
					<p class="font-normal text-lime mb-2">Event Name</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						placeholder="Enter custom event name"
						bind:value={searchValue}
					/>
				</div>

				<!-- Event Date -->
				<div>
					<p class="font-normal text-lime mb-2">Event Date</p>
					<DatePicker 
						bind:value={customEventDate}
						placeholder="Select event date"
						variant="slim"
						width="w-64"
						height="h-10"
						on:change={(e: CustomEvent) => console.log('Date selected:', e.detail)}
					/>
				</div>
			</div>
		{/if}

		<!-- Event Details (when event is selected) -->
		{#if selectedEvent || isCustomEvent}
			<div class="flex gap-6">
				<!-- Left Column (1/3) - Poster -->
				<div class="w-1/3">
					<div class="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gray1">
						{#if selectedEvent?.event_flyer}
							<img src={selectedEvent.event_flyer} alt={selectedEvent.event_name} class="w-full h-full object-cover" />
						{:else}
							<div class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center">
								<svg class="w-12 h-12 text-lime" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
								</svg>
							</div>
						{/if}
					</div>
				</div>

				<!-- Right Column (2/3) - Event Info and Artists -->
				<div class="w-2/3 space-y-6">
					<!-- Event Info -->
					<div>
						<h3 class="text-xl font-bold text-white mb-2">
							{isCustomEvent ? (searchValue || 'Custom Event') : selectedEvent?.event_name}
						</h3>
						{#if selectedEvent}
							<p class="text-gray2">{formatEventDate(selectedEvent.event_date)} • ID: {selectedEvent.event_id}</p>
						{:else if isCustomEvent && customEventDate}
							<p class="text-gray2">{formatEventDate(customEventDate)} • Custom Event</p>
						{/if}
					</div>

					<!-- Artists Section -->
					<div>
						<div class="flex items-center justify-between mb-4">
							<h4 class="text-lg font-bold text-white">Artists</h4>
							<button
								type="button"
								class="px-4 py-2 bg-lime text-black rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
								disabled={artists.length >= 5}
								on:click={addArtist}
							>
								Add Artist ({artists.length}/5)
							</button>
						</div>

						<div class="space-y-4">
							{#each artists as artist, index}
								<div class="flex gap-3 items-center">
									<!-- Artist Name -->
									<div class="flex-1">
										<input
											type="text"
											class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
											placeholder="Artist name"
											bind:value={artist.name}
										/>
									</div>

									<!-- Artist Type Dropdown -->
									<div class="dropdown-container relative w-48">
										{#if artist.type === 'Other'}
											<!-- Editable input for Other type -->
											<div class="relative">
												<input
													type="text"
													class="w-full bg-transparent border border-lime rounded-full px-4 py-2 pr-10 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
													placeholder="Enter custom type"
													bind:value={artist.customType}
												/>
												<button
													type="button"
													class="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
													on:click={() => toggleArtistTypeDropdown(artist.id)}
													aria-label="Toggle dropdown"
												>
													<svg 
														class="w-4 h-4 text-lime transition-transform {artist.showTypeDropdown ? 'rotate-180' : ''}" 
														viewBox="0 0 24 24" 
														fill="none" 
														stroke="currentColor" 
														stroke-width="2"
													>
														<path d="M6 9l6 6 6-6"/>
													</svg>
												</button>
											</div>
										{:else}
											<!-- Regular dropdown button -->
											<button
												type="button"
												class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
												on:click={() => toggleArtistTypeDropdown(artist.id)}
											>
												<span class={artist.type ? 'text-white' : 'text-gray2'}>
													{artist.type || 'Type'}
												</span>
												<svg 
													class="w-4 h-4 text-lime transition-transform {artist.showTypeDropdown ? 'rotate-180' : ''}" 
													viewBox="0 0 24 24" 
													fill="none" 
													stroke="currentColor" 
													stroke-width="2"
												>
													<path d="M6 9l6 6 6-6"/>
												</svg>
											</button>
										{/if}

										{#if artist.showTypeDropdown}
											<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10">
												{#each artistTypeOptions as option}
													<button
														type="button"
														class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
														on:click={() => selectArtistType(artist.id, option)}
													>
														{option}
													</button>
												{/each}
											</div>
										{/if}
									</div>

									<!-- Remove Artist Button -->
									<button
										type="button"
										class="flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
										disabled={artists.length <= 1}
										aria-label="Remove artist"
										on:click={() => removeArtist(artist.id)}
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M3 6h18"/>
											<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
											<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
											<line x1="10" y1="11" x2="10" y2="17"/>
											<line x1="14" y1="11" x2="14" y2="17"/>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					</div>

					<!-- Venue Selection -->
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

						<!-- Custom Venue Input (inline when Other is selected) -->
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
			{isSubmitting ? 'Adding...' : 'Add Event'}
		</button>
	</div>
</Modal>
