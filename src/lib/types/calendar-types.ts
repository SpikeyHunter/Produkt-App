// src/lib/types/calendar-types.ts
// Place this file at: src/lib/types/calendar-types.ts

export type EventStatus = 'HOLD' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';
export type EventType = 'Show' | 'Corpo' | 'Other';
export type VenueCategory = 'Co-Pro Shows' | 'New City Gas' | 'Bazart';
export type HoldLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'P' | null;

export interface CalendarEvent {
	calendar_event_id: string;
	user_id?: string;
	title: string;
	artist_name?: string;
	venue_category?: VenueCategory | null;
	venue_room?: string;
	date: string; // YYYY-MM-DD
	start_time?: string;
	end_time?: string;
	status: EventStatus;
	event_type: EventType;
	notes?: string;
	hold_level?: HoldLevel;
	is_challenge?: boolean;
	is_target?: boolean;
	tour_name?: string;
	contact_name?: string;
	contact_email?: string;
	contact_phone?: string;
	is_matinee?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface CalendarDay {
	date: Date;
	dayNumber: number;
	isCurrentMonth: boolean;
	isToday: boolean;
	events: CalendarEvent[];
	holds: CalendarEvent[]; // Separate holds for better management
}

export interface GroupedEvents {
	[date: string]: {
		dateObj: Date;
		events: CalendarEvent[];
	};
}

export interface EventTemplate {
	id: string;
	name: string;
	event_type: EventType;
	venue_category?: VenueCategory;
	venue_room?: string;
	default_start_time?: string;
	default_end_time?: string;
	notes_template?: string;
}

export interface Contact {
	id: string;
	name: string;
	email?: string;
	phone?: string;
	company?: string;
	role?: string;
}