-- ============================================================
-- 019: API Request and Wait/Schedule Message node types
--
-- Adds two new node types to flows:
-- - api_request: makes HTTP calls and routes based on response
-- - wait_send_message: pauses flow, sends scheduled message
--
-- Also adds scheduled_send_at to flow_runs for cron polling.
-- ============================================================

-- Update flow_nodes node_type CHECK constraint to allow new types
ALTER TABLE flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;
ALTER TABLE flow_nodes ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_message',
    'send_buttons',
    'send_list',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'end',
    'send_chatbot_reply',
    'api_request',
    'wait_send_message'
  ));

-- Add scheduled_send_at column to flow_runs for wait nodes
ALTER TABLE flow_runs
  ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ DEFAULT NULL;

-- Partial index for efficient cron polling — only indexes active runs
-- with a pending scheduled send, keeping the index size small.
CREATE INDEX IF NOT EXISTS idx_flow_runs_scheduled_active
  ON flow_runs (scheduled_send_at)
  WHERE status = 'active' AND scheduled_send_at IS NOT NULL;
