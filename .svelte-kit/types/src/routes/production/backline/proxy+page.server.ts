// @ts-nocheck
import { fetchEventsAdvance, type EventAdvance } from '$lib/services/eventsService.js';
import { supabase } from '$lib/supabase.js';
import type { PageServerLoad } from './$types';

export const load = async () => {
    console.log('Server loading events...');
    
    // Fetch both data sources concurrently for maximum speed
    const [allEvents, eventsTableResult] = await Promise.all([
        fetchEventsAdvance() as Promise<EventAdvance[]>,
        supabase.from('events').select('event_id').not('event_id', 'is', null),
    ]);
    
    // Process event IDs to determine event status (Live/Past)
    const existingEventIds = new Set(eventsTableResult.data?.map((e: any) => e.event_id) || []);

    // Filter events for the default 'LIVE' view on the server before sending to the client
    const initialShowLive = true;
    
    const initialEvents = allEvents.filter((event) => {
        if (initialShowLive) {
            // Custom events (not in events table) are always treated as live
            if (!existingEventIds.has(event.event_id)) {
                return true;
            }
            // Regular events use the event_status field
            return event.event_status === 'LIVE';
        }
        return false; 
    });

    console.log(`Server loaded ${allEvents.length} events. Initial LIVE count: ${initialEvents.length}`);

    // Return the data to the +page.svelte component
    return {
        allEvents: allEvents,
        initialEvents: initialEvents,
        existingEventIds: Array.from(existingEventIds), // Passed as array for SvelteKit serialization
    };
};;null as any as PageServerLoad;