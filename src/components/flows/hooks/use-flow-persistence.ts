"use client";

/**
 * Persistence hook — save, activate/pause, and delete flows.
 *
 * Extracted from the monolith so the orchestrator stays lean and
 * the persistence logic can be tested or swapped independently.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Node } from "@xyflow/react";

import type { BuilderState } from "../lib/constants";
import { extractPositions, type FlowNodeData } from "../lib/graph-utils";

interface UseFlowPersistenceArgs {
  flowId: string;
  state: BuilderState;
  setState: React.Dispatch<React.SetStateAction<BuilderState>>;
  nodes: Node<FlowNodeData>[];
  canActivate: boolean;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseFlowPersistenceReturn {
  saving: boolean;
  activating: boolean;
  handleSave: () => Promise<void>;
  handleStatus: (next: BuilderState["status"]) => Promise<void>;
  handleDelete: () => Promise<void>;
}

export function useFlowPersistence({
  flowId,
  state,
  setState,
  nodes,
  canActivate,
  setDirty,
}: UseFlowPersistenceArgs): UseFlowPersistenceReturn {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const positions = extractPositions(nodes);

      // Merge positions into nodes for the save payload
      const nodesPayload = state.nodes.map((n) => {
        const pos = positions.find((p) => p.node_key === n.node_key);
        return {
          ...n,
          position_x: pos?.position_x ?? 0,
          position_y: pos?.position_y ?? 0,
        };
      });

      const res = await fetch(`/api/flows/${flowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: state.description || null,
          trigger_type: state.trigger_type,
          trigger_config: state.trigger_config,
          entry_node_id: state.entry_node_id,
          nodes: nodesPayload,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Save failed: ${res.status}`);
      }
      setDirty(false);
      toast.success("Saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [flowId, state, nodes, setDirty]);

  const handleStatus = useCallback(
    async (next: BuilderState["status"]) => {
      if (next === "active" && !canActivate) {
        toast.error("Fix the issues below before activating.");
        return;
      }
      setActivating(true);
      try {
        if (next === "active") {
          await handleSave();
        }
        const res = await fetch(`/api/flows/${flowId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            json.error ?? `Status update failed: ${res.status}`,
          );
        }
        setState((s) => ({ ...s, status: next }));
        toast.success(
          next === "active"
            ? "Flow activated."
            : next === "archived"
              ? "Archived."
              : "Saved as draft.",
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Status update failed";
        toast.error(msg);
      } finally {
        setActivating(false);
      }
    },
    [canActivate, handleSave, flowId, setState],
  );

  const handleDelete = useCallback(async () => {
    const yes = window.confirm(
      `Delete "${state.name}"? Any active runs end immediately. This can't be undone.`,
    );
    if (!yes) return;
    try {
      const res = await fetch(`/api/flows/${flowId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      router.push("/flows");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    }
  }, [flowId, router, state.name]);

  return { saving, activating, handleSave, handleStatus, handleDelete };
}
