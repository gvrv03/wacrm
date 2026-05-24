"use client";
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function Inner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const text = typeof d.config.body_text === "string" ? d.config.body_text : "";
  return (
    <BaseNode nodeType="ask_location" nodeKey={d.node_key} isEntry={d.isEntry} selected={selected}
      onDelete={d.onDelete as (() => void) | undefined} onDuplicate={d.onDuplicate as (() => void) | undefined} onEdit={d.onEdit as (() => void) | undefined}>
      <p className="text-[10px] text-foreground/80">{text ? truncate(text, 40) : "Request location"}</p>
    </BaseNode>
  );
}
export const AskLocationNode = memo(Inner);
