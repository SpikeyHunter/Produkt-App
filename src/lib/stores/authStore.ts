// src/lib/stores/authStore.ts
import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
	id: string;
	email?: string;
	first_name?: string;
	last_name?: string;
	role: 'Admin' | 'User';
	main_permission?: string;
	secondary_permission?: string | string[];
	created_at?: string;
	updated_at?: string;
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

	// Fetch user profile from database
	async function fetchProfile(userId: string): Promise<UserProfile | null> {
		try {
			const { data, error } = await supabase
				.from('user_profiles')
				.select('id, email, first_name, last_name, role, main_permission, secondary_permission, created_at, updated_at')
				.eq('id', userId)
				.single();

			if (error) {
				console.error('Error fetching user profile:', error);
				return null;
			}

			return data;
		} catch (error) {
			console.error('Error in fetchProfile:', error);
			return null;
		}
	}

	// Initialize auth state
	async function initialize() {
		try {
			const { data: { session } } = await supabase.auth.getSession();
			
			if (session?.user) {
				const profile = await fetchProfile(session.user.id);
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

			// Listen for auth changes
			supabase.auth.onAuthStateChange(async (event, session) => {
				if (session?.user) {
					const profile = await fetchProfile(session.user.id);
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
			});
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

	// Refresh profile data
	async function refreshProfile() {
		update(state => {
			if (!state.user) return state;
			
			fetchProfile(state.user.id).then(profile => {
				update(s => ({ ...s, profile }));
			});
			
			return state;
		});
	}

	return {
		subscribe,
		initialize,
		refreshProfile
	};
}

export const authStore = createAuthStore();

// Derived store for permissions checking
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
	
	// Get all permissions as array
	const allPermissions: string[] = [];
	if (profile.main_permission) allPermissions.push(profile.main_permission);
	if (profile.secondary_permission) {
		const secondary = Array.isArray(profile.secondary_permission)
			? profile.secondary_permission
			: profile.secondary_permission.split(',').map(p => p.trim());
		allPermissions.push(...secondary);
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

// Route access checker
export const canAccessRoute = derived([authStore, permissions], ([$authStore, $permissions]) => {
	return (route: string): boolean => {
		// Not authenticated
		if (!$authStore.user || !$authStore.profile) return false;

		// Admin can access everything
		if ($permissions.isAdmin) return true;

		// Public routes (dashboard, calendar)
		if (route.startsWith('/dashboard') || route.startsWith('/calendar')) {
			return true;
		}

		// Settings accessible to all authenticated users
		if (route.startsWith('/settings')) {
			return true;
		}

		// Permission-based routes
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