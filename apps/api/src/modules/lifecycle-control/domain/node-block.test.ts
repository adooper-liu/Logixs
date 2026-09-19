import { describe, expect, it } from "vitest";
import type { LifecycleDateFactRecord } from "./lifecycle-date-fact";
import {
  decideNodeBlock,
  decideNodeBlockResolution,
  decideNodeBlockSourceFact,
} from "./node-block";

describe("node block rules", () => {
  it("只允许阻断当前 active 或 blocked 节点", () => {
    expect(
      decideNodeBlock({
        flowState: "active",
        currentNodeCode: "customs_clearance",
        nodeCode: "customs_clearance",
        nodeState: "active",
      }),
    ).toEqual({ kind: "apply" });
    expect(
      decideNodeBlock({
        flowState: "active",
        currentNodeCode: "customs_clearance",
        nodeCode: "container_pickup",
        nodeState: "pending",
      }),
    ).toMatchObject({ kind: "reject", code: "LIFECYCLE_NODE_NOT_CURRENT" });
  });

  it("只有核验有效的 actual 异常事实才能作为阻断来源", () => {
    expect(
      decideNodeBlockSourceFact({
        fact: sourceFact(),
        tenantId: "tenant-1",
        containerId: "container-1",
        nodeCode: "customs_clearance",
        blockType: "inspection",
        occurredAt: new Date("2026-09-20T01:00:00Z"),
        eventRole: "exception",
      }),
    ).toEqual({ kind: "apply" });
    expect(
      decideNodeBlockSourceFact({
        fact: { ...sourceFact(), confidenceState: "provisional" },
        tenantId: "tenant-1",
        containerId: "container-1",
        nodeCode: "customs_clearance",
        blockType: "inspection",
        occurredAt: new Date("2026-09-20T01:00:00Z"),
        eventRole: "exception",
      }),
    ).toMatchObject({
      kind: "reject",
      code: "NODE_BLOCK_SOURCE_FACT_NOT_QUALIFIED",
    });
    expect(
      decideNodeBlockSourceFact({
        fact: sourceFact(),
        tenantId: "tenant-1",
        containerId: "container-1",
        nodeCode: "customs_clearance",
        blockType: "hold",
        occurredAt: new Date("2026-09-20T01:00:00Z"),
        eventRole: "exception",
      }),
    ).toMatchObject({
      kind: "reject",
      code: "NODE_BLOCK_TYPE_SOURCE_MISMATCH",
    });
  });

  it("解除时间不得早于阻断事实", () => {
    expect(
      decideNodeBlockResolution({
        blockOccurredAt: new Date("2026-09-20T02:00:00Z"),
        resolvedAt: new Date("2026-09-20T01:59:59Z"),
      }),
    ).toMatchObject({
      kind: "reject",
      code: "NODE_BLOCK_RESOLUTION_TIME_CONFLICT",
    });
  });
});

function sourceFact(): LifecycleDateFactRecord {
  return {
    id: "fact-1",
    tenantId: "tenant-1",
    containerId: "container-1",
    nodeCode: "customs_clearance",
    eventCode: "inspection",
    timeKind: "actual",
    occurredAt: new Date("2026-09-20T01:00:00Z"),
    rawValue: "2026-09-20T01:00:00Z",
    sourceUtcOffset: "+00:00",
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix",
    authoritySystem: "customs",
    provider: null,
    interfaceCode: null,
    sourceEventId: null,
    mappingVersion: null,
    verificationState: "verified",
    confidenceState: "confirmed",
    validity: "effective",
    authorityPolicyRef: "customs-inspection-v1",
    evidenceRefs: ["evidence-1"],
    actorId: "actor-1",
    reasonCode: "inspection_notice",
    idempotencyKey: "fact-key",
    payloadHash: "hash",
    supersedesFactId: null,
    isCurrent: true,
    applicationState: "pending_application",
    applicationReasonCode: null,
    canonicalEventId: null,
    projectionVersion: 1,
    traceId: "trace-1",
    receivedAt: new Date("2026-09-20T01:00:01Z"),
    recordedAt: new Date("2026-09-20T01:00:01Z"),
  };
}
