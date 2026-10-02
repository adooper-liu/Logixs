import { requestJson } from "./httpClient";

export interface LifecycleDateFact {
  factId: string;
  nodeCode: string;
  eventCode: string;
  timeKind: string;
  occurredAt: string;
  rawValue: string;
  sourceUtcOffset: string;
  ingestionChannel: string;
  captureSource: string;
  sourceSystem: string;
  authoritySystem: string;
  verificationState: string;
  confidenceState: string;
  validity: string;
  authorityPolicyRef: string | null;
  location: LifecycleLocation | null;
  evidenceRefs: readonly string[];
  applicationState: string;
  applicationReasonCode: string | null;
  canonicalEventId: string | null;
  projectionVersion: number;
  recordedAt: string;
}

export interface LifecycleLocation {
  locationType:
    "port" | "terminal" | "rail_yard" | "warehouse" | "depot" | "in_transit";
  unlocode?: string;
  locationId?: string;
  segmentId?: string;
  portCallId?: string;
  timezone: string;
}

export interface LifecycleDateFactProjection {
  items: readonly LifecycleDateFact[];
  projectionVersion: number;
  asOf: string;
}

export interface RecordLifecycleDateFactInput {
  nodeCode: string;
  eventCode: string;
  timeKind: "planned" | "estimated" | "actual";
  occurredAt: string;
  rawValue: string;
  sourceUtcOffset: string;
  authoritySystem: string;
  location?: LifecycleLocation;
  evidenceRefs: string[];
  reasonCode: string;
  expectedVersion: number;
  supersedesFactId?: string;
  idempotencyKey: string;
}

export interface RecordLifecycleDateFactResult {
  factId: string;
  recordState: "recorded" | "duplicate";
  applicationState: string;
  reasonCode: string | null;
  canonicalEventId: string | null;
  projectionVersion: number;
}

export async function listLifecycleDateFacts(
  containerId: string,
): Promise<LifecycleDateFactProjection> {
  return requestJson<LifecycleDateFactProjection>(endpoint(containerId), {
    fallback: "加载日期事实失败",
  });
}

export async function recordLifecycleDateFact(
  containerId: string,
  input: RecordLifecycleDateFactInput,
): Promise<RecordLifecycleDateFactResult> {
  return requestJson<RecordLifecycleDateFactResult>(endpoint(containerId), {
    method: "POST",
    body: input,
    fallback: "提交日期事实失败",
  });
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/date-facts`;
}
