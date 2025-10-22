// src/lib/types/booking.ts

export interface BookingArtist {
	id: string;
	name: string;
	genres?: string[] | null;
	last_seen?: string;
	booking_event?: { id: string }[];
	created_at?: string;
	updated_at?: string;
}

export interface BookingEvent {
	id: string;
	artist_ids: string[]; // <-- MODIFIED
	name: string;
	date: string;
	venue?: string | null;
	city?: string | null;
	country?: string | null;
	source: string;
	url?: string | null;
	flyer_image_url?: string | null;
	artists: BookingArtist[]; // <-- MODIFIED
	created_at?: string;
	updated_at?: string;
}

export interface BookingFilters {
	viewType: 'artist' | 'event';
	artistDateFilter: 'all' | 'upcoming' | 'past';
	sortOrder: 'name_asc' | 'name_desc';
	dateFilter: 'upcoming' | 'past' | 'all'; // FIXED: Added 'all' option
	quickDateFilter?: 'all' | 'today' | 'week' | 'month';
	country?: string;
	city?: string;
	venue?: string;
	dateRange?: {
		start: string;
		end: string;
	};
}