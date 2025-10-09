// src/lib/stores/authStore.ts
import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

// --- Start: Modified Reminder Types ---
export interface ReminderItem {
	id: string;
	text: string;
}

// This is the critical change: ReminderData is now a flat array of items.
export type ReminderData = ReminderItem[];
// --- End: Modified Reminder Types ---

// --- Start: User Settings Types ---
export type Theme = 'light' | 'dark';

export interface UserSettings {
	theme: Theme;
	// Add other settings here as you expand
	// notifications?: boolean;
	// language?: string;
}
// --- End: User Settings Types ---

export interface UserProfile {
	id: string;
	email?: string;
	first_name?: string;
	last_name?: string;
	role: 'Admin' | 'User';
	main_permission?: string;
	secondary_permission?: string | string[];
	page_permissions?: string[];  // ✅ ADD THIS LINE
	created_at?: string;
	updated_at?: string;
	user_reminders?: ReminderData;
	user_settings?: UserSettings;
}

interface AuthState {
	user: User | null;
	profile: UserProfile | null;
	isLoading: boolean;
	isInitialized: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		profile: null,
		isLoading: true,
		isInitialized: false
	});

	let authChangeSubscription: any = null;
	let lastProcessedUserId: string | null = null;

	const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();
	const CACHE_DURATION = 5 * 60 * 1000;

	async function fetchProfile(userId: string, forceRefresh = false): Promise<UserProfile | null> {
		if (!forceRefresh) {
			const cached = profileCache.get(userId);
			if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
				console.log('Using cached profile for user:', userId);
				return cached.profile;
			}
		}

		try {
			console.log('Fetching profile for user:', userId);
			const { data, error } = await supabase
				.from('user_profiles')
				.select('id, email, first_name, last_name, role, main_permission, secondary_permission, page_permissions, created_at, updated_at, user_reminders, user_settings')  // ✅ ADDED page_permissions HERE
				.eq('id', userId)
				.single();

			if (error) {
				console.error('Error fetching user profile:', error);
				return null;
			}

			if (data) {
				// ✅ Ensure user_settings has a default value if not present
				const profileWithDefaults: UserProfile = {
					...data,
					user_settings: data.user_settings || { theme: 'dark' },
					page_permissions: data.page_permissions || []  // ✅ ADD DEFAULT FOR page_permissions
				};
				profileCache.set(userId, { profile: profileWithDefaults, timestamp: Date.now() });
				return profileWithDefaults;
			}

			return data;
		} catch (error) {
			console.error('Error in fetchProfile:', error);
			return null;
		}
	}
    
	async function updateReminders(reminders: ReminderData) {
		const state = get({ subscribe });
		if (!state.user || !state.profile) {
			console.error("User not authenticated or profile not loaded.");
			return;
		}

		const oldProfile = state.profile;
		update(s => ({
			...s,
			profile: s.profile ? { ...s.profile, user_reminders: reminders } : null
		}));

		const { error } = await supabase
			.from('user_profiles')
			.update({ user_reminders: reminders })
			.eq('id', state.user.id);

		if (error) {
			console.error('Error updating reminders:', error);
			update(s => ({
				...s,
				profile: oldProfile
			}));
		}
	}

	async function updateSettings(settings: UserSettings) {
		const state = get({ subscribe });
		if (!state.user || !state.profile) {
			console.error("User not authenticated or profile not loaded.");
			return;
		}

		const oldProfile = state.profile;
		update(s => ({
			...s,
			profile: s.profile ? { ...s.profile, user_settings: settings } : null
		}));

		const { error } = await supabase
			.from('user_profiles')
			.update({ user_settings: settings })
			.eq('id', state.user.id);

		if (error) {
			console.error('Error updating settings:', error);
			update(s => ({
				...s,
				profile: oldProfile
			}));
		}
	}

	async function initialize() {
		const currentState = get({ subscribe });
		if (currentState.isInitialized) {
			console.log('Auth already initialized, skipping...');
			return;
		}

		try {
			const { data: { session } } = await supabase.auth.getSession();
			
			if (session?.user) {
				const profile = await fetchProfile(session.user.id);
				lastProcessedUserId = session.user.id;
				set({
					user: session.user,
					profile,
					isLoading: false,
					isInitialized: true
				});
			} else {
				set({
					user: null,
					profile: null,
					isLoading: false,
					isInitialized: true
				});
			}

			if (authChangeSubscription) {
				authChangeSubscription.unsubscribe();
			}

			const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('Auth state change event:', event);

				if (event === 'TOKEN_REFRESHED' && session?.user?.id === lastProcessedUserId) {
					update(state => ({ ...state, user: session.user }));
					return;
				}

				if (event !== 'SIGNED_OUT' && session?.user?.id === lastProcessedUserId) {
					return;
				}

				if (session?.user) {
					const shouldFetchProfile = session.user.id !== lastProcessedUserId;
					const profile = shouldFetchProfile 
						? await fetchProfile(session.user.id)
						: get({ subscribe }).profile;
					
					lastProcessedUserId = session.user.id;
					set({
						user: session.user,
						profile,
						isLoading: false,
						isInitialized: true
					});
				} else {
					lastProcessedUserId = null;
					profileCache.clear();
					set({
						user: null,
						profile: null,
						isLoading: false,
						isInitialized: true
					});
				}
			});

			authChangeSubscription = subscription;
		} catch (error) {
			console.error('Error initializing auth:', error);
			set({
				user: null,
				profile: null,
				isLoading: false,
				isInitialized: true
			});
		}
	}

	async function refreshProfile() {
		const state = get({ subscribe });
		if (!state.user) return;

		update(s => ({ ...s, isLoading: true }));
		
		try {
			const profile = await fetchProfile(state.user.id, true);
			update(s => ({ ...s, profile, isLoading: false }));
		} catch (error) {
			console.error('Error refreshing profile:', error);
			update(s => ({ ...s, isLoading: false }));
		}
	}

	function cleanup() {
		if (authChangeSubscription) {
			authChangeSubscription.unsubscribe();
			authChangeSubscription = null;
		}
		profileCache.clear();
	}

	return {
		subscribe,
		initialize,
		refreshProfile,
		cleanup,
		updateReminders,
		updateSettings
	};
}

