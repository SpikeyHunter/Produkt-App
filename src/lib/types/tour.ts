// ============================================================
// S+S TOUR PLANNER — TYPES
// ============================================================

export interface SSTour {
	id: string;
	name: string;
	start_date: string;
	end_date: string;
	description: string;
	maps_info?: string;
	year: number;
	budget?: TourBudget; // tour-level production budget (CAD, restricted)
}

export interface SSTourDateAddress {
	full_address: string;
	city: string;
	country: string;
	lat: number;
	lng: number;
	country_code: string;
}

// ============================================================
// DATE TYPES — the 6 canonical types used by the modal tabs,
// the list filters and the map settings.
// ============================================================

export const TOUR_DATE_TYPES = [
	'Tour Date',
	'Travel Day',
	'Tour Break',
	'Pickup',
	'Dropoff',
	'Other'
] as const;

export type TourDateType = (typeof TOUR_DATE_TYPES)[number] | string; // string = future custom types

// Default colors per date type (overridable via user_profiles.user_settings.tour_type_colors)
export const DEFAULT_TYPE_COLORS: Record<string, string> = {
	'Tour Date': '#E1FF00', // lime
	'Travel Day': '#93c5fd', // blue
	'Tour Break': '#c4b5fd', // purple
	Pickup: '#86EFAC', // green
	Dropoff: '#FCA5A5', // red
	Other: '#E4E4E4' // gray
};

// ============================================================
// USER SETTINGS (user_profiles.user_settings jsonb)
// ============================================================

export type TourTypeColors = Record<string, string>; // keyed by TourDateType

export interface UserSettings {
	theme?: 'dark' | 'light';
	start_week_on?: 'Sunday' | 'Monday';
	tour_line_color?: string;
	tour_type_colors?: TourTypeColors;
	[key: string]: unknown; // preserve unknown keys on save
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
	theme: 'dark',
	start_week_on: 'Sunday',
	tour_line_color: '#E1FF00',
	tour_type_colors: { ...DEFAULT_TYPE_COLORS }
};

export interface SSTourDate {
	id: string;
	tour_id: string;
	date: string;
	venue: string;
	address: SSTourDateAddress;
	type?: TourDateType;
	cached_route_to_next?: string;
	route_variants?: string;
	notes?: string;
}

// ============================================================
// CREW
// ============================================================

export type CrewType = 'artist' | 'prod' | 'singer' | 'management' | 'media';

export interface SSCrew {
	id: string;
	user_id?: string | null;
	name: string;
	role?: string;
	crew_type: CrewType;
	salary?: number; // per show, USD
	email?: string;
	phone?: string;
	passport?: {
		number?: string;
		country?: string;
		expiry?: string;
		photo_url?: string;
	};
	airlines?: {
		air_canada?: string;
		united?: string;
		delta?: string;
		other?: { airline: string; number: string }[];
	};
	seat_preference?: 'window' | 'aisle';
	is_active?: boolean;
	sort_order?: number;
}

// ============================================================
// SETTINGS (ss_settings key/value)
// ============================================================

export interface MerchDefaultItem {
	name: string;
	price: number;
	photo_url?: string;
}

export interface TracklistTrack {
	order: number;
	name: string;
	notes?: string;
}

export interface RidersSettings {
	artist: string[];
	prod: string[];
	singer_1: string[];
	singer_2: string[];
	singer_3: string[];
	singer_4: string[];
	[key: string]: string[];
}

// ============================================================
// PER-DATE TAB DATA (ss_tour_data — one jsonb column per tab)
// ============================================================

export interface ContactInfo {
	name: string;
	phone?: string;
	email?: string;
	role?: string;
}

export interface SetTimeRow {
	id: string;
	time: string; // formatted "h:mmAM/PM"
	length?: string; // computed from next row's time (display only, persisted for convenience)
	label: string; // description: Load In, Soundcheck S+S, Doors, Performance, Curfew...
	confirmed?: boolean; // legacy — no longer shown in UI
}

