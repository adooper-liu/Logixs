import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUserIdentity } from "../../identity";
import type { FullChainLandingStatus } from "../domain/full-chain-landing.repository";
import {
  buildFullChainLandingGraph,
  fullChainLandingProjectionHash,
} from "../domain/landing-graph";
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
  const order: string[] = [];
  const repository = {
    findByPackage: vi.fn(
      async (): Promise<FullChainLandingStatus | null> => null,
    ),
    stage: vi.fn(async () => {
      order.push("stage");
      return {
        runId: RUN_ID,
        state: "staged",
        replayed: false,
        createdAt: new Date("2026-10-13T00:00:00.000Z"),
      };
    }),
    markReceiptPending: vi.fn(async () => undefined),
    markReconciling: vi.fn(async () => true),
    reconcile: vi.fn(async () => ({
      projectionHash: "a".repeat(64),
      semanticHash: fullChainLandingProjectionHash(
        buildFullChainLandingGraph(createValidFullChainPackage()),
      ),
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
    getStatus: vi.fn(async (): Promise<FullChainLandingStatus | null> => null),
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
          digest: input.digest,
          replayed: false,
        };
      },
    ),
    readDigest: vi.fn(async (): Promise<string | null> => null),
    deleteOwnedKey: vi.fn(async () => undefined),
  };
  const before = {
    targetTenantHash: "before",
    oldDemoTenantHash: "old",
    controlTenantHash: "control",
    globalReferenceHash: "global",
    targetReceiptDigest: null,
    minioOutsideHash: "outside",
    temporalHash: "temporal",
    landingOutboxCount: 0,
    businessTaskCount: 0,
  };
  const staged = {
    ...before,
    targetTenantHash: "after",
  };
  const after = {
    ...staged,
    targetReceiptDigest: "c".repeat(64),
  };
  const published = {
    ...after,
    landingOutboxCount: 1,
  };
  const isolationProbe = {
    capture: vi.fn(async () => {
      const captureIndex = order.filter((item) => item === "capture").length;
      order.push("capture");
      return [before, staged, after, published][captureIndex] ?? published;
    }),
    compare: vi.fn(
      (
        left: { landingOutboxCount: number },
        right: { landingOutboxCount: number },
      ) => ({
        targetChanged: true,
        receiptChanged: true,
        outboxDelta: right.landingOutboxCount - left.landingOutboxCount,
      }),
    ),
  };
  return { repository, receiptStore, isolationProbe, order };
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

  let projectWorkbench: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deps = dependencies();
    projectWorkbench = vi.fn(async () => undefined);
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
      undefined,
      { project: projectWorkbench },
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
    expect(deps.order.slice(0, 2)).toEqual(["capture", "stage"]);
    expect(deps.receiptStore.putIfAbsent).toHaveBeenCalledTimes(1);
    const receiptBody = deps.receiptStore.putIfAbsent.mock.calls[0]![0].body;
    expect(receiptBody).not.toContain("PLAN-1");
    expect(receiptBody).not.toContain("rehearsal-tenant");
    expect(receiptBody).not.toContain(
      createValidFullChainPackage().manifest.packageHash,
    );
    expect(deps.repository.markReconciling).toHaveBeenCalledTimes(1);
    expect(deps.isolationProbe.compare).toHaveBeenCalledTimes(2);
    expect(deps.isolationProbe.capture).toHaveBeenCalledTimes(4);
    expect(deps.repository.publish).toHaveBeenCalledTimes(1);
    expect(projectWorkbench).toHaveBeenCalledWith({
      tenantId: TENANT,
      runId: RUN_ID,
      graph: expect.any(Object),
    });
  });

  it("returns a published replay without S3 or probe I/O", async () => {
    deps.repository.findByPackage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "published",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      receiptKeyHash: null,
      receiptDigest: null,
      publishedAt: new Date(),
    });
    expect(await service.execute(command())).toMatchObject({
      runId: RUN_ID,
      state: "replayed",
    });
    expect(deps.receiptStore.putIfAbsent).not.toHaveBeenCalled();
    expect(deps.isolationProbe.capture).not.toHaveBeenCalled();
    expect(projectWorkbench).toHaveBeenCalledWith({
      tenantId: TENANT,
      runId: RUN_ID,
      graph: expect.any(Object),
    });
  });

  it("projects when staging discovers an already-published concurrent run", async () => {
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "published",
      replayed: true,
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });

    expect(await service.execute(command())).toMatchObject({
      runId: RUN_ID,
      state: "replayed",
    });
    expect(projectWorkbench).toHaveBeenCalledWith({
      tenantId: TENANT,
      runId: RUN_ID,
      graph: expect.any(Object),
    });
    expect(deps.receiptStore.putIfAbsent).not.toHaveBeenCalled();
  });

  it("projects after a concurrent publisher wins reconciliation", async () => {
    deps.repository.markReconciling.mockResolvedValueOnce(false);
    deps.repository.getStatus.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "published",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      receiptKeyHash: "b".repeat(64),
      receiptDigest: "c".repeat(64),
      publishedAt: new Date(),
    });

    expect(await service.execute(command())).toMatchObject({
      runId: RUN_ID,
      state: "replayed",
    });
    expect(projectWorkbench).toHaveBeenCalledWith({
      tenantId: TENANT,
      runId: RUN_ID,
      graph: expect.any(Object),
    });
  });

  it("re-runs reconciliation before retrying a failed publish", async () => {
    deps.repository.publish
      .mockRejectedValueOnce(new Error("PUBLISH_TIMEOUT"))
      .mockResolvedValueOnce(undefined);
    await expect(service.execute(command())).rejects.toThrow(/PUBLISH_TIMEOUT/);
    const storedDigest = deps.receiptStore.putIfAbsent.mock.calls[0]![0].digest;
    deps.repository.findByPackage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      receiptKeyHash: "b".repeat(64),
      receiptDigest: storedDigest,
      publishedAt: null,
    });
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      replayed: true,
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });
    deps.repository.getStatus.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      receiptKeyHash: "b".repeat(64),
      receiptDigest: storedDigest,
      publishedAt: null,
    });
    deps.receiptStore.readDigest.mockResolvedValueOnce(storedDigest);
    const recoveryBefore = {
      targetTenantHash: "before",
      oldDemoTenantHash: "old",
      controlTenantHash: "control",
      globalReferenceHash: "global",
      targetReceiptDigest: storedDigest,
      minioOutsideHash: "outside",
      temporalHash: "temporal",
      landingOutboxCount: 0,
      businessTaskCount: 0,
    };
    deps.isolationProbe.capture.mockClear();
    deps.isolationProbe.capture
      .mockResolvedValueOnce(recoveryBefore)
      .mockResolvedValueOnce(recoveryBefore)
      .mockResolvedValueOnce({ ...recoveryBefore, landingOutboxCount: 1 });

    expect(await service.execute(command())).toMatchObject({
      state: "published",
    });
    expect(deps.receiptStore.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(deps.repository.markReconciling).toHaveBeenCalledTimes(1);
    expect(deps.repository.reconcile).toHaveBeenCalledTimes(2);
    expect(deps.repository.publish).toHaveBeenCalledTimes(2);
  });

  it("rejects relation-count or semantic-hash drift before publish", async () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());
    deps.repository.reconcile.mockResolvedValueOnce({
      ...(await deps.repository.reconcile()),
      semanticHash: fullChainLandingProjectionHash(graph),
      relationCounts: { planCargoReady: 0, dispatchHouseBill: 1 },
    });
    await expect(service.execute(command())).rejects.toThrow(
      /FULL_CHAIN_RECONCILIATION_FAILED/,
    );
    expect(deps.repository.publish).not.toHaveBeenCalled();

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
      undefined,
      { project: projectWorkbench },
    );
    deps.repository.reconcile.mockResolvedValueOnce({
      ...(await deps.repository.reconcile()),
      semanticHash: "f".repeat(64),
    });
    await expect(service.execute(command())).rejects.toThrow(
      /FULL_CHAIN_RECONCILIATION_FAILED/,
    );
    expect(deps.repository.publish).not.toHaveBeenCalled();
  });

  it("rejects a reconciling retry when object and persisted receipt digests differ", async () => {
    const graph = buildFullChainLandingGraph(createValidFullChainPackage());
    deps.repository.findByPackage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      receiptKeyHash: "b".repeat(64),
      receiptDigest: "c".repeat(64),
      publishedAt: null,
    });
    deps.repository.stage.mockResolvedValueOnce({
      runId: RUN_ID,
      state: "reconciling",
      replayed: true,
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });
    deps.receiptStore.readDigest.mockResolvedValueOnce("d".repeat(64));
    await expect(service.execute(command())).rejects.toThrow(
      /FULL_CHAIN_RECEIPT_CONFLICT/,
    );
    expect(deps.repository.publish).not.toHaveBeenCalled();
    expect(fullChainLandingProjectionHash(graph)).toMatch(/^[a-f0-9]{64}$/u);
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
      createdAt: new Date("2026-10-13T00:00:00.000Z"),
    });
    deps.isolationProbe.capture.mockClear();
    deps.isolationProbe.capture
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
        targetTenantHash: "after-stage",
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
        targetTenantHash: "after-stage",
        oldDemoTenantHash: "old",
        controlTenantHash: "control",
        globalReferenceHash: "global",
        targetReceiptDigest: "c".repeat(64),
        minioOutsideHash: "outside",
        temporalHash: "temporal",
        landingOutboxCount: 0,
        businessTaskCount: 0,
      })
      .mockResolvedValueOnce({
        targetTenantHash: "after-stage",
        oldDemoTenantHash: "old",
        controlTenantHash: "control",
        globalReferenceHash: "global",
        targetReceiptDigest: "c".repeat(64),
        minioOutsideHash: "outside",
        temporalHash: "temporal",
        landingOutboxCount: 1,
        businessTaskCount: 0,
      });
    expect(await service.execute(command())).toMatchObject({
      state: "published",
    });
    expect(deps.repository.publish).toHaveBeenCalledTimes(1);
  });
});
