import { supabase } from '$lib/supabase';
import type { TechRow } from '$lib/types/tech-schedule';

export async function syncRowToCalendar(
    row: TechRow, 
    type: 'UPDATE' | 'INSERT' | 'DELETE',
    oldRow?: TechRow
) {
    try {
        // Call your own SvelteKit API route
        const response = await fetch('/api/calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                record: row, 
                old_record: oldRow || null,
                type 
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Calendar Sync API Error:', data.error);
            return;
        }

        // If the server created a NEW event ID, save it back to Supabase
        // so we don't create duplicates next time
        if (data.calendar_event_id && data.calendar_event_id !== row.calendar_event_id) {
            await supabase
                .from('schedule_techs')
                .update({ calendar_event_id: data.calendar_event_id })
                .eq('id', row.id);
        }

    } catch (err) {
        console.error('Network Error during Calendar Sync:', err);
    }
}