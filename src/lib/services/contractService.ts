import { supabase } from '$lib/supabase.js';

export interface EventContract {
    contract_id?: number;
    event_id: number;
    advance_id: number;
    gdrive_folder_id: string | null;
    gdrive_folder_url: string | null;
    original_contract_url?: string | null;
    redlined_contract_url?: string | null;
    signed_contract_url?: string | null;
    invoice_url?: string | null;
    w89_url?: string | null;
    w_type?: string | null; // <-- ADD THIS
    agency_id?: number | null;
    contract?: boolean;
    bypass?: boolean;
}

export async function upsertEventContract(contractData: EventContract) {
    const { data, error } = await supabase
        .from('events_contract')
        .upsert(contractData, { onConflict: 'advance_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateEventContractStatus(contractId: number, status: string) {
    const { data, error } = await supabase
        .from('events_contract')
        .update({ contract_status: status })
        .eq('contract_id', contractId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ── Dummy Types to keep IntelligencePanel container alive without errors ──
export interface Annotation {
    id?: string;
    type: string;
    page: number;
    text_content?: string;
    status: string;
    source: string;
}

export async function updateAnnotationStatus(id: string, status: string) {
    return { id, status };
}

export async function deleteAnnotation(id: string) {
    return true;
}