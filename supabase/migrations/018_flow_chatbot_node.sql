-- ============================================================
-- 018: Add send_chatbot_reply to flow_nodes node_type constraint
-- ============================================================

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
    'send_chatbot_reply'
  ));
