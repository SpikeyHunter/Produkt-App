export interface TechRow {
  id: string;
  date: string; // ISO string 'YYYY-MM-DD'
  year: number;
  sort_order: number;
  type: string;
  event_name: string;
  op_hours: string;
  crew_call: string;
  ld: string;
  video: string;
  vj: string;
  sound: string;
  tech_sm: string;
  dt: string;
  artist_liaison: string;
  notes: string;
}

export type TechRowColumn = keyof TechRow;

export const EVENT_COLORS: Record<string, string> = {
  'Bazart': 'transparent',
  'Bazart Nuits': '#ffe089ff',
  'Moet City': '#f1e5cbff',
  'NCG Show': '#c4ef9bff',
  'NCG 360': '#fa7a90ff',
  'DSTRKT': '#afd3e9ff',
  'Tour Prod': '#aec5d5ff',
  'Corpo': '#d7b8e8ff',
  'Maintenance': '#ffdcc7ff',
  'Montage': '#f8a679ff',
  'Demontage': '#f8a679ff',
  'Other': 'transparent',
  'Hold': 'transparent',
  'Canceled': '#ff0000', // Special handling in logic
  '': 'transparent'
};

export const EVENT_TYPES = Object.keys(EVENT_COLORS).filter(k => k !== '');

// --- History Types ---

export interface TechHistoryEntry {
    id: string;
    row_id: string;
    changed_at: string;
    changed_by: string; // UUID
    action: 'UPDATE' | 'INSERT' | 'DELETE' | 'RESTORE';
    old_data: Record<string, any> | null;
    new_data: Record<string, any> | null;
    // client-side joined fields
    changer_name?: string; 
}