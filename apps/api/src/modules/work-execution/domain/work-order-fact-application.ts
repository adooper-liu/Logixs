import { createHash } from "node:crypto";
import type {
  CaptureSource,
  CanonicalEventCode,
  LifecycleNodeCode,
  WorkOrderState,
} from "@logix/contracts";
import { decideWorkOrderCompletion } from "./state-rules";

export type WorkOrderFactApplicationDecision = "applied" | "rejected" | "no_op";

export interface AppliedLifecycleWorkFact {
  tenantId: string;
  containerId: string;
  flowInstanceId: string;
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  canonicalEventId: string;
  eventCode: CanonicalEventCode;
  businessFactType: "lifecycle_date_fact" | "canonical_lifecycle_event";
  domainFactId: string;
  captureSource: CaptureSource;
  evidenceRefs: string[];
  occurredAt: Date;
}

export interface WorkOrderFactDecision {
  decision: WorkOrderFactApplicationDecision;
  reasonCode: string | null;
  previousState: WorkOrderState;
  resultingState: WorkOrderState;
}

export function lifecycleWorkBusinessFactKey(input: {
  canonicalEventId: string;
  nodeInstanceId: string;
}): string {
  return `lifecycle-node-application/${input.canonicalEventId}/${input.nodeInstanceId}`;
}

export function hashAppliedLifecycleWorkFact(
  input: AppliedLifecycleWorkFact,
): string {
  const canonical = JSON.stringify({
    tenantId: input.tenantId,
    containerId: input.containerId,
    flowInstanceId: input.flowInstanceId,
    nodeInstanceId: input.nodeInstanceId,
    nodeCode: input.nodeCode,
    canonicalEventId: input.canonicalEventId,
    eventCode: input.eventCode,
    businessFactType: input.businessFactType,
    domainFactId: input.domainFactId,
    captureSource: input.captureSource,
    evidenceRefs: [...new Set(input.evidenceRefs)].sort(),
    occurredAt: input.occurredAt.toISOString(),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function decideExistingFactApplication(
  existingRequestHash: string,
  incomingRequestHash: string,
): "replay" | "conflict" {
  return existingRequestHash === incomingRequestHash ? "replay" : "conflict";
}

export function decideWorkOrderFactApplication(
  currentState: WorkOrderState,
): WorkOrderFactDecision {
  const transition = decideWorkOrderCompletion(currentState);
  if (transition.kind === "apply") {
    return {
      decision: "applied",
      reasonCode: null,
      previousState: currentState,
      resultingState: "completed",
    };
  }
  if (transition.kind === "already_done") {
    return {
      decision: "no_op",
      reasonCode: "WORK_ORDER_ALREADY_COMPLETED",
      previousState: currentState,
      resultingState: currentState,
    };
  }
  return {
    decision: "rejected",
    reasonCode: "WORK_ORDER_STATE_NOT_COMPLETABLE",
    previousState: currentState,
    resultingState: currentState,
  };
}
