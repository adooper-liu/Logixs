import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../../../../../generated/prisma";
import { describe, expect, it } from "vitest";
import { buildFullChainLandingGraph } from "../domain/landing-graph";
import { createValidFullChainPackage } from "../test-support/full-chain-package.fixture";
import { withTemporaryDatabase } from "../../../tools/full-chain-demo/integration-support";
import { PrismaFullChainLandingRepository } from "./prisma-full-chain-landing.repository";

function stageInput(tenantId: string, idempotencyKey: string) {
  const artifacts = createValidFullChainPackage();
  return {
    tenantId,
    actorId: "actor-1",
    traceId: randomUUID(),
    idempotencyKey,
    manifest: artifacts.manifest,
    graph: buildFullChainLandingGraph(artifacts),
  };
}

async function counts(prisma: PrismaClient, tenantId: string) {
  const where = { tenantId };
  const values = await Promise.all([
    prisma.fullChainLandingRun.count({ where }),
    prisma.fullChainShipmentPlan.count({ where }),
    prisma.fullChainBookingCommitment.count({ where }),
    prisma.fullChainBookingDocument.count({ where }),
    prisma.fullChainCargoReadyRelease.count({ where }),
    prisma.fullChainShipmentPlanCargoReady.count({ where }),
    prisma.fullChainStuffingLine.count({ where }),
    prisma.fullChainExportCustomsCase.count({ where }),
    prisma.fullChainDispatchFact.count({ where }),
    prisma.fullChainDispatchHouseBill.count({ where }),
    prisma.fullChainLandingRecordReceipt.count({ where }),
    prisma.fullChainLandingGap.count({ where }),
  ]);
  return Object.fromEntries(
    [
      "fullChainLandingRun",
      "fullChainShipmentPlan",
      "fullChainBookingCommitment",
      "fullChainBookingDocument",
      "fullChainCargoReadyRelease",
      "fullChainShipmentPlanCargoReady",
      "fullChainStuffingLine",
      "fullChainExportCustomsCase",
      "fullChainDispatchFact",
      "fullChainDispatchHouseBill",
      "fullChainLandingRecordReceipt",
      "fullChainLandingGap",
    ].map((delegate, index) => [delegate, values[index]]),
  );
}

