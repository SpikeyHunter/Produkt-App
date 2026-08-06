// ─────────────────────────────────────────────────────────────
// NCG Tables v3 — core data model
// Everything lives in METERS. 2D renders m * PX_PER_M, 3D renders m.
//
// venues     → architecture only (walls, cavities, platforms, custom shapes)
// templates  → table layouts for a venue (banquettes, standups, bars) + pricing
// tables_events → a template CLONED for a real event (customizable per event)
// reservations  → bookings against a tables_event's element ids
// ─────────────────────────────────────────────────────────────

export type ElementKind =
  | 'banquette' | 'standup' | 'bar' | 'stage' | 'dj'      // furniture
  | 'wall' | 'cavity' | 'riser' | 'mezzanine' | 'custom'; // architecture

export const FURNITURE: ElementKind[] = ['banquette', 'standup', 'bar', 'stage', 'dj'];
export const ARCHITECTURE: ElementKind[] = ['wall', 'cavity', 'riser', 'mezzanine', 'custom'];

export interface LayoutElement {
  id: string;
  kind: ElementKind;
  name: string;
  x: number; y: number;          // meters from room top-left
  w: number; d: number;          // footprint
  h: number;                     // extrusion height (3D)
  elevation: number;             // base height above ground (0 = floor)
  rotation: number;              // degrees
  l?: { w: number; d: number };  // banquette L-shape: cut rectangle at the SE corner
  points?: [number, number][];   // custom polygon (meters, relative to x/y), extruded by h
  section: string;               // grouping ("Mezzanine N", "VIP Boxes"…)
  bookable: boolean;
  capacity: number;
  price: number;                 // minimum spend (CAD)
  deposit: number;               // non-refundable deposit (CAD)
  disabled?: boolean;            // per-event: hidden from guests + unbookable
  color?: string;
}

export interface Venue {
  id: string;                    // 'main_room', 'lounge', custom slugs
  name: string;
  width: number; depth: number; height: number;
  geometry: LayoutElement[];     // architecture elements
}

export interface LayoutTemplate {
  id: string;
  venue_id: string;
  name: string;
  elements: LayoutElement[];
}

export interface TablesEvent {
  id: string;
  event_id: number | null;       // soft link → events.event_id (survives event edits)
  venue_id: string;
  template_id: string | null;
  elements: LayoutElement[];     // event-specific copy (source of truth for this event)
  is_public: boolean;
  publish_at: string | null;     // scheduled visibility (timestamptz ISO)
  booking_cutoff_hour: number | null; // ET hour on event day after which booking closes
  selection_mode: 'table' | 'section';
  tags: string[];
  theme: Record<string, string> | null;
  created_at?: string;
}

export interface EventRow {
  event_id: number;
  event_name: string;
  event_date: string | null;
  event_status: string | null;   // 'LIVE' | 'PAST' | …
  event_flyer: string | null;
  event_venue: string | null;
  color: string | null;
}

export interface TablesReservation {
  id: string;
  tables_event_id: string;
  element_id: string;
  element_name: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  party_size: number;
  deposit_amount: number;
  total_amount: number;
  status: 'pending' | 'deposit_paid' | 'confirmed' | 'cancelled' | 'no_show';
  stripe_payment_intent: string | null;
  notes: string | null;
  created_at?: string;
}

export interface GuestTheme {
  bg1: string; bg2: string; panel: string;
  accent: string; glow: string; text: string; dim: string;
  font: 'marcellus' | 'inter' | 'mono';
}

export const DEFAULT_THEME: GuestTheme = {
  bg1: '#0d0805', bg2: '#2a180c', panel: '#1a110a',
  accent: '#c97b3d', glow: '#ff9e4f', text: '#f0e6d8', dim: '#a08b76',
  font: 'marcellus'
};

// ── Filtering / linking ──────────────────────────────────────

export const EXCLUDED_EVENT_WORDS = [
  'test', 'réservations', 'reservations', 'pass', 'event',
  'template', 'produktworld', 'piknic', 'oktoberfest'
];

export function isExcludedEvent(name: string): boolean {
  const n = name.toLowerCase();
  return EXCLUDED_EVENT_WORDS.some((w) => n.includes(w));
}

