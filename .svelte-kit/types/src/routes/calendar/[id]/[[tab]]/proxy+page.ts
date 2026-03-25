// @ts-nocheck
import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
    const shortId = params.id; 
    const tabSlug = params.tab; 
    
    // Fetch the specific event
    const { data: event, error: fetchError } = await supabase
        .from('calendar_events')
        .select('*, calendar(*)')
        .eq('short_id', shortId)
        .single();

    if (fetchError || !event) {
        throw error(404, 'Event not found');
    }

    const calendarId = event.group_id || event.id;
    const currentVersion = event.calendar?.current_version || 1;

    // Fetch the active version data
    const { data: calendarData } = await supabase
        .from('calendar_data')
        .select('*')
        .eq('calendar_id', calendarId)
        .eq('version_number', currentVersion)
        .single();

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