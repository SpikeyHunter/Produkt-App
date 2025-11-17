// src/lib/types/announcements.ts

export interface Announcement {
  id: number;
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  is_enabled: boolean;
  status: 'scheduled' | 'active' | 'ended' | 'manual';
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  is_enabled: boolean;
}

export interface UpdateAnnouncementInput {
  title?: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_enabled?: boolean;
  status?: 'scheduled' | 'active' | 'ended' | 'manual';
}

export interface Giveaway {
  id: number;
  title: string;
  description: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}