import type { EmailTechEvent, TechEmailForm, TimetableEntry } from '$lib/types/emailtech';
import { normalizeCrew } from '$lib/types/emailtech';
import { get } from 'svelte/store';
import { emailSettings, crewCallFromSoundcheck, to24h } from './emailSettingsService';
import { parseDosNames, sortDosNames } from '$lib/components/settings/AdvanceVariables';

export const techTemplateSections = [
	{ id: 'header', label: 'Header & Liaison' },
	{ id: 'crew_call', label: 'Crew Call' },
	{ id: 'team_notes', label: 'Team Notes' },
	{ id: 'specs', label: 'Venue Specs' },
	{ id: 'projects', label: 'Projects' },
	{ id: 'visuals', label: 'Video & Visuals' },
	{ id: 'set_times', label: 'Set Times' },
	{ id: 'soundcheck', label: 'Soundcheck' },
    { id: 'lounge_ambiance', label: 'Lounge Ambiance' },
	{ id: 'backline', label: 'Backline / Riders' },
	{ id: 'travelling', label: 'Travelling Party' },
	{ id: 'vj_notes', label: 'VJ Notes' },
	{ id: 'vj_visuals', label: 'VJ Content' },
	{ id: 'vj', label: 'VJ Schedule' },
	{ id: 'lights', label: 'Lights Colors' },
	{ id: 'sfx', label: 'SFX' },
	{ id: 'sponsors', label: 'Footer' }
];

export const defaultTechForm: TechEmailForm = {
	visible_sections: {
		header: true,
		crew_call: true,
		team_notes: true,
		specs: true,
		projects: true,
		visuals: true,
		set_times: true,
		soundcheck: true,
        lounge_ambiance: true,
		backline: true,
		travelling: true,
		vj: true,
		lights: true,
		sfx: true,
		sponsors: true,
		vj_notes: false,
		vj_visuals: true
	},
	liaison: '',
	crew_calls: [
		{ time: '', names: '' },
		{ time: '', names: '' }
	],
	team_notes: '',
	vj_notes: '',
	specs_links: [
		{
			label: 'NCG Specs',
			url: 'https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link'
		}
	],
	projects: [],
	projector_outdoor: '',
	visuals_interior: '',
	sponsor_name: 'None',
	sponsor_link: '',
	set_times: [],
	soundcheck: '',
	riders_attached: true,
	backline: [],
	travelling_party: '',
	vj_schedule: '',
	lights: [
		{ area: 'Niveau 1/Terrace', color: '' },
		{ area: 'Lounge', color: '' },
		{ area: 'Facade', color: '' },
		{ area: 'Main Room', color: '' },
		{ area: 'Laser GA', color: '' }
	],
	sfx: '',
	sponsors: '',
	post_show: '',
    
    lounge_ambiance: {
        terrasse_type: null,
        terrasse_option: '',
        terrasse_custom: '',
        lounge_option: '',
        lounge_custom: ''
    }
};

/** Advance rows (every artist) of the given events, from the full list. */
export function advanceRowsFor(events: EmailTechEvent[], allRows: EmailTechEvent[]): EmailTechEvent[] {
	const ids = new Set(events.map((e) => e.event_id));
	const rows = allRows.filter((r) => ids.has(r.event_id));
	// make sure the selected rows themselves are in there
	events.forEach((e) => {
		if (!rows.some((r) => r.id === e.id)) rows.push(e);
	});
	return rows;
}

