import { createClient } from '@supabase/supabase-js'

// WARNING: This client bypasses all RLS.
// Only use for: (a) auth callback user creation, (b) admin operations.
// NEVER import in client-side code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
