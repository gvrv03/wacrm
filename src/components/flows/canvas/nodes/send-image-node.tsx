"use client";
import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function Inner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const url = typeof d.config.image_url === "string" ? d.config.image_url : "";
  const caption = typeof d.config.caption === "string" ? d.config.caption : "";
  return (
    <BaseNode nodeType="send_image" nodeKey={d.node_key} isEntry={d.isEntry} selected={selected}
      onDelete={d.onDelete as (() => void) | undefined} onDuplicate={d.onDuplicate as (() => void) | undefined} onEdit={d.onEdit as (() => void) | undefined}>
      {url ? <p className="text-[10px] text-foreground/70 font-mono truncate">{truncate(url, 40)}</p>
        : <p className="text-[10px] italic text-muted-foreground/60">No image URL</p>}
      {caption && <p className="text-[9px] text-muted-foreground mt-0.5">{truncate(caption, 30)}</p>}
    </BaseNode>
  );
}
export const SendImageNode = memo(Inner);
