"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function SendButtonsNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const text = typeof d.config.text === "string" ? d.config.text : "";
  const buttons = (d.config.buttons ?? []) as Array<{
    reply_id: string;
    title: string;
    next_node_key: string;
  }>;

  return (
    <BaseNode
      nodeType="send_buttons"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
      handles={
        <div className="relative pb-3">
          {buttons.map((btn, idx) => (
            <div
              key={btn.reply_id || idx}
              className="relative flex items-center justify-between border-t border-border/30 px-3 py-1.5"
            >
              <span className="text-[10px] font-medium text-foreground/80">
                {btn.title || `Button ${idx + 1}`}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`btn_${idx}`}
                className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-indigo-500/80 transition-colors hover:!bg-indigo-600 hover:!scale-110"
                style={{ top: "50%", right: -5 }}
              />
            </div>
          ))}
        </div>
      }
    >
      {text ? (
        <p className="text-[10px] leading-relaxed text-foreground/80">
          {truncate(text, 50)}
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          No body text
        </p>
      )}
    </BaseNode>
  );
}

export const SendButtonsNode = memo(SendButtonsNodeInner);
