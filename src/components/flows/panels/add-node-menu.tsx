"use client";

/**
 * Add-node dropdown button for the flow builder toolbar.
 *
 * Renders a dropdown with all available node types. Clicking an item
 * calls onAdd(type) which adds the node and auto-positions it on the canvas.
 */

import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NODE_META, type NodeType } from "../lib/constants";

const NODE_TYPE_ORDER: NodeType[] = [
  "start",
  "send_buttons",
  "send_list",
  "send_message",
  "send_chatbot_reply",
  "api_request",
  "wait_send_message",
  "collect_input",
  "condition",
  "set_tag",
  "handoff",
  "end",
];

interface AddNodeMenuProps {
  onAdd: (type: NodeType) => void;
}

export function AddNodeMenu({ onAdd }: AddNodeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-md"
        aria-label="Add node"
      >
        <Plus className="h-3.5 w-3.5" />
        Add node
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-border bg-card w-48">
        {NODE_TYPE_ORDER.map((t) => {
          const meta = NODE_META[t];
          const Icon = meta.icon;
          return (
            <DropdownMenuItem
              key={t}
              onClick={() => onAdd(t)}
              className="gap-2"
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded",
                  meta.bgAccent,
                )}
              >
                <Icon className={cn("h-3 w-3", meta.color)} />
              </div>
              <span className="text-xs">{meta.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
