export type DealRole = 'Headliner' | 'Support';
export type DealTypeOption = 'Flat' | 'Door Deal' | 'Plus' | 'Versus';
export type DepositType = 'Percent' | 'Flat';
export type DueDateType = 'Relative' | 'Specific';

export interface Deposit {
	id: string;
	type: DepositType;
	amount: number;
	dueDateType: DueDateType;
	daysBeforeEvent?: number;
	specificDate?: string;
}

export interface DealDescription {
	hotels: {
		enabled: boolean;
		nights: number;
		rooms: number;
		suites: number;
		custom_room: boolean;
		custom_name: string;
		custom_amount: number;
	};
	groundTransport: {
		enabled: boolean;
		notes: string;
	};
	immigration: {
		enabled: boolean;
		notes: string;
	};
	other: {
		enabled: boolean;
		notes: string;
	};
}

export type DealBaseMetric = '% of Net' | '% of Net Gross' | 'Per Ticket' | 'Flat';
export type SplitAfter = 'Costs' | 'Manual Split Point';
export type SwitchAtType = '% Sell Through' | '# Tickets Sold';

export interface DealBonus {
	id: string;
	switchesAt: SwitchAtType;
	bonusAmount: number;
	atAmount: number;
}

export interface DealDetailsInfo {
	metricType: DealBaseMetric;
	metricAmount: number;
	afterType: SplitAfter;
	splitPointAmount: number;
	retroactiveBonusEnabled: boolean;
	retroactiveSwitchesAt: SwitchAtType; 
	retroactiveBonuses: DealBonus[];
	bonuses: DealBonus[];
	capEnabled: boolean;
	capAmount: number;
}