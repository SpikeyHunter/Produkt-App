<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/userStore';
  import { authStore, canAccessRoute } from '$lib/stores/authStore';
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

  let isAuthInitialized = false;
  let authSubscription: { unsubscribe: () => void } | null = null;

  async function initializeAuth() {
    // Single auth initialization
    await authStore.initialize();
    
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    user.set(session?.user ?? null);
    
    isAuthInitialized = true;

    // Now set up the listener for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      user.set(session?.user ?? null);
      console.log(`Supabase auth event: ${event}`);

      const currentPath = $page.url.pathname;
      const userIsLoggedIn = !!session?.user;

      // Route protection logic
      if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
        goto('/');
        return;
      }

      if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
        goto('/dashboard');
        return;
      }

      if (userIsLoggedIn && $authStore.profile && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
        const hasAccess = $canAccessRoute(currentPath);
        if (!hasAccess) {
          console.warn(`Access denied to ${currentPath}. Redirecting to dashboard.`);
          goto('/dashboard');
        }
      }
    });

    authSubscription = subscription;
  }

  onMount(() => {
    initializeAuth();

    // Return cleanup function synchronously
    return () => {
      authSubscription?.unsubscribe();
    };
  });
</script>

{#if !isAuthInitialized}
  <div class="flex h-screen bg-gray1 items-center justify-center">
    <div class="text-center">
      <div class="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-gray2">Initializing...</p>
    </div>
  </div>
{:else}
  <slot />
{/if}