-- ============================================================
-- 016: API Access Tokens & Webhook Configuration
--
-- Stores user-generated API tokens for external integrations
-- and per-user webhook endpoint configuration.
-- ============================================================

CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL, -- first 8 chars for display
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_hash)
);

ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tokens" ON api_tokens;
CREATE POLICY "Users can manage own tokens" ON api_tokens FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS webhook_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  url TEXT,
  secret TEXT,
  events TEXT[] DEFAULT ARRAY['message.received', 'message.sent', 'contact.created'],
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own webhook" ON webhook_config;
CREATE POLICY "Users can manage own webhook" ON webhook_config FOR ALL USING (auth.uid() = user_id);
