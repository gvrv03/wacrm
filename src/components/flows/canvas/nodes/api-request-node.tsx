"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import { truncate } from "../../lib/constants";
import type { FlowNodeData } from "../../lib/graph-utils";

function ApiRequestNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const method = typeof d.config.method === "string" ? d.config.method : "GET";
  const url = typeof d.config.url === "string" ? d.config.url : "";
  return (
    <BaseNode
      nodeType="api_request"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
      handles={
        <div className="relative pb-3">
          <div className="flex items-center justify-between border-t border-border/30 px-3 py-1.5">
            <span className="text-[10px] font-medium text-emerald-600">Success</span>
            <Handle
              type="source"
              position={Position.Right}
              id="success"
              className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-emerald-500 transition-colors hover:!bg-emerald-600 hover:!scale-110"
              style={{ top: "50%", right: -5 }}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border/30 px-3 py-1.5">
            <span className="text-[10px] font-medium text-red-600">Failure</span>
            <Handle
              type="source"
              position={Position.Right}
              id="failure"
              className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-red-500 transition-colors hover:!bg-red-600 hover:!scale-110"
              style={{ top: "50%", right: -5 }}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-0.5">
        <span className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-violet-700">
          {method}
        </span>
        {url ? (
          <p className="text-[10px] font-mono text-foreground/70">
            {truncate(url, 40)}
          </p>
        ) : (
          <p className="text-[10px] italic text-muted-foreground/60">No URL set</p>
        )}
      </div>
    </BaseNode>
  );
}

export const ApiRequestNode = memo(ApiRequestNodeInner);
