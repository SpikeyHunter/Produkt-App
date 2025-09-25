// src/lib/types/GoogleCalendar.d.ts

/**
 * Defines the structure for a single ground transport entry used in calendar sync.
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

/**
 * Response from the calendar sync API
 */
export type CalendarSyncResponse = {
	success: boolean;
	eventIds: { [key: number]: string };
	message?: string;
	error?: string;
};

/**
 * Request payload for calendar sync
 */
export type CalendarSyncRequest = {
	rows: CalendarEntry[];
	artistName: string;
	eventId: string;
	existingEventIds?: { [key: number]: string };
};