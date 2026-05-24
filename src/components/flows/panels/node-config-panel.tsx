"use client";

/**
 * Right-side panel that opens when a node is selected on the canvas.
 *
 * Shows the full config form for the selected node — identical
 * functionality to the old expand/collapse cards, but relocated to
 * a fixed sidebar so the canvas stays uncluttered.
 */

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";
import type { ApiRequestNodeConfig, WaitSendMessageNodeConfig } from "@/lib/flows/types";
import { ApiRequestForm } from "@/components/flows/nodes/api-request-form";
import { WaitSendForm } from "@/components/flows/nodes/wait-send-form";
import {
  SendImageForm,
  SendDocumentForm,
  SendLocationForm,
  SendContactsForm,
  SendCtaUrlForm,
  AskLocationForm,
} from "@/components/flows/nodes/media-forms";

import {
  NODE_META,
  slugify,
  type BuilderNode,
} from "../lib/constants";

// ============================================================
// Panel root
// ============================================================

interface NodeConfigPanelProps {
  /** The selected node's data, or null when nothing is selected. */
  node: BuilderNode | null;
  allNodes: BuilderNode[];
  isEntry: boolean;
  issues: ValidationIssue[];
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onUpdateKey: (oldKey: string, newKey: string) => void;
  onRemove: () => void;
  onSetEntry: () => void;
  onClose: () => void;
}

