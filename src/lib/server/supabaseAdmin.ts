import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL } from '$env/static/public'
// 👇 This line is changed to match your .env variable
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private'

// This admin client uses the SERVICE_ROLE_KEY and should only be used on the server.
export const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY // And we use the corrected variable name here
)