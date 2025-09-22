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

// --- NEW TYPES FOR PARSING FLIGHT DATA ---

/**
 * Represents the structure of a single flight within the ground_info JSON.
 */
type Flight = {
	id: number;
	to: string;
	date: string;
	from: string;
	time: string; // ISO 8601 format (e.g., "2025-09-19T16:55-04:00")
	flightNumber: string;
	assignedRoles: string[];
	hoursBeforeDeparture?: number; // Optional, only for departures
};

/**
 * Represents the entire JSON object stored in the `events_advance.ground_info` column.
 */
type GroundInfo = {
	arrivals: Flight[];
	departures: Flight[];
};

/**
 * A simplified representation of an event, containing only the fields
 * needed by this auto-fill service. In a real application, this would
 * likely be the imported `EventAdvance` type.
 */
type EventForAutofill = {
	ground_info?: string | null | GroundInfo; // Can be a JSON string or an object
	main_contact?: string | null;
	artist_name?: string; // Used for logging/context
};

// --- HELPER FUNCTIONS ---

/**
 * Formats a Date object into a "HH:MM" 24-hour string.
 * @param date The date object to format.
 * @returns A string in "HH:MM" format (e.g., "09:30" or "23:15").
 */
function formatTime(date: Date): string {
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
}

/**
 * Rounds a Date object's time to the nearest 15-minute interval.
 * @param date The date object to round.
 * @returns A new Date object with the minutes rounded.
 */
function roundToNearest15(date: Date): Date {
	const roundedDate = new Date(date.getTime());
	const minutes = roundedDate.getMinutes();
	const roundedMinutes = Math.round(minutes / 15) * 15;

	// Set the date to the rounded minute, allowing it to handle hour rollovers automatically
	roundedDate.setMinutes(roundedMinutes, 0, 0);
	return roundedDate;
}

/**
 * Calculates a rounded drop-off time for an arrival.
 * It adds 30 minutes to the pickup time and then rounds the result.
 * @param pickupTime A time string in "HH:MM" format.
 * @returns A new, rounded time string in "HH:MM" format.
 */
function calculateRoundedDropoffTime(pickupTime: string): string {
	const [hours, minutes] = pickupTime.split(':').map(Number);
	const tempDate = new Date();
	tempDate.setHours(hours, minutes, 0, 0);

	// Add the 30-minute drive time
	tempDate.setMinutes(tempDate.getMinutes() + 30);

	// Use the helper function for rounding
	const roundedDate = roundToNearest15(tempDate);

	return formatTime(roundedDate);
}

// --- AUTO-FILL LOGIC ---

/**
 * Parses flight data from an event's `ground_info` field to automatically
 * generate ground transport calendar entries for arrivals and departures.
 * @param event An object containing event details, including `ground_info` and `main_contact`.
 * @returns An array of `CalendarEntry` objects.
 */
export function autofillData(event: EventForAutofill): CalendarEntry[] {
	console.log(`Autofilling ground transport data for: ${event.artist_name || 'Unknown Artist'}`);

	if (!event.ground_info) {
		console.log('No ground_info data found. Returning empty array.');
		return [];
	}

	let groundInfo: GroundInfo;
	try {
		groundInfo =
			typeof event.ground_info === 'string' ? JSON.parse(event.ground_info) : event.ground_info;
	} catch (error) {
		console.error('Failed to parse ground_info JSON:', error);
		return [];
	}

	const generatedEntries: CalendarEntry[] = [];
	const contactInfo = event.main_contact || '';
	const DRIVE_TIME_MINUTES = 30;

	// --- Process Arrivals ---
	if (groundInfo.arrivals && groundInfo.arrivals.length > 0) {
		groundInfo.arrivals.forEach((flight) => {
			const arrivalDateTime = new Date(flight.time);
			const pickupTime = formatTime(arrivalDateTime);

			const entry: CalendarEntry = {
				id: Date.now() + Math.random(),
				date: flight.date,
				type: 'Arrival',
				driverName: 'Eddy',
				pickupTime: pickupTime,
				pickupLocation: 'Airport',
				dropoffTime: calculateRoundedDropoffTime(pickupTime),
				dropoffLocation: 'Hotel Name',
				paxNames: flight.assignedRoles.map((name) => name.split(' ')[0]).join('+'),
				flightInfo: `${flight.from}>${flight.to} ${flight.flightNumber}`,
				contact: contactInfo
			};
			generatedEntries.push(entry);
		});
	}

	// --- Process Departures ---
	if (groundInfo.departures && groundInfo.departures.length > 0) {
		groundInfo.departures.forEach((flight) => {
			const departureDateTime = new Date(flight.time);
			const hoursBefore = flight.hoursBeforeDeparture || 2;

			// --- CORRECTED LOGIC ---
			// Calculate total minutes to subtract to handle fractional hours safely
			const totalMinutesToSubtract = hoursBefore * 60 + DRIVE_TIME_MINUTES;

			// Create the new pickup time by subtracting the total minutes
			const pickupTimestamp = departureDateTime.getTime() - totalMinutesToSubtract * 60 * 1000;
			const pickupDateTime = new Date(pickupTimestamp);
			// --- END CORRECTION ---

			// Round the calculated pickup time to the nearest 15 minutes
			const roundedPickupDateTime = roundToNearest15(pickupDateTime);

			// Dropoff time is when they arrive at the airport (pickup + drive time)
			const dropoffDateTime = new Date(roundedPickupDateTime.getTime());
			dropoffDateTime.setMinutes(dropoffDateTime.getMinutes() + DRIVE_TIME_MINUTES);

			const entry: CalendarEntry = {
				id: Date.now() + Math.random(),
				date: flight.date,
				type: 'Departure',
				driverName: 'Eddy',
				pickupTime: formatTime(roundedPickupDateTime), // Use the rounded time
				pickupLocation: 'Hotel Name',
				dropoffTime: formatTime(dropoffDateTime),
				dropoffLocation: 'Airport',
				paxNames: flight.assignedRoles.map((name) => name.split(' ')[0]).join('+'),
				flightInfo: `${flight.from}>${flight.to} ${flight.flightNumber}`,
				contact: contactInfo
			};
			generatedEntries.push(entry);
		});
	}

	console.log(`Generated ${generatedEntries.length} ground transport entries.`);
	return generatedEntries;
}