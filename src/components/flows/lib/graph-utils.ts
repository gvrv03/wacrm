/**
 * Conversion utilities between the DB/API FlowNodeRow format and
 * the React Flow Node/Edge format the canvas needs.
 *
 * Edges are *derived* from node configs (each node carries its own
 * `next_node_key` / button routes / branch targets). This matches the
 * DB schema where edges live inside config JSONB — not as separate rows.
 */

import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeRow } from "@/lib/flows/types";
import type { BuilderNode, NodeType } from "./constants";

// ============================================================
// FlowNodeRow[] → React Flow Node[]
// ============================================================

export interface FlowNodeData extends Record<string, unknown> {
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown>;
  isEntry: boolean;
}

const DEFAULT_NODE_SPACING_Y = 150;
const DEFAULT_NODE_SPACING_X = 300;

/**
 * Convert DB rows into React Flow nodes. If nodes lack real positions
 * (all 0,0), auto-layout them vertically.
 */
export function flowNodesToReactFlowNodes(
  rows: FlowNodeRow[],
  entryNodeId: string | null,
): Node<FlowNodeData>[] {
  const hasPositions = rows.some((r) => r.position_x !== 0 || r.position_y !== 0);

  return rows.map((row, idx) => ({
    id: row.node_key,
    type: row.node_type,
    position: hasPositions
      ? { x: row.position_x, y: row.position_y }
      : { x: DEFAULT_NODE_SPACING_X, y: idx * DEFAULT_NODE_SPACING_Y },
    data: {
      node_key: row.node_key,
      node_type: row.node_type as NodeType,
      config: row.config as Record<string, unknown>,
      isEntry: row.node_key === entryNodeId,
    },
  }));
}

// ============================================================
// React Flow Node[] → BuilderNode[] (for save)
// ============================================================

export function reactFlowToBuilderNodes(
  nodes: Node<FlowNodeData>[],
): BuilderNode[] {
  return nodes.map((n) => ({
    node_key: n.data.node_key,
    node_type: n.data.node_type,
    config: n.data.config,
  }));
}

/**
 * Extract positions for the save payload — the API stores position_x/y.
 */
export function extractPositions(
  nodes: Node<FlowNodeData>[],
): Array<{ node_key: string; position_x: number; position_y: number }> {
  return nodes.map((n) => ({
    node_key: n.data.node_key,
    position_x: Math.round(n.position.x),
    position_y: Math.round(n.position.y),
  }));
}

// ============================================================
// Derive edges from node configs
// ============================================================

/**
 * Re-derive all edges from the current node data. Called whenever
 * node configs change (e.g., a next_node_key is picked).
 */
