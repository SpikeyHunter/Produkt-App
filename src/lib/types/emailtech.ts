// src/lib/types/emailtech.ts

/**
 * Crew slots on the tech email. Keys are what gets stored in `events.crew`;
 * older rows used 'Video' / 'Sound' / 'Stage/Tech' — see normalizeCrew().
 *
 *  - LIAISON is never dragged: it comes from events_advance.dos.
 *  - LASERS is free text (no crew member behind it).
 */
export type CrewRole = 'LD' | 'VIDEO' | 'VJ' | 'SOUND' | 'TECH' | 'DT' | 'LIAISON' | 'LASERS';

export const CREW_ROLES: { role: CrewRole; label: string; kind: 'drop' | 'auto'; autofill: boolean }[] = [
    { role: 'LD', label: 'LD', kind: 'drop', autofill: true },
    { role: 'VIDEO', label: 'Video', kind: 'drop', autofill: true },
    { role: 'VJ', label: 'VJ', kind: 'drop', autofill: true },
    { role: 'SOUND', label: 'Sound', kind: 'drop', autofill: true },
    { role: 'TECH', label: 'Tech', kind: 'drop', autofill: true },
    { role: 'DT', label: 'DT', kind: 'drop', autofill: true },
    { role: 'LIAISON', label: 'Liaison', kind: 'auto', autofill: true },
    // dragged like the others, never filled from the schedule
    { role: 'LASERS', label: 'Lasers', kind: 'drop', autofill: false }
];

/** Legacy crew keys -> current ones. Unknown keys are kept as-is. */
export const LEGACY_CREW_KEYS: Record<string, CrewRole> = {
    Video: 'VIDEO',
    Sound: 'SOUND',
    'Stage/Tech': 'TECH',
    Tech: 'TECH',
    Liaison: 'LIAISON',
    Lasers: 'LASERS'
};

export function normalizeCrew(raw: any): CrewAssignments {
    const out: CrewAssignments = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [key, value] of Object.entries(raw)) {
        const role = (LEGACY_CREW_KEYS[key] || key) as string;
        const names = Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];
        if (!names.length) continue;
        out[role] = Array.from(new Set([...(out[role] || []), ...names]));
    }
    return out;
}

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

export type EmailFormat = 'html' | 'text';

export interface TechEmailForm {
    visible_sections: { [key: string]: boolean };
    /** 'html' = the boxed template, 'text' = plain paragraphs. */
    email_format?: EmailFormat;
    liaison: string;
    /** true = greeting_text replaces the generated "Hello everyone…" opening */
    greeting_custom?: boolean;
    greeting_text?: string;
    crew_calls: { time: string; names: string }[];
    /** true once a crew call was typed by hand — autofill leaves it alone. */
    crew_calls_manual?: boolean;
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
    /** free text under the sponsor line (logo placement, timing, …) */
    sponsor_notes?: string;
    /** true = projector/TV texts are typed by hand instead of the venue defaults */
    visuals_custom?: boolean;
    /** true = no "Please remove show artworks at …" line */
    artwork_removal_off?: boolean;
    set_times: {
        event_id: number;
        venue: string;
        entries: TimetableEntry[];
    }[];
    soundcheck: string;
    /** true = the rows that came from the advance can be edited too */
    soundcheck_custom?: boolean;
    riders_attached: boolean;
    backline: { venue: string; items: string[] }[];
    travelling_party: string;
    vj_schedule: string;
    lights: { area: string; color: string }[];
    sfx: string;
    sponsors: string;
    post_show: string;

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
    /** calendar group id (calendar.id) — exact key into schedule_techs.group_id */
    calendar_link?: string | null;
    timetable: any;
    tech_rider: any;
    rider_files: any;
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

/** What `events.email_data` holds for the tech tool. */
export interface EmailData {
    tech_form_data?: TechEmailForm;
    tech_status?: string;
    vj_status?: string;
    /** events combined into this email (selector "Link") */
    linked_event_ids?: number[];
    /** schedule_techs.id (uuid) chosen by hand when the match was ambiguous */
    schedule_row_id?: string | null;
    [key: string]: any;
}

/** Form keys that are columns of `events_emailtech` (one column per field). */
export const FORM_COLUMNS: (keyof TechEmailForm)[] = [
    'email_format', 'visible_sections', 'liaison', 'greeting_custom', 'greeting_text', 'crew_calls', 'crew_calls_manual',
    'team_notes', 'vj_notes', 'specs_links', 'projects', 'projector_outdoor',
    'visuals_interior', 'visuals_custom', 'artwork_removal_off', 'vj_visuals', 'sponsor_name', 'sponsor_link',
    'sponsor_notes', 'set_times', 'soundcheck', 'soundcheck_custom', 'riders_attached',
    'backline', 'travelling_party', 'vj_schedule', 'lights', 'sfx', 'sponsors',
    'post_show', 'lounge_ambiance'
];

/** A row of `events_emailtech` -> the EmailData shape the page works with. */
export function emailDataFromRow(row: any): EmailData {
    const form: any = {};
    let any = false;
    for (const k of FORM_COLUMNS) {
        if (row[k] !== null && row[k] !== undefined) {
            form[k] = row[k];
            any = true;
        }
    }
    return {
        tech_form_data: any ? (form as TechEmailForm) : undefined,
        tech_status: row.tech_status || 'todo',
        vj_status: row.vj_status || 'todo',
        linked_event_ids: Array.isArray(row.linked_event_ids) ? row.linked_event_ids : [],
        schedule_row_id: row.schedule_row_id != null ? String(row.schedule_row_id) : null
    };
}