export function NodeConfigPanel({
  node,
  allNodes,
  isEntry,
  issues,
  onUpdateConfig,
  onUpdateKey,
  onRemove,
  onSetEntry,
  onClose,
}: NodeConfigPanelProps) {
  if (!node) return null;

  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white shadow-lg z-20">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 bg-slate-50/50">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 shadow-sm",
            meta.bgAccent,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", meta.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">
            {meta.label}
          </p>
          <code className="text-[10px] text-slate-400 font-mono">
            {node.node_key}
          </code>
        </div>
        {isEntry && (
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700"
          >
            Entry
          </Badge>
        )}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body (scrollable) */}
      <ScrollArea className="flex-1 bg-white">
        <div className="flex flex-col gap-3 p-3">
          <NodeConfigForm
            node={node}
            allNodes={allNodes}
            onUpdateConfig={onUpdateConfig}
            onUpdateKey={onUpdateKey}
          />

          {/* Node-level issues */}
          {issues.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-red-100 bg-red-50/50 p-2.5">
              {issues.map((issue, idx) => (
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
      </ScrollArea>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 bg-slate-50/50">
        {!isEntry ? (
          <Button variant="ghost" size="sm" onClick={onSetEntry} className="h-7 text-[10px] text-slate-600 hover:bg-slate-100">
            Set as entry
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Remove
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Per-node-type config form
// ============================================================

function NodeConfigForm({
  node,
  allNodes,
  onUpdateConfig,
  onUpdateKey,
}: {
  node: BuilderNode;
  allNodes: BuilderNode[];
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  onUpdateKey: (oldKey: string, newKey: string) => void;
}) {
  const cfg = node.config;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* ---- Start ---- */}
      {node.node_type === "start" && (
        <NextNodeRow
          value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
          allNodes={allNodes}
          currentKey={node.node_key}
          onChange={(v) => onUpdateConfig({ next_node_key: v })}
          label="Advances to"
        />
      )}

      {/* ---- Send message ---- */}
      {node.node_type === "send_message" && (
        <>
          <TextRow
            label="Text sent to the customer"
            value={(cfg as { text?: string }).text ?? ""}
            onChange={(v) => onUpdateConfig({ text: v })}
          />
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label="Advances to"
          />
        </>
      )}

      {/* ---- Send buttons ---- */}
      {node.node_type === "send_buttons" && (
        <SendButtonsForm
          cfg={cfg as SendButtonsCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
        />
      )}

      {/* ---- Send list ---- */}
      {node.node_type === "send_list" && (
        <SendListForm
          cfg={cfg as SendListCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
        />
      )}

      {/* ---- Collect input ---- */}
      {node.node_type === "collect_input" && (
        <>
          <TextRow
            label="Prompt sent to the customer"
            value={(cfg as { prompt_text?: string }).prompt_text ?? ""}
            onChange={(v) => onUpdateConfig({ prompt_text: v })}
            rows={2}
          />
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">
              Variable key
            </label>
            <Input
              value={(cfg as { var_key?: string }).var_key ?? ""}
              onChange={(e) =>
                onUpdateConfig({
                  var_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                })
              }
              placeholder="e.g. name, email"
              className="h-7 bg-muted font-mono text-[10px]"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">
              Use{" "}
              <code className="rounded bg-muted px-1">
                {"{{vars."}
                {(cfg as { var_key?: string }).var_key || "name"}
                {"}}"}
              </code>{" "}
              downstream.
            </p>
          </div>
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label="After capturing, advance to"
          />
        </>
      )}

      {/* ---- Condition ---- */}
      {node.node_type === "condition" && (
        <ConditionForm
          cfg={cfg as ConditionCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      )}

      {/* ---- Set tag ---- */}
      {node.node_type === "set_tag" && (
        <SetTagForm
          cfg={cfg as SetTagCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      )}

      {/* ---- Handoff ---- */}
      {node.node_type === "handoff" && (
        <TextRow
          label="Internal note (for the agent picking up)"
          value={(cfg as { note?: string }).note ?? ""}
          onChange={(v) => onUpdateConfig({ note: v })}
          rows={2}
        />
      )}

      {/* ---- End ---- */}
      {node.node_type === "end" && (
        <p className="text-[10px] text-muted-foreground">
          Terminal node. The run is marked complete. No config needed.
        </p>
      )}

      {/* ---- Chatbot reply ---- */}
      {node.node_type === "send_chatbot_reply" && (
        <ChatbotReplyFlowPicker
          config={cfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      )}

      {/* ---- API Request ---- */}
      {node.node_type === "api_request" && (
        <ApiRequestForm
          config={cfg as unknown as ApiRequestNodeConfig}
          allNodeKeys={allNodes
            .filter((n) => n.node_key !== node.node_key)
            .map((n) => ({ key: n.node_key, label: `${n.node_type}: ${n.node_key}` }))}
          onChange={(patch) => onUpdateConfig(patch as Record<string, unknown>)}
        />
      )}

      {/* ---- Wait & Send ---- */}
      {node.node_type === "wait_send_message" && (
        <WaitSendForm
          config={cfg as unknown as WaitSendMessageNodeConfig}
          allNodeKeys={allNodes
            .filter((n) => n.node_key !== node.node_key)
            .map((n) => ({ key: n.node_key, label: `${n.node_type}: ${n.node_key}` }))}
          onChange={(patch) => onUpdateConfig(patch as Record<string, unknown>)}
        />
      )}

      {/* ---- Send Image ---- */}
      {node.node_type === "send_image" && (
        <SendImageForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* ---- Send Document ---- */}
      {node.node_type === "send_document" && (
        <SendDocumentForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* ---- Send Location ---- */}
      {node.node_type === "send_location" && (
        <SendLocationForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* ---- Send Contacts ---- */}
      {node.node_type === "send_contacts" && (
        <SendContactsForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* ---- CTA URL ---- */}
      {node.node_type === "send_cta_url" && (
        <SendCtaUrlForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* ---- Ask Location ---- */}
      {node.node_type === "ask_location" && (
        <AskLocationForm config={cfg} onChange={onUpdateConfig} />
      )}

      {/* Advanced: node_key editor */}
      <div className="border-t border-border/30 pt-2">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? (
            <ChevronUp className="h-2.5 w-2.5" />
          ) : (
            <ChevronDown className="h-2.5 w-2.5" />
          )}
          {showAdvanced ? "Hide" : "Show"} advanced
        </button>
        {showAdvanced && (
          <div className="mt-2">
            <label className="mb-1 block text-[10px] text-muted-foreground">
              Node key (internal identifier)
            </label>
            <Input
              value={node.node_key}
              onChange={(e) => onUpdateKey(node.node_key, e.target.value)}
              className="h-7 bg-muted font-mono text-[10px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub-forms (same logic as the original monolith)
// ============================================================

// ---- Send buttons ----

interface SendButtonsCfg {
  text?: string;
  footer_text?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key: string }>;
}

function SendButtonsForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
}: {
  cfg: SendButtonsCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
}) {
  const buttons = cfg.buttons ?? [];
  const updateButton = (
    idx: number,
    patch: Partial<NonNullable<SendButtonsCfg["buttons"]>[number]>,
  ) => {
    onUpdateConfig({
      buttons: buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };
  const addButton = () =>
    onUpdateConfig({
      buttons: [
        ...buttons,
        {
          reply_id: `btn_${buttons.length + 1}`,
          title: "Option",
          next_node_key: "",
        },
      ],
    });
  const removeButton = (idx: number) =>
    onUpdateConfig({ buttons: buttons.filter((_, i) => i !== idx) });

  return (
    <>
      <TextRow
        label="Body text"
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <TextRow
        label="Footer (optional, 60 chars)"
        value={cfg.footer_text ?? ""}
        onChange={(v) => onUpdateConfig({ footer_text: v })}
      />
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Buttons (1–3)
        </label>
        <div className="flex flex-col gap-2">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-border/40 bg-muted/30 p-2"
            >
              {showAdvanced && (
                <Input
                  value={b.reply_id}
                  onChange={(e) =>
                    updateButton(i, {
                      reply_id: slugify(e.target.value, `btn_${i + 1}`),
                    })
                  }
                  placeholder="reply_id"
                  className="h-6 bg-muted font-mono text-[9px]"
                />
              )}
              <Input
                value={b.title}
                onChange={(e) => updateButton(i, { title: e.target.value })}
                placeholder="Visible title (≤20 chars)"
                className="h-7 bg-muted text-xs"
                maxLength={20}
              />
              <div className="flex items-center gap-1">
                <NodeKeySelect
                  value={b.next_node_key || null}
                  nodes={allNodes}
                  excludeKey={currentKey}
                  onChange={(v) => updateButton(i, { next_node_key: v ?? "" })}
                  placeholder="Next node…"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeButton(i)}
                  className="h-6 w-6 shrink-0 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {buttons.length < 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addButton}
            className="mt-1.5 h-6 text-[10px]"
          >
            <Plus className="h-3 w-3" />
            Add button
          </Button>
        )}
      </div>
    </>
  );
}

// ---- Send list ----

interface SendListCfg {
  text?: string;
  button_label?: string;
  footer_text?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{
      reply_id: string;
      title: string;
      description?: string;
      next_node_key: string;
    }>;
  }>;
}

function SendListForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
}: {
  cfg: SendListCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
}) {
  const sections = cfg.sections ?? [];
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  const updateSection = (
    sIdx: number,
    patch: Partial<NonNullable<SendListCfg["sections"]>[number]>,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, ...patch } : s,
      ),
    });
  };
  const addSection = () =>
    onUpdateConfig({
      sections: [
        ...sections,
        {
          title: "",
          rows: [
            {
              reply_id: `row_${totalRows + 1}`,
              title: `Option ${totalRows + 1}`,
              next_node_key: "",
            },
          ],
        },
      ],
    });
  const removeSection = (sIdx: number) =>
    onUpdateConfig({ sections: sections.filter((_, i) => i !== sIdx) });
  const updateRow = (
    sIdx: number,
    rIdx: number,
    patch: Partial<
      NonNullable<SendListCfg["sections"]>[number]["rows"][number]
    >,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: s.rows.map((r, j) =>
                j === rIdx ? { ...r, ...patch } : r,
              ),
            }
          : s,
      ),
    });
  };
  const addRow = (sIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: [
                ...s.rows,
                {
                  reply_id: `row_${totalRows + 1}`,
                  title: `Option ${totalRows + 1}`,
                  next_node_key: "",
                },
              ],
            }
          : s,
      ),
    });
  const removeRow = (sIdx: number, rIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? { ...s, rows: s.rows.filter((_, j) => j !== rIdx) }
          : s,
      ),
    });

  return (
    <>
      <TextRow
        label="Body text"
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <TextRow
        label="Button label (≤20 chars)"
        value={cfg.button_label ?? ""}
        onChange={(v) => onUpdateConfig({ button_label: v })}
      />
      <TextRow
        label="Footer (optional)"
        value={cfg.footer_text ?? ""}
        onChange={(v) => onUpdateConfig({ footer_text: v })}
      />
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Sections & rows (1–10 total)
        </label>
        {sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="mb-2 rounded-md border border-border/40 bg-muted/30 p-2"
          >
            <div className="mb-1.5 flex items-center gap-1">
              <Input
                value={section.title ?? ""}
                onChange={(e) =>
                  updateSection(sIdx, { title: e.target.value })
                }
                placeholder={`Section ${sIdx + 1} title`}
                className="h-6 bg-muted text-[10px]"
              />
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSection(sIdx)}
                  className="h-6 w-6 shrink-0 p-0 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              )}
            </div>
            {section.rows.map((row, rIdx) => (
              <div
                key={rIdx}
                className="mb-1 flex flex-col gap-1 rounded bg-muted/20 p-1.5"
              >
                {showAdvanced && (
                  <Input
                    value={row.reply_id}
                    onChange={(e) =>
                      updateRow(sIdx, rIdx, {
                        reply_id: slugify(e.target.value, `row_${rIdx + 1}`),
                      })
                    }
                    placeholder="reply_id"
                    className="h-5 bg-muted font-mono text-[8px]"
                  />
                )}
                <Input
                  value={row.title}
                  onChange={(e) =>
                    updateRow(sIdx, rIdx, { title: e.target.value })
                  }
                  placeholder="Row title (≤24)"
                  className="h-6 bg-muted text-[10px]"
                  maxLength={24}
                />
                <div className="flex items-center gap-1">
                  <NodeKeySelect
                    value={row.next_node_key || null}
                    nodes={allNodes}
                    excludeKey={currentKey}
                    onChange={(v) =>
                      updateRow(sIdx, rIdx, { next_node_key: v ?? "" })
                    }
                    placeholder="Next node…"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(sIdx, rIdx)}
                    className="h-5 w-5 shrink-0 p-0 text-red-400"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            ))}
            {totalRows < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addRow(sIdx)}
                className="mt-0.5 h-5 text-[9px]"
              >
                <Plus className="h-2.5 w-2.5" />
                Add row
              </Button>
            )}
          </div>
        ))}
        {sections.length < 10 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addSection}
            className="h-6 text-[10px]"
          >
            <Plus className="h-2.5 w-2.5" />
            Add section
          </Button>
        )}
      </div>
    </>
  );
}

