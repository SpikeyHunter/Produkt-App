// src/lib/types/emailtech.ts

export type CrewRole = 'LD' | 'Video' | 'VJ' | 'Sound' | 'Stage/Tech' | 'DT';

export interface CrewMember {
    id: string;
    name: string;
    role: string;
    email?: string;
}

export interface CrewAssignments {
    [role: string]: string[]; 
}

export interface TimetableEntry {
    id?: string;
    time: string;
    artist: string;
    notes?: string; 
    length?: string;
    status?: string; 
}

export interface TechEmailForm {
    visible_sections: { [key: string]: boolean };
    liaison: string;
    crew_calls: { time: string; names: string }[];
    team_notes: string;
    vj_notes?: string;
    specs_links: { label: string; url: string }[];
    projects: string[];
    projector_outdoor: string;
    visuals_interior: string;
    vj_visuals?: string;
    second_event?: EmailTechEvent | null;
    sponsor_name?: string;
    sponsor_link?: string;
    set_times: { 
        event_id: number;
        venue: string; 
        entries: TimetableEntry[];
    }[]; 
    soundcheck: string;
    riders_attached: boolean;
    backline: { venue: string; items: string[] }[];
    travelling_party: string;
    vj_schedule: string;
    lights: { area: string; color: string }[];
    sfx: string;
    sponsors: string;
    post_show: string;
    
    // NEW FIELD
    lounge_ambiance?: {
        terrasse_type: 'back-side' | 'back' | null;
        terrasse_option: string;
        terrasse_custom: string;
        lounge_option: string;
        lounge_custom: string;
    };
}

export interface EmailTechEvent {
    id: string;
    event_id: number;
    event_name: string;
    artist_name: string;
    artist_type: string | null; 
    event_date: string | null;
    event_venue: string | null;
    event_flyer: string | null;
    event_status: string | null;
    timetable: any; 
    tech_rider: any;
    rider_files: any; // [Fix] Added missing property
    sfx_rider: any;
    soundcheck: any; 
    visuals: any;
    visual_received?: boolean; 
    ground_transport?: any;
    ground_info?: any;
    notes?: any;
    crew: CrewAssignments | null;
    email_data: any | null; 
    tech_mail: string | null; 
    vj_mail: string | null;
    roles?: any;
    dos?: string; 
}