const normName = (s: string) =>
	String(s || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/**
 * Set times per venue. Entries whose artist is a headliner on the advance
 * (events_advance.artist_type) get `artist_type` so the email highlights
 * them — all of them when there are several.
 */
export function initSetTimes(events: EmailTechEvent[], allRows: EmailTechEvent[] = []) {
	const setTimes: { event_id: number; venue: string; entries: TimetableEntry[] }[] = [];
	const rows = advanceRowsFor(events, allRows);
	const headliners = rows
		.filter((r) => /headliner/i.test(String(r.artist_type || '')))
		.map((r) => ({ event_id: r.event_id, name: normName(r.artist_name) }))
		.filter((h) => h.name);
	const tag = (eventId: number, entry: TimetableEntry): TimetableEntry => {
		const a = normName(entry.artist);
		const hit = headliners.some(
			(h) => h.event_id === eventId && (a === h.name || a.includes(h.name) || h.name.includes(a))
		);
		const t: any = { ...entry };
		if (hit) t.artist_type = 'Headliner';
		else if (t.artist_type && /headliner/i.test(t.artist_type) && headliners.some((h) => h.event_id === eventId)) delete t.artist_type;
		return t;
	};
	events.forEach((evt) => {
		if (evt.timetable) {
			let entries: TimetableEntry[] = [];
			try {
				entries = typeof evt.timetable === 'string' ? JSON.parse(evt.timetable) : evt.timetable;
			} catch (e) {
				console.error('Error parsing timetable', e);
			}
			entries = (Array.isArray(entries) ? entries : []).map((t) => tag(evt.event_id, t));
			let venueLabel =
				evt.event_venue === 'New City Gas'
					? 'Main Room'
					: evt.event_venue === 'Bazart'
						? 'Bazart Lounge'
						: 'Set Times';
			setTimes.push({ event_id: evt.event_id, venue: venueLabel, entries: entries });
		}
	});
	return setTimes;
}

export function autofillTechForm(
	events: EmailTechEvent[],
	currentForm: TechEmailForm,
	allRows: EmailTechEvent[] = []
): TechEmailForm {
	const mainEvent = events[0];
	const existingVisibility = currentForm.visible_sections || defaultTechForm.visible_sections;
    
    // Explicitly define the default object here to satisfy TypeScript
    // (We cannot rely on defaultTechForm.lounge_ambiance alone because TS views it as optional on the Type)
    const defaultLoungeValues = {
        terrasse_type: null as 'back-side' | 'back' | null,
        terrasse_option: '',
        terrasse_custom: '',
        lounge_option: '',
        lounge_custom: ''
    };

    const existingLounge = currentForm.lounge_ambiance || defaultLoungeValues;
    
	const form: TechEmailForm = { 
        ...currentForm, 
        visible_sections: { ...existingVisibility }, 
        lounge_ambiance: { ...existingLounge } 
    };

	const settings = get(emailSettings);

	// Liaison = the advance's DOS (events_advance.dos): "Charles", "Charles
	// and Ben"… Two shows -> each liaison with their room.
	form.liaison = liaisonLine(events);

	const crew = normalizeCrew(mainEvent.crew);
	if (!form.crew_calls_manual) {
		const techs = [
			...(crew.LD || []),
			...(crew.SOUND || []),
			...(crew.TECH || []),
			...(crew.VIDEO || []),
			...(crew.DT || [])
		]
			.map((n) => n.split(' ')[0])
			.filter((n, i, a) => n && a.indexOf(n) === i)
			.join(', ');
		const vjs = (crew.VJ || []).map((n) => n.split(' ')[0]).join(', ');
		form.crew_calls = [
			{ time: techCallTime(events, settings.crewCall, allRows), names: techs },
			{ time: settings.crewCall.vjTime || '21:00', names: vjs }
		];
	}

	const eventNameUpper = (mainEvent.event_name || '').toUpperCase();
	const venue = mainEvent.event_venue || 'New City Gas';
	
	// Stage specs come from Settings (gear on the page). Pick by event name,
	// fall back to the first entry; a spec chosen by hand is kept.
	const specs = settings.specs;
	const pick = (needle: string) => specs.find((x) => x.label.toUpperCase().replace(/\s/g, '').includes(needle));
	let chosen = specs[0];
	if (eventNameUpper.includes('DSTRKT')) chosen = pick('DSTRKT') || chosen;
	else if (eventNameUpper.includes('360')) chosen = pick('360') || chosen;
	else if (venue === 'Bazart' || eventNameUpper.includes('BAZART')) chosen = pick('BAZART') || chosen;
	const current = form.specs_links?.[0];
	const currentIsKnown = current?.label && specs.some((x) => x.label === current.label && x.url === current.url);
	if (chosen && !currentIsKnown && !(current?.label === 'Other' && current.url)) {
		form.specs_links = [{ label: chosen.label, url: chosen.url }];
	}

	if (!form.team_notes) form.team_notes = '@Team';
	form.projects = ['TBD'];
	form.projector_outdoor = '9:30 PM - NCG Logo';
	if (!form.visuals_interior)
		form.visuals_interior =
			'Link: https://link.produkt.ca/ncg-tv\nNCG: Folder #1\nShow Artwork: Folder #3\nPlease remove show artworks at 12:00 AM';

	form.set_times = initSetTimes(events, allRows);
	form.vj_schedule = `10PM-3:00AM: ${(crew.VJ || []).map((n) => n.split(' ')[0]).join(', ') || 'VJ'}`;

	if (!form.lights || form.lights.length === 0)
		form.lights = settings.lights.rows.map((r) => ({ area: r.label, color: '' }));

	const sfxLines = events.filter((e) => e.sfx_rider).map((e) => `${e.artist_name} - SFX`);
	form.sfx = sfxLines.length > 0 ? sfxLines.join('\n') : 'NONE';
	form.post_show = 'Please make sure your work space is clean THANK YOU! :)';

	return form;
}

/* ------------------------------------------------------------- liaison */

const ROOM_OF: Record<string, string> = { 'New City Gas': 'Main Room', Bazart: 'Bazart' };

/** DOS names of one advance row, sorted the way the advance sheet sorts them. */
export function liaisonNamesOf(event: EmailTechEvent | null | undefined): string[] {
	return sortDosNames(parseDosNames(event?.dos));
}

function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] || '';
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * "Charles" · "Charles and Ben" · two shows with different liaisons ->
 * "Charles (Main Room) and Ben (Bazart)".
 */
