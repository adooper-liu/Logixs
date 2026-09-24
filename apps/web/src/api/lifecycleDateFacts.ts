import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

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

const IDENTITY_HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

export async function listLifecycleDateFacts(
  containerId: string,
): Promise<LifecycleDateFactProjection> {
  const response = await fetch(endpoint(containerId), {
    headers: IDENTITY_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "加载日期事实失败",
      ),
    );
  }
  return (await response.json()) as LifecycleDateFactProjection;
}

export async function recordLifecycleDateFact(
  containerId: string,
  input: RecordLifecycleDateFactInput,
): Promise<RecordLifecycleDateFactResult> {
  const response = await fetch(endpoint(containerId), {
    method: "POST",
    headers: { ...IDENTITY_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "提交日期事实失败",
      ),
    );
  }
  return (await response.json()) as RecordLifecycleDateFactResult;
}

function endpoint(containerId: string): string {
  return `/api/containers/${encodeURIComponent(containerId)}/date-facts`;
}