export function isTixrLinked(e: EventRow): boolean {
  return !!e.event_flyer && e.event_flyer.includes('static.tixr.com');
}

/** event_venue → venue id. Extend as you add rooms. */
export function venueForEvent(e: EventRow): string {
  const v = (e.event_venue ?? '').toLowerCase();
  if (v.includes('bazart')) return 'lounge';
  return 'main_room'; // New City Gas + default
}

// ── Booking-time rules (America/Toronto = Montréal) ─────────

export function easternNow(): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** true → booking window closed (event day past cutoff hour, or event day gone) */
export function isPastCutoff(eventDate: string | null, cutoffHour: number | null): boolean {
  if (!eventDate) return false;
  const now = easternNow();
  if (now.date < eventDate) return false;
  if (now.date > eventDate) return true;
  return cutoffHour == null ? false : now.hour >= cutoffHour;
}

export function isGuestVisible(te: TablesEvent, ev: EventRow | null): boolean {
  if (!te.is_public) return false;
  if (ev && (ev.event_status ?? '').toUpperCase() === 'PAST') return false; // auto-disable
  if (te.publish_at && new Date(te.publish_at) > new Date()) return false;
  return true;
}

// ── Pricing tiers ────────────────────────────────────────────

export function tierOf(price: number): { name: string; color: string } {
  if (price >= 1800) return { name: 'DIAMOND', color: '#5db8ff' };
  if (price >= 1000) return { name: 'PRESTIGE', color: '#8ade63' };
  return { name: 'GOLD', color: '#f2b83c' };
}

export const ADMIN_FEE_RATE = 0.045;

export const money = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 });

export const PRESET_TAGS = ['SOLD OUT', 'FEW TABLES LEFT', 'LAST CALL', 'NEW'];

// ── Element factories ────────────────────────────────────────

const base = (): Omit<LayoutElement, 'id' | 'kind' | 'name'> => ({
  x: 2, y: 2, w: 2, d: 1, h: 0.75, elevation: 0, rotation: 0,
  section: 'Floor', bookable: false, capacity: 0, price: 0, deposit: 0
});

export function makeElement(kind: ElementKind, n = 1): LayoutElement {
  const id = crypto.randomUUID();
  switch (kind) {
    case 'banquette':
      return { ...base(), id, kind, name: `B${n}`, w: 2.4, d: 1.6, h: 0.75,
        bookable: true, capacity: 8, price: 1200, deposit: 400, section: 'Floor' };
    case 'standup':
      return { ...base(), id, kind, name: `T${n}`, w: 0.9, d: 0.9, h: 1.05,
        bookable: true, capacity: 4, price: 400, deposit: 150 };
    case 'bar':
      return { ...base(), id, kind, name: 'Bar', w: 6, d: 1, h: 1.1 };
    case 'stage':
      return { ...base(), id, kind, name: 'Stage', w: 8, d: 4, h: 1.4 };
    case 'dj':
      return { ...base(), id, kind, name: 'DJ', w: 2.6, d: 1.2, h: 1 };
    case 'wall':
      return { ...base(), id, kind, name: 'Wall', w: 4, d: 0.25, h: 3 };
    case 'cavity':
      return { ...base(), id, kind, name: 'Cavity', w: 3, d: 2, h: 0.4, elevation: -0.4 };
    case 'riser':
      return { ...base(), id, kind, name: 'Riser', w: 5, d: 4, h: 0.6 };
    case 'mezzanine':
      return { ...base(), id, kind, name: 'Mezzanine', w: 10, d: 2.6, h: 0.9 };
    case 'custom':
      return { ...base(), id, kind, name: 'Shape', w: 3, d: 3, h: 1,
        points: [[0, 0], [3, 0], [3, 2], [1.5, 3], [0, 2]] };
  }
}

export const isPlatform = (k: ElementKind) =>
  k === 'riser' || k === 'mezzanine' || k === 'stage' || k === 'cavity' || k === 'wall';

export const clone = <T>(v: T): T => structuredClone(v);
export const PX_PER_M = 32;
