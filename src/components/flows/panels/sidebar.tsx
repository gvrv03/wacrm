"use client";

/**
 * Left sidebar component list.
 *
 * Provides a searchable, categorized drawer of all 10 available node types.
 * Nodes can be dragged onto the canvas or clicked to add them directly.
 */

import { useState, useMemo } from "react";
import { Search, Grid, MessageSquare, Cpu, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_META, type NodeType, type NodeCategory } from "../lib/constants";

interface SidebarProps {
  onAddNode: (type: NodeType) => void;
}

const CATEGORY_TABS: Array<{ id: "all" | NodeCategory; label: string; icon: typeof Grid }> = [
  { id: "all", label: "All", icon: Grid },
  { id: "messaging", label: "Messaging", icon: MessageSquare },
  { id: "logic", label: "Logic", icon: GitBranch },
  { id: "integration", label: "Integration", icon: Cpu },
];

const NODE_TYPES_LIST: NodeType[] = [
  "start",
  "send_message",
  "send_buttons",
  "send_list",
  "send_chatbot_reply",
  "api_request",
  "wait_send_message",
  "collect_input",
  "condition",
  "set_tag",
  "handoff",
  "end",
];

export function Sidebar({ onAddNode }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | NodeCategory>("all");

  const filteredNodes = useMemo(() => {
    return NODE_TYPES_LIST.filter((t) => {
      const meta = NODE_META[t];
      const matchesSearch = meta.label.toLowerCase().includes(search.toLowerCase());
      const matchesTab = activeTab === "all" || meta.category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [search, activeTab]);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white p-4 shadow-sm select-none">
      {/* Title */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Components</h2>
          <p className="text-[10px] text-slate-400">Drag to canvas or click to add</p>
        </div>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
          {NODE_TYPES_LIST.length}
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          className="h-8.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 transition-all hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none"
        />
      </div>

      {/* Categories */}
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-slate-50 p-1 border border-slate-100/60">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center rounded-md py-1.5 transition-all text-slate-500",
                isActive
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                  : "hover:text-slate-700 hover:bg-slate-100/40"
              )}
              title={tab.label}
            >
              <Icon className="h-3.5 w-3.5 mb-0.5" />
              <span className="text-[9px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Draggable components list */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-slate-400">
            No components found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredNodes.map((t) => {
              const meta = NODE_META[t];
              const Icon = meta.icon;
              return (
                <div
                  key={t}
                  draggable
                  onDragStart={(event) => onDragStart(event, t)}
                  onClick={() => onAddNode(t)}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-xl border border-slate-200 p-3 bg-white cursor-pointer select-none transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                    "hover:border-indigo-200"
                  )}
                  style={{
                    borderLeft: `4px solid ${
                      t === "start" ? "#059669" :
                      t === "send_message" ? "#0284c7" :
                      t === "send_buttons" ? "#4f46e5" :
                      t === "send_list" ? "#4f46e5" :
                      t === "collect_input" ? "#0d9488" :
                      t === "condition" ? "#c026d3" :
                      t === "set_tag" ? "#db2777" :
                      t === "handoff" ? "#d97706" :
                      t === "end" ? "#64748b" :
                      "#0891b2" // bot reply (cyan)
                    }`
                  }}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2 shadow-sm border border-slate-100", meta.bgAccent)}>
                    <Icon className={cn("h-4 w-4", meta.color)} />
                  </div>
                  <span className="text-center text-[10px] font-bold text-slate-700 leading-tight">
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-4 border-t border-slate-100 pt-3 text-center">
        <p className="text-[10px] text-slate-400 font-medium leading-normal">
          Drag cards to the canvas or click to add directly to builder.
        </p>
      </div>
    </div>
  );
}
