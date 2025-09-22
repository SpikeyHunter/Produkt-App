// src/lib/types/types.ts
export interface CalendarEvent {
	id: string;
	title: string;
	artist_name?: string;
	venue_category?: 'Co-Pro Shows' | 'New City Gas' | 'Bazart';
	venue_room?: string;
	date: string; // YYYY-MM-DD
	start_time?: string;
	end_time?: string;
	status: 'HOLD' | 'CONFIRMED';
	event_type: 'Corpo' | 'Show' | 'Other';
	notes?: string;
}

export interface CalendarDay {
	date: Date;
	dayNumber: number;
	isCurrentMonth: boolean;
	isToday: boolean;
	events: CalendarEvent[];
}

export interface GroupedEvents {
	[date: string]: {
		dateObj: Date;
		events: CalendarEvent[];
	};
}