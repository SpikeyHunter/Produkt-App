// ============================================================
// USER SETTINGS STORE  ($lib/stores/userSettings.ts)
// Single source of truth for user_profiles.user_settings.
// All components (list, modal, map) read from here, so a color
// change anywhere updates everywhere instantly. A Supabase
// realtime subscription also syncs changes from other tabs /
// devices.
// ============================================================

import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import {
	TOUR_DATE_TYPES,
	DEFAULT_TYPE_COLORS,
	DEFAULT_USER_SETTINGS,
	type UserSettings,
	type TourTypeColors
} from '$lib/types/tour';

// ------------------------------------------------------------
// Stores
// ------------------------------------------------------------

export const userSettings = writable<UserSettings>({ ...DEFAULT_USER_SETTINGS });

/** Colors keyed by the 6 date types — always fully populated (defaults merged in). */
export const typeColors = derived(userSettings, ($s): TourTypeColors => ({
	...DEFAULT_TYPE_COLORS,
	...($s.tour_type_colors || {})
}));

/** Tour route line color. */
export const lineColor = derived(
	userSettings,
	($s) => $s.tour_line_color || DEFAULT_USER_SETTINGS.tour_line_color!
);

// ------------------------------------------------------------
// Legacy key migration (old saved settings used Stop / Return)
// ------------------------------------------------------------

const LEGACY_TYPE_MAP: Record<string, string> = {
	Stop: 'Other',
	Return: 'Dropoff'
};

function migrateTypeColors(raw: Record<string, string> | undefined): TourTypeColors {
	const out: TourTypeColors = {};
	if (!raw) return out;
	for (const [key, value] of Object.entries(raw)) {
		const mapped = LEGACY_TYPE_MAP[key] || key;
		if ((TOUR_DATE_TYPES as readonly string[]).includes(mapped)) {
			if (!(mapped in out) || (TOUR_DATE_TYPES as readonly string[]).includes(key)) {
				out[mapped] = value;
			}
		}
	}
	return out;
}

function normalize(raw: any): UserSettings {
	const settings: UserSettings = { ...DEFAULT_USER_SETTINGS, ...(raw || {}) };
	settings.tour_type_colors = {
		...DEFAULT_TYPE_COLORS,
		...migrateTypeColors(raw?.tour_type_colors)
	};
	return settings;
}

// ------------------------------------------------------------
// Realtime channel (one per session)
// ------------------------------------------------------------

let channel: ReturnType<typeof supabase.channel> | null = null;
let currentUserId: string | null = null;

function subscribeRealtime(userId: string) {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    channel = supabase
      .channel(`user-settings-${userId}`)
		.on(
			'postgres_changes',
			{
				event: 'UPDATE',
				schema: 'public',
				table: 'user_profiles',
				filter: `id=eq.${userId}`
			},
			(payload: any) => {
				if (payload?.new?.user_settings) {
					userSettings.set(normalize(payload.new.user_settings));
				}
			}
		)
		.subscribe();
}

// ------------------------------------------------------------
// Init — NOT cached, always fetches fresh from Supabase.
// Safe to call with await in every component's onMount so the
// store is populated before first render.
// ------------------------------------------------------------

export async function initUserSettings(): Promise<void> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	if (!user) return;

	currentUserId = user.id;

	const { data: profile } = await supabase
		.from('user_profiles')
		.select('user_settings')
		.eq('id', user.id)
		.single();

	// Populate the store immediately so every $typeColors / $lineColor
	// subscriber re-renders with the correct saved values.
	userSettings.set(normalize(profile?.user_settings));

	// Subscribe to realtime once per session
	subscribeRealtime(user.id);
}

export function destroyUserSettingsChannel() {
	if (channel) {
		supabase.removeChannel(channel);
		channel = null;
	}
}

// ------------------------------------------------------------
// Save helpers — optimistic local update first (instant UI
// everywhere), then persisted with a merge so other keys in
// user_settings (theme, start_week_on, ...) are preserved.
// ------------------------------------------------------------

async function persist(patch: Partial<UserSettings>) {
	// Optimistic local update — every subscribed component re-renders now.
	userSettings.update((s) => normalize({ ...s, ...patch }));

	if (!currentUserId) {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) return;
		currentUserId = user.id;
	}

	// Merge against the freshest DB copy so we don't clobber other keys.
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('user_settings')
		.eq('id', currentUserId)
		.single();

	const merged = { ...(profile?.user_settings || {}), ...get(userSettings), ...patch };

	await supabase
		.from('user_profiles')
		.update({ user_settings: merged })
		.eq('id', currentUserId);
}

export async function saveTourLineColor(hex: string) {
	await persist({ tour_line_color: hex });
}

export async function saveTourTypeColor(type: string, hex: string) {
	const colors = { ...get(typeColors), [type]: hex };
	await persist({ tour_type_colors: colors });
}