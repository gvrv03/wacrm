import { NextResponse } from 'next/server';
import { requireAdmin, adminDb } from '@/lib/admin/require-admin';

/**
 * GET /api/admin/contacts?page=1&pageSize=20&q=search&sort=created_at&order=desc
 * Lists all contacts across all users with the owning user's info.
 */
export async function GET(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
  const q = url.searchParams.get('q')?.trim() || '';
  const sort = url.searchParams.get('sort') || 'created_at';
  const order = url.searchParams.get('order') === 'asc' ? true : false;

  const db = adminDb();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // First get contacts with pagination
  let query = db
    .from('contacts')
    .select('*', { count: 'exact' });

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const allowedSorts = ['created_at', 'name', 'phone', 'email'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';

  const { data: contacts, count, error } = await query
    .order(sortCol, { ascending: order })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with owner info
  const userIds = [...new Set((contacts ?? []).map((c) => c.user_id))];
  let owners: Record<string, { full_name: string; email: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', userIds);

    if (profiles) {
      owners = Object.fromEntries(
        profiles.map((p) => [p.user_id, { full_name: p.full_name, email: p.email }])
      );
    }
  }

  const enriched = (contacts ?? []).map((c) => ({
    ...c,
    owner: owners[c.user_id] || null,
  }));

  return NextResponse.json({
    contacts: enriched,
    totalCount: count ?? 0,
    page,
    pageSize,
  });
}
