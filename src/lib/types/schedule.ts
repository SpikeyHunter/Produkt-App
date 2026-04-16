export type ShiftType = 
    | 'Bazart' 
    | 'Bazart Nuits' 
    | 'Moet City' 
    | 'NCG Show' 
    | 'NCG 360' 
    | 'DSTRKT' 
    | 'Tour Production' 
    | 'Corpo' 
    | 'Maintenance' 
    | 'Office'
    | 'LD'
    | 'OFF'
    | 'PAID OFF'
    | 'Other';

export interface Staff {
  id: number;
  name: string;
  email: string;
  stage_manager: boolean;
}

export interface Shift {
  id?: number;
  week_id: number;
  staff_id: number;
  day_index: number; // 0-6
  start_time: string; // "09:00"
  end_time: string;   // "17:00"
  shift_type: ShiftType | 'PLACEHOLDER';
  custom_label?: string;
  notes?: string;
}

export interface ScheduleWeek {
  id: number;
  start_date: string;
  notes?: string;
  shifts: Shift[];
}

export interface StaffRow {
  staff: Staff;
  shifts: Shift[][];
  totalHours: number;
}