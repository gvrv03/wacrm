"use client";

/**
 * Shared base wrapper for all custom flow nodes.
 *
 * Renders a dark glass-morphism card with:
 *   - Colored top accent bar based on node type
 *   - Icon + label + node_key badge
 *   - Entry badge when this is the entry node
 *   - A target handle at the top
 *   - Children (specific node content + source handles)
 *   - Selection ring
 */

import { memo, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Trash2, Copy, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_META, type NodeType } from "../../lib/constants";

interface BaseNodeProps {
  nodeType: NodeType;
  nodeKey: string;
  isEntry: boolean;
  selected?: boolean;
  children?: ReactNode;
  /** Extra source handles rendered below the content */
  handles?: ReactNode;
  /** Whether this is a terminal node (no default source handle) */
  isTerminal?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
}

function BaseNodeInner({
  nodeType,
  nodeKey,
  isEntry,
  selected,
  children,
  handles,
  isTerminal = false,
  onDelete,
  onDuplicate,
  onEdit,
}: BaseNodeProps) {
  const meta = NODE_META[nodeType];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group relative min-w-[220px] max-w-[280px] rounded-xl border transition-all duration-200",
        "bg-white border-slate-200/90 shadow-sm hover:shadow-md",
        selected && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-white shadow-indigo-100/60 shadow-xl !border-indigo-300",
        isEntry && !selected && "ring-1 ring-emerald-500/50 !border-emerald-300",
      )}
    >
      {/* Floating Action Menu (Header Top Right, visible on hover) */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white/90 border border-slate-100 rounded-lg p-0.5 shadow-sm backdrop-blur-sm">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Edit settings"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        )}
        {onDuplicate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Duplicate node"
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete node"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Target handle (top) */}
      {nodeType !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-slate-400/80 transition-colors hover:!bg-indigo-600 hover:!scale-110"
        />
      )}

      {/* Accent bar */}
      <div
        className={cn(
          "h-1 rounded-t-xl",
          meta.bgAccent,
        )}
      />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/50 rounded-t-xl">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm border border-slate-100", meta.bgAccent)}>
          <Icon className={cn("h-3.5 w-3.5", meta.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-slate-800">
              {meta.label}
            </span>
            {isEntry && (
              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-700">
                Entry
              </span>
            )}
          </div>
          <code className="block truncate text-[9px] text-slate-400 font-mono">
            {nodeKey}
          </code>
        </div>
      </div>

      {/* Content */}
      {children && (
        <div className="border-t border-slate-100 px-3 py-2 text-slate-600 bg-white">
          {children}
        </div>
      )}

      {/* Custom handles */}
      {handles}

      {/* Default source handle (bottom) for non-terminal, non-branching nodes */}
      {!isTerminal && !handles && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className="!h-3 !w-3 !rounded-full !border-2 !border-white !bg-slate-400/80 transition-colors hover:!bg-indigo-600 hover:!scale-110"
        />
      )}
    </div>
  );
}

export const BaseNode = memo(BaseNodeInner);
