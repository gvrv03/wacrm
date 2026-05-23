"use client";

/**
 * Validation panel — renders at the bottom of the canvas.
 *
 * Shows a collapsible issue list. Clicking a node-scoped issue selects
 * and focuses that node on the canvas.
 */

import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";

interface ValidationPanelProps {
  issues: ValidationIssue[];
  onJump: (key: string) => void;
}

export function ValidationPanel({ issues, onJump }: ValidationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 shadow-sm rounded-lg">
        <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        No issues. Ready to activate.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-white border rounded-lg shadow-xl transition-all duration-200",
        errors.length > 0
          ? "border-red-200"
          : "border-amber-200",
      )}
    >
      {/* Summary bar (always visible) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        {errors.length > 0 ? (
          <CircleAlert className="h-4 w-4 shrink-0 text-red-500" />
        ) : (
          <CircleAlert className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span className="flex-1 text-xs font-semibold text-slate-700">
          {errors.length} error{errors.length === 1 ? "" : "s"},{" "}
          {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {/* Expanded issue list */}
      {expanded && (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto px-4 pb-3 border-t border-slate-100 pt-2 bg-slate-50/50 rounded-b-lg">
          {issues.map((issue, idx) => {
            const tone =
              issue.severity === "error"
                ? "text-red-700 hover:bg-red-50 border border-red-100/50 bg-white"
                : "text-amber-700 hover:bg-amber-50 border border-amber-100/50 bg-white";
            const iconTone =
              issue.severity === "error"
                ? "text-red-500"
                : "text-amber-500";

            const content = (
              <>
                <CircleAlert
                  className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconTone)}
                />
                <span className="min-w-0 flex-1 leading-normal">
                  {issue.node_key && (
                    <code className="mr-1 rounded bg-slate-100 border border-slate-200 px-1 py-0.5 text-[9px] font-mono text-slate-500">
                      {issue.node_key}
                    </code>
                  )}
                  {issue.message}
                </span>
              </>
            );

            if (issue.node_key) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onJump(issue.node_key!)}
                  className={cn(
                    "flex w-full items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[10px] font-medium transition-all shadow-sm",
                    tone,
                  )}
                >
                  {content}
                </button>
              );
            }
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium shadow-sm",
                  tone,
                )}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
