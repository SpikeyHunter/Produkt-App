// src/lib/types/calendar.d.ts

/**
 * Defines the structure for a single ground transport entry.
 */
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