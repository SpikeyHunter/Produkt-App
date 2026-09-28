// src/lib/services/emailTechSync.ts
//
// Co-editing engine for one event on the Email Tech page.
//
// Storage is the `events_emailtech` table: one row per event, one column per
// field. A save writes only the columns this user changed (an upsert with a
// partial payload), so two people editing different sections never clobber
// each other. Realtime UPDATEs replace every column that is not locally
// dirty; our own writes are stamped (`rev`) so their echo is ignored.
//
// Until the table exists (see EMAILTECH_SCHEMA_SQL) the engine falls back to
// the old `events.crew / email_data / tech_mail / vj_mail` columns with a
// read-merge-write, and `tableMissing` is set so the page can say so.
//
// Presence tells who else has the event open; a `touch` broadcast names who
// is editing which section so the card can show it.

import { writable, get, type Readable } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase as defaultClient } from '$lib/supabase';
import type { CrewAssignments, EmailData, TechEmailForm } from '$lib/types/emailtech';
import { normalizeCrew, FORM_COLUMNS, emailDataFromRow } from '$lib/types/emailtech';

export const EMAILTECH_TABLE = 'events_emailtech';

export const EMAILTECH_SCHEMA_SQL = `create table if not exists public.events_emailtech (
  event_id bigint primary key references public.events(event_id) on delete cascade,
  crew jsonb not null default '{}'::jsonb,
  tech_status text not null default 'todo',
  vj_status text not null default 'todo',
  linked_event_ids jsonb not null default '[]'::jsonb,
  schedule_row_id text,
  email_format text,
  visible_sections jsonb,
  liaison text,
  greeting_custom boolean not null default false,
  greeting_text text,
  crew_calls jsonb,
  crew_calls_manual boolean not null default false,
  team_notes text,
  vj_notes text,
  specs_links jsonb,
  projects jsonb,
  projector_outdoor text,
  visuals_interior text,
  visuals_custom boolean not null default false,
  artwork_removal_off boolean not null default false,
  vj_visuals text,
  sponsor_name text,
  sponsor_link text,
  sponsor_notes text,
  set_times jsonb,
  soundcheck text,
  soundcheck_custom boolean not null default false,
  riders_attached boolean not null default true,
  backline jsonb,
  travelling_party text,
  vj_schedule text,
  lights jsonb,
  sfx text,
  sponsors text,
  post_show text,
  lounge_ambiance jsonb,
  tech_mail text,
  vj_mail text,
  rev text,
  updated_by text,
  updated_at timestamptz not null default now()
);
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists events_emailtech_updated_at on public.events_emailtech;
create trigger events_emailtech_updated_at before update on public.events_emailtech
  for each row execute function public.set_updated_at();
alter table public.events_emailtech enable row level security;
create policy "authenticated all on events_emailtech" on public.events_emailtech
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.events_emailtech;`;

