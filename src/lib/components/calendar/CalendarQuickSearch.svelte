<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { cubicOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import type { StageConfig, CalendarEvent } from '$lib/types/calendar-types';

	export let show = false;
	export let canEdit = false;

	let inputRef: HTMLInputElement;
	let searchQuery = '';
	let isLoading = false;
	let hasLoaded = false;

	let allGroupedEvents: any[] = [];
	let results: any[] = [];
	let venuesConfig: any[] = [];

	onMount(async () => {
		const { data } = await supabase.from('calendar_settings').select('*');
		if (data) venuesConfig = data;
	});

	// Load all events ONCE when the modal is first opened to allow robust client-side searching
	// Run loadEvents only when show changes to true
	$: if (show) {
		if (!hasLoaded && !isLoading) {
			loadEvents();
		}
		tick().then(() => inputRef?.focus());
	}

	$: if (show) {
		tick().then(() => inputRef?.focus());
	}

	// Trigger search filter automatically as the user types
	$: if (hasLoaded) {
		filterResults(searchQuery);
	}

	async function loadEvents() {
		isLoading = true;
		try {
			// 🔥 FIX: Added calendar(title, details) to join the parent table
			// and removed 'title' and 'details' from the root selection
			const { data, error } = await supabase
				.from('calendar_events')
				.select(
					`
        id, 
        short_id, 
        group_id, 
        date, 
        status, 
        hold_level, 
        venue, 
        event_details,
        calendar ( title, details )
    `
				)
				.neq('status', 'HIDDEN') // 🔥 Added this line to exclude hidden events
				.order('date', { ascending: true });

			if (error) throw error;

			// Group events by group_id
			const groups: Record<string, any[]> = {};
			(data || []).forEach((event) => {
				const gid = event.group_id || event.id;
				if (!groups[gid]) groups[gid] = [];
				groups[gid].push(event);
			});

			// Map groups to a searchable format
			allGroupedEvents = Object.values(groups).map((events) => {
				const firstEvent = events[0];
				const holds = events.filter((e) => e.status === 'HOLD' || e.status === 'PENDING');

				// Venue parsing
				const venueObj =
					typeof firstEvent.venue === 'string'
						? JSON.parse(firstEvent.venue)
						: firstEvent.venue || {};
				const venueName = venueObj.category || 'Unknown Venue';
				const roomName = venueObj.room || '';

				// Determine Stage Color
				let stageColor = '#4B5563'; // Default Gray
				const setting = venuesConfig.find((v) => v.setting_name === venueName);
				if (setting) {
					const params =
						typeof setting.setting_params === 'string'
							? JSON.parse(setting.setting_params)
							: setting.setting_params;
					const stage = params.stages?.find((s: any) => s.name === roomName);
					if (stage?.color) stageColor = stage.color;
				}

				// Format Dates
				const sortedDates = [...new Set(events.map((e) => e.date))].sort();
				const formattedDates = sortedDates.map((d) => formatDateStr(d));

				let dateDisplay = formattedDates.length > 0 ? formattedDates[0] : 'TBD';
				if (formattedDates.length > 1) {
					dateDisplay += ` (+${formattedDates.length - 1})`;
				}

				// 🔥 FIX: Read title and type from the joined calendar object
				const rawTitle = firstEvent.calendar?.title || '';
				const rawType = firstEvent.calendar?.details?.type || '';

				return {
					id: firstEvent.group_id || firstEvent.id,
					short_id: firstEvent.short_id,
					title: rawTitle,
					formattedTitle: formatEventTitle(firstEvent),
					status: firstEvent.status,
					hold_level: firstEvent.hold_level,
					venueName,
					roomName,
					eventType: rawType,
					stageColor,
					holdsCount: holds.length,
					dateDisplay,
					allFormattedDates: formattedDates.join(' '), // Used for searching
					eventDetails: firstEvent.event_details || {},
					// Keep reference to raw event for BodyMonth UI rules
					rawEvent: firstEvent
				};
			});

			hasLoaded = true;
		} catch (err) {
			console.error('Failed to load events for search:', err);
		} finally {
			isLoading = false;
		}
	}

	// Normalizes string to ignore accents and uppercase
	function normalize(str: string) {
		return (str || '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function filterResults(query: string) {
		if (!query.trim()) {
			results = [];
			return;
		}

		const searchTerms = normalize(query)
			.split(/\s+/)
			.filter((t) => t.length > 0);

		results = allGroupedEvents
			.filter((item) => {
				// Combine all searchable fields into one giant normalized string
				const searchableString = normalize(`
				${item.title} 
				${item.venueName} 
				${item.roomName} 
				${item.eventType} 
				${item.allFormattedDates}
			`);

				// Ensure EVERY term typed by the user exists somewhere in the event's data
				return searchTerms.every((term) => searchableString.includes(term));
			})
			.slice(0, 20); // Limit to top 20 for UI performance
	}

	// Format "YYYY-MM-DD" to "16 Sep 2026"
	function formatDateStr(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// BodyMonth Title Formatting Logic
	function formatEventTitle(event: any): string {
		// 🔥 FIX: Look for title and details inside the calendar join
		const title = event.calendar?.title || event.title || '';
		const eventType = event.calendar?.details?.type || event.details?.type;

		if (eventType === 'Corpo') return `Corpo - ${title}`;
		if (event.status !== 'CONFIRMED') return title;
		if (!eventType) return title;

		const prefixTypes = ['NCG 360', 'DSTRKT'];
		if (prefixTypes.includes(eventType)) {
			const displayType = eventType === 'NCG 360' ? 'NCG360' : eventType;
			return `${displayType} - ${title}`;
		}
		if (eventType === 'Bazart Nuits') return `${title} - Nuits Bazart`;
		return title;
	}

	function formatLabel(event: CalendarEvent): string {
		if (event.status === 'HIDDEN') return 'H';
		if (event.status === 'HOLD' && event.hold_level) return event.hold_level;
		if (event.hold_level === 'P') return 'P';
		return '';
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		if (!canEdit) return;
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			show = true;
		}
	}

	function closeSearch() {
		show = false;
		searchQuery = '';
		results = [];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeSearch();
	}

	function navigateToEvent(shortId: number) {
		if (!shortId) return;
		goto(`/calendar/${shortId}`);
		closeSearch();
	}
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div use:portal>
	{#if show}
		<div
			class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[10000] flex items-center justify-center p-4"
			transition:fade={{ duration: 200, easing: cubicOut }}
			on:click|self={closeSearch}
			role="button"
			tabindex="0"
			on:keydown={handleKeydown}
		>
			<div
				class="bg-gray1 border border-gray2/20 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[50vh]"
				transition:fly={{ y: 20, duration: 200, easing: cubicOut }}
			>
				<div class="flex items-center px-6 py-5 border-b border-gray2/10 shrink-0">
					<svg
						class="w-6 h-6 text-lime mr-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input
						bind:this={inputRef}
						bind:value={searchQuery}
						type="text"
						placeholder="Search by event, date, venue, or type..."
						class="flex-1 bg-transparent text-white text-lg placeholder-gray2/50 focus:outline-none"
					/>
					<div
						class="px-2 py-1 bg-gray2/10 rounded-md text-[10px] text-gray2 font-bold uppercase tracking-wider ml-4"
					>
						ESC
					</div>
				</div>

				<div class="flex-1 overflow-y-auto custom-scrollbar">
					{#if isLoading}
						<div class="p-10 text-center text-gray2 text-sm font-bold flex flex-col items-center">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime mb-4"></div>
							Loading calendar events...
						</div>
					{:else if results.length > 0}
						<div class="flex flex-col py-2">
							{#each results as item}
								<button
									class="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-gray2/5 last:border-0"
									on:click={() => navigateToEvent(item.short_id)}
								>
									<div class="flex items-center gap-3 w-1/2">
										{#if item.status === 'CANCELED'}
											<div
												class="w-6 h-6 shrink-0 rounded-[4px] border border-problem/50 flex items-center justify-center bg-transparent"
											>
												<svg
													class="w-3.5 h-3.5 text-problem"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="4"
												>
													<line x1="18" y1="6" x2="6" y2="18"></line><line
														x1="6"
														y1="6"
														x2="18"
														y2="18"
													></line>
												</svg>
											</div>
											<div class="flex flex-col items-start text-left truncate">
												<span class="text-problem font-bold text-sm line-through truncate"
													>{item.formattedTitle}</span
												>
												<span class="text-gray2 text-xs font-medium truncate"
													>{item.venueName} {item.roomName ? `/ ${item.roomName}` : ''}</span
												>
											</div>
										{:else if item.status === 'CONFIRMED'}
											<div
												class="w-6 h-6 shrink-0 rounded-[4px] flex items-center justify-center text-black"
												style="background-color: {item.stageColor};"
											>
												<svg
													class="w-3.5 h-3.5"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="4"
												>
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											</div>
											<div class="flex flex-col items-start text-left truncate">
												<span class="text-white font-bold text-sm truncate"
													>{item.formattedTitle}</span
												>
												<span class="text-gray2 text-xs font-medium truncate"
													>{item.venueName} {item.roomName ? `/ ${item.roomName}` : ''}</span
												>
											</div>
										{:else if item.status === 'HIDDEN'}
											<div
												class="w-6 h-6 shrink-0 rounded-[4px] border border-gray3/30 flex items-center justify-center text-gray3 font-black text-xs bg-transparent"
											>
												{formatLabel(item.rawEvent)}
											</div>
											<div class="flex flex-col items-start text-left truncate">
												<span class="text-gray3 font-bold text-sm truncate"
													>{item.formattedTitle}</span
												>
												<span class="text-gray2 text-xs font-medium truncate"
													>{item.venueName} {item.roomName ? `/ ${item.roomName}` : ''}</span
												>
											</div>
										{:else}
											<div
												class="w-6 h-6 shrink-0 rounded-[4px] border-2 bg-transparent flex items-center justify-center font-black text-xs"
												style="border-color: {item.stageColor}; color: {item.stageColor};"
											>
												{formatLabel(item.rawEvent)}
											</div>
											<div class="flex flex-col items-start text-left truncate">
												<div class="flex items-center gap-1.5">
													<span class="text-white font-bold text-sm truncate"
														>{item.formattedTitle}</span
													>

													{#if item.eventDetails?.is_target}
														<svg
															class="w-3.5 h-3.5 text-confirmed shrink-0"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"
															></circle><circle cx="12" cy="12" r="2"></circle>
														</svg>
													{/if}
													{#if item.eventDetails?.is_challenge}
														<svg
															class="w-3.5 h-3.5 text-tentatif shrink-0"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
														</svg>
													{/if}
												</div>
												<span class="text-gray2 text-xs font-medium truncate"
													>{item.venueName} {item.roomName ? `/ ${item.roomName}` : ''}</span
												>
											</div>
										{/if}
									</div>

									<div class="flex items-center justify-end gap-4 w-1/2">
										{#if item.status !== 'CONFIRMED' && item.status !== 'CANCELED'}
											<span
												class="px-2.5 py-1 rounded-md border border-gray2/20 text-gray2 text-xs font-bold whitespace-nowrap"
											>
												{item.holdsCount} Hold{item.holdsCount !== 1 ? 's' : ''}
											</span>
										{:else if item.status === 'CONFIRMED'}
											<span
												class="px-2.5 py-1 rounded-md bg-white/5 text-gray2 text-xs font-bold whitespace-nowrap"
											>
												Confirmed
											</span>
										{/if}
										<span class="text-white text-sm font-bold w-32 text-right whitespace-nowrap"
											>{item.dateDisplay}</span
										>
									</div>
								</button>
							{/each}
						</div>
					{:else if searchQuery && !isLoading}
						<div class="p-10 text-center text-gray2 text-sm font-bold">
							No events found matching "{searchQuery}"
						</div>
					{:else}
						<div
							class="p-10 text-center text-gray2 text-sm font-bold h-full flex flex-col items-center justify-center"
						>
							<svg
								class="w-8 h-8 text-gray2/30 mb-3"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="11" cy="11" r="8"></circle>
								<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
							</svg>
							Quick search any event here
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(247, 247, 247, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>
