<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';
	import { authStore } from '$lib/stores/authStore';
	import { themeStore } from '$lib/stores/themeStore';
	import '../app.css';

	// Routes that require a logged-in user to access.
	// /schedules and /settimes are removed to allow public viewing for unauthenticated users.
	const PROTECTED_ROUTES = [
		'/dashboard',
		'/advancing',
		'/booking',
		'/production/showbudget', // <--- ADD THIS
		'/production/emailtech',
		'/marketing',
		'/settings',
		'/ncgapp',
		'/sultanshepard'
		// '/schedules' and '/settimes' removed for public access
	];

	const PUBLIC_ONLY_ROUTES = ['/', '/login', '/login/register', '/login/forgot-password'];

	// --- PERMISSION CONFIGURATION ---
	// This map defines all routes that require specific permission *if the user is logged in*.
	const PERMISSION_MAP: Record<string, string | string[]> = {
		// --- Base Sections ---
		'/dashboard': [], // Accessible to all logged in users
		
		'/settings': 'Admin',
		'/settimes': ['Advance', 'Booking', 'Production', 'Marketing'], // Any of these

		// --- Sections with Inheritance ---
		'/advancing': 'Advance', // Covers /advancing/gathered, /advancing/artistliaison, etc.
		'/booking': 'Booking', // Covers /booking/artistavailability, etc.

		'/production/backline': [], // <--- ADD THIS LINE (Must be above or below '/production')
		'/production': 'Production',
		'/production/showbudget': 'ShowBudget',

		'/marketing': 'Marketing', // Base permission for marketing
		'/marketing/comptickets': 'CompTickets', // EXCEPTION: Specific permission required

		'/schedules': 'Schedule', // Base permission for schedules (e.g., /schedules/tech)
		'/schedules/stagemanager': 'StageManager', // EXCEPTION: Specific permission required

		'/ncgapp': 'NCGApp',
		'/sultanshepard': 'sultanshepard'
	};

	// Cache map keys for efficient lookup
	const PERMISSION_MAP_KEYS = Object.keys(PERMISSION_MAP);

	let isAuthInitialized = false;
	let authSubscription: any;

	/**
	 * core permission check logic
	 */
	function hasPermission(requiredPermission: string | string[] | undefined, profile: any): boolean {
		// If no specific permission defined (and user is logged in), allow access
		if (
			!requiredPermission ||
			(Array.isArray(requiredPermission) && requiredPermission.length === 0)
		) {
			return true;
		}
		if (!profile) return false;
		if (profile.role === 'Admin') return true;

		// Consolidate permissions
		const mainPerm = profile.main_permission ? [profile.main_permission] : [];
		const secondaryPerms = Array.isArray(profile.secondary_permission)
			? profile.secondary_permission
			: [];
		const pagePerms = Array.isArray(profile.page_permissions) ? profile.page_permissions : [];

		const userPermissions = [...mainPerm, ...secondaryPerms, ...pagePerms].filter(Boolean);

		if (Array.isArray(requiredPermission)) {
			return requiredPermission.some((perm) => userPermissions.includes(perm));
		} else {
			return userPermissions.includes(requiredPermission);
		}
	}

	/**
	 * Checks route access using "Longest Match First" strategy.
	 */
	function hasAccessToRoute(path: string, profile: any): boolean {
		if (!profile) return false;
		if (profile.role === 'Admin') return true;
		if (path === '/dashboard') return true;

		// 1. Get all defined routes in the map
		const definedRoutes = PERMISSION_MAP_KEYS;

		// 2. Sort by length descending (Longest path checks first)
		const sortedRoutes = definedRoutes.sort((a, b) => b.length - a.length);

		// 3. Find the first matching route key
		for (const routeKey of sortedRoutes) {
			if (path.startsWith(routeKey)) {
				const requiredPermission = PERMISSION_MAP[routeKey];
				// We found the most specific match, check permission and return result immediately
				return hasPermission(requiredPermission, profile);
			}
		}

		// If no route matched in the map, assume access is allowed for logged-in users
		// (since we only call this for routes in the map or dashboard)
		return true;
	}

	// --- REACTIVE GUARDS ---

	// 1. Theme
	$: if ($authStore.isInitialized && $authStore.profile) {
		themeStore.initialize($authStore.profile.user_settings);
	}

	// 2. Permission Guard (Runs only if logged in)
	$: if ($authStore.isInitialized && $authStore.profile) {
		const currentPath = $page.url.pathname;

		// Check if the current path is one of the routes that requires a permission check when logged in.
		const requiresPermissionCheck = PERMISSION_MAP_KEYS.some((route) =>
			currentPath.startsWith(route)
		);

		if (requiresPermissionCheck) {
			const allowed = hasAccessToRoute(currentPath, $authStore.profile);
			if (!allowed) {
				console.warn(`[Permission Guard] Access denied to "${currentPath}". Redirecting.`);

				// --- SPECIFIC REDIRECT LOGIC ---
				if (currentPath.startsWith('/schedules/stagemanager')) {
					// If trying to access stagemanager without permission, go to schedules base
					goto('/schedules/tech');
				} else {
					// Default fallback for any other denied route (e.g., /advancing, /production/showbudget)
					goto('/dashboard');
				}
			}
		}
	}

	onMount(() => {
		authStore.initialize().then(() => {
			isAuthInitialized = true;
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			const currentPath = $page.url.pathname;
			const userIsLoggedIn = !!session?.user;

			// --- 1. PRIMARY AUTHENTICATION GUARD (Redirects unauthenticated users from PROTECTED_ROUTES) ---
			if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
				await goto('/');
				return;
			}

			// --- 2. LOGGED IN REDIRECT GUARD (Redirects logged-in users from public-only pages) ---
			if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
				await goto('/dashboard');
				return;
			}
		});

		authSubscription = subscription;
		return () => {
			if (authSubscription) authSubscription.unsubscribe();
		};
	});
</script>

{#if !isAuthInitialized}
	<div class="flex h-screen bg-gray1 items-center justify-center">
		<div class="text-center">
			<div
				class="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"
			></div>
			<p class="text-gray2">Initializing...</p>
		</div>
	</div>
{:else}
	<slot />
{/if}
