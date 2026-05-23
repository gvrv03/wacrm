"use client";

/**
 * Custom animated edge for the flow canvas.
 *
 * Features:
 *   - Smooth bezier path
 *   - Subtle animated dash pattern
 *   - Label with semi-transparent background
 *   - Floating X delete button to disconnect the edge
 */

import { memo } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  EdgeLabelRenderer,
} from "@xyflow/react";
import { X } from "lucide-react";

function AnimatedEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDelete = (data as { onDelete?: () => void })?.onDelete;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: "#6366f1", // Highly visible indigo in Light Theme
          strokeWidth: 2,
          ...style,
        }}
      />
      {(label || onDelete) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm transition-all hover:border-slate-300 hover:shadow"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label && (
              <span className="px-2 py-0.5 text-[9px] font-bold text-slate-600">
                {label}
              </span>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Disconnect line"
              >
                <X className="h-2.5 w-2.5" strokeWidth={3} />
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const AnimatedEdge = memo(AnimatedEdgeInner);
