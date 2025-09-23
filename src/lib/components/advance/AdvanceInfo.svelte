<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import InputButton from '$lib/components/buttons/InputButton.svelte';
	import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { PROGRESS_FIELDS } from '$lib/utils/progressUtils';
	import UploadButton from '$lib/components/buttons/UploadButton.svelte';

	export let event: EventAdvance;

	// This allows the component to send messages (events) to its parent
	const dispatch = createEventDispatcher();

	// Component references
	let progressBarRef: any;

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

	function formatDisplayDate(dateString: string | null): string {
		if (!dateString) {
			return 'TBD';
		}
		try {
			// Create a date object, ensuring correct parsing for 'YYYY-MM-DD'
			const date = new Date(dateString.includes('-') ? dateString.replace(/-/g, '/') : dateString);
			if (isNaN(date.getTime())) return dateString; // Return original if invalid
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

	// This function handles updates from any field
	function handleFieldUpdate(updateEvent: CustomEvent) {
		const { column, value } = updateEvent.detail;
		// Update the local event object to keep the UI in sync
		(event as any)[column] = value;
		event = { ...event };

		// **CRITICAL**: Send the entire updated event object to the parent component
		dispatch('update', { event });
	}

	// This function also handles updates but includes logic for the progress bar
	function handleProgressFieldUpdate(updateEvent: CustomEvent) {
		handleFieldUpdate(updateEvent); // Reuse the main update logic

		const { column } = updateEvent.detail;
		if (PROGRESS_FIELDS.includes(column)) {
			progressBarRef?.refreshProgress([column]);
		}
	}

	// Functions to handle other component events
	function handleProgressUpdate(updateEvent: CustomEvent) {
		const { event: updatedEvent } = updateEvent.detail;
		event = { ...event, ...updatedEvent };
	}

	function handleUploadComplete(uploadEvent: CustomEvent) {
		const { statusColumn, urlColumn } = uploadEvent.detail;
		// Force update of the event to trigger reactivity
		event = { ...event };
		progressBarRef?.refreshProgress([statusColumn, urlColumn]);
	}

	function handleDeleteComplete(deleteEvent: CustomEvent) {
		const { statusColumn, urlColumn } = deleteEvent.detail;
		// Force update of the event to trigger reactivity
		event = { ...event };
		progressBarRef?.refreshProgress([statusColumn, urlColumn]);
	}
</script>

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
					on:progress-updated={handleProgressUpdate}
				/>
			</div>
		</div>
		<div class="w-full h-0 border-t border-gray1"></div>
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-1 text-sm mt-2">
				<span class="font-semibold min-w-[95px] text-gray3">Artist Liaison</span>
				<DropdownButton
					bind:value={dosContact}
					{event}
					options={DOSConctactOptions}
					placeholder="Select"
					column="dos"
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>
			<div class="flex items-center gap-1 text-sm">
				<span class="font-semibold min-w-[95px] text-gray3">Main Contact</span>
				<InputButton
					bind:value={mainContact}
					{event}
					placeholder="Enter phone number"
					column="main_contact"
					maxWidth={140}
					on:fieldUpdate={handleProgressFieldUpdate}
				/>
			</div>
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
			
		</div>
	</div>
</div>