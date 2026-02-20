export type EventStatus = 'HOLD' | 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'HIDDEN';
export type HoldLevel = 'P' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'H7' | 'H8' | 'H9' | 'H10' | 'H11' | 'H12' | 'H13' | 'H14' | 'H15' | 'H16' | 'H17' | 'H18' | 'H19' | 'H20' | null;

export type EventType = 'Corpo' | 'Bazart Nuits' | 'Moet City' | 'NCG Show' | 'NCG 360' | 'DSTRKT' | 'Tour Prod' | 'Other';

export interface StageConfig {
    name: string;
    capacity: number;
    color: string;
    active: boolean;
}

export interface VenueSettings {
    id: string;
    setting_name: string;
    setting_params: {
        location: {
            street: string;
            line2: string;
            city: string;
            state: string;
            zip: string;
            country: string;
        };
        timezone: string;
        logoUrl: string;
        financials: {
            taxRate: number;
            taxType: 'Divisor' | 'Multiplier';
            currency: string;
            convertToUsd: boolean;
            facilityFee: number;
        };
        holdSettings: {
            defaultHoldLevel: HoldLevel;
            autoPromote: boolean;
        };
        stages: StageConfig[];
    };
}

export interface CalendarEvent {
    id: string;
    user_id?: string;
	short_id?: number;
    group_id?: string; 
    title: string;
    date: string; 
    status: EventStatus;
    hold_level?: HoldLevel;
    venue: {
        category: string | null;
        room: string | null;
    };
    time: {
        start: string | null;
        end: string | null;
    };
    details: {
        artist: string | null;
        tour: string | null;
        notes: string | null;
        type: EventType | string | null;
        is_challenge: boolean;
        is_target: boolean;
        is_matinee: boolean;
        is_priority?: boolean; 
    };
    contact: {
        name: string | null;
        email: string | null;
        phone: string | null;
    };
    isDraft?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CalendarDay {
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEvent[];
    holds: CalendarEvent[];
}

export interface GroupedEvents {
    [date: string]: {
        dateObj: Date;
        events: CalendarEvent[];
    };
}