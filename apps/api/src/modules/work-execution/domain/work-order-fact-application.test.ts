import { describe, expect, it } from "vitest";
import {
  decideExistingFactApplication,
  decideWorkOrderFactApplication,
  hashAppliedLifecycleWorkFact,
  lifecycleWorkBusinessFactKey,
  type AppliedLifecycleWorkFact,
} from "./work-order-fact-application";

const FACT: AppliedLifecycleWorkFact = {
  tenantId: "tenant-1",
  containerId: "container-1",
  flowInstanceId: "flow-1",
  nodeInstanceId: "node-1",
  nodeCode: "container_unloading",
  canonicalEventId: "event-1",
  eventCode: "unloaded",
  businessFactType: "lifecycle_date_fact",
  domainFactId: "fact-1",
  captureSource: "external_evidence",
  evidenceRefs: ["evidence-b", "evidence-a"],
  occurredAt: new Date("2026-09-21T08:00:00.000Z"),
};

describe("lifecycle work fact identity", () => {
  it("uses the canonical event and target node as the stable business key", () => {
    expect(lifecycleWorkBusinessFactKey(FACT)).toBe(
      "lifecycle-node-application/event-1/node-1",
    );
  });

  it("hashes equivalent evidence sets identically", () => {
    const first = hashAppliedLifecycleWorkFact(FACT);
    const second = hashAppliedLifecycleWorkFact({
      ...FACT,
      evidenceRefs: ["evidence-a", "evidence-b", "evidence-a"],
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("distinguishes a replay from the same key with a different payload", () => {
    const requestHash = hashAppliedLifecycleWorkFact(FACT);
    expect(decideExistingFactApplication(requestHash, requestHash)).toBe(
      "replay",
    );
    expect(decideExistingFactApplication(requestHash, "0".repeat(64))).toBe(
      "conflict",
    );
  });
});

describe("decideWorkOrderFactApplication", () => {
  it.each(["ready", "in_progress", "blocked", "reopened"] as const)(
    "allows an authoritative fact to complete %s",
    (state) => {
      expect(decideWorkOrderFactApplication(state)).toEqual({
        decision: "applied",
        reasonCode: null,
        previousState: state,
        resultingState: "completed",
      });
    },
  );

  it("returns no-op for an already completed work order", () => {
    expect(decideWorkOrderFactApplication("completed")).toEqual({
      decision: "no_op",
      reasonCode: "WORK_ORDER_ALREADY_COMPLETED",
      previousState: "completed",
      resultingState: "completed",
    });
  });

  it.each(["draft", "failed", "cancelled"] as const)(
    "rejects %s instead of forcing completion",
    (state) => {
      expect(decideWorkOrderFactApplication(state)).toEqual({
        decision: "rejected",
        reasonCode: "WORK_ORDER_STATE_NOT_COMPLETABLE",
        previousState: state,
        resultingState: state,
      });
    },
  );
});
