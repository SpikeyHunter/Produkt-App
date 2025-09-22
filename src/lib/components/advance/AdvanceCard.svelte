<script>
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';
	import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';

	export let event = {
		id: '',
		artist_name: 'Artist Name', // Correct property name
		date: 'August 30',
		progress: 75,
		poster: null,
		tags: ['Immigration', 'Flights in calendar', 'Need Rider', 'New tag'],
		artist_type: null
	};

	const dispatch = createEventDispatcher();

	// Component references
	let progressBarRef;

	// Function to extract date from custom event ID
	function extractDateFromEventId(eventId) {
		const eventIdStr = String(eventId);
		console.log('Checking event ID format:', eventIdStr);
		
		let dateStr = null;
		
		// Check for new format: 90YYYYMMDD (10 digits starting with 90)
		if (eventIdStr.startsWith('90') && eventIdStr.length === 10) {
			dateStr = eventIdStr.substring(2); // Remove '90' prefix
			console.log('Found new format (90YYYYMMDD):', dateStr);
		}
		// Check for old format: 1YMMDDDD (9 digits starting with 1) - try flexible parsing
		else if (eventIdStr.startsWith('1') && eventIdStr.length === 9) {
			const withoutPrefix = eventIdStr.substring(1); // Remove '1' prefix
			
			// Try to extract month and day from the end (last 4 digits)
			const possibleMonth = withoutPrefix.substring(withoutPrefix.length - 4, withoutPrefix.length - 2);
			const possibleDay = withoutPrefix.substring(withoutPrefix.length - 2);
			
			// Current year as fallback
			const currentYear = new Date().getFullYear();
			
			console.log('Trying flexible parsing:', {
				withoutPrefix,
				possibleMonth,
				possibleDay,
				currentYear
			});

			// Validate month and day
			const monthNum = parseInt(possibleMonth);
			const dayNum = parseInt(possibleDay);

			if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
				try {
					const date = new Date(currentYear, monthNum - 1, dayNum);
					if (!isNaN(date.getTime())) {
						const formattedDate = date.toLocaleDateString('en-US', { 
							month: 'long', 
							day: 'numeric'
						});
						console.log('Successfully extracted date with flexible parsing:', formattedDate);
						return formattedDate;
					}
				} catch (error) {
					console.error('Error in flexible parsing:', error);
				}
			}
		}
		
		if (dateStr && dateStr.length === 8) {
			const year = dateStr.substring(0, 4);
			const month = dateStr.substring(4, 6);
			const day = dateStr.substring(6, 8);
			
			console.log('Extracting date from event ID:', {
				eventId: eventIdStr,
				dateStr,
				year,
				month,
				day
			});

			try {
				// Create date using ISO format (YYYY-MM-DD) to avoid timezone issues
				const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
				const date = new Date(isoDate);
				
				// Check if date is valid
				if (isNaN(date.getTime())) {
					console.error('Invalid date created from:', isoDate);
					return null;
				}
				
				const formattedDate = date.toLocaleDateString('en-US', { 
					month: 'long', 
					day: 'numeric'
				});
				
				console.log('Successfully extracted date:', formattedDate);
				return formattedDate;
			} catch (error) {
				console.error('Error parsing date from event ID:', error);
				return null;
			}
		}
		
		console.log('Event ID does not match custom format:', eventIdStr);
		return null;
	}

	// Get display date - try event.date first, then extract from event_id, fallback to 'TBD'
	$: displayDate = (() => {
		// Debug: Log the full event object to see what we're working with
		console.log('AdvanceCard: Full event object:', event);
		console.log('AdvanceCard: event.date:', event.date);
		console.log('AdvanceCard: event.event_id:', event.event_id);
		console.log('AdvanceCard: event.id:', event.id);
		
		// First, try the regular date field
		if (event.date && event.date !== 'TBD') {
			console.log('AdvanceCard: Using event.date:', event.date);
			return event.date;
		}
		
		// If no date, try to extract from event_id (for custom events)
		if (event.event_id || event.id) {
			const eventIdToCheck = event.event_id || event.id;
			console.log('AdvanceCard: Trying to extract from event_id:', eventIdToCheck);
			const extractedDate = extractDateFromEventId(eventIdToCheck);
			if (extractedDate) {
				console.log('AdvanceCard: Successfully extracted:', extractedDate);
				return extractedDate;
			} else {
				console.log('AdvanceCard: Failed to extract date from:', eventIdToCheck);
			}
		}
		
		// Fallback
		console.log('AdvanceCard: Using fallback TBD');
		return 'TBD';
	})();

	function handleEdit() {
		dispatch('edit', { event });
	}

	function handleCardClick() {
		dispatch('click', { event });
	}

	// Handle progress bar updates from child component
	function handleProgressUpdate(updateEvent) {
		const { event: updatedEvent } = updateEvent.detail;
		// Update local event data with fresh data from DB
		event = { ...event, ...updatedEvent };
		console.log('📊 AdvanceCard: Progress updated for', event.artist_name);
		
		// Dispatch to parent component if needed
		dispatch('event-updated', { event });
	}

	// Handle progress bar errors
	function handleProgressError(errorEvent) {
		const { error } = errorEvent.detail;
		console.error('❌ AdvanceCard: Progress error for', event.artist_name, ':', error);
	}

	// Generate lime gradients only for poster placeholder
	const limeGradients = [
		'from-lime/80 to-lime/40',
		'from-lime/70 to-lime/30',
		'from-lime/90 to-lime/50',
		'from-lime/60 to-lime/20'
	];
	const randomGradient = limeGradients[Math.floor(Math.random() * limeGradients.length)];
