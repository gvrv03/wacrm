"use client";
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function Inner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const contacts = Array.isArray(d.config.contacts) ? d.config.contacts : [];
  return (
    <BaseNode nodeType="send_contacts" nodeKey={d.node_key} isEntry={d.isEntry} selected={selected}
      onDelete={d.onDelete as (() => void) | undefined} onDuplicate={d.onDuplicate as (() => void) | undefined} onEdit={d.onEdit as (() => void) | undefined}>
      <p className="text-[10px] text-foreground/80">{contacts.length} contact(s)</p>
    </BaseNode>
  );
}
export const SendContactsNode = memo(Inner);
