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

// ============================================================
// FX / CURRENCY  (fixed USD/CAD rate — stored in ss_settings)
// ============================================================

export type SalaryCurrency = 'CAD' | 'USD';

// ss_settings key that holds the fixed exchange rate.
export const USD_CAD_RATE_KEY = 'usd_cad_rate';

// The stored value is the USD/CAD pair: how many CAD equal 1 USD.
// e.g. 1.37 => 1 USD = 1.37 CAD.
export const DEFAULT_USD_CAD_RATE = 1.37;

/**
 * Convert an amount into USD using the fixed USD/CAD rate.
 * `rate` = CAD per 1 USD (e.g. 1.37).
 *  - USD amounts pass through unchanged.
 *  - CAD amounts are divided by the rate.
 * Falls back to the default rate if a zero/invalid rate is supplied.
 */
export function toUsd(
	amount: number | undefined,
	currency: SalaryCurrency | undefined,
	rate: number
): number {
	const amt = Number(amount) || 0;
	const cur = currency ?? 'CAD';
	if (cur === 'USD') return amt;
	const r = Number(rate) || DEFAULT_USD_CAD_RATE;
	return r > 0 ? amt / r : amt;
}

/** USD-equivalent per-show salary for a crew member, given the fixed rate. */
export function crewSalaryUsd(
	crew: Pick<SSCrew, 'salary' | 'salary_currency'>,
	rate: number
): number {
	return toUsd(crew.salary, crew.salary_currency, rate);
}

export interface SSTourDate {
	id: string;
	tour_id: string;
	date: string;
	venue: string;
	address: SSTourDateAddress;
	type?: TourDateType;
	linked_date_id?: string | null; // Travel Day → linked Show Date
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
	salary?: number; // per show, in `salary_currency` (defaults to CAD)
	salary_currency?: SalaryCurrency; // 'CAD' (default) | 'USD'
	email?: string;
	phone?: string;
	passport?: {
		number?: string;
		country?: string; // citizenship
		expiry?: string;
		photo_url?: string;
		given_names?: string;     // added
		last_names?: string;      // added
		date_of_birth?: string;   // added
		country_birth?: string;   // added
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
	sizes?: string[]; // 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | 'ALL'
  }

export type TracklistSection = 'main' | 'encore';

export interface TracklistTrack {
	id: string;
	order: number;
	section: TracklistSection;
	name: string;
	singer_notes?: string;
	vj_notes?: string;
	ld_notes?: string;
	other_notes?: string;
}

// ============================================================
// HOSPITALITY RIDERS (per tour-role: artist, prod, singer_1-4)
// ============================================================

export type RiderCategory = 'dj_booth' | 'spirits' | 'drinks' | 'snacks' | 'misc';

export interface RiderItem {
	selected: boolean;
	qty: number;
}

// A role's rider: each category is a map of item name -> selection state.
// Item names double as keys; custom (user-added) items are just additional
// keys alongside the hardcoded defaults, so there's no separate "isCustom"
// bookkeeping needed — anything not in the default list for that category
// is inherently custom and gets pruned if deselected with qty staying 0.
export type RiderCategoryItems = Record<string, RiderItem>;

export interface RoleRider {
	dj_booth: RiderCategoryItems;
	spirits: RiderCategoryItems;
	drinks: RiderCategoryItems;
	snacks: RiderCategoryItems;
	misc: RiderCategoryItems;
}

export type TourRole = 'artist' | 'prod' | 'singer_1' | 'singer_2' | 'singer_3' | 'singer_4';

export type RidersSettings = Record<TourRole, RoleRider>;

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

// Unit for an Other-Expense line. Line total = amount (price) × qty.
export type ExpenseUnit = 'item' | 'hour' | 'day';

export interface BudgetLine {
	id: string;
	label: string;
	amount: number; // price per unit (USD)
	enabled?: boolean;
	qty?: number; // Other Expenses — defaults to 1
	unit?: ExpenseUnit; // Other Expenses — 'item' (default) | 'hour' | 'day'
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
	indoor_outdoor?: 'indoor' | 'outdoor' | '';
	venue_type?: 'Concert Hall' | 'Theatre' | 'Festival' | 'Club' | 'Other' | '';
	venue_type_custom?: string;
	wifi_enabled?: boolean;
	wifi_login?: string;
	wifi_password?: string;
	shower?: boolean;
	green_room?: boolean;
	green_room_count?: number;
	green_rooms?: GreenRoom[];
	green_room_is_custom?: boolean; // bypass auto-assignment
	notes_enabled?: boolean;
	notes?: string;
}

export interface LocalCrewItem {
	id: string;
	qty: number;
	role: string;
}

// Three-state status used for Elevator / Forklift / Rig (and any future
// yes/no/tbd field). Stored verbatim in the DB (jsonb):
//   null  = TBD       (not yet determined — default)
//   true  = YES        (confirmed available)
//   false = NO         (confirmed unavailable / problem)
export type TriState = boolean | null;

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
	elevator?: TriState;
	forklift?: TriState;
	rigging?: TriState;
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
	section?: TracklistSection; // 'main' | 'encore' — defaults to 'main'
	is_encore_break?: boolean; // legacy marker row — migrated to `section` on load
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
	type?: string;   // Pickup / Dropoff / Shuttle / Flight / Train / Other
	date?: string;
	name: string;    // pax name(s)
	from?: string;
	to?: string;
	how?: string;    // driver
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
	// Structured per-role hospitality riders — mirrors Settings `riders`,
	// so the show picker reuses the same catalog/qty/custom behaviour.
	hospo?: Partial<Record<TourRole, RoleRider>>;

