// src/lib/services/autofillService.ts

// This is the primary data structure for a single row in the ground transport calendar.
export type CalendarEntry = {
	id: number;
	date: string;
	type: 'Arrival' | 'Departure' | 'Soundcheck' | 'Post-SC' | 'Show' | 'Post Show' | '';
	driverName: string;
	pickupTime: string;
	pickupLocation: string;
	dropoffTime: string;
	dropoffLocation: string;
	paxNames: string;
	flightInfo: string;
	contact: string;
};

// --- DATA STRUCTURES (Types are unchanged) ---

type Flight = {
	id: number;
	to: string;
	date: string;
	from: string;
	time: string; // ISO 8601 format (e.g., "2025-09-19T16:55-04:00")
	flightNumber: string;
	assignedRoles: string[];
	hoursBeforeDeparture?: number;
};

type GroundInfo = {
	arrivals: Flight[];
	departures: Flight[];
};

type HotelInfoArray = {
	id: string;
	reservationFirstName: string;
	reservationLastName: string;
	hotelName: string;
	customHotelName: string;
	customHotelAddress: string;
	roomType: string;
	checkInDate: string;
	checkInTime: string;
	checkOutDate: string;
	checkOutTime: string;
	notes: string;
	requestEarlyCheckIn: boolean;
	earlyCheckInTime: string;
	requestLateCheckOut: boolean;
	lateCheckOutTime: string;
	isPaidByUs: boolean;
	confirmationNumber: string;
};

import type { HotelInfo } from '../types/events';

type SoundcheckInfo = {
	enabled: boolean;
	end_time: string;
	start_time: string;
};

type TimetableEntry = {
	id: string;
	time: string;
	notes: string;
	artist: string;
	length: string;
	status: string;
};

type RoleInfo = {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
	customRole?: string;
	immigration?: boolean;
};

type EventForAutofill = {
	ground_info?: string | null | GroundInfo;
	hotel_info?: string | null | HotelInfo | HotelInfoArray[];
	soundcheck?: string | null | SoundcheckInfo;
	timetable?: string | null | TimetableEntry[];
	roles?: string | null | RoleInfo[];
	main_contact?: string | null;
	artist_name?: string;
	event_date?: string;
};

// --- SIMPLIFIED HELPER FUNCTIONS (MATH-BASED) ---

/**
 * Converts a "HH:MM" time string into the total number of minutes from midnight.
 * Example: "01:30" => 90
 */
function timeToMinutes(timeStr: string): number {
	const [hours, minutes] = timeStr.split(':').map(Number);
	return hours * 60 + minutes;
}

/**
 * Converts a total number of minutes from midnight into a "HH:MM" time string.
 * This function handles times that wrap around to the next day (e.g., > 1440 minutes).
 * Example: 90 => "01:30"
 * Example: 1500 => "01:00" (since 1500 min = 25 hours)
 */
function minutesToTime(totalMinutes: number): string {
	const minutesInDay = 24 * 60;
	// Use modulo to handle times past midnight
	const minutes = Math.floor(totalMinutes) % minutesInDay;

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	const formattedHours = hours.toString().padStart(2, '0');
	const formattedMins = mins.toString().padStart(2, '0');

	return `${formattedHours}:${formattedMins}`;
}

/**
 * Rounds a number of minutes to the nearest 15-minute interval.
 * Example: 48 => 45
 * Example: 57 => 60
 */
function roundMinutesToNearest15(minutes: number): number {
	return Math.round(minutes / 15) * 15;
}

/**
 * Adds a specified number of days to a "YYYY-MM-DD" date string.
 */
