// src/lib/services/crewService.ts
import { supabase } from '$lib/supabase';
import type { CrewMember, CrewAssignments } from '$lib/types/emailtech';

/**
 * Fetch all crew members from prod_staff table.
 *
 * `prod_staff` only stores identity fields (id, name, email) — a crew member's
 * `role` is contextual (it's assigned per-event via CrewAssignments), so it
 * isn't a column here. We default it to '' so the rows still satisfy the
 * required `CrewMember.role` field.
 */
export async function fetchCrewMembers(): Promise<CrewMember[]> {
  try {
    const { data, error } = await supabase
      .from('prod_staff')
      .select('id, name, email')
      .order('name');

    if (error) throw error;
    return (data ?? []).map((m) => ({ role: '', ...m })) as CrewMember[];
  } catch (error) {
    console.error('Error fetching crew members:', error);
    return [];
  }
}

/**
 * Add a new crew member to prod_staff table
 */
export async function addCrewMember(name: string, email?: string): Promise<CrewMember | null> {
  try {
    const { data, error } = await supabase
      .from('prod_staff')
      .insert({ name, email: email || null })
      .select()
      .single();

    if (error) throw error;
    return data ? ({ role: '', ...data } as CrewMember) : null;
  } catch (error) {
    console.error('Error adding crew member:', error);
    return null;
  }
}

/**
 * Remove a crew member from prod_staff table
 */
export async function removeCrewMember(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('prod_staff')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing crew member:', error);
    return false;
  }
}

/**
 * Update crew assignments for an event
 */
export async function updateEventCrew(eventId: number, crew: CrewAssignments): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('events')
      .update({ crew })
      .eq('event_id', eventId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating event crew:', error);
    return false;
  }
}

/**
 * Get crew assignments for an event
 */
export async function getEventCrew(eventId: number): Promise<CrewAssignments | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('crew')
      .eq('event_id', eventId)
      .single();

    if (error) throw error;
    return data?.crew || null;
  } catch (error) {
    console.error('Error fetching event crew:', error);
    return null;
  }
}