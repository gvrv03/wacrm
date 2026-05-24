"use client";
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function Inner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const name = typeof d.config.name === "string" ? d.config.name : "";
  const lat = typeof d.config.latitude === "number" ? d.config.latitude : 0;
  const lng = typeof d.config.longitude === "number" ? d.config.longitude : 0;
  return (
    <BaseNode nodeType="send_location" nodeKey={d.node_key} isEntry={d.isEntry} selected={selected}
      onDelete={d.onDelete as (() => void) | undefined} onDuplicate={d.onDuplicate as (() => void) | undefined} onEdit={d.onEdit as (() => void) | undefined}>
      <p className="text-[10px] text-foreground/80">{name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</p>
    </BaseNode>
  );
}
export const SendLocationNode = memo(Inner);
