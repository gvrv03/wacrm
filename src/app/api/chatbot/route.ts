import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/chatbot — List all bot replies for the authenticated user.
 * POST /api/chatbot — Create a new bot reply.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('chatbot_replies')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!body.reply_text?.trim()) {
    return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
  }
  if (body.trigger_type !== 'welcome' && !body.trigger_value?.trim()) {
    return NextResponse.json({ error: 'Trigger value is required' }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    name: body.name.trim(),
    reply_type: body.reply_type || 'text',
    reply_text: body.reply_text.trim(),
    header_type: body.header_type || 'none',
    header_content: body.header_content || null,
    footer_text: body.footer_text?.trim() || null,
    buttons: body.buttons || null,
    list_sections: body.list_sections || null,
    list_button_text: body.list_button_text || 'View Options',
    cta_button_text: body.cta_button_text || null,
    cta_button_url: body.cta_button_url || null,
    carousel_cards: body.carousel_cards || null,
    trigger_type: body.trigger_type || 'contains',
    trigger_value: body.trigger_value?.trim() || null,
    case_sensitive: !!body.case_sensitive,
    is_active: body.is_active !== false,
    priority: body.priority || 0,
  };

  const { data, error } = await supabase
    .from('chatbot_replies')
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reply: data }, { status: 201 });
}
