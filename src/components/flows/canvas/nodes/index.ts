/**
 * Node types registry for React Flow.
 *
 * Maps each flow node_type string to its custom React component.
 * Passed to <ReactFlow nodeTypes={nodeTypes} />.
 */

import { StartNode } from "./start-node";
import { SendMessageNode } from "./send-message-node";
import { SendButtonsNode } from "./send-buttons-node";
import { SendListNode } from "./send-list-node";
import { CollectInputNode } from "./collect-input-node";
import { ConditionNode } from "./condition-node";
import { SetTagNode } from "./set-tag-node";
import { HandoffNode } from "./handoff-node";
import { EndNode } from "./end-node";
import { ChatbotReplyNode } from "./chatbot-reply-node";
import { ApiRequestNode } from "./api-request-node";
import { WaitSendNode } from "./wait-send-node";

export const nodeTypes = {
  start: StartNode,
  send_message: SendMessageNode,
  send_buttons: SendButtonsNode,
  send_list: SendListNode,
  collect_input: CollectInputNode,
  condition: ConditionNode,
  set_tag: SetTagNode,
  handoff: HandoffNode,
  end: EndNode,
  send_chatbot_reply: ChatbotReplyNode,
  api_request: ApiRequestNode,
  wait_send_message: WaitSendNode,
} as const;