export function deriveEdges(nodes: Node<FlowNodeData>[]): Edge[] {
  const edges: Edge[] = [];
  const existingKeys = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    const cfg = node.data.config;
    const nodeType = node.data.node_type;

    switch (nodeType) {
      case "start":
      case "send_message":
      case "collect_input":
      case "set_tag":
      case "send_image":
      case "send_document":
      case "send_location":
      case "send_contacts":
      case "send_cta_url":
      case "ask_location":
      case "wait_send_message": {
        const next = cfg.next_node_key as string | undefined;
        if (next && existingKeys.has(next)) {
          edges.push({
            id: `${node.id}->default->${next}`,
            source: node.id,
            target: next,
            sourceHandle: "default",
            type: "animated",
            animated: true,
          });
        }
        break;
      }

      case "condition": {
        const trueNext = cfg.true_next as string | undefined;
        const falseNext = cfg.false_next as string | undefined;
        if (trueNext && existingKeys.has(trueNext)) {
          edges.push({
            id: `${node.id}->true->${trueNext}`,
            source: node.id,
            target: trueNext,
            sourceHandle: "true",
            type: "animated",
            animated: true,
            label: "True",
            style: { stroke: "hsl(142, 71%, 45%)" },
          });
        }
        if (falseNext && existingKeys.has(falseNext)) {
          edges.push({
            id: `${node.id}->false->${falseNext}`,
            source: node.id,
            target: falseNext,
            sourceHandle: "false",
            type: "animated",
            animated: true,
            label: "False",
            style: { stroke: "hsl(0, 84%, 60%)" },
          });
        }
        break;
      }

      case "send_buttons": {
        const buttons = (cfg.buttons ?? []) as Array<{
          reply_id: string;
          title: string;
          next_node_key: string;
        }>;
        buttons.forEach((btn, idx) => {
          if (btn.next_node_key && existingKeys.has(btn.next_node_key)) {
            edges.push({
              id: `${node.id}->btn_${idx}->${btn.next_node_key}`,
              source: node.id,
              target: btn.next_node_key,
              sourceHandle: `btn_${idx}`,
              type: "animated",
              animated: true,
              label: btn.title || `Button ${idx + 1}`,
            });
          }
        });
        break;
      }

      case "send_list": {
        const sections = (cfg.sections ?? []) as Array<{
          rows: Array<{
            reply_id: string;
            title: string;
            next_node_key: string;
          }>;
        }>;
        let rowIdx = 0;
        for (const section of sections) {
          for (const row of section.rows ?? []) {
            if (row.next_node_key && existingKeys.has(row.next_node_key)) {
              edges.push({
                id: `${node.id}->row_${rowIdx}->${row.next_node_key}`,
                source: node.id,
                target: row.next_node_key,
                sourceHandle: `row_${rowIdx}`,
                type: "animated",
                animated: true,
                label: row.title || `Row ${rowIdx + 1}`,
              });
            }
            rowIdx++;
          }
        }
        break;
      }

      case "send_chatbot_reply": {
        // Linear next
        const next = cfg.next_node_key as string | undefined;
        if (next && existingKeys.has(next)) {
          edges.push({
            id: `${node.id}->default->${next}`,
            source: node.id,
            target: next,
            sourceHandle: "default",
            type: "animated",
            animated: true,
          });
        }
        // Button routes
        const btnRoutes = (cfg.button_routes ?? []) as Array<{
          button_id: string;
          button_text: string;
          next_node_key: string;
        }>;
        btnRoutes.forEach((br, idx) => {
          if (br.next_node_key && existingKeys.has(br.next_node_key)) {
            edges.push({
              id: `${node.id}->cbtn_${idx}->${br.next_node_key}`,
              source: node.id,
              target: br.next_node_key,
              sourceHandle: `cbtn_${idx}`,
              type: "animated",
              animated: true,
              label: br.button_text || br.button_id,
            });
          }
        });
        // Row routes
        const rowRoutes = (cfg.row_routes ?? []) as Array<{
          row_id: string;
          row_title: string;
          next_node_key: string;
        }>;
        rowRoutes.forEach((rr, idx) => {
          if (rr.next_node_key && existingKeys.has(rr.next_node_key)) {
            edges.push({
              id: `${node.id}->crow_${idx}->${rr.next_node_key}`,
              source: node.id,
              target: rr.next_node_key,
              sourceHandle: `crow_${idx}`,
              type: "animated",
              animated: true,
              label: rr.row_title || rr.row_id,
            });
          }
        });
        break;
      }

      case "handoff":
      case "end":
        // Terminal nodes — no outgoing edges
        break;

      case "api_request": {
        const successNext = cfg.success_next as string | undefined;
        const failureNext = cfg.failure_next as string | undefined;
        if (successNext && existingKeys.has(successNext)) {
          edges.push({
            id: `${node.id}->success->${successNext}`,
            source: node.id,
            target: successNext,
            sourceHandle: "success",
            type: "animated",
            animated: true,
            label: "Success",
            style: { stroke: "hsl(142, 71%, 45%)" },
          });
        }
        if (failureNext && existingKeys.has(failureNext)) {
          edges.push({
            id: `${node.id}->failure->${failureNext}`,
            source: node.id,
            target: failureNext,
            sourceHandle: "failure",
            type: "animated",
            animated: true,
            label: "Failure",
            style: { stroke: "hsl(0, 84%, 60%)" },
          });
        }
        break;
      }
    }
  }

  return edges;
}

/**
 * Get the next available position for a newly added node.
 * Places it below the bottom-most existing node.
 */
export function getNextNodePosition(
  existingNodes: Node<FlowNodeData>[],
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: DEFAULT_NODE_SPACING_X, y: 50 };
  }

  let maxY = -Infinity;
  let maxYNodeX = DEFAULT_NODE_SPACING_X;
  for (const node of existingNodes) {
    if (node.position.y > maxY) {
      maxY = node.position.y;
      maxYNodeX = node.position.x;
    }
  }

  return { x: maxYNodeX, y: maxY + DEFAULT_NODE_SPACING_Y };
}
