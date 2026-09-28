// src/lib/services/emailtechService.ts
import { supabase } from '$lib/supabase';
import type { 
  EmailTechEvent, 
  CrewAssignments, 
  CrewMember
} from '$lib/types/emailtech';
import { normalizeCrew, emailDataFromRow } from '$lib/types/emailtech';
import { findScheduleRow, crewFromScheduleRow, type ScheduleMatch } from './scheduleMatch';
import { EMAILTECH_TABLE, isMissingTable, tableMissing } from './emailTechSync';

// --- RESET FUNCTION ---
export async function resetEventData(eventId: number, type: 'tech' | 'vj'): Promise<boolean> {
    try {
        // new table: drop the row (links are kept on purpose: they are a choice, not content)
        const { data: row, error: readErr } = await supabase
            .from(EMAILTECH_TABLE)
            .select('linked_event_ids')
            .eq('event_id', eventId)
            .maybeSingle();
        if (!readErr) {
            const { error: delErr } = await supabase.from(EMAILTECH_TABLE).delete().eq('event_id', eventId);
            if (delErr) throw delErr;
            if (row?.linked_event_ids && Array.isArray(row.linked_event_ids) && row.linked_event_ids.length) {
                await supabase.from(EMAILTECH_TABLE).insert({ event_id: eventId, linked_event_ids: row.linked_event_ids });
            }
        } else if (!isMissingTable(readErr)) {
            throw readErr;
        }

        // old columns too, so the legacy fallback is clean as well
        const updateObject: any = {
            crew: null,
            email_data: {} 
        };

        if (type === 'tech') {
            updateObject.tech_mail = null;
        } else {
            updateObject.vj_mail = null;
        }

        const { error } = await supabase
            .from('events')
            .update(updateObject)
            .eq('event_id', eventId);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error resetting event data:', e);
        return false;
    }
}

// --- CREW MANAGEMENT (CRUD) ---

// [Fix] Exporting this function was missing
export async function addCrewMember(name: string, email: string): Promise<CrewMember | null> {
    try {
        const { data, error } = await supabase
            .from('prod_staff')
            .insert({ 
                name, 
                email,
                stage_manager: false 
            })
            .select()
            .single();

        if (error) throw error;
        
        return {
            id: data.id.toString(),
            name: data.name,
            role: 'Tech',
            email: data.email
        };
    } catch (error) {
        console.error('Error adding crew member:', error);
        return null;
    }
}

// [Fix] Exporting this function was missing
export async function deleteCrewMember(id: string | number): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('prod_staff')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting crew member:', error);
        return false;
    }
}

/** Legacy (events.email_data). The page saves through emailTechSync now. */
export async function updateEventEmailData(eventId: number, type: 'tech' | 'vj', data: any): Promise<boolean> {
    try {
        const { data: current, error: fetchError } = await supabase
            .from('events')
            .select('email_data')
            .eq('event_id', eventId)
            .single();
            
        if (fetchError) throw fetchError;
        
        const existingData = current?.email_data || {};
        const key = `${type}_form_data`; 
        
        const newData = {
            ...existingData,
            [key]: data
        };

        const { error } = await supabase
            .from('events')
            .update({ email_data: newData })
            .eq('event_id', eventId);

        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error updating email data', e);
        return false;
    }
}

export async function fetchEmailTechEvents(): Promise<EmailTechEvent[]> {
  try {
    const { data: advanceData, error: advanceError } = await supabase
      .from('events_advance')
      .select('*')
      .order('created_at', { ascending: false });

    if (advanceError) throw advanceError;
    if (!advanceData) return [];

    const eventIds = [...new Set(advanceData.map(item => item.event_id))];
    
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('event_id, event_name, event_date, event_venue, timetable, event_flyer, event_status, tech_mail, vj_mail, crew, email_data, calendar_link')
      .in('event_id', eventIds);

    if (eventsError) console.error('Error fetching events:', eventsError);

    const eventsMap = new Map(eventsData?.map(event => [event.event_id, event]) || []);

    // Email-tech data lives in events_emailtech (one row per event). Events
    // without a row yet fall back to the old columns on `events`.
    const techMap = new Map<number, any>();
    const { data: techRows, error: techErr } = await supabase
      .from(EMAILTECH_TABLE)
      .select('*')
      .in('event_id', eventIds);
    if (techErr) {
      if (isMissingTable(techErr)) tableMissing.set(true);
      else console.error('Error fetching events_emailtech:', techErr);
    } else {
      tableMissing.set(false);
      (techRows || []).forEach((r: any) => techMap.set(r.event_id, r));
    }

    return advanceData.map(row => {
      const eventData = eventsMap.get(row.event_id);
      const tech = techMap.get(row.event_id);
      const crew = tech ? normalizeCrew(tech.crew) : eventData?.crew ? normalizeCrew(eventData.crew) : null;
      const email_data = tech ? emailDataFromRow(tech) : eventData?.email_data || null;
      const tech_mail = tech ? tech.tech_mail ?? null : eventData?.tech_mail || null;
      const vj_mail = tech ? tech.vj_mail ?? null : eventData?.vj_mail || null;
      return {
        id: `${row.event_id}-${row.artist_name}`,
        event_id: row.event_id,
        artist_name: row.artist_name,
        artist_type: row.artist_type,
        event_name: eventData?.event_name || 'Unknown Event',
        event_date: eventData?.event_date || null,
        event_venue: eventData?.event_venue || null,
        event_flyer: eventData?.event_flyer || null,
        event_status: eventData?.event_status || null,
        calendar_link: eventData?.calendar_link || null,
        tech_rider: row.tech_rider,
        rider_files: row.rider_files,
        sfx_rider: row.sfx_rider,
        soundcheck: row.soundcheck,
        visuals: row.visuals,
        visual_received: row.visual_received,
        timetable: eventData?.timetable || null,
        ground_transport: row.ground_transport,
        ground_info: row.ground_info,
        notes: row.notes,
        tech_mail,
        vj_mail,
        crew,
        email_data,
        dos: row.dos,
        roles: row.roles,
      };
    });
  } catch (error) {
    console.error('Error in fetchEmailTechEvents:', error);
    return [];
  }
}

