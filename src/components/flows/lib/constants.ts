/**
 * Shared constants for the flow builder.
 *
 * Extracted from the original monolithic flow-builder.tsx so that
 * canvas nodes, panels, and hooks can all share the same metadata
 * without circular imports.
 */

import {
  Workflow,
  MessageCircle,
  ListChecks,
  ListPlus,
  Inbox,
  GitFork,
  Tag,
  UserPlus,
  Flag,
  PlayCircle,
  Globe,
  Clock,
} from "lucide-react";

// ============================================================
// Node type + builder-node shape
// ============================================================

export type NodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "send_chatbot_reply"
  | "api_request"
  | "wait_send_message"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface BuilderNode {
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown>;
}

export interface BuilderState {
  name: string;
  description: string;
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: Record<string, unknown>;
  entry_node_id: string | null;
  status: "draft" | "active" | "archived";
  nodes: BuilderNode[];
}

// ============================================================
// Per-node-type metadata (icons, labels, colors)
// ============================================================

export type NodeCategory = "messaging" | "logic" | "integration";

export const NODE_META: Record<
  NodeType,
  { label: string; icon: typeof Workflow; color: string; bgAccent: string; category: NodeCategory }
> = {
  start: {
    label: "Start",
    icon: PlayCircle,
    color: "text-emerald-600",
    bgAccent: "bg-emerald-50",
    category: "logic",
  },
  send_message: {
    label: "Send message",
    icon: MessageCircle,
    color: "text-sky-600",
    bgAccent: "bg-sky-50",
    category: "messaging",
  },
  send_buttons: {
    label: "Send buttons",
    icon: ListChecks,
    color: "text-indigo-600",
    bgAccent: "bg-indigo-50",
    category: "messaging",
  },
  send_list: {
    label: "Send list",
    icon: ListPlus,
    color: "text-indigo-600",
    bgAccent: "bg-indigo-50",
    category: "messaging",
  },
  collect_input: {
    label: "Collect input",
    icon: Inbox,
    color: "text-teal-600",
    bgAccent: "bg-teal-50",
    category: "integration",
  },
  condition: {
    label: "If / else",
    icon: GitFork,
    color: "text-fuchsia-600",
    bgAccent: "bg-fuchsia-50",
    category: "logic",
  },
  set_tag: {
    label: "Tag contact",
    icon: Tag,
    color: "text-pink-600",
    bgAccent: "bg-pink-50",
    category: "integration",
  },
  handoff: {
    label: "Handoff to agent",
    icon: UserPlus,
    color: "text-amber-600",
    bgAccent: "bg-amber-50",
    category: "integration",
  },
  end: {
    label: "End",
    icon: Flag,
    color: "text-slate-500",
    bgAccent: "bg-slate-100",
    category: "logic",
  },
  send_chatbot_reply: {
    label: "Bot Reply",
    icon: MessageCircle,
    color: "text-cyan-600",
    bgAccent: "bg-cyan-50",
    category: "messaging",
  },
  api_request: {
    label: "API Request",
    icon: Globe,
    color: "text-violet-600",
    bgAccent: "bg-violet-50",
    category: "integration",
  },
  wait_send_message: {
    label: "Wait & Send",
    icon: Clock,
    color: "text-orange-600",
    bgAccent: "bg-orange-50",
    category: "messaging",
  },
};

// ============================================================
// Helpers
// ============================================================

