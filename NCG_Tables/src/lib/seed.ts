import { clone, type EventRow, type LayoutElement, type LayoutTemplate, type Venue } from '$lib/layout';

const el = (p: Partial<LayoutElement> & Pick<LayoutElement, 'id' | 'kind' | 'name' | 'x' | 'y' | 'w' | 'd'>): LayoutElement => ({
  h: 0.75, elevation: 0, rotation: 0, section: 'Floor',
  bookable: false, capacity: 0, price: 0, deposit: 0, ...p
});

// ── Default venues (architecture only — NO tables) ───────────

export const SEED_VENUES: Venue[] = [
  {
    id: 'main_room',
    name: 'Main Room',
    width: 38, depth: 15, height: 8,
    geometry: [
      el({ id: 'mr-stage', kind: 'stage', name: 'Stage', x: 33, y: 3.5, w: 4.5, d: 8, h: 1.4 }),
      el({ id: 'mr-mezz-n', kind: 'mezzanine', name: 'Mezzanine N', x: 6, y: 0.3, w: 26, d: 2.6, h: 0.9 }),
      el({ id: 'mr-mezz-s', kind: 'mezzanine', name: 'Mezzanine S', x: 12, y: 12.1, w: 20, d: 2.6, h: 0.9 }),
      el({ id: 'mr-foh', kind: 'riser', name: 'FOH / VIP', x: 0.4, y: 3.5, w: 6.5, d: 8, h: 0.6 }),
      el({ id: 'mr-wall-1', kind: 'wall', name: 'Divider', x: 6, y: 3, w: 0.25, d: 4, h: 3 })
    ]
  },
  {
    id: 'lounge',
    name: 'Lounge',
    width: 14, depth: 10, height: 5,
    geometry: [
      el({ id: 'lg-dj', kind: 'dj', name: 'DJ', x: 5.5, y: 0.4, w: 3, d: 1.4, h: 1 }),
      el({ id: 'lg-alcove', kind: 'cavity', name: 'Alcove', x: 0.3, y: 6.5, w: 2.5, d: 3, h: 0.35, elevation: -0.35 })
    ]
  }
];

// ── Starter templates (tables + pricing per venue) ───────────

export const SEED_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'tpl-main-standard',
    venue_id: 'main_room',
    name: 'NCG Standard',
    elements: [
      // North mezzanine banquettes (elevated with the platform)
      ...[0, 1, 2, 3, 4].map((i) =>
        el({ id: `mn${i + 1}`, kind: 'banquette', name: `M${i + 1}`, x: 7 + i * 5, y: 0.8, w: 2.4, d: 1.5,
          elevation: 0.9, section: 'Mezzanine N', bookable: true, capacity: 8, price: 900, deposit: 300 })
      ),
      // South mezzanine — 3 VIP boxes, L-shaped banquettes
      ...[0, 1, 2].map((i) =>
        el({ id: `box${i + 1}`, kind: 'banquette', name: `Box ${i + 1}`, x: 13 + i * 6.5, y: 12.6, w: 4, d: 1.7,
          elevation: 0.9, l: { w: 1.4, d: 0.8 }, section: 'VIP Boxes', bookable: true,
          capacity: 12, price: 2200, deposit: 800 })
      ),
      // FOH / VIP platform
      el({ id: 'vw1', kind: 'banquette', name: 'VIP W1', x: 0.9, y: 4.2, w: 2.2, d: 1.5, elevation: 0.6,
        section: 'FOH VIP', bookable: true, capacity: 10, price: 1500, deposit: 500 }),
      el({ id: 'vw2', kind: 'banquette', name: 'VIP W2', x: 0.9, y: 9, w: 2.2, d: 1.5, elevation: 0.6,
        section: 'FOH VIP', bookable: true, capacity: 10, price: 1500, deposit: 500 }),
      // Dance floor
      ...[
        { id: 'df1', x: 28.5, y: 5, price: 1800, dep: 600 },
        { id: 'df2', x: 28.5, y: 8.5, price: 1800, dep: 600 },
        { id: 'df3', x: 24.5, y: 5, price: 1200, dep: 400 },
        { id: 'df4', x: 24.5, y: 8.5, price: 1200, dep: 400 }
      ].map((t, i) =>
        el({ id: t.id, kind: 'standup', name: `DF${i + 1}`, x: t.x, y: t.y, w: 1.1, d: 1.1, h: 1.05,
          section: 'Dance Floor', bookable: true, capacity: 6, price: t.price, deposit: t.dep })
      ),
      el({ id: 'bar-n', kind: 'bar', name: 'Bar', x: 10, y: 3.2, w: 10, d: 1, h: 1.1, section: 'Floor' })
    ]
  },
  {
    id: 'tpl-lounge-standard',
    venue_id: 'lounge',
    name: 'Lounge Standard',
    elements: [
      ...[0, 1, 2].map((i) =>
        el({ id: `lb${i + 1}`, kind: 'banquette', name: `L${i + 1}`, x: 1.5 + i * 4, y: 3.8, w: 2.2, d: 1.5,
          l: { w: 0.8, d: 0.6 }, section: 'Booths', bookable: true, capacity: 8,
          price: i === 1 ? 900 : 650, deposit: i === 1 ? 350 : 250 })
      ),
      ...[0, 1].map((i) =>
        el({ id: `ls${i + 1}`, kind: 'standup', name: `S${i + 1}`, x: 3.5 + i * 4, y: 7.3, w: 0.9, d: 0.9, h: 1.05,
          section: 'Floor', bookable: true, capacity: 4, price: 350, deposit: 150 })
      ),
      el({ id: 'lg-bar', kind: 'bar', name: 'Bar', x: 11.5, y: 2, w: 1.2, d: 6, h: 1.1 })
    ]
  }
];

// ── Sample events (mock mode fallback — mirrors your `events` table) ──

export const SEED_EVENTS: EventRow[] = [
  { event_id: 200970, event_name: 'R3HAB, Invités Surprises', event_date: '2026-09-26',
    event_status: 'LIVE', event_flyer: 'https://static.tixr.com/static/images/external/img/350f073d-69ae-4e02-b196-5f6dac8c7fd4.jpg',
    event_venue: 'New City Gas', color: '#00FFFF' },
  { event_id: 190292, event_name: 'Apache, Blanca, Frank Lat', event_date: '2026-09-25',
    event_status: 'LIVE', event_flyer: 'https://static.tixr.com/static/images/external/img/c7304300-a18b-4af4-84ad-e30321596950.jpg',
    event_venue: 'Bazart', color: '#B29566' },
  { event_id: 186990, event_name: 'Baron (FR), Mekki, Chrissandro', event_date: '2026-09-18',
    event_status: 'LIVE', event_flyer: 'https://static.tixr.com/static/images/external/img/219088ef-29ca-4b99-8964-a7a3e8248b5c.jpg',
    event_venue: 'Bazart', color: '#B29566' },
  { event_id: 170001, event_name: 'Adventure Club b2b Invité.e Special.e', event_date: '2026-08-07',
    event_status: 'LIVE', event_flyer: null, event_venue: 'New City Gas', color: null },
  { event_id: 150000, event_name: 'Old Show', event_date: '2026-05-01',
    event_status: 'PAST', event_flyer: null, event_venue: 'New City Gas', color: null }
];

export const seedVenues = () => clone(SEED_VENUES);
export const seedTemplates = () => clone(SEED_TEMPLATES);
export const seedEvents = () => clone(SEED_EVENTS);
