import { createHash } from "node:crypto";
import type {
  CanonicalEventCode,
  LifecycleNodeCode,
  NodeTaskState,
  WorkOrderState,
} from "@logix/contracts";

export const FIRST_SLICE_COMPLETION_POLICY = "all_required_completed";
export type ResultPolicyMode = "none" | "emit_canonical_event";

export interface NodeTaskOutcomeDraft {
  previousState: NodeTaskState;
  nextState: NodeTaskState;
  resultPolicyMode: ResultPolicyMode;
  eventCode: CanonicalEventCode | null;
  policySnapshotHash: string;
  requiredWorkOrderIds: string[];
  completedWorkOrderIds: string[];
}

export interface NodeResultPolicy {
  mode: ResultPolicyMode;
  eventCode: CanonicalEventCode | null;
}

// 权威：canonical-events.json 的 completionEligibleNodeCodes。
// 海关/放行等专业事件不在此列。工单完成按 GC-005 §7 视为同语义人工事实，只申请事件，不直写流程。
const FIRST_SLICE_EMIT: Partial<Record<LifecycleNodeCode, CanonicalEventCode>> =
  {
    container_stuffing: "stuffed",
    shipment_dispatch: "loaded",
    origin_departure: "departed",
  };

export function resultPolicyForNode(
  nodeCode: LifecycleNodeCode,
): NodeResultPolicy {
  const eventCode = FIRST_SLICE_EMIT[nodeCode];
  if (!eventCode) return { mode: "none", eventCode: null };
  return { mode: "emit_canonical_event", eventCode };
}

export function policySnapshotHash(mode: ResultPolicyMode): string {
  return createHash("sha256")
    .update(`${FIRST_SLICE_COMPLETION_POLICY}:v1:${mode}`)
    .digest("hex");
}

export function firstSlicePolicySnapshotHash(): string {
  return policySnapshotHash("none");
}

export function decideTaskOutcome(input: {
  previousState: NodeTaskState;
  nextState: NodeTaskState;
  nodeCode: LifecycleNodeCode;
  workOrders: Array<{ id: string; state: WorkOrderState }>;
}): NodeTaskOutcomeDraft | null {
  if (input.nextState !== "completed") return null;
  if (input.previousState === "completed") return null;

  const policy = resultPolicyForNode(input.nodeCode);
  return {
    previousState: input.previousState,
    nextState: input.nextState,
    resultPolicyMode: policy.mode,
    eventCode: policy.eventCode,
    policySnapshotHash: policySnapshotHash(policy.mode),
    requiredWorkOrderIds: input.workOrders.map((workOrder) => workOrder.id),
    completedWorkOrderIds: input.workOrders
      .filter((workOrder) => workOrder.state === "completed")
      .map((workOrder) => workOrder.id),
  };
}
