import { supabase } from '$lib/supabase';

// Type Definitions
export interface SSShow {
    id: number;
    show_date: string;
    show_venue: string;
    show_city: string;
    show_country: string;
    venue_address: string | null;
    
    // JSONB columns
    show_settimes: any;
    vj_info: any;
    videocheck: any;
    tracklist: any;
    notes: any;
    venue_info: any;
    show_specs: any; // JSONB in DB

    // Boolean columns
    pixel_map: boolean;
    camera: boolean;
    sdi_confirmed: boolean;

    // Text columns
    show_specs_file: string | null;
    flyer_url: string | null;
    dos_contact: string | null; // Stored as text (stringified JSON)
    
    progress?: number;
}

// 30 Fixed Flyer Assets
const FLYER_ASSETS = [
  { "file_path": "sultanshepard/ss_image_1.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_1.jpg" },
  { "file_path": "sultanshepard/ss_image_10.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_10.jpg" },
  { "file_path": "sultanshepard/ss_image_11.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_11.jpg" },
  { "file_path": "sultanshepard/ss_image_12.png", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_12.png" },
  { "file_path": "sultanshepard/ss_image_13.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_13.jpeg" },
  { "file_path": "sultanshepard/ss_image_14.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_14.jpg" },
  { "file_path": "sultanshepard/ss_image_15.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_15.jpeg" },
  { "file_path": "sultanshepard/ss_image_16.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_16.jpeg" },
  { "file_path": "sultanshepard/ss_image_17.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_17.jpg" },
  { "file_path": "sultanshepard/ss_image_18.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_18.jpeg" },
  { "file_path": "sultanshepard/ss_image_19.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_19.jpeg" },
  { "file_path": "sultanshepard/ss_image_2.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_2.jpg" },
  { "file_path": "sultanshepard/ss_image_20.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_20.jpeg" },
  { "file_path": "sultanshepard/ss_image_21.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_21.jpeg" },
  { "file_path": "sultanshepard/ss_image_22.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_22.jpeg" },
  { "file_path": "sultanshepard/ss_image_23.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_23.jpeg" },
  { "file_path": "sultanshepard/ss_image_24.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_24.jpeg" },
  { "file_path": "sultanshepard/ss_image_25.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_25.jpeg" },
  { "file_path": "sultanshepard/ss_image_26.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_26.jpeg" },
  { "file_path": "sultanshepard/ss_image_27.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_27.jpeg" },
  { "file_path": "sultanshepard/ss_image_28.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_28.jpeg" },
  { "file_path": "sultanshepard/ss_image_29.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_29.jpeg" },
  { "file_path": "sultanshepard/ss_image_3.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_3.jpg" },
  { "file_path": "sultanshepard/ss_image_30.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_30.jpeg" },
  { "file_path": "sultanshepard/ss_image_4.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_4.jpg" },
  { "file_path": "sultanshepard/ss_image_5.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_5.jpg" },
  { "file_path": "sultanshepard/ss_image_6.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_6.jpg" },
  { "file_path": "sultanshepard/ss_image_7.jpg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_7.jpg" },
  { "file_path": "sultanshepard/ss_image_8.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_8.jpeg" },
  { "file_path": "sultanshepard/ss_image_9.jpeg", "public_url": "https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/sultanshepard/ss_image_9.jpeg" }
];

async function getNextFlyerUrl(): Promise<string> {
    try {
        const { count, error } = await supabase
            .from('ss_djshows')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        const nextIndex = (count || 0) % FLYER_ASSETS.length;
        return FLYER_ASSETS[nextIndex].public_url;
    } catch (err) {
        console.error('Error calculating flyer index:', err);
        return FLYER_ASSETS[0].public_url;
    }
}

export function getSSImage(index: number): string {
    if (FLYER_ASSETS.length === 0) return '';
    const assetIndex = index % FLYER_ASSETS.length;
    return FLYER_ASSETS[assetIndex].public_url;
}

export function calculateSSProgress(show: SSShow): number {
    const specsExists = show.show_specs || show.show_specs_file;
    const hasDos = show.dos_contact && show.dos_contact.length > 2; // Rough check if contact array/string exists
    const hasSdi = show.sdi_confirmed === true; // Check boolean

    const fields = [
        specsExists,
        show.show_settimes,
        show.videocheck,
        hasDos,
        hasSdi
    ];
    
    const completed = fields.filter(f => f !== null && f !== false && f !== undefined).length;
    return Math.round((completed / fields.length) * 100);
}

export async function fetchSSShows(): Promise<SSShow[]> {
    const { data, error } = await supabase
        .from('ss_djshows')
        .select('*')
        .order('show_date', { ascending: true });

    if (error) {
        console.error('Error fetching shows:', error);
        return [];
    }

    return data.map((show) => ({
        ...show,
        progress: calculateSSProgress(show)
    }));
}

const DEFAULT_SET_TIMES = [
    { time: '10:00PM', activity: 'Doors', status: 'Default' },
    { time: '10:00PM', activity: 'Local', status: 'Tentative' },
    { time: '11:30PM', activity: 'Support', status: 'Tentative' },
    { time: '1:00AM', activity: 'Sultan + Shepard', status: 'Tentative' },
    { time: '3:00AM', activity: 'Curfew', status: 'Default' }
];

export async function createSSShow(showData: Partial<SSShow>) {
    const flyerUrl = await getNextFlyerUrl();

    const { data, error } = await supabase
        .from('ss_djshows')
        .insert([{
            show_date: showData.show_date,
            show_venue: showData.show_venue,
            venue_address: showData.venue_address || null,
            show_city: showData.show_city,
            show_country: showData.show_country,
            flyer_url: flyerUrl,
            show_settimes: DEFAULT_SET_TIMES,
            
            // Boolean values for schema
            pixel_map: false,
            camera: false,
            sdi_confirmed: false,
            
            // JSONB structures
            venue_info: { bring_own_camera: 'no' }, 
            show_specs: { url: '' }, // Initialize as object since schema is JSONB
            vj_info: { needed: 'no', confirmed: 'no', name: 'None' },
            dos_contact: '[]' // Initialize as empty JSON string array
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchSSShowById(id: string): Promise<SSShow | null> {
    const { data, error } = await supabase
        .from('ss_djshows')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching show by ID:', error);
        return null;
    }

    return {
        ...data,
        progress: calculateSSProgress(data)
    };
}

export async function updateSSShow(id: number, updates: Partial<SSShow>) {
    const { data, error } = await supabase
        .from('ss_djshows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteSSShow(id: number) {
    const { error } = await supabase
        .from('ss_djshows')
        .delete()
        .eq('id', id);

    if (error) throw error;
}