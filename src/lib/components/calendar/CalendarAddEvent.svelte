<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import type {
		EventType,
		CalendarEvent,
		HoldLevel,
		VenueSettings,
		StageConfig
	} from '$lib/types/calendar-types';
	import { portal } from '$lib/utils/portalUtils';

	import PopupNotification from '$lib/components/modals/PopupNotification.svelte'; // Adjust path if necessary
	import ArtistSearch from '$lib/components/calendar/page/tabs/deals/ArtistSearch.svelte';
	import CalendarConfirm from '$lib/components/calendar/CalendarConfirm.svelte';
	import { getNextAvailableHold, calculateHoldShifts } from '$lib/utils/holdManager';
	import { syncEventToTechSchedule } from '$lib/services/techScheduleSync';

	export let isOpen: boolean = false;
	export let dates: string[] = [];
	export let allEvents: CalendarEvent[] = [];
	export let draftEvents: CalendarEvent[] = [];
	export let venues: VenueSettings[] = [];
	export let selectedArtist: {
		name: string;
		id?: string | number;
		picture?: string;
		isCustom?: boolean;
	} | null = null;

	const dispatch = createEventDispatcher();

	let view: 'form' | 'review' = 'form';
	let saving = false;

	let eventStatus: 'HOLD' | 'CONFIRMED' = 'HOLD';
	let title = '';

	let notes = '';
	let eventType: EventType | '' = '';
	let priorityHold = false;
	let manualHolds: Record<string, HoldLevel> = {};
	let lastSelectedHoldLevel: HoldLevel | null = null;

	let datesAsSingleEvents = false;
	let showVenueDropdown = false;
	let showVenueDropdownReview = false;
	let venueRef: HTMLElement;
	let venueRefReview: HTMLElement;
	let selectedRooms: string[] = [];
	let hasInitializedDefaultVenue = false;

	let showTypeDropdown = false;
	let typeRef: HTMLElement;
	let globalAllDay = true;
	let globalStart = '10:00';
	let globalEnd = '18:00';

	let timeSettings: Record<string, { allDay: boolean; start: string; end: string }> = {};
	let selectedDateRows: string[] = [];

	let activeHoldPicker: string | 'bulk' | null = null;
	let holdPickerRef: HTMLElement;
	// Add these state variables for the popup
	let showPopup = false;
	let popupMessage = '';

	// Confirmation Modal State
	let showConfirmModal = false;
	let pendingSaveView = false;

	// Toggle this to TRUE if you want Corpo events to force a time selection
	const CORPO_REQUIRED_TIME = false;

	$: typeRequiresTime =
		['Bazart Nuits', 'NCG Show', 'NCG 360', 'DSTRKT', 'Tour Prod', 'Moet City'].includes(
			eventType || ''
		) ||
		(eventType === 'Corpo' && CORPO_REQUIRED_TIME);

	$: isTimeValid =
		dates.length > 0 &&
		dates.every((d) => {
			const t = timeSettings[d];
			if (!t) return false;

			if (typeRequiresTime) {
				// If time is forced (Clubs, or Corpo if toggle is TRUE)
				return !t.allDay && t.start && t.end;
			}

			// If time isn't forced (Corpo default)
			if (t.allDay) return true; // Valid if All Day
			if (t.start && t.end) return true; // Valid if both filled
			if (!t.start && !t.end) return true; // Valid if completely blank (saves as null)

			return false; // Invalid ONLY if one is filled and the other is blank
		});

	$: isSaveDisabled =
		saving ||
		dates.length === 0 ||
		selectedRooms.length === 0 ||
		!eventType ||
		!title ||
		titleContainsType ||
		!isTimeValid;

	const types: EventType[] = [
		'Corpo',
		'Bazart Nuits',
		'Moet City',
		'NCG Show',
		'NCG 360',
		'DSTRKT',
		'Tour Prod',
		'Other'
	];

	const forbiddenWords = [
		'corpo',
		'bazart nuits',
		'nuits bazart',
		'bazart nuit',
		'nuit bazart',
		'ncg show',
		'ncg 360',
		'ncg360',
		'360',
		'dstrkt',
		'tour prod'
	];

	function containsForbiddenWord(inputTitle: string) {
		if (!inputTitle) return false;
		const titleLower = inputTitle.toLowerCase().trim();
		return forbiddenWords.some((word) =>
			// Use whole-word match for '360' so we don't accidentally block names like "Artist3600"
			word === '360' ? /\b360\b/.test(titleLower) : titleLower.includes(word)
		);
	}

	// Will trigger the existing UI warning and disable the Save button
	$: titleContainsType = containsForbiddenWord(title) || checkFuzzyMatch(title, types);

	function checkFuzzyMatch(inputTitle: string, eventTypes: EventType[]) {
		if (!inputTitle) return false;
		const titleStr = inputTitle.toLowerCase().trim();

		// Helper: Calculates edit distance between two strings
		const levenshtein = (a: string, b: string) => {
			const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
			for (let j = 0; j <= b.length; j++) matrix[0][j] = [j] as any;
			for (let i = 1; i <= a.length; i++) {
				for (let j = 1; j <= b.length; j++) {
					matrix[i][j] =
						a[i - 1] === b[j - 1]
							? matrix[i - 1][j - 1]
							: Math.min(matrix[i - 1][j - 1], matrix[i][j - 1], matrix[i - 1][j]) + 1;
				}
			}
			return matrix[a.length][b.length];
		};

		const titleWords = titleStr.split(/\s+/);

		for (const type of eventTypes) {
			// Ignore Other and Moet City from the title warning
			if (type === 'Other' || type === 'Moet City') continue;
			const typeStr = type.toLowerCase();
			const typeWords = typeStr.split(/\s+/);

			// 1. Direct inclusion (100% exact match of the substring)
			if (titleStr.includes(typeStr)) return true;

			// 2. Fuzzy match (80%+ similarity against chunks of the title)
			for (let i = 0; i <= Math.max(0, titleWords.length - typeWords.length); i++) {
				const chunk = titleWords.slice(i, i + typeWords.length).join(' ');
				const distance = levenshtein(chunk, typeStr);
				const maxLen = Math.max(chunk.length, typeStr.length);

				// Calculate percentage and check against 80% threshold (0.80)
				if (maxLen > 0 && (maxLen - distance) / maxLen >= 0.8) {
					return true;
				}
			}
		}
		return false;
	}

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};
	const holdLevelsGrid = ['P', ...Array.from({ length: 20 }, (_, i) => `H${i + 1}`)];

	$: activeVenueId = selectedRooms.length > 0 ? selectedRooms[0].split(':::')[0] : null;
	$: venueOptions = venues.filter((v) => v.setting_type === 'VENUE'); // ADD THIS LINE
	$: allRowsSelected = selectedDateRows.length === dates.length && dates.length > 0;

	$: {
		let changed = false;
		const newSorted = [...dates].sort((a, b) => a.localeCompare(b));
		if (JSON.stringify(dates) !== JSON.stringify(newSorted)) {
			dates = newSorted;
			changed = true;
		}

		dates.forEach((d) => {
			if (!timeSettings[d]) {
				timeSettings[d] = { allDay: globalAllDay, start: globalStart, end: globalEnd };
				changed = true;
			}
		});
		if (changed) {
			timeSettings = { ...timeSettings };
		}
	}

	$: dateRangeObj = getDateRangeText(dates);

	function getDateRangeText(datesArr: string[]) {
		if (datesArr.length === 0) return { title: '', subtitle: '' };
		const sorted = [...datesArr].sort();
		const first = new Date(sorted[0] + 'T00:00:00');
		const last = new Date(sorted[sorted.length - 1] + 'T00:00:00');

		const optsTitle: Intl.DateTimeFormatOptions = {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		};
		const optsDay: Intl.DateTimeFormatOptions = { weekday: 'long' };

		let title = '';
		if (sorted.length === 1) title = first.toLocaleDateString('en-US', optsTitle);
		else if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth())
			title = `${first.toLocaleString('en-US', { month: 'short' })} ${first.getDate()} - ${last.getDate()}, ${first.getFullYear()}`;
		else if (first.getFullYear() === last.getFullYear())
			title = `${first.toLocaleString('en-US', { month: 'short' })} ${first.getDate()} - ${last.toLocaleString('en-US', { month: 'short' })} ${last.getDate()}, ${first.getFullYear()}`;
		else
			title = `${first.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${last.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

		let subtitle =
			sorted.length === 1
				? first.toLocaleDateString('en-US', optsDay)
				: `${first.toLocaleDateString('en-US', optsDay)} - ${last.toLocaleDateString('en-US', optsDay)}`;

		return { title, subtitle };
	}

	function closeSidebar() {
		isOpen = false;
		view = 'form';
		title = '';
		selectedArtist = null;
		notes = '';
		eventType = '';
		eventStatus = 'HOLD';
		priorityHold = false;
		datesAsSingleEvents = false;
		manualHolds = {};
		selectedRooms = [];
		dates = [];
		draftEvents = [];
		hasInitializedDefaultVenue = false;
		timeSettings = {};
		selectedDateRows = [];
		activeHoldPicker = null;
		lastSelectedHoldLevel = null;
		dispatch('close');
	}

	function getRoomColor(vId: string, rName: string) {
		const venue = venues.find((v) => v.id === vId);
		if (!venue) return '#828282';
		let stages = [];
		if (typeof venue.setting_params === 'string') {
			try {
				stages = JSON.parse(venue.setting_params).stages;
			} catch (e) {}
		} else {
			stages = venue.setting_params?.stages;
		}
		const stage = stages?.find((s: StageConfig) => s.name === rName);
		return stage?.color || '#828282';
	}

	$: if (
		isOpen &&
		venueOptions.length > 0 &&
		selectedRooms.length === 0 &&
		!hasInitializedDefaultVenue
	) {
		let defaultVenue = venueOptions.find((v) =>
			v.setting_name.toLowerCase().includes('new city gas')
		);
		if (!defaultVenue) defaultVenue = venueOptions[0];

		let stages = [];
		if (typeof defaultVenue.setting_params === 'string') {
			try {
				stages = JSON.parse(defaultVenue.setting_params).stages;
			} catch (e) {}
		} else {
			stages = defaultVenue.setting_params?.stages;
		}

		if (stages && stages.length > 0) {
			let defaultRoom = stages.find((s: StageConfig) => s.name.toLowerCase() === 'main room');
			if (!defaultRoom) defaultRoom = stages[0];
			selectedRooms = [`${defaultVenue.id}:::${defaultVenue.setting_name}:::${defaultRoom.name}`];
		}
		hasInitializedDefaultVenue = true;
	}

	function handleWindowClick(e: MouseEvent) {
		if (showVenueDropdown && venueRef && !venueRef.contains(e.target as Node))
			showVenueDropdown = false;
		if (showVenueDropdownReview && venueRefReview && !venueRefReview.contains(e.target as Node))
			showVenueDropdownReview = false;
		if (showTypeDropdown && typeRef && !typeRef.contains(e.target as Node))
			showTypeDropdown = false;
		if (activeHoldPicker && holdPickerRef && !holdPickerRef.contains(e.target as Node))
			activeHoldPicker = null;
	}

	function handleEventTypeChange(type: EventType) {
		eventType = type;
		showTypeDropdown = false;

		const requiresClubTime = [
			'Bazart Nuits',
			'NCG Show',
			'NCG 360',
			'DSTRKT',
			'Tour Prod',
			'Moet City'
		];

		if (requiresClubTime.includes(type)) {
			globalAllDay = false;
			globalStart = '22:00';
			globalEnd = '03:00';
		} else if (type === 'Corpo') {
			if (CORPO_REQUIRED_TIME) {
				globalAllDay = false;
				globalStart = '10:00';
				globalEnd = '18:00';
			} else {
				// Corpo Default: Blank times, not all day
				globalAllDay = false;
				globalStart = '';
				globalEnd = '';
			}
		} else {
			globalAllDay = true;
			globalStart = '10:00';
			globalEnd = '18:00';
		}

		applyGlobalTimes();
	}

	function applyGlobalTimes() {
		dates.forEach((d) => {
			timeSettings[d] = { allDay: globalAllDay, start: globalStart, end: globalEnd };
		});
		timeSettings = { ...timeSettings };
	}

	function getHoldForNewDate(
		dateStr: string,
		vId: string | null,
		roomName: string | null, // <-- Added parameter
		mHolds: Record<string, HoldLevel>,
		lHold: HoldLevel | null,
		isPrio: boolean
	): HoldLevel {
		if (mHolds[dateStr]) return mHolds[dateStr];
		if (lHold && !isPrio) return lHold;

		let defaultLevel = 'H2';
		if (vId) {
			const venue = venues.find((v) => v.id === vId);
			if (venue) {
				let params = venue.setting_params;
				if (typeof params === 'string') {
					try {
						params = JSON.parse(params);
					} catch (e) {}
				}
				if (params?.holdSettings?.defaultHoldLevel) {
					defaultLevel = params.holdSettings.defaultHoldLevel;
				}
			}
		}

		const existingLevels = allEvents
			.filter(
				(e) =>
					e.date === dateStr && e.status === 'HOLD' && e.hold_level && e.venue.room === roomName
			) // <-- Filtered by room
			.map((e) => e.hold_level);

		const startIdx = isPrio ? 1 : parseInt(defaultLevel.replace(/\D/g, '')) || 2;
		for (let i = startIdx; i <= 20; i++) {
			if (!existingLevels.includes(`H${i}` as HoldLevel)) return `H${i}` as HoldLevel;
		}
		return 'P';
	}

	function buildDetails(isPrio: boolean) {
		return {
			type: eventType || null,
			notes: notes && notes.trim() !== '' ? notes.trim() : null,
			is_priority: isPrio
		};
	}

	function buildEventDeal() {
		const fallbackIcon =
			'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png';

		if (!selectedArtist?.name) {
			return {
				headliner_name: 'NULL',
				headliner_id: 'NULL',
				headliner_pic: 'NULL'
			};
		}

		return {
			headliner_name: selectedArtist.name.trim(),
			headliner_id: selectedArtist.id ? String(selectedArtist.id) : 'NULL',
			headliner_pic: selectedArtist.picture || fallbackIcon
		};
	}

	$: {
		if (isOpen) {
			let drafts: any[] = [];
			let localDisplaced: any[] = [];

			dates.forEach((dateStr) => {
				const roomsToMap = selectedRooms.length > 0 ? selectedRooms : [null];

				roomsToMap.forEach((roomKey, index) => {
					const vId = roomKey ? roomKey.split(':::')[0] : null;
					const vName = roomKey ? roomKey.split(':::')[1] : null;
					const roomName = roomKey ? roomKey.split(':::')[2] : null;

					let finalHoldLevel: HoldLevel | null = null;
					let isForced = false;

					if (eventStatus === 'HOLD') {
						if (manualHolds[dateStr]) {
							finalHoldLevel = manualHolds[dateStr];
							isForced = true;
						} else {
							finalHoldLevel = getNextAvailableHold({
								date: dateStr,
								category: vName || '',
								room: roomName || '',
								existingEvents: [...allEvents, ...drafts], // Account for newly added drafts
								isPriority: priorityHold,
								venues: venues
							});
						}
					}

					const isItPriority = priorityHold || finalHoldLevel === 'H1';
					const tSet = timeSettings[dateStr] || { allDay: true, start: '', end: '' };

					const newEvent = {
						id: `draft-${dateStr}-${roomName ? roomName.replace(/\s+/g, '-') : index}`,
						title: title || '(No Title)',
						date: dateStr,
						status: eventStatus,
						hold_level: finalHoldLevel,
						venue: { category: vName, room: roomName },
						time: tSet.allDay
							? { start: '00:00', end: '23:59' }
							: { start: tSet.start || null, end: tSet.end || null },
						details: buildDetails(isItPriority),
						event_deal: buildEventDeal(),
						event_details: { is_target: false, is_challenge: false },
						isDraft: true,
						isNewDraft: true // Explicit flag to let Svelte know this is an insert
					};

					drafts.push(newEvent);

					// 🚨 THE FIX: Cascading Shift for manually forced holds
					if (isForced && eventStatus === 'HOLD') {
						// Use the manager to calculate the domino effect
						const shifts = calculateHoldShifts({
							targetEventId: 'draft-dummy',
							newLevel: finalHoldLevel,
							oldLevel: null, // <-- Make sure this line is explicitly null
							date: dateStr,
							category: vName || '',
							room: roomName || '',
							existingEvents: [...allEvents, ...localDisplaced]
						});

						// Apply the shifts locally so the UI updates
						for (const shift of shifts) {
							const originalEvent = allEvents.find((e) => e.id === shift.id);
							if (originalEvent) {
								// If we already bumped this event in this loop, update it again
								const existingDisplacedIdx = localDisplaced.findIndex((d) => d.id === shift.id);
								if (existingDisplacedIdx >= 0) {
									localDisplaced[existingDisplacedIdx].hold_level = shift.newHoldLevel;
								} else {
									localDisplaced.push({
										...originalEvent,
										hold_level: shift.newHoldLevel,
										status: shift.newStatus,
										isDraft: true,
										isNewDraft: false
									});
								}
							}
						}
					}
				});
			});

			draftEvents = [...drafts, ...localDisplaced];
		} else {
			draftEvents = [];
		}
	}

	function toggleVenueStages(venue: VenueSettings, stages: StageConfig[], isAllSelected: boolean) {
		if (activeVenueId && activeVenueId !== venue.id) return;
		const keys = stages.map((s) => `${venue.id}:::${venue.setting_name}:::${s.name}`);
		if (isAllSelected) selectedRooms = selectedRooms.filter((k) => !keys.includes(k));
		else selectedRooms = Array.from(new Set([...selectedRooms, ...keys]));
	}

	function toggleSelectAllRows() {
		if (allRowsSelected) selectedDateRows = [];
		else selectedDateRows = [...dates];
	}

	function setBulkAllDay(allDay: boolean) {
		selectedDateRows.forEach((d) => {
			if (timeSettings[d]) timeSettings[d].allDay = allDay;
		});
		timeSettings = { ...timeSettings };
	}

	function deleteSelectedRows() {
		dates = dates.filter((d) => !selectedDateRows.includes(d));
		selectedDateRows.forEach((d) => {
			delete timeSettings[d];
			delete manualHolds[d];
		});
		selectedDateRows = [];
		if (dates.length === 0) closeSidebar();
	}

	function removeDateRow(dateStr: string) {
		dates = dates.filter((d) => d !== dateStr);
		delete timeSettings[dateStr];
		delete manualHolds[dateStr];
		selectedDateRows = selectedDateRows.filter((d) => d !== dateStr);
		if (dates.length === 0) closeSidebar();
	}

	function handlePriorityChange() {
		if (!priorityHold) {
			dates.forEach((d) => {
				if (manualHolds[d] === 'H1') delete manualHolds[d];
			});
		} else {
			dates.forEach((d) => {
				manualHolds[d] = 'H1';
			});
		}
		manualHolds = { ...manualHolds };
	}

	function applyHoldSelection(level: HoldLevel) {
		if (activeHoldPicker === 'bulk') {
			selectedDateRows.forEach((d) => {
				manualHolds[d] = level;
			});
			priorityHold = level === 'H1';
		} else if (activeHoldPicker) {
			manualHolds[activeHoldPicker] = level;
			// Do not change global priorityHold for single changes
		}
		activeHoldPicker = null;
		manualHolds = { ...manualHolds };
	}

	let defaultEmailForVenue = false;

	async function saveAction(openModalAfter: boolean) {
		if (isSaveDisabled) {
			popupMessage = titleContainsType
				? 'Event Name contains Event Type, please remove.'
				: 'Missing fields, please complete before saving.';
			showPopup = true;
			return;
		}

		if (eventStatus === 'CONFIRMED') {
			const venueName = venues.find((v) => v.id === activeVenueId)?.setting_name || '';
			defaultEmailForVenue = venueName.toLowerCase().includes('new city gas');
			pendingSaveView = openModalAfter;
			showConfirmModal = true;
		} else {
			await executeFinalSave(openModalAfter, { sendEmail: false, sendSms: false });
		}
	}
	async function executeFinalSave(
		openModalAfter: boolean,
		confirmDetails = { sendEmail: false, sendSms: false }
	) {
		saving = true;
		let creatorName = 'Unknown User';

		try {
			// 1. Get the Auth user ID
			const { data: authData } = await supabase.auth.getUser();
			const userId = $user?.id || authData?.user?.id;

			// 2. Fetch creator name
			if (userId) {
				const { data: profileData, error: profileError } = await supabase
					.from('user_profiles')
					.select('first_name, last_name, email')
					.eq('id', userId)
					.single();
				if (!profileError && profileData) {
					if (profileData.first_name || profileData.last_name) {
						creatorName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
					} else if (profileData.email) {
						creatorName = profileData.email.split('@')[0];
					}
				} else if (authData?.user?.email) {
					creatorName = authData.user.email.split('@')[0];
				}
			}

			let allSavedEvents = [];

			// 3. SCENARIO A: Single Events
			if (datesAsSingleEvents) {
				for (const dateStr of dates) {
					const dateDrafts = draftEvents.filter((draft) => draft.date === dateStr);
					const newDrafts = dateDrafts.filter((d) => d.isNewDraft);
					const displacedDrafts = dateDrafts.filter((d) => !d.isNewDraft);

					// Insert New Events
					if (newDrafts.length > 0) {
						const { data: calData, error: calErr } = await supabase
							.from('calendar')
							.insert({
								title: title,
								creator_name: creatorName, // ✅ CORRECTED TO SNAKE_CASE
								details: buildDetails(priorityHold),
								event_deal: buildEventDeal()
							})
							.select('id')
							.single();
						if (calErr) throw calErr;

						const eventsToCreate = newDrafts.map((draft) => ({
							group_id: calData.id,
							date: draft.date,
							status: draft.status,
							hold_level: draft.hold_level,
							venue: draft.venue,
							time: draft.time,
							event_details: draft.event_details
						}));

						const { data, error } = await supabase
							.from('calendar_events')
							.insert(eventsToCreate)
							.select('*, calendar(*)');
						if (error) throw error;
						allSavedEvents.push(...(data || []));
					}

					// Update Bumped Events
					for (const displaced of displacedDrafts) {
						await supabase
							.from('calendar_events')
							.update({
								hold_level: displaced.hold_level,
								status: displaced.status
							})
							.eq('id', displaced.id);
					}
				}
			}
			// 4. SCENARIO B: Grouped Events
			else {
				const newDrafts = draftEvents.filter((d) => d.isNewDraft);
				const displacedDrafts = draftEvents.filter((d) => !d.isNewDraft);

				if (newDrafts.length > 0) {
					const { data: calData, error: calErr } = await supabase
						.from('calendar')
						.insert({
							title: title,
							creator_name: creatorName,
							details: buildDetails(priorityHold),
							event_deal: buildEventDeal()
						})
						.select('id')
						.single();
					if (calErr) throw calErr;
					const sharedGroupId = calData.id;

					const eventsToCreate = newDrafts.map((draft) => ({
						group_id: sharedGroupId,
						date: draft.date,
						status: draft.status,
						hold_level: draft.hold_level,
						venue: draft.venue,
						time: draft.time,
						event_details: draft.event_details
					}));
					const { data, error } = await supabase
						.from('calendar_events')
						.insert(eventsToCreate)
						.select('*, calendar(*)');
					if (error) throw error;
					allSavedEvents = data || [];
				}

				// Update Bumped Events
				// Update Bumped Events
				for (const displaced of displacedDrafts) {
					await supabase
						.from('calendar_events')
						.update({
							hold_level: displaced.hold_level,
							status: displaced.status
						})
						.eq('id', displaced.id);
				}
			}

			if (eventStatus === 'CONFIRMED' && allSavedEvents.length > 0) {
				for (const savedEvent of allSavedEvents) {
					try {
						// Build a complete payload that matches the CalendarEvent type
						const syncPayload = {
							...savedEvent,
							details: savedEvent.calendar?.details || buildDetails(priorityHold),
							title: savedEvent.calendar?.title || title
						};
						await syncEventToTechSchedule(syncPayload, 'CONFIRMED');
					} catch (syncErr) {
						console.error('Tech Schedule Sync Failed:', syncErr);
					}
				}
			}

			// 5. SEND NOTIFICATIONS IF CONFIRMED
			if (
				eventStatus === 'CONFIRMED' &&
				(confirmDetails.sendEmail || confirmDetails.sendSms) &&
				allSavedEvents.length > 0
			) {
				const firstEvent = allSavedEvents[0];
				const payload = {
					eventId: firstEvent.short_id || firstEvent.id,
					eventTitle: firstEvent.calendar?.title || firstEvent.title || 'Unnamed Event',
					eventType: firstEvent.details?.type || 'Event',
					eventDate: firstEvent.date,
					eventDates: allSavedEvents.map((e) => e.date), // 👈 ADD THIS LINE
					venueName:
						`${firstEvent.venue?.category || ''} ${firstEvent.venue?.room ? '/ ' + firstEvent.venue.room : ''}`.trim(),
					authUserName: creatorName,
					action: 'confirm'
				};
				const promises: Promise<any>[] = [];
				if (confirmDetails.sendEmail) {
					promises.push(
						fetch('/api/calendar-confirm-email', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload)
						})
					);
				}
				if (confirmDetails.sendSms) {
					promises.push(
						fetch('/api/calendar-confirm-sms', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload)
						})
					);
				}
				if (promises.length > 0) await Promise.allSettled(promises);
			}

			showConfirmModal = false;

			// 6. Navigation / Callback
			if (openModalAfter && allSavedEvents && allSavedEvents.length > 0) {
				const shortId = allSavedEvents[0].calendar?.short_id || allSavedEvents[0].short_id;
				closeSidebar();
				if (shortId) {
					goto(`/calendar/${shortId}`);
				} else {
					dispatch('successAndView', { events: allSavedEvents });
				}
			} else {
				dispatch('success', { message: `${allSavedEvents.length} event(s) saved.` });
				closeSidebar();
			}
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
		class="w-[380px] h-full flex-shrink-0 bg-gray1 shadow-2xl border border-gray2/10 rounded-xl flex flex-col overflow-hidden"
		transition:slide={{ axis: 'x', duration: 250 }}
	>
		<div class="flex items-center justify-between p-4 border-b border-gray2/10">
			<button
				class="p-1 text-gray2 hover:text-white transition-colors cursor-pointer"
				on:click={view === 'review' ? () => (view = 'form') : closeSidebar}
				aria-label="Go back"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					{#if view === 'review'}<polyline points="15 18 9 12 15 6"></polyline>{:else}<line
							x1="18"
							y1="6"
							x2="6"
							y2="18"
						></line><line x1="6" y1="6" x2="18" y2="18"></line>{/if}
				</svg>
			</button>
			<h2 class="font-bold text-white text-base">
				{view === 'review' ? 'Review Dates' : 'New Event'}
			</h2>
			<div class="w-7"></div>
		</div>

		{#if view === 'form'}
			<div class="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
				<div class="flex p-1 bg-black/40 rounded-xl border border-gray2/10">
					<button
						class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer {eventStatus ===
						'HOLD'
							? 'bg-gray2 text-black'
							: 'text-gray2 hover:text-white'}"
						on:click={() => (eventStatus = 'HOLD')}>Hold</button
					>
					<button
						class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer {eventStatus ===
						'CONFIRMED'
							? 'bg-lime text-black'
							: 'text-gray2 hover:text-white'}"
						on:click={() => (eventStatus = 'CONFIRMED')}>Confirmed</button
					>
				</div>

				<div class="space-y-3">
					<div>
						<label
							for="artistInput"
							class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1">Artist Name</label
						>
						<ArtistSearch bind:selectedArtist placeholder="Enter artist name" />
					</div>
					<div>
						<label
							for="eventTitleInput"
							class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
							>Event Name <span class="text-lime">*</span></label
						>
						<input
							id="eventTitleInput"
							type="text"
							bind:value={title}
							placeholder="Enter event name"
							class="w-full px-3 py-2.5 bg-navbar rounded-2xl placeholder:text-gray2/50 text-sm focus:outline-none transition-colors border-2
        {titleContainsType
								? 'text-problem border-problem focus:border-problem'
								: 'text-white border-transparent focus:border-lime'}"
						/>
						{#if titleContainsType}
							<p class="text-problem text-[10px] mt-1 ml-1 font-bold transition-all">
								Do not include event type in the name, select type from dropdown below
							</p>
						{/if}
					</div>
				</div>

				<div class="relative w-full" bind:this={venueRef}>
					<span class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
						>Venue / Stages <span class="text-lime">*</span></span
					>
					<div
						role="button"
						tabindex="0"
						aria-expanded={showVenueDropdown}
						class="w-full px-3 py-2.5 bg-black/40 border border-gray2/20 rounded-2xl text-white text-sm text-left flex justify-between items-center cursor-pointer min-h-[46px] transition-colors hover:border-lime/50"
						on:click={() => (showVenueDropdown = !showVenueDropdown)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								showVenueDropdown = !showVenueDropdown;
							}
						}}
					>
						<div class="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
							{#if selectedRooms.length === 0}
								<span class="text-gray2/50 truncate">Select Stage(s) *</span>
							{:else}
								{#each selectedRooms as roomKey}
									{@const vId = roomKey.split(':::')[0]}
									{@const rName = roomKey.split(':::')[2]}
									{@const color = getRoomColor(vId, rName)}
									<span
										class="flex items-center gap-1.5 bg-navbar border border-gray2/20 px-2 py-1 rounded-md text-[10px] font-bold text-white shrink-0"
									>
										<span
											class="w-2.5 h-2.5 rounded-full shadow-sm"
											style="background-color: {color}"
										></span>{rName}
									</span>
								{/each}
							{/if}
						</div>
						<div class="flex items-center gap-2 shrink-0">
							{#if selectedRooms.length > 0}
								<button
									type="button"
									class="text-gray2 hover:text-problem transition-colors cursor-pointer p-0.5"
									on:click|stopPropagation={() => (selectedRooms = [])}
									aria-label="Clear all selections"
								>
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
										></line></svg
									>
								</button>
							{/if}
							<svg
								class="w-3.5 h-3.5 transition-transform {showVenueDropdown ? 'rotate-180' : ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
						</div>
					</div>

					{#if showVenueDropdown}
						<div
							class="absolute top-[calc(100%+4px)] left-0 bg-navbar border border-gray2/20 rounded-2xl shadow-xl z-50 w-full overflow-hidden max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col"
						>
							<div
								class="p-3 border-b border-gray2/20 flex justify-between items-center bg-gray1 sticky top-0 z-10"
							>
								<span class="text-xs font-bold text-white uppercase tracking-wider">Venue List</span
								>
								<button
									type="button"
									class="text-[10px] font-bold text-lime hover:underline uppercase flex items-center gap-1 cursor-pointer"
									on:click={() => {
										showVenueDropdown = false;
										dispatch('openSettings', { venueId: null });
									}}>+ Add</button
								>
							</div>
							{#if venueOptions.length === 0}
								<div class="p-4 text-center">
									<p class="text-xs text-gray2 mb-2">No venues configured.</p>
								</div>
							{:else}
								{#each venueOptions as venue}
									{@const venueStages =
										typeof venue.setting_params === 'string'
											? JSON.parse(venue.setting_params).stages || []
											: venue.setting_params.stages || []}
									{@const allSelected =
										venueStages.length > 0 &&
										venueStages.every((s: StageConfig) =>
											selectedRooms.includes(`${venue.id}:::${venue.setting_name}:::${s.name}`)
										)}
									{@const isDisabled = activeVenueId !== null && activeVenueId !== venue.id}

									<div
										class="border-b border-gray2/10 last:border-b-0 pb-2 transition-opacity {isDisabled
											? 'opacity-30'
											: ''}"
									>
										<div class="p-3 flex justify-between items-center bg-navbar">
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold text-white uppercase tracking-wide"
													>{venue.setting_name}</span
												>
												{#if venueStages.length > 0}
													<button
														type="button"
														disabled={isDisabled}
														class="text-[10px] font-bold text-gray2 uppercase transition-colors {isDisabled
															? 'cursor-not-allowed'
															: 'hover:text-white cursor-pointer'}"
														on:click={() => toggleVenueStages(venue, venueStages, allSelected)}
													>
														({allSelected ? 'Deselect All' : 'Select All'})
													</button>
												{/if}
											</div>
											<button
												type="button"
												class="text-[10px] font-bold text-lime hover:underline uppercase cursor-pointer"
												on:click={() => {
													showVenueDropdown = false;
													dispatch('openSettings', { venueId: venue.id });
												}}>Edit</button
											>
										</div>
										{#if venueStages.length > 0}
											{#each venueStages as stage}
												{@const roomKey = `${venue.id}:::${venue.setting_name}:::${stage.name}`}
												<label
													class="flex items-center gap-3 w-full pl-6 pr-3 py-2 text-sm text-white transition-colors {isDisabled
														? 'cursor-not-allowed'
														: 'hover:bg-gray1 cursor-pointer'}"
												>
													<input
														type="checkbox"
														bind:group={selectedRooms}
														value={roomKey}
														disabled={isDisabled}
														class="hidden"
													/>
													<div
														class="flex items-center justify-center w-4 h-4 rounded border {selectedRooms.includes(
															roomKey
														)
															? 'bg-lime border-lime'
															: 'border-gray2/50 bg-transparent'} transition-colors"
													>
														{#if selectedRooms.includes(roomKey)}<svg
																class="w-3.5 h-3.5 text-black"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="3"
																stroke-linecap="round"
																stroke-linejoin="round"
																><polyline points="20 6 9 17 4 12"></polyline></svg
															>{/if}
													</div>
													<div class="flex items-center gap-2">
														<span
															class="w-2.5 h-2.5 rounded-full shadow-sm"
															style="background-color: {stage.color}"
														></span>{stage.name}
													</div>
												</label>
											{/each}
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				<div class="space-y-3">
					<div class="relative w-full" bind:this={typeRef}>
						<span class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
							>Event Type <span class="text-lime">*</span></span
						>
						<button
							type="button"
							class="w-full px-3 py-2.5 bg-black/40 border border-gray2/20 rounded-2xl text-white text-sm text-left flex justify-between items-center cursor-pointer transition-colors hover:border-lime/50"
							on:click={() => (showTypeDropdown = !showTypeDropdown)}
							aria-label="Select event type"
						>
							{#if eventType}
								<div class="flex items-center gap-2">
									<span
										class="w-2.5 h-2.5 rounded-full"
										style="background-color: {typeColors[eventType]}"
									></span>{eventType === 'Bazart Nuits' ? 'Nuits Bazart' : eventType}
								</div>
							{:else}
								<span class="text-gray2/50">Select Event Type</span>
							{/if}
							<svg
								class="w-3.5 h-3.5 transition-transform {showTypeDropdown ? 'rotate-180' : ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
						</button>
						{#if showTypeDropdown}
							<div
								class="absolute top-[calc(100%+4px)] left-0 bg-navbar border border-gray2/20 rounded-2xl shadow-xl z-50 w-full overflow-hidden"
							>
								<button
									type="button"
									class="w-full px-3 py-2 text-sm text-gray2 text-left hover:bg-lime/10 border-b border-gray1 cursor-pointer"
									on:click={() => {
										eventType = '';
										showTypeDropdown = false;
									}}>Clear Selection</button
								>
								{#each types as type}
									<button
										type="button"
										class="w-full px-3 py-2 text-sm text-white text-left hover:bg-lime/10 flex items-center gap-2.5 border-b border-gray1 last:border-b-0 cursor-pointer"
										on:click={() => handleEventTypeChange(type)}
									>
										<span
											class="w-2.5 h-2.5 rounded-full"
											style="background-color: {typeColors[type]}"
										></span>{type === 'Bazart Nuits' ? 'Nuits Bazart' : type}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="relative w-full opacity-50 cursor-not-allowed">
						<span class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
							>Event Template</span
						>
						<div
							class="w-full px-3 py-2.5 bg-black/40 border border-gray2/20 rounded-2xl text-gray2/50 text-sm text-left flex justify-between items-center"
						>
							<span>Coming soon</span>
							<svg
								class="w-3.5 h-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
						</div>
					</div>

					{#if eventType !== ''}
						<div
							class="bg-black/20 border border-gray2/10 rounded-2xl p-4 flex flex-col gap-3"
							transition:slide
						>
							<div class="flex justify-between items-center">
								<span class="text-[10px] font-bold text-gray2 uppercase tracking-wider"
									>Event Time</span
								>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										class="hidden"
										bind:checked={globalAllDay}
										on:change={applyGlobalTimes}
									/>
									<div
										class="w-3.5 h-3.5 rounded border flex items-center justify-center {globalAllDay
											? 'bg-lime border-lime'
											: 'border-gray2/50'} transition-colors"
									>
										{#if globalAllDay}<svg
												class="w-2.5 h-2.5 text-black"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="4"
												stroke-linecap="round"
												stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
											>{/if}
									</div>
									<span class="text-xs font-bold text-white">All Day</span>
								</label>
							</div>

							<div
								class="flex items-center gap-2 transition-opacity {globalAllDay
									? 'opacity-30 pointer-events-none'
									: 'opacity-100'}"
							>
								<input
									type="time"
									lang="en-US"
									bind:value={globalStart}
									on:change={applyGlobalTimes}
									class="flex-1 bg-gray1 border border-gray2/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lime"
									disabled={globalAllDay}
								/>
								<span class="text-gray2 text-xs font-bold">to</span>
								<input
									type="time"
									lang="en-US"
									bind:value={globalEnd}
									on:change={applyGlobalTimes}
									class="flex-1 bg-gray1 border border-gray2/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lime"
									disabled={globalAllDay}
								/>
							</div>
						</div>
					{/if}
				</div>

				<div>
					<span class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
						>Dates <span class="text-lime">*</span></span
					>
					<div class="border border-gray2/20 rounded-2xl bg-navbar flex flex-col mb-3">
						<div
							class="p-4 flex justify-between items-center border-b border-gray2/10 min-h-[72px]"
						>
							{#if dates.length === 0}
								<span class="text-sm font-bold text-gray2/50 italic">Click on the calendar</span>
							{:else}
								<span class="text-sm font-bold text-white"
									>{dates.length} date{dates.length > 1 ? 's' : ''}</span
								>
								<div class="text-right">
									<p class="text-sm font-bold text-white">{dateRangeObj.title}</p>
									<p class="text-[10px] font-bold text-gray2 mt-0.5">{dateRangeObj.subtitle}</p>
								</div>
							{/if}
						</div>
						<button
							type="button"
							class="w-full py-3 text-sm font-bold text-lime hover:text-lime/80 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							on:click={() => (view = 'review')}
							disabled={dates.length === 0}
						>
							Review dates <svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg
							>
						</button>
					</div>

					<div>
						<label
							for="eventNotes"
							class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
							>Event Description</label
						>
						<textarea
							id="eventNotes"
							bind:value={notes}
							rows="3"
							placeholder=""
							class="w-full px-3 py-2.5 bg-black/40 border-2 border-gray2/20 rounded-2xl text-white text-sm focus:border-lime focus:outline-none transition-colors resize-none"
						></textarea>
					</div>
				</div>

				{#if eventStatus === 'HOLD'}
					<label
						class="flex items-center gap-2.5 p-3 bg-black/20 rounded-2xl border border-gray2/10 cursor-pointer"
					>
						<input
							type="checkbox"
							bind:checked={priorityHold}
							on:change={handlePriorityChange}
							class="hidden"
						/>
						<div
							class="flex items-center justify-center w-3.5 h-3.5 rounded-sm border {priorityHold
								? 'bg-lime border-lime'
								: 'border-gray2/50'}"
						>
							{#if priorityHold}<svg
									class="w-2.5 h-2.5 text-black"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
								>{/if}
						</div>
						<span class="text-xs text-gray2 font-bold">Priority Hold (Auto-assigns H1)</span>
					</label>
				{/if}
			</div>
		{:else}
			<div
				class="flex-1 overflow-y-auto p-4 pb-32 space-y-4 custom-scrollbar flex flex-col"
				bind:this={holdPickerRef}
			>
				<div class="relative w-full" bind:this={venueRefReview}>
					<span class="block text-[10px] font-bold text-gray2 uppercase mb-1 ml-1"
						>Venue (Select All)</span
					>
					<div
						role="button"
						tabindex="0"
						class="w-full px-3 py-2 bg-black/40 border border-gray2/20 rounded-xl text-white text-sm text-left flex justify-between items-center cursor-pointer min-h-[42px]"
						on:click={() => (showVenueDropdownReview = !showVenueDropdownReview)}
						on:keydown={(e) => {
							if (e.key === 'Enter') showVenueDropdownReview = !showVenueDropdownReview;
						}}
					>
						<div class="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
							{#if selectedRooms.length === 0}
								<span class="text-gray2/50">Select Stage(s)</span>
							{:else}
								{#each selectedRooms as roomKey}
									{@const color = getRoomColor(roomKey.split(':::')[0], roomKey.split(':::')[2])}
									<span
										class="flex items-center gap-1.5 bg-navbar border border-gray2/20 px-2 py-1 rounded-md text-[10px] font-bold text-white"
										><span
											class="w-2.5 h-2.5 rounded-full shadow-sm"
											style="background-color: {color}"
										></span>{roomKey.split(':::')[2]}</span
									>
								{/each}
							{/if}
						</div>
						<svg
							class="w-3.5 h-3.5 shrink-0 transition-transform {showVenueDropdownReview
								? 'rotate-180'
								: ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					</div>

					{#if showVenueDropdownReview}
						<div
							class="absolute top-[calc(100%+4px)] left-0 bg-navbar border border-gray2/20 rounded-2xl shadow-xl z-50 w-full overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar"
						>
							{#each venueOptions as venue}
								{@const venueStages =
									typeof venue.setting_params === 'string'
										? JSON.parse(venue.setting_params).stages || []
										: venue.setting_params.stages || []}
								{@const allSelected =
									venueStages.length > 0 &&
									venueStages.every((s: StageConfig) =>
										selectedRooms.includes(`${venue.id}:::${venue.setting_name}:::${s.name}`)
									)}
								{@const isDisabled = activeVenueId !== null && activeVenueId !== venue.id}
								<div
									class="border-b border-gray2/10 pb-2 transition-opacity {isDisabled
										? 'opacity-30'
										: ''}"
								>
									<div class="p-3 flex justify-between items-center bg-navbar">
										<span class="text-sm font-bold text-white uppercase tracking-wide"
											>{venue.setting_name}</span
										>
										{#if venueStages.length > 0}
											<button
												type="button"
												disabled={isDisabled}
												class="text-[10px] font-bold text-gray2 uppercase"
												on:click={() => toggleVenueStages(venue, venueStages, allSelected)}
												>{allSelected ? 'Deselect All' : 'Select All'}</button
											>
										{/if}
									</div>
									{#each venueStages as stage}
										{@const roomKey = `${venue.id}:::${venue.setting_name}:::${stage.name}`}
										<label
											class="flex items-center gap-3 w-full pl-6 pr-3 py-2 text-sm text-white hover:bg-gray1 cursor-pointer"
										>
											<input
												type="checkbox"
												bind:group={selectedRooms}
												value={roomKey}
												disabled={isDisabled}
												class="hidden"
											/>
											<div
												class="flex items-center justify-center w-4 h-4 rounded border {selectedRooms.includes(
													roomKey
												)
													? 'bg-lime border-lime'
													: 'border-gray2/50 bg-transparent'}"
											>
												{#if selectedRooms.includes(roomKey)}<svg
														class="w-3.5 h-3.5 text-black"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="3"
														stroke-linecap="round"
														stroke-linejoin="round"
														><polyline points="20 6 9 17 4 12"></polyline></svg
													>{/if}
											</div>
											<div class="flex items-center gap-2">
												<span
													class="w-2.5 h-2.5 rounded-full shadow-sm"
													style="background-color: {stage.color}"
												></span>{stage.name}
											</div>
										</label>
									{/each}
								</div>
							{/each}
						</div>
					{/if}
				</div>

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
								<svg
									class="w-3 h-3 text-black"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
								>
							</div>
							<span class="text-[10px] font-bold text-white uppercase tracking-wider">All</span>
						</label>
					</div>
					<div class="flex items-center justify-center border-l border-gray2/20">
						<label
							class="flex items-center gap-1.5 cursor-pointer {selectedDateRows.length === 0
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
						{#if eventStatus === 'HOLD'}
							<div class="relative flex items-center justify-center">
								<button
									class="w-6 h-6 flex items-center justify-center rounded-lg bg-lime/10 text-lime border border-lime/20 font-bold text-[10px] hover:bg-lime/20 transition-colors {selectedDateRows.length ===
									0
										? 'opacity-30 pointer-events-none'
										: ''}"
									on:click={() => (activeHoldPicker = activeHoldPicker === 'bulk' ? null : 'bulk')}
									aria-label="Bulk Hold">H</button
								>

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
						{/if}
						<button
							class="w-6 h-6 flex items-center justify-center rounded-lg text-gray2 hover:text-problem hover:bg-problem/10 transition-colors {selectedDateRows.length ===
							0
								? 'opacity-30 pointer-events-none'
								: ''}"
							on:click={deleteSelectedRows}
							aria-label="Delete selected rows"
						>
							<svg
								class="w-3.5 h-3.5"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><polyline points="3 6 5 6 21 6"></polyline><path
									d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
								></path></svg
							>
						</button>
					</div>
				</div>

				<div class="flex-1 flex flex-col gap-2">
					{#each dates as date}
						{@const tSet = timeSettings[date] || { allDay: true, start: '', end: '' }}
						<div class="bg-navbar border border-gray2/10 p-3 rounded-xl flex flex-col gap-2 w-full">
							<div class="grid grid-cols-3 items-center w-full">
								<div class="flex items-center gap-2 overflow-hidden">
									<label class="flex items-center cursor-pointer shrink-0">
										<input
											type="checkbox"
											class="hidden"
											bind:group={selectedDateRows}
											value={date}
										/>
										<div
											class="w-4 h-4 rounded border flex items-center justify-center {selectedDateRows.includes(
												date
											)
												? 'bg-lime border-lime'
												: 'border-gray2/50'}"
										>
											{#if selectedDateRows.includes(date)}<svg
													class="w-3 h-3 text-black"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
												>{/if}
										</div>
									</label>
									<p class="text-xs font-bold text-white leading-tight truncate">
										{new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
											weekday: 'short',
											month: 'short',
											day: 'numeric'
										})}
									</p>
								</div>

								<div class="flex items-center justify-center">
									<label class="flex items-center gap-1.5 cursor-pointer">
										<input
											type="checkbox"
											class="hidden"
											bind:checked={tSet.allDay}
											on:change={() => (timeSettings = { ...timeSettings })}
										/>
										<div
											class="w-3.5 h-3.5 rounded border flex items-center justify-center {tSet.allDay
												? 'bg-lime border-lime'
												: 'border-gray2/50'}"
										>
											{#if tSet.allDay}<svg
													class="w-2.5 h-2.5 text-black"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
												>{/if}
										</div>
										<span class="text-[10px] font-bold text-white uppercase tracking-wider"
											>All day</span
										>
									</label>
								</div>

								<div class="flex items-center justify-end gap-1.5">
									{#if eventStatus === 'HOLD'}
										{@const draftEvent = draftEvents.find((e) => e.date === date)}
										{@const hLvl = draftEvent ? draftEvent.hold_level : 'P'}
										<div class="relative flex items-center justify-center">
											<button
												type="button"
												class="w-7 h-7 rounded-lg border border-lime/50 text-lime font-bold text-[10px] flex items-center justify-center hover:bg-lime/10 transition-colors"
												on:click={() =>
													(activeHoldPicker = activeHoldPicker === date ? null : date)}
												aria-label="Select Hold Level"
											>
												{hLvl}
											</button>

											{#if activeHoldPicker === date}
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
									{/if}

									<button
										type="button"
										class="w-7 h-7 rounded-lg border border-gray2/20 text-gray2 flex items-center justify-center hover:text-problem hover:border-problem transition-colors"
										on:click={() => removeDateRow(date)}
										aria-label="Remove Date"
									>
										<svg
											class="w-3.5 h-3.5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><polyline points="3 6 5 6 21 6"></polyline><path
												d="M19 6v14a2 2 0 0 1-2-2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											></path></svg
										>
									</button>
								</div>
							</div>

							{#if !tSet.allDay}
								<div
									class="flex items-center gap-2 w-full pt-1 pb-1"
									transition:slide={{ duration: 150 }}
								>
									<input
										type="time"
										lang="en-US"
										bind:value={tSet.start}
										on:change={() => (timeSettings = { ...timeSettings })}
										class="w-full bg-gray1 border border-gray2/20 rounded-lg text-xs px-3 py-2 text-white focus:outline-none focus:border-lime"
									/>
									<span class="text-[10px] font-bold text-gray2 shrink-0">-</span>
									<input
										type="time"
										lang="en-US"
										bind:value={tSet.end}
										on:change={() => (timeSettings = { ...timeSettings })}
										class="w-full bg-gray1 border border-gray2/20 rounded-lg text-xs px-3 py-2 text-white focus:outline-none focus:border-lime"
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="p-4 border-t border-gray2/10 flex flex-col gap-3">
			<button
				type="button"
				class="flex items-center gap-2.5 cursor-pointer self-start"
				on:click={() => (datesAsSingleEvents = !datesAsSingleEvents)}
			>
				<div
					class="flex items-center justify-center w-3.5 h-3.5 rounded-sm border {datesAsSingleEvents
						? 'bg-lime border-lime'
						: 'border-gray2/50'} transition-colors"
				>
					{#if datesAsSingleEvents}<svg
							class="w-2.5 h-2.5 text-black"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
						>{/if}
				</div>
				<span class="text-xs text-gray2 font-bold hover:text-white transition-colors"
					>Dates as single events</span
				>
			</button>

			<div class="flex gap-3 w-full">
				<button
					type="button"
					class="flex-1 py-3 bg-gray2/10 text-white text-sm font-bold rounded-2xl transition-colors {isSaveDisabled
						? 'opacity-50 cursor-not-allowed'
						: 'hover:bg-gray2/20 cursor-pointer'}"
					on:click={() => saveAction(false)}>Save</button
				>

				<button
					type="button"
					class="flex-[1.5] py-3 bg-lime text-black text-sm font-bold rounded-2xl transition-colors {isSaveDisabled
						? 'opacity-50 cursor-not-allowed'
						: 'hover:bg-lime/90 cursor-pointer'}"
					on:click={() => saveAction(true)}>Save & View</button
				>
			</div>
		</div>
	</div>
{/if}
<PopupNotification bind:show={showPopup} message={popupMessage} variant="navbar" iconType="error" />

<div use:portal>
	<CalendarConfirm
		bind:show={showConfirmModal}
		title="Confirm Event"
		message="You are creating confirmed event(s). Do you want to notify users?"
		{saving}
		defaultEmail={defaultEmailForVenue}
		on:confirm={(e) => executeFinalSave(pendingSaveView, e.detail)}
	/>
</div>

<style>
	::-webkit-scrollbar {
		display: none;
	}
	* {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	input[type='time']::-webkit-calendar-picker-indicator {
		display: none;
		-webkit-appearance: none;
	}
</style>
