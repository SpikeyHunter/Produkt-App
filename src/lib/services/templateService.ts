// templateService.ts
// CRUD for reusable event templates stored in calendar_settings:
//   - Cost templates  (setting_type 'COST_TEMPLATE'):  { fixedCosts, variableCosts }
//   - T&C templates   (setting_type 'TC_TEMPLATE'):    { content, isDefault }
// Same table/shape convention as VENUE settings (setting_name / setting_type /
// setting_params), so they show up alongside the existing settings rows.

import { supabase } from '$lib/supabase';

export interface CostTemplateLine {
	id: string;
	name: string;
	qty: number;
	cost: number;
	// Optional Costs-tab fields carried by event templates (legacy templates omit them).
	estimatedInternal?: number;
	internalNotes?: string;
	externalNotes?: string;
	reported?: boolean;
}

export interface CostTemplateGroup {
	id: string;
	category: string; // General | Production | Marketing | Talent | Sponsor | Additional
	type: string;
	costs: CostTemplateLine[];
}

export interface CostTemplateVariable {
	id: string;
	name: string;
	type: string; // Flat | % of Gross | % of Net Gross | $ per Paid Ticket | $ per Attendee
	amount: number;
}

export interface CostTemplate {
	id: string | null; // calendar_settings row id (null = unsaved)
	name: string;
	fixedCosts: CostTemplateGroup[];
	variableCosts: CostTemplateVariable[];
}

export type TextTemplateCategory = 'Additional Terms and Conditions' | 'Deal Terms';

// Runtime list of event types (mirrors the EventType union / calendar settings).
export const EVENT_TYPE_OPTIONS = [
	'Corpo',
	'Bazart Nuits',
	'Moet City',
	'NCG Show',
	'NCG 360',
	'DSTRKT',
	'Tour Prod',
	'Other'
] as const;

export interface TcTemplate {
	id: string | null;
	name: string;
	category: TextTemplateCategory;
	content: string; // HTML (rich text) or plain text (legacy)
	isDefault: boolean; // default within its category (Additional T&C only)
	// Deal Terms only: event types this template is the default for.
	eventTypes: string[];
}

/** Reads the event's type ("NCG 360", "Bazart Nuits", ...) from its details. */
export function eventTypeOf(event: any): string | null {
	const raw = event?.calendar?.details || event?.details;
	if (!raw) return null;
	try {
		const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
		return d?.type || null;
	} catch {
		return null;
	}
}

// Every event template carries ALL categories (any may be empty) so a single
// template can seed a whole event. New categories slot in here later.
export const EVENT_TEMPLATE_CATEGORIES = [
	'Fixed Costs',
	'Variable Costs',
	'Ticket Scaling'
] as const;
export type EventTemplateCategory = (typeof EVENT_TEMPLATE_CATEGORIES)[number];

export interface TicketTemplateRow {
	id: string;
	name: string;
	allotment: number;
	comps: number;
	kills: number;
	price: number;
	estSold: number;
}

/** Per-section apply behavior: true = template rows are ADDED to the event's
 *  existing data; false = they OVERWRITE (replace) that section. */
export interface EventTemplateAddMode {
	fixed: boolean;
	variable: boolean;
	tickets: boolean;
}

export interface EventTemplate {
	id: string | null;
	name: string;
	fixedCosts: CostTemplateGroup[];
	variableCosts: CostTemplateVariable[];
	tickets: TicketTemplateRow[];
	addMode: EventTemplateAddMode;
}

export function normalizeAddMode(raw: any): EventTemplateAddMode {
	return {
		fixed: raw?.fixed !== false,
		variable: raw?.variable !== false,
		tickets: raw?.tickets !== false
	};
}

/** True when the template has content for the given category. */
export function templateCategoryHasContent(
	t: EventTemplate,
	category: EventTemplateCategory
): boolean {
	if (category === 'Fixed Costs') return t.fixedCosts.some((g) => g.costs.length > 0);
	if (category === 'Variable Costs') return t.variableCosts.length > 0;
	if (category === 'Ticket Scaling') return t.tickets.length > 0;
	return false;
}

const COST_TYPE = 'COST_TEMPLATE'; // legacy combined fixed+variable templates
const TC_TYPE = 'TC_TEMPLATE';
const EVENT_TYPE = 'EVENT_TEMPLATE';

