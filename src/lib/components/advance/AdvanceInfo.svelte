<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import InputButton from '$lib/components/buttons/InputButton.svelte';
	import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';
	import type { EventAdvance } from '$lib/services/eventsService';
	import UploadButton from '$lib/components/buttons/UploadButton.svelte';
	import LocalContacts from '$lib/components/modals/LocalContacts.svelte';

	export let event: EventAdvance;

	const dispatch = createEventDispatcher();

	// Component references
	let progressBarRef: any;

	// Modal state
	let showLocalContactsModal = false;

	// Options for dropdowns
	const artistTypeOptions = ['Headliner', 'Support', 'Local', 'Other'];
	const DOSConctactOptions = ['Charles', 'Olivia', 'Ziyaan', 'Mezz'];

	// Reactive variables derived from the event prop
	$: imageUrl = event.event_flyer || event.poster;
	$: eventName = event.event_name || event.name;
	$: eventDate = event.event_date || event.date || null;
	$: venueName = event.venue || 'TBD';
	$: artistName = event.artist_name || event.name;
	$: artistType = event.artist_type || '';
	$: dosContact = event.dos || '';
	$: mainContact = event.main_contact || '';
	$: displayEventName =
		eventName && eventName.length > 25
			? eventName.substring(0, 25) + '...'
			: eventName || 'Untitled Event';

	$: formattedDate = formatDisplayDate(eventDate);
	$: isLocalArtist = artistType === 'Local';

	// Extract display text for main contact button
	$: mainContactDisplay = mainContact || 'Select Contact';

	function formatDisplayDate(dateString: string | null): string {
		if (!dateString) {
			return 'TBD';
		}
		try {
			const date = new Date(dateString.includes('-') ? dateString.replace(/-/g, '/') : dateString);
			if (isNaN(date.getTime())) return dateString;
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}

	// Sync DOS contact with Headliner/Support artist when artist_type is Local
	async function syncDosContactForLocal() {
		if (!event?.event_id || artistType !== 'Local') return;

		try {
			// Find Headliner or Support artist in same event
			const { data, error } = await supabase
				.from('events_advance')
				.select('dos, artist_type')
				.eq('event_id', event.event_id)
				.in('artist_type', ['Headliner', 'Support'])
				.limit(1)
				.single();

			if (error) {
				console.warn('Could not find Headliner/Support artist:', error);
				return;
			}

			if (data?.dos && data.dos !== dosContact) {
				// Update local event object
				dosContact = data.dos;
				event.dos = data.dos;
				event = { ...event };

				// Save to database
				const { error: updateError } = await supabase
					.from('events_advance')
					.update({ dos: data.dos })
					.eq('event_id', event.event_id)
					.eq('artist_name', event.artist_name);

				if (updateError) {
					console.error('Error syncing DOS contact:', updateError);
				} else {
					console.log(`Synced DOS contact for Local artist: ${data.dos}`);
				}
			}
		} catch (err) {
			console.error('Error in syncDosContactForLocal:', err);
		}
	}

	// Run sync on mount and when artist_type changes
	onMount(() => {
		if (isLocalArtist) {
			syncDosContactForLocal();
		}
	});

	$: if (artistType === 'Local') {
		syncDosContactForLocal();
	}

	// CRITICAL: This function updates the local event and triggers progress recalculation
	function handleFieldUpdate(updateEvent: CustomEvent) {
		const { column, value } = updateEvent.detail;

		// Update the local event object immediately
		(event as any)[column] = value;
		event = { ...event }; // Force reactivity

		// Immediately trigger progress bar recalculation WITHOUT waiting for database
		if (progressBarRef) {
			progressBarRef.recalculate();
		}

		// Send the updated event to parent for database save
		dispatch('update', { event });

		console.log(`Field updated: ${column} = ${value}, triggering instant progress update`);

		// If artist_type changed to Local, sync DOS
		if (column === 'artist_type' && value === 'Local') {
			syncDosContactForLocal();
		}
	}

	function handleUploadComplete(uploadEvent: CustomEvent) {
		const { statusColumn, urlColumn, value } = uploadEvent.detail;

		// Update both the status and URL columns
		if (statusColumn) {
			(event as any)[statusColumn] = true; // File uploaded = true
		}
		if (urlColumn && value) {
			(event as any)[urlColumn] = value;
		}
		event = { ...event }; // Force reactivity

		// Immediately recalculate progress
		if (progressBarRef) {
			progressBarRef.recalculate();
		}

		// Send to parent for database save
		dispatch('update', { event });
	}

	function handleDeleteComplete(deleteEvent: CustomEvent) {
		const { statusColumn, urlColumn } = deleteEvent.detail;

		// Clear both columns
		if (statusColumn) {
			(event as any)[statusColumn] = false;
		}
		if (urlColumn) {
			(event as any)[urlColumn] = null;
		}
		event = { ...event }; // Force reactivity

		// Immediately recalculate progress
		if (progressBarRef) {
			progressBarRef.recalculate();
		}

		// Send to parent for database save
		dispatch('update', { event });
	}

	function openLocalContactsModal() {
		showLocalContactsModal = true;
	}

	async function handleLocalContactSelect(contact: {
		first_name: string;
		phone: string;
		dj_name: string;
	}) {
		// Check if clearing (empty contact passed)
		if (!contact.first_name || !contact.phone) {
			mainContact = '';
			event.main_contact = '';
			event = { ...event };

			// Immediately recalculate progress
			if (progressBarRef) {
				progressBarRef.recalculate();
			}

			// Save to database
			try {
				const { error } = await supabase
					.from('events_advance')
					.update({ main_contact: '' })
					.eq('event_id', event.event_id)
					.eq('artist_name', event.artist_name);

				if (error) {
					console.error('Error clearing main contact:', error);
				} else {
					dispatch('update', { event });
					// NEW: Dispatch contact changed event
					dispatch('contactChanged', { mainContact: '' });
				}
			} catch (err) {
				console.error('Error in handleLocalContactSelect (clear):', err);
			}
			return;
		}

		// Format: "First Name - Phone"
		const formattedContact = `${contact.first_name} - ${contact.phone}`;

		// Update local state
		mainContact = formattedContact;
		event.main_contact = formattedContact;
		event = { ...event };

		// Immediately recalculate progress
		if (progressBarRef) {
			progressBarRef.recalculate();
		}

		// Save to database
		try {
			const { error } = await supabase
				.from('events_advance')
				.update({ main_contact: formattedContact })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);

			if (error) {
				console.error('Error saving main contact:', error);
			} else {
				dispatch('update', { event });
				// NEW: Dispatch contact changed event
				dispatch('contactChanged', { mainContact: formattedContact });
			}
		} catch (err) {
			console.error('Error in handleLocalContactSelect:', err);
		}
	}
