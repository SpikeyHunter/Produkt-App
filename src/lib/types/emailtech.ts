// src/lib/types/emailtech.ts

export interface ScheduleTech {
	id: string;
	date: string; // YYYY-MM-DD
	event_name: string;
	type: string; // 'NCG Show', 'Bazart Nuits', etc.
	ld: string | null;
	video: string | null;
	vj: string | null;
	sound: string | null;
	tech_sm: string | null;
	dt: string | null;
	artist_liaison: string | null;
	notes: string | null;
}

export interface EmailTechEvent {
	id: string;
	event_id: number;
	artist_name: string;
	artist_type: string | null;
	event_name: string | null;
	event_date: string | null;
	event_venue: string | null;
	event_flyer: string | null;
	event_status: string | null;
	tech_rider: any;
	sfx_rider: any;
	soundcheck: any;
	visuals: any;
	visual_received: boolean;
	timetable: any;
	ground_transport: any;
	ground_info: any;
	notes: string | null;
	tech_mail: string | null;
	vj_mail: string | null;
	crew: CrewAssignments | null;
	email_data: any;
	dos: string | null;
	roles: string | null;
}

export interface CrewMember {
	id: string;
	name: string;
	role?: string;
	email?: string;
}

/**
 * MODIFICATION:
 * This interface is now stricter. Each role is explicitly an array of strings.
 * The index signature [key: string]: string[] | undefined; ensures that any
 * property on this object must conform to this structure, fixing the root
 * of the TypeScript errors.
 */
export interface CrewAssignments {
	LD?: string[];
	Video?: string[];
	VJ?: string[];
	Sound?: string[];
	'Stage/Tech'?: string[];
	DT?: string[];
	[key: string]: string[] | undefined;
}

/**
 * MODIFICATION:
 * The list of roles has been updated to use the consolidated 'Stage/Tech' role.
 */
export const CREW_ROLES = ['LD', 'Video', 'VJ', 'Sound', 'Stage/Tech', 'DT'] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export interface CurrentUser {
	id: string;
	name: string;
	color: string;
}

export interface PresenceInfo {
	user: CurrentUser;
}

export interface TimetableEntry {
	id: string;
	time: string;
	artist: string;
	notes?: string;
	status?: string;
}

export interface TechRiderEquipment {
	qty: number;
	selected: boolean;
	editableQty?: boolean;
}

export interface TechRider {
	selected_mixer?: string;
	equipment?: Record<string, TechRiderEquipment>;
	other?: Array<{ id: string; text: string }>;
	confirmed?: boolean;
}

export interface SfxRider {
	cryo_jets?: { enabled: boolean; duration: number; qty?: number };
	sparkulars?: { enabled: boolean; duration: number; qty?: number };
	lasers?: { enabled: boolean; qty?: number };
	other?: string[];
}

export interface SoundcheckInfo {
	status: 'yes' | 'no';
	start_time?: string;
	end_time?: string;
}

export interface RoleInfo {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
	customRole?: string;
}

