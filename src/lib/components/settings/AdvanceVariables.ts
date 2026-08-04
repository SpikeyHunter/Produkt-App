// src/lib/components/settings/AdvanceVariables.ts
// Centralized settings for advance sheet variables

export interface VenueSettings {
  city: string;
  venueAddress: string;
  artistEntrance:string;
}

export interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

export interface ContactSettings {
  talentBuyer: ContactPerson;
  production: ContactPerson;
  emergency: ContactPerson;
}
export interface GuestlistDefaults {
	ga: number;
	vip: number;
}

// Options for the PA System / DJ Monitor override dropdowns.
// 'Other' triggers a free-text, line-by-line custom entry in AdvanceSettings.
export const paDjOptions = ['NCG', 'Bazart', 'Other'];

// Splits a raw multi-line custom text block into clean bullet lines.
// Accepts lines with or without a leading "-" and drops empty lines.
export function parseCustomLines(raw: string | undefined | null): string[] {
	if (!raw) return [];
	return raw
		.split('\n')
		.map((line) => line.trim().replace(/^-\s*/, ''))
		.filter((line) => line.length > 0);
}

export const guestlistSettings: {
	[venue: string]: {
		[artistType: string]: GuestlistDefaults;
	};
} = {
	'Bazart': {
		'Local': { ga: 10, vip: 0 },
		'Support': { ga: 5, vip: 5 },
		'Headliner': { ga: 10, vip: 10 }
	},
	'New City Gas': {
		'Local': { ga: 5, vip: 0 },
		'Support': { ga: 5, vip: 5 },
		'Headliner': { ga: 10, vip: 10 }
	}
};

// Default venue settings
export const defaultVenueSettings: VenueSettings = {
  city: 'Montreal',
  venueAddress: '950 Ottawa Street',
  artistEntrance: '141 Ann Street'
};

// Contact information settings
export const contactSettings: ContactSettings = {
  talentBuyer: {
    name: 'Willis Daellenbach',
    phone: '416-500-8700',
    email: 'willis@produkt.ca'
  },
  production: {
    name: 'Charles Brousseau',
    phone: '514-805-9313',
    email: 'charles@produkt.ca'
  },
  emergency: {
    name: 'Alex K',
    phone: '514-242-1960',
    email: 'alexk@produkt.ca'
  }
};

// Day of Show contact mapping - maps DOS value from database to full contact info
export const dosContactMap: { [key: string]: ContactPerson } = {
  'Charles': {
    name: 'Charles Brousseau',
    phone: '514-805-9313',
    email: 'charles@produkt.ca'
  },
  'Sam': {
    name: 'Samuel Latreille',
    phone: '450-544-5870',
    email: 'samlatreille90125@gmail.com'
  },
  'Ben': {
    name: 'Benjamin Gagnon',
    phone: '514-714-3292',
    email: 'benjamin.gagnon.e@gmail.com'
  },
  'Mezz': {
    name: 'Olivier Mezzari',
    phone: '514-941-0184',
    email: 'mezz@produkt.ca'
  }
};

// ---------------------------------------------------------------------------
// ARTIST LIAISON (DOS) — MULTI-SELECT SUPPORT
// ---------------------------------------------------------------------------
// The `dos` column stays a plain text column. Multiple people are stored as a
// comma-separated list, e.g. "Charles, Ben". Legacy single values ("Charles")
// keep working with no migration needed.

// Canonical ordering for the liaison dropdown. Charles is always index 0 so he
// is always displayed / stored first when selected.
export const dosContactOptions = ['Charles', 'Sam', 'Ben', 'Mezz'];

// These people already own / are on the shared Produkt calendar, so they are
// never added as calendar guests. Anyone else selected gets invited.
export const calendarInternalMembers = ['Charles', 'Mezz'];

// Driver emails, mirroring the map inside GoogleCalendar.ts. Note that drivers
// are NOT sent as attendees from the client — the calendar util resolves the
// driver per transport row so each one only gets their own rides. This map is
// here for display / reference only.
export const driverEmailMap: { [key: string]: string } = {
  'Eddy': 'eddy_baptist@hotmail.ca',
  'Reza': 'rezanarenji@gmail.com',
  'Tony': 'tonytaitt@gmail.com',
  'Charles': 'charles@produkt.ca',
  'UBER': '',
  'N/A': ''
};

// Splits a raw `dos` value into an array of clean contact keys.
export function parseDosNames(raw: string | string[] | undefined | null): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set<string>();
  return list
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !seen.has(n) && seen.add(n) !== undefined);
}

// Sorts liaison names: Charles always first, then dropdown order, then any
// unknown/legacy names alphabetically at the end.
export function sortDosNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    if (a === 'Charles') return -1;
    if (b === 'Charles') return 1;
    const ia = dosContactOptions.indexOf(a);
    const ib = dosContactOptions.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Builds the string that gets written back to `events_advance.dos`.
export function formatDosValue(names: string[]): string {
  return sortDosNames(parseDosNames(names)).join(', ');
}

