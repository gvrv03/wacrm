import { NextResponse } from 'next/server';
import { requireAdmin, adminDb } from '@/lib/admin/require-admin';

/**
 * GET /api/admin/users?page=1&pageSize=20&q=search&sort=created_at&order=desc
 * Lists all platform users with server-side pagination, search, and sorting.
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

  let query = db
    .from('profiles')
    .select('*', { count: 'exact' });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const allowedSorts = ['created_at', 'full_name', 'email', 'role'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';

  const { data, count, error } = await query
    .order(sortCol, { ascending: order })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize,
  });
}

/**
 * POST /api/admin/users
 * Creates a new user via Supabase Auth admin API.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 }
    );
  }

  const db = adminDb();

  // Create auth user
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: body.full_name || body.email.split('@')[0],
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create or update profile row (a DB trigger may have already created it)
  if (authData.user) {
    const { error: profileError } = await db.from('profiles').upsert(
      {
        user_id: authData.user.id,
        full_name: body.full_name || body.email.split('@')[0],
        email: body.email,
        role: body.role || 'user',
      },
      { onConflict: 'user_id' }
    );

    if (profileError) {
      console.error('[admin/users POST] Profile upsert failed:', profileError);
    }
  }

  return NextResponse.json({ user: authData.user }, { status: 201 });
}
