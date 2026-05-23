"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function SendMessageNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const text = typeof d.config.text === "string" ? d.config.text : "";
  return (
    <BaseNode
      nodeType="send_message"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      {text ? (
        <p className="text-[10px] leading-relaxed text-foreground/80">
          {truncate(text, 60)}
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          Empty message
        </p>
      )}
    </BaseNode>
  );
}

export const SendMessageNode = memo(SendMessageNodeInner);
