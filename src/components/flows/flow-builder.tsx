"use client";

/**
 * Orchestrator for the React Flow visual flow builder.
 *
 * Implements the v2 visual canvas editor in Light Theme. Renders:
 *   - Draggable Component Sidebar (left side of the screen)
 *   - Top Toolbar (flow metadata, status, trigger settings, and save/delete/runs buttons)
 *   - Visual Canvas (React Flow with custom nodes/edges, drag-to-connect and drag-and-drop drop support)
 *   - Node Config Panel (contextual right-hand sidebar for configuring individual node settings)
 *   - Validation Panel (collapsible footer issue-list with node jump-to autofocusing)
 *   - Floating Stats Widget (Pipeline stats overlay)
 *   - Floating Save Button (at bottom center of canvas)
 */

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { FlowNodeRow, FlowRow } from "@/lib/flows/types";
import { type NodeType } from "./lib/constants";

import { useFlowState } from "./hooks/use-flow-state";
import { useFlowPersistence } from "./hooks/use-flow-persistence";
import { nodeTypes } from "./canvas/nodes";
import { edgeTypes } from "./canvas/edges";
import { Toolbar } from "./panels/toolbar";
import { NodeConfigPanel } from "./panels/node-config-panel";
import { ValidationPanel } from "./panels/validation-panel";
import { Sidebar } from "./panels/sidebar";

interface FlowBuilderProps {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
}

