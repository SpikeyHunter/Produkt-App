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
	let progressBarRef;

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

	// Follow Up logic
	$: followUps = parseJson(event.follow_up) || [];
	$: latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;

	function formatFollowUpDate(isoString) {
		if (!isoString) return '';
		const d = new Date(isoString);
		const month = d.toLocaleDateString('en-US', { month: 'long' });
		const day = d.getDate();
		const year = d.getFullYear();

		let hours = d.getHours();
		const minutes = d.getMinutes().toString().padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		hours = hours % 12;
		hours = hours ? hours : 12;

		const suffix =
			['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : (((day % 100) - (day % 10) !== 10) * day) % 10] ||
			'th';
		return `${month} ${day}${suffix}, ${year} - ${hours}:${minutes}${ampm}`;
	}

	function formatShortDate(isoString) {
		if (!isoString) return '';
		const d = new Date(isoString);
		return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
	}

	$: progressStyles = (() => {
		const p = parseInt(event.progress) || 0;

		if (p === 100) {
			return {
				label: 'text-[var(--color-confirmed)]',
				bar: 'bg-[var(--color-confirmed)]'
			};
		} else if (
			event.advance_status === 'To Do' ||
			!event.advance_status ||
			(p === 0 && event.advance_status !== 'Asked')
		) {
			return {
				label: 'text-[var(--color-problem)]',
				bar: 'bg-[var(--color-problem)]'
			};
		} else {
			return { label: 'text-lime', bar: 'bg-lime' };
		}
	})();

	function extractDateFromEventId(eventId) {
		const eventIdStr = String(eventId);
		let dateStr = null;

		if (eventIdStr.startsWith('90') && eventIdStr.length === 10) {
			dateStr = eventIdStr.substring(2);
		} else if (eventIdStr.startsWith('1') && eventIdStr.length === 9) {
			const withoutPrefix = eventIdStr.substring(1);
			const possibleMonth = withoutPrefix.substring(
				withoutPrefix.length - 4,
				withoutPrefix.length - 2
			);
			const possibleDay = withoutPrefix.substring(withoutPrefix.length - 2);
			const currentYear = new Date().getFullYear();

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
				const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
				const date = new Date(isoDate);
				if (isNaN(date.getTime())) {
					return null;
				}

				return date.toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric'
				});
			} catch (error) {
				console.error('Error parsing date from event ID:', error);
				return null;
			}
		}
		return null;
	}

	function generateSmartTags(event) {
		const tags = [];
		const hospoRider = parseJson(event.hospo_rider);
		if (hospoRider && hospoRider.rider_sent_to_mihir === false) {
			tags.push('Rider to Mihir');
		}

		if (event.advance_status === 'Completed') {
			tags.push('Advance Completed ✓');
			return tags;
		}

		if (!event.advance_status || event.advance_status === 'To Do') {
			return ['Advance to start'];
		}

		if (!event.main_contact) {
			tags.push('DOS');
		}

		// Check all possible contract URL fields from events_contract, plus the old fallback
		const hasContractFile =
			event.original_contract_url ||
			event.signed_contract_url ||
			event.redlined_contract_url ||
			event.contract_url;

		if (!event.contract || !hasContractFile) {
			tags.push('Contract');
		}

		const roles = parseJson(event.roles);
		if (!roles || !Array.isArray(roles) || roles.length === 0) {
			tags.push('Role List');
		}

		const timetable = parseJson(event.timetable);
		let isRosConfirmed = false;
		if (timetable && Array.isArray(timetable) && event.artist_name) {
			const cardArtist = event.artist_name.trim().toLowerCase();
			isRosConfirmed = timetable.some((slot) => {
				if (!slot.artist || !slot.status) return false;

				const slotArtist = slot.artist.trim().toLowerCase();
				const statusLower = slot.status.toLowerCase();

				if (slotArtist.includes('b2b')) {
					const artistParts = slotArtist.split(/b2b/i).map((part) => part.trim());
					const artistMatches = artistParts.some(
						(part) => part === cardArtist || part.includes(cardArtist) || cardArtist.includes(part)
					);
					return artistMatches && statusLower === 'confirmed';
				}

				return slotArtist === cardArtist && statusLower === 'confirmed';
			});
		}
		if (!isRosConfirmed) {
			tags.push('ROS');
		}

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

		const groundInfo = parseJson(event.ground_info);
		const flightsEnabled = event.flights_enabled !== false;
		if (flightsEnabled) {
			const hasArrivals = groundInfo?.arrivals && groundInfo.arrivals.length > 0;
			const hasDepartures = groundInfo?.departures && groundInfo.departures.length > 0;
			if (!hasArrivals || !hasDepartures) {
				tags.push('Flights');
			}
		}

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

		const riderFiles = parseJson(event.rider_files);
		if (!riderFiles || !riderFiles.tech_rider_url) {
			tags.push('Rider');
		} else if (riderFiles.hospitality_included === 'No' && !riderFiles.hospo_rider_url) {
			tags.push('Rider');
		}

		const soundcheck = parseJson(event.soundcheck);
		if (soundcheck && soundcheck.status) {
			const status = soundcheck.status.toLowerCase();
			if (status === 'tbd') {
				tags.push('Soundcheck TBD');
			} else if (status === 'asked') {
				tags.push('Soundcheck asked');
			}
		}

		const hasVJ = roles && Array.isArray(roles) && roles.some((r) => r.role === 'VJ');
		if (event.event_venue !== 'Bazart' && !hasVJ) {
			if (!event.visual_received) {
				tags.push('Visuals');
			}
		}

		if (tags.length === 0 && event.advance_status !== 'Completed') {
			tags.push('Mark as completed');
		}

		return tags;
	}

	$: displayDate = (() => {
		if (event.date && event.date !== 'TBD') {
			return event.date;
		}

		if (event.event_id || event.id) {
			const eventIdToCheck = event.event_id || event.id;
			const extractedDate = extractDateFromEventId(eventIdToCheck);
			if (extractedDate) {
				return extractedDate;
			}
		}
		return 'TBD';
	})();
	$: smartTags = generateSmartTags(event);

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

	function handleProgressUpdate(updateEvent) {
		const { event: updatedEvent } = updateEvent.detail;
		event = { ...event, ...updatedEvent };
		console.log('📊 AdvanceCard: Progress updated for', event.artist_name);
		dispatch('event-updated', { event });
	}

	function handleProgressError(errorEvent) {
		const { error } = errorEvent.detail;
		console.error('❌ AdvanceCard: Progress error for', event.artist_name, ':', error);
	}

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
					: `bg-gradient-to-br ${randomGradient}`} flex items-center justify-center relative flex-shrink-0"
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

				{#if latestFollowUp && event.advance_status !== 'Completed'}
					<div
						class="absolute top-0 left-0 group/followup z-30"
						role="button"
						tabindex="0"
						on:click|stopPropagation
						on:keydown|stopPropagation
					>
						<span
							class="flex items-center gap-1 bg-problem text-black shadow-md rounded-tl-xl rounded-br-xl px-2 py-0.5 text-[10px] font-bold cursor-default whitespace-nowrap"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="w-3 h-3"
							>
								<path
									d="M3.464 2.222a.75.75 0 0 1 .919.528l.47 1.75h14.397a.75.75 0 0 1 .536 1.272l-3.327 3.228 3.327 3.228a.75.75 0 0 1-.536 1.272H5.66l.723 2.698a.75.75 0 0 1-1.446.388l-2.4-8.96a.75.75 0 0 1-.035-.152L1.87 3.14a.75.75 0 0 1 .528-.918Z"
								/>
							</svg>
							{formatShortDate(latestFollowUp.timestamp)}
						</span>

						<div
							class="absolute left-0 top-full mt-1 w-max min-w-[200px] bg-navbar border border-gray1 text-white text-xs rounded-xl p-3 shadow-xl opacity-0 invisible group-hover/followup:opacity-100 group-hover/followup:visible transition-all duration-200 pointer-events-none z-50"
						>
							<div class="font-bold text-gray3 mb-2 border-b border-gray1 pb-1">Follow-up:</div>
							<div class="flex flex-col gap-1 max-h-32 overflow-y-auto tags-container">
								{#each followUps as fu, i}
									<div class="py-0.5 text-[11px] whitespace-nowrap">
										<span class="text-gray2 font-bold">#{i + 1} -</span>
										{formatFollowUpDate(fu.timestamp)}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div
				class="bg-gray3 text-black px-2 py-1 rounded-lg text-center font-bold text-xs mt-3 flex-shrink-0"
			>
				{displayDate}
			</div>
		</div>

		<div class="w-2/3 flex flex-col min-w-0 h-full relative">
			<div class="flex items-start justify-between mb-2">
				<div class="flex-1 min-w-0 pr-2">
					<h3 class="text-white text-lg font-bold truncate leading-tight">{event.artist_name}</h3>
					{#if event.artist_type}
						<p class="text-gray2 text-sm mt-0.5">{event.artist_type}</p>
					{/if}
				</div>

				<div class="flex items-center gap-2 flex-shrink-0">
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
			</div>

			<div class="mb-2">
				<ProgressBar
					bind:this={progressBarRef}
					{event}
					showLabel={true}
					labelSize="text-base"
					barHeight="h-2"
					maxWidth="max-w-none"
					labelColor={progressStyles.label}
					barColor={progressStyles.bar}
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
									class="tag-item {event.advance_status === 'Completed'
										? 'bg-transparent border-[var(--color-confirmed)] text-[var(--color-confirmed)]'
										: tag === 'Advance to start'
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
