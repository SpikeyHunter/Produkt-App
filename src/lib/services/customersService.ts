// src/lib/services/customersService.ts
import { supabase } from '$lib/supabase';
import { EXCLUDED_USERS, EXCLUDED_EVENT_WORDS, SPEND_RANGE, TICKETS_RANGE, AGE_RANGE } from '$lib/components/settings/CustomersSettings';

// --- Interfaces ---
export interface Customer {
  user_id: string;
  user_first_name?: string;
  user_last_name?: string;
  user_mail?: string;
  user_birth_date?: string;
  user_age?: number;
  user_gender?: string;
  user_total_spend?: number;
  user_tickets_purchased?: number;
  user_last_purchase?: string;
  event_ids?: string[];
  shows_attended?: number;
}

export interface EventOption {
  event_id: number;
  event_name: string;
  event_date: string;
  event_venue?: string;
  event_flyer?: string;
  event_genre?: string;
}

export interface CustomerFilters {
  venues?: string[];
  genres?: string[];
  ageRange?: { min: number; max: number };
  dateRange?: { start: string; end: string };
  spendRange?: { min: number; max: number };
  ticketsRange?: { min: number; max: number };
  genders?: string[];
  selectedEvents?: number[];
  searchTerm?: string;
  page: number;
  pageSize: number;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
}

