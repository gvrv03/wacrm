import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Shared admin guard for all /api/admin/* routes.
 * Uses the server Supabase client to get the authenticated user,
 * then uses the service-role key to check their role (bypasses RLS).
 *
 * Returns the user if they're an admin, null otherwise.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  // Use service-role to bypass RLS for the role check
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') return null;

  return user;
}

/**
 * Returns a Supabase client with service-role key (bypasses RLS).
 * Use for all admin data queries.
 */
export function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
