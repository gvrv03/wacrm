"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function StartNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const next = d.config.next_node_key as string | undefined;
  return (
    <BaseNode
      nodeType="start"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      {next ? (
        <p className="text-[10px] text-muted-foreground">
          → <span className="font-mono text-foreground/80">{next}</span>
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          No next node set
        </p>
      )}
    </BaseNode>
  );
}

export const StartNode = memo(StartNodeInner);
