import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import {
  ContainerUnloadingReportConflictError,
  normalizeContainerUnloadingReportCommand,
} from "../apps/api/src/modules/inland-fulfillment/domain/container-unloading-report.js";
import { PrismaContainerUnloadingReportRepository } from "../apps/api/src/modules/inland-fulfillment/infrastructure/prisma-container-unloading-report.repository.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const tenantId = `unloading-verify-${randomUUID()}`;
const containerRecordId = randomUUID();
const warehouseLocationId = randomUUID();
const evidenceId = randomUUID();

try {
  await prisma.containerRecord.create({
    data: {
      id: containerRecordId,
      tenantId,
      orderNumber: "UNLOADING-VERIFY",
      containerNumber: "KOCU4960726",
      currentStatus: "picked_up",
    },
  });
  const repository = new PrismaContainerUnloadingReportRepository(prisma);
  const first = command({
    expectedVersion: 0,
    idempotencyKey: "unloading-v1",
    operationState: "started",
    unloadedQuantity: "0",
    remainingQuantity: "524",
    completedAt: null,
  });
  const created = await repository.append(first);
  const duplicate = await repository.append(first);
  assert(
    created.version === 1 && !created.duplicate,
    "first report was not created",
  );
  assert(
    duplicate.reportId === created.reportId && duplicate.duplicate,
    "idempotent replay failed",
  );

  const partial = await repository.append(
    command({
      expectedVersion: 1,
      idempotencyKey: "unloading-v2",
      operationState: "partial",
      unloadedQuantity: "300",
      remainingQuantity: "224",
      completedAt: null,
    }),
  );
  const completed = await repository.append(
    command({
      expectedVersion: 2,
      idempotencyKey: "unloading-v3",
      operationState: "completed",
      unloadedQuantity: "524",
      remainingQuantity: "0",
      completedAt: "2026-04-23T08:30:00.000Z",
    }),
  );
  assert(
    partial.version === 2 && completed.version === 3,
    "state progression did not append versions",
  );
  assert(
    (await prisma.containerUnloadingReport.count({
      where: { tenantId, containerRecordId, state: "active" },
    })) === 1,
    "more than one active unloading report exists",
  );
  assert(
    (await prisma.sourceAuthorityPolicy.count({
      where: { eventCode: "unloaded", tenantScope: null, timeKind: "actual" },
    })) >= 1,
    "unloaded source authority baseline is missing",
  );

  let conflictObserved = false;
  try {
    await repository.append(
      command({
        expectedVersion: 3,
        idempotencyKey: "unloading-v3",
        operationState: "completed",
        unloadedQuantity: "523",
        remainingQuantity: "0",
        shortageQuantity: "1",
        completedAt: "2026-04-23T08:30:00.000Z",
        exceptionResolved: true,
        exceptionNotes: "短少一箱，仓方已确认",
      }),
    );
  } catch (error) {
    conflictObserved = error instanceof ContainerUnloadingReportConflictError;
  }
  assert(
    conflictObserved,
    "same idempotency key with another payload was accepted",
  );
  console.log(
    "Container unloading reports verified: started/partial/completed progression, idempotent replay, payload conflict, one-active constraint and authority policy passed.",
  );
} finally {
  await prisma.containerUnloadingReport.deleteMany({ where: { tenantId } });
  await prisma.containerRecord.deleteMany({ where: { tenantId } });
  await prisma.$disconnect();
}

function command(overrides: {
  expectedVersion: number;
  idempotencyKey: string;
  operationState: "started" | "partial" | "completed";
  unloadedQuantity: string;
  remainingQuantity: string;
  completedAt: string | null;
  shortageQuantity?: string;
  exceptionResolved?: boolean;
  exceptionNotes?: string | null;
}) {
  return normalizeContainerUnloadingReportCommand({
    tenantId,
    containerRecordId,
    expectedVersion: overrides.expectedVersion,
    warehouseLocationId,
    operationState: overrides.operationState,
    startedAt: "2026-04-23T06:00:00.000Z",
    completedAt: overrides.completedAt,
    expectedQuantity: "524",
    unloadedQuantity: overrides.unloadedQuantity,
    remainingQuantity: overrides.remainingQuantity,
    damagedQuantity: "0",
    shortageQuantity: overrides.shortageQuantity ?? "0",
    quantityUnit: "carton",
    sealCheck: "matched",
    exceptionResolved: overrides.exceptionResolved ?? false,
    exceptionNotes: overrides.exceptionNotes ?? null,
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [evidenceId],
    actorId: "verification",
    reasonCode: `unloading_${overrides.operationState}`,
    idempotencyKey: overrides.idempotencyKey,
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
