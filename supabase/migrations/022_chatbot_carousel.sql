-- ============================================================
-- 022: Add carousel reply type to chatbot_replies
-- ============================================================

ALTER TABLE chatbot_replies DROP CONSTRAINT IF EXISTS chatbot_replies_reply_type_check;
ALTER TABLE chatbot_replies ADD CONSTRAINT chatbot_replies_reply_type_check
  CHECK (reply_type IN ('text', 'interactive_buttons', 'interactive_list', 'cta_url', 'carousel'));

-- carousel_cards JSONB column for storing card data
ALTER TABLE chatbot_replies
  ADD COLUMN IF NOT EXISTS carousel_cards JSONB DEFAULT NULL;
