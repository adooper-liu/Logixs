import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUserIdentity } from "../../identity";
import { createValidFullChainPackage } from "../test-support/full-chain-package.fixture";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";
import { ApplyFullChainPackageService } from "./apply-full-chain-package.service";

const TENANT = "rehearsal-tenant";
const RUN_ID = "00000000-0000-4000-8000-000000000001";
const identity = (
  tenantId = TENANT,
  capabilities = ["import.execute"],
): AuthenticatedUserIdentity => ({
  actorType: "user",
  actorId: "actor-1",
  tenantId,
  authenticationMethod: "oidc",
  roles: ["import_operator"],
  capabilities,
});

function dependencies() {
  const repository = {
    stage: vi.fn(async () => ({
      runId: RUN_ID,
      state: "staged",
      replayed: false,
    })),
    markReceiptPending: vi.fn(async () => undefined),
    markReconciling: vi.fn(async () => undefined),
    reconcile: vi.fn(async () => ({
      projectionHash: "a".repeat(64),
      factCounts: {
        shipment_plan: 1,
        booking_commitment: 1,
        cargo_ready_release: 1,
        stuffing_snapshot_line: 1,
        export_customs_case: 1,
        dispatch_fact: 1,
      },
      relationCounts: { planCargoReady: 1, dispatchHouseBill: 1 },
      receiptCount: 6,
      gapCount: 0,
      outboxCount: 0,
      businessTaskCount: 0,
    })),
    publish: vi.fn(async () => undefined),
    getStatus: vi.fn(async () => null),
    getChain: vi.fn(async () => null),
  };
  const receiptStore = {
    putIfAbsent: vi.fn(
      async (input: {
        tenantId: string;
        runId: string;
        body: string;
        digest: string;
      }) => {
        void input;
        return {
          keyHash: "b".repeat(64),
          digest: "c".repeat(64),
          replayed: false,
        };
      },
    ),
    readDigest: vi.fn(async (): Promise<string | null> => null),
    deleteOwnedKey: vi.fn(async () => undefined),
  };
  const isolationProbe = {
    capture: vi
      .fn()
      .mockResolvedValueOnce({
        targetTenantHash: "before",
        oldDemoTenantHash: "old",
        controlTenantHash: "control",
        globalReferenceHash: "global",
        targetReceiptDigest: null,
        minioOutsideHash: "outside",
        temporalHash: "temporal",
        landingOutboxCount: 0,
        businessTaskCount: 0,
      })
      .mockResolvedValueOnce({
        targetTenantHash: "after",
        oldDemoTenantHash: "old",
        controlTenantHash: "control",
        globalReferenceHash: "global",
        targetReceiptDigest: "c".repeat(64),
        minioOutsideHash: "outside",
        temporalHash: "temporal",
        landingOutboxCount: 0,
        businessTaskCount: 0,
      }),
    compare: vi.fn(() => ({
      targetChanged: true,
      receiptChanged: true,
      outboxDelta: 0,
    })),
  };
  return { repository, receiptStore, isolationProbe };
}

function command(user = identity()) {
  return {
    identity: user,
    artifacts: createValidFullChainPackage(),
    idempotencyKey: "request-1",
    traceId: "trace-1",
  };
}

