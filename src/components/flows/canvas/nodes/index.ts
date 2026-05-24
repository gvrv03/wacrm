/**
 * Node types registry for React Flow.
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
import { SendImageNode } from "./send-image-node";
import { SendDocumentNode } from "./send-document-node";
import { SendLocationNode } from "./send-location-node";
import { SendContactsNode } from "./send-contacts-node";
import { SendCtaUrlNode } from "./send-cta-url-node";
import { AskLocationNode } from "./ask-location-node";

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
  send_image: SendImageNode,
  send_document: SendDocumentNode,
  send_location: SendLocationNode,
  send_contacts: SendContactsNode,
  send_cta_url: SendCtaUrlNode,
  ask_location: AskLocationNode,
} as const;