function parseParams(raw: any): any {
	if (!raw) return {};
	if (typeof raw === 'object') return raw;
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

// ---------------------------------------------------------------------------
// Cost templates
// ---------------------------------------------------------------------------

export async function listCostTemplates(): Promise<CostTemplate[]> {
	const { data, error } = await supabase
		.from('calendar_settings')
		.select('id, setting_name, setting_params')
		.eq('setting_type', COST_TYPE)
		.order('setting_name', { ascending: true });
	if (error) {
		console.error('❌ [templates] Failed to list cost templates:', error);
		return [];
	}
	return (data || []).map((row) => {
		const p = parseParams(row.setting_params);
		return {
			id: row.id,
			name: row.setting_name,
			fixedCosts: Array.isArray(p.fixedCosts) ? p.fixedCosts : [],
			variableCosts: Array.isArray(p.variableCosts) ? p.variableCosts : []
		};
	});
}

export async function saveCostTemplate(tpl: CostTemplate): Promise<string | null> {
	const payload = {
		setting_name: tpl.name,
		setting_type: COST_TYPE,
		setting_params: { fixedCosts: tpl.fixedCosts, variableCosts: tpl.variableCosts }
	};
	if (tpl.id) {
		const { error } = await supabase.from('calendar_settings').update(payload).eq('id', tpl.id);
		if (error) {
			console.error('❌ [templates] Failed to update cost template:', error);
			return null;
		}
		return tpl.id;
	}
	const { data, error } = await supabase
		.from('calendar_settings')
		.insert([payload])
		.select('id')
		.single();
	if (error) {
		console.error('❌ [templates] Failed to create cost template:', error);
		return null;
	}
	return data?.id ?? null;
}

export async function deleteTemplate(id: string): Promise<boolean> {
	const { error } = await supabase.from('calendar_settings').delete().eq('id', id);
	if (error) {
		console.error('❌ [templates] Failed to delete template:', error);
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// T&C templates
// ---------------------------------------------------------------------------

export async function listTcTemplates(): Promise<TcTemplate[]> {
	const { data, error } = await supabase
		.from('calendar_settings')
		.select('id, setting_name, setting_params')
		.eq('setting_type', TC_TYPE)
		.order('setting_name', { ascending: true });
	if (error) {
		console.error('❌ [templates] Failed to list T&C templates:', error);
		return [];
	}
	return (data || []).map((row) => {
		const p = parseParams(row.setting_params);
		return {
			id: row.id,
			name: row.setting_name,
			category: (p.category === 'Deal Terms'
				? 'Deal Terms'
				: 'Additional Terms and Conditions') as TextTemplateCategory,
			content: p.content || '',
			isDefault: p.isDefault === true,
			eventTypes: Array.isArray(p.eventTypes) ? p.eventTypes : []
		};
	});
}

export async function saveTcTemplate(tpl: TcTemplate): Promise<string | null> {
	const payload = {
		setting_name: tpl.name,
		setting_type: TC_TYPE,
		setting_params: {
			content: tpl.content,
			category: tpl.category || 'Additional Terms and Conditions',
			isDefault: tpl.isDefault === true,
			eventTypes: Array.isArray(tpl.eventTypes) ? tpl.eventTypes : []
		}
	};
	if (tpl.id) {
		const { error } = await supabase.from('calendar_settings').update(payload).eq('id', tpl.id);
		if (error) {
			console.error('❌ [templates] Failed to update T&C template:', error);
			return null;
		}
		return tpl.id;
	}
	const { data, error } = await supabase
		.from('calendar_settings')
		.insert([payload])
		.select('id')
		.single();
	if (error) {
		console.error('❌ [templates] Failed to create T&C template:', error);
		return null;
	}
	return data?.id ?? null;
}

/** Marks one text template as default within its category, clearing others. */
export async function setDefaultTcTemplate(id: string): Promise<boolean> {
	const all = await listTcTemplates();
	const target = all.find((t) => t.id === id);
	if (!target) return false;
	for (const t of all) {
		if (t.category !== target.category) continue;
		const shouldBeDefault = t.id === id;
		if (t.isDefault !== shouldBeDefault) {
			await saveTcTemplate({ ...t, isDefault: shouldBeDefault });
		}
	}
	return true;
}

export async function getDefaultTcTemplate(
	category: TextTemplateCategory = 'Additional Terms and Conditions',
	eventType?: string | null
): Promise<TcTemplate | null> {
	const all = (await listTcTemplates()).filter((t) => t.category === category);
	// Deal Terms resolve by the event's type first (e.g. a "Bazart Nuits" event
	// picks the Deal Terms template associated with that type).
	if (category === 'Deal Terms' && eventType) {
		const match = all.find((t) => (t.eventTypes || []).includes(eventType));
		if (match) return match;
	}
	return all.find((t) => t.isDefault) || all[0] || null;
}

// ---------------------------------------------------------------------------
// Event templates (Fixed Costs / Variable Costs / Ticket Scaling)
// ---------------------------------------------------------------------------

export async function listEventTemplates(): Promise<EventTemplate[]> {
	const { data, error } = await supabase
		.from('calendar_settings')
		.select('id, setting_name, setting_params')
		.eq('setting_type', EVENT_TYPE)
		.order('setting_name', { ascending: true });
	if (error) {
		console.error('❌ [templates] Failed to list event templates:', error);
		return [];
	}
	const rows: EventTemplate[] = (data || []).map((row) => {
		const p = parseParams(row.setting_params);
		return {
			id: row.id,
			name: row.setting_name,
			fixedCosts: Array.isArray(p.fixedCosts) ? p.fixedCosts : [],
			variableCosts: Array.isArray(p.variableCosts) ? p.variableCosts : [],
			tickets: Array.isArray(p.tickets) ? p.tickets : [],
			addMode: normalizeAddMode(p.addMode)
		};
	});

	// Legacy combined cost templates keep working as combined templates.
	const legacy = await listCostTemplates();
	for (const t of legacy) {
		rows.push({
			id: t.id,
			name: t.name,
			fixedCosts: t.fixedCosts,
			variableCosts: t.variableCosts,
			tickets: [],
			addMode: normalizeAddMode(null)
		});
	}
	return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveEventTemplate(tpl: EventTemplate): Promise<string | null> {
	const payload = {
		setting_name: tpl.name,
		setting_type: EVENT_TYPE,
		setting_params: {
			fixedCosts: tpl.fixedCosts,
			variableCosts: tpl.variableCosts,
			tickets: tpl.tickets,
			addMode: normalizeAddMode(tpl.addMode)
		}
	};
	if (tpl.id) {
		const { error } = await supabase.from('calendar_settings').update(payload).eq('id', tpl.id);
		if (error) {
			console.error('❌ [templates] Failed to update event template:', error);
			return null;
		}
		return tpl.id;
	}
	const { data, error } = await supabase
		.from('calendar_settings')
		.insert([payload])
		.select('id')
		.single();
	if (error) {
		console.error('❌ [templates] Failed to create event template:', error);
		return null;
	}
	return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Offer event defaults (Settings modal > Event Details): shared values that
// print on every offer sheet, stored once in calendar_settings (CONFIG row).
// ---------------------------------------------------------------------------

const OFFER_DEFAULTS_NAME = 'Offer Event Details';

export interface OfferEventDefaults {
	ageLimit: string; // "18+" unless changed
	offerExpiryDays: number; // 14 unless changed
}

export async function getOfferEventDefaults(): Promise<OfferEventDefaults> {
	const { data } = await supabase
		.from('calendar_settings')
		.select('setting_params')
		.eq('setting_type', 'CONFIG')
		.eq('setting_name', OFFER_DEFAULTS_NAME)
		.maybeSingle();
	const p = parseParams(data?.setting_params);
	return {
		ageLimit: p.ageLimit || '18+',
		offerExpiryDays: Number(p.offerExpiryDays) > 0 ? Number(p.offerExpiryDays) : 14
	};
}

export async function saveOfferEventDefaults(defaults: OfferEventDefaults): Promise<boolean> {
	const { data } = await supabase
		.from('calendar_settings')
		.select('id')
		.eq('setting_type', 'CONFIG')
		.eq('setting_name', OFFER_DEFAULTS_NAME)
		.maybeSingle();
	const payload = {
		setting_name: OFFER_DEFAULTS_NAME,
		setting_type: 'CONFIG',
		setting_params: {
			ageLimit: defaults.ageLimit || '18+',
			offerExpiryDays: Number(defaults.offerExpiryDays) > 0 ? Number(defaults.offerExpiryDays) : 14
		}
	};
	const { error } = data?.id
		? await supabase.from('calendar_settings').update(payload).eq('id', data.id)
		: await supabase.from('calendar_settings').insert([payload]);
	if (error) {
		console.error('❌ [templates] Failed to save offer event defaults:', error);
		return false;
	}
	return true;
}