// --- Functions ---
export async function fetchAvailableEvents(): Promise<EventOption[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('event_id, event_name, event_date, event_venue, event_flyer, event_genre')
      .order('event_date', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    const lowercasedExclusions = EXCLUDED_EVENT_WORDS.map(word => word.toLowerCase());
    
    const filteredData = data.filter(event => 
      !lowercasedExclusions.some(excludedWord => 
        event.event_name.toLowerCase().includes(excludedWord)
      )
    );

    const now = new Date();
    const futureEvents = filteredData.filter(e => new Date(e.event_date) >= now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    const pastEvents = filteredData.filter(e => new Date(e.event_date) < now)
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

    return [...futureEvents, ...pastEvents];
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
    let query = supabase
      .from('events_users')
      .select('*', { count: 'exact' })
      .not('user_mail', 'in', `(${EXCLUDED_USERS.map(u => `'${u}'`).join(',')})`);

    // --- Apply Filters ---
    if (filters.venues && filters.venues.length > 0) {
      const { data: venueEvents } = await supabase.from('events').select('event_id').in('event_venue', filters.venues);
      if (venueEvents && venueEvents.length > 0) {
        const venueEventIds = venueEvents.map(e => e.event_id.toString());
        query = query.overlaps('event_ids', venueEventIds);
      } else {
        return { customers: [], totalCount: 0, totalPages: 0 }; 
      }
    }

    if (filters.genres && filters.genres.length > 0) {
      const { data: genreEvents } = await supabase.from('events').select('event_id').in('event_genre', filters.genres);
      if (genreEvents && genreEvents.length > 0) {
        const genreEventIds = genreEvents.map(e => e.event_id.toString());
        query = query.overlaps('event_ids', genreEventIds);
      } else {
        return { customers: [], totalCount: 0, totalPages: 0 };
      }
    }

    if (filters.selectedEvents && filters.selectedEvents.length > 0) {
      const selectedEventIds = filters.selectedEvents.map(id => id.toString());
      query = query.overlaps('event_ids', selectedEventIds);
    }

    if (filters.dateRange && filters.dateRange.start && filters.dateRange.end) {
      query = query
        .gte('user_last_purchase', filters.dateRange.start)
        .lte('user_last_purchase', filters.dateRange.end);
    }

    if (filters.ageRange && (filters.ageRange.min !== AGE_RANGE.MIN || filters.ageRange.max !== AGE_RANGE.MAX)) {
      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(maxBirthDate.getFullYear() - filters.ageRange.min);
      const minBirthDate = new Date();
      minBirthDate.setFullYear(minBirthDate.getFullYear() - filters.ageRange.max - 1); 
      query = query
        .lte('user_birth_date', maxBirthDate.toISOString().split('T')[0])
        .gte('user_birth_date', minBirthDate.toISOString().split('T')[0]);
    }

    if (filters.spendRange && (filters.spendRange.min !== SPEND_RANGE.MIN || filters.spendRange.max !== SPEND_RANGE.MAX)) {
      query = query
        .gte('user_total_spend', filters.spendRange.min)
        .lte('user_total_spend', filters.spendRange.max);
    }

    if (filters.ticketsRange && (filters.ticketsRange.min !== TICKETS_RANGE.MIN || filters.ticketsRange.max !== TICKETS_RANGE.MAX)) {
      query = query.gte('user_tickets_purchased', filters.ticketsRange.min);
      if (filters.ticketsRange.max < TICKETS_RANGE.MAX) {
        query = query.lte('user_tickets_purchased', filters.ticketsRange.max);
      }
    }

    if (filters.genders && filters.genders.length > 0) {
      query = query.in('user_gender', filters.genders);
    }
    
    // MODIFIED: Smarter search logic
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.trim();
      const searchWords = searchTerm.split(/\s+/).filter(Boolean); // Split by space and remove empty strings

      if (searchWords.length === 1) {
        // If there's only one word, search it against first name, last name, OR email.
        const singleWord = searchWords[0];
        query = query.or(`user_first_name.ilike.%${singleWord}%,user_last_name.ilike.%${singleWord}%,user_mail.ilike.%${singleWord}%`);
      } else if (searchWords.length > 1) {
        // If there are multiple words, assume "FirstName LastName"
        // and search for first name AND last name.
        const firstName = searchWords[0];
        const lastName = searchWords.slice(1).join(' ');
        query = query
          .ilike('user_first_name', `%${firstName}%`)
          .ilike('user_last_name', `%${lastName}%`);
      }
    }

    // --- Apply Sorting ---
    if (filters.sortField && filters.sortDirection) {
      const ascending = filters.sortDirection === 'asc';
      const columnMap: { [key: string]: string } = {
        firstName: 'user_first_name', lastName: 'user_last_name', age: 'user_age',
        gender: 'user_gender', spend: 'user_total_spend', tickets: 'user_tickets_purchased',
        lastPurchase: 'user_last_purchase',
      };
      const dbColumn = columnMap[filters.sortField];
      if (dbColumn) {
        query = query.order(dbColumn, { ascending, nullsFirst: false });
      }
    } else {
      query = query.order('user_last_purchase', { ascending: false, nullsFirst: false });
    }

    // --- Apply Pagination ---
    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    query = query.range(from, to);

    // --- Execute Query ---
    const { data, error, count } = await query;
    if (error) throw error;

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / filters.pageSize);
    
    const customersWithShows = (data || []).map(customer => ({
      ...customer,
      shows_attended: customer.event_ids ? new Set(customer.event_ids).size : 0
    }));

    return { customers: customersWithShows, totalCount, totalPages };
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { customers: [], totalCount: 0, totalPages: 0 };
  }
}

export async function exportCustomers(filters: Omit<CustomerFilters, 'page' | 'pageSize'>): Promise<Customer[]> {
  try {
    const PAGE_SIZE = 1000; // Supabase's max limit
    let allCustomers: Customer[] = [];
    let page = 1;
    let hasMore = true;

    // Keep fetching pages until we get all customers
    while (hasMore) {
      const { customers, totalCount } = await fetchFilteredCustomers({ 
        ...filters, 
        page, 
        pageSize: PAGE_SIZE 
      });

      allCustomers = [...allCustomers, ...customers];
      
      // Check if there are more pages to fetch
      hasMore = allCustomers.length < totalCount;
      page++;
      
      // Safety check to prevent infinite loops
      if (page > 1000) {
        console.warn('Reached maximum page limit');
        break;
      }
    }

    return allCustomers;
  } catch (error) {
    console.error('Error exporting customers:', error);
    return [];
  }
}