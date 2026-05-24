"use client";
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function Inner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const btnText = typeof d.config.button_text === "string" ? d.config.button_text : "";
  const url = typeof d.config.url === "string" ? d.config.url : "";
  return (
    <BaseNode nodeType="send_cta_url" nodeKey={d.node_key} isEntry={d.isEntry} selected={selected}
      onDelete={d.onDelete as (() => void) | undefined} onDuplicate={d.onDuplicate as (() => void) | undefined} onEdit={d.onEdit as (() => void) | undefined}>
      <p className="text-[10px] font-medium text-foreground/80">{btnText || "CTA Button"}</p>
      {url && <p className="text-[9px] text-muted-foreground font-mono truncate">{truncate(url, 35)}</p>}
    </BaseNode>
  );
}
export const SendCtaUrlNode = memo(Inner);
