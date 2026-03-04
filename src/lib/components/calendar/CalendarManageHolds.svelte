<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, HoldLevel, VenueSettings } from '$lib/types/calendar-types';

	export let isOpen: boolean = false;
	export let events: CalendarEvent[] = [];
	export let venues: VenueSettings[] = [];
	export let draftEvents: CalendarEvent[] = [];
	export let deletedIds: string[] = [];

	// Ensure this is accepted as a prop!
	export let toggleDateTrigger: { date: string; ts: number } | null = null;

	const dispatch = createEventDispatcher();

	let saving = false;
	let holdPickerRef: HTMLElement;
	let activeHoldPicker: string | 'bulk' | null = null;
	const holdLevelsGrid = ['P', ...Array.from({ length: 20 }, (_, i) => `H${i + 1}`)];

	// Working state for the modal
	let drafts: any[] = [];
	let selectedRows: string[] = [];
	let isInitialized = false;

	$: allRowsSelected = selectedRows.length === drafts.length && drafts.length > 0;

	// Flatten venues into a simple list of stages for the dropdown
	$: availableStages = venues.flatMap((v) => {
		let stages = [];
		if (typeof v.setting_params === 'string') {
			try {
				stages = JSON.parse(v.setting_params).stages;
			} catch (e) {}
		} else {
			stages = v.setting_params?.stages;
		}
		return (stages || []).map((s: any) => ({
			category: v.setting_name,
			room: s.name,
			color: s.color
		}));
	});

	function generateSafeId(existingId?: string | null): string {
		return existingId || `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	function getVenueColor(category: string | undefined, room: string | undefined) {
		if (!category || !room) return '#828282';
		const stage = availableStages.find((s) => s.category === category && s.room === room);
		return stage ? stage.color : '#828282';
	}

	// Only initialize ONCE when opening. Prevents your clicks from being overwritten.

	$: if (isOpen && events && !isInitialized) {
		if (!saving) {
			isInitialized = true; // Lock immediately to prevent loops

			// 1. Immediately render the visible events we already have
			drafts = events
				.map((e) => ({
					id: generateSafeId(e.id),
					group_id: e.group_id,
					date: e.date,
					hold_level: e.hold_level || 'P',
					allDay: !e.time?.start,
					start: e.time?.start || '',
					end: e.time?.end || '',
					venue: e.venue,
					venueString: `${e.venue?.category}:::${e.venue?.room}`,
					title: e.title,
					isNew: !e.id // If it lacks a DB ID, flag it as a new draft
				}))
				.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

			deletedIds = [];
			selectedRows = [];
			activeHoldPicker = null;

			// 2. Fetch the off-screen dates for this group from the database
			if (events[0]?.group_id) {
				fetchFullGroup(events[0].group_id);
			}
		}
	}

	// Helper to pull the rest of the series from Supabase
	async function fetchFullGroup(groupId: string) {
		try {
			const { data, error } = await supabase
				.from('calendar_events')
				.select('*')
				.eq('group_id', groupId);

			if (data && data.length > 0) {
				const dbDrafts = data.map((e) => ({
					id: e.id,
					group_id: e.group_id,
					date: e.date,
					hold_level: e.hold_level || 'P',
					allDay: !e.time?.start,
					start: e.time?.start || '',
					end: e.time?.end || '',
					venue: e.venue,
					venueString: `${e.venue?.category}:::${e.venue?.room}`,
					title: e.title,
					isNew: false
				}));

				// Keep any newly clicked dates from the UI that aren't in the database yet
				const unsavedDrafts = drafts.filter(
					(d) => d.isNew && !data.some((dbE) => dbE.date === d.date)
				);

				// Merge DB data with local unsaved drafts
				drafts = [...dbDrafts, ...unsavedDrafts].sort(
					(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
				);
			}
		} catch (err) {
			console.error('Failed to fetch full group holds', err);
		}
	}

	// Reset initialization when closed
	$: if (!isOpen) {
		isInitialized = false;
	}

	// NEW: Keeps track of the last click so we don't infinitely loop!
	let lastProcessedTs = 0;

	// Watcher for calendar body clicks
	// Watcher for calendar body clicks
	$: if (toggleDateTrigger && toggleDateTrigger.ts !== lastProcessedTs) {
		lastProcessedTs = toggleDateTrigger.ts;
		handleDateToggle(toggleDateTrigger.date);
	}

	async function handleDateToggle(dateStr: string) {
		const existingDrafts = drafts.filter((d) => d.date === dateStr);

		if (existingDrafts.length > 0) {
			// If holds exist for this date, remove all of them (toggle off)
			existingDrafts.forEach((d) => removeDateRow(d.id));
		} else {
			// Add new date holds (toggle on) for ALL unique rooms

			// 1. Identify all unique venues from the initial `events` array
			const baseRoomsToCopy = [];
			const seenVenues = new Set();

			for (const ev of events) {
				let cat = '';
				let room = '';

				if (ev.venue) {
					if (typeof ev.venue === 'string') {
						try {
							const parsed = JSON.parse(ev.venue);
							cat = parsed.category || '';
							room = parsed.room || '';
						} catch (e) {}
					} else {
						cat = ev.venue.category || '';
						room = ev.venue.room || '';
					}
				}

				if (!cat || !room) {
					const parts = ((ev as any).venueString || ':::').split(':::');
					cat = parts[0];
					room = parts[1];
				}

				const vString = `${cat}:::${room}`;

				if (!seenVenues.has(vString) && cat && room) {
					seenVenues.add(vString);
					baseRoomsToCopy.push({
						category: cat,
						room: room,
						allDay: !ev.time?.start,
						start: ev.time?.start || '',
						end: ev.time?.end || '',
						group_id: ev.group_id,
						title: ev.title
					});
				}
			}

			if (baseRoomsToCopy.length === 0) return; // Failsafe if no rooms found

			// 2. Query the Database ONCE for ALL events on this specific date
			const dbTakenHolds = [];
			try {
				const { data, error } = await supabase
					.from('calendar_events')
					.select('hold_level, venue')
					.eq('date', dateStr);

				if (data && !error) {
					dbTakenHolds.push(...data);
				}
			} catch (err) {
				console.error('Failed to check date availability:', err);
			}

			const newDrafts = [];

			// 3. Loop through every room and generate a hold level
			for (const base of baseRoomsToCopy) {
				const newId = generateSafeId(null);

				// Fetch Default Hold Level from Venue Settings for THIS room
				let defaultHoldLevel = 'H2';
				const venueSetting = venues.find((v) => v.setting_name === base.category);
				if (venueSetting) {
					let params = venueSetting.setting_params;
					if (typeof params === 'string') {
						try {
							params = JSON.parse(params);
						} catch (e) {}
					}
					if (params?.holdSettings?.defaultHoldLevel) {
						defaultHoldLevel = params.holdSettings.defaultHoldLevel;
					}
				}

				let startNum = parseInt(defaultHoldLevel.replace('H', ''), 10);
				if (isNaN(startNum)) startNum = 2;

				const takenHolds = new Set();

				// Check DB for conflicts in this specific room
				dbTakenHolds.forEach((dbEv) => {
					let dbCat = '';
					let dbRoom = '';
					if (typeof dbEv.venue === 'string') {
						try {
							const v = JSON.parse(dbEv.venue);
							dbCat = v.category;
							dbRoom = v.room;
						} catch (e) {}
					} else if (dbEv.venue) {
						dbCat = dbEv.venue.category;
						dbRoom = dbEv.venue.room;
					}

					if (dbCat === base.category && dbRoom === base.room) {
						const level = dbEv.hold_level || '';
						if (level.startsWith('H')) {
							const num = parseInt(level.replace('H', ''), 10);
							if (!isNaN(num)) takenHolds.add(num);
						}
					}
				});

				// Check local unsaved drafts for conflicts in this specific room
				drafts.forEach((d) => {
					if (d.date === dateStr) {
						let dCat = d.venue?.category || (d.venueString ? d.venueString.split(':::')[0] : '');
						let dRoom = d.venue?.room || (d.venueString ? d.venueString.split(':::')[1] : '');

						if (dCat === base.category && dRoom === base.room) {
							const level = d.hold_level || '';
							if (level.startsWith('H')) {
								const num = parseInt(level.replace('H', ''), 10);
								if (!isNaN(num)) takenHolds.add(num);
							}
						}
					}
				});

				// Find the gap starting from the venue default
				let nextNum = startNum;
				while (takenHolds.has(nextNum) && nextNum <= 20) {
					nextNum++;
				}

				// Failsafe loop back to H1
				if (nextNum > 20) {
					nextNum = 1;
					while (takenHolds.has(nextNum) && nextNum <= 20) {
						nextNum++;
					}
				}

				const nextHoldLevel = `H${Math.min(nextNum, 20)}`;

				// Create the draft object
				newDrafts.push({
					id: newId,
					group_id: base.group_id,
					title: base.title,
					date: dateStr,
					hold_level: nextHoldLevel,
					allDay: base.allDay,
					start: base.start,
					end: base.end,
					venueString: `${base.category}:::${base.room}`,
					venue: { category: base.category, room: base.room },
					isNew: true
				});
			}

			// 4. Push all mathematically verified drafts
			drafts = [...drafts, ...newDrafts].sort(
				(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
			);
		}
	}

	// Reactively sync ALL drafts (new and modified) to `draftEvents` so the calendar body renders them instantly
	// Look for this block in your code
	$: {
		draftEvents = drafts.map((d) => {
			const [cat, room] = (d.venueString || ':::').split(':::');
			return {
				id: d.id,
				group_id: d.group_id,
				title: d.title || events[0]?.title, // <--- ADD FALLBACK HERE
				date: d.date,
				status: d.hold_level === 'P' ? 'PENDING' : 'HOLD',
				hold_level: d.hold_level,
				venue: d.isNew ? { category: cat, room: room } : d.venue || { category: cat, room: room },
				time: d.allDay ? { start: null, end: null } : { start: d.start, end: d.end },
				details: events[0]?.details || {}, // <--- ALSO ensure this is copying safely
				event_details: events[0]?.event_details || { is_target: false, is_challenge: false },
				isDraft: true
			};
		});
	}

	function closeSidebar() {
		isOpen = false;
		drafts = [];
		draftEvents = [];
		deletedIds = [];
		dispatch('close');
	}

	function handleWindowClick(e: MouseEvent) {
		if (activeHoldPicker && holdPickerRef && !holdPickerRef.contains(e.target as Node)) {
			activeHoldPicker = null;
		}
	}

	function toggleSelectAllRows() {
		if (allRowsSelected) selectedRows = [];
		else selectedRows = drafts.map((d) => d.id);
	}

	function setBulkAllDay(allDay: boolean) {
		drafts = drafts.map((d) => {
			if (selectedRows.includes(d.id)) {
				return { ...d, allDay };
			}
			return d;
		});
	}

	function deleteSelectedRows() {
		const toDelete = selectedRows.filter((id) => !id.startsWith('new-'));
		deletedIds = [...deletedIds, ...toDelete];
		drafts = drafts.filter((d) => !selectedRows.includes(d.id));
		selectedRows = [];
		if (drafts.length === 0 && deletedIds.length === 0) closeSidebar();
	}

	function removeDateRow(id: string) {
		if (!id.startsWith('new-')) {
			deletedIds = [...deletedIds, id];
		}
		drafts = drafts.filter((d) => d.id !== id);
		selectedRows = selectedRows.filter((rowId) => rowId !== id);
		if (drafts.length === 0 && deletedIds.length === 0) closeSidebar();
	}

	function applyHoldSelection(level: HoldLevel) {
		if (activeHoldPicker === 'bulk') {
			drafts = drafts.map((d) => {
				if (selectedRows.includes(d.id)) return { ...d, hold_level: level };
				return d;
			});
		} else if (activeHoldPicker) {
			drafts = drafts.map((d) => {
				if (d.id === activeHoldPicker) return { ...d, hold_level: level };
				return d;
			});
		}
		activeHoldPicker = null;
	}

	async function saveAction() {
		saving = true;
		try {
			if (deletedIds.length > 0) {
				await supabase.from('calendar_events').delete().in('id', deletedIds);
			}

			const toInsert = drafts
				.filter((d) => d.isNew)
				.map((d) => {
					const [cat, room] = (d.venueString || ':::').split(':::');
					return {
						group_id: d.group_id,
						date: d.date,
						status: d.hold_level === 'P' ? 'PENDING' : 'HOLD',
						hold_level: d.hold_level,
						venue: { category: cat, room: room },
						time: d.allDay ? { start: null, end: null } : { start: d.start, end: d.end },
						event_details: events[0]?.event_details || { is_target: false, is_challenge: false }
					};
				});
			if (toInsert.length > 0) {
				await supabase.from('calendar_events').insert(toInsert);
			}

			const toUpdate = drafts.filter((d) => !d.isNew);
			for (const draft of toUpdate) {
				await supabase
					.from('calendar_events')
					.update({
						hold_level: draft.hold_level,
						status: draft.hold_level === 'P' ? 'PENDING' : 'HOLD',
						time: draft.allDay ? { start: null, end: null } : { start: draft.start, end: draft.end }
					})
					.eq('id', draft.id);
			}

			dispatch('update');
			closeSidebar();
		} catch (err: any) {
			console.error('Save Error:', err);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

{#if isOpen}
	<div
		class="w-[380px] h-full flex-shrink-0 bg-gray1 shadow-2xl border border-gray2/10 rounded-xl flex flex-col overflow-hidden z-[10000] relative"
		transition:slide={{ axis: 'x', duration: 250 }}
	>
		<div class="flex items-center justify-between p-4 border-b border-gray2/10">
			<h2 class="font-bold text-white text-base pl-2">Manage Holds</h2>
			<button
				class="p-1 text-gray2 hover:text-white transition-colors cursor-pointer"
				on:click={closeSidebar}
				aria-label="Close"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<div
			class="flex-1 overflow-y-auto p-4 pb-32 space-y-4 custom-scrollbar flex flex-col"
			bind:this={holdPickerRef}
		>
			<div
				class="grid grid-cols-3 items-center bg-gray1/50 px-3 py-2 rounded-xl border border-gray2/10"
			>
				<div class="flex items-center gap-2">
					<label class="flex items-center gap-1.5 cursor-pointer">
						<input
							type="checkbox"
							class="hidden"
							checked={allRowsSelected}
							on:change={toggleSelectAllRows}
						/>
						<div
							class="w-4 h-4 rounded border flex items-center justify-center {allRowsSelected
								? 'bg-lime border-lime'
								: 'border-gray2/50'}"
						>
							{#if allRowsSelected}
								<svg
									class="w-3 h-3 text-black"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="4"
								>
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
							{/if}
						</div>
						<span class="text-[10px] font-bold text-white uppercase tracking-wider">All</span>
					</label>
				</div>

				<div class="flex items-center justify-center border-l border-gray2/20">
					<label
						class="flex items-center gap-1.5 cursor-pointer {selectedRows.length === 0
							? 'opacity-30 pointer-events-none'
							: ''}"
					>
						<input
							type="checkbox"
							class="hidden"
							on:change={(e) => setBulkAllDay(e.currentTarget.checked)}
						/>
						<div
							class="w-4 h-4 rounded border border-gray2/50 flex items-center justify-center"
						></div>
						<span class="text-[10px] font-bold text-white uppercase tracking-wider">All Day</span>
					</label>
				</div>

				<div class="flex items-center justify-end gap-2">
					<div class="relative flex items-center justify-center">
						<button
							class="w-6 h-6 flex items-center justify-center rounded-lg bg-lime/10 text-lime border border-lime/20 font-bold text-[10px] hover:bg-lime/20 transition-colors {selectedRows.length ===
							0
								? 'opacity-30 pointer-events-none'
								: ''}"
							on:click={() => (activeHoldPicker = activeHoldPicker === 'bulk' ? null : 'bulk')}
						>
							H
						</button>

						{#if activeHoldPicker === 'bulk'}
							<div
								class="absolute right-0 top-[calc(100%+8px)] w-[200px] bg-navbar p-2.5 rounded-2xl border border-gray2/20 z-[60] shadow-2xl"
								transition:fade={{ duration: 150 }}
							>
								<div class="grid grid-cols-7 gap-1">
									{#each holdLevelsGrid as lvl}
										<button
											type="button"
											class="aspect-square rounded flex items-center justify-center bg-navbar text-white text-[10px] font-bold hover:bg-lime hover:text-black border border-gray2/10 transition-colors"
											on:click={() => applyHoldSelection(lvl as HoldLevel)}
										>
											{lvl.replace('H', '')}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<button
						class="w-6 h-6 flex items-center justify-center rounded-lg text-gray2 hover:text-problem hover:bg-problem/10 transition-colors {selectedRows.length ===
						0
							? 'opacity-30 pointer-events-none'
							: ''}"
						on:click={deleteSelectedRows}
						aria-label="Delete selected holds"
					>
						<svg
							class="w-3.5 h-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="3 6 5 6 21 6"></polyline>
							<path
								d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
							></path>
						</svg>
					</button>
				</div>
			</div>

			<div class="flex-1 flex flex-col gap-2">
				{#each drafts as draft, i (draft.id)}
					<div
						class="p-3 rounded-xl flex flex-col gap-2 w-full transition-all border-2 bg-navbar
						{drafts[i].isNew ? 'border-lime' : 'border-gray2/10'}"
					>
						<div class="grid grid-cols-3 items-center w-full">
							<div class="flex items-center gap-2 overflow-hidden col-span-1">
								<label class="flex items-center cursor-pointer shrink-0">
									<input
										type="checkbox"
										class="hidden"
										bind:group={selectedRows}
										value={drafts[i].id}
									/>
									<div
										class="w-4 h-4 rounded border flex items-center justify-center {selectedRows.includes(
											drafts[i].id
										)
											? 'bg-lime border-lime'
											: 'border-gray2/50'}"
									>
										{#if selectedRows.includes(drafts[i].id)}
											<svg
												class="w-3 h-3 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="4"
											>
												<polyline points="20 6 9 17 4 12"></polyline>
											</svg>
										{/if}
									</div>
								</label>

								<div class="flex flex-col truncate w-full min-w-[120px]">
									<p class="text-xs font-bold text-white leading-tight truncate">
										{new Date(drafts[i].date + 'T00:00:00').toLocaleDateString('en-US', {
											weekday: 'short',
											month: 'short',
											day: 'numeric'
										})}
									</p>
									<div class="flex items-center gap-1.5 mt-0.5">
										<span
											class="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
											style="background-color: {getVenueColor(
												drafts[i].venue?.category,
												drafts[i].venue?.room
											)}"
										></span>
										<p class="text-[9px] text-gray2 font-bold uppercase truncate">
											{drafts[i].venue?.room || 'No Venue'}
										</p>
									</div>
								</div>
							</div>

							<div class="flex items-center justify-center col-span-1">
								<label class="flex items-center gap-1.5 cursor-pointer">
									<input type="checkbox" class="hidden" bind:checked={drafts[i].allDay} />
									<div
										class="w-3.5 h-3.5 rounded border flex items-center justify-center {drafts[i]
											.allDay
											? 'bg-lime border-lime'
											: 'border-gray2/50'}"
									>
										{#if drafts[i].allDay}
											<svg
												class="w-2.5 h-2.5 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="4"
											>
												<polyline points="20 6 9 17 4 12"></polyline>
											</svg>
										{/if}
									</div>
									<span class="text-[10px] font-bold text-white uppercase tracking-wider"
										>All day</span
									>
								</label>
							</div>

							<div class="flex items-center justify-end gap-1.5 col-span-1">
								<div class="relative flex items-center justify-center">
									<button
										type="button"
										class="w-7 h-7 rounded-lg border border-lime/50 text-lime font-bold text-[10px] flex items-center justify-center hover:bg-lime/10 transition-colors"
										on:click|stopPropagation={() =>
											(activeHoldPicker = activeHoldPicker === drafts[i].id ? null : drafts[i].id)}
									>
										{drafts[i].hold_level}
									</button>

									{#if activeHoldPicker === drafts[i].id}
										<div
											class="absolute right-0 top-[calc(100%+8px)] w-[200px] bg-navbar p-2.5 rounded-2xl border border-gray2/20 z-[60] shadow-2xl"
											transition:fade={{ duration: 150 }}
										>
											<div class="grid grid-cols-7 gap-1">
												{#each holdLevelsGrid as lvl}
													<button
														type="button"
														class="aspect-square rounded flex items-center justify-center bg-navbar text-white text-[10px] font-bold hover:bg-lime hover:text-black border border-gray2/10 transition-colors"
														on:click={() => applyHoldSelection(lvl as HoldLevel)}
													>
														{lvl.replace('H', '')}
													</button>
												{/each}
											</div>
										</div>
									{/if}
								</div>

								<button
									type="button"
									class="w-7 h-7 rounded-lg border border-gray2/20 text-gray2 flex items-center justify-center hover:text-problem hover:border-problem transition-colors"
									on:click={() => removeDateRow(drafts[i].id)}
									aria-label="Remove this hold"
								>
									<svg
										class="w-3.5 h-3.5"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<polyline points="3 6 5 6 21 6"></polyline>
										<path
											d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										></path>
									</svg>
								</button>
							</div>
						</div>

						{#if !drafts[i].allDay}
							<div
								class="flex items-center gap-2 w-full pt-1 pb-1"
								transition:slide={{ duration: 150 }}
							>
								<input
									type="time"
									lang="en-US"
									bind:value={drafts[i].start}
									class="w-full bg-gray1 border border-gray2/20 rounded-lg text-xs px-3 py-2 text-white focus:outline-none focus:border-lime"
								/>
								<span class="text-[10px] font-bold text-gray2 shrink-0">-</span>
								<input
									type="time"
									lang="en-US"
									bind:value={drafts[i].end}
									class="w-full bg-gray1 border border-gray2/20 rounded-lg text-xs px-3 py-2 text-white focus:outline-none focus:border-lime"
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="p-4 border-t border-gray2/10 flex flex-col gap-3">
			<button
				type="button"
				class="w-full py-3 bg-lime text-black text-sm font-bold rounded-2xl hover:bg-lime/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center"
				on:click={saveAction}
				disabled={saving || (drafts.length === 0 && deletedIds.length === 0)}
			>
				{#if saving}
					<div
						class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mr-2"
					></div>
				{/if}
				Save Changes
			</button>
		</div>
	</div>
{/if}

<style>
	::-webkit-scrollbar {
		display: none;
	}
	* {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
