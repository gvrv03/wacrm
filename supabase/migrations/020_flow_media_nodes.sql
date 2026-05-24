-- ============================================================
-- 020: Add media/location/contact/CTA URL node types to flows
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
    'send_chatbot_reply',
    'api_request',
    'wait_send_message',
    'send_image',
    'send_document',
    'send_location',
    'send_contacts',
    'send_cta_url',
    'ask_location'
  ));
