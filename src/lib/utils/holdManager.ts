import type { CalendarEvent, HoldLevel, VenueSettings } from '$lib/types/calendar-types';

/** Helper to extract the integer value of a hold (e.g., 'H2' -> 2) */
export function parseHoldNumber(level: HoldLevel | string | undefined | null): number {
	if (!level || level === 'P' || !level.startsWith('H')) return 0;
	const num = parseInt(level.replace(/\D/g, ''), 10);
	return isNaN(num) ? 0 : num;
}

/** Helper to get default hold level for a venue */
export function getVenueDefaultHoldLevel(venueCategory: string, venues: VenueSettings[]): number {
	const venue = venues.find((v) => v.setting_name === venueCategory);
	if (!venue) return 2;

	let params = venue.setting_params;
	if (typeof params === 'string') {
		try {
			params = JSON.parse(params);
		} catch (e) {}
	}
	const defaultLevel = params?.holdSettings?.defaultHoldLevel || 'H2';
	return parseHoldNumber(defaultLevel as string) || 2;
}

/** 1. Get the Next Available Hold */
export function getNextAvailableHold(params: {
	date: string;
	category: string;
	room: string;
	existingEvents: Pick<CalendarEvent, 'date' | 'status' | 'hold_level' | 'venue'>[];
	isPriority: boolean;
	venues: VenueSettings[];
}): HoldLevel {
	const { date, category, room, existingEvents, isPriority, venues } = params;

	const existingNums = existingEvents
		.filter(
			(e) =>
				e.date === date &&
				e.status === 'HOLD' &&
				(e.venue?.category === category || e.venue?.category === undefined) &&
				e.venue?.room === room
		)
		.map((e) => parseHoldNumber(e.hold_level))
		.filter((n) => n > 0);

	let startNum = isPriority ? 1 : getVenueDefaultHoldLevel(category, venues);

	// Loop to find the first gap
	while (existingNums.includes(startNum) && startNum <= 20) {
		startNum++;
	}

	// Failsafe if default was high and we hit 20, loop back to 1
	if (startNum > 20) {
		startNum = 1;
		while (existingNums.includes(startNum) && startNum <= 20) {
			startNum++;
		}
	}

	return `H${Math.min(startNum, 20)}` as HoldLevel;
}

/** 2. Calculate Hold Shifts (Smart Contiguous Shifting) */
export function calculateHoldShifts(params: {
	targetEventId: string;
	newLevel: HoldLevel | string | null;
	oldLevel?: HoldLevel | string | null;
	date: string;
	category: string;
	room: string;
	existingEvents: Pick<CalendarEvent, 'id' | 'date' | 'status' | 'hold_level' | 'venue'>[];
}): { id: string; newHoldLevel: HoldLevel; newStatus: string }[] {
	const { targetEventId, newLevel, oldLevel, date, category, room, existingEvents } = params;

	// Convert levels to numeric indices. 0 becomes 999 (Treat cleared holds as moving to infinity).
	let newNum = parseHoldNumber(newLevel);
	if (newNum === 0) newNum = 999;

	let oldNum = 999;
	if (oldLevel !== undefined) {
		const parsed = parseHoldNumber(oldLevel);
		oldNum = parsed === 0 ? 999 : parsed;
	} else {
		const existingTarget = existingEvents.find((e) => e.id === targetEventId);
		if (existingTarget) {
			const parsed = parseHoldNumber(existingTarget.hold_level);
			oldNum = parsed === 0 ? 999 : parsed;
		}
	}

	if (newNum === oldNum) return []; // No movement needed

	// Get all OTHER holds for this specific room and date
	const otherRoomHolds = existingEvents
		.filter((e) => {
			// 🚨 BUG FIX: Safely parse the venue whether it's a string from DB or an active object
			let vCat = '';
			let vRoom = '';
			if (e.venue) {
				if (typeof e.venue === 'string') {
					try {
						const parsed = JSON.parse(e.venue);
						vCat = parsed.category || '';
						vRoom = parsed.room || '';
					} catch (err) {}
				} else {
					vCat = (e.venue as any).category || '';
					vRoom = (e.venue as any).room || '';
				}
			}

			return (
				e.date === date &&
				vCat === category &&
				vRoom === room &&
				e.status === 'HOLD' &&
				e.id !== targetEventId
			);
		})
		.map((e) => ({ id: e.id, num: parseHoldNumber(e.hold_level) }))
		.filter((e) => e.num > 0 && e.num <= 20);

	// 1. Snapshot original positions to track what actually moved
	const originalPositions: Record<string, number> = {};
	for (const ev of otherRoomHolds) {
		originalPositions[ev.id] = ev.num;
	}

	// 2. Build a simulated physical shelf array (1-based index, up to H20)
	const slots: (string | null)[] = Array(22).fill(null);
	for (const ev of otherRoomHolds) {
		slots[ev.num] = ev.id;
	}

	// 3. STEP A: The Vacuum (Removal of old hold bubbles gaps UP)
	if (oldNum <= 20) {
		let gap = oldNum;
		// Only pull up if there is a continuous block of holds right below it
		while (gap <= 20 && slots[gap + 1] !== null) {
			slots[gap] = slots[gap + 1];
			slots[gap + 1] = null;
			gap++;
		}
	}

	// 4. STEP B: The Insert (Adding new hold pushes items DOWN)
	if (newNum <= 20) {
		if (slots[newNum] !== null) {
			// Find nearest empty gap in the continuous block
			let gap = newNum;
			while (gap <= 20 && slots[gap] !== null) {
				gap++;
			}
			
			// Shift the continuous block down to fill the gap
			for (let i = gap; i > newNum; i--) {
				if (i <= 20) {
					slots[i] = slots[i - 1];
				}
			}
		}
		// Reserve the spot for the target event so we don't overwrite it
		slots[newNum] = 'TARGET'; 
	}

	// 5. Compare the new simulated shelf to the original positions and generate database updates
	const updates: { id: string; newHoldLevel: HoldLevel; newStatus: string }[] = [];
	
	for (let i = 1; i <= 20; i++) {
		const id = slots[i];
		if (id && id !== 'TARGET') {
			if (originalPositions[id] !== i) {
				updates.push({
					id,
					newHoldLevel: `H${i}` as HoldLevel,
					newStatus: 'HOLD' // Force status back to HOLD if it was somehow PENDING
				});
			}
		}
	}

	return updates;
}

/** 3. Auto-Promote (When an event moves or is deleted, slide remaining holds up) */
export function calculateAutoPromotions(params: {
	vacatedLevel: HoldLevel;
	date: string;
	category: string;
	room: string;
	existingEvents: Pick<CalendarEvent, 'id' | 'date' | 'status' | 'hold_level' | 'venue'>[];
}): { id: string; newHoldLevel: HoldLevel }[] {
	const vacatedNum = parseHoldNumber(params.vacatedLevel);
	if (vacatedNum === 0) return [];

	const updates: { id: string; newHoldLevel: HoldLevel }[] = [];

	const roomHolds = params.existingEvents.filter(
		(e) =>
			e.date === params.date &&
			e.status === 'HOLD' &&
			e.venue?.category === params.category &&
			e.venue?.room === params.room
	);

	for (const hold of roomHolds) {
		const oldNum = parseHoldNumber(hold.hold_level);
		if (oldNum > vacatedNum) {
			updates.push({
				id: hold.id,
				newHoldLevel: `H${oldNum - 1}` as HoldLevel
			});
		}
	}

	return updates;
}
