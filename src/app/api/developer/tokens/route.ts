import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';

/**
 * GET /api/developer/tokens
 * List all API tokens for the authenticated user (shows prefix only).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, name, token_prefix, last_used_at, expires_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}

/**
 * POST /api/developer/tokens
 * Generate a new API token. Returns the full token ONCE — it's hashed before storage.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = (body.name as string)?.trim() || 'Default';

  // Generate a secure random token
  const rawToken = `wcrm_${randomBytes(32).toString('hex')}`;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = rawToken.slice(0, 12);

  const { error } = await supabase.from('api_tokens').insert({
    user_id: user.id,
    name,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the full token — this is the only time it's visible
  return NextResponse.json({ token: rawToken, prefix: tokenPrefix, name }, { status: 201 });
}

/**
 * DELETE /api/developer/tokens
 * Revoke a token by ID.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: 'Token ID required' }, { status: 400 });

  const { error } = await supabase
    .from('api_tokens')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
