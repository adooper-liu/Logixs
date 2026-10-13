import { describe, expect, it, vi } from "vitest";
import type { LandingIsolationSnapshot } from "../domain/landing-isolation-probe.port";
import { FullChainLandingIsolationProbe } from "./full-chain-landing-isolation.probe";

const SNAPSHOT: LandingIsolationSnapshot = {
  targetTenantHash: "target-before",
  oldDemoTenantHash: "old",
  controlTenantHash: "control",
  globalReferenceHash: "global",
  targetReceiptDigest: null,
  minioOutsideHash: "outside",
  temporalHash: "temporal",
  landingOutboxCount: 0,
  businessTaskCount: 0,
};

function probe() {
  return new FullChainLandingIsolationProbe({
    captureTargetTenantHash: vi.fn(async () => "target"),
    captureTenantHash: vi.fn(async (tenantId: string) => `tenant:${tenantId}`),
    captureGlobalReferenceHash: vi.fn(async () => "global"),
    captureTargetReceiptDigest: vi.fn(async () => null),
    captureMinioOutsideHash: vi.fn(async () => "outside"),
    captureTemporalHash: vi.fn(async () => "temporal"),
    countLandingOutbox: vi.fn(async () => 0),
    countBusinessTasks: vi.fn(async () => 0),
  });
}

describe("FullChainLandingIsolationProbe", () => {
  it("captures each isolation axis without mutation methods", async () => {
    const isolation = probe();
    const snapshot = await isolation.capture({
      targetTenantId: "target",
      oldDemoTenantId: "old-demo",
      controlTenantId: "control",
      targetPrefix: "rehearsal/target/run",
    });
    expect(snapshot).toEqual({
      targetTenantHash: "target",
      oldDemoTenantHash: "tenant:old-demo",
      controlTenantHash: "tenant:control",
      globalReferenceHash: "global",
      targetReceiptDigest: null,
      minioOutsideHash: "outside",
      temporalHash: "temporal",
      landingOutboxCount: 0,
      businessTaskCount: 0,
    });
    expect(isolation).not.toHaveProperty("pauseTemporal");
    expect(isolation).not.toHaveProperty("deletePrefix");
  });

  it("allows only target facts, one receipt, and one landing outbox", () => {
    expect(
      probe().compare(SNAPSHOT, {
        ...SNAPSHOT,
        targetTenantHash: "target-after",
        targetReceiptDigest: "receipt",
        landingOutboxCount: 1,
      }),
    ).toEqual({ targetChanged: true, receiptChanged: true, outboxDelta: 1 });
  });

  it.each([
    ["old demo", { oldDemoTenantHash: "changed" }],
    ["control tenant", { controlTenantHash: "changed" }],
    ["global references", { globalReferenceHash: "changed" }],
    ["MinIO outside target", { minioOutsideHash: "changed" }],
    ["Temporal", { temporalHash: "changed" }],
    ["business tasks", { businessTaskCount: 1 }],
    ["more than one outbox", { landingOutboxCount: 2 }],
  ])("rejects %s changes", (_label, change) => {
    expect(() =>
      probe().compare(SNAPSHOT, { ...SNAPSHOT, ...change }),
    ).toThrowError(/FULL_CHAIN_ISOLATION_VIOLATION/);
  });
});
