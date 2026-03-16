export type EventStatus = 'HOLD' | 'CONFIRMED' | 'PENDING' | 'CANCELED' | 'HIDDEN';
export type HoldLevel =
	| 'P'
	| 'H1'
	| 'H2'
	| 'H3'
	| 'H4'
	| 'H5'
	| 'H6'
	| 'H7'
	| 'H8'
	| 'H9'
	| 'H10'
	| 'H11'
	| 'H12'
	| 'H13'
	| 'H14'
	| 'H15'
	| 'H16'
	| 'H17'
	| 'H18'
	| 'H19'
	| 'H20'
	| null;

export type EventType =
	| 'Corpo'
	| 'Bazart Nuits'
	| 'Moet City'
	| 'NCG Show'
	| 'NCG 360'
	| 'DSTRKT'
	| 'Tour Prod'
	| 'Other';

export interface StageConfig {
	name: string;
	capacity: number;
	color: string;
	active: boolean;
}

export interface VenueSettings {
	id: string;
	setting_name: string;
	setting_type: string;
	setting_params: {
		location: {
			street: string;
			line2: string;
			city: string;
			state: string;
			zip: string;
			country: string;
		};
		timezone: string;
		logoUrl: string;
		financials: {
			taxRate: number;
			taxType: 'Divisor' | 'Multiplier';
			currency: string;
			convertToUsd: boolean;
			facilityFee: number;
		};
		holdSettings: {
			defaultHoldLevel: HoldLevel;
			autoPromote: boolean;
		};
		stages: StageConfig[];
	};
}

export interface CalendarEvent {
	id: string;
	creator_name?: string;
	short_id?: number;
	group_id?: string;
	title: string;
	date: string;
	status: EventStatus;
	hold_level?: HoldLevel;
	venue: {
		category: string | null;
		room: string | null;
	};
	time: {
		start: string | null;
		end: string | null;
	};
	// 🚀 UPDATED: Removed artist info from details
	details: {
		notes: string | null;
		type: EventType | string | null;
		is_priority?: boolean;
	};
	// 🚀 UPDATED: Removed the `| null` from the end since it will always be an object now
    event_deal?: {
        headliner_name: string | null;
        headliner_id: string | null;
        headliner_pic: string | null;
    };
	event_revenue?: any;
	event_cost?: any;
	event_details?: {
		is_challenge?: boolean;
		is_target?: boolean;
	};
	isDraft?: boolean;
	isNewDraft?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface CalendarDay {
	date: Date;
	dayNumber: number;
	isCurrentMonth: boolean;
	isToday: boolean;
	events: CalendarEvent[];
	holds: CalendarEvent[];
}

export interface GroupedEvents {
	[date: string]: {
		dateObj: Date;
		events: CalendarEvent[];
	};
}

export type DealRole = 'Headliner' | 'Support';
export type DealTypeOption = 'Flat' | 'Door Deal' | 'Plus' | 'Versus';
export type DepositType = 'Percent' | 'Flat';
export type DueDateType = 'Relative' | 'Specific';

export interface ExchangeRateData {
	rate: number;
	targetCurrency: string; // e.g., 'CAD'
	dateFetched: string; // ISO string
}

export interface Deposit {
	id: string;
	type: DepositType;
	amount: number; // Stored as a flat number or percentage
	dueDateType: DueDateType;
	daysBeforeEvent?: number;
	specificDate?: string;
}

export interface Deal {
	id: string;
	artistName: string;
	role: DealRole;
	dealType: DealTypeOption;
	guaranteeUsd: number; // Always store the USD base amount
	deposits: Deposit[];
	description: string;
	exchangeData?: ExchangeRateData; // Snapshot of the rate when created/updated
}

export interface EventDealData {
	deals: Deal[];
	// Future expansion: runOfShowItems: any[];
}
