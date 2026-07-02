import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
    const shortId = params.id; 
    const tabSlug = params.tab; 
    
    // Fetch the specific event
    // FIX: Added .limit(1) and .maybeSingle() to completely prevent 406 errors 
    // in case there are 0 rows or accidental duplicate short_ids.
    const { data: event, error: fetchError } = await supabase
        .from('calendar_events')
        .select('*, calendar(*)')
        .eq('short_id', shortId)
        .limit(1)
        .maybeSingle();

    if (fetchError || !event) {
        throw error(404, 'Event not found');
    }

    const calendarId = event.group_id || event.id;
    const currentVersion = event.calendar?.current_version || 1;

    // Fetch the active version data
    // FIX: Changed to .maybeSingle() to prevent 406 errors when version data doesn't exist yet.
    const { data: calendarData } = await supabase
        .from('calendar_data')
        .select('*')
        .eq('calendar_id', calendarId)
        .eq('version_number', currentVersion)
        .maybeSingle();

    // Attach it to the event object so tabs can access it easily
    if (event && calendarData) {
        event.calendar_data = calendarData;
    }

    // Fetch sibling events tied to the same group
    const { data: groupEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('group_id', event.group_id);

    // Fetch venues
    const { data: venues } = await supabase
        .from('calendar_settings')
        .select('*')
        .order('setting_name', { ascending: true });

    return { 
        event, 
        groupEvents: groupEvents || [], 
        venues: venues || [],
        tabSlug 
    };
};