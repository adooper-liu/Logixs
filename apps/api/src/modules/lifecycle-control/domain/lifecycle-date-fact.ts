import type {
  LifecycleDateFactCommand,
  LifecycleDateFactResult,
} from "@logix/contracts";

export type LifecycleDateApplicationState =
  LifecycleDateFactResult["applicationState"];

export type LifecycleLocationContext = NonNullable<
  LifecycleDateFactCommand["location"]
>;

export interface LifecycleDateFactRecord {
  id: string;
  tenantId: string;
  containerId: string;
  nodeCode: LifecycleDateFactCommand["nodeCode"];
  eventCode: LifecycleDateFactCommand["eventCode"];
  timeKind: LifecycleDateFactCommand["timeKind"];
  occurredAt: Date;
  rawValue: string;
  sourceUtcOffset: string;
  ingestionChannel: LifecycleDateFactCommand["ingestionChannel"];
  captureSource: LifecycleDateFactCommand["captureSource"];
  sourceSystem: string;
  authoritySystem: string;
  provider: string | null;
  interfaceCode: string | null;
  sourceEventId: string | null;
  mappingVersion: string | null;
  verificationState: LifecycleDateFactCommand["verificationState"];
  confidenceState: LifecycleDateFactCommand["confidenceState"];
  validity: LifecycleDateFactCommand["validity"];
  authorityPolicyRef: string | null;
  location: LifecycleLocationContext | null;
  evidenceRefs: string[];
  actorId: string | null;
  reasonCode: string | null;
  idempotencyKey: string;
  payloadHash: string;
  supersedesFactId: string | null;
  isCurrent: boolean;
  applicationState: LifecycleDateApplicationState;
  applicationReasonCode: string | null;
  canonicalEventId: string | null;
  projectionVersion: number;
  traceId: string;
  receivedAt: Date;
  recordedAt: Date;
}

export type LifecycleDateFactProjectionRecord = Pick<
  LifecycleDateFactRecord,
  | "containerId"
  | "nodeCode"
  | "eventCode"
  | "timeKind"
  | "occurredAt"
  | "verificationState"
  | "confidenceState"
  | "validity"
  | "authorityPolicyRef"
  | "applicationState"
>;

export interface AppendLifecycleDateFactInput extends Omit<
  LifecycleDateFactRecord,
  "projectionVersion" | "recordedAt" | "isCurrent"
> {
  expectedVersion?: number;
  completeInbox?: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

export interface AppendLifecycleDateFactResult {
  record: LifecycleDateFactRecord;
  duplicate: boolean;
}
