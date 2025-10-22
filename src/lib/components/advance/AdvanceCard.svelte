<script>
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';
	import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';
	export let event = {
		id: '',
		artist_name: 'Artist Name',
		date: 'August 30',
		progress: 75,
		poster: null,
		tags: [],
		artist_type: null,
		notes: null
	};

	const dispatch = createEventDispatcher();
	// Component references
	let progressBarRef;

	// Helper function to parse JSON
	function parseJson(data) {
		if (!data) return null;
		if (typeof data === 'object') return data;
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch (e) {
				return null;
			}
		}
		return null;
	}

	// Function to extract date from custom event ID
	function extractDateFromEventId(eventId) {
		const eventIdStr = String(eventId);

		let dateStr = null;
		// Check for new format: 90YYYYMMDD (10 digits starting with 90)
		if (eventIdStr.startsWith('90') && eventIdStr.length === 10) {
			dateStr = eventIdStr.substring(2);
		}
		// Check for old format: 1YMMDDDD (9 digits starting with 1) - try flexible parsing
		else if (eventIdStr.startsWith('1') && eventIdStr.length === 9) {
			const withoutPrefix = eventIdStr.substring(1);

			// Try to extract month and day from the end (last 4 digits)
			const possibleMonth = withoutPrefix.substring(
				withoutPrefix.length - 4,
				withoutPrefix.length - 2
			);
			const possibleDay = withoutPrefix.substring(withoutPrefix.length - 2);

			// Current year as fallback
			const currentYear = new Date().getFullYear();
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
			try {
				// Create date using ISO format (YYYY-MM-DD) to avoid timezone issues
				const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
				const date = new Date(isoDate);

				// Check if date is valid
				if (isNaN(date.getTime())) {
					return null;
				}

				const formattedDate = date.toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric'
				});

				return formattedDate;
			} catch (error) {
				console.error('Error parsing date from event ID:', error);
				return null;
			}
		}

		return null;
	}

	function generateSmartTags(event) {
		const tags = [];

		// Check Rider to Mihir FIRST - this should always show if false, regardless of completion status
		const hospoRider = parseJson(event.hospo_rider);
		if (hospoRider && hospoRider.rider_sent_to_mihir === false) {
			tags.push('Rider to Mihir');
		}

		// If the advance is already marked as 'Completed', show completed tag along with any others
		if (event.advance_status === 'Completed') {
			tags.push('Advance Completed ✓');
			return tags; // Return with both "Rider to Mihir" (if applicable) and "Advance Completed"
		}

		// If advance status is "To Do", only show "Advance to start"
		if (!event.advance_status || event.advance_status === 'To Do') {
			return ['Advance to start'];
		}

		// Once advance is "Asked", show specific missing items

		// Check Contact
		if (!event.main_contact) {
			tags.push('DOS');
		}

		// Check Contract
		if (!event.contract || !event.contract_url) {
			tags.push('Contract');
		}

		// Check Role List
		const roles = parseJson(event.roles);
		if (!roles || !Array.isArray(roles) || roles.length === 0) {
			tags.push('Role List');
		}

		// ROS (Running Order/Set Times) Logic
		const timetable = parseJson(event.timetable);
		let isRosConfirmed = false;
		if (timetable && Array.isArray(timetable) && event.artist_name) {
			const cardArtist = event.artist_name.trim().toLowerCase();

			isRosConfirmed = timetable.some((slot) => {
				if (!slot.artist || !slot.status) return false;

				const slotArtist = slot.artist.trim().toLowerCase();
				const statusLower = slot.status.toLowerCase();

				// Check if the timetable entry contains "b2b"
				if (slotArtist.includes('b2b')) {
					// Split by "b2b" and check if any part matches the card artist
					const artistParts = slotArtist.split(/b2b/i).map((part) => part.trim());
					const artistMatches = artistParts.some(
						(part) => part === cardArtist || part.includes(cardArtist) || cardArtist.includes(part)
					);
					return artistMatches && statusLower === 'confirmed';
				}

				// Regular exact match
				return slotArtist === cardArtist && statusLower === 'confirmed';
			});
		}
		if (!isRosConfirmed) {
			tags.push('ROS');
		}

		// Check Passports (for roles requiring immigration)
		if (roles && Array.isArray(roles)) {
			const rolesNeedingPassports = roles.filter((r) => r.immigration === true);
			if (rolesNeedingPassports.length > 0) {
				const passportInfo = parseJson(event.passport_info);
				const passports = passportInfo
					? Array.isArray(passportInfo)
						? passportInfo
						: [passportInfo]
					: [];
				const completePassports = rolesNeedingPassports.filter((role) => {
					return passports.some(
						(p) => p.id === role.id && p.passportNumber && p.givenName && p.lastName
					);
				});
				if (completePassports.length < rolesNeedingPassports.length) {
					tags.push('Passports');
				}
			}
		}

		// Check Immigration Status
		if (event.immigration_status === 'Waiting') {
			tags.push('Immigration waiting');
		} else if (!event.immigration_status || event.immigration_status === 'To Do') {
			if (roles && Array.isArray(roles)) {
				const needsImmigration = roles.some((r) => r.immigration === true);
				if (needsImmigration) {
					tags.push('Immigration');
				}
			}
		}

		// Check Flights
		const groundInfo = parseJson(event.ground_info);
		const flightsEnabled = event.flights_enabled !== false;
		if (flightsEnabled) {
			const hasArrivals = groundInfo?.arrivals && groundInfo.arrivals.length > 0;
			const hasDepartures = groundInfo?.departures && groundInfo.departures.length > 0;
			if (!hasArrivals || !hasDepartures) {
				tags.push('Flights');
			}
		}

		// Check Hotels
		const hotelsEnabled = event.hotel_enabled !== false;
		if (hotelsEnabled) {
			const hotelInfo = parseJson(event.hotel_info);
			if (!hotelInfo || !Array.isArray(hotelInfo) || hotelInfo.length === 0) {
				tags.push('Hotels');
			} else {
				const allConfirmed = hotelInfo.every(
					(h) => h.confirmationNumber && h.confirmationNumber.trim() !== ''
				);
				if (!allConfirmed) {
					tags.push('Hotels');
				}
			}
		}

		// Check Rider Files
		const riderFiles = parseJson(event.rider_files);
		if (!riderFiles || !riderFiles.tech_rider_url) {
			tags.push('Rider');
		} else if (riderFiles.hospitality_included === 'No' && !riderFiles.hospo_rider_url) {
			tags.push('Rider');
		}

		// Soundcheck Logic
		const soundcheck = parseJson(event.soundcheck);
		if (soundcheck && soundcheck.status) {
			const status = soundcheck.status.toLowerCase();
			if (status === 'tbd') {
				tags.push('Soundcheck TBD');
			} else if (status === 'asked') {
				tags.push('Soundcheck asked');
			}
		}

		// Check for VJ to determine if visuals are needed
		const hasVJ = roles && Array.isArray(roles) && roles.some((r) => r.role === 'VJ');
		// Check Visuals (skip for Bazart venue or if a VJ is assigned)
		if (event.event_venue !== 'Bazart' && !hasVJ) {
			if (!event.visual_received) {
				tags.push('Visuals');
			}
		}

		// If everything is done but status isn't completed
		if (tags.length === 0 && event.advance_status !== 'Completed') {
			tags.push('Mark as completed');
		}

		return tags;
	}

	// Get display date
	$: displayDate = (() => {
		// First, try the regular date field
		if (event.date && event.date !== 'TBD') {
			return event.date;
		}

		// If no date, try to extract from event_id (for custom events)
		if (event.event_id || event.id) {
			const eventIdToCheck = event.event_id || event.id;
			const extractedDate = extractDateFromEventId(eventIdToCheck);
			if (extractedDate) {
				return extractedDate;
			}
		}

		// Fallback
		return 'TBD';
	})();
	// Generate smart tags instead of using static tags
	$: smartTags = generateSmartTags(event);

	// NEW: Generate tags from notes
	$: noteTags = (() => {
		const parsed = parseJson(event.notes);
		return Array.isArray(parsed) ? parsed.map((n) => n.text) : [];
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
				class="w-full h-36 rounded-xl {event.poster
					? 'bg-gray-900'
					: `bg-gradient-to-br ${randomGradient}`} flex items-center justify-center relative overflow-hidden flex-shrink-0"
			>
				{#if event.poster}
					<img
						src={event.poster}
						alt={event.artist_name}
						class="w-full h-full object-cover rounded-xl"
					/>
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
				<div class="tags-container overflow-y-auto overflow-x-visible pr-1 h-16">
					<div class="flex flex-wrap gap-2 justify-start pb-1">
						{#each noteTags as tag}
							<span
								class="tag-item rounded-full border border-gray2 bg-gray2/20 px-3 py-1 text-xs font-bold text-gray2"
							>
								{tag}
							</span>
						{/each}

						{#if smartTags.length === 0}
							<span
								class="tag-item whitespace-nowrap rounded-full border border-lime bg-lime/20 px-3 py-1 text-xs font-bold text-lime"
							>
								Advance Completed ✓
							</span>
						{:else}
							{#each smartTags as tag}
								<span
									class="tag-item {tag === 'Advance to start'
										? 'bg-problem/20 border-problem text-problem'
										: tag.includes('waiting')
											? 'bg-tentatif/20 border-tentatif text-tentatif'
											: 'bg-transparent border-lime text-lime'} 
									        min-w-fit flex-shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition-all duration-200"
								>
									{tag}
								</span>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.tag-item {
		transition: all 0.2s ease;
	}

	.tag-item:hover {
		/* Removed transform: scale(1.05); to prevent clipping */
		opacity: 0.9;
	}

	.tag-item.border-lime:hover {
		background-color: var(--color-lime) !important;
		color: var(--color-black) !important;
	}

	.tag-item.border-problem {
		border-color: var(--color-problem);
	}

	.tag-item.border-problem:hover {
		background-color: var(--color-problem) !important;
		color: var(--color-black) !important;
	}

	.tag-item.border-tentatif {
		border-color: var(--color-tentatif);
	}

	.tag-item.border-tentatif:hover {
		background-color: var(--color-tentatif) !important;
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
