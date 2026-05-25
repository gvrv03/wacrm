/**
 * Flow runner.
 *
 * The single entry point `dispatchInboundToFlows` is called by the
 * WhatsApp webhook on every inbound message *for an account that has
 * opted into the Flows beta*. It decides whether the message belongs
 * to an active conversation flow (advance it) or matches the entry
 * trigger of an active flow (start a new run) — and reports back to
 * the webhook so the webhook knows whether to also fire automations.
 *
 * Architecture in a sentence: the runner walks the customer through
 * a DB-stored node graph, suspending only at nodes that need
 * customer input. Each tap or text reply wakes it back up.
 *
 * What lives here vs elsewhere:
 *   - Pure decision logic (which button matched, where to advance to,
 *     when to fallback) — here.
 *   - DB shape (table reads/writes) — here.
 *   - Meta API calls — `meta-send.ts` (engineSendInteractive*).
 *   - Policy resolution (reprompt vs handoff vs end) — `fallback.ts`.
 *   - Type definitions — `types.ts`.
 *
 * Concurrency model:
 *   - Idempotency on `meta_message_id`: the runner refuses to advance
 *     an active run twice for the same Meta message — protects against
 *     Meta's retries.
 *   - Optimistic UPDATE with `current_node_key` precondition: two
 *     simultaneous taps for the same run collide at the DB layer; the
 *     second is a no-op.
 *   - Partial unique index `idx_one_active_run_per_contact`: two
 *     simultaneous starts for the same contact collide; the second
 *     INSERT raises 23505 and the runner catches & exits.
 */

import { supabaseAdmin } from "./admin-client";
import {
  engineSendInteractiveButtons,
  engineSendInteractiveList,
  engineSendText,
} from "./meta-send";
import { decrypt } from "@/lib/whatsapp/encryption";
import {
  isRecipientNotAllowedError,
  isValidE164,
  phoneVariants,
  sanitizePhoneForMeta,
} from "@/lib/whatsapp/phone-utils";
import { decideFallback, resolveFallbackPolicy } from "./fallback";
import {
  type CollectInputNodeConfig,
  type ConditionNodeConfig,
  type DispatchInboundInput,
  type DispatchInboundResult,
  type FlowNodeRow,
  type FlowRow,
  type FlowRunRow,
  type ParsedInbound,
  type SendButtonsNodeConfig,
  type SendListNodeConfig,
  type SendMessageNodeConfig,
  type SetTagNodeConfig,
  type StartNodeConfig,
  type KeywordTriggerConfig,
} from "./types";

// ============================================================
// Pure helpers — extracted so engine.test.ts can exercise them
// without a Supabase / Meta mock.
// ============================================================

/**
 * Given a node + the customer's reply_id, return the next_node_key
 * to advance to, or `null` if no option matches.
 */
export function matchReplyId(
  node: { node_type: string; config: Record<string, unknown> },
  reply_id: string,
): string | null {
  if (node.node_type === "send_buttons") {
    const cfg = node.config as unknown as SendButtonsNodeConfig;
    const hit = cfg.buttons?.find((b) => b.reply_id === reply_id);
    return hit?.next_node_key ?? null;
  }
  if (node.node_type === "send_list") {
    const cfg = node.config as unknown as SendListNodeConfig;
    for (const section of cfg.sections ?? []) {
      const hit = section.rows?.find((r) => r.reply_id === reply_id);
      if (hit) return hit.next_node_key;
    }
    return null;
  }
  if (node.node_type === "send_chatbot_reply") {
    const btnRoutes = (node.config.button_routes ?? []) as Array<{
      button_id: string;
      next_node_key: string;
    }>;
    const hitBtn = btnRoutes.find((br) => br.button_id === reply_id);
    if (hitBtn) return hitBtn.next_node_key;

    const rowRoutes = (node.config.row_routes ?? []) as Array<{
      row_id: string;
      next_node_key: string;
    }>;
    const hitRow = rowRoutes.find((rr) => rr.row_id === reply_id);
    if (hitRow) return hitRow.next_node_key;

    return null;
  }
  return null;
}

/**
 * Case-insensitive contains/exact match against a list of keywords.
 * Used by the trigger evaluator. Stable enough that the v3 builder
 * UI can preview matches by passing canned strings.
 */
export function matchesKeywordTrigger(
  text: string,
  cfg: KeywordTriggerConfig,
): boolean {
  if (!text || !cfg.keywords?.length) return false;
  const matchType = cfg.match_type ?? "contains";
  const haystack = cfg.case_sensitive ? text : text.toLowerCase();
  for (const raw of cfg.keywords) {
    if (!raw) continue;
    const needle = cfg.case_sensitive ? raw : raw.toLowerCase();
    if (matchType === "exact" ? haystack === needle : haystack.includes(needle)) {
      return true;
    }
  }
  return false;
}

/** Nodes that advance to a next_node_key without waiting for input. */
export function isAutoAdvancing(node_type: string): boolean {
  return (
    node_type === "start" ||
    node_type === "send_message" ||
    node_type === "condition" ||
    node_type === "set_tag"
  );
}

/** Nodes that send a prompt and suspend awaiting a customer reply. */
export function isSuspending(node_type: string): boolean {
  return (
    node_type === "send_buttons" ||
    node_type === "send_list" ||
    node_type === "collect_input"
  );
}

/** Nodes that end the run. */
export function isTerminal(node_type: string): boolean {
  return node_type === "handoff" || node_type === "end";
}

/**
 * Evaluate a `condition` node's predicate against the current run
 * state. Exported pure for unit testing — the engine wraps it with a
 * DB lookup for `tag` / `contact_field` subjects.
 */
export function evaluateConditionPredicate(args: {
  operator: ConditionNodeConfig["operator"];
  /**
   * Resolved value of the subject. `undefined` means the subject is
   * absent (no var with that key / no such tag / contact field is
   * null). Pure function: caller does the DB lookup.
   */
  subjectValue: string | undefined;
  /** The configured comparison value, when applicable. */
  configValue: string | undefined;
}): boolean {
  switch (args.operator) {
    case "present":
      return args.subjectValue !== undefined && args.subjectValue !== "";
    case "absent":
      return args.subjectValue === undefined || args.subjectValue === "";
    case "equals":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue === (args.configValue ?? "");
    case "contains":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue.includes(args.configValue ?? "");
  }
}

// ============================================================
// DB I/O — wrapped in tiny helpers so the dispatch flow stays
// readable. Errors surface as thrown — the entry point catches.
// ============================================================

