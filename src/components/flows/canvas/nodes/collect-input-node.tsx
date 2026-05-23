"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function CollectInputNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const prompt = typeof d.config.prompt_text === "string" ? d.config.prompt_text : "";
  const varKey = typeof d.config.var_key === "string" ? d.config.var_key : "";
  return (
    <BaseNode
      nodeType="collect_input"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      {prompt ? (
        <p className="text-[10px] leading-relaxed text-foreground/80">
          {truncate(prompt, 60)}
        </p>
      ) : (
        <p className="text-[10px] italic text-muted-foreground/60">
          No prompt set
        </p>
      )}
      {varKey && (
        <p className="mt-1 text-[9px] text-muted-foreground">
          → <code className="rounded bg-muted px-1 py-0.5 font-mono text-[8px]">vars.{varKey}</code>
        </p>
      )}
    </BaseNode>
  );
}

export const CollectInputNode = memo(CollectInputNodeInner);
