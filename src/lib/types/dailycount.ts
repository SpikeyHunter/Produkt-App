export interface DailyCount {
	id: string;
	report_date: string;
	report_generated_at: string;
	event_id: number;
	ga: number;
	vip: number;
	total: number;
	ga_yesterday: number;
	vip_yesterday: number;
	total_yesterday: number;
}

export interface EventData {
	event_id: number;
	event_name: string;
	event_date: string;
	event_status: 'LIVE' | 'PAST';
	event_flyer: string;
	event_venue: string;
	stage_type?: any;
	color?: string; 
	pinned?: boolean;
}