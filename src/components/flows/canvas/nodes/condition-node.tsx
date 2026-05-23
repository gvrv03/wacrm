"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function ConditionNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const subject = d.config.subject as string | undefined;
  const subjectKey = typeof d.config.subject_key === "string" ? d.config.subject_key : "";
  const operator = d.config.operator as string | undefined;
  const value = typeof d.config.value === "string" ? d.config.value : "";

  const subjectLabel =
    subject === "tag"
      ? "tag"
      : subject === "contact_field"
        ? "field"
        : "var";

  const opLabel =
    operator === "equals"
      ? "=="
      : operator === "contains"
        ? "∋"
        : operator === "present"
          ? "exists"
          : operator === "absent"
            ? "∅"
            : "?";

  return (
    <BaseNode
      nodeType="condition"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
      handles={
        <div className="relative flex pb-4">
          <div className="flex flex-1 items-center justify-center border-t border-slate-100 py-1.5 bg-slate-50/30">
            <span className="text-[9px] font-semibold text-emerald-600">True</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="true"
              className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-emerald-500 transition-colors hover:!bg-emerald-600 hover:!scale-110"
              style={{ left: "30%" }}
            />
          </div>
          <div className="flex flex-1 items-center justify-center border-l border-t border-slate-100 py-1.5 bg-slate-50/30">
            <span className="text-[9px] font-semibold text-red-600">False</span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="false"
              className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-red-500 transition-colors hover:!bg-red-600 hover:!scale-110"
              style={{ left: "70%" }}
            />
          </div>
        </div>
      }
    >
      {subjectKey ? (
        <p className="text-[10px] text-slate-700">
          <span className="font-mono font-semibold text-fuchsia-700">
            {subjectLabel}.{subjectKey}
          </span>{" "}
          <span className="text-slate-400">{opLabel}</span>
          {value && (
            <span className="ml-1 text-slate-800 font-medium">&quot;{value}&quot;</span>
          )}
        </p>
      ) : (
        <p className="text-[10px] italic text-slate-400">
          No condition configured
        </p>
      )}
    </BaseNode>
  );
}

export const ConditionNode = memo(ConditionNodeInner);
