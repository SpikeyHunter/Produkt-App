import { createClient } from '@supabase/supabase-js';
import { 
  PUBLIC_NCG_SUPABASE_URL, 
  PUBLIC_NCG_SUPABASE_ANON_KEY 
} from '$env/static/public';

export const ncgSupabase = createClient(
  PUBLIC_NCG_SUPABASE_URL,
  PUBLIC_NCG_SUPABASE_ANON_KEY
);