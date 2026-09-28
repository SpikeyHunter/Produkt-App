// src/lib/services/emailSettingsService.ts
//
// Settings > General > Emails. Everything the tech / VJ emails used to hard-
// code — subject line, CC/BCC, crew-call defaults, the lights and lounge option
// lists — lives in one calendar_settings CONFIG row and is editable from the
// Settings page. Loaded once into a store so every section reads the same copy.

import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { EmailFormat } from '$lib/types/emailtech';

const SETTING_NAME = 'Email Settings';

export interface LightColorOption {
	label: string;
	hex: string;
}
export interface LightRowOption {
	label: string;
	timeOptions: string[];
	/** single: one colour · dual: two colours · dynamic: two when the time has "&" · fixed_single: no time */
	mode: 'single' | 'dynamic' | 'dual' | 'fixed_single';
	allowBazart: boolean;
}

export interface EmailSettings {
	/** default body format for a new email */
	format: EmailFormat;
	tech: { subject: string; cc: string[]; bcc: string[] };
	vj: { subject: string; cc: string[]; bcc: string[] };
	/** who is added automatically on top of the CC/BCC lists */
	autoPeople: {
		/** crew assigned on the event -> To */
		crewTo: boolean;
		/** artist liaison(s) from the advance (events_advance.dos) -> CC */
		liaisonCc: boolean;
	};
	crewCall: {
		/** default first call (techs) when nothing better is known */
		techTime: string;
		/** default VJ call */
		vjTime: string;
		/** crew call = first soundcheck start − this many minutes */
		soundcheckOffsetMin: number;
		/** use the soundcheck rule at all */
		useSoundcheck: boolean;
	};
	lights: {
		colors: LightColorOption[];
		rows: LightRowOption[];
	};
	lounge: {
		backSide: string[];
		back: string[];
		lounge: string[];
	};
	/** stage specs offered in Projects & Specs ("Other" is always added) */
	specs: { label: string; url: string; color: string }[];
}

/** Tokens usable in a subject line. */
export const SUBJECT_TOKENS: { token: string; help: string }[] = [
	{ token: '{events}', help: 'All linked event names, "A / B"' },
	{ token: '{event}', help: 'Main event name' },
	{ token: '{artist}', help: 'Main artist' },
	{ token: '{date}', help: 'September 25, 2026' },
	{ token: '{date_short}', help: '25-Sep-2026' },
	{ token: '{weekday}', help: 'Friday' },
	{ token: '{venue}', help: 'Venue name' },
	{ token: '{liaison}', help: 'Liaison first name(s)' },
	{ token: '{vj}', help: 'VJ first name' }
];

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
	format: 'html',
	tech: {
		subject: '{events} | Set times + tech riders > {date}',
		cc: ['danny@produkt.ca', 'e.nlamoureux@onedot.ca', 'smorrisson@hqaudio.ca', 'fchampagne@hqaudio.ca'],
		bcc: []
	},
	vj: {
		subject: '{vj} VJ > {events} > {date}',
		cc: ['danny@produkt.ca'],
		bcc: []
	},
	autoPeople: { crewTo: true, liaisonCc: true },
	crewCall: { techTime: '19:00', vjTime: '21:00', soundcheckOffsetMin: 60, useSoundcheck: true },
	lights: {
		// Hex values now match their names (Blue and Purple were swapped, and
		// Gold shared a swatch with Bazart Colors).
		colors: [
			{ label: 'Bazart Colors', hex: '#ffe089' },
			{ label: 'Green', hex: '#86EFAC' },
			{ label: 'Gold', hex: '#D4A017' },
			{ label: 'Orange', hex: '#FDBA74' },
			{ label: 'Red', hex: '#FCA5A5' },
			{ label: 'Blue', hex: '#93c5fd' },
			{ label: 'Cyan', hex: '#22d3ee' },
			{ label: 'Purple', hex: '#c4b5fd' },
			{ label: 'Yellow', hex: '#fef08a' },
			{ label: 'Pink', hex: '#f9a8d4' }
		],
		rows: [
			{ label: 'Niveau 1/Terrace', timeOptions: ['N/A', '5PM-3AM'], mode: 'single', allowBazart: true },
			{ label: 'Lounge', timeOptions: ['5PM-3AM', '5PM & 10PM'], mode: 'dynamic', allowBazart: true },
			{ label: 'Facade', timeOptions: ['7PM & 9PM', '5PM & 10PM'], mode: 'dual', allowBazart: true },
			{ label: 'Main Room', timeOptions: [], mode: 'fixed_single', allowBazart: false },
			{ label: 'Laser GA', timeOptions: ['10PM', '9PM'], mode: 'single', allowBazart: false }
		]
	},
	lounge: {
		backSide: [
			'No Music',
			'5PM to Close - Playlist',
			'5PM - Playlist & 12AM - Bazart Music',
			'5PM - Playlist & 12AM - Main Room Music'
		],
		back: ['No Music', '10PM - Main Room Music (ambiance/not too loud)'],
		lounge: [
			'No Music',
			'5PM - Playlist & 10PM - Bazart Music',
			'5PM - Playlist & 12AM - Main Room Music (when Bazart closed)'
		]
	},
	specs: [
		{ label: 'Main Stage #1', url: 'https://link.produkt.ca/prod-mainstage-1', color: '#c4ef9b' },
		{ label: 'Main Stage #2', url: 'https://link.produkt.ca/prod-mainstage-2', color: '#c4ef9b' },
		{ label: 'DSTRKT', url: 'https://link.produkt.ca/prod-dstrkt', color: '#afd3e9' },
		{ label: 'DSTRKT Hybrid', url: 'https://link.produkt.ca/prod-dstrkt-hybrid', color: '#afd3e9' },
		{ label: 'Live/Corpo (empty)', url: 'https://link.produkt.ca/prod-livecorpo', color: '#d7b8e8' },
		{ label: 'NCG360', url: 'https://link.produkt.ca/prod-360', color: '#fa7a90' },
		{ label: 'NCG360 Hybrid', url: 'https://link.produkt.ca/prod-360-hybrid', color: '#fa7a90' },
		{ label: 'Bazart', url: 'https://link.produkt.ca/prod-bazart', color: '#ffe089' }
	]
};