</script>

<div
	class="bg-navbar rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group h-53"
	on:click={handleCardClick}
	on:keydown={(e) => e.key === 'Enter' && handleCardClick()}
	role="button"
	tabindex="0"
>
	<div class="flex gap-4 h-full">
		<div class="w-1/3 flex flex-col flex-shrink-0">
			<div
				class="w-full h-36 rounded-xl {event.poster ? 'bg-gray-900' : `bg-gradient-to-br ${randomGradient}`} flex items-center justify-center relative overflow-hidden flex-shrink-0"
			>
				{#if event.poster}
					<img src={event.poster} alt={event.artist_name} class="w-full h-full object-cover rounded-xl" />
				{:else}
					<div class="text-white text-center">
						<div class="w-6 h-6 mx-auto mb-1 opacity-40">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
								/>
							</svg>
						</div>
						<div class="text-xs opacity-60 font-bold">Poster</div>
					</div>
				{/if}
			</div>

			<div
				class="bg-gray3 text-black px-2 py-1 rounded-lg text-center font-bold text-xs mt-3 flex-shrink-0"
			>
				{displayDate}
			</div>
		</div>

		<div class="w-2/3 flex flex-col min-w-0 overflow-hidden h-full">
			<div class="flex items-start justify-between mb-2">
				<div class="flex-1 min-w-0 pr-2">
					<h3 class="text-white text-lg font-bold truncate leading-tight">{event.artist_name}</h3>
					{#if event.artist_type}
						<p class="text-gray2 text-sm mt-0.5">{event.artist_type}</p>
					{/if}
				</div>

				<button
					on:click|stopPropagation={handleEdit}
					class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
					aria-label="Edit event"
				>
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
					</svg>
				</button>
			</div>

			<div class="mb-2">
				<ProgressBar 
					bind:this={progressBarRef}
					{event} 
					showLabel={true}
					labelSize="text-base"
					barHeight="h-2"
					maxWidth="max-w-none"
					labelColor="text-lime"
					barColor="bg-lime"
					trackColor="bg-gray1"
					on:progress-updated={handleProgressUpdate}
					on:progress-error={handleProgressError}
				/>
			</div>

			<div class="flex-1 min-h-0 overflow-hidden">
				<h4 class="text-white text-sm font-bold mb-2">To do:</h4>
				<div class="tags-container overflow-y-auto pr-1 h-16">
					<div class="flex flex-wrap gap-2 justify-start">
						{#each event.tags as tag}
							<span
								class="tag-item bg-transparent border border-lime text-lime px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer flex-shrink-0 min-w-fit"
							>
								{tag}
							</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
  .tag-item {
    background-color: transparent;
    border: 1px solid var(--color-lime);
    color: var(--color-lime);
  }

  .tag-item:hover {
    background-color: var(--color-lime) !important;
    color: var(--color-black) !important;
  }

  /* Custom scrollbar styles matching your design */
  .tags-container {
    scrollbar-width: auto;
    scrollbar-color: var(--color-lime) transparent;
  }

  .tags-container::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .tags-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .tags-container::-webkit-scrollbar-thumb {
    background: var(--color-lime);
    border-radius: 3px;
    border: none;
  }

  .tags-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-lime);
    opacity: 0.9;
  }

  .tags-container::-webkit-scrollbar-corner {
    background: transparent;
  }
</style>