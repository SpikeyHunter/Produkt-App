<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { user } from '$lib/stores/userStore';
  import '../app.css';

  // CORRECTED: Replaced /'booking' with '/booking'
  const PROTECTED_ROUTES = ['/dashboard', '/advancing', '/booking', '/production', '/marketing', '/settings'];
  const PUBLIC_ONLY_ROUTES = ['/', '/login', '/login/register', '/login/forgot-password'];

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Set the user in our store
      user.set(session?.user ?? null);

      console.log(`Supabase auth event: ${event}`);
      
      const currentPath = $page.url.pathname;
      const userIsLoggedIn = !!session?.user;

      if (!userIsLoggedIn && PROTECTED_ROUTES.some(route => currentPath.startsWith(route))) {
        goto('/');
        return;
      }

      if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
        goto('/dashboard');
        return;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<slot />