function FlowBuilderInner({ initialFlow, initialNodes }: FlowBuilderProps) {
  const router = useRouter();

  // 1. Centralized Flow State Hook
  const {
    nodes,
    edges,
    onNodesChange,
    state,
    setState,
    setStateDirty,
    dirty,
    setDirty,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    removeNode,
    updateNodeConfig,
    updateNodeKey,
    onConnect,
    issues,
    canActivate,
  } = useFlowState(initialFlow, initialNodes);

  // 2. Persistence Hook
  const { saving, activating, handleSave, handleStatus, handleDelete } =
    useFlowPersistence({
      flowId: initialFlow.id,
      state,
      setState,
      nodes,
      canActivate,
      setDirty,
    });

  // 3. React Flow instance hooks
  const { fitView, setCenter, getNode, screenToFlowPosition } = useReactFlow();

  // Fit view on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 150);
    return () => clearTimeout(timer);
  }, [fitView]);

  // 4. Handle HTML5 Drag and Drop Drop-to-Canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as NodeType;
      if (!type) return;

      // convert screen coordinates to flow canvas coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  // 5. Handle Node Selection/Canvas Interactions
  const onNodeClick = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  // 6. Node Config Panel Callbacks
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return state.nodes.find((n) => n.node_key === selectedNodeId) || null;
  }, [state.nodes, selectedNodeId]);

  const isSelectedEntry = selectedNodeId === state.entry_node_id;

  const selectedNodeIssues = useMemo(() => {
    return issues.filter(
      (i) => i.scope === "node" && i.node_key === selectedNodeId
    );
  }, [issues, selectedNodeId]);

  const onUpdateConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (selectedNodeId) {
        updateNodeConfig(selectedNodeId, patch);
      }
    },
    [selectedNodeId, updateNodeConfig]
  );

  const onUpdateKey = useCallback(
    (oldKey: string, newKey: string) => {
      updateNodeKey(oldKey, newKey);
    },
    [updateNodeKey]
  );

  const onRemoveNode = useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  }, [selectedNodeId, removeNode]);

  const onSetEntryNode = useCallback(() => {
    if (selectedNodeId) {
      setStateDirty((s) => ({ ...s, entry_node_id: selectedNodeId }));
    }
  }, [selectedNodeId, setStateDirty]);

  // 7. Autofocus/Jump-to-node from Validation Panel
  const jumpToNode = useCallback(
    (key: string) => {
      setSelectedNodeId(key);
      const reactFlowNode = getNode(key);
      if (reactFlowNode) {
        // Smoothly center the node on screen and zoom in slightly
        setCenter(reactFlowNode.position.x + 110, reactFlowNode.position.y + 60, {
          zoom: 1.15,
          duration: 800,
        });
      }
    },
    [setSelectedNodeId, getNode, setCenter]
  );

  // 8. Connection Disconnect Logic (Delete Edge Button)
  const disconnectEdge = useCallback(
    (edgeId: string) => {
      const parts = edgeId.split("->");
      if (parts.length < 3) return;
      const [sourceId, handle] = parts;

      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) return;

      const nodeType = sourceNode.data.node_type;

      if (nodeType === "condition") {
        if (handle === "true") {
          updateNodeConfig(sourceId, { true_next: "" });
        } else if (handle === "false") {
          updateNodeConfig(sourceId, { false_next: "" });
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
          buttons[idx] = { ...buttons[idx], next_node_key: "" };
          updateNodeConfig(sourceId, { buttons });
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
                  j === ri ? { ...r, next_node_key: "" } : r,
                ),
              };
            }
            count++;
          }
        }
        updateNodeConfig(sourceId, { sections });
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
          btnRoutes[idx] = { ...btnRoutes[idx], next_node_key: "" };
          updateNodeConfig(sourceId, { button_routes: btnRoutes });
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
          rowRoutes[idx] = { ...rowRoutes[idx], next_node_key: "" };
          updateNodeConfig(sourceId, { row_routes: rowRoutes });
        }
      } else {
        // Default: clear next_node_key
        updateNodeConfig(sourceId, { next_node_key: "" });
      }
    },
    [nodes, updateNodeConfig]
  );

  const edgesWithDelete = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onDelete: () => disconnectEdge(edge.id),
      },
    }));
  }, [edges, disconnectEdge]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 text-slate-800 font-sans">
      {/* 1. Left Component Sidebar */}
      <Sidebar onAddNode={(type) => addNode(type)} />

      {/* 2. Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header Toolbar */}
        <Toolbar
          state={state}
          setState={setStateDirty}
          dirty={dirty}
          saving={saving}
          activating={activating}
          canActivate={canActivate}
          triggerIssues={issues.filter((i) => i.scope === "trigger")}
          onSave={handleSave}
          onStatus={handleStatus}
          onDelete={handleDelete}
          onBack={() => router.push("/flows")}
          onViewRuns={() => router.push(`/flows/${initialFlow.id}/runs`)}
        />

        {/* Canvas & Sidebar */}
        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex-1 h-full">
            <ReactFlow
              nodes={nodes}
              edges={edgesWithDelete}
              onNodesChange={onNodesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{ type: "animated" }}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              fitView
              minZoom={0.15}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
              className="bg-slate-50"
            >
              {/* Dot Grid Background */}
              <Background color="#cbd5e1" gap={16} size={1.2} />

              {/* Canvas Controls */}
              <Controls className="!bg-white !border-slate-200 !text-slate-600 !shadow-md !rounded-lg" />

              {/* Floating Pipeline Stats */}
              <Panel position="top-right" className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-md min-w-[160px] z-10 select-none">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Flow Stats</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Nodes</span>
                    <span className="font-bold text-slate-800">{nodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-500" />Connections</span>
                    <span className="font-bold text-slate-800">{edges.length}</span>
                  </div>
                </div>
              </Panel>

              {/* Floating Submit Pipeline/Save Flow Button */}
              <Panel position="bottom-center" className="mb-4 z-10">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Workflow
                </button>
              </Panel>
            </ReactFlow>

            {/* Validation Banner (collapsible list overlay at the bottom) */}
            <div className="absolute bottom-4 left-4 z-10 max-w-sm rounded-lg">
              <ValidationPanel issues={issues} onJump={jumpToNode} />
            </div>
          </div>

          {/* Sidebar Config Panel */}
          <NodeConfigPanel
            node={selectedNode}
            allNodes={state.nodes}
            isEntry={isSelectedEntry}
            issues={selectedNodeIssues}
            onUpdateConfig={onUpdateConfig}
            onUpdateKey={onUpdateKey}
            onRemove={onRemoveNode}
            onSetEntry={onSetEntryNode}
            onClose={() => setSelectedNodeId(null)}
          />
        </div>
      </div>
    </div>
  );
}

export function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
