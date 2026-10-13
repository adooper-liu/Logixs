import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTemporaryDatabase } from "../../../tools/full-chain-demo/integration-support";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const PAYLOAD_HASH = "c".repeat(64);

async function createRun(prisma: any, tenantId: string, packageHash: string) {
  return prisma.fullChainLandingRun.create({
    data: {
      tenantId,
      packageHash,
      manifestVersion: "full-chain-package.v1",
      workbookVersion: "v0.5.1",
      compilerVersion: "full-chain-compiler.v1",
      mappingVersion: "full-chain-mapping.v0.5",
      policyVersion: "full-chain-policy.v0.5",
      sourceFingerprintHash: "d".repeat(64),
      state: "staged",
      inputCounts: {},
      appliedCounts: {},
      replayedCounts: {},
      rejectedCounts: {},
      gapCount: 0,
      checkCount: 0,
      actorId: "actor",
      traceId: randomUUID(),
      idempotencyKey: `landing:${packageHash}`,
    },
  });
}

async function seedTypedChain(
  prisma: any,
  input: { tenantId: string; packageHash: string; suffix: string },
) {
  const run = await createRun(prisma, input.tenantId, input.packageHash);
  const plan = await prisma.fullChainShipmentPlan.create({
    data: {
      tenantId: input.tenantId,
      landingRunId: run.id,
      planNumber: `PLAN-${input.suffix}`,
      payloadHash: PAYLOAD_HASH,
    },
  });
  const booking = await prisma.fullChainBookingCommitment.create({
    data: {
      tenantId: input.tenantId,
      landingRunId: run.id,
      shipmentPlanId: plan.id,
      bookingNumber: `BOOK-${input.suffix}`,
      displayGroupRefs: [],
      payloadHash: PAYLOAD_HASH,
    },
  });
  const masterBill = await prisma.fullChainBookingDocument.create({
    data: {
      tenantId: input.tenantId,
      landingRunId: run.id,
      bookingCommitmentId: booking.id,
      documentType: "mbl",
      documentNumber: `MBL-${input.suffix}`,
    },
  });
  const houseBill = await prisma.fullChainBookingDocument.create({
    data: {
      tenantId: input.tenantId,
      landingRunId: run.id,
      bookingCommitmentId: booking.id,
      documentType: "hbl",
      documentNumber: `HBL-${input.suffix}`,
      parentDocumentId: masterBill.id,
    },
  });
  const cargoReady = await prisma.fullChainCargoReadyRelease.create({
    data: {
      tenantId: input.tenantId,
      landingRunId: run.id,
      cargoReadyNumber: `CR-${input.suffix}`,
      displayGroupRef: `DISPLAY-${input.suffix}`,
      quantity: "1.000000",
      payloadHash: PAYLOAD_HASH,
    },
  });
  return { run, plan, booking, masterBill, houseBill, cargoReady };
}

function stuffingData(input: {
  tenantId: string;
  runId: string;
  cargoReadyId: string;
  houseBillId: string;
  suffix: string;
}) {
  return {
    tenantId: input.tenantId,
    landingRunId: input.runId,
    cargoReadyReleaseId: input.cargoReadyId,
    houseBillDocumentId: input.houseBillId,
    containerNumber: `CONT-${input.suffix}`,
    cargoReadyNumber: `CR-${input.suffix}`,
    sku: `SKU-${input.suffix}`,
    houseBillNumber: `HBL-${input.suffix}`,
    quantity: "1.000000",
    grossWeight: "2.000000",
    volume: "3.000000",
    payloadHash: PAYLOAD_HASH,
  };
}

describe("full-chain landing schema", () => {
  it("rejects a stuffing line whose cargo-ready or HBL belongs to another run", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const first = await seedTypedChain(prisma, {
        tenantId,
        packageHash: HASH_A,
        suffix: "A",
      });
      const second = await seedTypedChain(prisma, {
        tenantId,
        packageHash: HASH_B,
        suffix: "B",
      });

      await expect(
        (prisma as any).fullChainStuffingLine.create({
          data: stuffingData({
            tenantId,
            runId: first.run.id,
            cargoReadyId: second.cargoReady.id,
            houseBillId: second.houseBill.id,
            suffix: "B",
          }),
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects MBL use where an HBL is required", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const chain = await seedTypedChain(prisma, {
        tenantId,
        packageHash: HASH_A,
        suffix: "A",
      });

      await expect(
        (prisma as any).fullChainStuffingLine.create({
          data: stuffingData({
            tenantId,
            runId: chain.run.id,
            cargoReadyId: chain.cargoReady.id,
            houseBillId: chain.masterBill.id,
            suffix: "A",
          }),
        }),
      ).rejects.toThrow();
      await expect(
        (prisma as any).fullChainExportCustomsCase.create({
          data: {
            tenantId,
            landingRunId: chain.run.id,
            houseBillDocumentId: chain.masterBill.id,
            invoiceNumber: "INV-A",
            houseBillNumber: "MBL-A",
            declarationNumber: "DECL-A",
            amount: "1.000000",
            currency: "USD",
            payloadHash: PAYLOAD_HASH,
          },
        }),
      ).rejects.toThrow();
    });
  });

  it("enforces tenant business keys and one tenant-package run", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const first = await seedTypedChain(prisma, {
        tenantId,
        packageHash: HASH_A,
        suffix: "A",
      });

      await expect(createRun(prisma, tenantId, HASH_A)).rejects.toThrow();
      await expect(
        (prisma as any).fullChainShipmentPlan.create({
          data: {
            tenantId,
            landingRunId: first.run.id,
            planNumber: first.plan.planNumber,
            payloadHash: PAYLOAD_HASH,
          },
        }),
      ).rejects.toThrow();
    });
  });

  it("rejects an HBL whose parent is not an MBL in the same booking", async () => {
    await withTemporaryDatabase(async ({ prisma }) => {
      const tenantId = randomUUID();
      const chain = await seedTypedChain(prisma, {
        tenantId,
        packageHash: HASH_A,
        suffix: "A",
      });

      await expect(
        (prisma as any).fullChainBookingDocument.create({
          data: {
            tenantId,
            landingRunId: chain.run.id,
            bookingCommitmentId: chain.booking.id,
            documentType: "hbl",
            documentNumber: "HBL-BAD-PARENT",
            parentDocumentId: chain.houseBill.id,
          },
        }),
      ).rejects.toThrow();
    });
  });
});
