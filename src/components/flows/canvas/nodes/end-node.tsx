"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function EndNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <BaseNode
      nodeType="end"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      isTerminal
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      <p className="text-[10px] text-muted-foreground/60">
        Flow terminates here
      </p>
    </BaseNode>
  );
}

export const EndNode = memo(EndNodeInner);