describe("PrismaFullChainLandingRepository", () => {
  it("stages atomically, replays concurrently, rejects conflicts, and reads only published chains", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const repository = new PrismaFullChainLandingRepository(prisma as never);
      const first = await repository.stage(stageInput(tenantId, "request-a"));

      expect(first).toMatchObject({ state: "staged", replayed: false });
      expect(await counts(prisma, tenantId)).toMatchObject({
        fullChainLandingRun: 1,
        fullChainShipmentPlan: 1,
        fullChainBookingCommitment: 1,
        fullChainBookingDocument: 2,
        fullChainCargoReadyRelease: 1,
        fullChainShipmentPlanCargoReady: 1,
        fullChainStuffingLine: 1,
        fullChainExportCustomsCase: 1,
        fullChainDispatchFact: 1,
        fullChainDispatchHouseBill: 1,
        fullChainLandingRecordReceipt: 6,
        fullChainLandingGap: 0,
      });
      expect(
        await repository.getChain({
          tenantId,
          runId: first.runId,
          planNumber: "PLAN-1",
        }),
      ).toBeNull();
      expect(
        await repository.getStatus({ tenantId, runId: first.runId }),
      ).toMatchObject({
        runId: first.runId,
        state: "staged",
        gapCount: 0,
      });
      await repository.markReceiptPending({
        tenantId,
        runId: first.runId,
        errorCode: "OBJECT_TIMEOUT",
      });
      expect(
        await repository.getStatus({ tenantId, runId: first.runId }),
      ).toMatchObject({
        state: "receipt_pending",
      });
      await repository.markReconciling({
        tenantId,
        runId: first.runId,
        receiptKeyHash: "a".repeat(64),
        receiptDigest: "b".repeat(64),
      });
      expect(
        await repository.getStatus({ tenantId, runId: first.runId }),
      ).toMatchObject({
        state: "reconciling",
      });

      const concurrent = await Promise.all([
        repository.stage(stageInput(tenantId, "request-b")),
        repository.stage(stageInput(tenantId, "request-c")),
      ]);
      expect(new Set(concurrent.map(({ runId }) => runId)).size).toBe(1);
      expect(concurrent.every(({ replayed }) => replayed)).toBe(true);
      expect(await counts(prisma, tenantId)).toMatchObject({
        fullChainLandingRun: 1,
        fullChainShipmentPlan: 1,
        fullChainBookingDocument: 2,
        fullChainLandingRecordReceipt: 6,
      });

      const conflictInput = stageInput(tenantId, "request-d");
      conflictInput.graph.packageHash = "f".repeat(64);
      conflictInput.manifest = {
        ...conflictInput.manifest,
        packageHash: "f".repeat(64),
      };
      conflictInput.graph.plans[0]!.payloadHash = "e".repeat(64);
      await expect(repository.stage(conflictInput)).rejects.toThrow(
        /FULL_CHAIN_BUSINESS_KEY_CONFLICT/,
      );
      expect(
        await prisma.fullChainLandingRun.count({ where: { tenantId } }),
      ).toBe(1);

      const reconciliation = await repository.reconcile({
        tenantId,
        runId: first.runId,
      });
      expect(reconciliation).toMatchObject({
        factCounts: {
          shipment_plan: 1,
          booking_commitment: 1,
          cargo_ready_release: 1,
          stuffing_snapshot_line: 1,
          export_customs_case: 1,
          dispatch_fact: 1,
        },
        outboxCount: 0,
        businessTaskCount: 0,
      });
      expect(reconciliation.projectionHash).toMatch(/^[a-f0-9]{64}$/u);
      await repository.publish({
        tenantId,
        runId: first.runId,
        reconciliation,
        traceId: "trace-publish",
      });
      await repository.publish({
        tenantId,
        runId: first.runId,
        reconciliation,
        traceId: "trace-publish-replay",
      });
      expect(
        await repository.getStatus({ tenantId, runId: first.runId }),
      ).toMatchObject({
        state: "published",
      });
      expect(
        await repository.getChain({
          tenantId,
          runId: first.runId,
          planNumber: "PLAN-1",
        }),
      ).toMatchObject({ planNumber: "PLAN-1" });
      expect(
        await prisma.outboxMessage.count({
          where: {
            tenantId,
            ownerModule: "full-chain-sample-landing",
            aggregateId: first.runId,
          },
        }),
      ).toBe(1);
      expect(await prisma.canonicalEvent.count({ where: { tenantId } })).toBe(
        0,
      );
      expect(await prisma.inboxMessage.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.nodeTask.count({ where: { tenantId } })).toBe(0);
    });
  }, 120_000);

  it("rolls back every row when staging fails after customs", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const repository = new PrismaFullChainLandingRepository(prisma as never, {
        failAfterRecordType: "export_customs_case",
      });

      await expect(
        repository.stage(stageInput(tenantId, "request-failure")),
      ).rejects.toThrow(/FULL_CHAIN_STAGE_INJECTED_FAILURE/);
      expect(await counts(prisma, tenantId)).toEqual({
        fullChainLandingRun: 0,
        fullChainShipmentPlan: 0,
        fullChainBookingCommitment: 0,
        fullChainBookingDocument: 0,
        fullChainCargoReadyRelease: 0,
        fullChainShipmentPlanCargoReady: 0,
        fullChainStuffingLine: 0,
        fullChainExportCustomsCase: 0,
        fullChainDispatchFact: 0,
        fullChainDispatchHouseBill: 0,
        fullChainLandingRecordReceipt: 0,
        fullChainLandingGap: 0,
      });
    });
  }, 120_000);
});
