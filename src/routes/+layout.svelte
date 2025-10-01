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
  let authSubscription: any;
  let isProcessingAuthChange = false;
  let lastAuthEvent: string | null = null;

  onMount(() => {
    // Initialize the auth store
    const initializeAuth = async () => {
      await authStore.initialize();
      isAuthInitialized = true;
    };
    
    initializeAuth();

    // Handle visibility change to prevent re-authentication issues
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // When tab becomes visible, check if we have a valid session
        // but don't trigger a full re-authentication
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            // Session is still valid, just update the user store
            user.set(session.user);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const setupAuthSubscription = async () => {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        // Prevent duplicate processing of auth events
        if (isProcessingAuthChange) {
          console.log('Already processing auth change, skipping...');
          return;
        }

        // Ignore certain events that don't need processing
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token refresh doesn't need full processing
          user.set(session.user);
          return;
        }

        // Check if this is the same event we just processed
        const currentAuthEvent = `${event}-${session?.user?.id || 'no-user'}`;
        if (currentAuthEvent === lastAuthEvent) {
          console.log('Duplicate auth event, skipping...');
          return;
        }

        isProcessingAuthChange = true;
        lastAuthEvent = currentAuthEvent;

        try {
          user.set(session?.user ?? null);
          console.log(`Supabase auth event: ${event}`);

          const currentPath = $page.url.pathname;
          const userIsLoggedIn = !!session?.user;

          // Only handle navigation for significant auth changes
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
            if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
              await goto('/');
              return;
            }

            if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
              await goto('/dashboard');
              return;
            }

            if (userIsLoggedIn && $authStore.profile && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
              const hasAccess = $canAccessRoute(currentPath);
              
              if (!hasAccess) {
                console.warn(`Access denied to ${currentPath}. Redirecting to dashboard.`);
                await goto('/dashboard');
              }
            }
          }
        } finally {
          // Reset the processing flag after a short delay
          setTimeout(() => {
            isProcessingAuthChange = false;
          }, 100);
        }
      });

      authSubscription = subscription;
    };

    setupAuthSubscription();

    // Cleanup - return synchronous function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
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