</script>

<LocalContacts
	bind:show={showLocalContactsModal}
	onSelect={handleLocalContactSelect}
	currentSelectedContact={mainContact}
	on:close={() => (showLocalContactsModal = false)}
/>

<div class="flex bg-navbar rounded-2xl w-[500px] h-[365px] overflow-hidden">
	<div class="relative w-[220px] flex-shrink-0 pt-4 px-4 pb-4">
		<div class="relative w-full h-[285px] rounded-md overflow-hidden">
			{#if imageUrl}
				<img src={imageUrl} alt={eventName} class="w-full h-full object-cover" />
			{:else}
				<div
					class="w-full h-full flex flex-col justify-center items-center text-center p-4 bg-gradient-to-br from-blue-900 to-green-800"
				>
					<div class="text-lg font-bold text-lime mb-2">{displayEventName}</div>
					<div class="text-sm text-white">{artistName}</div>
				</div>
			{/if}
			{#if event.event_status}
				<div
					class="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold leading-none {event.event_status.toLowerCase() ===
					'live'
						? 'bg-lime text-black'
						: 'bg-gray-600 text-white'}"
				>
					{event.event_status.toUpperCase()}
				</div>
			{/if}
		</div>
		<div class="w-full h-9 mt-2 flex items-center justify-center">
			<div
				class="h-9 px-2 flex items-center justify-center rounded-lg bg-gray3 text-black font-bold text-sm w-full"
			>
				{formattedDate}
			</div>
		</div>
	</div>

	<div class="flex-1 pt-4 px-4 pb-4 pr-6 flex flex-col gap-2 min-w-0">
		<div class="text-xl font-normal text-gray3 truncate pr-2">{displayEventName}</div>
		<div class="flex items-center gap-2 text-sm mb-1">
			<span class="text-lime font-normal truncate">{formattedDate}</span>
			<span class="text-gray3 font-normal">-</span>
			<span class="text-lime font-normal truncate">{venueName}</span>
		</div>
		<div class="w-full h-0 border-t border-gray1"></div>
		<div class="flex items-center gap-3">
			<span class="text-xl font-normal text-gray3 truncate">{artistName}</span>
			<DropdownButton
				bind:value={artistType}
				{event}
				options={artistTypeOptions}
				placeholder="Type"
				column="artist_type"
				on:fieldUpdate={handleFieldUpdate}
			/>
		</div>
		<div class="flex flex-col gap-2 mb-1">
			<div class="text-sm font-normal text-gray3">Progress</div>
			<div class="w-full pr-2">
				<ProgressBar
					bind:this={progressBarRef}
					{event}
					showLabel
					labelSize="text-xs"
					barHeight="h-1.5"
					maxWidth="max-w-full"
					labelColor="text-lime"
					barColor="bg-lime"
					trackColor="bg-gray2/40"
				/>
			</div>
		</div>
		<div class="w-full h-0 border-t border-gray1"></div>
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-1 text-sm mt-2">
				<span class="font-semibold min-w-[95px] text-gray3">Artist Liaison</span>
				{#if isLocalArtist}
					<div
						class="px-3 py-1.5 bg-gray1 text-gray-300 rounded-3xl text-xs font-medium truncate"
						style="max-width: 140px;"
					>
						{dosContact || 'Syncing...'}
					</div>
				{:else}
					<DropdownButton
						bind:value={dosContact}
						{event}
						options={DOSConctactOptions}
						placeholder="Select"
						column="dos"
						on:fieldUpdate={handleFieldUpdate}
					/>
				{/if}
			</div>
			<div class="flex items-center gap-1 text-sm">
				<span class="font-semibold min-w-[95px] text-gray3">Main Contact</span>
				{#if isLocalArtist}
					<button
						on:click={openLocalContactsModal}
						class="px-3 py-1.5 bg-gray1 text-gray-300 rounded-3xl text-xs hover:bg-gray2 hover:text-black transition-all truncate cursor-pointer"
						style="max-width: 140px;"
						title={mainContact}
					>
						{mainContactDisplay}
					</button>
				{:else}
					<InputButton
						bind:value={mainContact}
						{event}
						placeholder="Enter phone number"
						column="main_contact"
						maxWidth={140}
						on:fieldUpdate={handleFieldUpdate}
					/>
				{/if}
			</div>
			{#if !isLocalArtist}
				<div class="flex items-center gap-3 text-sm mt-3">
					<span class="font-semibold min-w-[50px] text-gray3 whitespace-nowrap">Contract</span>
					<UploadButton
						{event}
						placeholder="Upload Contract"
						viewText="View Contract"
						urlColumn="contract_url"
						statusColumn="contract"
						fileNameTemplate="Contract - {event.artist_name}"
						acceptedTypes=".pdf"
						on:upload-complete={handleUploadComplete}
						on:delete-complete={handleDeleteComplete}
						on:fieldUpdate={handleFieldUpdate}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>
