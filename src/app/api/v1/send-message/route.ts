import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function adminDb() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/v1/send-message
 *
 * External API endpoint for sending WhatsApp messages.
 * Authenticates via Bearer token (API Access Token).
 *
 * Request body:
 * {
 *   "phone_number": "+1234567890",
 *   "message": "Hello!",
 *   // OR for templates:
 *   "template_name": "order_update",
 *   "template_language": "en_US",
 *   "template_variables": ["John", "ORD-123"]
 * }
 */
export async function POST(request: Request) {
  // Extract Bearer token
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: 'Missing Authorization header. Use: Bearer <your_api_token>' },
      { status: 401 }
    );
  }

  // Hash the token and look it up
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const db = adminDb();

  const { data: tokenRow, error: tokenErr } = await db
    .from('api_tokens')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: 'Invalid API token' }, { status: 401 });
  }

  // Update last_used_at
  await db
    .from('api_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // Parse request body
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { phone_number, message, template_name, template_language, template_variables } = body;

  if (!phone_number) {
    return NextResponse.json({ error: 'phone_number is required' }, { status: 400 });
  }

  if (!message && !template_name) {
    return NextResponse.json(
      { error: 'Either message or template_name is required' },
      { status: 400 }
    );
  }

  // Forward to the internal send API
  // This reuses the existing WhatsApp send infrastructure
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const internalPayload: Record<string, unknown> = {
      phone_number,
      user_id: tokenRow.user_id,
    };

    if (template_name) {
      internalPayload.template_name = template_name;
      internalPayload.template_language = template_language || 'en_US';
      internalPayload.template_variables = template_variables || [];
    } else {
      internalPayload.message = message;
    }

    // Use the internal send endpoint
    const res = await fetch(`${siteUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-user-id': tokenRow.user_id,
      },
      body: JSON.stringify(internalPayload),
    });

    const result = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to send message', details: result },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message_id: result.message_id || result.whatsapp_message_id,
      ...result,
    });
  } catch (err) {
    console.error('[v1/send-message] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
