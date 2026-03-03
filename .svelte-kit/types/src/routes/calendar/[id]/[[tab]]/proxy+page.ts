// @ts-nocheck
import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
    // The ID from the URL is now the short_id
    const shortId = params.id; 
    const tabSlug = params.tab; // SvelteKit captures 'deals', 'revenue', etc. from the [[tab]] folder
    
    // Fetch the specific event using the short_id
    const { data: event, error: fetchError } = await supabase
        .from('calendar_events')
        .select('*, calendar(*)')
        .eq('short_id', shortId)
        .single();

    if (fetchError || !event) {
        throw error(404, 'Event not found');
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
        tabSlug // Add this to the returned object
    };
};