import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import { NODE_SEQUENCE } from "./node-status";

export type NodeEventApplicationState =
  "pending_application" | "applied" | "rejected";

export interface NodeEventApplicationGuardInput {
  targetNodeCode: LifecycleNodeCode;
  occurredAt: Date;
  nodes: Array<{
    nodeCode: LifecycleNodeCode;
    state: string;
    applicability: NodeApplicability;
    completedAt: Date | null;
  }>;
}

export type NodeEventApplicationDecision =
  | {
      kind: "apply";
      guardResults: string[];
    }
  | {
      kind: "pending_application" | "rejected";
      guardResults: string[];
      reasonCode: string;
    };

export function decideNodeEventApplication(
  input: NodeEventApplicationGuardInput,
): NodeEventApplicationDecision {
  const target = input.nodes.find(
    (node) => node.nodeCode === input.targetNodeCode,
  );
  if (!target) {
    return rejected("LIFECYCLE_GUARD_NOT_SATISFIED", []);
  }
  if (target.applicability === "optional_not_applicable") {
    return rejected("LIFECYCLE_GUARD_NOT_SATISFIED", ["TARGET_NODE_FOUND"]);
  }
  if (target.state === "completed") {
    return rejected("LIFECYCLE_HISTORY_SEALED", [
      "TARGET_NODE_FOUND",
      "TARGET_NODE_APPLICABLE",
    ]);
  }

  const targetSequence = NODE_SEQUENCE[input.targetNodeCode];
  const predecessors = input.nodes.filter(
    (node) => NODE_SEQUENCE[node.nodeCode] < targetSequence,
  );
  const incomplete = predecessors.filter(
    (node) =>
      node.applicability !== "optional_not_applicable" &&
      node.state !== "completed",
  );
  if (incomplete.length > 0) {
    return {
      kind: "pending_application",
      guardResults: ["TARGET_NODE_FOUND", "TARGET_NODE_APPLICABLE"],
      reasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
    };
  }

  const timeConflict = predecessors.some(
    (node) =>
      node.state === "completed" &&
      node.completedAt !== null &&
      node.completedAt > input.occurredAt,
  );
  if (timeConflict) {
    return rejected("LIFECYCLE_TIME_ORDER_CONFLICT", [
      "TARGET_NODE_FOUND",
      "TARGET_NODE_APPLICABLE",
      "PREDECESSOR_NODES_COMPLETED",
    ]);
  }

  return {
    kind: "apply",
    guardResults: [
      "TARGET_NODE_FOUND",
      "TARGET_NODE_APPLICABLE",
      "PREDECESSOR_NODES_COMPLETED",
      "ACTUAL_TIME_MONOTONIC",
    ],
  };
}

function rejected(
  reasonCode: string,
  guardResults: string[],
): NodeEventApplicationDecision {
  return { kind: "rejected", reasonCode, guardResults };
}
