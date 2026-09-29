// src/lib/utils/emailTechTemplate.ts
//
// One model, three renderers.
//
//   buildTechModel / buildVJModel  -> EmailModel (what the email says)
//   renderTemplateHtml(model)      -> the boxed "advance sheet" look: table
//                                     based, 600px fluid, inline styles, works
//                                     in Gmail / Outlook / Apple Mail
//   renderSimpleHtml(model)        -> plain paragraphs (the "text" format)
//   renderText(model)              -> text/plain part of the .eml
//
// Only real URLs become links (linkify). Everything else stays text.

import type { EmailTechEvent, TechEmailForm, TimetableEntry, CrewAssignments } from '$lib/types/emailtech';
import { normalizeCrew } from '$lib/types/emailtech';

/* ------------------------------------------------------------------ model */

export type Block =
	| { kind: 'paragraph'; text: string }
	| { kind: 'lines'; heading?: string; lines: string[] }
	/** free text: "- " lines become bullets, "@Name" and other lines stay plain, blank lines are kept */
	| { kind: 'notes'; heading?: string; lines: { text: string; bullet: boolean }[] }
	| { kind: 'bullets'; heading?: string; items: string[]; /** white bold heading instead of the lime label */ plainHeading?: boolean }
	| { kind: 'kv'; heading?: string; rows: { k: string; v: string; strong?: boolean; sub?: string; dots?: string[] }[] }
	| { kind: 'links'; heading?: string; rows: { label: string; url: string }[] }
	| { kind: 'setlist'; heading: string; rows: { time: string; artist: string; strong?: boolean }[] }
	| { kind: 'linkgroups'; heading: string; groups: { label: string; items: string[] }[] };

export interface EmailSection {
	id: string;
	title: string;
	blocks: Block[];
	/** title / sub-heading / bullet colour for this section (lime by default) */
	accent?: string;
}

export interface EmailModel {
	kind: 'tech' | 'vj';
	/** big title in the header ("TECH SHEET" / "VJ SHEET") */
	sheetTitle: string;
	eventTitle: string;
	dateLine: string; // "Bazart • Friday, September 25, 2026"
	greeting: string;
	intro: string[]; // paragraphs after the greeting (may contain URLs)
	sections: EmailSection[];
	closing: string[];
	signoff: string; // "Thanks a lot,"
	sender: string;
}

/* ---------------------------------------------------------------- helpers */

/** Public copy of the lockup logo (Supabase storage — app.produkt.ca is behind auth for mail clients). */
export const EMAIL_LOGO_URL =
	'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png';

/**
 * Inline colours are the LIGHT theme (readable in every client, even ones that
 * strip <style>). applyThemeClasses() tags each coloured element with a class
 * and the <style> block swaps in DARK_THEME under prefers-color-scheme: dark.
 * Every light value must be unique — it is how an element's role is found.
 */
const THEME = {
	/** accent text: titles, sub-headings, bullets, links */
	lime: '#5A6800',
	highlight: '#F1F9C6',
	problem: '#B42318',
	problemBg: '#FDECEC',
	confirmed: '#86EFAC',
	info: '#c4b5fd',
	question: '#93c5fd',
	page: '#F4F4F2',
	card: '#FFFFFF',
	box: '#F4F4F1',
	line: '#E3E3DE',
	text: '#1A1A1A',
	muted: '#5E5E5A',
	dim: '#6B6B66',
	// header band: navbar gray in both themes (white logo), lime accents
	headBg: '#212121',
	headText: '#FAFAF9',
	headMuted: '#B8B8B5',
	// titles / sub-headings: black on a lime pill in light, lime text in dark
	pillBg: '#E1FF03',
	pillText: '#111114',
	// bullets and headliner-row text
	bullet: '#111115',
	hlText: '#111116',
	// links: near-black + lime underline in light, lime in dark
	link: '#1A1D00',
	// fixed in both themes (not re-coloured)
	bar: '#E1FF00'
};

/** dark value for each themed role (same keys as THEME) */
const DARK_THEME: Record<string, string> = {
	lime: '#E1FF00',
	highlight: '#3D4027',
	problem: '#FCA5A5',
	problemBg: '#403737',
	page: '#161616',
	card: '#212121',
	box: '#2B2B2B',
	line: '#383838',
	text: '#F7F7F7',
	muted: '#BDBDBB',
	dim: '#9E9E9E',
	pillBg: 'transparent',
	pillText: '#E1FF00',
	bullet: '#E1FF00',
	hlText: '#E1FF00',
	link: '#E1FF00'
};

const LIGHT_TO_ROLE: Record<string, string> = Object.fromEntries(
	Object.keys(DARK_THEME).map((k) => [(THEME as any)[k].toLowerCase(), k])
);