	// @deprecated legacy flat lists — no longer written by the UI
	artist_hospo?: string[];
	prod_hospo?: string[];
	singer_hospo?: Record<string, string[]>;

	meal_mode?: 'uber' | 'catering' | 'restaurant' | 'other';
	meal_notes?: string;
	transports?: TransportRow[];
	guestlist_allocation?: { GA?: number; VIP?: number; AA?: number };
	guestlist?: GuestlistEntry[];
}

export interface MerchCountItem {
	item: string;
	price: number;
	in?: Record<string, number>;   // qty in, per size
	out?: Record<string, number>;  // qty out, per size
	qty_in?: number;               // @deprecated legacy — migrated to in['ALL'] on load
	qty_out?: number;              // @deprecated legacy — migrated to out['ALL'] on load
}

export interface MerchData {
	enabled?: boolean;
	delivery?: boolean;
	delivery_restrictions?: string;
	tracking_info?: string;
	seller_name?: string;
	seller_contact?: string;
	seller_rate?: number;
	venue_pct?: number;
	sizes?: string[];              // shared size columns for the counts grid
	counts?: MerchCountItem[];
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

export interface MediaBrief {
	enabled?: boolean;       // card on/off (off by default)
	link_received?: boolean; // off by default
	link?: string;           // required to progress only when link_received is on
	notes?: string;          // brief notes — never required
}

export interface MediaData {
	photographer?: MediaBrief;
	videographer?: MediaBrief;
	interviews_enabled?: boolean;
	interviews?: InterviewRow[];
	meet_greet_enabled?: boolean;
	meet_greets?: InterviewRow[];

	// @deprecated legacy
	photo_link_received?: boolean;
	photo_link?: string;
	brief_sent?: boolean;
	photographer_enabled?: boolean;
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

export interface TodoColumn {
	id: string;
	title: string;
	items: TodoItem[];
}

export interface TodosData {
	columns?: TodoColumn[];
	items?: TodoItem[]; // @deprecated legacy — auto-migrated into columns[0] on first load
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

// Currency a budget section's amounts are entered in. Sections roll up to a
// single USD base for the grid using the fixed usd_cad rate.
export type BudgetCurrency = 'USD' | 'CAD';

export interface TourBudgetItem {
	id: string;
	label: string;
	amount: number;
	hidden?: boolean; // eye-toggle; excluded from section subtotal + fixed-costs pool when true
}

export interface TourBudgetSection {
	id: string;
	name: string; // Solotech, Décors, Transport...
	items: TourBudgetItem[];
	currency?: BudgetCurrency; // 'CAD' (default for legacy/production) | 'USD'
	collapsed?: boolean; // items hidden by default; arrow reveals
}

// One spreadsheet row of the tour budget grid, keyed by tour_date id.
// ALL amounts are stored in USD base (the sheet toggle only affects display).
// capacity/sold are plain counts (not currency, not converted).
export interface TourBudgetGridRow {
	artist_fee?: number; // revenue (+)
	prod_buyout?: number; // revenue (+)
	salaries?: number; // expense (-)
	flights?: number; // expense (-)
	hotels?: number; // expense (-)
	per_diem?: number; // expense (-)
	transports?: number; // expense (-)
	other?: number; // expense (-)
	merch_revenue?: number; // revenue (+)
	capacity?: number; // count
	sold?: number; // count
}

export interface TourBudget {
	target_per_show?: number; // GOAL per show, in CAD (default 15000)
	sections?: TourBudgetSection[]; // expense pool → "Fixed Costs" per show
	grid?: Record<string, TourBudgetGridRow>; // per Tour Date id; values in USD base

	// @deprecated legacy separate lists — migrated into `sections` on first load
	bus?: TourBudgetItem[];
	preproduction?: TourBudgetItem[];
}