// Media crew row (Videographer / Photographer / custom) — can be linked to a crew member
export interface MediaCrewRow {
	id: string;
	role: string; // 'Videographer', 'Photographer', or custom
	crew_id?: string | null; // linked ss_crew id, null/undefined = unassigned
}

export interface EventDetailsData {
	status?: 'confirmed' | 'tentatif' | 'proposed' | 'problem'; // legacy — removed from UI
	artist_entrance?: string; // entrance / accreditation info
	load_in_instructions?: string;
	parking_instructions?: string;
	bus_parking_enabled?: boolean; // default true
	bus_parking_instructions?: string;
	contacts?: ContactInfo[]; // main, prod, hospitality, runner...
	contacts_initialized?: boolean; // true once default roles have been seeded (so deletions stick)
	set_times?: SetTimeRow[];
	crew_ids?: string[]; // assigned ss_crew ids (artists auto-loaded)
	singers_enabled?: boolean;
	singer_crew_ids?: string[]; // ss_crew ids with crew_type === 'singer'
	singers?: ContactInfo[]; // legacy
	media_crew_enabled?: boolean;
	media_crew?: MediaCrewRow[]; // Videographer + Photographer by default
	photographer_enabled?: boolean; // legacy
	photographer?: ContactInfo; // legacy
}

export interface BudgetLine {
	id: string;
	label: string;
	amount: number;
	enabled?: boolean;
}

export interface ShowBudgetData {
	// USD. Crew lines come live from event_details.crew_ids x ss_crew salaries.
	flights?: BudgetLine;
	hotels?: BudgetLine;
	per_diem?: BudgetLine;
	transports?: BudgetLine;
	other_expenses?: BudgetLine[]; // e.g. Photo (auto if enabled in event details)
	merch_revenue_override?: number | null; // null => linked live from merch tab
	notes?: string;
}

export interface GreenRoom {
	id: string;
	name: string; // GR 1, GR 2...
	assigned: string[]; // groups or crew names
}

export interface VenueInfoData {
	indoor_outdoor?: 'indoor' | 'outdoor';
	venue_type?: 'Festival' | 'Concert Hall' | 'Theatre' | 'Club' | 'Other';
	wifi_login?: string;
	wifi_password?: string;
	shower?: boolean;
	green_room?: boolean;
	green_room_count?: number;
	green_rooms?: GreenRoom[];
	green_room_is_custom?: boolean; // bypass auto-assignment
	notes?: string;
}

export interface LocalCrewItem {
	id: string;
	qty: number;
	role: string;
}

export interface ProductionData {
	artist_specs_status?: 'to_send' | 'sent';
	artist_specs_confirmed?: boolean;
	artist_specs_notes?: string;
	venue_specs_link?: string; // upload URL or external link
	stage_height?: string;
	stage_width?: string;
	stage_depth?: string;
	led_wall?: boolean;
	led_width?: string;
	led_height?: string;
	pixel_map_link?: string;
	venue_specs_notes?: string;
	power_confirmed?: boolean;
	power_notes?: string;
	local_crew?: LocalCrewItem[];
	load_in_time?: string;
	load_in_confirmed?: boolean;
	load_out_time?: string;
	load_out_confirmed?: boolean;
	stagehands_rate_total?: number; // linked into show budget
}

export interface SetListSong {
	id: string;
	name: string;
	is_encore_break?: boolean; // "Encore (pause)" marker row
	singer_notes?: string;
	video_notes?: string;
	ld_notes?: string;
	other_notes?: string;
}

export interface SetListData {
	songs?: SetListSong[];
}

export interface TransportRow {
	id: string;
	date?: string;
	name: string;
	from?: string;
	to?: string;
	how?: string; // driver / uber / etc
	time?: string;
	notes?: string;
}

export interface GuestlistEntry {
	id: string;
	first: string;
	last: string;
	plus_one?: boolean;
	tier: 'GA' | 'VIP' | 'AA';
}