/** Colour for a spec saved before colours existed (matched by name). */
function specColorFor(label: string): string {
	const u = label.toUpperCase().replace(/\s/g, '');
	if (u.includes('BAZART')) return '#ffe089';
	if (u.includes('DSTRKT')) return '#afd3e9';
	if (u.includes('360')) return '#fa7a90';
	if (u.includes('CORPO') || u.includes('LIVE')) return '#d7b8e8';
	if (u.includes('MAIN') || u.includes('NCG')) return '#c4ef9b';
	return '#9ca3af';
}

/** Live copy for components. Starts at the defaults, replaced once loaded. */
export const emailSettings = writable<EmailSettings>(clone(DEFAULT_EMAIL_SETTINGS));
let loaded = false;
let loadingPromise: Promise<EmailSettings> | null = null;

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v));
}

const cleanList = (v: any): string[] =>
	(Array.isArray(v) ? v : String(v || '').split(/[,\n;]/))
		.map((s: any) => String(s).trim())
		.filter((s: string) => s.length > 0);

/** Fill any missing piece from the defaults so old rows keep working. */
export function normalizeEmailSettings(raw: any): EmailSettings {
	const d = clone(DEFAULT_EMAIL_SETTINGS);
	const p = raw && typeof raw === 'object' ? raw : {};
	return {
		format: p.format === 'text' ? 'text' : 'html',
		tech: {
			subject: p.tech?.subject || d.tech.subject,
			cc: p.tech?.cc !== undefined ? cleanList(p.tech.cc) : d.tech.cc,
			bcc: p.tech?.bcc !== undefined ? cleanList(p.tech.bcc) : d.tech.bcc
		},
		vj: {
			subject: p.vj?.subject || d.vj.subject,
			cc: p.vj?.cc !== undefined ? cleanList(p.vj.cc) : d.vj.cc,
			bcc: p.vj?.bcc !== undefined ? cleanList(p.vj.bcc) : d.vj.bcc
		},
		autoPeople: {
			crewTo: p.autoPeople?.crewTo !== false,
			liaisonCc: p.autoPeople?.liaisonCc !== false
		},
		crewCall: {
			techTime: p.crewCall?.techTime || d.crewCall.techTime,
			vjTime: p.crewCall?.vjTime || d.crewCall.vjTime,
			soundcheckOffsetMin:
				Number.isFinite(Number(p.crewCall?.soundcheckOffsetMin))
					? Number(p.crewCall.soundcheckOffsetMin)
					: d.crewCall.soundcheckOffsetMin,
			useSoundcheck: p.crewCall?.useSoundcheck !== false
		},
		lights: {
			colors:
				Array.isArray(p.lights?.colors) && p.lights.colors.length
					? p.lights.colors
							.map((c: any) => ({ label: String(c.label || '').trim(), hex: String(c.hex || '').trim() }))
							.filter((c: LightColorOption) => c.label)
					: d.lights.colors,
			rows:
				Array.isArray(p.lights?.rows) && p.lights.rows.length
					? p.lights.rows.map((r: any) => ({
							label: String(r.label || '').trim(),
							timeOptions: cleanList(r.timeOptions),
							mode: ['single', 'dynamic', 'dual', 'fixed_single'].includes(r.mode) ? r.mode : 'single',
							allowBazart: r.allowBazart !== false
						}))
					: d.lights.rows
		},
		lounge: {
			backSide: p.lounge?.backSide !== undefined ? cleanList(p.lounge.backSide) : d.lounge.backSide,
			back: p.lounge?.back !== undefined ? cleanList(p.lounge.back) : d.lounge.back,
			lounge: p.lounge?.lounge !== undefined ? cleanList(p.lounge.lounge) : d.lounge.lounge
		},
		specs: Array.isArray(p.specs)
			? p.specs
					.map((x: any) => ({
						label: String(x.label || '').trim(),
						url: String(x.url || '').trim(),
						color: /^#[0-9a-f]{6}$/i.test(String(x.color || '')) ? String(x.color) : specColorFor(String(x.label || ''))
					}))
					.filter((x: { label: string }) => x.label)
			: d.specs
	};
}

