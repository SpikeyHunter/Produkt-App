-- ─────────────────────────────────────────────────────────────
-- NCG Tables v3 — full schema (all tables prefixed tables_)
-- Safe to run on your existing project: does NOT touch `events`.
-- Drops the v1/v2 tables + the old tables_ set if present.
-- ─────────────────────────────────────────────────────────────

drop table if exists reservations cascade;
drop table if exists venue_tables cascade;
drop table if exists floor_plans cascade;

drop table if exists tables_reservations cascade;
drop table if exists tables_events cascade;
drop table if exists tables_templates cascade;
drop table if exists tables_venues cascade;
drop table if exists tables_settings cascade;

-- Venue architecture (rooms only — walls, mezzanines, cavities…)
create table tables_venues (
  id text primary key,               -- 'main_room', 'lounge', custom slugs
  name text not null,
  width numeric not null,
  depth numeric not null,
  height numeric not null default 5,
  geometry jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Table layout templates per venue (furniture + pricing)
create table tables_templates (
  id text primary key,
  venue_id text not null references tables_venues(id) on delete cascade,
  name text not null,
  elements jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- One reservation setup per real event.
-- event_id is a SOFT link to events.event_id (no FK on purpose:
-- the event row can be edited/re-synced without breaking this).
create table tables_events (
  id text primary key,
  event_id bigint,
  venue_id text not null references tables_venues(id),
  template_id text references tables_templates(id) on delete set null,
  elements jsonb not null default '[]'::jsonb,   -- event-customized layout
  is_public boolean not null default false,
  publish_at timestamptz,
  booking_cutoff_hour int check (booking_cutoff_hour between 0 and 23),
  selection_mode text not null default 'table' check (selection_mode in ('table','section')),
  tags text[] not null default '{}',
  theme jsonb,
  created_at timestamptz default now()
);
create index tables_events_event_id_idx on tables_events(event_id);

-- Guest reservations against a tables_event element
create table tables_reservations (
  id text primary key,
  tables_event_id text not null references tables_events(id) on delete cascade,
  element_id text not null,
  element_name text not null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  party_size int not null default 2,
  deposit_amount numeric not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','deposit_paid','confirmed','cancelled','no_show')),
  stripe_payment_intent text,
  notes text,
  created_at timestamptz default now()
);
create index tables_reservations_event_idx on tables_reservations(tables_event_id);

-- Key/value settings (guest theme lives at key 'guest_theme')
create table tables_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ── Realtime ────────────────────────────────────────────────
alter publication supabase_realtime add table tables_reservations;
alter publication supabase_realtime add table tables_events;

-- ── RLS (DEV policies — lock down before launch) ────────────
alter table tables_venues enable row level security;
alter table tables_templates enable row level security;
alter table tables_events enable row level security;
alter table tables_reservations enable row level security;
alter table tables_settings enable row level security;

create policy "dev all tables_venues" on tables_venues for all using (true) with check (true);
create policy "dev all tables_templates" on tables_templates for all using (true) with check (true);
create policy "dev all tables_events" on tables_events for all using (true) with check (true);
create policy "dev all tables_reservations" on tables_reservations for all using (true) with check (true);
create policy "dev all tables_settings" on tables_settings for all using (true) with check (true);

-- The app also reads your existing `events` table with the anon key.
-- If it has RLS enabled without a select policy, add one:
-- create policy "anon read events" on events for select using (true);

-- ── Seed: 2 default venues (architecture only) ──────────────
insert into tables_venues (id, name, width, depth, height, geometry) values
('main_room', 'Main Room', 38, 15, 8, '[
  {"id":"mr-stage","kind":"stage","name":"Stage","x":33,"y":3.5,"w":4.5,"d":8,"h":1.4,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0},
  {"id":"mr-mezz-n","kind":"mezzanine","name":"Mezzanine N","x":6,"y":0.3,"w":26,"d":2.6,"h":0.9,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0},
  {"id":"mr-mezz-s","kind":"mezzanine","name":"Mezzanine S","x":12,"y":12.1,"w":20,"d":2.6,"h":0.9,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0},
  {"id":"mr-foh","kind":"riser","name":"FOH / VIP","x":0.4,"y":3.5,"w":6.5,"d":8,"h":0.6,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0},
  {"id":"mr-wall-1","kind":"wall","name":"Divider","x":6,"y":3,"w":0.25,"d":4,"h":3,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0}
]'::jsonb),
('lounge', 'Lounge', 14, 10, 5, '[
  {"id":"lg-dj","kind":"dj","name":"DJ","x":5.5,"y":0.4,"w":3,"d":1.4,"h":1,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0},
  {"id":"lg-alcove","kind":"cavity","name":"Alcove","x":0.3,"y":6.5,"w":2.5,"d":3,"h":0.35,"elevation":-0.35,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0}
]'::jsonb);

-- ── Seed: starter table templates ───────────────────────────
insert into tables_templates (id, venue_id, name, elements) values
('tpl-main-standard', 'main_room', 'NCG Standard', '[
  {"id":"mn1","kind":"banquette","name":"M1","x":7,"y":0.8,"w":2.4,"d":1.5,"h":0.75,"elevation":0.9,"rotation":0,"section":"Mezzanine N","bookable":true,"capacity":8,"price":900,"deposit":300},
  {"id":"mn2","kind":"banquette","name":"M2","x":12,"y":0.8,"w":2.4,"d":1.5,"h":0.75,"elevation":0.9,"rotation":0,"section":"Mezzanine N","bookable":true,"capacity":8,"price":900,"deposit":300},
  {"id":"mn3","kind":"banquette","name":"M3","x":17,"y":0.8,"w":2.4,"d":1.5,"h":0.75,"elevation":0.9,"rotation":0,"section":"Mezzanine N","bookable":true,"capacity":8,"price":900,"deposit":300},
  {"id":"mn4","kind":"banquette","name":"M4","x":22,"y":0.8,"w":2.4,"d":1.5,"h":0.75,"elevation":0.9,"rotation":0,"section":"Mezzanine N","bookable":true,"capacity":8,"price":900,"deposit":300},
  {"id":"mn5","kind":"banquette","name":"M5","x":27,"y":0.8,"w":2.4,"d":1.5,"h":0.75,"elevation":0.9,"rotation":0,"section":"Mezzanine N","bookable":true,"capacity":8,"price":900,"deposit":300},
  {"id":"box1","kind":"banquette","name":"Box 1","x":13,"y":12.6,"w":4,"d":1.7,"h":0.75,"elevation":0.9,"rotation":0,"l":{"w":1.4,"d":0.8},"section":"VIP Boxes","bookable":true,"capacity":12,"price":2200,"deposit":800},
  {"id":"box2","kind":"banquette","name":"Box 2","x":19.5,"y":12.6,"w":4,"d":1.7,"h":0.75,"elevation":0.9,"rotation":0,"l":{"w":1.4,"d":0.8},"section":"VIP Boxes","bookable":true,"capacity":12,"price":2200,"deposit":800},
  {"id":"box3","kind":"banquette","name":"Box 3","x":26,"y":12.6,"w":4,"d":1.7,"h":0.75,"elevation":0.9,"rotation":0,"l":{"w":1.4,"d":0.8},"section":"VIP Boxes","bookable":true,"capacity":12,"price":2200,"deposit":800},
  {"id":"vw1","kind":"banquette","name":"VIP W1","x":0.9,"y":4.2,"w":2.2,"d":1.5,"h":0.75,"elevation":0.6,"rotation":0,"section":"FOH VIP","bookable":true,"capacity":10,"price":1500,"deposit":500},
  {"id":"vw2","kind":"banquette","name":"VIP W2","x":0.9,"y":9,"w":2.2,"d":1.5,"h":0.75,"elevation":0.6,"rotation":0,"section":"FOH VIP","bookable":true,"capacity":10,"price":1500,"deposit":500},
  {"id":"df1","kind":"standup","name":"DF1","x":28.5,"y":5,"w":1.1,"d":1.1,"h":1.05,"elevation":0,"rotation":0,"section":"Dance Floor","bookable":true,"capacity":6,"price":1800,"deposit":600},
  {"id":"df2","kind":"standup","name":"DF2","x":28.5,"y":8.5,"w":1.1,"d":1.1,"h":1.05,"elevation":0,"rotation":0,"section":"Dance Floor","bookable":true,"capacity":6,"price":1800,"deposit":600},
  {"id":"df3","kind":"standup","name":"DF3","x":24.5,"y":5,"w":1.1,"d":1.1,"h":1.05,"elevation":0,"rotation":0,"section":"Dance Floor","bookable":true,"capacity":6,"price":1200,"deposit":400},
  {"id":"df4","kind":"standup","name":"DF4","x":24.5,"y":8.5,"w":1.1,"d":1.1,"h":1.05,"elevation":0,"rotation":0,"section":"Dance Floor","bookable":true,"capacity":6,"price":1200,"deposit":400},
  {"id":"bar-n","kind":"bar","name":"Bar","x":10,"y":3.2,"w":10,"d":1,"h":1.1,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0}
]'::jsonb),
('tpl-lounge-standard', 'lounge', 'Lounge Standard', '[
  {"id":"lb1","kind":"banquette","name":"L1","x":1.5,"y":3.8,"w":2.2,"d":1.5,"h":0.75,"elevation":0,"rotation":0,"l":{"w":0.8,"d":0.6},"section":"Booths","bookable":true,"capacity":8,"price":650,"deposit":250},
  {"id":"lb2","kind":"banquette","name":"L2","x":5.5,"y":3.8,"w":2.2,"d":1.5,"h":0.75,"elevation":0,"rotation":0,"l":{"w":0.8,"d":0.6},"section":"Booths","bookable":true,"capacity":8,"price":900,"deposit":350},
  {"id":"lb3","kind":"banquette","name":"L3","x":9.5,"y":3.8,"w":2.2,"d":1.5,"h":0.75,"elevation":0,"rotation":0,"l":{"w":0.8,"d":0.6},"section":"Booths","bookable":true,"capacity":8,"price":650,"deposit":250},
  {"id":"ls1","kind":"standup","name":"S1","x":3.5,"y":7.3,"w":0.9,"d":0.9,"h":1.05,"elevation":0,"rotation":0,"section":"Floor","bookable":true,"capacity":4,"price":350,"deposit":150},
  {"id":"ls2","kind":"standup","name":"S2","x":7.5,"y":7.3,"w":0.9,"d":0.9,"h":1.05,"elevation":0,"rotation":0,"section":"Floor","bookable":true,"capacity":4,"price":350,"deposit":150},
  {"id":"lg-bar","kind":"bar","name":"Bar","x":11.5,"y":2,"w":1.2,"d":6,"h":1.1,"elevation":0,"rotation":0,"section":"Floor","bookable":false,"capacity":0,"price":0,"deposit":0}
]'::jsonb);