type AdminClient = ReturnType<typeof supabaseAdmin>;

async function loadActiveRunForContact(
  db: AdminClient,
  userId: string,
  contactId: string,
): Promise<FlowRunRow | null> {
  // The partial unique index `idx_one_active_run_per_contact` makes
  // "two active runs for one contact" impossible by design. But a
  // future migration glitch or manual SQL could create one, and
  // .maybeSingle() throws on >1 row — which would kill dispatch for
  // that contact's webhook entirely. .limit(1) is forgiving: pick the
  // newest, let the cron sweep clean up the stale one.
  const { data, error } = await db
    .from("flow_runs")
    .select("*")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[flows] loadActiveRunForContact error:", error.message);
    return null;
  }
  const rows = (data as FlowRunRow[] | null) ?? [];
  return rows[0] ?? null;
}

async function loadFlow(
  db: AdminClient,
  flowId: string,
): Promise<FlowRow | null> {
  const { data, error } = await db
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();
  if (error) {
    console.error("[flows] loadFlow error:", error.message);
    return null;
  }
  return (data as FlowRow | null) ?? null;
}

/**
 * Load every node of a flow in one round trip and key them by
 * `node_key`. The advance loop is then in-memory — a 5-node
 * auto-advancing chain costs one SELECT, not five.
 *
 * Returns an empty map on error so the caller can still dispatch
 * cleanly (every subsequent .get() returns undefined → the run
 * fails with node_not_found, same as the old per-node lookup).
 */
async function loadAllNodes(
  db: AdminClient,
  flowId: string,
): Promise<Map<string, FlowNodeRow>> {
  const { data, error } = await db
    .from("flow_nodes")
    .select("*")
    .eq("flow_id", flowId);
  if (error) {
    console.error("[flows] loadAllNodes error:", error.message);
    return new Map();
  }
  const map = new Map<string, FlowNodeRow>();
  for (const row of (data ?? []) as FlowNodeRow[]) {
    map.set(row.node_key, row);
  }
  return map;
}

async function logEvent(
  db: AdminClient,
  flowRunId: string,
  event_type:
    | "started"
    | "node_entered"
    | "message_sent"
    | "reply_received"
    | "fallback_fired"
    | "handoff"
    | "timeout"
    | "error"
    | "completed",
  node_key: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from("flow_run_events").insert({
    flow_run_id: flowRunId,
    event_type,
    node_key,
    payload,
  });
  if (error) {
    // Logging failure is non-fatal — surface but don't throw.
    console.error("[flows] logEvent error:", error.message);
  }
}

/**
 * Idempotency check — has a `reply_received` event with this Meta
 * message_id already been recorded for any of the contact's flow
 * runs? If yes, the inbound is a duplicate (Meta retry) and we
 * exit without re-advancing.
 *
 * Implementation note: scoped to runs belonging to this user/contact
 * so the lookup is cheap (the index on flow_run_events(flow_run_id,
 * event_type) plus the small set of runs per contact).
 */
async function isDuplicateInbound(
  db: AdminClient,
  userId: string,
  contactId: string,
  metaMessageId: string,
): Promise<boolean> {
  // Fetch ALL run ids for this contact (active + historical). Bounded
  // by how many flows the customer has been through — small.
  const { data: runs } = await db
    .from("flow_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_id", contactId);
  if (!runs?.length) return false;
  const runIds = runs.map((r) => (r as { id: string }).id);

  const { count } = await db
    .from("flow_run_events")
    .select("id", { count: "exact", head: true })
    .in("flow_run_id", runIds)
    .eq("event_type", "reply_received")
    .filter("payload->>meta_message_id", "eq", metaMessageId);
  return (count ?? 0) > 0;
}

async function findEntryFlow(
  db: AdminClient,
  userId: string,
  message: ParsedInbound,
  isFirstInbound: boolean,
): Promise<FlowRow | null> {
  // Only text messages can match an entry trigger. Interactive replies
  // are responses to existing prompts; they never start a new flow.
  if (message.kind !== "text") return null;

  // Pull all active flows for this user. Active set is bounded (the
  // builder discourages double-trigger overlap; partial index makes
  // the lookup index-supported).
  const { data: flows, error } = await db
    .from("flows")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !flows) return null;

  const typed = flows as FlowRow[];
  for (const flow of typed) {
    if (flow.trigger_type === "keyword") {
      if (matchesKeywordTrigger(
        message.text,
        flow.trigger_config as KeywordTriggerConfig,
      )) {
        return flow;
      }
    } else if (flow.trigger_type === "first_inbound_message" && isFirstInbound) {
      return flow;
    }
    // 'manual' triggers do not auto-start from inbound messages.
  }
  return null;
}

// ============================================================
// Node executors — each handles ONE node type. send_buttons and
// send_list also persist `last_prompt_message_id` so the inbox
// thread can quote the prompt the customer is replying to.
// ============================================================

