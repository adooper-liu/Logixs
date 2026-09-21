import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import {
  WarehouseDeliveryInstructionConflictError,
  normalizeWarehouseDeliveryInstructionCommand,
} from "../apps/api/src/modules/inland-fulfillment/domain/warehouse-delivery-instruction.js";
import { PrismaWarehouseDeliveryInstructionRepository } from "../apps/api/src/modules/inland-fulfillment/infrastructure/prisma-warehouse-delivery-instruction.repository.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const tenantId = `delivery-verify-${randomUUID()}`;
const containerRecordId = randomUUID();
const warehouseLocationId = randomUUID();
const evidenceId = randomUUID();

try {
  await prisma.containerRecord.create({
    data: {
      id: containerRecordId,
      tenantId,
      orderNumber: "DELIVERY-VERIFY",
      containerNumber: "KOCU4960726",
      currentStatus: "picked_up",
    },
  });
  const repository = new PrismaWarehouseDeliveryInstructionRepository(prisma);
  const first = command({ expectedVersion: 0, idempotencyKey: "delivery-v1" });
  const created = await repository.replace(first);
  const duplicate = await repository.replace(first);
  assert(
    created.version === 1 && !created.duplicate,
    "first version was not created",
  );
  assert(
    duplicate.instructionId === created.instructionId && duplicate.duplicate,
    "idempotent replay failed",
  );

  const corrected = await repository.replace(
    command({
      expectedVersion: 1,
      idempotencyKey: "delivery-v2",
      warehouseCode: "VLS-2",
    }),
  );
  assert(corrected.version === 2, "correction did not append version 2");
  assert(
    (await prisma.warehouseDeliveryInstruction.count({
      where: { tenantId, containerRecordId, state: "active" },
    })) === 1,
    "more than one active instruction exists",
  );
  assert(
    (await prisma.sourceAuthorityPolicy.count({
      where: {
        eventCode: { in: ["delivered", "warehouse_arrival"] },
        tenantScope: null,
        timeKind: "actual",
      },
    })) >= 2,
    "delivery source authority baselines are missing",
  );

  let conflictObserved = false;
  try {
    await repository.replace(
      command({
        expectedVersion: 2,
        idempotencyKey: "delivery-v2",
        warehouseCode: "DIFFERENT",
      }),
    );
  } catch (error) {
    conflictObserved =
      error instanceof WarehouseDeliveryInstructionConflictError;
  }
  assert(
    conflictObserved,
    "same idempotency key with another payload was accepted",
  );
  console.log(
    "Warehouse delivery instruction verified: append-only correction, idempotent replay, payload conflict and one-active constraints passed.",
  );
} finally {
  await prisma.warehouseDeliveryInstruction.deleteMany({ where: { tenantId } });
  await prisma.containerRecord.deleteMany({ where: { tenantId } });
  await prisma.$disconnect();
}

function command(overrides: {
  expectedVersion: number;
  idempotencyKey: string;
  warehouseCode?: string;
}) {
  return normalizeWarehouseDeliveryInstructionCommand({
    tenantId,
    containerRecordId,
    expectedVersion: overrides.expectedVersion,
    warehouseLocationId,
    warehouseCode: overrides.warehouseCode ?? "VLS",
    warehouseName: "Barcelona VLS",
    unlocode: "ESBCN",
    timezone: "Europe/Madrid",
    appointmentStartAt: "2026-04-23T06:00:00.000Z",
    appointmentEndAt: "2026-04-23T08:00:00.000Z",
    appointmentReference: "APT-260423-01",
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [evidenceId],
    actorId: "verification",
    reasonCode: "delivery_instruction_confirmed",
    idempotencyKey: overrides.idempotencyKey,
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