export interface LogisticsData {
	artist_hospo?: string[];
	prod_hospo?: string[];
	singer_hospo?: Record<string, string[]>; // keyed singer_1..4 based on crew
	meal_mode?: 'uber' | 'catering' | 'restaurant' | 'other';
	meal_notes?: string;
	transports?: TransportRow[];
	guestlist_allocation?: { GA?: number; VIP?: number; AA?: number };
	guestlist?: GuestlistEntry[];
}

export interface MerchData {
	enabled?: boolean;
	delivery?: boolean; // default false
	delivery_restrictions?: string;
	tracking_info?: string;
	seller_name?: string;
	seller_contact?: string;
	seller_rate?: number; // adds to budget if enabled
	venue_pct?: number;
	counts?: { item: string; price: number; qty_in: number; qty_out: number }[];
}

export interface InterviewRow {
	id: string;
	name: string;
	hours?: string;
	length?: string;
	photo?: boolean;
	video?: boolean;
	recording?: boolean; // interviews
	people?: number; // meet & greet
	notes?: string;
}

export interface MediaData {
	photo_link_received?: boolean;
	photo_link?: string;
	brief_sent?: boolean;
	interviews_enabled?: boolean;
	interviews?: InterviewRow[];
	meet_greet_enabled?: boolean;
	meet_greets?: InterviewRow[];
}

export interface ImmigrationCrewRow {
	crew_id: string;
	info_sent_to_promoter?: boolean;
	letter_or_visa_received?: boolean;
	document_link?: string;
	sent_to_crew?: boolean;
	eta_required?: boolean;
	eta_confirmed?: boolean;
}

export interface ImmigrationData {
	enabled?: boolean;
	rows?: ImmigrationCrewRow[];
}

export interface TodoItem {
	id: string;
	text: string;
	done: boolean;
}

export interface TodosData {
	items?: TodoItem[];
}

export type NotePriority = 'info' | 'question' | 'warning' | 'emergency';

export interface NoteItem {
	id: string;
	text: string;
	priority: NotePriority;
	created_at?: string;
}

export interface NotesData {
	items?: NoteItem[];
}

export interface TravelPersonRow {
	crew_id: string;
	direction?: 'in' | 'out'; // travel in / travel out
	mode?: 'flight' | 'bus' | 'other';
	booked?: boolean;
	flight_info?: string;
	booking_confirmation?: string;
	other_notes?: string;
	ground_transport?: 'uber' | 'private' | 'other' | 'n/a';
	hotel_status?: 'booked' | 'not_booked' | 'n/a';
	hotel_name?: string;
	hotel_address?: string;
	hotel_confirmation?: string;
	rooming?: string;
}

export interface TravelData {
	people?: TravelPersonRow[];
}

export interface BreakInfoData {
	bus_location?: string;
	truck_location?: string;
	notes?: string;
}

export interface SimpleNotesData {
	notes?: string;
}

// One row of ss_tour_data
export interface SSTourData {
	id?: string;
	tour_date_id: string;
	event_details: EventDetailsData;
	show_budget: ShowBudgetData;
	venue_info: VenueInfoData;
	production: ProductionData;
	set_list: SetListData;
	logistics: LogisticsData;
	merch: MerchData;
	media: MediaData;
	immigration: ImmigrationData;
	todos: TodosData;
	notes: NotesData;
	travel: TravelData;
	break_info: BreakInfoData;
	pickup_info: SimpleNotesData;
	custom_info: SimpleNotesData;
}

export type TourDataTab = keyof Omit<SSTourData, 'id' | 'tour_date_id'>;

// ============================================================
// TOUR-LEVEL PRODUCTION BUDGET (CAD, restricted)
// ============================================================

export interface TourBudgetItem {
	id: string;
	label: string;
	amount: number;
}

export interface TourBudgetSection {
	id: string;
	name: string; // Solotech, Décors, Transport...
	items: TourBudgetItem[];
}

export interface TourBudget {
	target_per_show?: number; // default 15000
	sections?: TourBudgetSection[]; // counted against per-show target
	bus?: TourBudgetItem[]; // separate section
	preproduction?: TourBudgetItem[]; // separate section
}