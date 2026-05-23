"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function HandoffNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const note = typeof d.config.note === "string" ? d.config.note : "";
  return (
    <BaseNode
      nodeType="handoff"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      isTerminal
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      {note ? (
        <p className="text-[10px] leading-relaxed text-foreground/80">
          {truncate(note, 60)}
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          Hands off to a human agent
        </p>
      )}
    </BaseNode>
  );
}

export const HandoffNode = memo(HandoffNodeInner);