async function sendButtonsAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendButtonsNodeConfig;
  const { whatsapp_message_id } = await engineSendInteractiveButtons({
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: cfg.text,
    headerText: cfg.header_text,
    footerText: cfg.footer_text,
    buttons: cfg.buttons.map((b) => ({ id: b.reply_id, title: b.title })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_buttons",
    whatsapp_message_id,
  });
  // Look up our internal message id so we can stash it on the run.
  // Cheap — indexed on `messages.message_id`.
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function sendListAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendListNodeConfig;
  const { whatsapp_message_id } = await engineSendInteractiveList({
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: cfg.text,
    buttonLabel: cfg.button_label,
    headerText: cfg.header_text,
    footerText: cfg.footer_text,
    sections: cfg.sections.map((s) => ({
      title: s.title,
      rows: s.rows.map((r) => ({
        id: r.reply_id,
        title: r.title,
        description: r.description,
      })),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_list",
    whatsapp_message_id,
  });
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function sendChatbotReplyAndAdvance(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as Record<string, unknown>;
  const chatbotReplyId = cfg.chatbot_reply_id as string;

  if (!chatbotReplyId) {
    await logEvent(db, run.id, "error", node.node_key, { reason: "no_chatbot_reply_id" });
    return;
  }

  // Fetch the chatbot reply
  const { data: reply } = await db
    .from("chatbot_replies")
    .select("*")
    .eq("id", chatbotReplyId)
    .maybeSingle();

  if (!reply) {
    await logEvent(db, run.id, "error", node.node_key, { reason: "chatbot_reply_not_found" });
    return;
  }

  // Send based on reply type using existing infrastructure
  if (reply.reply_type === "interactive_buttons" && reply.buttons?.length) {
    const { whatsapp_message_id } = await engineSendInteractiveButtons({
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      bodyText: reply.reply_text,
      headerText: reply.header_type === "text" ? reply.header_content : undefined,
      footerText: reply.footer_text || undefined,
      buttons: (reply.buttons as Array<{ id: string; text: string }>).slice(0, 3).map((b) => ({
        id: b.id,
        title: b.text,
      })),
    });
    await logEvent(db, run.id, "message_sent", node.node_key, {
      node_type: "send_chatbot_reply",
      reply_type: "interactive_buttons",
      whatsapp_message_id,
    });
  } else if (reply.reply_type === "interactive_list" && reply.list_sections?.length) {
    const sections = reply.list_sections as Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
    const { whatsapp_message_id } = await engineSendInteractiveList({
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      bodyText: reply.reply_text,
      buttonLabel: reply.list_button_text || "View Options",
      headerText: reply.header_type === "text" ? reply.header_content : undefined,
      footerText: reply.footer_text || undefined,
      sections: sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({ id: r.id, title: r.title, description: r.description })),
      })),
    });
    await logEvent(db, run.id, "message_sent", node.node_key, {
      node_type: "send_chatbot_reply",
      reply_type: "interactive_list",
      whatsapp_message_id,
    });
  } else {
    // Text or CTA — send as plain text
    const { whatsapp_message_id } = await engineSendText({
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      text: reply.reply_text,
    });
    await logEvent(db, run.id, "message_sent", node.node_key, {
      node_type: "send_chatbot_reply",
      reply_type: reply.reply_type,
      whatsapp_message_id,
    });
  }

  // Store prompt message id for reply routing
  const { data: lastMsg } = await db
    .from("messages")
    .select("id")
    .eq("conversation_id", run.conversation_id!)
    .eq("sender_type", "bot")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMsg) {
    await db.from("flow_runs").update({ last_prompt_message_id: lastMsg.id }).eq("id", run.id);
  }
}

