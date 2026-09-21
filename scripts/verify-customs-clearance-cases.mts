import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import {
  CustomsClearanceCaseConflictError,
  normalizeCustomsClearanceCaseCommand,
} from "../apps/api/src/modules/customs-compliance/domain/customs-clearance-case.js";
import { PrismaCustomsClearanceCaseRepository } from "../apps/api/src/modules/customs-compliance/infrastructure/prisma-customs-clearance-case.repository.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const tenantId = `customs-verify-${randomUUID()}`;
const containerRecordId = randomUUID();
const brokerId = randomUUID();
const evidenceId = randomUUID();

try {
  await prisma.containerRecord.create({
    data: {
      id: containerRecordId,
      tenantId,
      orderNumber: "CUSTOMS-VERIFY",
      containerNumber: "KOCU4960726",
      currentStatus: "at_port",
    },
  });
  const repository = new PrismaCustomsClearanceCaseRepository(prisma);
  const first = command({ expectedVersion: 0, idempotencyKey: "customs-v1" });
  const created = await repository.replace(first);
  const duplicate = await repository.replace(first);
  assert(
    created.version === 1 && !created.duplicate,
    "first version was not created",
  );
  assert(
    duplicate.caseId === created.caseId && duplicate.duplicate,
    "idempotent replay failed",
  );

  const corrected = await repository.replace(
    command({
      expectedVersion: 1,
      idempotencyKey: "customs-v2",
      declarationNumber: "ENTRY-002",
    }),
  );
  assert(corrected.version === 2, "correction did not append version 2");
  assert(
    (await prisma.customsClearanceCase.count({
      where: { tenantId, containerRecordId, state: "active" },
    })) === 1,
    "more than one active customs case exists",
  );

  let conflictObserved = false;
  try {
    await repository.replace(
      command({
        expectedVersion: 2,
        idempotencyKey: "customs-v2",
        declarationNumber: "DIFFERENT",
      }),
    );
  } catch (error) {
    conflictObserved = error instanceof CustomsClearanceCaseConflictError;
  }
  assert(
    conflictObserved,
    "same idempotency key with another payload was accepted",
  );

  console.log(
    "Customs clearance verified: append-only correction, idempotent replay, payload conflict and one-active constraints passed.",
  );
} finally {
  await prisma.customsClearanceCase.deleteMany({ where: { tenantId } });
  await prisma.containerRecord.deleteMany({ where: { tenantId } });
  await prisma.$disconnect();
}

function command(overrides: {
  expectedVersion: number;
  idempotencyKey: string;
  declarationNumber?: string;
}) {
  return normalizeCustomsClearanceCaseCommand({
    tenantId,
    containerRecordId,
    expectedVersion: overrides.expectedVersion,
    jurisdictionCountryCode: "US",
    customsBrokerPartyId: brokerId,
    declarationNumber: overrides.declarationNumber ?? "ENTRY-001",
    filingState: "accepted",
    decisionState: "released",
    activeHoldCodes: [],
    ingestionChannel: "manual_ui",
    sourceSystem: "verification",
    evidenceRefs: [evidenceId],
    actorId: "verification",
    reasonCode: "CUSTOMS_RELEASE_CONFIRMED",
    idempotencyKey: overrides.idempotencyKey,
  });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
