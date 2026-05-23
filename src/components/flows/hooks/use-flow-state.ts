"use client";

/**
 * Core state management hook for the React Flow canvas builder.
 *
 * Owns:
 *   - React Flow node/edge arrays
 *   - Parallel BuilderState (name, trigger, entry, status)
 *   - Node CRUD operations (add, remove, update config)
 *   - Edge recomputation on config changes
 *   - Dirty tracking
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNodesState, useEdgesState } from "@xyflow/react";
import type { Node, Edge, Connection, OnNodesChange } from "@xyflow/react";

import {
  validateFlowForActivation,
  type ValidationIssue,
} from "@/lib/flows/validate";
import type { FlowNodeRow, FlowRow } from "@/lib/flows/types";

import type { BuilderState, NodeType } from "../lib/constants";
import {
  NODE_META,
  slugify,
  uniqueNodeKey,
  defaultConfigFor,
} from "../lib/constants";
import {
  flowNodesToReactFlowNodes,
  deriveEdges,
  getNextNodePosition,
  type FlowNodeData,
} from "../lib/graph-utils";

export interface UseFlowStateReturn {
  // React Flow arrays
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<FlowNodeData>>;
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  // Builder state
  state: BuilderState;
  setState: React.Dispatch<React.SetStateAction<BuilderState>>;
  setStateDirty: React.Dispatch<React.SetStateAction<BuilderState>>;
  dirty: boolean;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;

  // Selected node
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Node CRUD
  addNode: (type: NodeType, position?: { x: number; y: number }) => void;
  removeNode: (key: string) => void;
  duplicateNode: (key: string) => void;
  updateNodeConfig: (key: string, patch: Record<string, unknown>) => void;
  updateNodeKey: (oldKey: string, newKey: string) => void;

  // Connections
  onConnect: (connection: Connection) => void;

  // Validation
  issues: ValidationIssue[];
  blockers: ValidationIssue[];
  canActivate: boolean;

  // Edge recompute
  recomputeEdges: () => void;
}

export function useFlowState(
  initialFlow: FlowRow,
  initialNodes: FlowNodeRow[],
): UseFlowStateReturn {
  // ---- Builder state (non-canvas fields) ----
  const [state, setState] = useState<BuilderState>(() => ({
    name: initialFlow.name,
    description: initialFlow.description ?? "",
    trigger_type: initialFlow.trigger_type,
    trigger_config: initialFlow.trigger_config as Record<string, unknown>,
    entry_node_id: initialFlow.entry_node_id,
    status: initialFlow.status,
    nodes: initialNodes.map((n) => ({
      node_key: n.node_key,
      node_type: n.node_type as NodeType,
      config: n.config as Record<string, unknown>,
    })),
  }));

  const [dirty, setDirty] = useState(false);
  const setStateDirty = useCallback<typeof setState>(
    (updaterOrValue) => {
      setDirty(true);
      setState(updaterOrValue);
    },
    [],
  );

  // ---- React Flow nodes/edges ----
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    flowNodesToReactFlowNodes(initialNodes, initialFlow.entry_node_id),
  );
  const [edges, setEdges] = useEdgesState<Edge>(
    deriveEdges(flowNodesToReactFlowNodes(initialNodes, initialFlow.entry_node_id)),
  );

  // ---- Selected node ----
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // ---- Recompute edges when nodes change ----
  const recomputeEdges = useCallback(() => {
    setEdges(deriveEdges(nodes));
  }, [nodes, setEdges]);



  // ---- Add node ----
  const addNode = useCallback(
    (type: NodeType, position?: { x: number; y: number }) => {
      const meta = NODE_META[type];
      const base = slugify(meta.label, type);

      // Build the current list of builder nodes from React Flow nodes
      const currentBuilderNodes = nodes.map((n) => ({
        node_key: n.data.node_key,
        node_type: n.data.node_type,
        config: n.data.config,
      }));

      const node_key = uniqueNodeKey(base, currentBuilderNodes);
      const config = defaultConfigFor(type);
      const finalPosition = position ?? getNextNodePosition(nodes);

      const newNode: Node<FlowNodeData> = {
        id: node_key,
        type,
        position: finalPosition,
        data: {
          node_key,
          node_type: type,
          config,
          isEntry: false,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setDirty(true);

      // Auto-set entry for first start node
      setState((s) => ({
        ...s,
        nodes: [...s.nodes, { node_key, node_type: type, config }],
        entry_node_id:
          s.entry_node_id ??
          (type === "start" ? node_key : s.entry_node_id ?? null),
      }));

      // Select the new node
      setSelectedNodeId(node_key);
    },
    [nodes, setNodes],
  );

  // ---- Remove node ----
  const removeNode = useCallback(
    (key: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== key));
      setDirty(true);

      setState((s) => ({
        ...s,
        nodes: s.nodes.filter((n) => n.node_key !== key),
        entry_node_id: s.entry_node_id === key ? null : s.entry_node_id,
      }));

      if (selectedNodeId === key) {
        setSelectedNodeId(null);
      }

      // Edges will be recomputed via the effect below
    },
    [selectedNodeId, setNodes],
  );

  // ---- Duplicate node ----
  const duplicateNode = useCallback(
    (key: string) => {
      const sourceNode = nodes.find((n) => n.id === key);
      if (!sourceNode) return;

      const type = sourceNode.data.node_type;
      const originalConfig = sourceNode.data.config;

      // Deep copy the config to prevent shared mutations
      const clonedConfig = JSON.parse(JSON.stringify(originalConfig));

      // Reset outgoing connections in duplicated node to prevent overlapping lines
      if ("next_node_key" in clonedConfig) clonedConfig.next_node_key = "";
      if ("true_next" in clonedConfig) clonedConfig.true_next = "";
      if ("false_next" in clonedConfig) clonedConfig.false_next = "";
      if (Array.isArray(clonedConfig.buttons)) {
        clonedConfig.buttons = (clonedConfig.buttons as Array<Record<string, unknown>>).map((b) => ({ ...b, next_node_key: "" }));
      }
      if (Array.isArray(clonedConfig.sections)) {
        clonedConfig.sections = (clonedConfig.sections as Array<Record<string, unknown>>).map((s) => {
          const rows = Array.isArray(s.rows) ? s.rows : [];
          return {
            ...s,
            rows: (rows as Array<Record<string, unknown>>).map((r) => ({ ...r, next_node_key: "" })),
          };
        });
      }
      if (Array.isArray(clonedConfig.button_routes)) {
        clonedConfig.button_routes = (clonedConfig.button_routes as Array<Record<string, unknown>>).map((br) => ({ ...br, next_node_key: "" }));
      }
      if (Array.isArray(clonedConfig.row_routes)) {
        clonedConfig.row_routes = (clonedConfig.row_routes as Array<Record<string, unknown>>).map((rr) => ({ ...rr, next_node_key: "" }));
      }

      const baseKey = `${key}_copy`;
      const currentBuilderNodes = nodes.map((n) => ({
        node_key: n.data.node_key,
        node_type: n.data.node_type,
        config: n.data.config,
      }));
      const node_key = uniqueNodeKey(baseKey, currentBuilderNodes);

      const offsetPosition = {
        x: sourceNode.position.x + 40,
        y: sourceNode.position.y + 40,
      };

      const newNode: Node<FlowNodeData> = {
        id: node_key,
        type,
        position: offsetPosition,
        data: {
          node_key,
          node_type: type,
          config: clonedConfig,
          isEntry: false,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setDirty(true);

      setState((s) => ({
        ...s,
        nodes: [...s.nodes, { node_key, node_type: type, config: clonedConfig }],
      }));

      setSelectedNodeId(node_key);
    },
    [nodes, setNodes, setState, setSelectedNodeId, setDirty]
  );

  // ---- Update node config ----
  const updateNodeConfig = useCallback(
    (key: string, patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === key
            ? {
                ...n,
                data: {
                  ...n.data,
                  config: { ...n.data.config, ...patch },
                },
              }
            : n,
        ),
      );
      setDirty(true);

      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.node_key === key
            ? { ...n, config: { ...n.config, ...patch } }
            : n,
        ),
      }));
    },
    [setNodes],
  );

  // ---- Update node key ----
  const updateNodeKey = useCallback(
    (oldKey: string, newKey: string) => {
      const sanitized = slugify(newKey, oldKey);
      if (sanitized === oldKey) return;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === oldKey
            ? {
                ...n,
                id: sanitized,
                data: { ...n.data, node_key: sanitized },
              }
            : n,
        ),
      );
      setDirty(true);

      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.node_key === oldKey ? { ...n, node_key: sanitized } : n,
        ),
        entry_node_id:
          s.entry_node_id === oldKey ? sanitized : s.entry_node_id,
      }));

      if (selectedNodeId === oldKey) {
        setSelectedNodeId(sanitized);
      }
    },
    [selectedNodeId, setNodes],
  );

  // ---- Handle connections ----
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (!sourceNode) return;

      const handle = connection.sourceHandle || "default";
      const targetKey = connection.target;
      const nodeType = sourceNode.data.node_type;

      // Update the source node's config based on handle
      if (nodeType === "condition") {
        if (handle === "true") {
          updateNodeConfig(sourceNode.id, { true_next: targetKey });
        } else if (handle === "false") {
          updateNodeConfig(sourceNode.id, { false_next: targetKey });
        }
      } else if (nodeType === "send_buttons" && handle.startsWith("btn_")) {
        const idx = parseInt(handle.replace("btn_", ""), 10);
        const buttons = [
          ...((sourceNode.data.config.buttons ?? []) as Array<{
            reply_id: string;
            title: string;
            next_node_key: string;
          }>),
        ];
        if (buttons[idx]) {
          buttons[idx] = { ...buttons[idx], next_node_key: targetKey };
          updateNodeConfig(sourceNode.id, { buttons });
        }
      } else if (nodeType === "send_list" && handle.startsWith("row_")) {
        const rowIdx = parseInt(handle.replace("row_", ""), 10);
        const sections = [
          ...((sourceNode.data.config.sections ?? []) as Array<{
            title?: string;
            rows: Array<{
              reply_id: string;
              title: string;
              next_node_key: string;
            }>;
          }>),
        ];
        let count = 0;
        for (let si = 0; si < sections.length; si++) {
          for (let ri = 0; ri < sections[si].rows.length; ri++) {
            if (count === rowIdx) {
              sections[si] = {
                ...sections[si],
                rows: sections[si].rows.map((r, j) =>
                  j === ri ? { ...r, next_node_key: targetKey } : r,
                ),
              };
            }
            count++;
          }
        }
        updateNodeConfig(sourceNode.id, { sections });
      } else if (nodeType === "send_chatbot_reply" && handle.startsWith("cbtn_")) {
        const idx = parseInt(handle.replace("cbtn_", ""), 10);
        const btnRoutes = [
          ...((sourceNode.data.config.button_routes ?? []) as Array<{
            button_id: string;
            button_text: string;
            next_node_key: string;
          }>),
        ];
        if (btnRoutes[idx]) {
          btnRoutes[idx] = { ...btnRoutes[idx], next_node_key: targetKey };
          updateNodeConfig(sourceNode.id, { button_routes: btnRoutes });
        }
      } else if (nodeType === "send_chatbot_reply" && handle.startsWith("crow_")) {
        const idx = parseInt(handle.replace("crow_", ""), 10);
        const rowRoutes = [
          ...((sourceNode.data.config.row_routes ?? []) as Array<{
            row_id: string;
            row_title: string;
            next_node_key: string;
          }>),
        ];
        if (rowRoutes[idx]) {
          rowRoutes[idx] = { ...rowRoutes[idx], next_node_key: targetKey };
          updateNodeConfig(sourceNode.id, { row_routes: rowRoutes });
        }
      } else if (nodeType === "api_request") {
        if (handle === "success") {
          updateNodeConfig(sourceNode.id, { success_next: targetKey });
        } else if (handle === "failure") {
          updateNodeConfig(sourceNode.id, { failure_next: targetKey });
        } else {
          // Default handle on api_request → assume success
          updateNodeConfig(sourceNode.id, { success_next: targetKey });
        }
      } else {
        // Default: set next_node_key
        updateNodeConfig(sourceNode.id, { next_node_key: targetKey });
      }
    },
    [nodes, updateNodeConfig],
  );

  // ---- Recompute edges when nodes change ----
  useEffect(() => {
    setEdges(deriveEdges(nodes));
  }, [nodes, setEdges]);

  // ---- Update entry flag on nodes ----
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isEntry: n.data.node_key === state.entry_node_id,
        },
      })),
    );
  }, [state.entry_node_id, setNodes]);

  // ---- Browser unload guard ----
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---- Validation ----
  const issues = useMemo<ValidationIssue[]>(
    () =>
      validateFlowForActivation(
        {
          name: state.name,
          trigger_type: state.trigger_type,
          trigger_config: state.trigger_config,
          entry_node_id: state.entry_node_id,
        },
        state.nodes,
      ),
    [state],
  );
  const blockers = useMemo(
    () => issues.filter((i) => i.severity === "error"),
    [issues],
  );
  const canActivate = blockers.length === 0;

  // Enrich nodes with callbacks
  const enrichedNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onDelete: () => removeNode(n.id),
        onDuplicate: () => duplicateNode(n.id),
        onEdit: () => setSelectedNodeId(n.id),
      },
    }));
  }, [nodes, removeNode, duplicateNode, setSelectedNodeId]);

  return {
    nodes: enrichedNodes,
    edges,
    onNodesChange,
    setNodes,
    setEdges,
    state,
    setState,
    setStateDirty,
    dirty,
    setDirty,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    removeNode,
    duplicateNode,
    updateNodeConfig,
    updateNodeKey,
    onConnect,
    issues,
    blockers,
    canActivate,
    recomputeEdges,
  };
}
