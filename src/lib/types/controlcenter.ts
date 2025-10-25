export interface UpcomingEvent {
  id?: number;
  event_id: number;
  event_name: string;
  event_date: string;
  event_flyer: string | null;
  event_venue: string | null;
  event_url: string | null;
  rsvp_url: string | null;
  event_active: boolean;
  event_badge: string | null;
  display_order: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SourceEvent {
  event_id: number;
  event_name: string;
  event_date: string;
  event_flyer: string | null;
  event_venue: string | null;
  event_status: string;
}