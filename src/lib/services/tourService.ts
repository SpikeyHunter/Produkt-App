import { supabase } from '$lib/supabase';
import type {
	SSTour,
	SSTourDate,
	SSTourData,
	SSCrew,
	TourDataTab,
	TourBudget
} from '$lib/types/tour';

// ============================================================
// TOURS
// ============================================================

export async function fetchTours(): Promise<SSTour[]> {
	const { data, error } = await supabase
		.from('ss_tour')
		.select('*')
		.order('year', { ascending: false })
		.order('start_date', { ascending: false });

	if (error) throw new Error(error.message);
	return data || [];
}

export async function createTour(
	tourData: Omit<SSTour, 'id' | 'created_at' | 'updated_at'>
): Promise<SSTour> {
	const { data, error } = await supabase.from('ss_tour').insert([tourData]).select().single();
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
	const { error } = await supabase.from('ss_tour').delete().eq('id', tourId);
	if (error) throw new Error(error.message);
}

export async function saveTourBudget(tourId: string, budget: TourBudget): Promise<void> {
	const { error } = await supabase.from('ss_tour').update({ budget }).eq('id', tourId);
	if (error) throw new Error(error.message);
}

// ============================================================
// TOUR DATES
// ============================================================

export async function fetchTourDates(tourId: string): Promise<SSTourDate[]> {
	const { data, error } = await supabase
		.from('ss_tour_dates')
		.select('*')
		.eq('tour_id', tourId)
		.order('date', { ascending: true });

	if (error) throw new Error(error.message);
	return data || [];
}

export async function createTourDate(
	dateData: Omit<SSTourDate, 'id' | 'created_at' | 'updated_at'>
): Promise<SSTourDate> {
	const { data, error } = await supabase
		.from('ss_tour_dates')
		.insert([dateData])
		.select()
		.single();
	if (error) throw new Error(error.message);
	return data;
}

export async function updateTourDate(
	id: string,
	updates: Partial<SSTourDate>
): Promise<SSTourDate> {
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
	const { error } = await supabase.from('ss_tour_dates').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ============================================================
// TOUR DATA (per-date tab data — ss_tour_data)
// ============================================================

const EMPTY_TOUR_DATA: Omit<SSTourData, 'id' | 'tour_date_id'> = {
	event_details: {},
	show_budget: {},
	venue_info: {},
	production: {},
	set_list: {},
	logistics: {},
	merch: {},
	media: {},
	immigration: {},
	todos: {},
	notes: {},
	travel: {},
	break_info: {},
	pickup_info: {},
	custom_info: {}
};

/** Fetch the data row for a tour date; returns an empty shell if none exists yet. */
export async function fetchTourData(tourDateId: string): Promise<SSTourData> {
	const { data, error } = await supabase
		.from('ss_tour_data')
		.select('*')
		.eq('tour_date_id', tourDateId)
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!data) return { tour_date_id: tourDateId, ...structuredClone(EMPTY_TOUR_DATA) };
	return data as SSTourData;
}

/** Upsert a single tab's jsonb cell. Only the given column is written. */
export async function saveTabData(
	tourDateId: string,
	tab: TourDataTab,
	value: unknown
): Promise<void> {
	const { error } = await supabase
		.from('ss_tour_data')
		.upsert({ tour_date_id: tourDateId, [tab]: value }, { onConflict: 'tour_date_id' });
	if (error) throw new Error(error.message);
}

// ============================================================
// CREW
// ============================================================

export async function fetchCrew(): Promise<SSCrew[]> {
	const { data, error } = await supabase
		.from('ss_crew')
		.select('*')
		.order('sort_order', { ascending: true })
		.order('name', { ascending: true });
	if (error) throw new Error(error.message);
	return data || [];
}

export async function createCrew(
	crew: Omit<SSCrew, 'id' | 'created_at' | 'updated_at'>
): Promise<SSCrew> {
	const { data, error } = await supabase.from('ss_crew').insert([crew]).select().single();
	if (error) throw new Error(error.message);
	return data;
}

export async function updateCrew(id: string, updates: Partial<SSCrew>): Promise<SSCrew> {
	const { data, error } = await supabase
		.from('ss_crew')
		.update(updates)
		.eq('id', id)
		.select()
		.single();
	if (error) throw new Error(error.message);
	return data;
}

export async function deleteCrew(id: string): Promise<void> {
	const { error } = await supabase.from('ss_crew').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ============================================================
// SETTINGS (key/value jsonb)
// ============================================================

export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
	const { data, error } = await supabase
		.from('ss_settings')
		.select('data')
		.eq('key', key)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return (data?.data as T) ?? fallback;
}

export async function setSetting(key: string, data: unknown): Promise<void> {
	const { error } = await supabase.from('ss_settings').upsert({ key, data });
	if (error) throw new Error(error.message);
}
