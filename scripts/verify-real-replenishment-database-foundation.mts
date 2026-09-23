import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import type { ShipmentHandoffCommandV1 } from "@logix/contracts";
import { preflightShipmentHandoff } from "../apps/api/src/modules/shipment-lifecycle-orchestration/domain/shipment-handoff-preflight.js";
import { PrismaShipmentHandoffAcceptanceRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-shipment-handoff-acceptance.repository.js";
import { ShipmentHandoffAcceptanceConflictError } from "../apps/api/src/modules/shipment-registry/domain/shipment-handoff-acceptance.js";
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260922090000_real_replenishment_database_foundation";
const realTenantId = "demo-real-sample-20260921";
const legacySyntheticTenantId = "dev-tenant";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

await verifyExistingDataUpgrade(connectionString);
await verifyEmptyDatabaseAndSeed(connectionString);

async function verifyExistingDataUpgrade(url: string): Promise<void> {
  await withTemporaryDatabase(url, "upgrade", async (targetUrl) => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "logix-real-upgrade-"));
    try {
      const configPath = prepareLegacyMigrationFixture(fixtureRoot);
      deployLegacyMigrations(configPath, targetUrl);
      const legacy = createPrisma(targetUrl);
      const orderId = `legacy-order-${randomUUID()}`;
      const lineId = `legacy-line-${randomUUID()}`;
      const containerId = `legacy-container-${randomUUID()}`;
      try {
        await legacy.$executeRaw`
          INSERT INTO "replenishment_order" (
            "id", "tenant_id", "order_number", "created_at", "updated_at"
          ) VALUES (
            ${orderId}, 'legacy-real-tenant', 'LEGACY-REAL-ORDER',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        await legacy.$executeRaw`
          INSERT INTO "replenishment_order_line" (
            "id", "tenant_id", "replenishment_order_id", "product_number",
            "shipped_quantity", "quantity_unit", "source_batch_id",
            "source_row_id", "is_current", "version", "created_at", "updated_at"
          ) VALUES (
            ${lineId}, 'legacy-real-tenant', ${orderId}, 'LEGACY-SKU', 2,
            'piece', ${randomUUID()}, 'row-1', true, 1,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
        await legacy.$executeRaw`
          INSERT INTO "container_record" (
            "id", "tenant_id", "order_number", "replenishment_order_id",
            "current_status", "created_at", "updated_at"
          ) VALUES (
            ${containerId}, 'legacy-real-tenant', 'LEGACY-REAL-ORDER',
            ${orderId}, 'not_shipped', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `;
      } finally {
        await legacy.$disconnect();
      }

      deployCurrentMigrations(targetUrl);
      const upgraded = createPrisma(targetUrl);
      try {
        const line = await upgraded.replenishmentOrderLine.findUniqueOrThrow({
          where: { id: lineId },
        });
        if (
          line.containsBattery !== null ||
          line.containsRefrigerant !== null ||
          line.phytosanitaryRequired !== null ||
          line.commodityInspectionRequired !== null ||
          line.domesticMarkupAmount !== null ||
          line.replenishmentFobUnitPrice !== null ||
          line.negotiationFobUnitPrice !== null
        ) {
          throw new Error("Migration invented values for historical lines");
        }
      } finally {
        await upgraded.$disconnect();
      }
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
  console.log(
    "Real replenishment verified: existing rows upgrade with nullable fields unchanged.",
  );
}

async function verifyEmptyDatabaseAndSeed(url: string): Promise<void> {
  await withTemporaryDatabase(url, "empty", async (targetUrl) => {
    deployCurrentMigrations(targetUrl);
    runPnpmCommand("db:seed", targetUrl);
    await downgradeRealSeedIdentityForReplay(targetUrl);
    runPnpmCommand("db:seed", targetUrl);

    const prisma = createPrisma(targetUrl);
    try {
      await verifyRealSample(prisma);
      await verifyLineConstraints(prisma);
      await verifyLegacyTenantReference(prisma);
      await verifyImportBindingConstraints(prisma);
      await verifySyntheticManyToMany(prisma);
      await verifyPostDepartureShipmentConstraints(prisma);
      await verifyShipmentHandoffAcceptance(prisma);
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Real replenishment verified: empty migration, idempotent seed, constraints, real totals and N:M relationships passed.",
  );
}

async function verifyShipmentHandoffAcceptance(
  prisma: PrismaClient,
): Promise<void> {
  const tenantId = "74000000-0000-4000-8000-000000000001";
  const actorId = "74000000-0000-4000-8000-000000000002";
  const command: ShipmentHandoffCommandV1 = {
    contractVersion: "shipment-handoff.v1",
    tenantId,
    sourceProfile: "api_v1",
    source: {
      channel: "api",
      system: "shipment-verification",
      externalHandoffId: "handoff-acceptance-1",
      handoffVersion: 1,
      occurredAt: "2026-09-23T03:00:00Z",
      idempotencyKey: "shipment-verification:handoff-acceptance-1:1",
      correlationId: "74000000-0000-4000-8000-000000000003",
      traceId: "trace-shipment-acceptance-1",
    },
    shipment: {
      externalShipmentId: "shipment-acceptance-1",
      shipmentNumber: "SHP-ACCEPTANCE-1",
      transportMode: "ocean",
      carrierCode: "HMM",
      vesselName: "ONE TRUTH",
      voyageNumber: "V001",
      originPortCode: "CNNGB",
      destinationPortCode: "USLAX",
      destinationCountryCode: "US",
      estimatedArrivalAt: "2026-10-10T03:00:00Z",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-23T02:00:00Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "74000000-0000-4000-8000-000000000004",
      },
    },
    billsOfLading: [
      {
        referenceId: "mbl-1",
        documentType: "mbl",
        documentNumber: "MBL-ACCEPTANCE-1",
        version: 1,
      },
      {
        referenceId: "hbl-1",
        documentType: "hbl",
        documentNumber: "HBL-ACCEPTANCE-1",
        parentReferenceId: "mbl-1",
        version: 1,
      },
    ],
    containers: [
      acceptanceContainer(
        "container-1",
        "external-container-1",
        "TSTU1234567",
        "4",
      ),
      acceptanceContainer(
        "container-2",
        "external-container-2",
        "TSTU7654321",
        "6",
      ),
    ],
    evidenceReferences: ["74000000-0000-4000-8000-000000000004"],
  };
  const prepared = preflightShipmentHandoff(command);
  if (prepared.result.decision !== "ready") {
    throw new Error("Shipment Handoff verification fixture was not ready");
  }
  const repository = new PrismaShipmentHandoffAcceptanceRepository(
    prisma as never,
  );
  const accepted = await repository.commit({
    actorId,
    command: prepared.command,
    preflight: prepared.result,
  });
  if (
    accepted.businessDecisionState !== "accepted" ||
    accepted.commitState !== "committed" ||
    accepted.containerResults.length !== 2 ||
    accepted.cargoResults.length !== 1 ||
    accepted.documentResults.length !== 2 ||
    !accepted.shipmentId
  ) {
    throw new Error("Shipment Handoff result did not reconcile every object");
  }

  const [shipment, cargo, allocations, documentLinks, handoff, outbox] =
    await Promise.all([
      prisma.shipment.findUniqueOrThrow({
        where: { id: accepted.shipmentId },
        include: { containerLinks: true },
      }),
      prisma.shipmentCargoLine.findFirstOrThrow({
        where: { shipmentId: accepted.shipmentId },
      }),
      prisma.containerCargoAllocation.count({
        where: { shipmentCargoLine: { shipmentId: accepted.shipmentId } },
      }),
      prisma.shipmentContainerDocumentLink.count({
        where: { shipmentId: accepted.shipmentId },
      }),
      prisma.shipmentHandoffRecord.findUniqueOrThrow({
        where: { id: accepted.handoffId },
      }),
      prisma.outboxMessage.findFirstOrThrow({
        where: {
          tenantId,
          aggregateType: "shipment",
          aggregateId: accepted.shipmentId,
        },
      }),
    ]);
  if (
    shipment.containerLinks.length !== 2 ||
    cargo.quantity.toString() !== "10" ||
    allocations !== 2 ||
    documentLinks !== 4 ||
    handoff.lifecycleRequestJson === null ||
    outbox.payloadRef !== `shipment-handoff-lifecycle/${accepted.handoffId}`
  ) {
    throw new Error("Shipment Handoff atomic facts are incomplete");
  }

  const duplicate = await repository.commit({
    actorId,
    command: prepared.command,
    preflight: prepared.result,
  });
  if (!duplicate.duplicate || duplicate.receptionState !== "duplicate") {
    throw new Error("Shipment Handoff identical replay was not idempotent");
  }
  const handoffCount = await prisma.shipmentHandoffRecord.count({
    where: { tenantId },
  });
  if (handoffCount !== 1) {
    throw new Error("Shipment Handoff replay wrote duplicate facts");
  }

  const changed = preflightShipmentHandoff({
    ...command,
    shipment: { ...command.shipment, voyageNumber: "V002" },
  });
  let changedPayloadRejected = false;
  try {
    await repository.commit({
      actorId,
      command: changed.command,
      preflight: changed.result,
    });
  } catch (error) {
    if (
      error instanceof ShipmentHandoffAcceptanceConflictError &&
      error.message === "IDEMPOTENCY_PAYLOAD_CONFLICT"
    ) {
      changedPayloadRejected = true;
    } else {
      throw error;
    }
  }
  if (!changedPayloadRejected) {
    throw new Error("Shipment Handoff accepted a changed idempotent payload");
  }

  const correctionCommand: ShipmentHandoffCommandV1 = {
    ...command,
    source: {
      ...command.source,
      handoffVersion: 2,
      supersedesExternalHandoffId: command.source.externalHandoffId,
      occurredAt: "2026-09-23T04:00:00Z",
      idempotencyKey: "shipment-verification:handoff-acceptance-1:2",
      traceId: "trace-shipment-acceptance-2",
    },
    shipment: { ...command.shipment, expectedRelationshipVersion: 1 },
    billsOfLading: command.billsOfLading.map((document) => ({
      ...document,
      version: 2,
    })) as ShipmentHandoffCommandV1["billsOfLading"],
    containers: [
      acceptanceContainer(
        "container-1",
        "external-container-1",
        "TSTU1234567",
        "5",
        "2",
      ),
      acceptanceContainer(
        "container-2",
        "external-container-2",
        "TSTU7654321",
        "8",
        "2",
      ),
    ],
  };
  const preparedCorrection = preflightShipmentHandoff(correctionCommand);
  if (preparedCorrection.result.decision !== "ready") {
    throw new Error("Shipment Handoff correction fixture was not ready");
  }
  const corrected = await repository.commit({
    actorId,
    command: preparedCorrection.command,
    preflight: preparedCorrection.result,
  });
  if (
    corrected.shipmentId !== accepted.shipmentId ||
    corrected.handoffVersion !== 2 ||
    corrected.businessDecisionState !== "accepted"
  ) {
    throw new Error("Shipment Handoff correction changed stable identity");
  }
  const [correctedShipment, handoffs, cargoVersions, linkVersions, references] =
    await Promise.all([
      prisma.shipment.findUniqueOrThrow({
        where: { id: accepted.shipmentId },
      }),
      prisma.shipmentHandoffRecord.findMany({
        where: { tenantId },
        orderBy: { handoffVersion: "asc" },
      }),
      prisma.shipmentCargoLine.findMany({
        where: { tenantId, shipmentId: accepted.shipmentId },
        orderBy: { version: "asc" },
      }),
      prisma.shipmentContainerLink.findMany({
        where: { tenantId, shipmentId: accepted.shipmentId },
      }),
      prisma.shipmentUpstreamReference.findMany({
        where: { tenantId, shipmentId: accepted.shipmentId },
      }),
    ]);
  const activeCargo = cargoVersions.find(({ state }) => state === "active");
  if (
    correctedShipment.relationshipVersion !== 2 ||
    handoffs.length !== 2 ||
    handoffs[0]?.status !== "superseded" ||
    handoffs[0].supersededAt === null ||
    handoffs[1]?.supersedesHandoffId !== handoffs[0].id ||
    cargoVersions.length !== 2 ||
    cargoVersions[0]?.state !== "superseded" ||
    activeCargo?.version !== 2 ||
    activeCargo.quantity.toString() !== "13" ||
    linkVersions.filter(({ state }) => state === "active").length !== 2 ||
    linkVersions.filter(({ state }) => state === "superseded").length !== 2 ||
    references.filter(({ state }) => state === "active").length !== 2 ||
    references.filter(({ state }) => state === "superseded").length !== 2
  ) {
    throw new Error("Shipment Handoff correction did not preserve versions");
  }
  const [documentVersions, allocationSets, lifecycleRequests] =
    await Promise.all([
      prisma.shipmentTransportDocument.findMany({
        where: { tenantId, shipmentId: accepted.shipmentId },
      }),
      prisma.containerCargoAllocationSet.findMany({
        where: {
          tenantId,
          containerRecord: {
            shipmentLinks: { some: { shipmentId: accepted.shipmentId } },
          },
        },
      }),
      prisma.outboxMessage.findMany({
        where: {
          tenantId,
          aggregateType: "shipment",
          aggregateId: accepted.shipmentId,
          eventType: "shipment.lifecycle_initialization_requested",
        },
      }),
    ]);
  if (
    documentVersions.filter(({ state }) => state === "active").length !== 2 ||
    documentVersions.filter(({ state }) => state === "superseded").length !==
      2 ||
    allocationSets.filter(({ state }) => state === "active").length !== 2 ||
    allocationSets.filter(({ state }) => state === "superseded").length !== 2 ||
    lifecycleRequests.length !== 2
  ) {
    throw new Error("Shipment Handoff correction facts are incomplete");
  }

  const duplicateCorrection = await repository.commit({
    actorId,
    command: preparedCorrection.command,
    preflight: preparedCorrection.result,
  });
  if (!duplicateCorrection.duplicate) {
    throw new Error("Shipment Handoff correction replay was not idempotent");
  }

  const removalCorrection = preflightShipmentHandoff({
    ...correctionCommand,
    source: {
      ...correctionCommand.source,
      handoffVersion: 3,
      occurredAt: "2026-09-23T05:00:00Z",
      idempotencyKey: "shipment-verification:handoff-acceptance-1:3",
      traceId: "trace-shipment-acceptance-3",
    },
    shipment: {
      ...correctionCommand.shipment,
      expectedRelationshipVersion: 2,
    },
    containers: [
      acceptanceContainer(
        "container-1",
        "external-container-1",
        "TSTU1234567",
        "7",
        "3",
      ),
    ],
  });
  const removed = await repository.commit({
    actorId,
    command: removalCorrection.command,
    preflight: removalCorrection.result,
  });
  const [afterRemovalShipment, activeLinks, activeAllocationSets, activeLines] =
    await Promise.all([
      prisma.shipment.findUniqueOrThrow({ where: { id: accepted.shipmentId } }),
      prisma.shipmentContainerLink.count({
        where: { tenantId, shipmentId: accepted.shipmentId, state: "active" },
      }),
      prisma.containerCargoAllocationSet.count({
        where: {
          tenantId,
          state: "active",
          containerRecord: {
            shipmentLinks: { some: { shipmentId: accepted.shipmentId } },
          },
        },
      }),
      prisma.shipmentCargoLine.findMany({
        where: { tenantId, shipmentId: accepted.shipmentId, state: "active" },
      }),
    ]);
  if (
    removed.businessDecisionState !== "accepted" ||
    afterRemovalShipment.relationshipVersion !== 3 ||
    activeLinks !== 1 ||
    activeAllocationSets !== 1 ||
    activeLines.length !== 1 ||
    activeLines[0]?.version !== 3 ||
    activeLines[0].quantity.toString() !== "7" ||
    (await prisma.shipmentTransportDocument.count({
      where: { tenantId, shipmentId: accepted.shipmentId },
    })) !== 4
  ) {
    throw new Error(
      "Shipment Handoff removal correction left active stale facts",
    );
  }

  await prisma.shipment.update({
    where: { id: accepted.shipmentId },
    data: { currentLifecycleStatus: "in_transit", lifecycleVersion: 2 },
  });
  const lateCorrection = preflightShipmentHandoff({
    ...removalCorrection.command,
    source: {
      ...removalCorrection.command.source,
      handoffVersion: 4,
      occurredAt: "2026-09-23T06:00:00Z",
      idempotencyKey: "shipment-verification:handoff-acceptance-1:4",
      traceId: "trace-shipment-acceptance-4",
    },
    shipment: {
      ...removalCorrection.command.shipment,
      expectedRelationshipVersion: 3,
    },
  });
  try {
    await repository.commit({
      actorId,
      command: lateCorrection.command,
      preflight: lateCorrection.result,
    });
  } catch (error) {
    if (
      error instanceof ShipmentHandoffAcceptanceConflictError &&
      error.message === "SHIPMENT_HANDOFF_CORRECTION_AFTER_LIFECYCLE_PROGRESS"
    ) {
      return;
    }
    throw error;
  }
  throw new Error("Shipment Handoff corrected facts after lifecycle progress");
}

function acceptanceContainer(
  referenceId: string,
  externalContainerId: string,
  containerNumber: string,
  quantity: string,
  sourceVersion?: string,
): ShipmentHandoffCommandV1["containers"][number] {
  return {
    referenceId,
    externalContainerId,
    containerNumber,
    containerTypeCode: "40HQ",
    billReferences: ["mbl-1", "hbl-1"],
    upstreamReferences: [
      {
        referenceType: "shipping_plan",
        sourceSystem: "shipment-verification",
        sourceRecordId: "shipping-plan-1",
        sourceVersion,
      },
    ],
    cargoAllocations: [
      {
        sourceLineId: "cargo-line-1",
        productNumber: "SKU-ACCEPTANCE-1",
        quantity,
        quantityUnit: "piece",
      },
    ],
  };
}

async function downgradeRealSeedIdentityForReplay(url: string): Promise<void> {
  const prisma = createPrisma(url);
  try {
    const [container, line, allocationSet] = await Promise.all([
      prisma.containerRecord.findFirstOrThrow({
        where: { tenantId: realTenantId, containerNumber: "HMMU4956442" },
        select: { id: true },
      }),
      prisma.replenishmentOrderLine.findFirstOrThrow({
        where: { tenantId: realTenantId },
        orderBy: { sourceRowId: "asc" },
        select: { id: true },
      }),
      prisma.containerCargoAllocationSet.findFirstOrThrow({
        where: { tenantId: realTenantId },
        select: { id: true },
      }),
    ]);
    await prisma.$transaction([
      prisma.containerRecord.update({
        where: { id: container.id },
        data: { id: "demo-container-hmmu4956442" },
      }),
      prisma.replenishmentOrderLine.update({
        where: { id: line.id },
        data: { id: "demo-line-26dsc01812-legacy" },
      }),
      prisma.containerCargoAllocationSet.update({
        where: { id: allocationSet.id },
        data: { evidenceRefs: ["legacy/document/path.json"] },
      }),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyRealSample(prisma: PrismaClient): Promise<void> {
  const [
    orderCount,
    containerCount,
    legacySyntheticContainerCount,
    skuCount,
    lines,
    importRowCount,
    allocationSets,
    containerNumberIndex,
    lineColumns,
    relevantConstraints,
    importBindingIndexes,
  ] = await Promise.all([
    prisma.replenishmentOrder.count({ where: { tenantId: realTenantId } }),
    prisma.containerRecord.count({ where: { tenantId: realTenantId } }),
    prisma.containerRecord.count({
      where: { tenantId: legacySyntheticTenantId },
    }),
    prisma.productSku.count({ where: { tenantId: realTenantId } }),
    prisma.replenishmentOrderLine.findMany({
      where: { tenantId: realTenantId },
      select: {
        id: true,
        productSkuId: true,
        shippedQuantity: true,
        commodityInspectionRequired: true,
        containsBattery: true,
        containsRefrigerant: true,
        phytosanitaryRequired: true,
        domesticMarkupAmount: true,
        replenishmentFobUnitPrice: true,
        negotiationFobUnitPrice: true,
      },
    }),
    prisma.importRow.count({
      where: { batch: { tenantId: realTenantId } },
    }),
    prisma.containerCargoAllocationSet.findMany({
      where: { tenantId: realTenantId },
      include: {
        containerRecord: { select: { id: true, containerNumber: true } },
        allocations: { select: { allocatedQuantity: true } },
      },
    }),
    prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT "indexname"
      FROM "pg_indexes"
      WHERE "schemaname" = 'public'
        AND "tablename" = 'container_record'
        AND "indexname" = 'container_record_tenant_number_idx'
    `,
    prisma.$queryRaw<
      Array<{
        column_name: string;
        data_type: string;
        numeric_precision: number | null;
        numeric_scale: number | null;
        is_nullable: string;
      }>
    >`
      SELECT "column_name", "data_type", "numeric_precision", "numeric_scale", "is_nullable"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = 'replenishment_order_line'
        AND "column_name" IN (
          'contains_battery', 'contains_refrigerant',
          'phytosanitary_required', 'commodity_inspection_required',
          'domestic_markup_amount', 'domestic_markup_currency',
          'replenishment_fob_unit_price', 'replenishment_fob_currency',
          'negotiation_fob_unit_price', 'negotiation_fob_currency'
        )
    `,
    prisma.$queryRaw<Array<{ conname: string; definition: string }>>`
      SELECT "conname", pg_get_constraintdef("oid") AS "definition"
      FROM "pg_constraint"
      WHERE "conrelid" IN (
        'public.replenishment_order_line'::regclass,
        'public.container_record'::regclass
      )
        AND (
          "conname" LIKE 'replenishment_order_line_%_check'
          OR "conname" LIKE '%replenishment_order%fkey'
        )
    `,
    prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT "indexname"
      FROM "pg_indexes"
      WHERE "schemaname" = 'public'
        AND "tablename" = 'container_import_binding'
        AND "indexname" IN (
          'container_import_binding_scope_key',
          'container_import_binding_container_idx'
        )
    `,
  ]);
  const total = lines.reduce(
    (sum, line) => sum + Number(line.shippedQuantity.toString()),
    0,
  );
  const inspectionRequiredCount = lines.filter(
    (line) => line.commodityInspectionRequired,
  ).length;
  const unsupportedFieldPopulated = lines.some(
    (line) =>
      line.containsBattery !== null ||
      line.containsRefrigerant !== null ||
      line.phytosanitaryRequired !== null ||
      line.domesticMarkupAmount !== null ||
      line.replenishmentFobUnitPrice !== null ||
      line.negotiationFobUnitPrice !== null,
  );
  const set = allocationSets[0];
  const evidenceRefs = Array.isArray(set?.evidenceRefs)
    ? set.evidenceRefs.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const evidenceRecords = await prisma.evidenceRecord.findMany({
    where: { tenantId: realTenantId, id: { in: evidenceRefs } },
    select: { id: true },
  });
  const allocatedTotal = set?.allocations.reduce(
    (sum, allocation) => sum + Number(allocation.allocatedQuantity.toString()),
    0,
  );
  if (
    orderCount !== 2 ||
    containerCount !== 2 ||
    legacySyntheticContainerCount !== 0 ||
    skuCount !== 15 ||
    lines.length !== 15 ||
    importRowCount !== 15 ||
    lines.some((line) => line.productSkuId === null) ||
    lines.some((line) => !UUID_PATTERN.test(line.id)) ||
    total !== 504 ||
    inspectionRequiredCount !== 5 ||
    unsupportedFieldPopulated ||
    allocationSets.length !== 1 ||
    containerNumberIndex.length !== 1 ||
    importBindingIndexes.length !== 2 ||
    !hasExpectedLineColumns(lineColumns) ||
    !hasExpectedRelevantConstraints(relevantConstraints) ||
    set?.containerRecord.containerNumber !== "HMMU4956442" ||
    !UUID_PATTERN.test(set.containerRecord.id) ||
    evidenceRefs.length !== 1 ||
    !evidenceRefs.every((value) => UUID_PATTERN.test(value)) ||
    evidenceRecords.length !== 1 ||
    set.allocations.length !== 15 ||
    allocatedTotal !== 504
  ) {
    throw new Error("Real replenishment seed reconciliation failed");
  }

  const fixture = JSON.parse(
    readFileSync(
      resolve("database/seeds/fixtures/replenishment-26dsc01811-01812.json"),
      "utf8",
    ),
  ) as {
    observedConflicts: Array<{
      field: string;
      earlierValue: number;
      finalDocumentValue: number;
    }>;
  };
  const conflicts = new Map(
    fixture.observedConflicts.map((conflict) => [conflict.field, conflict]),
  );
  if (
    conflicts.get("grossWeightKg")?.earlierValue !== 7706.6 ||
    conflicts.get("grossWeightKg")?.finalDocumentValue !== 7723 ||
    conflicts.get("volumeCbm")?.earlierValue !== 67.57 ||
    conflicts.get("volumeCbm")?.finalDocumentValue !== 67.25
  ) {
    throw new Error("Real source conflicts were changed or removed");
  }
}

function hasExpectedLineColumns(
  columns: Array<{
    column_name: string;
    data_type: string;
    numeric_precision: number | null;
    numeric_scale: number | null;
    is_nullable: string;
  }>,
): boolean {
  if (
    columns.length !== 10 ||
    columns.some((column) => column.is_nullable !== "YES")
  ) {
    return false;
  }
  const byName = new Map(columns.map((column) => [column.column_name, column]));
  for (const name of [
    "contains_battery",
    "contains_refrigerant",
    "phytosanitary_required",
    "commodity_inspection_required",
  ]) {
    if (byName.get(name)?.data_type !== "boolean") return false;
  }
  for (const name of [
    "domestic_markup_amount",
    "replenishment_fob_unit_price",
    "negotiation_fob_unit_price",
  ]) {
    const column = byName.get(name);
    if (
      column?.data_type !== "numeric" ||
      column.numeric_precision !== 18 ||
      column.numeric_scale !== 4
    ) {
      return false;
    }
  }
  for (const name of [
    "domestic_markup_currency",
    "replenishment_fob_currency",
    "negotiation_fob_currency",
  ]) {
    if (byName.get(name)?.data_type !== "text") return false;
  }
  return true;
}

function hasExpectedRelevantConstraints(
  constraints: Array<{ conname: string; definition: string }>,
): boolean {
  const byName = new Map(
    constraints.map((constraint) => [
      constraint.conname,
      constraint.definition,
    ]),
  );
  const requiredChecks = [
    "replenishment_order_line_domestic_markup_pair_check",
    "replenishment_order_line_domestic_markup_currency_check",
    "replenishment_order_line_replenishment_fob_pair_check",
    "replenishment_order_line_replenishment_fob_currency_check",
    "replenishment_order_line_negotiation_fob_pair_check",
    "replenishment_order_line_negotiation_fob_currency_check",
  ];
  const containerFk = byName.get(
    "container_record_replenishment_order_tenant_fkey",
  );
  const lineFk = byName.get("replenishment_order_line_order_tenant_fkey");
  return (
    requiredChecks.every((name) => byName.has(name)) &&
    !byName.has("replenishment_order_line_replenishment_order_id_fkey") &&
    Boolean(
      containerFk?.includes(
        "FOREIGN KEY (replenishment_order_id, tenant_id)",
      ) &&
      containerFk.includes("REFERENCES replenishment_order(id, tenant_id)") &&
      lineFk?.includes("FOREIGN KEY (replenishment_order_id, tenant_id)") &&
      lineFk.includes("REFERENCES replenishment_order(id, tenant_id)"),
    )
  );
}

async function verifyLineConstraints(prisma: PrismaClient): Promise<void> {
  const line = await prisma.replenishmentOrderLine.findFirstOrThrow({
    where: { tenantId: realTenantId },
    select: { id: true },
  });
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        UPDATE "replenishment_order_line"
        SET "domestic_markup_amount" = 1, "domestic_markup_currency" = NULL
        WHERE "id" = ${line.id}
      `,
    "Amount without currency was accepted",
    {
      sqlState: "23514",
      constraint: "replenishment_order_line_domestic_markup_pair_check",
    },
  );
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        UPDATE "replenishment_order_line"
        SET "replenishment_fob_unit_price" = 1,
            "replenishment_fob_currency" = 'usd'
        WHERE "id" = ${line.id}
      `,
    "Non-ISO-shaped currency was accepted",
    {
      sqlState: "23514",
      constraint: "replenishment_order_line_replenishment_fob_currency_check",
    },
  );
}

async function verifyLegacyTenantReference(
  prisma: PrismaClient,
): Promise<void> {
  const foreignOrder = await prisma.replenishmentOrder.create({
    data: {
      tenantId: "constraint-tenant-b",
      orderNumber: "FOREIGN-ORDER",
    },
  });
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        INSERT INTO "container_record" (
          "id", "tenant_id", "order_number", "replenishment_order_id",
          "current_status", "created_at", "updated_at"
        ) VALUES (
          ${randomUUID()}, 'constraint-tenant-a', 'LOCAL-ANCHOR',
          ${foreignOrder.id}, 'not_shipped', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    "Cross-tenant legacy order anchor was accepted",
    {
      sqlState: "23503",
      constraint: "container_record_replenishment_order_tenant_fkey",
    },
  );
}

async function verifyImportBindingConstraints(
  prisma: PrismaClient,
): Promise<void> {
  const [containerA, containerB] = await Promise.all([
    prisma.containerRecord.create({
      data: {
        tenantId: "binding-tenant-a",
        orderNumber: "BINDING-A",
        containerNumber: "BINDING-CONTAINER",
        currentStatus: "not_shipped",
      },
    }),
    prisma.containerRecord.create({
      data: {
        tenantId: "binding-tenant-b",
        orderNumber: "BINDING-B",
        containerNumber: "BINDING-CONTAINER",
        currentStatus: "not_shipped",
      },
    }),
  ]);
  await prisma.containerImportBinding.create({
    data: {
      tenantId: "binding-tenant-a",
      sourceBatchId: "binding-batch",
      containerNumber: "BINDING-CONTAINER",
      containerRecordId: containerA.id,
    },
  });
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        INSERT INTO "container_import_binding" (
          "id", "tenant_id", "source_batch_id", "container_number",
          "container_record_id"
        ) VALUES (
          ${randomUUID()}::uuid, 'binding-tenant-a', 'binding-batch',
          'BINDING-CONTAINER', ${containerA.id}
        )
      `,
    "Duplicate import-scope container binding was accepted",
    {
      sqlState: "23505",
      constraint: "container_import_binding_scope_key",
    },
  );
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        INSERT INTO "container_import_binding" (
          "id", "tenant_id", "source_batch_id", "container_number",
          "container_record_id"
        ) VALUES (
          ${randomUUID()}::uuid, 'binding-tenant-a', 'other-batch',
          'BINDING-CONTAINER', ${containerB.id}
        )
      `,
    "Cross-tenant import-scope container binding was accepted",
    {
      sqlState: "23503",
      constraint: "container_import_binding_container_fkey",
    },
  );
}

async function verifySyntheticManyToMany(prisma: PrismaClient): Promise<void> {
  const tenantId = "synthetic-many-to-many";
  const [orderA, orderB] = await Promise.all([
    prisma.replenishmentOrder.create({
      data: { tenantId, orderNumber: "SYNTH-ORDER-A" },
    }),
    prisma.replenishmentOrder.create({
      data: { tenantId, orderNumber: "SYNTH-ORDER-B" },
    }),
  ]);
  const [lineA, lineB] = await Promise.all([
    prisma.replenishmentOrderLine.create({
      data: {
        tenantId,
        replenishmentOrderId: orderA.id,
        productNumber: "SYNTH-SKU-A",
        shippedQuantity: 10,
        quantityUnit: "piece",
        sourceBatchId: randomUUID(),
        sourceRowId: "row-a",
      },
    }),
    prisma.replenishmentOrderLine.create({
      data: {
        tenantId,
        replenishmentOrderId: orderB.id,
        productNumber: "SYNTH-SKU-B",
        shippedQuantity: 8,
        quantityUnit: "piece",
        sourceBatchId: randomUUID(),
        sourceRowId: "row-b",
      },
    }),
  ]);
  const [containerA, containerB] = await Promise.all([
    prisma.containerRecord.create({
      data: {
        tenantId,
        orderNumber: orderA.orderNumber,
        replenishmentOrderId: orderA.id,
        containerNumber: "SYNTH-CONTAINER-A",
        currentStatus: "not_shipped",
      },
    }),
    prisma.containerRecord.create({
      data: {
        tenantId,
        orderNumber: orderA.orderNumber,
        replenishmentOrderId: orderA.id,
        containerNumber: "SYNTH-CONTAINER-B",
        currentStatus: "not_shipped",
      },
    }),
  ]);
  const setA = await prisma.containerCargoAllocationSet.create({
    data: allocationSetData(tenantId, containerA.id, "synth:set-a", [
      { lineId: lineA.id, quantity: 6 },
      { lineId: lineB.id, quantity: 8 },
    ]),
    include: {
      allocations: {
        include: {
          replenishmentOrderLine: {
            select: { replenishmentOrderId: true },
          },
        },
      },
    },
  });
  await prisma.containerCargoAllocationSet.create({
    data: allocationSetData(tenantId, containerB.id, "synth:set-b", [
      { lineId: lineA.id, quantity: 4 },
    ]),
  });
  const loadedOrderIds = new Set(
    setA.allocations.map(
      (allocation) => allocation.replenishmentOrderLine.replenishmentOrderId,
    ),
  );
  const splitContainerCount = await prisma.containerCargoAllocation.count({
    where: {
      tenantId,
      replenishmentOrderLineId: lineA.id,
      allocationSet: { state: "active" },
    },
  });
  if (loadedOrderIds.size !== 2 || splitContainerCount !== 2) {
    throw new Error("Synthetic N:M container/order relationship failed");
  }
}

async function verifyPostDepartureShipmentConstraints(
  prisma: PrismaClient,
): Promise<void> {
  const tenantId = "shipment-core-tenant-a";
  const actorId = randomUUID();
  const [containerA, containerB] = await Promise.all([
    prisma.containerRecord.create({
      data: {
        tenantId,
        orderNumber: "SHIPMENT-COMPAT-A",
        containerNumber: "TCLU1234567",
        currentStatus: "shipped",
      },
    }),
    prisma.containerRecord.create({
      data: {
        tenantId,
        orderNumber: "SHIPMENT-COMPAT-B",
        containerNumber: "TCLU7654321",
        currentStatus: "shipped",
      },
    }),
  ]);
  const [shipmentA, shipmentB] = await Promise.all([
    prisma.shipment.create({
      data: shipmentData(tenantId, actorId, "A"),
    }),
    prisma.shipment.create({
      data: shipmentData(tenantId, actorId, "B"),
    }),
  ]);
  const handoffA = await prisma.shipmentHandoffRecord.create({
    data: {
      tenantId,
      sourceProfile: "api_v1",
      ingestionChannel: "api",
      sourceSystem: "database-verification",
      externalHandoffId: "handoff-a",
      handoffVersion: 1,
      occurredAt: new Date("2026-09-23T00:00:00Z"),
      idempotencyKey: "shipment-core:handoff-a:1",
      payloadHash: "a".repeat(64),
      payloadJson: { contractVersion: "database-verification" },
      status: "accepted",
      shipmentId: shipmentA.id,
      actorId,
      traceId: "trace-shipment-core-a",
    },
  });
  await prisma.shipmentContainerLink.createMany({
    data: [containerA, containerB].map((container, index) => ({
      tenantId,
      shipmentId: shipmentA.id,
      containerRecordId: container.id,
      version: 1,
      state: "active",
      sourceHandoffId: handoffA.id,
      evidenceRefs: [randomUUID()],
      idempotencyKey: `shipment-core:link:${index + 1}`,
      joinedAt: new Date("2026-09-23T00:00:00Z"),
    })),
  });
  if (
    (await prisma.shipmentContainerLink.count({
      where: { tenantId, shipmentId: shipmentA.id, state: "active" },
    })) !== 2
  ) {
    throw new Error("Shipment 1:N container relationship was not persisted");
  }

  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        INSERT INTO "shipment_container_link" (
          "id", "tenant_id", "shipment_id", "container_record_id", "version",
          "state", "source_handoff_id", "evidence_refs", "idempotency_key",
          "joined_at", "created_at"
        ) VALUES (
          ${randomUUID()}::uuid, ${tenantId}, ${shipmentB.id}::uuid,
          ${containerA.id}, 1, 'active', ${handoffA.id}::uuid, '[]'::jsonb,
          'shipment-core:conflicting-active-link', CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
    "A container was accepted in two active Shipments",
    {
      sqlState: "23505",
      constraint: "shipment_container_link_active_container_key",
    },
  );

  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        INSERT INTO "shipment_handoff_record" (
          "id", "tenant_id", "source_profile", "ingestion_channel",
          "source_system", "external_handoff_id", "handoff_version",
          "occurred_at", "idempotency_key", "payload_hash", "payload_json", "status",
          "shipment_id", "actor_id", "trace_id", "created_at", "updated_at"
        ) VALUES (
          ${randomUUID()}::uuid, ${tenantId}, 'api_v1', 'api',
          'database-verification', 'handoff-other', 1, CURRENT_TIMESTAMP,
          'shipment-core:handoff-a:1', ${"b".repeat(64)}, '{}'::jsonb, 'accepted',
          ${shipmentA.id}::uuid, ${actorId}::uuid, 'trace-conflict',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    "A conflicting Shipment Handoff idempotency key was accepted",
    {
      sqlState: "23505",
      constraint: "shipment_handoff_tenant_idempotency_key",
    },
  );

  await prisma.shipment.update({
    where: { id: shipmentB.id },
    data: { currentLifecycleStatus: "closed" },
  });
  await expectDatabaseRejection(
    () =>
      prisma.$executeRaw`
        UPDATE "shipment"
        SET "current_lifecycle_status" = 'completed'
        WHERE "id" = ${shipmentB.id}::uuid
      `,
    "An unregistered Shipment lifecycle status was accepted",
    { sqlState: "23514", constraint: "shipment_status_check" },
  );

  const cargoLine = await prisma.shipmentCargoLine.create({
    data: {
      tenantId,
      shipmentId: shipmentA.id,
      lineNo: 1,
      productNumberSnapshot: "SHIPMENT-SKU-001",
      quantity: 5,
      quantityUnit: "piece",
      sourceHandoffId: handoffA.id,
      sourceLineId: "shipment-line-1",
    },
  });
  const allocationSet = await prisma.containerCargoAllocationSet.create({
    data: {
      tenantId,
      containerRecordId: containerA.id,
      version: 1,
      state: "active",
      ingestionChannel: "api",
      sourceSystem: "database-verification",
      evidenceRefs: [randomUUID()],
      idempotencyKey: "shipment-core:allocation-set:1",
      payloadHash: "c".repeat(64),
    },
  });
  await prisma.containerCargoAllocation.create({
    data: {
      tenantId,
      allocationSetId: allocationSet.id,
      shipmentCargoLineId: cargoLine.id,
      allocatedQuantity: 5,
      quantityUnit: "piece",
    },
  });
  const storedAllocation =
    await prisma.containerCargoAllocation.findFirstOrThrow({
      where: { tenantId, shipmentCargoLineId: cargoLine.id },
    });
  if (storedAllocation.replenishmentOrderLineId !== null) {
    throw new Error("Shipment cargo allocation invented a replenishment line");
  }
}

function shipmentData(tenantId: string, actorId: string, suffix: string) {
  return {
    tenantId,
    shipmentNumber: `SHIPMENT-${suffix}`,
    sourceSystem: "database-verification",
    sourceRecordId: `shipment-source-${suffix}`,
    sourceVersion: "1",
    transportMode: "ocean",
    carrierCode: "HMM",
    vesselName: "ONE TRUTH",
    voyageNumber: `V-${suffix}`,
    originCountryCode: "CN",
    originUnlocode: "CNNGB",
    destinationCountryCode: "US",
    destinationUnlocode: "USLAX",
    atdAt: new Date("2026-09-22T10:00:00Z"),
    etaAt: new Date("2026-10-10T10:00:00Z"),
    currentLifecycleStatus: "departed",
    createdBy: actorId,
    updatedBy: actorId,
  };
}

function allocationSetData(
  tenantId: string,
  containerRecordId: string,
  idempotencyKey: string,
  allocations: Array<{ lineId: string; quantity: number }>,
) {
  return {
    tenantId,
    containerRecordId,
    version: 1,
    state: "active",
    ingestionChannel: "file_import",
    sourceSystem: "database-verification",
    evidenceRefs: [randomUUID()],
    idempotencyKey,
    payloadHash: "a".repeat(64),
    allocations: {
      create: allocations.map((allocation) => ({
        replenishmentOrderLineId: allocation.lineId,
        allocatedQuantity: allocation.quantity,
        quantityUnit: "piece",
      })),
    },
  };
}

async function expectDatabaseRejection(
  action: () => Promise<unknown>,
  message: string,
  expected: { sqlState: string; constraint: string },
): Promise<void> {
  try {
    await action();
  } catch (error) {
    const diagnostics = databaseErrorDiagnostics(error);
    if (
      diagnostics.includes(expected.sqlState) &&
      diagnostics.includes(expected.constraint)
    ) {
      return;
    }
    throw new Error(
      `${message}: expected SQLSTATE ${expected.sqlState} from ${expected.constraint}; received ${diagnostics}`,
      { cause: error },
    );
  }
  throw new Error(message);
}

function databaseErrorDiagnostics(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): string {
  if (value === null || value === undefined || depth > 8) return "";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "";
  seen.add(value);
  const record = value as Record<string, unknown>;
  const parts = [
    value instanceof Error ? value.name : "",
    value instanceof Error ? value.message : "",
  ];
  for (const [key, nested] of Object.entries(record)) {
    parts.push(key, databaseErrorDiagnostics(nested, seen, depth + 1));
  }
  if (value instanceof Error && value.cause) {
    parts.push(databaseErrorDiagnostics(value.cause, seen, depth + 1));
  }
  return parts.filter(Boolean).join(" ");
}

async function withTemporaryDatabase(
  source: string,
  suffix: string,
  verify: (targetUrl: string) => Promise<void>,
): Promise<void> {
  const sourceUrl = new URL(source);
  const databaseName = `logix_verify_real_${suffix}_${process.pid}_${Date.now()}`;
  if (!/^logix_verify_real_(?:upgrade|empty)_[0-9_]+$/.test(databaseName)) {
    throw new Error("Unsafe temporary database name");
  }
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${databaseName}`;
  targetUrl.searchParams.set("schema", "public");
  const admin = createPrisma(adminUrl.toString());
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await verify(targetUrl.toString());
  } finally {
    if (created) {
      await admin.$executeRawUnsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
      );
      await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    }
    await admin.$disconnect();
  }
}

function prepareLegacyMigrationFixture(fixtureRoot: string): string {
  const sourceRoot = resolve("database/migrations");
  const migrationRoot = join(fixtureRoot, "migrations");
  mkdirSync(migrationRoot);
  copyFileSync(
    join(sourceRoot, "migration_lock.toml"),
    join(migrationRoot, "migration_lock.toml"),
  );
  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^\d{14}_/.test(entry.name) &&
      entry.name < targetMigration
    ) {
      cpSync(join(sourceRoot, entry.name), join(migrationRoot, entry.name), {
        recursive: true,
      });
    }
  }
  const configPath = join(fixtureRoot, "prisma.config.mjs");
  const prismaConfigUrl = pathToFileURL(require.resolve("prisma/config")).href;
  writeFileSync(
    configPath,
    `import { defineConfig } from ${JSON.stringify(prismaConfigUrl)};\n\nexport default defineConfig({\n  schema: ${JSON.stringify(resolve("database/schema.prisma"))},\n  datasource: { url: process.env.DATABASE_URL },\n  migrations: { path: ${JSON.stringify(migrationRoot)} },\n});\n`,
  );
  return configPath;
}

function deployLegacyMigrations(configPath: string, url: string): void {
  const deploy = () =>
    runPrisma(["migrate", "deploy", "--config", configPath], url);
  const firstAttempt = deploy();
  if (firstAttempt.status === 0) return;
  const output = `${firstAttempt.stdout ?? ""}\n${firstAttempt.stderr ?? ""}`;
  if (!isKnownEmptyDatabaseFailure(output)) {
    throw new Error(`Legacy migration fixture failed:\n${output}`);
  }
  const resolved = runPrisma(
    [
      "migrate",
      "resolve",
      "--applied",
      "20260913011044_inbox",
      "--config",
      configPath,
    ],
    url,
  );
  if (resolved.status !== 0) {
    throw new Error(
      `Legacy migration recovery failed:\n${resolved.stdout ?? ""}\n${resolved.stderr ?? ""}`,
    );
  }
  const retry = deploy();
  if (retry.status !== 0) {
    throw new Error(
      `Legacy migration retry failed:\n${retry.stdout ?? ""}\n${retry.stderr ?? ""}`,
    );
  }
}

function deployCurrentMigrations(url: string): void {
  runPnpmCommand("db:migrate", url);
}

function runPnpmCommand(script: string, url: string): void {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("npm_execpath is required to run pnpm scripts");
  const result = spawnSync(process.execPath, [pnpmCli, script], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `${script} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
}

function runPrisma(args: string[], url: string) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    stdio: "pipe",
  });
}

function createPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
