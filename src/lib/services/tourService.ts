import { supabase } from '$lib/supabase';
import type { SSTour, SSTourDate } from '$lib/types/tour';

export async function fetchTours(): Promise<SSTour[]> {
    const { data, error } = await supabase
        .from('ss_tour')
        .select('*')
        .order('year', { ascending: false })
        .order('start_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function fetchTourDates(tourId: string): Promise<SSTourDate[]> {
    const { data, error } = await supabase
        .from('ss_tour_dates')
        .select('*')
        .eq('tour_id', tourId)
        .order('date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

// --- TOUR CRUD ---

export async function createTour(tourData: Omit<SSTour, 'id' | 'created_at' | 'updated_at'>): Promise<SSTour> {
    const { data, error } = await supabase
        .from('ss_tour')
        .insert([tourData])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateTour(id: string, updates: Partial<SSTour>): Promise<SSTour> {
    const { data, error } = await supabase
        .from('ss_tour')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTour(tourId: string): Promise<void> {
    const { error } = await supabase
        .from('ss_tour')
        .delete()
        .eq('id', tourId);

    if (error) throw new Error(error.message);
}


// --- TOUR DATE CRUD ---

export async function createTourDate(dateData: Omit<SSTourDate, 'id' | 'created_at' | 'updated_at'>): Promise<SSTourDate> {
    const { data, error } = await supabase
        .from('ss_tour_dates')
        .insert([dateData])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateTourDate(id: string, updates: Partial<SSTourDate>): Promise<SSTourDate> {
    const { data, error } = await supabase
        .from('ss_tour_dates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTourDate(id: string): Promise<void> {
    const { error } = await supabase
        .from('ss_tour_dates')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}