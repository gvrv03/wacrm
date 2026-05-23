"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./base-node";
import type { FlowNodeData } from "../../lib/graph-utils";

function WaitSendNodeInner({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const amount = typeof d.config.delay_amount === "number" ? d.config.delay_amount : 1;
  const unit = typeof d.config.delay_unit === "string" ? d.config.delay_unit : "hours";
  const messageType = typeof d.config.message_type === "string" ? d.config.message_type : "text";
  const timing = typeof d.config.timing_mode === "string" ? d.config.timing_mode : "fixed";

  return (
    <BaseNode
      nodeType="wait_send_message"
      nodeKey={d.node_key}
      isEntry={d.isEntry}
      selected={selected}
      onDelete={d.onDelete as (() => void) | undefined}
      onDuplicate={d.onDuplicate as (() => void) | undefined}
      onEdit={d.onEdit as (() => void) | undefined}
    >
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium text-foreground/80">
          Wait {amount} {unit}
        </p>
        <p className="text-[9px] text-muted-foreground/70">
          {timing === "relative" ? "from last message" : "from entry"} · sends {messageType}
        </p>
      </div>
    </BaseNode>
  );
}

export const WaitSendNode = memo(WaitSendNodeInner);
