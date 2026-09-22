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
import { isKnownEmptyDatabaseFailure } from "./migrate-deploy.mjs";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const targetMigration = "20260922090000_real_replenishment_database_foundation";
const realTenantId = "demo-real-sample-20260921";
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
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log(
    "Real replenishment verified: empty migration, idempotent seed, constraints, real totals and N:M relationships passed.",
  );
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
