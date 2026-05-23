import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

/**
 * GET /api/developer/webhook
 * Get the user's webhook configuration.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('webhook_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If no config exists, return defaults
  if (!data) {
    return NextResponse.json({
      webhook: {
        enabled: false,
        url: '',
        secret: '',
        events: ['message.received', 'message.sent', 'contact.created'],
      },
    });
  }

  return NextResponse.json({ webhook: data });
}

/**
 * PUT /api/developer/webhook
 * Update webhook configuration.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const payload = {
    user_id: user.id,
    enabled: !!body.enabled,
    url: (body.url as string)?.trim() || null,
    secret: (body.secret as string)?.trim() || null,
    events: Array.isArray(body.events) ? body.events : ['message.received', 'message.sent', 'contact.created'],
    updated_at: new Date().toISOString(),
  };

  // Upsert
  const { error } = await supabase
    .from('webhook_config')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/developer/webhook
 * Generate a new webhook secret.
 */
export async function POST() {
  const secret = randomBytes(32).toString('hex');
  return NextResponse.json({ secret });
}