export function slugify(s: string, fallback: string): string {
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

export function uniqueNodeKey(base: string, existing: BuilderNode[]): string {
  if (!existing.some((n) => n.node_key === base)) return base;
  let i = 2;
  while (existing.some((n) => n.node_key === `${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function truncate(s: string, max = 80): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1) + "…";
}

export function defaultConfigFor(type: NodeType): Record<string, unknown> {
  switch (type) {
    case "start":
      return { next_node_key: "" };
    case "send_message":
      return { text: "", next_node_key: "" };
    case "send_buttons":
      return {
        text: "",
        buttons: [{ reply_id: "yes", title: "Yes", next_node_key: "" }],
      };
    case "send_list":
      return {
        text: "",
        button_label: "View options",
        sections: [
          {
            title: "",
            rows: [
              { reply_id: "row_1", title: "Option 1", next_node_key: "" },
            ],
          },
        ],
      };
    case "collect_input":
      return {
        prompt_text: "",
        var_key: "answer",
        next_node_key: "",
      };
    case "condition":
      return {
        subject: "var",
        subject_key: "",
        operator: "equals",
        value: "",
        true_next: "",
        false_next: "",
      };
    case "set_tag":
      return { mode: "add", tag_id: "", next_node_key: "" };
    case "handoff":
      return { note: "" };
    case "end":
      return {};
    case "send_chatbot_reply":
      return {
        chatbot_reply_id: "",
        next_node_key: "",
        button_routes: [],
        row_routes: [],
      };
    case "api_request":
      return {
        method: "GET",
        url: "",
        headers: {},
        body: "",
        response_var_key: "api_response",
        success_next: "",
        failure_next: "",
      };
    case "wait_send_message":
      return {
        delay_amount: 1,
        delay_unit: "hours",
        timing_mode: "fixed",
        message_type: "text",
        message_content: { text: "" },
        next_node_key: "",
      };
  }
}

/**
 * Short, single-line content summary for a node — used in compact
 * canvas cards and the config panel header.
 */
export function summarizeNode(node: BuilderNode): string | null {
  const cfg = node.config;
  switch (node.node_type) {
    case "start":
    case "end":
      return null;
    case "send_message": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      return text.length > 0 ? truncate(text) : null;
    }
    case "send_buttons": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      const buttons = Array.isArray(cfg.buttons)
        ? (cfg.buttons as Array<Record<string, unknown>>)
        : [];
      const titles = buttons
        .map((b) => (typeof b.title === "string" ? b.title : ""))
        .filter(Boolean)
        .join(" / ");
      if (text.length > 0) {
        return titles
          ? `${truncate(text, 40)} · ${truncate(titles, 35)}`
          : truncate(text);
      }
      return titles || null;
    }
    case "send_list": {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      const sections = Array.isArray(cfg.sections)
        ? (cfg.sections as Array<Record<string, unknown>>)
        : [];
      const rowCount = sections.reduce<number>((sum, s) => {
        const rows = Array.isArray(s.rows) ? s.rows : [];
        return sum + rows.length;
      }, 0);
      if (text.length > 0) {
        return rowCount > 0
          ? `${truncate(text, 50)} · ${rowCount} option${rowCount === 1 ? "" : "s"}`
          : truncate(text);
      }
      return rowCount > 0
        ? `${rowCount} option${rowCount === 1 ? "" : "s"} across ${sections.length} section${sections.length === 1 ? "" : "s"}`
        : null;
    }
    case "collect_input": {
      const prompt =
        typeof cfg.prompt_text === "string" ? cfg.prompt_text : "";
      const varKey = typeof cfg.var_key === "string" ? cfg.var_key : "";
      if (prompt.length > 0) {
        return varKey
          ? `${truncate(prompt, 50)} → vars.${varKey}`
          : truncate(prompt);
      }
      return varKey ? `→ vars.${varKey}` : null;
    }
    case "condition": {
      const subjectKey =
        typeof cfg.subject_key === "string" ? cfg.subject_key : "";
      if (!subjectKey) return null;
      const subject =
        cfg.subject === "tag"
          ? "tag"
          : cfg.subject === "contact_field"
            ? "field"
            : "var";
      const subjectStr =
        subject === "tag"
          ? `has tag ${truncate(subjectKey, 24)}`
          : `${subject}.${subjectKey}`;
      const op =
        cfg.operator === "equals"
          ? "=="
          : cfg.operator === "contains"
            ? "contains"
            : cfg.operator === "present"
              ? "exists"
              : cfg.operator === "absent"
                ? "missing"
                : "";
      const value = typeof cfg.value === "string" ? cfg.value : "";
      const valStr =
        (cfg.operator === "equals" || cfg.operator === "contains") && value
          ? ` "${truncate(value, 20)}"`
          : "";
      return subject === "tag" ? subjectStr : `${subjectStr} ${op}${valStr}`;
    }
    case "set_tag": {
      const mode = cfg.mode === "remove" ? "Remove" : "Add";
      const tagId = typeof cfg.tag_id === "string" ? cfg.tag_id : "";
      return tagId
        ? `${mode} tag ${tagId.slice(0, 8)}…`
        : `${mode} tag (none picked)`;
    }
    case "handoff": {
      const note = typeof cfg.note === "string" ? cfg.note : "";
      return note.length > 0 ? truncate(note) : null;
    }
    case "send_chatbot_reply": {
      const replyId =
        typeof cfg.chatbot_reply_id === "string" ? cfg.chatbot_reply_id : "";
      return replyId ? `Bot reply ${replyId.slice(0, 8)}…` : "Select a bot reply";
    }
    case "api_request": {
      const method = typeof cfg.method === "string" ? cfg.method : "GET";
      const url = typeof cfg.url === "string" ? cfg.url : "";
      return url ? `${method} ${truncate(url, 50)}` : `${method} (no URL)`;
    }
    case "wait_send_message": {
      const amt = typeof cfg.delay_amount === "number" ? cfg.delay_amount : 1;
      const unit = typeof cfg.delay_unit === "string" ? cfg.delay_unit : "hours";
      const type = typeof cfg.message_type === "string" ? cfg.message_type : "text";
      return `Wait ${amt} ${unit}, send ${type}`;
    }
  }
}
