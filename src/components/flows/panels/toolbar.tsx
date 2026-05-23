"use client";

/**
 * Top toolbar for the flow builder canvas.
 *
 * Contains: back button, flow name input, status badge, dirty indicator,
 * description input, trigger config, entry node picker, and action buttons
 * (runs, delete, activate/pause, save).
 */

import { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  Save,
  Trash2,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";
import type { BuilderState } from "../lib/constants";
import { NODE_META } from "../lib/constants";

interface ToolbarProps {
  state: BuilderState;
  setState: React.Dispatch<React.SetStateAction<BuilderState>>;
  dirty: boolean;
  saving: boolean;
  activating: boolean;
  canActivate: boolean;
  triggerIssues: ValidationIssue[];
  onSave: () => void;
  onStatus: (s: BuilderState["status"]) => void;
  onDelete: () => void;
  onBack: () => void;
  onViewRuns: () => void;
}

export function Toolbar({
  state,
  setState,
  dirty,
  saving,
  activating,
  canActivate,
  triggerIssues,
  onSave,
  onStatus,
  onDelete,
  onBack,
  onViewRuns,
}: ToolbarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Row 1: Breadcrumb + name + actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-3 w-3" />
          Flows
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-slate-200" />

        {/* Flow name */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Workflow className="h-4 w-4 shrink-0 text-indigo-600" />
          <Input
            value={state.name}
            onChange={(e) =>
              setState((s) => ({ ...s, name: e.target.value }))
            }
            placeholder="Flow name"
            className="h-8 max-w-[260px] border-transparent bg-transparent text-sm font-bold text-slate-800 hover:border-slate-200 focus:border-slate-200 focus:bg-slate-50/50"
          />
          <StatusBadge status={state.status} />
          {dirty && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-600"
              title="Unsaved changes"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Edited
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onViewRuns} className="h-7 text-xs text-slate-600 hover:bg-slate-50">
            <History className="h-3 w-3 mr-1" />
            Runs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200" />

          {state.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("draft")}
              disabled={activating}
              className="h-7 text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
            >
              {activating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatus("active")}
              disabled={activating || !canActivate}
              title={
                !canActivate
                  ? "Fix the issues below before activating"
                  : undefined
              }
              className="h-7 text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {activating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Activate
            </Button>
          )}

          <Button onClick={onSave} disabled={saving} size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all hover:shadow">
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Expand toggle for settings */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 self-start text-[10px] text-slate-400 font-bold tracking-wide transition-colors hover:text-slate-600"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {expanded ? "HIDE" : "SHOW"} TRIGGER & SETTINGS
      </button>

      {/* Row 2: Trigger + entry (collapsible) */}
      {expanded && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-inner">
          {/* Description */}
          <Input
            value={state.description}
            onChange={(e) =>
              setState((s) => ({ ...s, description: e.target.value }))
            }
            placeholder="Optional description (internal — customers don't see this)"
            className="h-7 border-transparent bg-transparent text-xs text-slate-600 hover:border-slate-200 focus:border-slate-200 focus:bg-white"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Trigger type */}
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                Trigger
              </label>
              <Select
                value={state.trigger_type}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    trigger_type: v as BuilderState["trigger_type"],
                    trigger_config:
                      v === "keyword"
                        ? { keywords: [] }
                        : v === "manual"
                          ? {}
                          : {},
                  }))
                }
              >
                <SelectTrigger className="h-7.5 bg-white border-slate-200 text-xs text-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword match</SelectItem>
                  <SelectItem value="first_inbound_message">
                    First inbound message
                  </SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Keywords (conditional) */}
            {state.trigger_type === "keyword" && (
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Keywords (comma-separated)
                </label>
                <Input
                  value={
                    Array.isArray(state.trigger_config.keywords)
                      ? (state.trigger_config.keywords as string[]).join(", ")
                      : ""
                  }
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      trigger_config: {
                        ...s.trigger_config,
                        keywords: e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                  placeholder="support, help, hi"
                  className="h-7.5 bg-white border-slate-200 text-xs text-slate-700"
                />
              </div>
            )}

            {/* Entry node picker */}
            {state.nodes.length > 0 && (
              <div>
                <label className="mb-1 block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Entry node
                </label>
                <Select
                  value={state.entry_node_id ?? "__none__"}
                  onValueChange={(v) =>
                    setState((s) => ({
                      ...s,
                      entry_node_id: v === "__none__" ? null : v,
                    }))
                  }
                >
                  <SelectTrigger className="h-7.5 bg-white border-slate-200 text-xs text-slate-700">
                    <SelectValue placeholder="Pick entry node…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {state.nodes.map((n) => {
                      const Icon = NODE_META[n.node_type].icon;
                      return (
                        <SelectItem key={n.node_key} value={n.node_key}>
                          <span className="inline-flex items-center gap-1.5">
                            <Icon
                              className={cn(
                                "h-3 w-3",
                                NODE_META[n.node_type].color,
                              )}
                            />
                            {n.node_key}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Trigger issues */}
          {triggerIssues.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-red-100 pt-2">
              {triggerIssues.map((issue, idx) => (
                <p
                  key={idx}
                  className={cn(
                    "text-[10px] font-medium",
                    issue.severity === "error"
                      ? "text-red-600"
                      : "text-amber-600",
                  )}
                >
                  ⚠ {issue.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BuilderState["status"] }) {
  const cls = {
    draft: "border-slate-200 bg-slate-100 text-slate-600 font-medium",
    active: "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold",
    archived: "border-slate-200 bg-slate-100/50 text-slate-400 font-medium",
  }[status];
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px] shadow-sm", cls)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