/** Add c-/bg-/bd-<role> classes to every element whose inline colours are themed. */
export function applyThemeClasses(html: string): string {
	return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*?)?\sstyle="([^"]*)"([^>]*)>/g, (tag, name, pre = '', style, post) => {
		const cls = new Set<string>();
		const role = (hex: string) => LIGHT_TO_ROLE[hex.toLowerCase()];
		// only the LAST declaration of a property is the one that applies
		const last = (re: RegExp) => [...style.matchAll(re)].pop()?.[1];
		const fg = last(/(?<![-\w])color:\s*(#[0-9a-fA-F]{6})/g);
		const bg = last(/background(?:-color)?:\s*(#[0-9a-fA-F]{6})/g);
		if (fg && role(fg)) cls.add(`c-${role(fg)}`);
		if (bg && role(bg)) cls.add(`bg-${role(bg)}`);
		for (const m of style.matchAll(/border(?:-left|-right|-top|-bottom)?:[^;]*?(#[0-9a-fA-F]{6})/g)) if (role(m[1])) cls.add(`bd-${role(m[1])}`);
		if (!cls.size) return tag;
		const all = `${pre || ''}${post || ''}`;
		const existing = all.match(/\sclass="([^"]*)"/);
		if (existing) {
			const merged = `${existing[1]} ${[...cls].join(' ')}`.trim();
			return `<${name}${(pre || '').replace(existing[0], ` class="${merged}"`)} style="${style}"${(post || '').replace(existing[0], ` class="${merged}"`)}>`;
		}
		return `<${name}${pre || ''} class="${[...cls].join(' ')}" style="${style}"${post}>`;
	});
}

/** CSS that turns the tagged elements dark; `force` = no media query (preview). */
function darkCss(force: boolean): string {
	const rules: string[] = [];
	for (const [role, hex] of Object.entries(DARK_THEME)) {
		rules.push(`.c-${role}{color:${hex} !important;}`);
		rules.push(`.bg-${role}{background:${hex} !important;background-color:${hex} !important;}`);
		rules.push(`.bd-${role}{border-color:${hex} !important;}`);
	}
	const extra = `.pill{padding:0 !important;border-radius:0 !important;}
`;
	const body = `body,.bg-page{background:${DARK_THEME.page} !important;background-color:${DARK_THEME.page} !important;}\n${rules.join('\n')}\n${extra}`;
	if (force) return body;
	// Apple Mail / iOS / Outlook.com (data-ogsc/ogsb) dark modes
	const ogsc = Object.entries(DARK_THEME)
		.map(([r, hex]) => `[data-ogsc] .c-${r}{color:${hex} !important;} [data-ogsb] .bg-${r}{background-color:${hex} !important;}`)
		.join('\n');
	const ogscExtra = `[data-ogsc] .pill{padding:0 !important;}`;
	return `@media (prefers-color-scheme: dark){\n${body}\n}\n${ogsc}\n${ogscExtra}`;
}

export function escapeHtml(s: string): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const URL_RE = /(https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?])/g;

/** Escape, then turn only URLs into anchors. */
const LINK_STYLE = `font-weight:600;text-decoration:underline;text-decoration-color:#B9D400;text-decoration-thickness:2px;text-underline-offset:3px;word-break:break-all;`;

export function linkify(text: string, color = THEME.link): string {
	const safe = escapeHtml(text);
	return safe.replace(URL_RE, (u) => `<a href="${u}" style="color:${color};${LINK_STYLE}">${u}</a>`);
}

/** "**text**" -> highlighted (tinted background, lime bold), asterisks removed.
 *  Run on already-escaped HTML. */
export function emphasize(html: string, color = THEME.problem, bg = THEME.problemBg): string {
	return html.replace(
		/\*\*([^*\n]+?)\*\*/g,
		`<span style="color:${color};font-weight:700;background:${bg};background-color:${bg};padding:1px 5px;border-radius:4px;">$1</span>`
	);
}

/** Whole line wrapped in ** ** -> the text without them, else null. */
function wholeLineEmphasis(text: string): string | null {
	const m = String(text || '').trim().match(/^\*\*(.+?)\*\*$/);
	return m ? m[1] : null;
}

export function isUrl(s: string): boolean {
	return /^https?:\/\/\S+$/i.test(String(s || '').trim());
}

export function formatLongDate(dateStr: string | null | undefined): string {
	if (!dateStr) return 'TBD';
	const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return String(dateStr);
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
	return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** "19:00" -> "7PM", "19:30" -> "7:30PM" */
export function formatCrewTime(timeStr: string): string {
	if (!timeStr) return '';
	const [h, m] = timeStr.split(':').map(Number);
	if (isNaN(h)) return timeStr;
	const ampm = h >= 12 ? 'PM' : 'AM';
	const h12 = h % 12 || 12;
	return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
}

const first = (n: string) => String(n || '').trim().split(/[\s._]+/)[0] || '';

const visible = (form: TechEmailForm, id: string) => form.visible_sections?.[id] !== false;

// initSetTimes tags entries with the advance's artist_type; "headliner" in
// any spelling counts, and several headliners all get highlighted.
export const isHeadliner = (t: TimetableEntry) => /headliner/i.test(String((t as any).artist_type || ''));

/** The selected event is the main one; linked events follow it. Crew,
 *  date and DOS all belong to it. */
function mainEventOf(events: EmailTechEvent[]): EmailTechEvent {
	return events[0];
}

function eventTitles(events: EmailTechEvent[]): string {
	const seen = new Set<string>();
	return events
		.map((e) => e.event_name || e.artist_name)
		.filter((n) => n && !seen.has(n) && seen.add(n))
		.join(' / ');
}

/** "Main Room" for New City Gas, "Lounge" for Bazart, else the venue as is. */
function roomLabel(venue: string): string {
	const v = String(venue || '');
	if (/main|new city gas/i.test(v)) return 'Main Room';
	if (/bazart|lounge/i.test(v)) return 'Lounge';
	return v || 'Set Times';
}

function crewOf(e: EmailTechEvent | undefined): CrewAssignments {
	return normalizeCrew(e?.crew);
}

/**
 * "<b><u>AFROJACK</u></b><br>- Nick - Artist<br><br><b><u>TORREN</u></b>…" ->
 * [{label:'AFROJACK', items:['Nick - Artist']}, …]. Plain text with "- "
 * lines works the same way; tags are stripped, never rendered.
 */
export function groupsFromHtmlish(raw: string): { label: string; items: string[] }[] {
	const text = String(raw || '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/?(p|div|li|ul)[^>]*>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
	const groups: { label: string; items: string[] }[] = [];
	let cur: { label: string; items: string[] } | null = null;
	text.split('\n').forEach((line) => {
		const t = line.trim();
		if (!t) return;
		if (/^[-•]\s*/.test(t)) {
			if (!cur) {
				cur = { label: '', items: [] };
				groups.push(cur);
			}
			cur.items.push(t.replace(/^[-•]\s*/, ''));
		} else {
			cur = { label: t, items: [] };
			groups.push(cur);
		}
	});
	return groups;
}

/**
 * Backline order: mixer (DJM-V10 / A9 / 900NXS…) → CDJ → RMX → everything
 * else alphabetically. Quantities are ignored for the ranking.
 */
export function backlineRank(item: string): number {
	const t = String(item || '').toUpperCase().replace(/^\d+\s*X\s*/i, '');
	if (/DJM|V10|A9|900\s*NXS|NXS2|MIXER|XONE|MODEL\s*1/.test(t)) return 0;
	if (/CDJ|XDJ/.test(t)) return 1;
	if (/RMX/.test(t)) return 2;
	return 3;
}

export function sortBacklineItems(items: string[]): string[] {
	return [...items].sort((a, b) => backlineRank(a) - backlineRank(b) || a.localeCompare(b));
}

/** Team-notes lines: only "- " / "• " lines are bullets; "@Name" lines and
 *  everything else stay as typed; empty lines are kept as spacing. */
export function notesLines(text: string): { text: string; bullet: boolean }[] {
	return String(text || '')
		.replace(/\r/g, '')
		.split('\n')
		.map((raw) => {
			const t = raw.trim();
			if (/^[-•]\s+/.test(t)) return { text: t.replace(/^[-•]\s+/, ''), bullet: true };
			return { text: t, bullet: false };
		});
}

/* ------------------------------------------------------------- tech model */

export interface ModelOptions {
	/** light colour name -> hex, from Settings (for the dots next to colours) */
	lightColors?: Record<string, string>;
}

export function buildTechModel(events: EmailTechEvent[], form: TechEmailForm, senderName: string, opts: ModelOptions = {}): EmailModel {
	const main = mainEventOf(events);
	const crew = crewOf(main);
	const dateStr = formatLongDate(main?.event_date);
	const titles = eventTitles(events);
	const venues = Array.from(new Set(events.map((e) => e.event_venue).filter(Boolean))).join(' + ');
	const videoName = first((crew.VIDEO || [])[0] || '') || 'Video';

	const sections: EmailSection[] = [];
	const push = (id: string, title: string, blocks: Block[], accent?: string) => {
		const kept = blocks.filter(Boolean);
		if (kept.length) sections.push({ id, title, blocks: kept, accent });
	};

	// Crew call
	if (visible(form, 'crew_call')) {
		const rows = (form.crew_calls || [])
			.filter((c) => c.time && c.names)
			.map((c) => ({ k: formatCrewTime(c.time), v: c.names }));
		if (rows.length) push('crew_call', 'Crew Call', [{ kind: 'kv', rows }]);
	}

	// Team notes
	if (visible(form, 'team_notes') && form.team_notes?.trim()) {
		push('team_notes', 'Team Notes', [{ kind: 'notes', lines: notesLines(form.team_notes) }]);
	}

	// Specs + projects
	if (visible(form, 'specs')) {
		const blocks: Block[] = [];
		const links = (form.specs_links || []).filter((l) => l.label && l.url);
		if (links.length) blocks.push({ kind: 'links', rows: links });
		// same rules as team notes: "- " lines are bullets, "@Name" lines and
		// plain text stay as typed, blank lines are kept
		const projects = form.projects || [];
		if (projects.some((p) => p.trim())) blocks.push({ kind: 'notes', heading: 'Projects', lines: notesLines(projects.join('\n')) });
		push('specs', 'Venue Specs & Projects', blocks);
	}

	// Video & visuals
	if (visible(form, 'visuals')) {
		const blocks: Block[] = [];
		if (form.projector_outdoor?.trim()) {
			blocks.push({ kind: 'lines', heading: `@${videoName} — Projecteur extérieur`, lines: form.projector_outdoor.split('\n') });
		}
		if (form.visuals_interior?.trim()) {
			blocks.push({ kind: 'lines', heading: 'Visuals for TVs and interior projector', lines: form.visuals_interior.split('\n') });
		}
		push('visuals', 'Video & Visuals', blocks);
	}

	// Set times — one room: the room IS the section title ("Main Room — Set
	// Times"); two linked events: "Set Times" with a heading per room.
	if (visible(form, 'set_times')) {
		const ordered = [...(form.set_times || [])]
			.filter((st) => st.entries?.length)
			.sort((a, b) => {
				const am = a.venue.includes('Main') || a.venue.includes('New City Gas') ? 0 : 1;
				const bm = b.venue.includes('Main') || b.venue.includes('New City Gas') ? 0 : 1;
				return am - bm;
			});
		const blocks: Block[] = ordered.map((st) => ({
			kind: 'setlist',
			heading: ordered.length > 1 ? `${roomLabel(st.venue)} — Set Times` : '',
			rows: st.entries.map((t) => ({ time: t.time, artist: t.artist, strong: isHeadliner(t) }))
		}));
		push('set_times', ordered.length === 1 ? `${roomLabel(ordered[0].venue)} — Set Times` : 'Set Times', blocks);
	}

	// Soundcheck
	if (visible(form, 'soundcheck') && form.soundcheck?.trim()) {
		push('soundcheck', 'Soundcheck / Programmation', [
			{ kind: 'bullets', items: form.soundcheck.split('\n').filter((l) => l.trim()) }
		]);
	}

	// Lounge ambiance (Bazart)
	const l = form.lounge_ambiance;
	if (visible(form, 'lounge_ambiance') && l && (l.terrasse_type || l.lounge_option || l.lounge_custom)) {
		// one heading per area, its choice as a bullet underneath
		const blocks: Block[] = [];
		if (l.terrasse_type) {
			const tName = l.terrasse_type === 'back-side' ? 'Back-Side Terrace' : 'Back Terrace';
			const tVal = (l.terrasse_option === 'Other' ? l.terrasse_custom : l.terrasse_option) || 'No Music';
			blocks.push({ kind: 'bullets', heading: tName, items: [tVal], plainHeading: true });
		}
		if (l.lounge_option || l.lounge_custom) {
			blocks.push({ kind: 'bullets', heading: 'Lounge', items: [(l.lounge_option === 'Other' ? l.lounge_custom : l.lounge_option) || 'No Music'], plainHeading: true });
		}
		push('lounge_ambiance', 'Bazart Ambiance', blocks);
	}

	// Riders / backline
	if (visible(form, 'backline')) {
		const blocks: Block[] = [];
		if (form.riders_attached) blocks.push({ kind: 'paragraph', text: 'ALL TECH RIDERS ATTACHED' });
		(form.backline || []).forEach((b) => {
			if (b.items?.length) blocks.push({ kind: 'bullets', heading: `Backline ${b.venue}`, items: sortBacklineItems(b.items) });
		});
		push('backline', 'Riders & Backline', blocks);
	}

	// Travelling party — stored as "<b><u>ARTIST</u></b><br>- Name - Role…"
	if (visible(form, 'travelling') && form.travelling_party?.trim()) {
		const groups = groupsFromHtmlish(form.travelling_party);
		push('travelling', 'Travelling Party', [
			groups.length ? { kind: 'linkgroups', heading: '', groups } : { kind: 'lines', lines: form.travelling_party.split('\n') }
		]);
	}

	// VJ schedule
	if (visible(form, 'vj') && form.vj_schedule?.trim()) {
		push('vj', 'VJ', [{ kind: 'bullets', items: form.vj_schedule.split('\n').filter((x) => x.trim()) }]);
	}

	// Lights — "Lounge (5PM & 10PM)" -> area + time, colours with a swatch each
	if (visible(form, 'lights') && form.lights?.some((x) => x.color)) {
		const hexOf = (name: string) => {
			const key = name.trim().toLowerCase();
			const hit = Object.entries(opts.lightColors || {}).find(([k]) => k.trim().toLowerCase() === key);
			return hit ? hit[1] : '';
		};
		push('lights', 'Lights', [
			{
				kind: 'kv',
				rows: form.lights
					.filter((r) => r.color)
					.map((r) => {
						const m = String(r.area || '').match(/^(.*?)\s*\((.*)\)\s*$/);
						const parts = r.color.split('/').map((x) => x.trim()).filter(Boolean);
						return {
							k: m ? m[1] : r.area,
							sub: m ? m[2] : '',
							v: parts.join(' / '),
							dots: parts.map(hexOf)
						};
					})
			}
		]);
	}

	// SFX
	if (visible(form, 'sfx') && form.sfx && form.sfx.trim() && form.sfx.trim().toUpperCase() !== 'NONE') {
		push('sfx', 'SFX', [{ kind: 'bullets', items: form.sfx.split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean) }]);
	}

	// Sponsors — always stated (NONE when empty)
	{
		const name = form.sponsor_name && form.sponsor_name !== 'None' ? form.sponsor_name.trim() : '';
		const lines: string[] = [];
		lines.push(name ? `${name}${form.sponsor_link ? ` — ${form.sponsor_link}` : ''}` : 'NONE');
		if (name && form.sponsor_notes?.trim()) lines.push(...form.sponsor_notes.split('\n'));
		push('sponsor', 'Sponsors and/or Branding', [{ kind: 'lines', lines }]);
	}

	// Post show
	if (visible(form, 'sponsors') && form.post_show?.trim()) {
		push('post_show', 'After the Show', [{ kind: 'lines', lines: form.post_show.split('\n') }]);
	}

	// Opening: generated, or the text typed in Show Info ("Custom greeting").
	// A custom text is paragraphs separated by blank lines; its first line is
	// the greeting.
	const custom = form.greeting_custom && (form.greeting_text || '').trim();
	const paragraphs = custom
		? splitParagraphs(form.greeting_text || '')
		: splitParagraphs(defaultTechGreeting(events, form));
	const greeting = paragraphs.shift() || '';

	return {
		kind: 'tech',
		sheetTitle: 'TECH INFO',
		eventTitle: titles,
		dateLine: `${venues || 'Venue TBD'} • ${dateStr}`,
		greeting,
		intro: paragraphs,
		sections,
		closing: ['Please confirm and let me know if you have any questions!'],
		signoff: 'Thanks a lot,',
		sender: senderName
	};
}

/** The generated opening of the tech email, as editable text. */
export function defaultTechGreeting(events: EmailTechEvent[], form: Pick<TechEmailForm, 'liaison'>): string {
	const main = mainEventOf(events);
	const dateStr = formatLongDate(main?.event_date);
	const titles = eventTitles(events);
	const liaison = (form.liaison || '').trim();
	return [
		'Hello everyone,',
		`Here are the info for ${titles} — ${dateStr}.`,
		liaison ? `Please note ${liaison} will be working with you for this show.` : ''
	]
		.filter(Boolean)
		.join('\n\n');
}

/** Blank-line separated paragraphs; single newlines inside a paragraph are kept as spaces. */
function splitParagraphs(text: string): string[] {
	return String(text || '')
		.replace(/\r/g, '')
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\n/g, ' ').trim())
		.filter(Boolean);
}

/* --------------------------------------------------------------- vj model */

export function buildVJModel(events: EmailTechEvent[], form: TechEmailForm, senderName: string): EmailModel {
	const main = mainEventOf(events);
	const crew = crewOf(main);
	const vjName = first((crew.VJ || [])[0] || '') || 'VJ';
	const dateStr = formatLongDate(main?.event_date);
	const titles = eventTitles(events);
	const venues = Array.from(new Set(events.map((e) => e.event_venue).filter(Boolean))).join(' + ');

	let vjCall = '21:00';
	const call = (form.crew_calls || []).find(
		(c) => c.names.toLowerCase().includes(vjName.toLowerCase()) || c.names.toLowerCase().includes('vj')
	);
	if (call?.time) vjCall = call.time;

	const sections: EmailSection[] = [];
	const push = (id: string, title: string, blocks: Block[]) => {
		if (blocks.length) sections.push({ id, title, blocks });
	};

	const mainSet = (form.set_times || []).find((st) => st.venue.includes('Main') || st.venue.includes('New City Gas')) || form.set_times?.[0];
	if (mainSet?.entries?.length) {
		push('set_times', `${roomLabel(mainSet.venue)} — Set Times`, [
			{
				kind: 'setlist',
				heading: '',
				rows: mainSet.entries.map((t) => ({ time: t.time, artist: t.artist, strong: isHeadliner(t) }))
			}
		]);
	}

	if (form.vj_notes?.trim()) {
		push('vj_notes', `Notes for ${vjName}`, [{ kind: 'lines', lines: form.vj_notes.split('\n') }]);
	}

	{
		const name = form.sponsor_name && form.sponsor_name !== 'None' ? form.sponsor_name.trim() : '';
		const lines = [name ? `${name}${form.sponsor_link ? ` — ${form.sponsor_link}` : ''}` : 'NONE'];
		if (name && form.sponsor_notes?.trim()) lines.push(...form.sponsor_notes.split('\n'));
		push('sponsor', 'Branding / Sponsor', [{ kind: 'lines', lines }]);
	}

	const links = (form.specs_links || []).filter((x) => x.label && x.url);
	if (links.length) push('specs', 'Venue Specs', [{ kind: 'links', rows: links }]);

	if (form.soundcheck?.trim()) {
		push('soundcheck', 'Soundcheck / Programmation', [
			{ kind: 'bullets', items: form.soundcheck.split('\n').filter((x) => x.trim()) }
		]);
	}

	// Visual links: "Artist" line then "- item" lines. Items that are URLs
	// become links; anything else stays plain text.
	{
		const groups: { label: string; items: string[] }[] = [];
		if (form.vj_visuals && form.vj_visuals.trim() && form.vj_visuals.trim() !== 'WAITING') {
			let cur: { label: string; items: string[] } | null = null;
			form.vj_visuals.split('\n').forEach((raw) => {
				const line = raw.trim();
				if (!line) return;
				if (line.startsWith('- ')) {
					if (!cur) {
						cur = { label: '', items: [] };
						groups.push(cur);
					}
					cur.items.push(line.slice(2).trim());
				} else {
					cur = { label: line, items: [] };
					groups.push(cur);
				}
			});
		}
		push('vj_visuals', 'Visual Links', [
			groups.length ? { kind: 'linkgroups', heading: '', groups } : { kind: 'paragraph', text: 'WAITING' }
		]);
	}

	return {
		kind: 'vj',
		sheetTitle: 'VJ INFO',
		eventTitle: titles,
		dateLine: `${venues || 'Venue TBD'} • ${dateStr}`,
		greeting: `Hi ${vjName},`,
		intro: [`Here's all the information for ${titles} — ${dateStr}.`, `Please be on site at ${formatCrewTime(vjCall)}.`],
		sections,
		closing: ["Let me know if there's anything :)"],
		signoff: 'Thanks,',
		sender: senderName
	};
}

/* --------------------------------------------------------- html: template */

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function h(tag: string, style: string, inner: string, attrs = ''): string {
	return `<${tag}${attrs ? ' ' + attrs : ''} style="${style}">${inner}</${tag}>`;
}

/** lime pill with black text in light; plain lime text in dark */
function pill(text: string, size: 'title' | 'sub'): string {
	const fs = size === 'title' ? 'font-size:12px;line-height:16px;padding:4px 11px;' : 'font-size:10px;line-height:14px;padding:3px 9px;';
	return `<span class="pill" style="${FONT}display:inline-block;${fs}font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:${THEME.pillText};background:${THEME.pillBg};background-color:${THEME.pillBg};border-radius:999px;">${escapeHtml(text)}</span>`;
}

function subheading(text: string, _accent = THEME.lime): string {
	if (!text) return '';
	return `<div style="margin:0 0 8px 0;">${pill(text, 'sub')}</div>`;
}

function renderBlockTemplate(b: Block, accent = THEME.lime): string {
	const base = `${FONT}font-size:14px;line-height:21px;color:${THEME.text};`;
	switch (b.kind) {
		case 'paragraph':
			return h('p', `${base}margin:0;font-weight:700;`, linkify(b.text));
		case 'lines':
			return (
				subheading(b.heading || '', accent) +
				h('div', `${base}margin:0;`, b.lines.map((ln) => (ln.trim() ? linkify(ln) : '&nbsp;')).join('<br>'))
			);
		case 'notes': {
			// The boxed template already says "Team Notes": a bare "@Team" line is
			// noise here (it stays in the text email). Drop it and any blank right after.
			const lines: typeof b.lines = [];
			b.lines.forEach((ln, i) => {
				if (/^@team\s*:?$/i.test(ln.text)) return;
				if (!ln.text && i > 0 && /^@team\s*:?$/i.test(b.lines[i - 1].text)) return;
				lines.push(ln);
			});
			while (lines.length && !lines[0].text) lines.shift();
			return (
				subheading(b.heading || '', accent) +
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
				lines
					.map((ln) =>
						ln.bullet
							? `<tr><td valign="top" width="10" style="${base}padding:0 4px 2px 0;color:${THEME.bullet};">•</td><td style="${base}padding:0 0 2px 0;">${emphasize(linkify(ln.text))}</td></tr>`
							: wholeLineEmphasis(ln.text) !== null
								? // whole line in ** **: highlighted row, like a headliner in the set times
									`<tr><td colspan="2" style="${base}padding:5px 8px;margin:2px 0;color:${THEME.problem};font-weight:700;background:${THEME.problemBg};background-color:${THEME.problemBg};border-left:3px solid ${THEME.problem};">${linkify(wholeLineEmphasis(ln.text) || '', THEME.problem)}</td></tr>`
								: `<tr><td colspan="2" style="${base}padding:0 0 2px 0;${ln.text ? '' : 'height:12px;line-height:12px;font-size:12px;'}">${ln.text ? emphasize(linkify(ln.text)) : '&nbsp;'}</td></tr>`
					)
					.join('') +
				`</table>`
			);
		}
		case 'bullets':
			return (
				(b.plainHeading && b.heading
					? h('div', `${base}font-weight:700;margin:0 0 4px 0;`, escapeHtml(b.heading))
					: subheading(b.heading || '', accent)) +
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
				b.items
					.map(
						(it) =>
							`<tr><td valign="top" width="10" style="${base}padding:0 4px 2px 0;color:${THEME.bullet};">•</td><td style="${base}padding:0 0 2px 0;">${linkify(it)}</td></tr>`
					)
					.join('') +
				`</table>`
			);
		case 'kv':
			return (
				subheading(b.heading || '', accent) +
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
				b.rows
					.map((r) => {
						const key =
							escapeHtml(r.k) +
							(r.sub ? `<br><span style="font-size:11px;line-height:14px;color:${THEME.dim};">${escapeHtml(r.sub)}</span>` : '');
						const val = r.dots?.length
							? r.v
									.split('/')
									.map((x) => x.trim())
									.filter(Boolean)
									.map((name, i) => {
										const hex = r.dots?.[i];
										const dot = hex
											? `<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${hex};background-color:${hex};vertical-align:middle;margin:0 5px 2px 0;border:1px solid rgba(0,0,0,.35);"></span>`
											: '';
										return `${dot}${escapeHtml(name)}`;
									})
									.join(`<span style="color:${THEME.dim};margin:0 6px;">/</span>`)
							: linkify(r.v);
						return `<tr><td valign="top" style="${base}padding:3px 12px 3px 0;color:${THEME.muted};white-space:nowrap;">${key}</td><td valign="top" width="100%" style="${base}padding:3px 0;${r.strong ? 'font-weight:700;' : ''}">${val}</td></tr>`;
					})
					.join('') +
				`</table>`
			);
		case 'links':
			return (
				subheading(b.heading || '', accent) +
				b.rows
					.map(
						(r) =>
							`<div style="${base}margin:0 0 4px 0;"><strong>${escapeHtml(r.label)}</strong>: <a href="${escapeHtml(r.url)}" style="color:${THEME.link};${LINK_STYLE}">${escapeHtml(r.url)}</a></div>`
					)
					.join('')
			);
		case 'setlist':
			return (
				(b.heading ? subheading(b.heading, accent) : '') +
				`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">` +
				b.rows
					.map(
						(r, i) =>
							r.strong
								? `<tr><td valign="top" style="${base}padding:5px 12px 5px 8px;white-space:nowrap;font-weight:700;color:${THEME.hlText};background:${THEME.highlight};background-color:${THEME.highlight};border-left:3px solid ${THEME.bar};">${escapeHtml(r.time)}</td><td valign="top" width="100%" style="${base}padding:5px 8px 5px 0;font-weight:700;color:${THEME.hlText};background:${THEME.highlight};background-color:${THEME.highlight};">${escapeHtml(r.artist)}</td></tr>`
								: `<tr><td valign="top" style="${base}padding:5px 12px 5px 11px;white-space:nowrap;color:${THEME.muted};${i ? `border-top:1px solid ${THEME.line};` : ''}">${escapeHtml(r.time)}</td><td valign="top" width="100%" style="${base}padding:5px 0;${i ? `border-top:1px solid ${THEME.line};` : ''}">${escapeHtml(r.artist)}</td></tr>`
					)
					.join('') +
				`</table>`
			);
		case 'linkgroups':
			return b.groups
				.map((g) => {
					const label = g.label ? h('div', `${base}font-weight:700;margin:0 0 2px 0;`, escapeHtml(g.label)) : '';
					const items = g.items
						.map(
							(it) =>
								`<tr><td valign="top" width="10" style="${base}padding:0 4px 2px 0;color:${THEME.bullet};">•</td><td style="${base}padding:0 0 2px 0;">${isUrl(it) ? linkify(it) : escapeHtml(it)}</td></tr>`
						)
						.join('');
					return `<div style="margin:0 0 10px 0;">${label}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${items}</table></div>`;
				})
				.join('');
	}
}

function renderSectionTemplate(s: EmailSection): string {
	const accent = s.accent || THEME.lime;
	const title = `<div>${pill(s.title, 'title')}</div>`;
	const body = s.blocks.map((b, i) => `<div style="margin:${i ? '22px' : '0'} 0 10px 0;">${renderBlockTemplate(b, accent)}</div>`).join('');
	return `
<tr><td class="sx" style="padding:0 12px 12px 12px;background:${THEME.card};background-color:${THEME.card};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:12px;background:${THEME.box};background-color:${THEME.box};">
    <tr><td style="padding:12px 16px 0 16px;">${title}</td></tr>
    <tr><td style="padding:10px 16px 6px 16px;">${body}</td></tr>
  </table>
</td></tr>`;
}

export interface RenderOptions {
	/** img src for the logo (defaults to the public URL) */
	logoSrc?: string;
	/** preview only: pin a theme instead of following the device */
	scheme?: 'light' | 'dark';
}

export function renderTemplateHtml(m: EmailModel, opts: RenderOptions = {}): string {
	return applyThemeClasses(renderTemplateRaw(m, opts));
}

function renderTemplateRaw(m: EmailModel, opts: RenderOptions): string {
	const logoSrc = opts.logoSrc || EMAIL_LOGO_URL;
	const themeCss = opts.scheme === 'light' ? '' : darkCss(opts.scheme === 'dark');
	const base = `${FONT}font-size:14px;line-height:21px;color:${THEME.text};`;
	const intro = m.intro.map((p) => h('p', `${base}margin:0 0 8px 0;`, linkify(p))).join('');
	const closing = m.closing.map((p) => h('p', `${base}margin:0 0 8px 0;`, linkify(p))).join('');

	return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(m.eventTitle)}</title>
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;line-height:100%;}
  a{color:${THEME.link};}
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  ${themeCss}
  @media only screen and (min-width:621px){
    .px{padding-left:28px !important;padding-right:28px !important;}
    .sx{padding-left:24px !important;padding-right:24px !important;}
    .h1{font-size:26px !important;line-height:30px !important;}
  }
  @media only screen and (max-width:620px){
    .wrap{width:100% !important;}
    .px{padding-left:16px !important;padding-right:16px !important;}
    .sx{padding-left:12px !important;padding-right:12px !important;}
    .h1{font-size:22px !important;line-height:26px !important;}
    .h2{font-size:17px !important;line-height:22px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;">
<div style="width:100%;margin:0;padding:0;">
<div style="display:none;font-size:1px;color:${THEME.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(m.eventTitle)} — ${escapeHtml(m.dateLine)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;min-width:100%;">
<tr><td align="center" style="padding:8px 0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;background:${THEME.card};background-color:${THEME.card};border:1px solid ${THEME.line};border-radius:16px;overflow:hidden;">
  <tr><td style="height:5px;line-height:5px;font-size:5px;background:${THEME.bar};background-color:${THEME.bar};">&nbsp;</td></tr>
  <tr><td class="px" style="padding:14px 18px 14px 18px;background:${THEME.headBg};background-color:${THEME.headBg};">
    <!-- row 1: sheet title + logo · row 2: event + date at full width, so a long
         event name never gets squeezed next to the logo on a phone -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td valign="middle" style="padding:0;">
        <span style="${FONT}display:inline-block;font-size:13px;line-height:16px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#111111;background:${THEME.bar};background-color:${THEME.bar};border-radius:999px;padding:5px 12px;white-space:nowrap;">${escapeHtml(m.sheetTitle)}</span>
      </td>
      <td valign="middle" align="right" width="104" style="padding:0 0 0 12px;">
        <img src="${logoSrc}" alt="Produkt" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;" />
      </td>
    </tr></table>
    <div class="h2" style="${FONT}font-size:18px;line-height:23px;font-weight:700;color:${THEME.headText};margin-top:10px;">${escapeHtml(m.eventTitle)}</div>
    <div style="${FONT}font-size:13px;line-height:18px;color:${THEME.headMuted};margin-top:2px;">${escapeHtml(m.dateLine)}</div>
  </td></tr>
  <tr><td class="px" style="padding:16px 18px 14px 18px;background:${THEME.card};background-color:${THEME.card};">
    ${m.greeting ? `<p style="${base}margin:0 0 8px 0;">${escapeHtml(m.greeting)}</p>` : ''}
    ${intro}
  </td></tr>
  ${m.sections.map(renderSectionTemplate).join('')}
  <tr><td class="px" style="padding:6px 18px 22px 18px;background:${THEME.card};background-color:${THEME.card};">
    ${closing}
    <p style="${base}margin:12px 0 0 0;">${escapeHtml(m.signoff)}<br><strong>${escapeHtml(m.sender)}</strong></p>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:4px;background:${THEME.bar};background-color:${THEME.bar};">&nbsp;</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<div style="${FONT}font-size:11px;line-height:16px;color:${THEME.dim};padding:10px 0 0 0;">Powered by Produkt</div>
</td></tr>
</table>
</div>
<!-- blank space so attachments (riders) don't sit right against the email -->
<div style="height:28px;line-height:28px;font-size:28px;">&nbsp;</div>
<br>
</body>
</html>`;
}

/* ----------------------------------------------------------- html: simple */

function renderBlockSimple(b: Block): string {
	const p = (inner: string, extra = '') => `<p style="margin:0 0 10px 0;${extra}">${inner}</p>`;
	const head = (t?: string) => (t ? `<p style="margin:0;"><strong>${escapeHtml(t)}</strong></p>` : '');
	switch (b.kind) {
		case 'paragraph':
			return p(`<strong>${linkify(b.text, '#0000EE')}</strong>`);
		case 'lines':
			return head(b.heading) + p(b.lines.map((l) => (l.trim() ? linkify(l, '#0000EE') : '')).join('<br>'));
		case 'notes':
			return head(b.heading) + p(b.lines.map((l) => (l.bullet ? `• ${linkify(l.text, '#0000EE')}` : linkify(l.text, '#0000EE')).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')).join('<br>'));
		case 'bullets':
			return head(b.heading) + `<div style="margin:0 0 10px 0;">${b.items.map((i) => `• ${linkify(i, '#0000EE')}`).join('<br>')}</div>`;
		case 'kv':
			return head(b.heading) + `<div style="margin:0 0 10px 0;">${b.rows.map((r) => `${escapeHtml(r.k)}${r.sub ? ` (${escapeHtml(r.sub)})` : ''}: ${r.strong ? '<strong>' : ''}${linkify(r.v, '#0000EE')}${r.strong ? '</strong>' : ''}`).join('<br>')}</div>`;
		case 'links':
			return head(b.heading) + `<div style="margin:0 0 10px 0;">${b.rows.map((r) => `<strong>${escapeHtml(r.label)}</strong>: <a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a>`).join('<br>')}</div>`;
		case 'setlist':
			return (b.heading ? `<p style="margin:0;"><strong style="text-decoration:underline;">${escapeHtml(b.heading)}</strong></p>` : '') + `<div style="margin:0 0 10px 0;">${b.rows
				.map((r) => (r.strong ? `<strong>${escapeHtml(r.time)} - ${escapeHtml(r.artist)}</strong>` : `${escapeHtml(r.time)} - ${escapeHtml(r.artist)}`))
				.join('<br>')}</div>`;
		case 'linkgroups':
			return b.groups
				.map((g) => {
					const label = g.label ? `<p style="margin:0;">${escapeHtml(g.label)}</p>` : '';
					const items = g.items.map((i) => `<li>${isUrl(i) ? linkify(i, '#0000EE') : escapeHtml(i)}</li>`).join('');
					return `${label}<ul style="margin:0 0 10px 0;padding-left:20px;">${items}</ul>`;
				})
				.join('');
	}
}

export function renderSimpleHtml(m: EmailModel): string {
	let html = `<div style="font-family:sans-serif;font-size:10pt;color:#000;line-height:1.3;">`;
	if (m.greeting) html += `<p style="margin:0 0 10px 0;">${escapeHtml(m.greeting)}</p>`;
	html += m.intro.map((p) => `<p style="margin:0 0 10px 0;">${linkify(p, '#0000EE')}</p>`).join('');
	m.sections.forEach((s) => {
		html += `<br><p style="margin:0;"><strong style="text-decoration:underline;">${escapeHtml(s.title)}</strong></p>`;
		html += s.blocks.map(renderBlockSimple).join('');
	});
	html += `<br>` + m.closing.map((p) => `<p style="margin:0;">${linkify(p, '#0000EE')}</p>`).join('');
	html += `<p style="margin:10px 0 0 0;">${escapeHtml(m.signoff)}<br>${escapeHtml(m.sender)}</p></div><br><br>`;
	return html;
}

/* ------------------------------------------------------------------- text */

export function renderText(m: EmailModel): string {
	const out: string[] = [];
	if (m.greeting) out.push(m.greeting, '');
	out.push(...m.intro, '');
	m.sections.forEach((s) => {
		out.push(s.title.toUpperCase());
		s.blocks.forEach((b) => {
			switch (b.kind) {
				case 'paragraph':
					out.push(b.text);
					break;
				case 'lines':
					if (b.heading) out.push(b.heading);
					out.push(...b.lines);
					break;
				case 'notes':
					if (b.heading) out.push(b.heading);
					out.push(...b.lines.map((l) => (l.bullet ? `• ${l.text}` : l.text).replace(/\*\*([^*\n]+?)\*\*/g, '$1')));
					break;
				case 'bullets':
					if (b.heading) out.push(b.heading);
					out.push(...b.items.map((i) => `• ${i}`));
					break;
				case 'kv':
					if (b.heading) out.push(b.heading);
					out.push(...b.rows.map((r) => `${r.k}${r.sub ? ` (${r.sub})` : ''}: ${r.v}`));
					break;
				case 'links':
					if (b.heading) out.push(b.heading);
					out.push(...b.rows.map((r) => `${r.label}: ${r.url}`));
					break;
				case 'setlist':
					if (b.heading) out.push(b.heading);
					out.push(...b.rows.map((r) => `${r.time} - ${r.artist}`));
					break;
				case 'linkgroups':
					b.groups.forEach((g) => {
						if (g.label) out.push(g.label);
						out.push(...g.items.map((i) => `  - ${i}`));
					});
					break;
			}
			out.push('');
		});
	});
	out.push(...m.closing, '', m.signoff, m.sender, '', '');
	return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
