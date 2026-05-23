"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function ChatbotReplyNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const replyId = typeof d.config.chatbot_reply_id === "string" ? d.config.chatbot_reply_id : "";
  const buttonRoutes = (d.config.button_routes ?? []) as Array<{
    button_id: string;
    button_text: string;
    next_node_key: string;
  }>;
  const rowRoutes = (d.config.row_routes ?? []) as Array<{
    row_id: string;
    row_title: string;
    next_node_key: string;
  }>;

  const hasRoutes = buttonRoutes.length > 0 || rowRoutes.length > 0;

  return (
    <BaseNode
      nodeType="send_chatbot_reply"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
      handles={
        hasRoutes ? (
          <div className="relative pb-3">
            {buttonRoutes.map((br, idx) => (
              <div
                key={br.button_id || idx}
                className="relative flex items-center justify-between border-t border-slate-100 px-3 py-1"
              >
                <span className="text-[9px] text-slate-600 font-medium">
                  {br.button_text || br.button_id}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`cbtn_${idx}`}
                  className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-cyan-500 transition-colors hover:!bg-cyan-600 hover:!scale-110"
                  style={{ top: "50%", right: -5 }}
                />
              </div>
            ))}
            {rowRoutes.map((rr, idx) => (
              <div
                key={rr.row_id || idx}
                className="relative flex items-center justify-between border-t border-slate-100 px-3 py-1"
              >
                <span className="text-[9px] text-slate-600 font-medium">
                  {rr.row_title || rr.row_id}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`crow_${idx}`}
                  className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-cyan-500 transition-colors hover:!bg-cyan-600 hover:!scale-110"
                  style={{ top: "50%", right: -5 }}
                />
              </div>
            ))}
          </div>
        ) : undefined
      }
    >
      {replyId ? (
        <p className="text-[10px] text-foreground/80">
          Reply{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
            {replyId.slice(0, 12)}…
          </code>
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          Select a bot reply
        </p>
      )}
    </BaseNode>
  );
}

export const ChatbotReplyNode = memo(ChatbotReplyNodeInner);
