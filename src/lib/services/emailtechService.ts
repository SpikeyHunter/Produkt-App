// src/lib/services/emailtechService.ts
import { supabase } from '$lib/supabase';
import type { 
  EmailTechEvent, 
  CrewAssignments, 
  CrewMember
} from '$lib/types/emailtech';

// --- RESET FUNCTION ---
export async function resetEventData(eventId: number, type: 'tech' | 'vj'): Promise<boolean> {
    try {
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
      .select('event_id, event_name, event_date, event_venue, timetable, event_flyer, event_status, tech_mail, vj_mail, crew, email_data')
      .in('event_id', eventIds);

    if (eventsError) console.error('Error fetching events:', eventsError);

    const eventsMap = new Map(eventsData?.map(event => [event.event_id, event]) || []);

    return advanceData.map(row => {
      const eventData = eventsMap.get(row.event_id);
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
        tech_mail: eventData?.tech_mail || null,
        vj_mail: eventData?.vj_mail || null,
        crew: eventData?.crew || null,
        email_data: eventData?.email_data || null,
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

// --- AUTOFILL HELPERS ---

function normalize(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function splitNames(raw: string | null): string[] {
    if (!raw) return [];
    if (raw.toUpperCase() === 'N/A' || raw.toUpperCase() === 'NA') return [];
    return raw.split(/[\+\&,\/]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.toUpperCase() !== 'N/A');
}

function findBestMatch(partialName: string, allCrew: CrewMember[]): string | null {
    if (!partialName) return null;
    const search = normalize(partialName);
    const exact = allCrew.find(c => normalize(c.name) === search);
    if (exact) return exact.name;
    if (search.length < 2) return null;
    const startsWith = allCrew.find(c => normalize(c.name).startsWith(search));
    if (startsWith) return startsWith.name;
    const wordMatch = allCrew.find(c => normalize(c.name).split(' ').includes(search));
    if (wordMatch) return wordMatch.name;
    if (search.length > 3) {
        const includes = allCrew.find(c => normalize(c.name).includes(search));
        if (includes) return includes.name;
    }
    return null; 
}

// --- CREW AUTOFILL ---
export async function autofillEventCrew(
    eventId: number, 
    eventDate: string,
    targetEventName: string
): Promise<{ success: boolean; assignments: CrewAssignments | null }> {
    try {
        console.log(`[Autofill] Starting for ${eventDate} (ID: ${eventId}). Target: "${targetEventName}"`);

        const { data: scheduleRows, error: scheduleError } = await supabase
            .from('schedule_techs')
            .select('*')
            .eq('date', eventDate);

        if (scheduleError) {
             console.error('[Autofill] Error fetching schedule_techs:', scheduleError);
             return { success: false, assignments: null };
        }
        
        if (!scheduleRows || scheduleRows.length === 0) {
            console.warn(`[Autofill] No schedule found for date: ${eventDate}`);
            return { success: false, assignments: null };
        }

        let selectedSchedule = scheduleRows[0];

        if (scheduleRows.length > 1) {
            const cleanTarget = normalize(targetEventName.replace(/\[.*?\]/g, ''));
            const bestMatch = scheduleRows.find(row => {
                const schedName = normalize(row.event_name || '');
                return schedName.includes(cleanTarget);
            });

            if (bestMatch) selectedSchedule = bestMatch;
        }

        const allCrew = await fetchCrewMembers();
        const newAssignments: CrewAssignments = {};

        const mapRole = (scheduleField: string | null, targetRole: string) => {
            if (!scheduleField) return;
            const rawNames = splitNames(scheduleField);
            const matchedNames: string[] = [];
            rawNames.forEach(raw => {
                const match = findBestMatch(raw, allCrew);
                matchedNames.push(match || raw);
            });
            if (matchedNames.length > 0) newAssignments[targetRole] = matchedNames;
        };

        mapRole(selectedSchedule.ld, 'LD');
        mapRole(selectedSchedule.video, 'Video');
        mapRole(selectedSchedule.vj, 'VJ');
        mapRole(selectedSchedule.sound, 'Sound');
        mapRole(selectedSchedule.tech_sm, 'Stage/Tech'); 
        mapRole(selectedSchedule.dt, 'DT');

        const success = await updateEventCrew(eventId, newAssignments);
        return success ? { success: true, assignments: newAssignments } : { success: false, assignments: null };

    } catch (error) {
        console.error('[Autofill] Critical failure:', error);
        return { success: false, assignments: null };
    }
}