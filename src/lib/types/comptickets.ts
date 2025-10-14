// /src/lib/types/comptickets.ts
export interface CompEntry {
	firstName: string;
	lastName: string;
	email: string;
	quantity: number;
	sent?: boolean;      // NEW: Flag to track if the entry has been sent
	added_by?: string;   // NEW: Name of the user who added the entry
}

export type CompType = 'ga_comps' | 'vip_comps' | 'other_comps';

export interface CompStatus {
	status: 'None' | 'Progress' | 'To Send' | 'Sent';
	other_comps_name: string;
}

export interface CompTicketData {
	event_id: number | null;
	ga_comps: CompEntry[];
	vip_comps: CompEntry[];
	other_comps: CompEntry[];
	comp_status: CompStatus;
}