// ---- Condition ----

interface ConditionCfg {
  subject?: "var" | "tag" | "contact_field";
  subject_key?: string;
  operator?: "equals" | "contains" | "present" | "absent";
  value?: string;
  true_next?: string;
  false_next?: string;
}

interface UserTag {
  id: string;
  name: string;
  color?: string;
}

function ConditionForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  cfg: ConditionCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const [tags, setTags] = useState<UserTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tags").catch(() => null);
        if (!res || !res.ok) return;
        const json = (await res.json()) as { tags?: UserTag[] };
        if (!cancelled) setTags(json.tags ?? []);
      } catch {
        /* tags endpoint absent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subject = cfg.subject ?? "var";
  const operator = cfg.operator ?? "equals";
  const showValue = operator === "equals" || operator === "contains";

  return (
    <>
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          If
        </label>
        <Select
          value={subject}
          onValueChange={(v) =>
            onUpdateConfig({ subject: v as ConditionCfg["subject"] })
          }
        >
          <SelectTrigger className="h-7 bg-muted text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="var">Captured variable</SelectItem>
            <SelectItem value="tag">Contact has tag</SelectItem>
            <SelectItem value="contact_field">Contact field</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          {subject === "var"
            ? "Variable name"
            : subject === "tag"
              ? "Tag"
              : "Field"}
        </label>
        {subject === "tag" && tags.length > 0 ? (
          <Select
            value={cfg.subject_key ?? ""}
            onValueChange={(v) => onUpdateConfig({ subject_key: v })}
          >
            <SelectTrigger className="h-7 bg-muted text-xs">
              <SelectValue placeholder="Pick a tag…" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : subject === "contact_field" ? (
          <Select
            value={cfg.subject_key ?? ""}
            onValueChange={(v) => onUpdateConfig({ subject_key: v })}
          >
            <SelectTrigger className="h-7 bg-muted text-xs">
              <SelectValue placeholder="Pick a field…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">name</SelectItem>
              <SelectItem value="email">email</SelectItem>
              <SelectItem value="phone">phone</SelectItem>
              <SelectItem value="company">company</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={cfg.subject_key ?? ""}
            onChange={(e) => onUpdateConfig({ subject_key: e.target.value })}
            placeholder="e.g. email"
            className="h-7 bg-muted font-mono text-[10px]"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Operator
        </label>
        <Select
          value={operator}
          onValueChange={(v) =>
            onUpdateConfig({ operator: v as ConditionCfg["operator"] })
          }
        >
          <SelectTrigger className="h-7 bg-muted text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="present">is present</SelectItem>
            <SelectItem value="absent">is absent</SelectItem>
            <SelectItem value="equals">equals</SelectItem>
            <SelectItem value="contains">contains</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showValue && (
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">
            Value
          </label>
          <Input
            value={cfg.value ?? ""}
            onChange={(e) => onUpdateConfig({ value: e.target.value })}
            className="h-7 bg-muted text-xs"
          />
        </div>
      )}

      <NextNodeRow
        value={cfg.true_next ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ true_next: v })}
        label="If true → advance to"
      />
      <NextNodeRow
        value={cfg.false_next ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ false_next: v })}
        label="If false → advance to"
      />
    </>
  );
}

// ---- Set tag ----

interface SetTagCfg {
  mode?: "add" | "remove";
  tag_id?: string;
  next_node_key?: string;
}

function SetTagForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  cfg: SetTagCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const [tags, setTags] = useState<UserTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tags").catch(() => null);
        if (!res || !res.ok) return;
        const json = (await res.json()) as { tags?: UserTag[] };
        if (!cancelled) setTags(json.tags ?? []);
      } catch {
        /* no tags endpoint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Action
        </label>
        <Select
          value={cfg.mode ?? "add"}
          onValueChange={(v) =>
            onUpdateConfig({ mode: v as SetTagCfg["mode"] })
          }
        >
          <SelectTrigger className="h-7 bg-muted text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="add">Add tag</SelectItem>
            <SelectItem value="remove">Remove tag</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Tag
        </label>
        {tags.length > 0 ? (
          <Select
            value={cfg.tag_id ?? ""}
            onValueChange={(v) => onUpdateConfig({ tag_id: v })}
          >
            <SelectTrigger className="h-7 bg-muted text-xs">
              <SelectValue placeholder="Pick a tag…" />
            </SelectTrigger>
            <SelectContent>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={cfg.tag_id ?? ""}
            onChange={(e) => onUpdateConfig({ tag_id: e.target.value })}
            placeholder="Tag UUID"
            className="h-7 bg-muted font-mono text-[10px]"
          />
        )}
      </div>
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label="Then advance to"
      />
    </>
  );
}

// ---- Chatbot reply picker ----

function ChatbotReplyFlowPicker({
  config,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  config: Record<string, unknown>;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const [replies, setReplies] = useState<
    Array<{
      id: string;
      name: string;
      reply_type: string;
      buttons?: Array<{ id: string; text: string }>;
      list_sections?: Array<{ rows: Array<{ id: string; title: string }> }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chatbot")
      .then((r) => r.json())
      .then((d) => setReplies(d.replies || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedId = (config.chatbot_reply_id as string) || "";
  const selected = replies.find((r) => r.id === selectedId);

  function handleSelect(id: string) {
    const reply = replies.find((r) => r.id === id);
    if (!reply) {
      onUpdateConfig({
        chatbot_reply_id: id,
        next_node_key: "",
        button_routes: [],
        row_routes: [],
      });
      return;
    }

    if (reply.reply_type === "interactive_buttons" && reply.buttons?.length) {
      onUpdateConfig({
        chatbot_reply_id: id,
        button_routes: reply.buttons.map((b) => ({
          button_id: b.id,
          button_text: b.text,
          next_node_key: "",
        })),
        row_routes: [],
        next_node_key: undefined,
      });
    } else if (
      reply.reply_type === "interactive_list" &&
      reply.list_sections?.length
    ) {
      const allRows = reply.list_sections.flatMap((s) => s.rows || []);
      onUpdateConfig({
        chatbot_reply_id: id,
        row_routes: allRows.map((r) => ({
          row_id: r.id,
          row_title: r.title,
          next_node_key: "",
        })),
        button_routes: [],
        next_node_key: undefined,
      });
    } else {
      onUpdateConfig({
        chatbot_reply_id: id,
        next_node_key: "",
        button_routes: [],
        row_routes: [],
      });
    }
  }

  if (loading)
    return (
      <p className="text-[10px] text-muted-foreground">Loading bot replies…</p>
    );

  if (replies.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">
          No bot replies found.
        </p>
        <a
          href="/chatbot/new"
          className="text-[10px] text-primary hover:underline"
        >
          + Create Bot Reply
        </a>
      </div>
    );
  }

  const otherNodes = allNodes.filter((n) => n.node_key !== currentKey);
  const buttonRoutes = (config.button_routes as Array<{
    button_id: string;
    button_text: string;
    next_node_key: string;
  }>) || [];
  const rowRoutes = (config.row_routes as Array<{
    row_id: string;
    row_title: string;
    next_node_key: string;
  }>) || [];

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Select Bot Reply
        </label>
        <select
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground"
        >
          <option value="">— Select —</option>
          {replies.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.reply_type.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </div>

      {selected &&
        (selected.reply_type === "text" ||
          selected.reply_type === "cta_url") && (
          <NextNodeRow
            label="Next node after reply"
            value={(config.next_node_key as string) || ""}
            allNodes={allNodes}
            currentKey={currentKey}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
          />
        )}

      {buttonRoutes.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[9px] font-medium text-muted-foreground">
            Button → Next Node
          </p>
          {buttonRoutes.map((br, i) => (
            <div key={br.button_id} className="flex items-center gap-1.5">
              <span className="min-w-[60px] truncate text-[9px] text-foreground">
                {br.button_text || br.button_id}
              </span>
              <span className="text-[9px] text-muted-foreground">→</span>
              <NodeKeySelect
                value={br.next_node_key || null}
                nodes={otherNodes}
                onChange={(v) => {
                  const updated = [...buttonRoutes];
                  updated[i] = { ...br, next_node_key: v ?? "" };
                  onUpdateConfig({ button_routes: updated });
                }}
                placeholder="—"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}

      {rowRoutes.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[9px] font-medium text-muted-foreground">
            List Row → Next Node
          </p>
          {rowRoutes.map((rr, i) => (
            <div key={rr.row_id} className="flex items-center gap-1.5">
              <span className="min-w-[60px] truncate text-[9px] text-foreground">
                {rr.row_title || rr.row_id}
              </span>
              <span className="text-[9px] text-muted-foreground">→</span>
              <NodeKeySelect
                value={rr.next_node_key || null}
                nodes={otherNodes}
                onChange={(v) => {
                  const updated = [...rowRoutes];
                  updated[i] = { ...rr, next_node_key: v ?? "" };
                  onUpdateConfig({ row_routes: updated });
                }}
                placeholder="—"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared field components
// ============================================================

function TextRow({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] text-muted-foreground">
        {label}
      </label>
      {rows > 1 ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="bg-muted text-xs"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 bg-muted text-xs"
        />
      )}
    </div>
  );
}

function NextNodeRow({
  value,
  allNodes,
  currentKey,
  onChange,
  label,
}: {
  value: string;
  allNodes: BuilderNode[];
  currentKey: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] text-muted-foreground">
        {label}
      </label>
      <NodeKeySelect
        value={value || null}
        nodes={allNodes}
        excludeKey={currentKey}
        onChange={(v) => onChange(v ?? "")}
        placeholder="Pick a next node…"
      />
    </div>
  );
}

function NodeKeySelect({
  value,
  nodes,
  excludeKey,
  onChange,
  placeholder,
  className,
}: {
  value: string | null;
  nodes: BuilderNode[];
  excludeKey?: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const options = nodes.filter((n) => n.node_key !== excludeKey);
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className={cn("h-7 bg-muted text-xs", className)}>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— None —</SelectItem>
        {options.map((n) => {
          const Icon = NODE_META[n.node_type].icon;
          return (
            <SelectItem key={n.node_key} value={n.node_key}>
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  className={cn("h-3 w-3", NODE_META[n.node_type].color)}
                />
                {n.node_key}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
