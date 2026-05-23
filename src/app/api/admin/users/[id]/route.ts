import { NextResponse } from 'next/server';
import { requireAdmin, adminDb } from '@/lib/admin/require-admin';

/**
 * PATCH /api/admin/users/[id]
 * Update a user's role or profile fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = adminDb();
  const allowedFields = ['role', 'full_name', 'email'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const field of allowedFields) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  // Validate role
  if (update.role && !['user', 'admin'].includes(update.role as string)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const { error } = await db
    .from('profiles')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user (removes auth user + profile cascades).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = adminDb();

  // Get the user_id from the profile
  const { data: profile } = await db
    .from('profiles')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Prevent self-deletion
  if (profile.user_id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  // Delete the auth user (cascades to profile and all owned data)
  const { error } = await db.auth.admin.deleteUser(profile.user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
