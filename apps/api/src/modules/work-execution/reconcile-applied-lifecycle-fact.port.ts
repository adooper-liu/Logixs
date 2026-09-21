import type {
  CaptureSource,
  CanonicalEventCode,
  LifecycleNodeCode,
  NodeTaskState,
} from "@logix/contracts";

export const RECONCILE_APPLIED_LIFECYCLE_FACT = Symbol.for(
  "logix.ReconcileAppliedLifecycleFact",
);

export interface ReconcileAppliedLifecycleFactCommand {
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
  receivedAt: Date;
  actorOrServiceId: string;
  traceId: string;
  idempotencyKey: string;
}

export interface ReconcileAppliedLifecycleFactResult {
  nodeTaskId: string | null;
  factApplicationIds: string[];
  decision: "applied" | "rejected" | "no_op";
  taskState: NodeTaskState | null;
  outcomeId: string | null;
  reasonCode: string | null;
}

export interface ReconcileAppliedLifecycleFactPort {
  execute(
    command: ReconcileAppliedLifecycleFactCommand,
  ): Promise<ReconcileAppliedLifecycleFactResult>;
}
