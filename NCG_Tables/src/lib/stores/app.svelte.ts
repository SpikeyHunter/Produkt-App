import {
  clone, venueForEvent, DEFAULT_THEME,
  type EventRow, type GuestTheme, type LayoutElement, type LayoutTemplate,
  type TablesEvent, type TablesReservation, type Venue
} from '$lib/layout';
import { seedEvents, seedTemplates, seedVenues } from '$lib/seed';
import { supabase, hasSupabase } from '$lib/supabase';

const ACTIVE = ['pending', 'deposit_paid', 'confirmed'];

class AppStore {
  venues = $state<Venue[]>([]);
  templates = $state<LayoutTemplate[]>([]);
  events = $state<EventRow[]>([]);            // from your existing `events` table
  tablesEvents = $state<TablesEvent[]>([]);
  reservations = $state<TablesReservation[]>([]);
  theme = $state<GuestTheme>({ ...DEFAULT_THEME });

  loaded = $state(false);
  usingMock = $state(true);

  async load() {
    if (this.loaded) return;
    if (hasSupabase && supabase) {
      const [v, t, e, te, r, s] = await Promise.all([
        supabase.from('tables_venues').select('*'),
        supabase.from('tables_templates').select('*'),
        supabase.from('events').select('event_id,event_name,event_date,event_status,event_flyer,event_venue,color').order('event_date', { ascending: false }).limit(300),
        supabase.from('tables_events').select('*'),
        supabase.from('tables_reservations').select('*').order('created_at', { ascending: false }),
        supabase.from('tables_settings').select('*').eq('key', 'guest_theme').maybeSingle()
      ]);
      this.usingMock = !!v.error;
      this.venues = (v.data as Venue[])?.length ? (v.data as Venue[]) : seedVenues();
      this.templates = (t.data as LayoutTemplate[])?.length ? (t.data as LayoutTemplate[]) : seedTemplates();
      this.events = (e.data as EventRow[]) ?? seedEvents();
      this.tablesEvents = (te.data as TablesEvent[]) ?? [];
      this.reservations = (r.data as TablesReservation[]) ?? [];
      if (s.data?.value) this.theme = { ...DEFAULT_THEME, ...(s.data.value as Partial<GuestTheme>) };
    } else {
      this.venues = seedVenues();
      this.templates = seedTemplates();
      this.events = seedEvents();
    }
    this.loaded = true;
  }

  // ── lookups ────────────────────────────────────────────────
  venue = (id: string | null | undefined) => this.venues.find((v) => v.id === id) ?? null;
  template = (id: string | null | undefined) => this.templates.find((t) => t.id === id) ?? null;
  eventRow = (event_id: number | null) => this.events.find((e) => e.event_id === event_id) ?? null;
  tablesEvent = (id: string | null | undefined) => this.tablesEvents.find((t) => t.id === id) ?? null;
  tablesEventFor = (event_id: number) => this.tablesEvents.find((t) => t.event_id === event_id) ?? null;

  activeReservations(tablesEventId: string) {
    return this.reservations.filter((r) => r.tables_event_id === tablesEventId && ACTIVE.includes(r.status));
  }
  /** element ids taken by an active reservation for this tables_event */
  takenIds(tablesEventId: string): Set<string> {
    return new Set(this.activeReservations(tablesEventId).map((r) => r.element_id));
  }
  stats(te: TablesEvent) {
    const bookable = te.elements.filter((el) => el.bookable && !el.disabled);
    const taken = this.takenIds(te.id);
    const booked = bookable.filter((el) => taken.has(el.id));
    return {
      total: bookable.length,
      booked: booked.length,
      pct: bookable.length ? booked.length / bookable.length : 0,
      revenue: booked.reduce((s, el) => s + el.price, 0),
      deposits: booked.reduce((s, el) => s + el.deposit, 0)
    };
  }

  // ── venues / templates ─────────────────────────────────────
  async saveVenue(v: Venue) {
    this.venues = this.venues.map((x) => (x.id === v.id ? v : x));
    if (!this.venues.some((x) => x.id === v.id)) this.venues = [...this.venues, v];
    if (hasSupabase && supabase) return (await supabase.from('tables_venues').upsert(v)).error;
    return null;
  }
  async addVenue(name: string) {
    const v: Venue = { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name, width: 20, depth: 12, height: 5, geometry: [] };
    this.venues = [...this.venues, v];
    if (hasSupabase && supabase) await supabase.from('tables_venues').upsert(v);
    return v;
  }
  async saveTemplate(t: LayoutTemplate) {
    this.templates = this.templates.some((x) => x.id === t.id)
      ? this.templates.map((x) => (x.id === t.id ? t : x))
      : [...this.templates, t];
    if (hasSupabase && supabase) return (await supabase.from('tables_templates').upsert(t)).error;
    return null;
  }
  async addTemplate(venue_id: string, name: string, from?: LayoutTemplate) {
    const t: LayoutTemplate = { id: crypto.randomUUID(), venue_id, name, elements: from ? clone(from.elements) : [] };
    await this.saveTemplate(t);
    return t;
  }

  // ── tables_events ──────────────────────────────────────────
  async createTablesEvent(ev: EventRow, templateId: string | null) {
    const venue_id = venueForEvent(ev);
    const tpl = this.template(templateId) ?? this.templates.find((t) => t.venue_id === venue_id) ?? null;
    const te: TablesEvent = {
      id: crypto.randomUUID(),
      event_id: ev.event_id,
      venue_id,
      template_id: tpl?.id ?? null,
      elements: tpl ? clone(tpl.elements) : [],
      is_public: false,
      publish_at: null,
      booking_cutoff_hour: 23,
      selection_mode: 'table',
      tags: [],
      theme: null
    };
    this.tablesEvents = [...this.tablesEvents, te];
    if (hasSupabase && supabase) await supabase.from('tables_events').insert(te);
    return te;
  }
  async saveTablesEvent(te: TablesEvent) {
    this.tablesEvents = this.tablesEvents.map((x) => (x.id === te.id ? te : x));
    if (hasSupabase && supabase) return (await supabase.from('tables_events').upsert(te)).error;
    return null;
  }
  async deleteTablesEvent(id: string) {
    this.tablesEvents = this.tablesEvents.filter((x) => x.id !== id);
    if (hasSupabase && supabase) await supabase.from('tables_events').delete().eq('id', id);
  }

  // ── reservations ───────────────────────────────────────────
  async addReservation(r: Omit<TablesReservation, 'id'>) {
    const row: TablesReservation = { id: crypto.randomUUID(), ...r };
    this.reservations = [row, ...this.reservations];
    if (hasSupabase && supabase) {
      const { error } = await supabase.from('tables_reservations').insert(row);
      if (error) throw error;
    }
    return row;
  }
  async setReservationStatus(id: string, status: TablesReservation['status']) {
    this.reservations = this.reservations.map((r) => (r.id === id ? { ...r, status } : r));
    if (hasSupabase && supabase) await supabase.from('tables_reservations').update({ status }).eq('id', id);
  }

  // ── theme ──────────────────────────────────────────────────
  async saveTheme(theme: GuestTheme) {
    this.theme = theme;
    if (hasSupabase && supabase) {
      await supabase.from('tables_settings').upsert({ key: 'guest_theme', value: theme });
    }
  }
}

export const app = new AppStore();
