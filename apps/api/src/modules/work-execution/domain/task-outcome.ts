import { createHash } from "node:crypto";
import type {
  CanonicalEventCode,
  LifecycleNodeCode,
  NodeTaskState,
  WorkOrderState,
} from "@logix/contracts";

export const FIRST_SLICE_COMPLETION_POLICY = "all_required_completed";
export type ResultPolicyMode =
  "none" | "emit_canonical_event" | "reference_existing_event";

export interface NodeTaskOutcomeDraft {
  previousState: NodeTaskState;
  nextState: NodeTaskState;
  resultPolicyMode: ResultPolicyMode;
  eventCode: CanonicalEventCode | null;
  policySnapshotHash: string;
  requiredWorkOrderIds: string[];
  completedWorkOrderIds: string[];
  evaluatedFactRefs?: string[];
  canonicalEventId?: string;
  domainFactId?: string;
  actorOrServiceId?: string;
  traceId?: string;
}

export interface NodeResultPolicy {
  mode: ResultPolicyMode;
  eventCode: CanonicalEventCode | null;
}

export function resultPolicyForNode(
  nodeCode: LifecycleNodeCode,
): NodeResultPolicy {
  void nodeCode;
  // 工单完成只证明工作已执行，不等于对应业务事实已经实际发生并被采信。
  // 规范事件只能由统一日期事实链在来源权威裁决后申请。
  return { mode: "none", eventCode: null };
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
  factCausation?: {
    factApplicationIds: string[];
    canonicalEventId: string;
    eventCode: CanonicalEventCode;
    domainFactId: string;
    actorOrServiceId: string;
    traceId: string;
  };
}): NodeTaskOutcomeDraft | null {
  if (input.nextState !== "completed") return null;
  if (input.previousState === "completed") return null;

  const policy: NodeResultPolicy = input.factCausation
    ? {
        mode: "reference_existing_event",
        eventCode: input.factCausation.eventCode,
      }
    : resultPolicyForNode(input.nodeCode);
  const outcome: NodeTaskOutcomeDraft = {
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
  if (input.factCausation) {
    outcome.evaluatedFactRefs = [
      ...new Set(input.factCausation.factApplicationIds),
    ].sort();
    outcome.canonicalEventId = input.factCausation.canonicalEventId;
    outcome.domainFactId = input.factCausation.domainFactId;
    outcome.actorOrServiceId = input.factCausation.actorOrServiceId;
    outcome.traceId = input.factCausation.traceId;
  }
  return outcome;
}
