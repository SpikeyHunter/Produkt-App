// src/lib/services/announcementService.ts

import { ncgSupabase } from '$lib/ncgSupabase';
import type { Announcement, CreateAnnouncementInput, UpdateAnnouncementInput } from '$lib/types/announcements';

export async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const { data, error } = await ncgSupabase
      .from('announcements')
      .select('*')
      .order('start_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement | null> {
  try {
    // Determine initial status
    let status: 'scheduled' | 'active' | 'manual' = 'manual';
    
    if (input.start_date && input.end_date && input.is_enabled) {
      const now = new Date();
      const startDate = new Date(input.start_date);
      const endDate = new Date(input.end_date);
      
      if (now >= startDate && now < endDate) {
        status = 'active';
      } else if (now < startDate) {
        status = 'scheduled';
      }
    }

    const { data, error } = await ncgSupabase
      .from('announcements')
      .insert([{
        ...input,
        status,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating announcement:', error);
    return null;
  }
}

export async function updateAnnouncement(id: number, input: UpdateAnnouncementInput): Promise<boolean> {
  try {
    // If manually toggling, set status to 'manual'
    const updates: any = {
      ...input,
      updated_at: new Date().toISOString()
    };

    // If toggling is_enabled and no dates, set to manual
    if (input.is_enabled !== undefined) {
      const { data: existing } = await ncgSupabase
        .from('announcements')
        .select('start_date, end_date')
        .eq('id', id)
        .single();

      if (existing && (!existing.start_date || !existing.end_date)) {
        updates.status = 'manual';
      } else if (input.is_enabled && existing?.start_date && existing?.end_date) {
        // Recalculate status based on dates
        const now = new Date();
        const startDate = new Date(existing.start_date);
        const endDate = new Date(existing.end_date);
        
        if (now >= startDate && now < endDate) {
          updates.status = 'active';
        } else if (now < startDate) {
          updates.status = 'scheduled';
        } else {
          updates.status = 'ended';
        }
      } else if (!input.is_enabled) {
        updates.status = 'manual';
      }
    }

    const { error } = await ncgSupabase
      .from('announcements')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating announcement:', error);
    return false;
  }
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  try {
    const { error } = await ncgSupabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return false;
  }
}

// Subscribe to real-time changes
export function subscribeToAnnouncements(callback: (announcements: Announcement[]) => void) {
  const channel = ncgSupabase
    .channel('announcements-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'announcements'
      },
      async () => {
        const announcements = await fetchAnnouncements();
        callback(announcements);
      }
    )
    .subscribe();

  return () => {
    ncgSupabase.removeChannel(channel);
  };
}