export interface EmailTechRecord {
	crew: CrewAssignments;
	email_data: EmailData;
	tech_mail: string | null;
	vj_mail: string | null;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface Peer {
	clientId: string;
	user: string;
	section: string | null;
	color: string;
}

export interface Touch {
	user: string;
	color: string;
	at: number;
}

export type FormKey = keyof TechEmailForm;

const DATA_KEYS = ['tech_status', 'vj_status', 'linked_event_ids', 'schedule_row_id'] as const;
/** boolean columns declared NOT NULL in events_emailtech */
const BOOL_COLUMNS = new Set<string>(['crew_calls_manual', 'visuals_custom', 'artwork_removal_off', 'soundcheck_custom', 'riders_attached', 'greeting_custom']);
const TOP_KEYS = ['crew', 'tech_mail', 'vj_mail'] as const;

const PEER_COLORS = ['#E1FF00', '#86EFAC', '#FDBA74', '#93c5fd', '#f9a8d4', '#c4b5fd', '#22d3ee'];
const TOUCH_TTL = 6000;
const SAVE_DEBOUNCE = 700;

/** Set once we know the table is missing; the page shows the SQL. */
export const tableMissing = writable(false);

/** Console trail for co-editing issues: filter the console on "[emailtech]". */
const log = (...a: any[]) => console.info('[emailtech]', ...a);

function clone<T>(v: T): T {
	return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** JSON with object keys sorted at every level: Postgres jsonb reorders keys,
 *  so a plain JSON.stringify would call an unchanged value "changed". */
export function stableStringify(v: any): string {
	if (v === undefined) v = null;
	return JSON.stringify(v, (_k, val) =>
		val && typeof val === 'object' && !Array.isArray(val)
			? Object.keys(val)
					.sort()
					.reduce((o: any, k) => ((o[k] = val[k]), o), {})
			: val
	);
}

export function same(a: any, b: any): boolean {
	return stableStringify(a ?? null) === stableStringify(b ?? null);
}

function colorFor(id: string): string {
	let h = 0;
	for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return PEER_COLORS[h % PEER_COLORS.length];
}

export function isMissingTable(err: any): boolean {
	const code = String(err?.code || '');
	const msg = String(err?.message || '');
	return code === '42P01' || code === 'PGRST205' || /events_emailtech.*(does not exist|not find|schema cache)/i.test(msg);
}

export interface EmailTechSync {
	record: Readable<EmailTechRecord>;
	saveState: Readable<SaveState>;
	peers: Readable<Peer[]>;
	touched: Readable<Record<string, Touch>>;
	onRemote(cb: (keys: string[]) => void): () => void;
	onAdvance(cb: () => void): () => void;

	setForm(patch: Partial<TechEmailForm>): void;
	replaceForm(form: TechEmailForm): void;
	setCrew(crew: CrewAssignments): void;
	setStatus(status: string): void;
	setLinked(ids: number[]): void;
	setPinnedRow(rowId: string | null): void;
	setMail(type: 'tech' | 'vj', html: string): void;

	focus(section: string | null): void;
	flush(): Promise<boolean>;
	/** true while something typed here has not been confirmed in the database */
	hasUnsaved(): boolean;
	/** flushes first; false when that last save failed (edits are still local) */
	destroy(): Promise<boolean>;
}

export function createEmailTechSync(
	eventId: number,
	initial: Partial<EmailTechRecord>,
	userName: string,
	/** test seam: anything with the client surface the engine uses (from / channel / auth) */
	db: any = defaultClient
): EmailTechSync {
	// one identity per engine: revs, presence key and echo suppression hang off it
	const clientId = `c_${Math.random().toString(36).slice(2, 10)}`;
	const record = writable<EmailTechRecord>({
		crew: normalizeCrew(initial.crew),
		email_data: clone(initial.email_data) || {},
		tech_mail: initial.tech_mail ?? null,
		vj_mail: initial.vj_mail ?? null
	});
	const saveState = writable<SaveState>('idle');
	const peers = writable<Peer[]>([]);
	const touched = writable<Record<string, Touch>>({});

	// dirty pieces: top columns, data columns, form columns
	const dirty = new Set<string>();
	let formTouchedWhole = false;

	let mode: 'table' | 'legacy' = get(tableMissing) ? 'legacy' : 'table';
	/** newest row timestamp we wrote or accepted — older rows are stale echoes */
	let lastAccepted = '';
	/** bumps on every completed write; a refetch started before it is discarded */
	let writeSeq = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let saving: Promise<boolean> | null = null;
	let pendingAfterSave = false;
	let destroyed = false;
	let myRev = 0;

	const remoteCbs = new Set<(keys: string[]) => void>();
	const advanceCbs = new Set<() => void>();

	let mySection: string | null = null;
	const touchTimers = new Map<string, ReturnType<typeof setTimeout>>();

	/* ------------------------------------------------------------- local */

	function markDirty(keys: string[]) {
		keys.forEach((k) => dirty.add(k));
		saveState.set('dirty');
		queue();
	}

	function currentForm(): TechEmailForm | undefined {
		return get(record).email_data.tech_form_data;
	}

	function setForm(patch: Partial<TechEmailForm>) {
		// only keys whose value really differs (key order never counts)
		const cur: any = currentForm() || {};
		const keys = Object.keys(patch).filter((k) => !same((patch as any)[k], cur[k]));
		if (!keys.length) return;
		const real: any = {};
		keys.forEach((k) => (real[k] = (patch as any)[k]));
		record.update((r) => {
			const form = { ...(r.email_data.tech_form_data || ({} as TechEmailForm)), ...clone(real) };
			return { ...r, email_data: { ...r.email_data, tech_form_data: form } };
		});
		markDirty(keys);
		announceTouch();
	}

	/** Whole-form replacement (autofill / reset / first creation). */
	function replaceForm(form: TechEmailForm) {
		const prev = currentForm() || ({} as TechEmailForm);
		const isNew = !Object.keys(prev).length;
		const keys = new Set<string>([...Object.keys(prev), ...Object.keys(form)]);
		const changed: string[] = [];
		for (const k of keys) if (!same((prev as any)[k], (form as any)[k])) changed.push(k);
		record.update((r) => ({ ...r, email_data: { ...r.email_data, tech_form_data: clone(form) } }));
		if (isNew) formTouchedWhole = true;
		if (changed.length || isNew) markDirty(isNew ? [...FORM_COLUMNS] : changed);
	}

	function setCrew(crew: CrewAssignments) {
		record.update((r) => ({ ...r, crew: clone(crew) }));
		markDirty(['crew']);
	}

	function setStatus(status: string) {
		record.update((r) => ({ ...r, email_data: { ...r.email_data, tech_status: status, vj_status: status } }));
		markDirty(['tech_status', 'vj_status']);
	}

	function setLinked(ids: number[]) {
		record.update((r) => ({ ...r, email_data: { ...r.email_data, linked_event_ids: [...ids] } }));
		markDirty(['linked_event_ids']);
	}

	function setPinnedRow(rowId: string | null) {
		record.update((r) => ({ ...r, email_data: { ...r.email_data, schedule_row_id: rowId } }));
		markDirty(['schedule_row_id']);
	}

	function setMail(type: 'tech' | 'vj', html: string) {
		const key = type === 'tech' ? 'tech_mail' : 'vj_mail';
		record.update((r) => ({ ...r, [key]: html }));
		markDirty([key]);
	}

	/* -------------------------------------------------------------- save */

	function queue() {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void flush(), SAVE_DEBOUNCE);
	}

	async function flush(): Promise<boolean> {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		if (saving) {
			pendingAfterSave = true;
			return saving;
		}
		if (!dirty.size && !formTouchedWhole) return true;

		saving = doSave();
		const ok = await saving;
		saving = null;
		if (pendingAfterSave) {
			pendingAfterSave = false;
			return flush();
		}
		return ok;
	}

	async function doSave(): Promise<boolean> {
		saveState.set('saving');
		const keys = new Set(dirty);
		const whole = formTouchedWhole;
		dirty.clear();
		formTouchedWhole = false;
		try {
			const { data: session } = await db.auth.getSession();
			if (!session?.session) throw new Error('Not signed in');
			const ok = mode === 'table' ? await saveTable(keys, whole) : await saveLegacy(keys, whole);
			if (!ok) throw new Error('save failed');
			saveState.set(dirty.size ? 'dirty' : 'saved');
			return true;
		} catch (err: any) {
			console.error('[emailtech sync] save failed:', err?.message || err);
			keys.forEach((k) => dirty.add(k));
			if (whole) formTouchedWhole = true;
			saveState.set('error');
			// 22xxx / 23xxx are data or constraint errors: retrying the same
			// payload cannot succeed, so wait for the next edit instead
			const code = String(err?.code || '');
			const permanent = /^2[23]/.test(code) || code === '42703';
			if (!destroyed && !permanent) setTimeout(() => void flush(), 4000);
			return false;
		}
	}

	/** who wrote last, for the console trail (never used to skip merges) */
	function stamp(): string {
		return `${clientId}:${++myRev}`;
	}

	/** Table mode: upsert only the dirty columns. */
	async function saveTable(keys: Set<string>, whole: boolean): Promise<boolean> {
		const local = get(record);
		const form: any = local.email_data.tech_form_data || {};
		const payload: any = { event_id: eventId, rev: stamp(), updated_by: userName, updated_at: new Date().toISOString() };
		if (keys.has('crew')) payload.crew = local.crew;
		if (keys.has('tech_mail')) payload.tech_mail = local.tech_mail;
		if (keys.has('vj_mail')) payload.vj_mail = local.vj_mail;
		for (const k of DATA_KEYS) if (keys.has(k)) payload[k] = (local.email_data as any)[k] ?? null;
		for (const k of FORM_COLUMNS) {
			if (!whole && !keys.has(k)) continue;
			const v = form[k];
			// NOT NULL boolean columns: an unset flag is false, never null
			if (BOOL_COLUMNS.has(k)) payload[k] = !!v;
			else payload[k] = v ?? null;
		}

		const { data, error } = await db
			.from(EMAILTECH_TABLE)
			.upsert(payload, { onConflict: 'event_id' })
			.select('*');
		if (error) {
			if (isMissingTable(error)) {
				mode = 'legacy';
				tableMissing.set(true);
				return saveLegacy(keys, whole);
			}
			throw error;
		}
		if (!data?.length) throw new Error('Row not written (permissions?)');
		// Read-back check: every column we sent must be what the row now holds.
		const row = data[0];
		const wrong = Object.keys(payload).filter(
			(k) => !['event_id', 'rev', 'updated_by', 'updated_at'].includes(k) && !same(payload[k], row[k])
		);
		if (wrong.length) throw Object.assign(new Error(`write not confirmed for: ${wrong.join(', ')}`), { code: 'VERIFY' });
		writeSeq++;
		const at = String(row.updated_at || '');
		if (at > lastAccepted) lastAccepted = at;
		log(`saved #${eventId}`, [...keys].join(','), whole ? '(whole form)' : '', at);
		// the row we got back is the newest state: pick up what others changed meanwhile
		mergeTableRow(row);
		channel?.send({ type: 'broadcast', event: 'saved', payload: { clientId, user: userName, rev: payload.rev } });
		return true;
	}

	/** Legacy mode: read-merge-write on events.email_data. */
	async function saveLegacy(keys: Set<string>, whole: boolean): Promise<boolean> {
		const { data: row, error: readErr } = await db
			.from('events')
			.select('crew, email_data, tech_mail, vj_mail')
			.eq('event_id', eventId)
			.single();
		if (readErr) throw readErr;

		const local = get(record);
		const dbData: EmailData = (row?.email_data as EmailData) || {};
		const merged: EmailData = { ...dbData };
		for (const k of DATA_KEYS) if (keys.has(k)) (merged as any)[k] = (local.email_data as any)[k];

		const localForm = local.email_data.tech_form_data;
		const formKeys = [...keys].filter((k) => (FORM_COLUMNS as string[]).includes(k));
		if (localForm && (formKeys.length || whole)) {
			const out: any = whole ? { ...clone(localForm) } : { ...((dbData.tech_form_data || {}) as any) };
			for (const k of formKeys) out[k] = clone((localForm as any)[k]);
			merged.tech_form_data = out;
		}
		const rev = stamp();
		(merged as any)._rev = { by: clientId, rev, at: Date.now(), user: userName };

		const update: any = { email_data: merged };
		if (keys.has('crew')) update.crew = local.crew;
		if (keys.has('tech_mail')) update.tech_mail = local.tech_mail;
		if (keys.has('vj_mail')) update.vj_mail = local.vj_mail;

		const { data: written, error } = await db.from('events').update(update).eq('event_id', eventId).select('event_id');
		if (error) throw error;
		if (!written?.length) throw new Error('Row not updated (permissions?)');

		// adopt DB values for pieces we did not own
		record.update((r) => {
			const next: EmailTechRecord = { ...r, email_data: { ...merged } };
			if (!keys.has('crew') && !dirty.has('crew')) next.crew = normalizeCrew(row?.crew);
			if (!keys.has('tech_mail') && !dirty.has('tech_mail')) next.tech_mail = row?.tech_mail ?? r.tech_mail;
			if (!keys.has('vj_mail') && !dirty.has('vj_mail')) next.vj_mail = row?.vj_mail ?? r.vj_mail;
			if (localForm && next.email_data.tech_form_data) {
				const f: any = { ...next.email_data.tech_form_data };
				for (const k of dirty) if ((FORM_COLUMNS as string[]).includes(k)) f[k] = (localForm as any)[k];
				next.email_data.tech_form_data = f;
			}
			return next;
		});
		channel?.send({ type: 'broadcast', event: 'saved', payload: { clientId, user: userName, rev } });
		return true;
	}

	/* ------------------------------------------------------------ remote */

	/** Merge a remote record (already in EmailTechRecord shape) over non-dirty pieces. */
	function mergeRecord(remote: EmailTechRecord, _rev?: string | null, by?: string) {
		// No "is this my own echo" short-circuit: with column-level merging an
		// echo changes nothing (equal values, dirty keys skipped), while a row
		// stamped with our rev may still carry another client's newer columns.
		const changed: string[] = [];
		record.update((r) => {
			const next: EmailTechRecord = { ...r, email_data: { ...r.email_data } };
			if (!dirty.has('crew') && !same(remote.crew, r.crew)) {
				next.crew = remote.crew;
				changed.push('crew');
			}
			if (!dirty.has('tech_mail') && remote.tech_mail !== r.tech_mail) {
				next.tech_mail = remote.tech_mail;
				changed.push('tech_mail');
			}
			if (!dirty.has('vj_mail') && remote.vj_mail !== r.vj_mail) {
				next.vj_mail = remote.vj_mail;
				changed.push('vj_mail');
			}
			for (const k of DATA_KEYS) {
				if (dirty.has(k)) continue;
				if (!same((remote.email_data as any)[k], (r.email_data as any)[k])) {
					(next.email_data as any)[k] = clone((remote.email_data as any)[k]);
					changed.push(k);
				}
			}
			const inForm = remote.email_data.tech_form_data;
			if (inForm) {
				const cur: any = r.email_data.tech_form_data || {};
				const out: any = { ...cur };
				for (const k of new Set([...Object.keys(cur), ...Object.keys(inForm)])) {
					if (dirty.has(k)) continue;
					if (!same((inForm as any)[k], cur[k])) {
						out[k] = clone((inForm as any)[k]);
						changed.push(`form.${k}`);
					}
				}
				next.email_data.tech_form_data = out;
			}
			return next;
		});
		if (changed.length) {
			log(`remote #${eventId} by ${by || '?'}:`, changed.join(','), dirty.size ? `(kept local: ${[...dirty].join(',')})` : '');
			remoteCbs.forEach((cb) => cb(changed));
		}
	}

	function mergeTableRow(row: any) {
		if (!row) return;
		// A row older than what we last wrote/accepted is an echo that overtook
		// a newer write (or a slow refetch): applying it would revert edits.
		const at = String(row.updated_at || '');
		if (at && lastAccepted && at < lastAccepted) {
			log(`stale row #${eventId} dropped (${at} < ${lastAccepted}) by ${row.updated_by || '?'}`);
			return;
		}
		if (at > lastAccepted) lastAccepted = at;
		mergeRecord(
			{ crew: normalizeCrew(row.crew), email_data: emailDataFromRow(row), tech_mail: row.tech_mail ?? null, vj_mail: row.vj_mail ?? null },
			row.rev,
			row.updated_by
		);
	}

	function mergeLegacyRow(row: any) {
		if (!row) return;
		const data: EmailData = (row.email_data as EmailData) || {};
		mergeRecord(
			{ crew: normalizeCrew(row.crew), email_data: data, tech_mail: row.tech_mail ?? null, vj_mail: row.vj_mail ?? null },
			(data as any)?._rev?.rev,
			(data as any)?._rev?.user
		);
	}

	async function refetch() {
		const seqAtStart = writeSeq;
		if (mode === 'table') {
			const { data, error } = await db.from(EMAILTECH_TABLE).select('*').eq('event_id', eventId).maybeSingle();
			if (writeSeq !== seqAtStart) {
				log(`refetch #${eventId} discarded (we wrote meanwhile)`);
				return;
			}
			if (error && isMissingTable(error)) {
				mode = 'legacy';
				tableMissing.set(true);
			} else if (data) {
				mergeTableRow(data);
				return;
			}
		}
		if (mode === 'legacy') {
			const { data } = await db.from('events').select('crew, email_data, tech_mail, vj_mail').eq('event_id', eventId).maybeSingle();
			if (data) mergeLegacyRow(data);
		}
	}

	/** Make sure the table row exists (seeded from the old columns the first time). */
	async function ensureRow() {
		if (mode !== 'table') return;
		const { data, error } = await db.from(EMAILTECH_TABLE).select('*').eq('event_id', eventId).maybeSingle();
		if (error) {
			if (isMissingTable(error)) {
				mode = 'legacy';
				tableMissing.set(true);
			}
			return;
		}
		if (data) {
			log(`open #${eventId} (row from ${data.updated_by || '?'} @ ${data.updated_at})`);
			mergeTableRow(data);
			return;
		}
		log(`open #${eventId}: no row yet, seeding from events columns`);
		// first time on this event with the new table: copy what the old columns had
		const local = get(record);
		const form: any = local.email_data.tech_form_data || {};
		const seed: any = {
			event_id: eventId,
			crew: local.crew,
			tech_status: local.email_data.tech_status || 'todo',
			vj_status: local.email_data.vj_status || 'todo',
			linked_event_ids: local.email_data.linked_event_ids || [],
			schedule_row_id: local.email_data.schedule_row_id ?? null,
			tech_mail: local.tech_mail,
			vj_mail: local.vj_mail,
			rev: stamp(),
			updated_by: userName
		};
		for (const k of FORM_COLUMNS) {
			if (BOOL_COLUMNS.has(k)) seed[k] = !!form[k];
			else if (form[k] !== undefined) seed[k] = form[k];
		}
		const { error: insErr } = await db.from(EMAILTECH_TABLE).upsert(seed, { onConflict: 'event_id', ignoreDuplicates: true });
		if (insErr) console.warn('[emailtech sync] seed failed:', insErr.message);
	}

	/* ---------------------------------------------------------- channel */

	let channel: RealtimeChannel | null = null;

	function updatePeers() {
		if (!channel) return;
		const state = channel.presenceState() as Record<string, any[]>;
		const list: Peer[] = [];
		Object.values(state).forEach((arr) =>
			arr.forEach((p: any) => {
				if (!p?.clientId || p.clientId === clientId) return;
				list.push({ clientId: p.clientId, user: p.user || 'Someone', section: p.section ?? null, color: colorFor(p.clientId) });
			})
		);
		peers.set(list);
		log(`peers #${eventId}:`, list.map((p) => p.user).join(', ') || 'none');
	}

	function announceTouch() {
		if (!channel || channel.state !== 'joined' || !mySection) return;
		channel.send({ type: 'broadcast', event: 'touch', payload: { clientId, user: userName, section: mySection } });
	}

	function receiveTouch(p: any) {
		if (!p?.section || p.clientId === clientId) return;
		const section = String(p.section);
		touched.update((t) => ({ ...t, [section]: { user: p.user || 'Someone', color: colorFor(p.clientId), at: Date.now() } }));
		const old = touchTimers.get(section);
		if (old) clearTimeout(old);
		touchTimers.set(
			section,
			setTimeout(() => {
				touched.update((t) => {
					const n = { ...t };
					delete n[section];
					return n;
				});
			}, TOUCH_TTL)
		);
	}

	function connect() {
		const ch = db.channel(`emailtech-${eventId}`, {
			config: { presence: { key: clientId }, broadcast: { self: false } }
		}) as RealtimeChannel;
		channel = ch;
		ch
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: EMAILTECH_TABLE, filter: `event_id=eq.${eventId}` },
				(payload) => {
					if (mode === 'table' && payload.eventType !== 'DELETE') mergeTableRow(payload.new as any);
				}
			)
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'events', filter: `event_id=eq.${eventId}` },
				(payload) => {
					if (mode === 'legacy') mergeLegacyRow(payload.new as any);
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'events_advance', filter: `event_id=eq.${eventId}` },
				() => advanceCbs.forEach((cb) => cb())
			)
			.on('presence', { event: 'sync' }, updatePeers)
			.on('broadcast', { event: 'touch' }, ({ payload }) => receiveTouch(payload))
			.on('broadcast', { event: 'saved' }, ({ payload }) => {
				if (payload?.clientId !== clientId) void refetch();
			})
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') channel?.track({ clientId, user: userName, section: mySection });
			});
	}

	function focus(section: string | null) {
		if (section === mySection) return;
		mySection = section;
		if (channel && channel.state === 'joined') {
			channel.track({ clientId, user: userName, section });
			announceTouch();
		}
	}

	function hasUnsaved(): boolean {
		return dirty.size > 0 || formTouchedWhole || !!saving;
	}

	async function destroy(): Promise<boolean> {
		destroyed = true;
		if (timer) clearTimeout(timer);
		touchTimers.forEach((t) => clearTimeout(t));
		const ok = await flush();
		if (!ok) log(`destroy #${eventId}: last save FAILED, unsaved: ${[...dirty].join(',')}`);
		if (channel) {
			await db.removeChannel(channel);
			channel = null;
		}
		return ok;
	}

	connect();
	void ensureRow();

	return {
		record: { subscribe: record.subscribe },
		saveState: { subscribe: saveState.subscribe },
		peers: { subscribe: peers.subscribe },
		touched: { subscribe: touched.subscribe },
		onRemote(cb) {
			remoteCbs.add(cb);
			return () => remoteCbs.delete(cb);
		},
		onAdvance(cb) {
			advanceCbs.add(cb);
			return () => advanceCbs.delete(cb);
		},
		setForm,
		replaceForm,
		setCrew,
		setStatus,
		setLinked,
		setPinnedRow,
		setMail,
		focus,
		flush,
		hasUnsaved,
		destroy
	};
}

/** Pieces of the form that belong to each section card (for "edited by" + merge). */
export const SECTION_FORM_KEYS: Record<string, FormKey[]> = {
	header: ['liaison', 'greeting_custom', 'greeting_text', 'second_event'],
	crew_call: ['crew_calls', 'crew_calls_manual'],
	team_notes: ['team_notes'],
	specs: ['specs_links', 'projects'],
	visuals: ['projector_outdoor', 'visuals_interior', 'visuals_custom', 'artwork_removal_off', 'sponsor_name', 'sponsor_link', 'sponsor_notes'],
	set_times: ['set_times'],
	soundcheck: ['soundcheck'],
	lounge_ambiance: ['lounge_ambiance'],
	backline: ['backline', 'riders_attached'],
	travelling: ['travelling_party'],
	vj: ['vj_schedule'],
	lights: ['lights'],
	sfx: ['sfx'],
	sponsors: ['post_show', 'sponsors'],
	vj_notes: ['vj_notes'],
	vj_visuals: ['vj_visuals']
};