// Resolves a raw `dos` value into full contact records for the advance sheet.
export function getDosContacts(raw: string | string[] | undefined | null): ContactPerson[] {
  const names = sortDosNames(parseDosNames(raw));
  if (names.length === 0) {
    return [{ name: '[Name]', phone: '[Phone]', email: '[Email]' }];
  }
  return names.map(
    (n) => dosContactMap[n] ?? { name: n, phone: '[Phone]', email: '[Email]' }
  );
}

// Short label for compact UI pills, e.g. "Charles, Ben".
export function getDosLabel(raw: string | string[] | undefined | null): string {
  const names = sortDosNames(parseDosNames(raw));
  return names.length ? names.join(', ') : '';
}

// Emails of every selected liaison who is NOT already on the shared calendar.
export function getDosAttendeeEmails(raw: string | string[] | undefined | null): string[] {
  return sortDosNames(parseDosNames(raw))
    .filter((n) => !calendarInternalMembers.includes(n))
    .map((n) => dosContactMap[n]?.email)
    .filter((e): e is string => !!e && e.includes('@'));
}

// Emails of every driver assigned across the ground transport rows.
export function getDriverAttendeeEmails(
  rows: { driverName?: string }[] | undefined | null
): string[] {
  if (!Array.isArray(rows)) return [];
  const emails = rows
    .map((r) => (r?.driverName ? driverEmailMap[r.driverName] : ''))
    .filter((e): e is string => !!e && e.includes('@'));
  return Array.from(new Set(emails));
}

// Full, de-duplicated guest list for a calendar sync: liaisons + drivers.
export function getCalendarAttendeeEmails(
  dosRaw: string | string[] | undefined | null,
  rows?: { driverName?: string }[] | null
): string[] {
  return Array.from(
    new Set([...getDosAttendeeEmails(dosRaw), ...getDriverAttendeeEmails(rows)])
  );
}

// Driver contact mapping for ground transfers
export const driverContactMap: { [key: string]: string } = {
  'Eddy': '438-821-5937',
  'Reza': '438-985-7833',
  'Tony': '514-690-8669',
  'Charles': '514-805-9313',
  'UBER': 'A Uber voucher link will be given to cover transportation'
};

// Vehicle information for ground transfers (default vehicle)
export const vehicleInfo = 'Chevrolet Suburban, Black SUV, 7 Passenger, FSN4714';

// Per-driver vehicle overrides. Anything not listed here falls back to
// `vehicleInfo` above.
export const driverVehicleMap: { [key: string]: string } = {
  'Reza': 'Black SUV, Full Size, 8x Passenger',
  'Tony': 'Black SUV, Full Size, 8x Passenger',
  'UBER': ''
};

// Returns the vehicle description that should be printed on the advance sheet
// for a given driver.
export function getVehicleForDriver(driverName: string | undefined | null): string {
  if (!driverName) return vehicleInfo;
  const key = driverName.trim();
  if (Object.prototype.hasOwnProperty.call(driverVehicleMap, key)) {
    return driverVehicleMap[key];
  }
  return vehicleInfo;
}

// ---------------------------------------------------------------------------
// LOCAL CONTACT FORMATTING
// ---------------------------------------------------------------------------
// Local contacts are stored on `events_advance.main_contact` as a single
// string. Phone numbers are optional — a contact with no phone still has to be
// selectable, so never gate the whole string on the phone existing.

