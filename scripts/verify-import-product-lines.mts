import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaReplenishmentOrderImportWriter } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-replenishment-order-import-writer.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const databaseName = new URL(connectionString).pathname.slice(1);
if (!databaseName.includes("verify")) {
  throw new Error(
    "Refusing to write to a database without 'verify' in its name",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const writer = new PrismaReplenishmentOrderImportWriter(prisma as never);

const baseCommand = {
  tenantId: "tenant-a",
  sourceBatchId: "batch-bad",
  orderNumber: "SO-VERIFY",
  containerNumber: "MSKU-VERIFY",
  lines: [
    {
      sourceRowId: "row-bad",
      productNumber: "SKU-BAD",
      shippedQuantity: "1",
      quantityUnit: "invalid",
      contractNumber: null,
    },
  ],
  timeFacts: [],
};

try {
  const initialCounts = await Promise.all([
    prisma.replenishmentOrder.count(),
    prisma.containerRecord.count(),
    prisma.replenishmentOrderLine.count(),
  ]);
  if (initialCounts.some((count) => count !== 0)) {
    throw new Error(`Verification database is not empty: ${initialCounts}`);
  }

  let invalidWriteRejected = false;
  try {
    await writer.apply(baseCommand as never);
  } catch {
    invalidWriteRejected = true;
  }
  if (!invalidWriteRejected) throw new Error("Invalid unit was accepted");

  const rolledBackCounts = await Promise.all([
    prisma.replenishmentOrder.count(),
    prisma.containerRecord.count(),
    prisma.replenishmentOrderLine.count(),
  ]);
  if (rolledBackCounts.some((count) => count !== 0)) {
    throw new Error(`Transaction did not roll back: ${rolledBackCounts}`);
  }

  let invalidActualRejected = false;
  try {
    await writer.apply({
      ...baseCommand,
      sourceBatchId: "batch-invalid-actual",
      lines: [
        {
          sourceRowId: "row-invalid-actual",
          productNumber: "SKU-INVALID-ACTUAL",
          shippedQuantity: "1",
          quantityUnit: "piece",
          contractNumber: null,
        },
      ],
      timeFacts: [
        {
          sourceRowId: "row-invalid-actual",
          factCode: "customs_clearance_completed",
          timeKind: "actual",
          captureSource: "controlled_import",
          eventCode: "container_customs_completed",
          rawValue: "2026-04-09 22:58:00",
          occurredAtUtc: new Date("2026-04-09T20:58:00Z"),
          sourceUtcOffset: "+02:00",
          sourceSystem: "legacy-lms",
          sourceStatus: "已完成",
          evidenceRef: null,
          derivationRuleVersion: null,
        },
      ],
    } as never);
  } catch {
    invalidActualRejected = true;
  }
  if (!invalidActualRejected) {
    throw new Error("Actual time fact without evidence was accepted");
  }
  const invalidActualCounts = await Promise.all([
    prisma.replenishmentOrder.count(),
    prisma.containerRecord.count(),
    prisma.replenishmentOrderLine.count(),
    prisma.shipmentTimeFact.count(),
  ]);
  if (invalidActualCounts.some((count) => count !== 0)) {
    throw new Error(
      `Invalid actual fact did not roll back aggregate: ${invalidActualCounts}`,
    );
  }

  await writer.apply({
    ...baseCommand,
    sourceBatchId: "batch-a",
    lines: [
      {
        sourceRowId: "row-a1",
        productNumber: "SKU-A1",
        shippedQuantity: "10",
        quantityUnit: "piece",
        contractNumber: null,
      },
      {
        sourceRowId: "row-a2",
        productNumber: "SKU-A2",
        shippedQuantity: "20",
        quantityUnit: "carton",
        contractNumber: "C-A2",
      },
    ],
    timeFacts: [
      {
        sourceRowId: "row-a1",
        factCode: "customs_clearance_completed",
        timeKind: "actual",
        captureSource: "controlled_import",
        eventCode: "container_customs_completed",
        rawValue: "2026-04-09 22:58:00",
        occurredAtUtc: new Date("2026-04-09T20:58:00Z"),
        sourceUtcOffset: "+02:00",
        sourceSystem: "legacy-lms",
        sourceStatus: "已完成",
        evidenceRef: "11111111-1111-4111-8111-111111111111",
        derivationRuleVersion: null,
      },
      {
        sourceRowId: "row-a1",
        factCode: "container_empty_estimated",
        timeKind: "estimated",
        captureSource: "system_derived",
        eventCode: null,
        rawValue: "2026-04-23 09:19:30",
        occurredAtUtc: new Date("2026-04-23T07:19:30Z"),
        sourceUtcOffset: "+02:00",
        sourceSystem: "legacy-lms",
        sourceStatus: null,
        evidenceRef: null,
        derivationRuleVersion: "legacy-empty-date-v1",
      },
    ],
  });
  await writer.apply({
    ...baseCommand,
    tenantId: "tenant-b",
    sourceBatchId: "batch-b",
    containerNumber: "MSKU-B",
    lines: [
      {
        sourceRowId: "row-b1",
        productNumber: "SKU-B1",
        shippedQuantity: "30",
        quantityUnit: "set",
        contractNumber: null,
      },
    ],
    timeFacts: [],
  });

  const [orders, containers, lines, facts, wrongStatus] = await Promise.all([
    prisma.replenishmentOrder.count(),
    prisma.containerRecord.count(),
    prisma.replenishmentOrderLine.count(),
    prisma.shipmentTimeFact.count(),
    prisma.containerRecord.count({
      where: { currentStatus: { not: "not_shipped" } },
    }),
  ]);
  if (
    orders !== 2 ||
    containers !== 2 ||
    lines !== 3 ||
    facts !== 2 ||
    wrongStatus !== 0
  ) {
    throw new Error(
      `Unexpected committed counts: ${orders},${containers},${lines},${facts},${wrongStatus}`,
    );
  }

  const persistedFacts = await prisma.shipmentTimeFact.findMany({
    orderBy: { factCode: "asc" },
  });
  const actual = persistedFacts.find(({ timeKind }) => timeKind === "actual");
  const estimated = persistedFacts.find(
    ({ timeKind }) => timeKind === "estimated",
  );
  if (
    actual?.evidenceRef !== "11111111-1111-4111-8111-111111111111" ||
    actual.occurredAtUtc.toISOString() !== "2026-04-09T20:58:00.000Z" ||
    estimated?.captureSource !== "system_derived" ||
    estimated.derivationRuleVersion !== "legacy-empty-date-v1"
  ) {
    throw new Error("Time-fact provenance was not preserved");
  }

  console.log(
    `Import integration passed: ${orders} orders, ${containers} containers, ${lines} lines, ${facts} time facts`,
  );
} finally {
  await prisma.$disconnect();
}
