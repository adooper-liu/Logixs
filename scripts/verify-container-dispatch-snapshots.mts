import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import {
  ContainerDispatchSnapshotConflictError,
  normalizeContainerDispatchSnapshotCommand,
} from "../apps/api/src/modules/shipment-registry/domain/container-dispatch-snapshot.js";
import { PrismaContainerDispatchSnapshotRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-dispatch-snapshot.repository.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const tenantId = `dispatch-verify-${randomUUID()}`;
const containerRecordId = randomUUID();
const allocationSetId = randomUUID();
const stuffingSnapshotId = randomUUID();
const evidenceId = randomUUID();

try {
  await prisma.containerRecord.create({
    data: {
      id: containerRecordId,
      tenantId,
      orderNumber: "DISPATCH-VERIFY",
      containerNumber: "KOCU4960726",
      currentStatus: "not_shipped",
    },
  });
  await prisma.containerCargoAllocationSet.create({
    data: {
      id: allocationSetId,
      tenantId,
      containerRecordId,
      version: 1,
      state: "active",
      ingestionChannel: "manual_ui",
      sourceSystem: "verification",
      evidenceRefs: [evidenceId],
      idempotencyKey: randomUUID(),
      payloadHash: "a".repeat(64),
    },
  });
  await prisma.containerStuffingSnapshot.create({
    data: {
      id: stuffingSnapshotId,
      tenantId,
      containerRecordId,
      version: 1,
      state: "active",
      allocationSetId,
      allocationSetVersion: 1,
      containerNumber: "KOCU4960726",
      sealNumber: "VERIFY-SEAL",
      packageCount: 10,
      grossWeight: "1000",
      grossWeightUnit: "KGM",
      volume: "20",
      volumeUnit: "MTQ",
      vgmWeight: "1050",
      vgmWeightUnit: "KGM",
      vgmMethod: "method_2",
      vgmVerifiedAt: new Date(),
      ingestionChannel: "manual_ui",
      sourceSystem: "verification",
      evidenceRefs: [evidenceId],
      actorId: "verification",
      reasonCode: "verification",
      idempotencyKey: randomUUID(),
      payloadHash: "b".repeat(64),
    },
  });

  const repository = new PrismaContainerDispatchSnapshotRepository(prisma);
  const first = command({ expectedVersion: 0, idempotencyKey: "dispatch-v1" });
  const created = await repository.replace(first);
  const duplicate = await repository.replace(first);
  assert(
    created.version === 1 && !created.duplicate,
    "first version was not created",
  );
  assert(
    duplicate.snapshotId === created.snapshotId && duplicate.duplicate,
    "idempotent replay failed",
  );

  const corrected = await repository.replace(
    command({
      expectedVersion: 1,
      idempotencyKey: "dispatch-v2",
      masterBillNumber: "NBOZ6N378300",
    }),
  );
  assert(corrected.version === 2, "correction did not append version 2");
  assert(
    (await prisma.containerDispatchSnapshot.count({
      where: { tenantId, containerRecordId, state: "active" },
    })) === 1,
    "more than one active dispatch snapshot exists",
  );

  let conflictObserved = false;
  try {
    await repository.replace(
      command({
        expectedVersion: 2,
        idempotencyKey: "dispatch-v2",
        bookingNumber: "DIFFERENT",
      }),
    );
  } catch (error) {
    conflictObserved = error instanceof ContainerDispatchSnapshotConflictError;
  }
  assert(
    conflictObserved,
    "same idempotency key with another payload was accepted",
  );

  console.log(
    "Container dispatch verified: append-only correction, idempotent replay, payload conflict and one-active constraints passed.",
  );
} finally {
  await prisma.containerDispatchSnapshot.deleteMany({ where: { tenantId } });
  await prisma.containerStuffingSnapshot.deleteMany({ where: { tenantId } });
  await prisma.containerCargoAllocationSet.deleteMany({ where: { tenantId } });
  await prisma.containerRecord.deleteMany({ where: { tenantId } });
  await prisma.$disconnect();
}

function command(overrides: {
  expectedVersion: number;
  idempotencyKey: string;
  bookingNumber?: string;
  masterBillNumber?: string | null;
}) {
  return normalizeContainerDispatchSnapshotCommand({
    tenantId,
    containerRecordId,
    expectedVersion: overrides.expectedVersion,
    stuffingSnapshotId,
    stuffingSnapshotVersion: 1,
    bookingNumber: overrides.bookingNumber ?? "BKG-VERIFY",
    carrierCode: "HMM",
    vesselName: "HMM LEAF",
    voyageNumber: "0002W",
    masterBillNumber: overrides.masterBillNumber ?? null,
    houseBillNumber: null,
    vgmHandoffState: "accepted",
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [evidenceId],
    actorId: "verification",
    reasonCode: "verification",
    idempotencyKey: overrides.idempotencyKey,
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