export interface LocalContactLike {
  dj_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function formatLocalContact(contact: LocalContactLike | null | undefined): string {
  if (!contact) return '';
  const name = (contact.first_name || contact.dj_name || '').trim();
  const phone = (contact.phone || '').trim();
  if (!name && !phone) return '';
  if (!name) return phone;
  if (!phone) return name;
  return `${name} - ${phone}`;
}

// ---------------------------------------------------------------------------
// BACKLINE INHERITANCE FOR LOCAL ARTISTS
// ---------------------------------------------------------------------------
// A local never carries its own backline: it plays on whatever the act next to
// it in the running order is using. Rule — take the act immediately AFTER the
// local; if the local closes the night, take the act immediately BEFORE.
// Other locals are skipped so a local never inherits from another local.

export interface RunningOrderAct {
  artistName: string;
  artistType?: string | null;
  time?: string | null;
}

const NON_ACT_PATTERN = /curfew|doors|close|end of night|changeover|load[- ]?out/i;

function normalizeName(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

// Converts a set time to a sortable value on a "night" timeline, so 2:00 AM
// sorts AFTER 11:00 PM instead of before it. Anything before 6 AM rolls over.
export function nightSortValue(time: string | null | undefined): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const raw = String(time).trim().toUpperCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  // Late-night rollover: 00:00–05:59 belongs to the following calendar day.
  if (hours < 6) hours += 24;

  return hours * 60 + minutes;
}

export function sortRunningOrder(acts: RunningOrderAct[]): RunningOrderAct[] {
  return [...acts]
    .filter((a) => a && a.artistName && !NON_ACT_PATTERN.test(a.artistName))
    .sort((a, b) => nightSortValue(a.time) - nightSortValue(b.time));
}

function isLocalAct(act: RunningOrderAct): boolean {
  return (act.artistType || '').trim().toLowerCase() === 'local';
}

// Returns the artist name whose backline the given artist should inherit,
// or null when nothing sensible can be resolved.
export function resolveBacklineSourceName(
  targetArtistName: string,
  acts: RunningOrderAct[]
): string | null {
  const target = normalizeName(targetArtistName);
  const sorted = sortRunningOrder(acts);
  const others = sorted.filter((a) => !isLocalAct(a) && normalizeName(a.artistName) !== target);

  if (others.length === 0) return null;

  const index = sorted.findIndex((a) => normalizeName(a.artistName) === target);

  if (index !== -1) {
    // Look forward first — the act playing right after the local.
    for (let i = index + 1; i < sorted.length; i++) {
      if (!isLocalAct(sorted[i]) && normalizeName(sorted[i].artistName) !== target) {
        return sorted[i].artistName;
      }
    }
    // Local closes the night — fall back to the act right before it.
    for (let i = index - 1; i >= 0; i--) {
      if (!isLocalAct(sorted[i]) && normalizeName(sorted[i].artistName) !== target) {
        return sorted[i].artistName;
      }
    }
  }

  // No set time / not in the running order yet: prefer the Headliner, then the
  // Support, then whoever is left. This is what stops the backline coming out
  // blank when the timetable hasn't been filled in.
  const byType = (type: string) =>
    others.find((a) => (a.artistType || '').trim().toLowerCase() === type);

  return (byType('headliner') || byType('support') || others[others.length - 1]).artistName;
}

// Pulls a backline value off an advance row regardless of where it is stored.
export function readBackline(row: any): string {
  if (!row) return '';
  const candidates = [
    row.backline,
    row.tech_info?.backline,
    row.custom_settings?.backline,
    row.rider_files?.backline
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length) return value.join('\n');
  }
  return '';
}

// Main entry point: the backline that should be used for `artistName`.
// - Non-local artists keep their own backline.
// - Locals always inherit from their neighbour in the running order, and only
//   fall back to their own value if nothing can be resolved.
export function resolveBackline(
  artistName: string,
  advanceRows: any[],
  timetable?: { time?: string | null; artist?: string | null }[] | null
): string {
  const rows = Array.isArray(advanceRows) ? advanceRows : [];
  const self = rows.find((r) => normalizeName(r?.artist_name) === normalizeName(artistName));
  const ownBackline = readBackline(self);

  const isLocal = (self?.artist_type || '').trim().toLowerCase() === 'local';
  if (!isLocal) return ownBackline;

  // Build the running order from the timetable when available, otherwise from
  // the advance rows themselves.
  const timeByArtist = new Map<string, string>();
  if (Array.isArray(timetable)) {
    for (const entry of timetable) {
      if (entry?.artist) timeByArtist.set(normalizeName(entry.artist), entry.time || '');
    }
  }

  const acts: RunningOrderAct[] = rows
    .filter((r) => r?.artist_name)
    .map((r) => ({
      artistName: r.artist_name,
      artistType: r.artist_type,
      time: timeByArtist.get(normalizeName(r.artist_name)) ?? r.set_time ?? null
    }));

  const sourceName = resolveBacklineSourceName(artistName, acts);
  if (!sourceName) return ownBackline;

  const sourceRow = rows.find((r) => normalizeName(r?.artist_name) === normalizeName(sourceName));
  return readBackline(sourceRow) || ownBackline;
}

// **NEW**: Hotel address mapping
export const hotelAddressMap: { [key: string]: string } = {
  'W Hotel': '901 Rue du Square-Victoria, Montréal, QC H2Z 1J1',
  'Alt Hotel': '120 Peel St, Montreal, Quebec H3C 0L8',
  'Monville': '1041 Rue de Bleury, Montréal, QC H2Z 1M7'
};

// **NEW**: Production Contact mapping for custom settings
export const productionContactMap: { [key: string]: ContactPerson } = {
	'Charles': {
		name: 'Charles Brousseau',
		phone: '514-805-9313',
		email: 'charles@produkt.ca'
	},
	'Danny': {
		name: 'Danny Fréchette',
		phone: '514-207-6971',
		email: 'danny@produkt.ca'
	}
};

// You can add more settings here as needed
export const advanceSettings = {
  venue: defaultVenueSettings,
  contacts: contactSettings,
  dosContacts: dosContactMap,
  drivers: driverContactMap,
  driverEmails: driverEmailMap,
  vehicle: vehicleInfo,
  driverVehicles: driverVehicleMap,
  hotels: hotelAddressMap,
  guestlist: guestlistSettings,
  productionContacts: productionContactMap
};

// Helper function to format date to "3 October 2025" format
export function formatAdvanceDate(dateString: string): string {
  try {
    // Parse date parts directly to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    return `${day} ${monthName} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}