export function liaisonLine(events: EmailTechEvent[]): string {
	const perEvent = events
		.map((e) => ({ names: liaisonNamesOf(e), room: ROOM_OF[e.event_venue || ''] || e.event_venue || '' }))
		.filter((x) => x.names.length);
	if (!perEvent.length) return '';
	const all = new Set(perEvent.flatMap((x) => x.names));
	const sameEverywhere = perEvent.every((x) => x.names.length === all.size);
	if (perEvent.length === 1 || sameEverywhere) return joinNames(Array.from(all));
	return joinNames(perEvent.map((x) => `${joinNames(x.names)}${x.room ? ` (${x.room})` : ''}`));
}

/* ----------------------------------------------------------- crew call */

/** Earliest soundcheck start across every artist of the events, "HH:MM", or ''. */
export function firstSoundcheckStart(events: EmailTechEvent[], allRows: EmailTechEvent[] = []): string {
	let best = '';
	advanceRowsFor(events, allRows).forEach((e) => {
		let sc: any = e.soundcheck;
		for (let i = 0; i < 3 && typeof sc === 'string'; i++) {
			try {
				sc = JSON.parse(sc);
			} catch {
				sc = null;
			}
		}
		if (!sc || typeof sc !== 'object') return;
		// only a booked soundcheck counts for the crew-call rule
		const status = sc.status ?? (sc.enabled === true ? 'yes' : sc.enabled === false ? 'no' : null);
		if (String(status).toLowerCase() !== 'yes' || !sc.start_time) return;
		const t = to24h(String(sc.start_time).split('T').pop() || '');
		if (t && (!best || t < best)) best = t;
	});
	return best;
}

/** Settings default, or soundcheck − offset when the rule is on and a soundcheck exists. */
export function techCallTime(
	events: EmailTechEvent[],
	rule: { techTime: string; soundcheckOffsetMin: number; useSoundcheck: boolean },
	allRows: EmailTechEvent[] = []
): string {
	if (rule.useSoundcheck) {
		const sc = firstSoundcheckStart(events, allRows);
		if (sc) {
			const call = crewCallFromSoundcheck(sc, rule.soundcheckOffsetMin);
			if (call) return call;
		}
	}
	return rule.techTime || '19:00';
}