export const authStore = createAuthStore();

export const permissions = derived(authStore, $authStore => {
	const profile = $authStore.profile;
	
	if (!profile) {
		return {
			isAdmin: false,
			hasPermission: (permission: string) => false,
			allPermissions: [] as string[]
		};
	}

	const isAdmin = profile.role === 'Admin';
	
	const allPermissions: string[] = [];
	if (profile.main_permission) allPermissions.push(profile.main_permission);
	if (profile.secondary_permission) {
		const secondary = Array.isArray(profile.secondary_permission)
			? profile.secondary_permission
			: profile.secondary_permission.split(',').map(p => p.trim());
		allPermissions.push(...secondary);
	}
	// ✅ ADD page_permissions to allPermissions
	if (profile.page_permissions) {
		allPermissions.push(...profile.page_permissions);
	}

	return {
		isAdmin,
		hasPermission: (permission: string) => {
			if (isAdmin) return true;
			return allPermissions.includes(permission);
		},
		allPermissions
	};
});

export const canAccessRoute = derived([authStore, permissions], ([$authStore, $permissions]) => {
	return (route: string): boolean => {
		if (!$authStore.user || !$authStore.profile) return false;
		if ($permissions.isAdmin) return true;
		
		// Dashboard, Set Times, and Calendar accessible to all users
		if (route.startsWith('/dashboard') || route.startsWith('/settimes') || route.startsWith('/calendar')) {
			return true;
		}
		if (route.startsWith('/settings')) {
			return true;
		}
		if (route.startsWith('/marketing')) {
			return $permissions.hasPermission('Marketing');
		}
		if (route.startsWith('/booking')) {
			return $permissions.hasPermission('Booking');
		}
		if (route.startsWith('/advancing')) {
			return $permissions.hasPermission('Advance');
		}
		if (route.startsWith('/production')) {
			return $permissions.hasPermission('Production');
		}
		return false;
	};
});