function parseParams(raw: any): any {
	if (!raw) return {};
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}
	return raw;
}

/** Load once (cached). Safe to call from every component that needs it. */
export async function loadEmailSettings(force = false): Promise<EmailSettings> {
	if (loaded && !force) return get(emailSettings);
	if (loadingPromise && !force) return loadingPromise;
	loadingPromise = (async () => {
		try {
			const { data } = await supabase
				.from('calendar_settings')
				.select('setting_params')
				.eq('setting_type', 'CONFIG')
				.eq('setting_name', SETTING_NAME)
				.maybeSingle();
			const s = normalizeEmailSettings(parseParams(data?.setting_params));
			emailSettings.set(s);
			loaded = true;
			return s;
		} catch (err) {
			console.error('[email settings] load failed, using defaults:', err);
			return get(emailSettings);
		} finally {
			loadingPromise = null;
		}
	})();
	return loadingPromise;
}

export async function saveEmailSettings(next: EmailSettings): Promise<boolean> {
	const s = normalizeEmailSettings(next);
	try {
		const { data } = await supabase
			.from('calendar_settings')
			.select('id')
			.eq('setting_type', 'CONFIG')
			.eq('setting_name', SETTING_NAME)
			.maybeSingle();
		const payload = { setting_name: SETTING_NAME, setting_type: 'CONFIG', setting_params: s };
		const { error } = data?.id
			? await supabase.from('calendar_settings').update(payload).eq('id', data.id)
			: await supabase.from('calendar_settings').insert([payload]);
		if (error) throw error;
		emailSettings.set(s);
		loaded = true;
		return true;
	} catch (err) {
		console.error('[email settings] save failed:', err);
		return false;
	}
}

/* ---------------------------------------------------------- subject lines */

export interface SubjectContext {
	events: string;
	event: string;
	artist: string;
	date: string;
	date_short: string;
	weekday: string;
	venue: string;
	liaison: string;
	vj: string;
}

/** Replace every {token}; unknown tokens are left visible so typos show. */
export function renderSubject(format: string, ctx: SubjectContext): string {
	return (format || '')
		.replace(/\{(\w+)\}/g, (m, key: string) => {
			const v = (ctx as any)[key];
			return v === undefined || v === null ? m : String(v);
		})
		.replace(/\s{2,}/g, ' ')
		.trim();
}

/** "2026-09-25" -> { long: "September 25, 2026", short: "25-Sep-2026", weekday: "Friday" } */
export function subjectDateParts(dateStr: string | null | undefined) {
	if (!dateStr) return { long: 'TBD', short: 'no-date', weekday: '' };
	const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return { long: String(dateStr), short: String(dateStr), weekday: '' };
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
	return {
		long: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
		short: `${m[3]}-${d.toLocaleString('en-US', { month: 'short' })}-${m[1]}`,
		weekday: d.toLocaleDateString('en-US', { weekday: 'long' })
	};
}

/* ------------------------------------------------------------ crew call */

/** "18:30" − 60 min -> "17:30". Accepts "6:30PM" too. Empty on bad input. */
export function crewCallFromSoundcheck(start: string, offsetMin: number): string {
	const t24 = to24h(start);
	if (!t24) return '';
	const [h, m] = t24.split(':').map(Number);
	let total = h * 60 + m - (Number(offsetMin) || 0);
	total = ((total % 1440) + 1440) % 1440;
	return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function to24h(time: string): string {
	if (!time) return '';
	const s = String(time).trim();
	const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
	if (ampm) {
		let h = Number(ampm[1]) % 12;
		if (ampm[3].toUpperCase() === 'PM') h += 12;
		return `${String(h).padStart(2, '0')}:${ampm[2] || '00'}`;
	}
	const plain = s.match(/^(\d{1,2}):(\d{2})/);
	if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
	return '';
}
