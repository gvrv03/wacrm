"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function SetTagNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const mode = d.config.mode === "remove" ? "Remove" : "Add";
  const tagId = typeof d.config.tag_id === "string" ? d.config.tag_id : "";
  return (
    <BaseNode
      nodeType="set_tag"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      <p className="text-[10px] text-slate-700">
        <span className="font-semibold text-pink-700">{mode}</span>{" "}
        {tagId ? (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
            {tagId.slice(0, 12)}…
          </code>
        ) : (
          <span className="italic text-muted-foreground/60">no tag selected</span>
        )}
      </p>
    </BaseNode>
  );
}

export const SetTagNode = memo(SetTagNodeInner);
