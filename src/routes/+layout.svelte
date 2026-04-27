<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import { themeStore } from '$lib/stores/themeStore';
	import { hasPermission } from '$lib/utils/permissions';
	import '../app.css';

	// Routes that require a logged-in user to access.
	// Base paths cover all sub-routes automatically.
	const PROTECTED_ROUTES = [
		'/dashboard',
		'/advancing',
		'/booking',
		'/production',
		'/marketing',
		'/settings',
		'/ncgapp',
		'/sultanshepard'
	];

	// Add /privacy to the allowed public routes [cite: 4]
	const PUBLIC_ONLY_ROUTES = [
		'/',
		'/login',
		'/login/register',
		'/login/forgot-password',
		'/privacy'
	];
	const UNPROTECTED_ROUTES = ['/calendar/unsubscribe', '/production/backline'];

	// --- PERMISSION CONFIGURATION ---
	const PERMISSION_MAP: Record<string, string | string[]> = {
		'/dashboard': [],
		'/settings': 'Admin',
		'/settimes': ['Advance', 'Booking', 'Production', 'Marketing'],
		'/advancing': 'Advance',
		'/booking': 'Booking',
		'/production/backline': [],
		'/production/showbudget': 'ShowBudget',
		'/production': 'Production',
		'/marketing/comptickets': 'CompTickets',
		'/marketing': 'Marketing',
		'/schedules/stagemanager': 'StageManager',
		'/schedules': 'Schedule',
		'/ncgapp': 'NCGApp',
		'/sultanshepard': 'sultanshepard'
	};

	const PERMISSION_MAP_KEYS = Object.keys(PERMISSION_MAP);

	let isAuthInitialized = false;
	let authSubscription: any;

	/**
	 * Checks route access using "Longest Match First" strategy.
	 */
	function hasAccessToRoute(path: string, profile: any): boolean {
		if (!profile) return false;
		if (profile.role === 'Admin') return true;
		if (path === '/dashboard') return true;

		const sortedRoutes = [...PERMISSION_MAP_KEYS].sort((a, b) => b.length - a.length);

		for (const routeKey of sortedRoutes) {
			if (path.startsWith(routeKey)) {
				const requiredPermission = PERMISSION_MAP[routeKey];
				return hasPermission(requiredPermission, profile);
			}
		}
		return true;
	}

	// --- REACTIVE GUARDS ---

	// 1. Theme
	$: if ($authStore.isInitialized && $authStore.profile) {
		themeStore.initialize($authStore.profile.user_settings);
	}

	// 2. Permission Guard (Runs only if logged in)
	// Using a generic block to prevent rapid-fire Svelte infinite loops
	$: {
		const currentPath = $page.url.pathname;
		const profile = $authStore.profile;

		if ($authStore.isInitialized && profile) {
			const requiresPermissionCheck = PERMISSION_MAP_KEYS.some((route) =>
				currentPath.startsWith(route)
			);

			if (requiresPermissionCheck) {
				const allowed = hasAccessToRoute(currentPath, profile);
				if (!allowed) {
					console.warn(`[Permission Guard] Access denied to "${currentPath}". Redirecting.`);
					if (currentPath.startsWith('/schedules/stagemanager')) {
						// Added replaceState to prevent browser history loops
						goto('/schedules/tech', { replaceState: true });
					} else {
						goto('/dashboard', { replaceState: true });
					}
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

			if (UNPROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
				return;
			}

			const userIsLoggedIn = !!session?.user;

			if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
				await goto('/', { replaceState: true });
				return;
			}

			if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
				await goto('/dashboard', { replaceState: true });
				return;
			}
		});

		authSubscription = subscription;
		return () => {
			if (authSubscription) authSubscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<meta name="apple-itunes-app" content="app-id=6764183004, app-argument=https://app.produkt.ca" />
</svelte:head>

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
