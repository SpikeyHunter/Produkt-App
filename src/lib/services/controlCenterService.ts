import { supabase } from '$lib/supabase';
import { ncgSupabase } from '$lib/ncgSupabase';
import type { UpcomingEvent, SourceEvent } from '$lib/types/controlcenter';

const GROUP_ID = 15; // Your New City Gas group ID
const TIXR_BASE_URL = 'https://www.tixr.com/groups/newcitygas/events';

/**
 * Generates the event ticketing URL based on event name and ID
 */
function generateEventUrl(eventName: string, eventId: number): string {
  const slug = eventName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  return `${TIXR_BASE_URL}/${slug}-${eventId}`;
}

/**
 * Finds RSVP/Reservation event for a given date
 */
async function findRsvpUrl(eventDate: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, event_name')
    .eq('event_date', eventDate)
    .ilike('event_name', '%réservation%');

  if (error || !data || data.length === 0) {
    return null;
  }

  // Return URL of first matching reservation event
  const rsvpEvent = data[0];
  return generateEventUrl(rsvpEvent.event_name, rsvpEvent.event_id);
}

/**
 * Fetches LIVE events from Produkt DB
 */
export async function fetchSourceEvents(): Promise<SourceEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('event_id, event_name, event_date, event_flyer, event_venue, event_status')
    .eq('event_status', 'LIVE')
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching source events:', error);
    return [];
  }

  // Filter out test/template events
  const excludeKeywords = [
    'test', 'réservations', 'reservation', 'reservations',
    'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'
  ];

  return (data || []).filter(event => {
    const nameLower = event.event_name.toLowerCase();
    return !excludeKeywords.some(keyword => nameLower.includes(keyword));
  });
}

/**
 * Fetches upcoming events from NCG DB
 */
export async function fetchUpcomingEvents(): Promise<UpcomingEvent[]> {
  const { data, error } = await ncgSupabase
    .from('events_upcoming')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }

  return data || [];
}

/**
 * Adds an event to the upcoming carousel
 */
export async function addEventToCarousel(sourceEvent: SourceEvent): Promise<UpcomingEvent | null> {
  const eventUrl = generateEventUrl(sourceEvent.event_name, sourceEvent.event_id);
  const rsvpUrl = await findRsvpUrl(sourceEvent.event_date);

  // Get current max display_order
  const { data: maxOrderData } = await ncgSupabase
    .from('events_upcoming')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const newDisplayOrder = (maxOrderData?.display_order || 0) + 1;

  const newEvent: Omit<UpcomingEvent, 'id' | 'created_at' | 'updated_at'> = {
    event_id: sourceEvent.event_id,
    event_name: sourceEvent.event_name,
    event_date: sourceEvent.event_date,
    event_flyer: sourceEvent.event_flyer,
    event_venue: sourceEvent.event_venue,
    event_url: eventUrl,
    rsvp_url: rsvpUrl,
    event_active: true,
    event_badge: null,
    display_order: newDisplayOrder
  };

  const { data, error } = await ncgSupabase
    .from('events_upcoming')
    .insert(newEvent)
    .select()
    .single();

  if (error) {
    console.error('Error adding event to carousel:', error);
    return null;
  }

  return data;
}

/**
 * Removes an event from the carousel
 */
export async function removeEventFromCarousel(eventId: number): Promise<boolean> {
  const { error } = await ncgSupabase
    .from('events_upcoming')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    console.error('Error removing event from carousel:', error);
    return false;
  }

  return true;
}

/**
 * Updates event order in carousel
 */
export async function updateEventOrder(events: UpcomingEvent[]): Promise<boolean> {
  const updates = events.map((event, index) => ({
    event_id: event.event_id,
    display_order: index + 1
  }));

  const { error } = await ncgSupabase
    .from('events_upcoming')
    .upsert(updates, { onConflict: 'event_id' });

  if (error) {
    console.error('Error updating event order:', error);
    return false;
  }

  return true;
}

/**
 * Updates event properties (active status, badge, etc.)
 */
export async function updateEventProperties(
  eventId: number, 
  updates: Partial<Pick<UpcomingEvent, 'event_active' | 'event_badge'>>
): Promise<boolean> {
  const { error } = await ncgSupabase
    .from('events_upcoming')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (error) {
    console.error('Error updating event properties:', error);
    return false;
  }

  return true;
}