describe("ApplyFullChainPackageService", () => {
  let deps: ReturnType<typeof dependencies>;
  let service: ApplyFullChainPackageService;

  beforeEach(() => {
    deps = dependencies();
    service = new ApplyFullChainPackageService(
      new FullChainLandingPolicy({
        rehearsalTenantId: TENANT,
        oldDemoTenantId: "demo-real-sample-20260921",
        controlTenantId: "control-tenant",
        prefixRoot: "rehearsal",
      }),
      deps.repository as never,
      deps.receiptStore,
      deps.isolationProbe,
      () => new Date("2026-10-13T00:00:00.000Z"),
    );
  });

  it.each([
    identity("demo-real-sample-20260921"),
    identity("another-tenant"),
    identity(TENANT, []),
  ])("rejects before dependencies are called", async (user) => {
    await expect(service.execute(command(user))).rejects.toThrow(
      /FULL_CHAIN_REHEARSAL_ACCESS_DENIED/,
    );
    expect(deps.repository.stage).not.toHaveBeenCalled();
    expect(deps.receiptStore.putIfAbsent).not.toHaveBeenCalled();
    expect(deps.isolationProbe.capture).not.toHaveBeenCalled();
  });

  it("stages, stores a redacted receipt, reconciles, and publishes", async () => {
    expect(await service.execute(command())).toMatchObject({
      runId: RUN_ID,
      state: "published",
      gapCount: 0,
    });
    expect(deps.repository.stage).toHaveBeenCalledTimes(1);
    expect(deps.receiptStore.putIfAbsent).toHaveBeenCalledTimes(1);
    const receiptBody = deps.receiptStore.putIfAbsent.mock.calls[0]![0].body;
    expect(receiptBody).not.toContain("PLAN-1");
    expect(receiptBody).not.toContain("rehearsal-tenant");
    expect(receiptBody).not.toContain(
      createValidFullChainPackage().manifest.packageHash,
    );
    expect(deps.repository.markReconciling).toHaveBeenCalledTimes(1);
    expect(deps.isolationProbe.compare).toHaveBeenCalledTimes(1);
    expect(deps.repository.publish).toHaveBeenCalledTimes(1);
  });

  it("returns a published replay without S3 or probe I/O", async () => {
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "published",
      replayed: true,
    });
    expect(await service.execute(command())).toMatchObject({
      runId: RUN_ID,
      state: "replayed",
    });
    expect(deps.receiptStore.putIfAbsent).not.toHaveBeenCalled();
    expect(deps.isolationProbe.capture).not.toHaveBeenCalled();
  });

  it("re-runs reconciliation before retrying a failed publish", async () => {
    deps.repository.publish
      .mockRejectedValueOnce(new Error("PUBLISH_TIMEOUT"))
      .mockResolvedValueOnce(undefined);
    await expect(service.execute(command())).rejects.toThrow(/PUBLISH_TIMEOUT/);
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      replayed: true,
    });
    deps.receiptStore.readDigest.mockResolvedValueOnce("c".repeat(64));
    deps.isolationProbe.capture.mockClear();
    deps.isolationProbe.capture
      .mockResolvedValueOnce({ targetTenantHash: "before" })
      .mockResolvedValueOnce({ targetTenantHash: "after" });

    expect(await service.execute(command())).toMatchObject({
      state: "published",
    });
    expect(deps.receiptStore.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(deps.repository.markReconciling).toHaveBeenCalledTimes(1);
    expect(deps.repository.reconcile).toHaveBeenCalledTimes(2);
    expect(deps.repository.publish).toHaveBeenCalledTimes(2);
  });

  it("marks receipt_pending and resumes the same run after object failure", async () => {
    deps.receiptStore.putIfAbsent
      .mockRejectedValueOnce(new Error("OBJECT_TIMEOUT"))
      .mockResolvedValueOnce({
        keyHash: "b".repeat(64),
        digest: "c".repeat(64),
        replayed: true,
      });
    await expect(service.execute(command())).rejects.toThrow(/OBJECT_TIMEOUT/);
    expect(deps.repository.markReceiptPending).toHaveBeenCalledWith({
      runId: RUN_ID,
      tenantId: TENANT,
      errorCode: "OBJECT_TIMEOUT",
    });
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "receipt_pending",
      replayed: true,
    });
    deps.isolationProbe.capture.mockClear();
    deps.isolationProbe.capture
      .mockResolvedValueOnce({ targetTenantHash: "before" })
      .mockResolvedValueOnce({ targetTenantHash: "after" });
    expect(await service.execute(command())).toMatchObject({
      state: "published",
    });
    expect(deps.repository.publish).toHaveBeenCalledTimes(1);
  });
});
