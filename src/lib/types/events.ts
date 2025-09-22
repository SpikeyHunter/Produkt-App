// src/lib/types/events.ts
// Shared event-related interfaces to avoid duplication

/**
 * Defines a guest in the hotel rooming list
 */
export interface RoomingGuest {
	guest_name: string;
	room_type: string;
}

/**
 * Defines the structure for hotel booking information
 */
export interface HotelInfo {
	hotel_name: string;
	address: string;
	check_in_date: string;
	check_out_date: string;
	booking_confirmation: string;
	rooming_list: RoomingGuest[];
}

/**
 * Defines the structure for the immigration_info JSON object
 */
export interface ImmigrationInfo {
	letterType: 'Promoter Letter' | 'IMM5686E' | '';
	promoter: {
		visaRequired: boolean;
		visaNumber: string;
		letterFilled: boolean;
		letterSent: boolean;
	};
	imm5686e: {
		immigrationSent: boolean;
		letterReceived: boolean;
		letterSent: boolean;
	};
}

// --- Production Rider Type Definitions ---

export interface OtherRequest {
	id: string;
	text: string;
}

export interface EquipmentItem {
	selected: boolean;
	qty?: number;
	editableQty?: boolean;
}

export interface EquipmentMap {
	[key: string]: EquipmentItem;
}

export interface TechRiderInfo {
	selected_mixer: string;
	equipment: EquipmentMap;
	other: OtherRequest[];
}

export interface SfxItem {
	enabled: boolean;
	duration?: number;
	qty: number;
}

export interface SfxRiderInfo {
	cryo_jets: SfxItem;
	sparkulars: SfxItem;
	lasers: SfxItem;
	other: OtherRequest[];
}

/**
 * Soundcheck information interface
 */
export interface SoundcheckInfo {
	enabled: boolean;
	start_time: string;
	end_time: string;
}

// --- Hospitality Rider Type Definitions ---

export interface HospoItem {
	selected: boolean;
	qty?: number;
}

export interface HospoSpirits {
	[key: string]: HospoItem;
}

export interface HospoBeersWine {
	beers: { [key: string]: HospoItem };
	wine: string; // Custom text field
}

export interface HospoDrinks {
	[key: string]: HospoItem;
}

export interface HospoBase {
	regular_drinks: boolean;
	regular_snacks: boolean;
}

export interface HospoRiderInfo {
	spirits: HospoSpirits;
	beers_wine: HospoBeersWine;
	other_drinks: HospoDrinks;
	base: HospoBase;
	custom_requests: OtherRequest[];
	custom_rider_text?: string; // For custom rider modal content
}

/**
 * Base EventAdvance interface matching database schema
 */
export interface EventAdvanceBase {
	id: number;
	event_id: number;
	artist_name: string;
	artist_type?: string | null;
	dos?: string | null;
	main_contact?: string | null;
	contract_url?: string | null;
	roles?: string | null;
	passport_info?: string | null;
	hotel_info?: HotelInfo | null;
	immigration_info?: ImmigrationInfo | string | null;
	tech_rider?: TechRiderInfo | string | null;
	sfx_rider?: SfxRiderInfo | string | null;
	soundcheck?: SoundcheckInfo | string | null;
	hospo_rider?: HospoRiderInfo | string | null; // Added hospo_rider
	ground_transport?: any | null;
	ground_info?: any | null;
	advance_completed: boolean;
	asked: boolean;
	contract: boolean;
	role_list: boolean;
	ground_done?: boolean;
	created_at: string;
	updated_at: string;
}

/**
 * EventAdvance interface for UI components with additional computed fields
 */
export interface EventAdvance extends Omit<EventAdvanceBase, 'id'> {
	[key: string]: any;
	id: string; // This is a composite key for the UI: event_id-artist_name
	name: string;
	date: string;
	progress: number;
	poster: string | null;
	tags: string[];
	event_flyer?: string | null;
	event_name?: string;
	event_date?: string;
	event_artist?: string;
	event_status?: string;
	event_genre?: string;
	event_tags?: string[];
}

/**
 * Event data from the events table
 */
export interface Event {
	event_id: number;
	event_name: string;
	event_date: string;
	event_artist: string;
	event_status: string;
	event_genre: string;
	event_flyer?: string | null;
	event_tags?: string[];
}

/**
 * Person object for roles JSON
 */
export interface Person {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
	customRole?: string;
	immigration?: boolean;
	showDropdown?: boolean;
}

/**
 * Passport information interface
 */
export interface PassportInfo {
	id: string;
	givenName: string;
	lastName: string;
	dateOfBirth: string;
	country: string;
	passportNumber: string;
	passportImageUrl?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}