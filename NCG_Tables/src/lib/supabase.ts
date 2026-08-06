import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

// The app runs fully on mock data until you set PUBLIC_SUPABASE_URL
// and PUBLIC_SUPABASE_ANON_KEY in .env — so you can explore first,
// wire the DB after.

export const hasSupabase = Boolean(
  env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY
);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!)
  : null;
