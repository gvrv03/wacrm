-- ============================================================
-- 017: Chat Bot Replies
--
-- Stores auto-reply rules that trigger interactive WhatsApp
-- messages (text, buttons, list, CTA URL) based on incoming
-- message matching (exact, contains, starts_with, ends_with,
-- contains_whole_word, welcome).
-- ============================================================

CREATE TABLE IF NOT EXISTS chatbot_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Response type: text, interactive_buttons, interactive_list, cta_url
  reply_type TEXT NOT NULL DEFAULT 'text'
    CHECK (reply_type IN ('text', 'interactive_buttons', 'interactive_list', 'cta_url')),
  -- Reply content
  reply_text TEXT NOT NULL,
  header_type TEXT CHECK (header_type IN ('none', 'text', 'image', 'video', 'document')),
  header_content TEXT,
  footer_text TEXT,
  -- Buttons (JSONB array for interactive_buttons)
  -- [{text: "Option 1", id: "opt_1"}, ...]
  buttons JSONB,
  -- List sections (JSONB for interactive_list)
  -- [{title: "Section", rows: [{id: "row_1", title: "Row 1", description: "..."}]}]
  list_sections JSONB,
  list_button_text TEXT DEFAULT 'View Options',
  -- CTA URL button
  cta_button_text TEXT,
  cta_button_url TEXT,
  -- Trigger configuration
  trigger_type TEXT NOT NULL DEFAULT 'contains'
    CHECK (trigger_type IN ('welcome', 'is', 'starts_with', 'ends_with', 'contains_whole_word', 'contains')),
  trigger_value TEXT, -- comma-separated keywords; null for 'welcome'
  case_sensitive BOOLEAN DEFAULT false,
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  -- Stats
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chatbot_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own chatbot replies" ON chatbot_replies;
CREATE POLICY "Users can manage own chatbot replies" ON chatbot_replies
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast trigger matching
CREATE INDEX IF NOT EXISTS idx_chatbot_replies_active
  ON chatbot_replies (user_id, is_active, trigger_type);
