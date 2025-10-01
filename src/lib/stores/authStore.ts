// src/lib/stores/authStore.ts
import { writable, derived, get } from 'svelte/store';
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

	let authChangeSubscription: any = null;
	let lastProcessedUserId: string | null = null;

	// Cache for user profile to avoid repeated fetches
	const profileCache = new Map<string, { profile: UserProfile; timestamp: number }>();
	const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	// Fetch user profile from database with caching
	async function fetchProfile(userId: string, forceRefresh = false): Promise<UserProfile | null> {
		// Check cache first
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
				.select('id, email, first_name, last_name, role, main_permission, secondary_permission, created_at, updated_at')
				.eq('id', userId)
				.single();

			if (error) {
				console.error('Error fetching user profile:', error);
				return null;
			}

			// Update cache
			if (data) {
				profileCache.set(userId, { profile: data, timestamp: Date.now() });
			}

			return data;
		} catch (error) {
			console.error('Error in fetchProfile:', error);
			return null;
		}
	}

	// Initialize auth state
	async function initialize() {
		// Prevent re-initialization
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

			// Clean up any existing subscription
			if (authChangeSubscription) {
				authChangeSubscription.unsubscribe();
			}

			// Listen for auth changes with debouncing
			const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('Auth state change event:', event);

				// Skip token refresh events if user hasn't changed
				if (event === 'TOKEN_REFRESHED' && session?.user?.id === lastProcessedUserId) {
					console.log('Token refreshed for same user, updating user object only');
					update(state => ({ ...state, user: session.user }));
					return;
				}

				// Skip if we're processing the same user again (except for SIGNED_OUT)
				if (event !== 'SIGNED_OUT' && session?.user?.id === lastProcessedUserId) {
					console.log('Same user, skipping profile fetch');
					return;
				}

				if (session?.user) {
					// Only fetch profile if user changed
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
					profileCache.clear(); // Clear cache on logout
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

	// Refresh profile data (forces cache refresh)
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

	// Cleanup function
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
		cleanup
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