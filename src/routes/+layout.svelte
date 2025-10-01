<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';
	import { authStore } from '$lib/stores/authStore';
	import '../app.css';

	const PROTECTED_ROUTES = [
		'/dashboard',
		'/advancing',
		'/booking',
		'/production',
		'/marketing',
		'/settings',
		'/calendar'
	];
	const PUBLIC_ONLY_ROUTES = ['/', '/login', '/login/register', '/login/forgot-password'];

	// --- PERMISSION CONFIGURATION ---
	const PERMISSION_MAP = {
		'/advancing': 'Advance',
		'/booking': 'Booking',
		'/production': 'Production',
		'/marketing': 'Marketing'
	};
	const ADMIN_ROUTES = ['/settings', '/calendar'];

	let isAuthInitialized = false;
	let authSubscription: any;

	/**
	 * Checks if the current user has access to a given route based on their profile.
	 * This function is called only AFTER the user is authenticated and their profile is loaded.
	 * @param {string} path - The route path to check (e.g., '/production/backline').
	 * @param {any} profile - The user's profile from the database.
	 * @returns {boolean} - True if access is allowed, false otherwise.
	 */
	function hasAccessToRoute(path: string, profile: any): boolean {
		if (!profile) return false;

		// 1. Admin role has universal access.
		if (profile.role === 'Admin') {
			return true;
		}

		// 2. Dashboard is accessible to all authenticated users.
		if (path.startsWith('/dashboard')) {
			return true;
		}

		// 3. Check if the user is trying to access an admin-only route without being an admin.
		if (ADMIN_ROUTES.some((adminRoute) => path.startsWith(adminRoute))) {
			return false; // Denied if not an admin (already checked above).
		}

		// 4. Check permission-based routes.
		for (const route in PERMISSION_MAP) {
			if (path.startsWith(route)) {
				const requiredPermission = PERMISSION_MAP[route as keyof typeof PERMISSION_MAP];
				const permissions = [profile.main_permission, ...(profile.secondary_permission || [])];
				return permissions.includes(requiredPermission);
			}
		}

		// 5. Fallback: If the route is protected but has no specific rule, deny access.
		return false;
	}

	// --- REACTIVE PERMISSION GUARD ---
	// This block runs automatically whenever the auth store or the page URL changes.
	// It's the core of the permission logic for navigation.
	$: if ($authStore.isInitialized && $authStore.profile) {
		const currentPath = $page.url.pathname;
		const isProtectedRoute = PROTECTED_ROUTES.some((route) => currentPath.startsWith(route));

		// If the user is on a protected route, check their permissions.
		if (isProtectedRoute) {
			const hasAccess = hasAccessToRoute(currentPath, $authStore.profile);
			if (!hasAccess) {
				console.warn(
					`[Permission Guard] Access denied to "${currentPath}" for user with role "${$authStore.profile.role}". Redirecting to dashboard.`
				);
				goto('/dashboard');
			}
		}
	}

	onMount(() => {
		// Initialize the auth store to fetch user and profile data.
		authStore.initialize().then(() => {
			isAuthInitialized = true;
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log(`Supabase auth event: ${event}`);
			const currentPath = $page.url.pathname;
			const userIsLoggedIn = !!session?.user;

			// --- PRIMARY AUTHENTICATION GUARD ---
			// This handles the basic login/logout state.

			// 1. If user is NOT logged in, redirect them from any protected page to the homepage.
			if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
				console.log('[Auth Guard] User not logged in. Redirecting to home.');
				await goto('/');
				return;
			}

			// 2. If user IS logged in, redirect them from public-only pages to the dashboard.
			if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
				console.log('[Auth Guard] User is logged in. Redirecting to dashboard.');
				await goto('/dashboard');
				return;
			}
		});

		authSubscription = subscription;

		return () => {
			if (authSubscription) {
				authSubscription.unsubscribe();
			}
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