function addDays(dateStr: string, days: number): string {
	const date = new Date(dateStr + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
	date.setDate(date.getDate() + days);
	return date.toISOString().split('T')[0];
}

/**
 * Converts a 12-hour format time string (e.g., "1:00 PM") to 24-hour format ("13:00").
 */
function convertTo24Hour(timeStr: string): string {
	const time = timeStr.trim().toLowerCase();
	const isPM = time.includes('pm');
	const isAM = time.includes('am');

	if (!isPM && !isAM) return time; // Already 24-hour

	let [hours, minutes] = time.replace(/[ap]m/i, '').split(':').map(s => parseInt(s.trim()));

	if (isPM && hours !== 12) {
		hours += 12;
	} else if (isAM && hours === 12) {
		hours = 0; // Midnight case
	}

	return `${hours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`;
}


// --- PARSING FUNCTIONS (Largely unchanged) ---

function parseHotelInfo(hotelInfo: string | HotelInfo | HotelInfoArray[] | null | undefined): string {
	if (!hotelInfo) return 'Hotel Name';
	try {
		let hotels: any[];
		if (typeof hotelInfo === 'string') hotels = JSON.parse(hotelInfo);
		else if (Array.isArray(hotelInfo)) hotels = hotelInfo;
		else hotels = [{ hotelName: (hotelInfo as any).hotel_name || 'Hotel Name', ...hotelInfo }];
		
		if (hotels.length > 0) {
			const hotel = hotels[0];
			return hotel.customHotelName || hotel.hotelName || hotel.hotel_name || 'Hotel Name';
		}
	} catch (error) { console.error('Failed to parse hotel info:', error); }
	return 'Hotel Name';
}

function parseRoles(roles: string | RoleInfo[] | null | undefined): { artistAndManager: string[], crew: string[], totalPeople: number } {
	if (!roles) return { artistAndManager: [], crew: [], totalPeople: 0 };
	try {
		const roleList: RoleInfo[] = typeof roles === 'string' ? JSON.parse(roles) : roles;
		const artistAndManager: string[] = [];
		const crew: string[] = [];

		roleList.forEach(person => {
			const firstName = person.firstName || '';
			const role = (person.customRole || person.role || '').toLowerCase();
			if (['artist', 'manager', 'tour manager', 'video', 'media', 'photographer'].some(r => role.includes(r))) {
				artistAndManager.push(firstName);
			} else {
				crew.push(firstName);
			}
		});
		return { artistAndManager, crew, totalPeople: roleList.length };
	} catch (error) {
		console.error('Failed to parse roles:', error);
		return { artistAndManager: [], crew: [], totalPeople: 0 };
	}
}

function getDriverAssignments(totalPeople: number, artistAndManager: string[], crew: string[]): { car1Driver: string, car1Passengers: string, car2Driver?: string, car2Passengers?: string } {
	if (totalPeople <= 4) {
		return { car1Driver: 'Eddy', car1Passengers: [...artistAndManager, ...crew].join('+') };
	}
	if (artistAndManager.length > 0) {
		return { car1Driver: 'Eddy', car1Passengers: artistAndManager.join('+'), car2Driver: 'Reza', car2Passengers: crew.join('+') };
	}
	const allPeople = [...artistAndManager, ...crew];
	const halfPoint = Math.ceil(allPeople.length / 2);
	return { car1Driver: 'Eddy', car1Passengers: allPeople.slice(0, halfPoint).join('+'), car2Driver: 'Reza', car2Passengers: allPeople.slice(halfPoint).join('+') };
}

// --- REFACTORED AUTO-FILL LOGIC ---

export function autofillData(event: EventForAutofill): CalendarEntry[] {
	console.log(`Autofilling ground transport data for: ${event.artist_name || 'Unknown Artist'}`);

	const generatedEntries: CalendarEntry[] = [];
	const contactInfo = event.main_contact || '';
	const hotelName = parseHotelInfo(event.hotel_info);
	const roleData = parseRoles(event.roles);
	const eventDateStr = event.event_date || new Date().toISOString().split('T')[0];

	// --- Process Flight Arrivals and Departures ---
	if (event.ground_info) {
		const groundInfo: GroundInfo =
			typeof event.ground_info === 'string' ? JSON.parse(event.ground_info) : event.ground_info;

		// Process Arrivals
		(groundInfo.arrivals || []).forEach((flight) => {
			const flightDate = flight.time.substring(0, 10); // FIX: Extract date from the ISO timestamp
			const pickupTime = flight.time.substring(11, 16); // Extract "HH:MM"
			const dropoffTime = minutesToTime(timeToMinutes(pickupTime) + 30);
			const pax = flight.assignedRoles.map((name) => name.split(' ')[0]);
			const driverAssignment = getDriverAssignments(pax.length, [], pax);

			const entry: CalendarEntry = {
				id: Date.now() + Math.random(),
				date: flightDate, // FIX: Use the correct extracted date
				type: 'Arrival',
				driverName: driverAssignment.car1Driver,
				pickupTime,
				pickupLocation: 'Airport',
				dropoffTime,
				dropoffLocation: hotelName,
				paxNames: driverAssignment.car1Passengers,
				flightInfo: `${flight.from}>${flight.to} ${flight.flightNumber}`,
				contact: contactInfo
			};
			generatedEntries.push(entry);
		});

		// Process Departures
		(groundInfo.departures || []).forEach((flight) => {
			const flightDate = flight.time.substring(0, 10); // FIX: Extract date from the ISO timestamp for consistency
			const departureTimeMinutes = timeToMinutes(flight.time.substring(11, 16));
			const hoursBefore = flight.hoursBeforeDeparture || 2;
			const totalMinutesToSubtract = hoursBefore * 60 + 30; // hours + 30 min drive

			const pickupMinutes = departureTimeMinutes - totalMinutesToSubtract;
			const roundedPickupMinutes = roundMinutesToNearest15(pickupMinutes);

			const pickupTime = minutesToTime(roundedPickupMinutes);
			const dropoffTime = minutesToTime(roundedPickupMinutes + 30);

			const pax = flight.assignedRoles.map((name) => name.split(' ')[0]);
			const driverAssignment = getDriverAssignments(pax.length, [], pax);

			const entry: CalendarEntry = {
				id: Date.now() + Math.random(),
				date: flightDate, // FIX: Use the correct extracted date
				type: 'Departure',
				driverName: driverAssignment.car1Driver,
				pickupTime,
				pickupLocation: hotelName,
				dropoffTime,
				dropoffLocation: 'Airport',
				paxNames: driverAssignment.car1Passengers,
				flightInfo: `${flight.from}>${flight.to} ${flight.flightNumber}`,
				contact: contactInfo
			};
			generatedEntries.push(entry);
		});
	}

	// --- Process Soundcheck Schedule ---
	if (event.soundcheck) {
		const soundcheckInfo: SoundcheckInfo =
			typeof event.soundcheck === 'string' ? JSON.parse(event.soundcheck) : event.soundcheck;

		if (soundcheckInfo.enabled && soundcheckInfo.start_time) {
			const driverAssignment = getDriverAssignments(
				roleData.totalPeople,
				roleData.artistAndManager,
				roleData.crew
			);

			// Soundcheck pickup (15 minutes before)
			const scPickupMinutes = timeToMinutes(soundcheckInfo.start_time) - 15;
			const scPickupTime = minutesToTime(roundMinutesToNearest15(scPickupMinutes));

			generatedEntries.push({
				id: Date.now() + Math.random(),
				date: eventDateStr,
				type: 'Soundcheck',
				driverName: driverAssignment.car1Driver,
				pickupTime: scPickupTime,
				pickupLocation: hotelName,
				dropoffTime: soundcheckInfo.start_time,
				dropoffLocation: 'NCG',
				paxNames: driverAssignment.car1Passengers,
				flightInfo: '',
				contact: contactInfo
			});

			// Post-Soundcheck pickup
			generatedEntries.push({
				id: Date.now() + Math.random(),
				date: eventDateStr,
				type: 'Post-SC',
				driverName: driverAssignment.car1Driver,
				pickupTime: soundcheckInfo.end_time,
				pickupLocation: 'NCG',
				dropoffTime: minutesToTime(timeToMinutes(soundcheckInfo.end_time) + 15),
				dropoffLocation: hotelName,
				paxNames: driverAssignment.car1Passengers,
				flightInfo: '',
				contact: contactInfo
			});

			// FIXED: Check for both car2Driver and car2Passengers
			if (driverAssignment.car2Driver && driverAssignment.car2Passengers) {
				generatedEntries.push(
					{
						id: Date.now() + Math.random(),
						date: eventDateStr,
						type: 'Soundcheck',
						driverName: driverAssignment.car2Driver,
						pickupTime: scPickupTime,
						pickupLocation: hotelName,
						dropoffTime: soundcheckInfo.start_time,
						dropoffLocation: 'NCG',
						paxNames: driverAssignment.car2Passengers,
						flightInfo: '',
						contact: contactInfo
					},
					{
						id: Date.now() + Math.random(),
						date: eventDateStr,
						type: 'Post-SC',
						driverName: driverAssignment.car2Driver,
						pickupTime: soundcheckInfo.end_time,
						pickupLocation: 'NCG',
						dropoffTime: minutesToTime(timeToMinutes(soundcheckInfo.end_time) + 15),
						dropoffLocation: hotelName,
						paxNames: driverAssignment.car2Passengers,
						flightInfo: '',
						contact: contactInfo
					}
				);
			}
		}
	}

	// --- Process Show Schedule ---
	if (event.timetable) {
		const timetable: TimetableEntry[] =
			typeof event.timetable === 'string' ? JSON.parse(event.timetable) : event.timetable;
		const artistSet = timetable.find(
			(entry) =>
				entry.artist.toLowerCase().includes(event.artist_name?.toLowerCase() || '') ||
				entry.notes.toLowerCase().includes('headliner')
		);

		if (artistSet && artistSet.time && artistSet.length) {
			const showStartTime24 = convertTo24Hour(artistSet.time);
			let showStartMinutes = timeToMinutes(showStartTime24);

			// Handle overnight shows (e.g., 1:00 AM is on the next day)
			// A show between 12 AM (0) and 3 AM (180) is considered part of the previous evening's event.
			if (showStartMinutes >= 0 && showStartMinutes <= 180) {
				showStartMinutes += 24 * 60; // Add a full day in minutes
			}

			// Calculate duration
			const durationMatch = artistSet.length.match(/(\d+)h?\s*(\d+)?m?/);
			const hours = durationMatch ? parseInt(durationMatch[1]) || 0 : 2;
			const minutes = durationMatch ? parseInt(durationMatch[2]) || 0 : 0;
			const durationMinutes = hours * 60 + minutes;

			// Calculate key event times in minutes from the start of event_date
			const pickupTotalMinutes = roundMinutesToNearest15(showStartMinutes - 45); // 45 min before show
			const showEndTotalMinutes = showStartMinutes + durationMinutes;

			// Determine the correct date string for each event
			const pickupDayOffset = Math.floor(pickupTotalMinutes / (24 * 60));
			const postShowDayOffset = Math.floor(showEndTotalMinutes / (24 * 60));
			const pickupDate = addDays(eventDateStr, pickupDayOffset);
			const postShowDate = addDays(eventDateStr, postShowDayOffset);

			// Convert minute totals back to "HH:MM" strings
			const pickupTime = minutesToTime(pickupTotalMinutes);
			const showDropoffTime = minutesToTime(pickupTotalMinutes + 15);
			const postShowPickupTime = minutesToTime(showEndTotalMinutes);
			const postShowDropoffTime = minutesToTime(showEndTotalMinutes + 15);

			const driverAssignment = getDriverAssignments(
				roleData.totalPeople,
				roleData.artistAndManager,
				roleData.crew
			);

			// Add "Show" entry
			generatedEntries.push({
				id: Date.now() + Math.random(),
				date: pickupDate,
				type: 'Show',
				driverName: driverAssignment.car1Driver,
				pickupTime,
				pickupLocation: hotelName,
				dropoffTime: showDropoffTime,
				dropoffLocation: 'NCG',
				paxNames: driverAssignment.car1Passengers,
				flightInfo: '',
				contact: contactInfo
			});

			// Add "Post Show" entry
			generatedEntries.push({
				id: Date.now() + Math.random(),
				date: postShowDate,
				type: 'Post Show',
				driverName: driverAssignment.car1Driver,
				pickupTime: postShowPickupTime,
				pickupLocation: 'NCG',
				dropoffTime: postShowDropoffTime,
				dropoffLocation: hotelName,
				paxNames: driverAssignment.car1Passengers,
				flightInfo: '',
				contact: contactInfo
			});

			// FIXED: Check for both car2Driver and car2Passengers
			if (driverAssignment.car2Driver && driverAssignment.car2Passengers) {
				generatedEntries.push(
					{
						id: Date.now() + Math.random(),
						date: pickupDate,
						type: 'Show',
						driverName: driverAssignment.car2Driver,
						pickupTime,
						pickupLocation: hotelName,
						dropoffTime: showDropoffTime,
						dropoffLocation: 'NCG',
						paxNames: driverAssignment.car2Passengers,
						flightInfo: '',
						contact: contactInfo
					},
					{
						id: Date.now() + Math.random(),
						date: postShowDate,
						type: 'Post Show',
						driverName: driverAssignment.car2Driver,
						pickupTime: postShowPickupTime,
						pickupLocation: 'NCG',
						dropoffTime: postShowDropoffTime,
						dropoffLocation: hotelName,
						paxNames: driverAssignment.car2Passengers,
						flightInfo: '',
						contact: contactInfo
					}
				);
			}
		}
	}

	console.log(`Generated ${generatedEntries.length} ground transport entries.`);
	return generatedEntries.sort((a, b) => {
		const dateComparison = a.date.localeCompare(b.date);
		if (dateComparison !== 0) return dateComparison;
		return a.pickupTime.localeCompare(b.pickupTime);
	});
}