export async function fetchCrewMembers(): Promise<CrewMember[]> {
  try {
    const { data, error } = await supabase
      .from('prod_staff') 
      .select('*')
      .order('name');

    if (error) throw error;
    
    return (data || []).map((p: any) => ({
      id: p.id.toString(),
      name: p.name,
      role: p.role,
      email: p.email
    }));
  } catch (error) {
    console.error('Error fetching prod_staff:', error);
    return [];
  }
}

export async function updateEventCrew(eventId: number, crew: CrewAssignments): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('events')
      .update({ crew })
      .eq('event_id', eventId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating crew:', error);
    return false;
  }
}

export async function updateEventEmail(eventId: number, type: 'tech' | 'vj', content: string): Promise<boolean> {
  try {
    const updateObject = type === 'tech' ? { tech_mail: content } : { vj_mail: content };
    const { error } = await supabase
      .from('events')
      .update(updateObject)
      .eq('event_id', eventId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error updating ${type} mail:`, error);
    return false;
  }
}

export async function updateEmailStatus(eventId: number, templateType: 'tech' | 'vj', status: string): Promise<boolean> {
  try {
    const { data: currentData, error: fetchError } = await supabase
      .from('events')
      .select('email_data')
      .eq('event_id', eventId)
      .single();

    if (fetchError) throw fetchError;

    const currentEmailData = currentData?.email_data || {};
    const key = `${templateType}_status`;
    const updatedEmailData = { ...currentEmailData, [key]: status };

    const { error: updateError } = await supabase
      .from('events')
      .update({ email_data: updatedEmailData })
      .eq('event_id', eventId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Error updating email status:', error);
    return false;
  }
}

/**
 * Fresh copy of one event's email-tech data, straight from the database.
 * The page calls this when an event is opened: the list loaded at page load
 * can be minutes old, and starting the editor from a stale copy would let its
 * automatic fields (set times, crew names, backline…) save that stale copy
 * over what someone else just changed.
 */
export async function fetchEmailTechRecord(
    eventId: number
): Promise<{ crew: CrewAssignments; email_data: any; tech_mail: string | null; vj_mail: string | null } | null> {
    const { data, error } = await supabase.from(EMAILTECH_TABLE).select('*').eq('event_id', eventId).maybeSingle();
    if (!error) {
        if (!data) return null;
        return { crew: normalizeCrew(data.crew), email_data: emailDataFromRow(data), tech_mail: data.tech_mail ?? null, vj_mail: data.vj_mail ?? null };
    }
    if (!isMissingTable(error)) {
        console.error('Error fetching events_emailtech row:', error);
        return null;
    }
    tableMissing.set(true);
    const { data: ev } = await supabase
        .from('events')
        .select('crew, email_data, tech_mail, vj_mail')
        .eq('event_id', eventId)
        .maybeSingle();
    if (!ev) return null;
    return { crew: normalizeCrew(ev.crew), email_data: ev.email_data || {}, tech_mail: ev.tech_mail ?? null, vj_mail: ev.vj_mail ?? null };
}

/** Save which events are combined into `eventId`'s email (read-merge-write on email_data). */
export async function updateLinkedEvents(eventId: number, ids: number[]): Promise<boolean> {
    try {
        const clean = ids.filter((id) => id !== eventId);
        const { error: upErr } = await supabase
            .from(EMAILTECH_TABLE)
            .upsert({ event_id: eventId, linked_event_ids: clean }, { onConflict: 'event_id' });
        if (!upErr) return true;
        if (!isMissingTable(upErr)) throw upErr;

        const { data: current, error: fetchError } = await supabase
            .from('events')
            .select('email_data')
            .eq('event_id', eventId)
            .single();
        if (fetchError) throw fetchError;
        const merged = { ...(current?.email_data || {}), linked_event_ids: ids.filter((id) => id !== eventId) };
        const { error } = await supabase.from('events').update({ email_data: merged }).eq('event_id', eventId);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Error updating linked events', e);
        return false;
    }
}

// --- CREW FROM THE TECH SCHEDULE ---
//
// Finds the schedule_techs row for the event (see scheduleMatch.ts) and maps
// its staff columns onto the crew slots. Nothing is written here: the page
// decides what to do with an ambiguous match (pick modal) and saves through
// the sync engine.
export async function matchEventCrew(
    event: EmailTechEvent,
    allCrew: CrewMember[],
    pinnedRowId?: string | null
): Promise<{ match: ScheduleMatch; assignments: CrewAssignments | null }> {
    if (!event.event_date) {
        return {
            match: { status: 'none', row: null, candidates: [], monthRows: [], reason: 'No event date' },
            assignments: null
        };
    }
    const match = await findScheduleRow({
        eventDate: event.event_date,
        venue: event.event_venue,
        eventName: event.event_name || '',
        artistName: event.artist_name || '',
        calendarLink: event.calendar_link || null,
        pinnedRowId: pinnedRowId ?? event.email_data?.schedule_row_id ?? null
    });
    const assignments = match.row ? crewFromScheduleRow(match.row, allCrew) : null;
    return { match, assignments };
}
