// src/lib/services/bookingartist/bookingService.ts

import { supabase } from '$lib/supabase';
import type { BookingFilters, BookingArtist, BookingEvent } from '$lib/types/booking';

export interface FetchResult {
	items: any[];
	totalCount: number;
}

// --- DATA FETCHING ---
export async function fetchArtistEvents(
	filters: BookingFilters,
	searchTerm: string,
	page: number,
	pageSize: number
): Promise<FetchResult> {
	const isEventView = filters.viewType === 'event';
	const rangeFrom = (page - 1) * pageSize;
	const rangeTo = rangeFrom + pageSize - 1;
	const today = new Date().toISOString().split('T')[0];

	if (isEventView) {
		let query = supabase
			.from('booking_event')
			.select('*, artist_ids', { count: 'exact' });

		if (searchTerm.trim()) {
			// 1. Find artist IDs that match the search term
			const { data: artistData } = await supabase
				.from('booking_artist')
				.select('id')
				.ilike('name', `%${searchTerm}%`);

			const artistIds = artistData ? artistData.map((a) => a.id) : [];

			// 2. Build the search condition for event fields
			const eventSearchCondition = `name.ilike.%${searchTerm}%,venue.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%`;

			// 3. Combine search for event fields OR artist IDs
			if (artistIds.length > 0) {
				// 'cs' means 'contains' (for array)
				query = query.or(
					`${eventSearchCondition},artist_ids.cs.{${artistIds.join(',')}}`
				);
			} else {
				query = query.or(eventSearchCondition);
			}
		}

		// ... (rest of the event filtering logic is unchanged)
		if (filters.country) query = query.ilike('country', `%${filters.country}%`);
		if (filters.city) query = query.ilike('city', `%${filters.city}%`);
		if (filters.venue) query = query.ilike('venue', `%${filters.venue}%`);

		if (filters.dateFilter === 'upcoming') {
			query = query.gte('date', today).order('date', { ascending: true });
		} else if (filters.dateFilter === 'past') {
			query = query.lt('date', today).order('date', { ascending: false });
		}

		if (filters.dateRange) {
			query = query
				.gte('date', filters.dateRange.start)
				.lte('date', filters.dateRange.end);
		}

		query = query.range(rangeFrom, rangeTo);
		const { data: eventData, error, count } = await query;

		if (error) {
			console.error('Error loading events:', error);
			return { items: [], totalCount: 0 };
		}
		if (!eventData || eventData.length === 0) {
			return { items: [], totalCount: 0 };
		}

		// 4. "Hydrate" events with artist objects
		const allArtistIds = new Set<string>();
		eventData.forEach((event) => {
			if (event.artist_ids) event.artist_ids.forEach((id: string) => allArtistIds.add(id));
		});

		if (allArtistIds.size === 0) {
			// Return events even if they have no artists linked
			return { items: eventData.map(e => ({ ...e, artists: [] })), totalCount: count || 0 };
		}

		// 5. Fetch all unique artists in one query
		const { data: artists } = await supabase
			.from('booking_artist')
			.select('id, name, genres')
			.in('id', Array.from(allArtistIds));

		const artistMap = new Map(artists?.map((a) => [a.id, a]));

		// 6. Map artists back to their events
		const finalItems = eventData.map((event) => ({
			...event,
			artists: event.artist_ids
				? event.artist_ids.map((id: string) => artistMap.get(id)).filter(Boolean) // .filter(Boolean) removes any undefined
				: []
		}));

		return { items: finalItems, totalCount: count || 0 };

	} else {
		// --- Artist fetching logic ---
		// This logic is ALSO updated to use the new join
		let query;
		if (filters.artistDateFilter === 'all') {
			// This join might be slow, consider 'booking_event(id)'
			query = supabase.from('booking_artist').select('*, booking_event(artist_ids, id)', { count: 'exact' });
		} else {
			// Use the new join syntax: table!join_column(columns_to_select)
			query = supabase.from('booking_artist').select('*, booking_event!inner(artist_ids, id, date)', { count: 'exact' });
			
			if (filters.artistDateFilter === 'upcoming') {
				query = query.gte('booking_event.date', today);
			} else { // 'past'
				query = query.lt('booking_event.date', today);
			}
		}
		if (searchTerm.trim()) {
			query = query.ilike('name', `%${searchTerm}%`);
		}
		query = query.order('name', { ascending: filters.sortOrder !== 'name_desc' });
		query = query.range(rangeFrom, rangeTo);
		
		const { data, error, count } = await query;

		if (error) {
			console.error('Error loading artists:', error);
			return { items: [], totalCount: 0 };
		}
		
		// De-dupe artists if filtering by date (since one artist can have many events)
		if (filters.artistDateFilter !== 'all' && data) {
			const uniqueArtists = Array.from(new Map(data.map(artist => [artist.id, artist])).values());
			return { items: uniqueArtists, totalCount: count || 0 }; // Note: count might be off due to de-duping, but it's complex to fix without RPC.
		}
		
		return { items: data || [], totalCount: count || 0 };
	}
}