// src/lib/services/customersService.ts

import { supabase } from '$lib/supabase';
import { EXCLUDED_USERS, EXCLUDED_EVENT_WORDS } from '$lib/components/settings/CustomersSettings';

export interface Customer {
  user_id: string;
  user_first_name?: string;
  user_last_name?: string;
  user_mail?: string;
  user_birth_date?: string;
  user_age?: number;
  user_gender?: string;
  user_city?: string;
  user_state?: string;
  user_country?: string;
  user_postal?: string;
  user_opt_in?: boolean;
  user_total_spend?: number;
  user_tickets_purchased?: number;
  user_last_purchase?: string;
  event_ids?: string[];
}

export interface EventOption {
  event_id: number;
  event_name: string;
  event_date: string;
  event_venue?: string;
}

export interface CustomerFilters {
  venues: string[];
  ageRange?: { min: number; max: number };
  spendRange?: { min: number; max: number };
  ticketsRange?: { min: number; max: number };
  genders: string[];
  selectedEvents: number[];
  searchTerm?: string;
  page: number;
  pageSize: number;
}

export async function fetchAvailableEvents(): Promise<EventOption[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('event_id, event_name, event_date, event_venue')
      .order('event_date', { ascending: false });

    if (error) throw error;

    // Filter out excluded events
    const filtered = (data || []).filter(event => {
      const eventNameLower = event.event_name.toLowerCase();
      return !EXCLUDED_EVENT_WORDS.some(word => eventNameLower.includes(word));
    });

    return filtered;
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function fetchFilteredCustomers(filters: CustomerFilters): Promise<{ 
  customers: Customer[], 
  totalCount: number,
  totalPages: number 
}> {
  try {
    // Build the base query
    let query = supabase
      .from('events_users')
      .select('*', { count: 'exact' });

    // Exclude specific users
    query = query.not('user_mail', 'in', `(${EXCLUDED_USERS.join(',')})`);

    // Venue filter (need to check event_ids)
    if (filters.venues.length > 0) {
      // First get all event IDs for the selected venues
      const { data: venueEvents } = await supabase
        .from('events')
        .select('event_id')
        .in('event_venue', filters.venues);
      
      if (venueEvents && venueEvents.length > 0) {
        const venueEventIds = venueEvents.map(e => e.event_id.toString());
        // Filter users who have attended at least one of these events
        query = query.overlaps('event_ids', venueEventIds);
      }
    }

    // Selected events filter
    if (filters.selectedEvents.length > 0) {
      const selectedEventIds = filters.selectedEvents.map(id => id.toString());
      query = query.overlaps('event_ids', selectedEventIds);
    }

    // Age range filter
    if (filters.ageRange) {
      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(maxBirthDate.getFullYear() - filters.ageRange.min);
      
      const minBirthDate = new Date();
      minBirthDate.setFullYear(minBirthDate.getFullYear() - filters.ageRange.max);
      
      query = query
        .lte('user_birth_date', maxBirthDate.toISOString().split('T')[0])
        .gte('user_birth_date', minBirthDate.toISOString().split('T')[0]);
    }

    // Spend range filter
    if (filters.spendRange) {
      query = query
        .gte('user_total_spend', filters.spendRange.min)
        .lte('user_total_spend', filters.spendRange.max);
    }

    // Tickets range filter
    if (filters.ticketsRange) {
      query = query
        .gte('user_tickets_purchased', filters.ticketsRange.min)
        .lte('user_tickets_purchased', filters.ticketsRange.max);
    }

    // Gender filter
    if (filters.genders.length > 0) {
      query = query.in('user_gender', filters.genders);
    }

    // Search filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.trim().toLowerCase();
      query = query.or(
        `user_first_name.ilike.%${searchTerm}%,` +
        `user_last_name.ilike.%${searchTerm}%,` +
        `user_mail.ilike.%${searchTerm}%`
      );
    }

    // Add pagination
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    
    query = query
      .range(from, to)
      .order('user_last_purchase', { ascending: false, nullsFirst: false });

    const { data, error, count } = await query;

    if (error) throw error;

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / filters.pageSize);

    return {
      customers: data || [],
      totalCount,
      totalPages
    };
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { customers: [], totalCount: 0, totalPages: 0 };
  }
}

export async function exportCustomers(filters: CustomerFilters): Promise<Customer[]> {
  try {
    // Remove pagination for export
    const exportFilters = { ...filters, page: 1, pageSize: 10000 };
    const { customers } = await fetchFilteredCustomers(exportFilters);
    return customers;
  } catch (error) {
    console.error('Error exporting customers:', error);
    return [];
  }
}