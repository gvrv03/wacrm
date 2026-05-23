import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminDb } from '@/lib/admin/require-admin';

/**
 * GET /api/admin/check
 *
 * Checks if the current authenticated user has admin role.
 * Uses the service-role key to bypass RLS.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ isAdmin: false, reason: 'not_authenticated' });
  }

  const db = adminDb();
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ isAdmin: false, reason: 'profile_error', error: profileError.message });
  }

  if (!profile) {
    return NextResponse.json({ isAdmin: false, reason: 'no_profile' });
  }

  return NextResponse.json({ isAdmin: profile.role === 'admin', role: profile.role });
}
