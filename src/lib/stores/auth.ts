// src/lib/stores/auth.ts
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { supabase } from '$lib/supabase.js';

/**
 * Handles user logout.
 * This function signs the user out of Supabase, which automatically
 * clears the secure session cookie.
 */
export async function logout(): Promise<void> {
  console.log('🔄 Starting logout...');

  // Sign out from Supabase. This clears the session cookie.
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('❌ Supabase signout error:', error);
  } else {
    console.log('✅ Supabase signout successful');
  }

  // Redirect to the login page.
  if (browser) {
    await goto('/');
  }
}

/**
 * Retrieves the current user's access token from the session.
 * This is needed for making authenticated API calls from the client.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}