# NCG Tables v3

Venue table reservations — SvelteKit + Threlte + Supabase.

## Structure
- **/** — dashboard: every reservation setup, fill %, revenue, almost-soldout badges, LIVE/PAST
- **/events** — your real `events` table (excluded words filtered, Tixr-link check) → create/manage a reservation setup per event
- **/events/[id]** — per-event editor: visibility (+ scheduled publish, ET booking cutoff), table vs section booking, tags, event-specific floor plan, reservations
- **/venues** — venue architect (architecture only): walls, mezzanines, risers, cavities, custom drawn shapes with 3D extrusion
- **/templates** — table layouts per venue: banquettes (L-shape support), standup tables, bars, pricing, sections
- **/settings** — guest site theme (colors/gradient/font), stored in DB
- **/book** — guest site (themed, flyers, tags) → 3D picker → checkout

## Data model (all prefixed tables_)
tables_venues · tables_templates · tables_events (soft-linked to events.event_id) · tables_reservations · tables_settings

Run `supabase/tables_schema.sql` in the Supabase SQL editor. Without .env the app runs on mock data.

Dev: `npm install && npm run dev` → http://localhost:3333
