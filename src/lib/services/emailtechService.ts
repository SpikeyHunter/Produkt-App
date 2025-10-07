// src/lib/services/emailtechService.ts
import { supabase } from '$lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { EmailTechEvent, CurrentUser, PresenceInfo } from '$lib/types/emailtech';

/**
 * Fetch all events with advance data
 */
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

/**
 * Update email content for an event
 */
export async function updateEventEmail(
  eventId: number, 
  type: 'tech' | 'vj', 
  content: string
): Promise<boolean> {
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

/**
 * Update email_data (section selections and custom content) for an event
 */
export async function updateEventEmailData(
  eventId: number,
  templateType: 'tech' | 'vj',
  sectionIds: string[],
  customSections?: Record<string, string>
): Promise<boolean> {
  try {
    const { data: currentData, error: fetchError } = await supabase
      .from('events')
      .select('email_data')
      .eq('event_id', eventId)
      .single();

    if (fetchError) throw fetchError;

    const emailData = currentData?.email_data || {};
    const updatedEmailData = {
      ...emailData,
      [`${templateType}_sections`]: sectionIds,
      ...(customSections && { [`${templateType}_custom_sections`]: customSections })
    };

    const { error: updateError } = await supabase
      .from('events')
      .update({ email_data: updatedEmailData })
      .eq('event_id', eventId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error('Error updating email_data:', error);
    return false;
  }
}

/**
 * Get saved sections for an event and template type
 */
export async function getEventSections(
  eventId: number,
  templateType: 'tech' | 'vj'
): Promise<{ 
  sections: string[], 
  customSections: Record<string, string>
}> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('email_data')
      .eq('event_id', eventId)
      .single();

    if (error) throw error;

    const emailData = data?.email_data || {};
    return {
      sections: emailData[`${templateType}_sections`] || [],
      customSections: emailData[`${templateType}_custom_sections`] || {}
    };
  } catch (error) {
    console.error('Error fetching email_data:', error);
    return { sections: [], customSections: {} };
  }
}

/**
 * Join real-time channel for collaborative editing
 */
export function joinEventChannel(
  channelName: string,
  currentUser: CurrentUser,
  callbacks: {
    onPresenceChange: (presence: any) => void;
    onBroadcast: (event: { event: string, payload: any }) => void;
  }
): RealtimeChannel {
  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: currentUser.id },
      broadcast: { self: false, ack: false },
    },
  });

  channel
    .on('broadcast', { event: 'cursor' }, (payload) => {
      callbacks.onBroadcast({ event: 'cursor', payload: payload.payload });
    })
    .on('broadcast', { event: 'content' }, (payload) => {
      callbacks.onBroadcast({ event: 'content', payload: payload.payload });
    })
    .on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<PresenceInfo>();
      callbacks.onPresenceChange(presenceState);
    })
    .on('presence', { event: 'join' }, () => {
      const presenceState = channel.presenceState<PresenceInfo>();
      callbacks.onPresenceChange(presenceState);
    });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user: currentUser });
    }
  });

  return channel;
}

/**
 * Get authenticated user
 */
export async function getAuthenticatedUser(): Promise<CurrentUser> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_color')
        .eq('id', user.id)
        .single();
      
      const userColors = ['#86EFAC', '#FCD34D', '#FDBA74', '#FCA5A5', '#c4b5fd', '#93c5fd'];
      
      return {
        id: user.id,
        name: profile?.full_name || user.email?.split('@')[0] || 'Anonymous',
        color: profile?.avatar_color || userColors[Math.floor(Math.random() * userColors.length)],
      };
    }
  } catch (error) {
    console.warn('Could not fetch authenticated user, using fallback', error);
  }
  
  const userColors = ['#86EFAC', '#FCD34D', '#FDBA74', '#FCA5A5', '#c4b5fd', '#93c5fd'];
  const fallbackName = "Charles P.";
  
  return {
    id: `user-${fallbackName.replace(/\s+/g, '')}`,
    name: fallbackName,
    color: userColors[Math.floor(Math.random() * userColors.length)],
  };
}