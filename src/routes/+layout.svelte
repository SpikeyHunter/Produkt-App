<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { supabase } from '$lib/supabase';
    import { user } from '$lib/stores/userStore';
    import { authStore } from '$lib/stores/authStore';
    import { themeStore } from '$lib/stores/themeStore';
    import '../app.css';

    const PROTECTED_ROUTES = [
        '/dashboard',
        '/advancing',
        '/booking',
        '/production',
        '/marketing',
        '/settings',
        '/calendar',
        '/ncgapp',
        '/sultanshepard',
        '/schedules' // Added to protect general schedule routes
    ];
    const PUBLIC_ONLY_ROUTES = ['/', '/login', '/login/register', '/login/forgot-password'];

    // --- PERMISSION CONFIGURATION ---
    const PERMISSION_MAP = {
        '/advancing': 'Advance',
        '/booking': 'Booking',
        '/production': 'Production',
        '/marketing': 'Marketing',
        '/sultanshepard': 'sultanshepard'
    };
    const ADMIN_ROUTES = ['/settings', '/calendar'];

    let isAuthInitialized = false;
    let authSubscription: any;

    /**
     * Checks if the current user has access to a given route based on their profile.
     */
    function hasAccessToRoute(path: string, profile: any): boolean {
        if (!profile) return false;

        if (profile.role === 'Admin') {
            return true;
        }

        if (path.startsWith('/dashboard')) {
            return true;
        }

        if (ADMIN_ROUTES.some((adminRoute) => path.startsWith(adminRoute))) {
            return false;
        }

        for (const route in PERMISSION_MAP) {
            if (path.startsWith(route)) {
                const requiredPermission = PERMISSION_MAP[route as keyof typeof PERMISSION_MAP];
                const permissions = [profile.main_permission, ...(profile.secondary_permission || [])];
                return permissions.includes(requiredPermission);
            }
        }

        return false;
    }

    // --- REACTIVE PERMISSION GUARD ---
    $: if ($authStore.isInitialized && $authStore.profile) {
        const currentPath = $page.url.pathname;
        const isProtectedRoute = PROTECTED_ROUTES.some((route) => currentPath.startsWith(route));
        
        // Exception: Don't check permissions for the public stage manager route
        const isPublicRoute = currentPath.startsWith('/schedules/stagemanager');

        if (isProtectedRoute && !isPublicRoute) {
            const hasAccess = hasAccessToRoute(currentPath, $authStore.profile);
            if (!hasAccess) {
                console.warn(
                    `[Permission Guard] Access denied to "${currentPath}" for user with role "${$authStore.profile.role}". Redirecting to dashboard.`
                );
                goto('/dashboard');
            }
        }
    }

    // --- REACTIVE THEME INITIALIZATION ---
    // Initialize theme when profile is loaded
    $: if ($authStore.isInitialized && $authStore.profile) {
        themeStore.initialize($authStore.profile.user_settings);
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
            const currentPath = $page.url.pathname; // or window.location.pathname
            const userIsLoggedIn = !!session?.user;

            // --- PUBLIC ROUTE EXCEPTION ---
            const isPublicRoute = currentPath.startsWith('/schedules/stagemanager');

            // --- PRIMARY AUTHENTICATION GUARD ---
            // Redirect to home IF: 
            // 1. User is NOT logged in
            // 2. Route IS in the protected list
            // 3. Route is NOT the public stage manager page
            if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route)) && !isPublicRoute) {
                console.log('[Auth Guard] User not logged in. Redirecting to home.');
                await goto('/');
                return;
            }

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
    <div class="flex h-screen bg-bg-primary items-center justify-center">
        <div class="text-center">
            <div
                class="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"
            ></div>
            <p class="text-text-secondary">Initializing...</p>
        </div>
    </div>
{:else}
    <slot />
{/if}