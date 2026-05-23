import { NextResponse } from 'next/server';
import { requireAdmin, adminDb } from '@/lib/admin/require-admin';

/**
 * GET /api/admin/analytics
 * Returns platform-wide analytics for the admin dashboard.
 */
export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = adminDb();

  const [
    { count: totalUsers },
    { count: totalContacts },
    { count: totalConversations },
    { count: totalAutomations },
    { count: activeAutomations },
    { count: totalFlows },
    { count: totalMessages },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('contacts').select('*', { count: 'exact', head: true }),
    db.from('conversations').select('*', { count: 'exact', head: true }),
    db.from('automations').select('*', { count: 'exact', head: true }),
    db.from('automations').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('flows').select('*', { count: 'exact', head: true }),
    db.from('messages').select('*', { count: 'exact', head: true }),
  ]);

  // Recent signups (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: recentSignups } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', weekAgo);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    totalContacts: totalContacts ?? 0,
    totalConversations: totalConversations ?? 0,
    totalAutomations: totalAutomations ?? 0,
    activeAutomations: activeAutomations ?? 0,
    totalFlows: totalFlows ?? 0,
    totalMessages: totalMessages ?? 0,
    recentSignups: recentSignups ?? 0,
  });
}