async function executeHandoff(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as { assign_to?: string; note?: string };
  const convUpdate: Record<string, unknown> = {
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (cfg.assign_to) convUpdate.assigned_agent_id = cfg.assign_to;
  if (run.conversation_id) {
    await db
      .from("conversations")
      .update(convUpdate)
      .eq("id", run.conversation_id);
  }
  await logEvent(db, run.id, "handoff", node.node_key, {
    note: cfg.note ?? null,
    assigned_to: cfg.assign_to ?? null,
  });
  await endRun(db, run.id, "handed_off", "handoff_node");
}

/**
 * Resolve a condition node's subject value from DB / run state, then
 * call the pure `evaluateConditionPredicate`. Splits out so the
 * predicate itself stays unit-testable without a Supabase mock.
 *
 * Subject sources:
 *   - `var` → `flow_runs.vars[subject_key]` (captured by collect_input
 *     or http_fetch in v2).
 *   - `tag` → present iff `contact_tags(contact_id, tag_id)` exists.
 *     `subject_key` IS the tag UUID; the SELECT returns 1 row or 0.
 *   - `contact_field` → one of name/email/phone/company on `contacts`.
 */
async function evaluateConditionNode(
  db: AdminClient,
  run: FlowRunRow,
  cfg: ConditionNodeConfig,
): Promise<boolean> {
  let subjectValue: string | undefined;
  if (cfg.subject === "var") {
    const v = run.vars[cfg.subject_key];
    subjectValue = typeof v === "string" ? v : v === undefined ? undefined : String(v);
  } else if (cfg.subject === "tag") {
    const { count } = await db
      .from("contact_tags")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", run.contact_id!)
      .eq("tag_id", cfg.subject_key);
    // For tags, "present" really is the only meaningful test — the
    // `present`/`absent` operators are the natural fit. equals/contains
    // against a tag UUID would still work mechanically (compare its
    // existence to the value).
    subjectValue = (count ?? 0) > 0 ? cfg.subject_key : undefined;
  } else {
    const ALLOWED = ["name", "email", "phone", "company"] as const;
    type AllowedField = (typeof ALLOWED)[number];
    if (!ALLOWED.includes(cfg.subject_key as AllowedField)) {
      throw new Error(`unsupported contact_field: ${cfg.subject_key}`);
    }
    const { data } = await db
      .from("contacts")
      .select(cfg.subject_key)
      .eq("id", run.contact_id!)
      .maybeSingle();
    const raw = (data as Record<string, unknown> | null)?.[cfg.subject_key];
    subjectValue = typeof raw === "string" && raw.length > 0 ? raw : undefined;
  }
  return evaluateConditionPredicate({
    operator: cfg.operator,
    subjectValue,
    configValue: cfg.value,
  });
}

/**
 * Tiny `{{vars.foo}}` interpolation. Used by send_message + collect_input
 * prompt text so a captured `name` can show up in the next prompt
 * ("Thanks {{vars.name}}, what's your email?"). Missing vars render as
 * empty string — the same behavior as the automations engine.
 */
function interpolateVars(template: string, vars: Record<string, unknown>): string {
  if (!template) return "";
  return template.replace(/\{\{vars\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

async function endRun(
  db: AdminClient,
  runId: string,
  status: "completed" | "handed_off" | "timed_out" | "failed",
  reason: string,
): Promise<void> {
  await db
    .from("flow_runs")
    .update({
      status,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", runId);
}

// ============================================================
// The synchronous advance loop. Walks through auto-advance nodes
// until it hits one that suspends (send_buttons/send_list) or
// terminates (handoff/end). Each suspending node persists the
// new current_node_key before returning.
// ============================================================

async function advanceFromNodeKey(
  db: AdminClient,
  run: FlowRunRow,
  startNodeKey: string,
  nodes: Map<string, FlowNodeRow>,
): Promise<{ outcome: "advanced" | "completed" | "handed_off" }> {
  let currentKey: string | null = startNodeKey;
  // Defensive cap — if a flow has a cycle (which the validator
  // SHOULD catch but doesn't yet in v1), we bail rather than loop.
  for (let safety = 0; safety < 64; safety += 1) {
    if (!currentKey) {
      await logEvent(db, run.id, "error", null, {
        reason: "next_node_key was null mid-advance",
      });
      await endRun(db, run.id, "failed", "missing_next_node");
      return { outcome: "completed" };
    }
    const node: FlowNodeRow | null = nodes.get(currentKey) ?? null;
    if (!node) {
      await logEvent(db, run.id, "error", currentKey, {
        reason: "node_not_found",
      });
      await endRun(db, run.id, "failed", "node_not_found");
      return { outcome: "completed" };
    }
    await logEvent(db, run.id, "node_entered", node.node_key, {
      node_type: node.node_type,
    });

    if (node.node_type === "start") {
      currentKey = (node.config as unknown as StartNodeConfig).next_node_key;
      continue;
    }
    if (node.node_type === "send_message") {
      const cfg = node.config as unknown as SendMessageNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendText({
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.text, run.vars),
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_message",
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_text_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_text_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "collect_input") {
      // Send the prompt and suspend. Customer's next TEXT reply will
      // wake us up via handleReplyForActiveRun's collect_input branch.
      const cfg = node.config as unknown as CollectInputNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendText({
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "collect_input",
          whatsapp_message_id,
        });
        const { data: msg } = await db
          .from("messages")
          .select("id")
          .eq("message_id", whatsapp_message_id)
          .maybeSingle();
        await db
          .from("flow_runs")
          .update({
            last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
          })
          .eq("id", run.id);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "collect_input_prompt_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "collect_input_prompt_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "condition") {
      const cfg = node.config as unknown as ConditionNodeConfig;
      let branch: "true" | "false";
      try {
        branch = (await evaluateConditionNode(db, run, cfg))
          ? "true"
          : "false";
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "condition_evaluation_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "condition_evaluation_failed");
        return { outcome: "completed" };
      }
      currentKey =
        branch === "true" ? cfg.true_next : cfg.false_next;
      await logEvent(db, run.id, "node_entered", node.node_key, {
        condition_result: branch,
        advancing_to: currentKey,
      });
      continue;
    }
    if (node.node_type === "set_tag") {
      const cfg = node.config as unknown as SetTagNodeConfig;
      try {
        if (cfg.mode === "add") {
          await db
            .from("contact_tags")
            .upsert(
              { contact_id: run.contact_id!, tag_id: cfg.tag_id },
              { onConflict: "contact_id,tag_id" },
            );
        } else {
          await db
            .from("contact_tags")
            .delete()
            .eq("contact_id", run.contact_id!)
            .eq("tag_id", cfg.tag_id);
        }
      } catch (err) {
        // Non-fatal — log + advance. A tag-write failure shouldn't
        // strand the customer mid-flow.
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "set_tag_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_buttons") {
      await sendButtonsAndSuspend(db, run, node);
      // Persist the new current_node_key via optimistic UPDATE.
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_list") {
      await sendListAndSuspend(db, run, node);
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "handoff") {
      await executeHandoff(db, run, node);
      return { outcome: "handed_off" };
    }
    if (node.node_type === "end") {
      await logEvent(db, run.id, "completed", node.node_key);
      await endRun(db, run.id, "completed", "end_node");
      return { outcome: "completed" };
    }
    if (node.node_type === "send_chatbot_reply") {
      await sendChatbotReplyAndAdvance(db, run, node);
      const cfg = node.config as Record<string, unknown>;
      const hasReplyRoutes =
        ((cfg.button_routes as unknown[]) ?? []).length > 0 ||
        ((cfg.row_routes as unknown[]) ?? []).length > 0;
      const nextKey = typeof cfg.next_node_key === "string" ? cfg.next_node_key : "";
      if (!hasReplyRoutes && nextKey) {
        currentKey = nextKey;
        continue;
      }
      await persistSuspendedNode(db, run.id, run.current_node_key, node.node_key);
      return { outcome: "advanced" };
    }
    if (node.node_type === "api_request") {
      const next = await executeApiRequest(db, run, node);
      if (!next) {
        await endRun(db, run.id, "failed", "api_request_no_failure_path");
        return { outcome: "completed" };
      }
      currentKey = next;
      continue;
    }
    if (node.node_type === "wait_send_message") {
      const scheduled = await scheduleWaitSendMessage(db, run, node);
      if (!scheduled) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_wait_schedule",
        });
      }
      return { outcome: "advanced" };
    }
    if (
      node.node_type === "send_image" ||
      node.node_type === "send_document" ||
      node.node_type === "send_location" ||
      node.node_type === "send_contacts" ||
      node.node_type === "send_cta_url" ||
      node.node_type === "ask_location"
    ) {
      await executeMediaNode(db, run, node);
      const cfg = node.config as Record<string, unknown>;
      const nextKey = cfg.next_node_key as string;
      if (nextKey) {
        currentKey = nextKey;
        continue;
      } else {
        await endRun(db, run.id, "completed", "no_next_node");
        return { outcome: "completed" };
      }
      return { outcome: "advanced" };
    }
    // Unknown node type — shouldn't happen given the CHECK constraint.
    await logEvent(db, run.id, "error", node.node_key, {
      reason: `unknown_node_type:${node.node_type}`,
    });
    await endRun(db, run.id, "failed", "unknown_node_type");
    return { outcome: "completed" };
  }
  // Safety break — log + fail.
  await logEvent(db, run.id, "error", currentKey, {
    reason: "advance_loop_safety_break",
  });
  await endRun(db, run.id, "failed", "advance_loop_overflow");
  return { outcome: "completed" };
}

/**
 * Optimistic UPDATE — only advance current_node_key when it matches
 * the value we read at the top of dispatch. If another webhook beat
 * us, the row's pointer has already moved and our UPDATE returns
 * zero rows; we treat that as a no-op and let the other run continue.
 */
async function advanceCurrentNodeKey(
  db: AdminClient,
  runId: string,
  expectedOldKey: string | null,
  newKey: string,
): Promise<boolean> {
  // PostgREST: when expectedOldKey is null we can't `.eq` (would match
  // any row); use `.is('current_node_key', null)` instead.
  let q = db
    .from("flow_runs")
    .update({
      current_node_key: newKey,
      last_advanced_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "active");
  if (expectedOldKey === null) {
    q = q.is("current_node_key", null);
  } else {
    q = q.eq("current_node_key", expectedOldKey);
  }
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[flows] advanceCurrentNodeKey error:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function persistSuspendedNode(
  db: AdminClient,
  runId: string,
  expectedOldKey: string | null,
  nodeKey: string,
): Promise<void> {
  const advanced = await advanceCurrentNodeKey(
    db,
    runId,
    expectedOldKey,
    nodeKey,
  );
  if (!advanced) {
    await logEvent(db, runId, "error", nodeKey, {
      reason: "lost_race_during_advance",
    });
  }
}

// ============================================================
// Public entry point — the webhook calls this on every inbound.
// ============================================================

export async function dispatchInboundToFlows(
  input: DispatchInboundInput & { isFirstInboundMessage: boolean },
): Promise<DispatchInboundResult> {
  const db = supabaseAdmin();
  try {
    const activeRun = await loadActiveRunForContact(
      db,
      input.userId,
      input.contactId,
    );

    // Idempotency — only matters if there's already a run for this
    // contact. For new runs, the partial unique index catches duplicate
    // starts at INSERT time.
    if (activeRun) {
      const dupe = await isDuplicateInbound(
        db,
        input.userId,
        input.contactId,
        input.message.meta_message_id,
      );
      if (dupe) {
        return {
          consumed: true,
          flow_run_id: activeRun.id,
          outcome: "duplicate_inbound_ignored",
        };
      }
      // One SELECT for the whole flow's nodes — advance loop is now
      // in-memory. See loadAllNodes.
      const nodes = await loadAllNodes(db, activeRun.flow_id);
      return handleReplyForActiveRun(db, activeRun, input.message, nodes);
    }

    // No active run → look for a flow whose entry trigger matches.
    const flow = await findEntryFlow(
      db,
      input.userId,
      input.message,
      input.isFirstInboundMessage,
    );
    if (!flow || !flow.entry_node_id) {
      return { consumed: false, outcome: "no_match" };
    }
    const nodes = await loadAllNodes(db, flow.id);
    return startNewRun(db, flow, input, nodes);
  } catch (err) {
    console.error(
      "[flows] dispatchInboundToFlows threw:",
      err instanceof Error ? err.message : err,
    );
    return { consumed: false, outcome: "no_match" };
  }
}

async function handleReplyForActiveRun(
  db: AdminClient,
  run: FlowRunRow,
  message: ParsedInbound,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // Note: we intentionally do NOT persist the raw customer text. A
  // `collect_input` prompt that asks "what's your card number?" would
  // otherwise leave the PAN sitting in flow_run_events.payload forever,
  // visible to anyone with access to the runs viewer or the events
  // table. Length is enough for "did they actually reply?" debugging;
  // for the captured value itself, the `node_entered` event already
  // records `captured_key` + `captured_length` after the var is stored.
  await logEvent(db, run.id, "reply_received", run.current_node_key, {
    meta_message_id: message.meta_message_id,
    reply_kind: message.kind,
    reply_id: message.kind === "interactive_reply" ? message.reply_id : null,
    text_length: message.kind === "text" ? message.text.length : null,
  });

  if (!run.current_node_key) {
    // Defensive — a run with status='active' but no current node is
    // malformed. Fail the run rather than spin.
    await endRun(db, run.id, "failed", "active_run_missing_current_node");
    return {
      consumed: true,
      flow_run_id: run.id,
      outcome: "no_match",
    };
  }

  const currentNode = nodes.get(run.current_node_key) ?? null;
  if (!currentNode) {
    await endRun(db, run.id, "failed", "current_node_not_found");
    return { consumed: true, flow_run_id: run.id, outcome: "no_match" };
  }

  // Two ways a reply can advance:
  //   1. Interactive button/list tap on a send_buttons/send_list node.
  //   2. Text reply on a collect_input node — capture into vars.
  //
  // Everything else falls through to the fallback policy below.
  let matched: string | null = null;
  if (
    message.kind === "interactive_reply" &&
    (currentNode.node_type === "send_buttons" ||
      currentNode.node_type === "send_list" ||
      currentNode.node_type === "send_chatbot_reply")
  ) {
    matched = matchReplyId(currentNode, message.reply_id);
  } else if (
    message.kind === "text" &&
    currentNode.node_type === "collect_input"
  ) {
    const cfg = currentNode.config as unknown as CollectInputNodeConfig;
    const captured = message.text.trim();
    if (captured.length > 0 && cfg.var_key) {
      // Persist captured value + reset reprompt count atomically.
      const newVars = { ...run.vars, [cfg.var_key]: captured };
      const { error: capErr } = await db
        .from("flow_runs")
        .update({
          vars: newVars,
          reprompt_count: 0,
        })
        .eq("id", run.id);
      if (!capErr) {
        // Mirror the UPDATE in-memory so downstream interpolation in
        // the advance loop sees the captured var without us having to
        // re-SELECT the whole row.
        run.vars = newVars;
        run.reprompt_count = 0;
        await logEvent(db, run.id, "node_entered", currentNode.node_key, {
          captured_key: cfg.var_key,
          captured_length: captured.length,
        });
        matched = cfg.next_node_key;
      }
    }
  }

  if (matched) {
    // Reset reprompt count on a successful match. Skip the write when
    // already 0 — the collect_input capture branch above already
    // zeroed it, and interactive-reply matches against a fresh run
    // (post-prior-reset) are also already 0. The previous re-read of
    // the whole row was needed only because we weren't mirroring the
    // capture UPDATE into the in-memory `run`; now that we do, the
    // local copy is the source of truth.
    if (run.reprompt_count !== 0) {
      const { error } = await db
        .from("flow_runs")
        .update({ reprompt_count: 0 })
        .eq("id", run.id);
      if (!error) run.reprompt_count = 0;
    }
    const outcome = await advanceFromNodeKey(db, run, matched, nodes);
    return {
      consumed: true,
      flow_run_id: run.id,
      outcome: outcome.outcome,
    };
  }

  // No match → fallback. Apply the policy.
  const policy = resolveFallbackPolicy(
    (await loadFlow(db, run.flow_id))?.fallback_policy,
  );
  const newReprompts = run.reprompt_count + 1;
  await db
    .from("flow_runs")
    .update({ reprompt_count: newReprompts })
    .eq("id", run.id);

  const action = decideFallback({ policy, reprompt_count: newReprompts });
  await logEvent(db, run.id, "fallback_fired", run.current_node_key, {
    action: action.type,
    reprompt_count: newReprompts,
  });
  if (action.type === "ignore") {
    // Don't consume — let automations have a shot at it.
    return { consumed: false, flow_run_id: run.id, outcome: "no_match" };
  }
  if (action.type === "reprompt") {
    // Re-send the same prompt. Same node, no current_node_key change.
    if (currentNode.node_type === "send_buttons") {
      await sendButtonsAndSuspend(db, run, currentNode);
    } else if (currentNode.node_type === "send_list") {
      await sendListAndSuspend(db, run, currentNode);
    } else if (currentNode.node_type === "collect_input") {
      // Customer typed something we couldn't accept (empty after trim,
      // or var_key missing — rare). Re-send the prompt so they try again.
      const cfg = currentNode.config as unknown as CollectInputNodeConfig;
      try {
        await engineSendText({
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
      } catch (err) {
        await logEvent(db, run.id, "error", currentNode.node_key, {
          reason: "reprompt_send_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { consumed: true, flow_run_id: run.id, outcome: "fallback_fired" };
  }
  if (action.type === "handoff") {
    if (run.conversation_id) {
      await db
        .from("conversations")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", run.conversation_id);
    }
    await logEvent(db, run.id, "handoff", run.current_node_key, {
      reason: "fallback_exhausted",
    });
    await endRun(db, run.id, "handed_off", "fallback_exhausted");
    return { consumed: true, flow_run_id: run.id, outcome: "handed_off" };
  }
  // action.type === 'end'
  await endRun(db, run.id, "completed", "fallback_exhausted_end");
  return { consumed: true, flow_run_id: run.id, outcome: "completed" };
}

async function startNewRun(
  db: AdminClient,
  flow: FlowRow,
  input: DispatchInboundInput,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // INSERT — partial unique index `idx_one_active_run_per_contact`
  // catches concurrent inserts with 23505. We catch and return as
  // consumed:true (the parallel webhook handles it).
  const { data: inserted, error: insErr } = await db
    .from("flow_runs")
    .insert({
      flow_id: flow.id,
      user_id: flow.user_id,
      contact_id: input.contactId,
      conversation_id: input.conversationId,
      status: "active",
      current_node_key: flow.entry_node_id,
    })
    .select("*")
    .maybeSingle();
  if (insErr) {
    // 23505 = unique_violation → another webhook is starting the run.
    const msg = insErr.message ?? "";
    if (msg.includes("23505") || msg.includes("duplicate key")) {
      return { consumed: true, outcome: "duplicate_inbound_ignored" };
    }
    console.error("[flows] startNewRun insert error:", insErr.message);
    return { consumed: false, outcome: "no_match" };
  }
  const run = inserted as FlowRunRow;
  await logEvent(db, run.id, "started", flow.entry_node_id, {
    flow_id: flow.id,
    trigger_type: flow.trigger_type,
    meta_message_id: input.message.meta_message_id,
  });
  // Bump the flow's execution counter — used by the builder UI to
  // surface "X runs since activation" on the flow card.
  //
  // Atomic RPC (migration 012) rather than read-modify-write: two
  // concurrent webhooks starting runs for different contacts on the
  // same flow would otherwise both read N and both write N+1, losing
  // a count. Mirrors the automations engine's use of
  // `increment_automation_execution_count` (migration 007).
  const { error: incErr } = await db.rpc("increment_flow_execution_count", {
    p_flow_id: flow.id,
  });
  if (incErr) {
    // Non-fatal — the run itself succeeded; only the counter is off.
    console.error("[flows] execution_count rpc error:", incErr.message);
  }

  // Run the advance loop starting from the entry node.
  const outcome = await advanceFromNodeKey(db, run, flow.entry_node_id!, nodes);
  return {
    consumed: true,
    flow_run_id: run.id,
    outcome: outcome.outcome === "advanced" ? "started" : outcome.outcome,
  };
}

// ============================================================
// API Request node executor
// ============================================================

/**
 * Execute an HTTP request, store the response in vars, and return
 * the next node_key to advance to (success_next or failure_next).
 * Returns null if no failure_next is configured and the request fails.
 */
async function executeApiRequest(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<string | null> {
  const cfg = node.config as Record<string, unknown>;
  const method = (cfg.method as string) || "GET";
  const rawUrl = (cfg.url as string) || "";
  const rawHeaders = (cfg.headers as Record<string, string>) || {};
  const rawBody = (cfg.body as string) || "";
  const responseVarKey = (cfg.response_var_key as string) || "api_response";
  const successNext = (cfg.success_next as string) || "";
  const failureNext = (cfg.failure_next as string) || "";

  // Interpolate {{vars.X}} in URL, headers, body
  const vars = (run.vars as Record<string, unknown>) || {};
  const interpolate = (s: string) =>
    s.replace(/\{\{vars\.(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));

  const url = interpolate(rawUrl);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (k.trim()) headers[k] = interpolate(v);
  }
  const body = ["POST", "PUT", "PATCH"].includes(method) ? interpolate(rawBody) : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Parse response (up to 64KB)
    const contentType = res.headers.get("content-type") || "";
    let responseValue: unknown = null;
    const text = await res.text();
    const truncated = text.slice(0, 65_536);
    if (contentType.includes("application/json")) {
      try {
        responseValue = JSON.parse(truncated);
      } catch {
        responseValue = truncated;
      }
    } else if (contentType.includes("text/")) {
      responseValue = truncated;
    }

    // Store in vars
    if (responseValue !== null) {
      const newVars = { ...vars, [responseVarKey]: responseValue };
      await db.from("flow_runs").update({ vars: newVars }).eq("id", run.id);
    }

    await logEvent(db, run.id, "node_entered", node.node_key, {
      node_type: "api_request",
      method,
      url,
      status: res.status,
    });

    if (res.status >= 200 && res.status < 300) {
      return successNext || null;
    }
    return failureNext || null;
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "Unknown error";
    await logEvent(db, run.id, "error", node.node_key, {
      node_type: "api_request",
      reason: "request_failed",
      detail: message,
    });
    return failureNext || null;
  }
}

// ============================================================
// Wait/Schedule Send Message node executor
// ============================================================

/**
 * Schedule a wait+send: compute scheduled_send_at and persist on the run.
 * The cron job will pick it up later and send the message.
 */
async function scheduleWaitSendMessage(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<boolean> {
  const cfg = node.config as Record<string, unknown>;
  const delayAmount = (cfg.delay_amount as number) || 1;
  const delayUnit = (cfg.delay_unit as string) || "hours";
  const timingMode = (cfg.timing_mode as string) || "fixed";

  const unitMs: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
    weeks: 604_800_000,
  };
  const delayMs = delayAmount * (unitMs[delayUnit] || 3_600_000);
  const baseTs =
    timingMode === "relative" && run.last_advanced_at
      ? new Date(run.last_advanced_at).getTime()
      : Date.now();
  const scheduledSendAt = new Date(baseTs + delayMs).toISOString();

  let q = db
    .from("flow_runs")
    .update({
      current_node_key: node.node_key,
      scheduled_send_at: scheduledSendAt,
      last_advanced_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "active");
  if (run.current_node_key === null) {
    q = q.is("current_node_key", null);
  } else {
    q = q.eq("current_node_key", run.current_node_key);
  }
  const { data, error } = await q.select("id");
  const scheduled = !error && Array.isArray(data) && data.length > 0;

  await logEvent(db, run.id, "node_entered", node.node_key, {
    node_type: "wait_send_message",
    scheduled_send_at: scheduledSendAt,
    delay_amount: delayAmount,
    delay_unit: delayUnit,
  });
  return scheduled;
}

export async function processDueWaitSends(
  db: AdminClient = supabaseAdmin(),
  now: Date = new Date(),
  limit = 50,
): Promise<{ waitProcessed: number; waitFailed: number }> {
  const { data: waitRuns, error } = await db
    .from("flow_runs")
    .select("*")
    .eq("status", "active")
    .not("scheduled_send_at", "is", null)
    .lte("scheduled_send_at", now.toISOString())
    .limit(limit);

  if (error) {
    console.error("[flows] due wait scan failed:", error.message);
    throw error;
  }

  let waitProcessed = 0;
  let waitFailed = 0;

  for (const run of (waitRuns ?? []) as FlowRunRow[]) {
    try {
      if (!run.current_node_key) {
        await failWaitRun(db, run.id, now, "wait_run_missing_current_node");
        waitFailed += 1;
        continue;
      }

      const nodes = await loadAllNodes(db, run.flow_id);
      const node = nodes.get(run.current_node_key);
      if (!node || node.node_type !== "wait_send_message") {
        await failWaitRun(db, run.id, now, "wait_node_not_found");
        waitFailed += 1;
        continue;
      }

      const claimed = await claimDueWaitRun(db, run, now);
      if (!claimed) continue;

      await sendWaitConfiguredMessage(db, run, node);
      const cfg = node.config as Record<string, unknown>;
      const nextKey = typeof cfg.next_node_key === "string" ? cfg.next_node_key : "";
      await logEvent(db, run.id, "message_sent", node.node_key, {
        node_type: "wait_send_message",
        message_type: cfg.message_type,
      });

      if (!nextKey) {
        await endRun(db, run.id, "completed", "wait_send_no_next");
      } else {
        // Update current_node_key in DB before advancing
        await db
          .from("flow_runs")
          .update({ current_node_key: nextKey, last_advanced_at: now.toISOString() })
          .eq("id", run.id);
        run.current_node_key = nextKey;
        run.scheduled_send_at = null;
        run.last_advanced_at = now.toISOString();
        await advanceFromNodeKey(db, run, nextKey, nodes);
      }
      waitProcessed += 1;
    } catch (err) {
      console.error("[flows] wait_send failed:", err);
      await logEvent(db, run.id, "error", run.current_node_key, {
        node_type: "wait_send_message",
        reason: "send_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      await failWaitRun(db, run.id, now, "wait_send_failed");
      waitFailed += 1;
    }
  }

  return { waitProcessed, waitFailed };
}

async function claimDueWaitRun(
  db: AdminClient,
  run: FlowRunRow,
  now: Date,
): Promise<boolean> {
  const { data, error } = await db
    .from("flow_runs")
    .update({
      scheduled_send_at: null,
      last_advanced_at: now.toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "active")
    .eq("current_node_key", run.current_node_key)
    .not("scheduled_send_at", "is", null)
    .lte("scheduled_send_at", now.toISOString())
    .select("id");
  if (error) {
    console.error("[flows] wait claim failed:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function failWaitRun(
  db: AdminClient,
  runId: string,
  now: Date,
  reason: string,
): Promise<void> {
  await db
    .from("flow_runs")
    .update({
      status: "failed",
      scheduled_send_at: null,
      ended_at: now.toISOString(),
      end_reason: reason,
    })
    .eq("id", runId)
    .eq("status", "active");
}

async function sendWaitConfiguredMessage(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as Record<string, unknown>;
  const messageType = (cfg.message_type as string) || "text";
  const content = (cfg.message_content as Record<string, unknown>) || {};
  const vars = (run.vars as Record<string, unknown>) || {};
  const interpolate = (s: string) =>
    s.replace(/\{\{vars\.(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));

  if (messageType === "text") {
    await engineSendText({
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      text: interpolate((content.text as string) || ""),
    });
    return;
  }

  if (messageType === "interactive") {
    await engineSendInteractiveButtons({
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      bodyText: interpolate((content.text as string) || ""),
      headerText: content.header_text as string | undefined,
      footerText: content.footer_text as string | undefined,
      buttons: ((content.buttons as Array<{ reply_id: string; title: string }>) ?? []).map(
        (b) => ({ id: b.reply_id, title: b.title }),
      ),
    });
    return;
  }

  await sendRawWaitMessage(db, {
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    messageType,
    content,
    interpolate,
  });
}

async function sendRawWaitMessage(
  db: AdminClient,
  args: {
    userId: string;
    conversationId: string;
    contactId: string;
    messageType: string;
    content: Record<string, unknown>;
    interpolate: (s: string) => string;
  },
): Promise<void> {
  const context = await loadMetaSendContext(db, args.userId, args.contactId);
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: context.to,
  };
  const mediaUrl = args.interpolate((args.content.media_url as string) || "");
  const text = args.interpolate((args.content.text as string) || "");

  let payload: Record<string, unknown>;
  let contentType = args.messageType;
  let contentText = text || `[${args.messageType} message]`;

  if (args.messageType === "image" || args.messageType === "video" || args.messageType === "audio") {
    payload = {
      ...base,
      type: args.messageType,
      [args.messageType]: {
        link: mediaUrl,
        ...(text && args.messageType !== "audio" ? { caption: text } : {}),
      },
    };
  } else if (args.messageType === "file") {
    contentType = "document";
    payload = {
      ...base,
      type: "document",
      document: {
        link: mediaUrl,
        ...(args.content.filename ? { filename: args.content.filename as string } : {}),
        ...(text ? { caption: text } : {}),
      },
    };
  } else if (args.messageType === "location") {
    payload = {
      ...base,
      type: "location",
      location: {
        latitude: args.content.latitude as number,
        longitude: args.content.longitude as number,
        ...(args.content.location_name ? { name: args.content.location_name as string } : {}),
        ...(args.content.location_address ? { address: args.content.location_address as string } : {}),
      },
    };
    contentText = [
      args.content.location_name,
      args.content.location_address,
      `${args.content.latitude},${args.content.longitude}`,
    ]
      .filter(Boolean)
      .join(" - ");
  } else {
    throw new Error(`Unsupported wait message type: ${args.messageType}`);
  }

  const messageId = await postMetaPayloadWithPhoneRetry(db, context, payload);
  await db.from("messages").insert({
    conversation_id: args.conversationId,
    sender_type: "bot",
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl || null,
    message_id: messageId,
    status: "sent",
  });
  await db
    .from("conversations")
    .update({
      last_message_text: contentText,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);
}

async function loadMetaSendContext(
  db: AdminClient,
  userId: string,
  contactId: string,
): Promise<{
  contactId: string;
  sanitized: string;
  to: string;
  phoneNumberId: string;
  accessToken: string;
}> {
  const { data: contact, error: contactErr } = await db
    .from("contacts")
    .select("id, phone")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (contactErr || !contact?.phone) throw new Error("contact not found for this user");

  const sanitized = sanitizePhoneForMeta(contact.phone);
  if (!isValidE164(sanitized)) throw new Error(`contact phone invalid: ${contact.phone}`);

  const { data: config, error: configErr } = await db
    .from("whatsapp_config")
    .select("phone_number_id, access_token")
    .eq("user_id", userId)
    .single();
  if (configErr || !config) throw new Error("WhatsApp not configured for this account");

  return {
    contactId: contact.id,
    sanitized,
    to: sanitized,
    phoneNumberId: config.phone_number_id,
    accessToken: decrypt(config.access_token),
  };
}

async function postMetaPayloadWithPhoneRetry(
  db: AdminClient,
  context: Awaited<ReturnType<typeof loadMetaSendContext>>,
  payload: Record<string, unknown>,
): Promise<string> {
  const metaUrl = `https://graph.facebook.com/v21.0/${context.phoneNumberId}/messages`;
  let workingPhone = context.sanitized;
  let messageId = "";
  let lastError: unknown = null;

  for (const phone of phoneVariants(context.sanitized)) {
    const nextPayload = { ...payload, to: phone };
    try {
      const res = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${context.accessToken}`,
        },
        body: JSON.stringify(nextPayload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { error?: { message?: string } }).error?.message ??
          `Meta API error: ${res.status}`;
        throw new Error(msg);
      }
      const data = await res.json();
      messageId = data?.messages?.[0]?.id ?? "";
      workingPhone = phone;
      lastError = null;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRecipientNotAllowedError(msg)) throw err;
      lastError = err;
    }
  }

  if (lastError) throw lastError;
  if (!messageId) throw new Error("Meta send succeeded without a message id");

  if (workingPhone !== context.sanitized) {
    await db.from("contacts").update({ phone: workingPhone }).eq("id", context.contactId);
  }
  return messageId;
}

// ============================================================
// Media / Location / Contacts / CTA URL node executor
// ============================================================

/**
 * Sends image, document, location, contacts, or CTA URL messages
 * via the WhatsApp Cloud API. Uses the user's stored credentials.
 */
async function executeMediaNode(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as Record<string, unknown>;
  const vars = (run.vars as Record<string, unknown>) || {};
  const interpolate = (s: string) =>
    s.replace(/\{\{vars\.(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));

  // Get WhatsApp credentials
  const { data: waConfig } = await db
    .from("whatsapp_config")
    .select("phone_number_id, access_token")
    .eq("user_id", run.user_id)
    .maybeSingle();

  if (!waConfig) {
    await logEvent(db, run.id, "error", node.node_key, { reason: "no_whatsapp_config" });
    return;
  }

  const { decrypt } = await import("@/lib/whatsapp/encryption");
  const accessToken = decrypt(waConfig.access_token);
  const phoneNumberId = waConfig.phone_number_id;

  // Get contact phone
  const { data: contact } = await db
    .from("contacts")
    .select("phone")
    .eq("id", run.contact_id!)
    .maybeSingle();

  if (!contact?.phone) {
    await logEvent(db, run.id, "error", node.node_key, { reason: "no_contact_phone" });
    return;
  }

  const to = contact.phone.replace(/^\+/, "");
  const metaUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  let payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };

  switch (node.node_type) {
    case "send_image":
      payload = {
        ...payload,
        type: "image",
        image: {
          link: interpolate((cfg.image_url as string) || ""),
          ...(cfg.caption ? { caption: interpolate(cfg.caption as string) } : {}),
        },
      };
      break;

    case "send_document":
      payload = {
        ...payload,
        type: "document",
        document: {
          link: interpolate((cfg.document_url as string) || ""),
          ...(cfg.filename ? { filename: cfg.filename as string } : {}),
          ...(cfg.caption ? { caption: interpolate(cfg.caption as string) } : {}),
        },
      };
      break;

    case "send_location":
      payload = {
        ...payload,
        type: "location",
        location: {
          latitude: cfg.latitude as number,
          longitude: cfg.longitude as number,
          ...(cfg.name ? { name: cfg.name as string } : {}),
          ...(cfg.address ? { address: cfg.address as string } : {}),
        },
      };
      break;

    case "send_contacts": {
      const contacts = (cfg.contacts as Array<Record<string, unknown>>) || [];
      payload = {
        ...payload,
        type: "contacts",
        contacts: contacts.map((c) => ({
          name: c.name,
          phones: c.phones || [],
          emails: c.emails || [],
        })),
      };
      break;
    }

    case "send_cta_url":
      payload = {
        ...payload,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: interpolate((cfg.body_text as string) || "") },
          ...(cfg.footer_text ? { footer: { text: cfg.footer_text as string } } : {}),
          action: {
            name: "cta_url",
            parameters: {
              display_text: (cfg.button_text as string) || "Visit",
              url: interpolate((cfg.url as string) || ""),
            },
          },
        },
      };
      break;

    case "ask_location":
      payload = {
        ...payload,
        type: "interactive",
        interactive: {
          type: "location_request_message",
          body: {
            type: "text",
            text: interpolate((cfg.body_text as string) || "Please share your location"),
          },
          action: {
            name: "send_location",
          },
        },
      };
      break;
  }

  const res = await fetch(metaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    await logEvent(db, run.id, "error", node.node_key, {
      reason: "meta_send_failed",
      status: res.status,
      detail: (err as Record<string, unknown>)?.error || err,
    });
    return;
  }

  const data = await res.json();
  const messageId = data?.messages?.[0]?.id;

  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: node.node_type,
    whatsapp_message_id: messageId,
  });

  // Store in messages table
  await db.from("messages").insert({
    conversation_id: run.conversation_id,
    sender_type: "bot",
    content_type: node.node_type === "send_cta_url" ? "interactive" : node.node_type.replace("send_", ""),
    content_text: (cfg.caption as string) || (cfg.body_text as string) || `[${node.node_type}]`,
    message_id: messageId,
    status: "sent",
    created_at: new Date().toISOString(),
  });
}
