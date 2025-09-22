import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';

/**
 * A simple writable store that holds the authenticated user object.
 * This is populated from the root layout's onAuthStateChange listener.
 */
export const user = writable<User | null>(null);