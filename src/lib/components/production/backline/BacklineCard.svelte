<script>
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';

	export let event = {
		id: '',
		artist_name: 'Artist Name',
		date: 'August 30',
		poster: null,
		artist_type: null,
		tech_rider: null,
		sfx_rider: null,
		event_venue: null,
		rider_files: null
	};
	const dispatch = createEventDispatcher();

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
		if (eventIdStr.startsWith('90') && eventIdStr.length === 10) {
			dateStr = eventIdStr.substring(2);
		} else if (eventIdStr.startsWith('1') && eventIdStr.length === 9) {
			const withoutPrefix = eventIdStr.substring(1);
			const possibleMonth = withoutPrefix.substring(withoutPrefix.length - 4, withoutPrefix.length - 2);
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

	// Get display date
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
	// Check if tech rider URL exists
	$: techRiderUrl = (() => {
		const riderFiles = parseJson(event.rider_files);
		return riderFiles?.tech_rider_url || null;
	})();
	// Parse tech rider and create backline list
	$: backlineItems = (() => {
		const techRider = parseJson(event.tech_rider);
		if (!techRider || !techRider.equipment) return [];

		const items = [];
		
		// Add mixer first
		if (techRider.selected_mixer) {
			items.push({ name: techRider.selected_mixer, type: 'mixer' });
		}

		// Add CDJs
		Object.entries(techRider.equipment).forEach(([key, value]) => {
			if (value.selected && key.toLowerCase().includes('cdj')) {
				const display = value.editableQty && value.qty > 1 ? `${value.qty}x ${key}` : key;
				items.push({ name: display, type: 'cdj' });
			}
		});

		// Add RMX
		Object.entries(techRider.equipment).forEach(([key, value]) => {
			if (value.selected && key.toLowerCase().includes('rmx')) {
				const display = value.editableQty && value.qty > 1 ? `${value.qty}x ${key}` : key;
				items.push({ name: display, type: 'rmx' });
			}
		});

		// Add Mics
		Object.entries(techRider.equipment).forEach(([key, value]) => {
			if (value.selected && key.toLowerCase().includes('mic')) {
				const display = value.editableQty && value.qty > 1 ? `${value.qty}x ${key}` : key;
				items.push({ name: display, type: 'mic' });
			}
		});
		// Add everything else
		Object.entries(techRider.equipment).forEach(([key, value]) => {
			if (value.selected && 
				!key.toLowerCase().includes('cdj') && 
				!key.toLowerCase().includes('rmx') && 
				!key.toLowerCase().includes('mic')) {
				const display = value.editableQty && value.qty > 1 ? `${value.qty}x ${key}` : key;
				items.push({ name: display, type: 'other' });
			}
		});
		return items;
	})();

	// Parse SFX rider and create SFX list
	$: sfxItems = (() => {
		// Check if venue is Bazart
		if (event.event_venue === 'Bazart') {
			return [{ name: 'No SFX available for this event', type: 'none' }];
		}

		const sfxRider = parseJson(event.sfx_rider);
		if (!sfxRider) return [];

		const items = [];

		// Check each SFX type
		if (sfxRider.cryo_jets?.enabled) {
			const duration = sfxRider.cryo_jets.duration ? ` - ${sfxRider.cryo_jets.duration}sec` : '';
			items.push({ name: `${sfxRider.cryo_jets.qty}x Cryo Jets${duration}`, type: 'sfx' });
		}

		if (sfxRider.sparkulars?.enabled) {
			const duration = sfxRider.sparkulars.duration ? ` - ${sfxRider.sparkulars.duration}sec` : '';
			items.push({ name: `${sfxRider.sparkulars.qty}x Sparkulars${duration}`, type: 'sfx' });
		}

		if (sfxRider.lasers?.enabled) {
			items.push({ name: `${sfxRider.lasers.qty}x Lasers`, type: 'sfx' });
		}

		// Add other custom SFX items
		if (sfxRider.other && Array.isArray(sfxRider.other)) {
			sfxRider.other.forEach(item => {
				if (item.text) {
					items.push({ name: item.text, type: 'sfx' });
				}
			});
		}

		return items;
	})();

	function handleViewRider(e) {
		e.stopPropagation();
		if (techRiderUrl) {
			// Generate formatted filename with date, venue, and artist
			let formattedFileName = '';
			// Format the date if available
			if (event.event_date) {
				try {
					const date = new Date(event.event_date.replace(/-/g, '/'));
					const day = date.getDate();
					const month = date.toLocaleString('en-US', { month: 'short' });
					const year = date.getFullYear();
					formattedFileName = `${day}-${month}-${year}`;
				} catch (error) {
					console.error('Error formatting date:', error);
				}
			}
			
			// Add venue if available (use NCG for New City Gas)
			const venue = event.event_venue || event.venue;
			if (venue) {
				const venueName = venue === 'New City Gas' ? 'NCG' : venue;
				formattedFileName += formattedFileName ? ` - ${venueName}` : venueName;
			}
			
			// Add artist name
			formattedFileName += formattedFileName ? ` - ${event.artist_name}` : event.artist_name;
			// Add Tech Rider suffix
			formattedFileName += ' - Tech Rider.pdf';
			// Dispatch event to parent to handle modal (so it renders outside card)
			dispatch('view-rider', {
				fileUrl: techRiderUrl,
				fileName: formattedFileName
			});
		}
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

<div class="bg-navbar rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group h-[255px]">
	<div class="flex gap-4 h-full">
		<div class="w-1/3 flex flex-col flex-shrink-0">
			<div
				class="w-full h-46 rounded-xl {event.poster ? 'bg-gray-900' : `bg-gradient-to-br ${randomGradient}`} flex items-center justify-center relative overflow-hidden flex-shrink-0"
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

				{#if techRiderUrl}
					<button
						class="rider-button p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
						on:click={handleViewRider}
						aria-label="View tech rider"
					>
						<svg
							class="w-4 h-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
							<polyline points="14 2 14 8 20 8" />
							<line x1="16" y1="13" x2="8" y2="13" />
							<line x1="16" y1="17" x2="8" y2="17" />
							<polyline points="10 9 9 9 8 9" />
						</svg>
					</button>
				{/if}
			</div>

			<div class="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
				<div>
					<h4 class="text-white text-sm font-bold mb-1.5">Backline Confirmed:</h4>
					{#if backlineItems.length > 0}
						<ul class="space-y-0.5">
							{#each backlineItems as item}
								<li class="text-gray2 text-xs flex items-start">
									<span class="text-lime mr-2">•</span>
									<span>{item.name}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-gray2 text-xs">No backline confirmed</p>
					{/if}
				</div>

				<div>
					<h4 class="text-white text-sm font-bold mb-1.5">SFX Confirmed:</h4>
					{#if sfxItems.length > 0}
						<ul class="space-y-0.5">
							{#each sfxItems as item}
								<li class="text-gray2 text-xs flex items-start">
									<span class="text-lime mr-2">•</span>
									<span>{item.name}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-gray2 text-xs">No SFX confirmed</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Custom lime scrollbar styles */
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #E1FF00 transparent;
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #E1FF00;
		border-radius: 3px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #E1FF00;
		opacity: 0.8;
	}
</style>