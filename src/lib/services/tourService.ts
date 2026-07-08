import { supabase } from '$lib/supabase';
import type {
	SSTour,
	SSTourDate,
	SSTourData,
	SSCrew,
	TourDataTab,
	TourBudget
} from '$lib/types/tour';
import { USD_CAD_RATE_KEY, DEFAULT_USD_CAD_RATE } from '$lib/types/tour';

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

/**
 * Fetch every ss_tour_data row for a set of tour-date ids in ONE query.
 * Used by the Production grid to hydrate all shows at once. Dates without a
 * row yet are simply absent from the result (the caller fills in blanks).
 */
export async function fetchTourDataForDates(tourDateIds: string[]): Promise<SSTourData[]> {
	if (!tourDateIds.length) return [];
	const { data, error } = await supabase
		.from('ss_tour_data')
		.select('*')
		.in('tour_date_id', tourDateIds);

	if (error) throw new Error(error.message);
	return (data || []) as SSTourData[];
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

	let value: any = data?.data ?? fallback;

	// The `data` cell can come back as JSON-encoded text (text column, or a value
	// that was stringified before insert — e.g. "[{\"qty\":1,\"role\":\"Test\"}]").
	// Un-stringify it so callers always receive real typed data instead of a
	// string they'd have to JSON.parse themselves. Genuine plain-string settings
	// (e.g. "#E1FF00", "dark", "Sunday") aren't valid JSON, so JSON.parse throws
	// and we leave them untouched. Loop guards against double-stringified values.
	let guard = 0;
	while (typeof value === 'string' && guard++ < 5) {
		const s = value.trim();
		if (!s) {
			value = fallback;
			break;
		}
		try {
			value = JSON.parse(s);
		} catch {
			break; // not JSON — a legitimate plain string, keep as-is
		}
	}

	// Guard against legacy wrapped rows (e.g. {"items": [...]}) silently
	// masquerading as T when the caller expects a bare array. If this ever
	// fires, the DB row is stored in the wrong shape — fix the data, not this check.
	if (
		Array.isArray(fallback) &&
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value)
	) {
		console.error(
			`getSetting('${key}'): expected an array but got an object (${JSON.stringify(value).slice(0, 80)}). Falling back to default. Check the ss_settings row for this key.`
		);
		return fallback;
	}

	return value as T;
}

export async function setSetting(key: string, data: unknown): Promise<void> {
	const { error } = await supabase.from('ss_settings').upsert({ key, data });
	if (error) throw new Error(error.message);
}

// ============================================================
// FX RATE (fixed USD/CAD — stored in ss_settings under USD_CAD_RATE_KEY)
// ============================================================

/** Fixed USD/CAD rate (CAD per 1 USD). Always returns a positive number. */
export async function getUsdCadRate(): Promise<number> {
	const raw = await getSetting<number>(USD_CAD_RATE_KEY, DEFAULT_USD_CAD_RATE);
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_CAD_RATE;
}

export async function setUsdCadRate(rate: number): Promise<void> {
	const n = Number(rate);
	await setSetting(USD_CAD_RATE_KEY, Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_CAD_RATE);
}