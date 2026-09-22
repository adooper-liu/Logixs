import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "../../generated/prisma";

const FIXTURE_PATH = fileURLToPath(
  new URL("./fixtures/replenishment-26dsc01811-01812.json", import.meta.url),
);
const EVIDENCE_PATH = fileURLToPath(
  new URL(
    "../../docs/product/domain/evidence/REAL_REPLENISHMENT_SAMPLE_VALIDATION_20260921.json",
    import.meta.url,
  ),
);
const EVIDENCE_CONTENT_REF =
  "docs/product/domain/evidence/REAL_REPLENISHMENT_SAMPLE_VALIDATION_20260921.json";
const IMPORT_BATCH_ID = "demo-import-26dsc01812-bom";
const ALLOCATION_IDEMPOTENCY_KEY =
  "real-sample-20260921:hmmu4956442:allocation:v1";

interface RealSampleFixture {
  fixtureVersion: number;
  tenantId: string;
  sourceDate: string;
  sources: {
    bom: {
      fileName: string;
      sha256: string;
      sizeBytes: number;
      sheet: string;
    };
    sourceDirectoryFileCount: number;
  };
  shipment: {
    mainOrderNumber: string;
    combinedOrderNumbers: string[];
  };
  containers: Array<{
    id: string;
    orderNumber: string;
    containerNumber: string;
  }>;
  productLines: Array<{
    orderNumber: string;
    productNumber: string;
    shippedQuantity: number;
    quantityUnit: "piece" | "carton" | "set" | "pallet";
    contractNumber: string | null;
    inspectionRequired: boolean;
    sourceSnapshot: Record<string, Prisma.JsonValue>;
  }>;
  observedConflicts: Array<{
    scope: string;
    field: string;
    earlierValue: number;
    finalDocumentValue: number;
  }>;
}

export interface RealReplenishmentSeedResult {
  tenantId: string;
  replenishmentOrderCount: number;
  containerCount: number;
  productSkuCount: number;
  replenishmentOrderLineCount: number;
  allocationSetCount: number;
  allocationCount: number;
}

export async function seedRealReplenishmentSample(
  prisma: PrismaClient,
): Promise<RealReplenishmentSeedResult> {
  const fixture = await readFixture();
  validateFixture(fixture);
  const evidenceContentHash = createHash("sha256")
    .update(await readFile(EVIDENCE_PATH))
    .digest("hex");

  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: fixture.tenantId,
          idempotencyKey: "real-sample-20260921-26dsc01812-bom",
        },
      },
      create: {
        id: IMPORT_BATCH_ID,
        tenantId: fixture.tenantId,
        operatorId: "demo-seed",
        idempotencyKey: "real-sample-20260921-26dsc01812-bom",
        fileName: fixture.sources.bom.fileName,
        fileHash: fixture.sources.bom.sha256,
        sourceFileStatus: "not_retained",
        parserVersion: `real-sample-v${fixture.fixtureVersion}`,
        status: "completed",
        rowCount: fixture.productLines.length,
        columnCount: 36,
        mappingSuggestions: [],
      },
      update: {
        fileName: fixture.sources.bom.fileName,
        fileHash: fixture.sources.bom.sha256,
        parserVersion: `real-sample-v${fixture.fixtureVersion}`,
        status: "completed",
        rowCount: fixture.productLines.length,
      },
    });

    const orders = new Map<string, string>();
    for (const orderNumber of fixture.shipment.combinedOrderNumbers) {
      const order = await transaction.replenishmentOrder.upsert({
        where: {
          tenantId_orderNumber: {
            tenantId: fixture.tenantId,
            orderNumber,
          },
        },
        create: {
          id: `demo-order-${orderNumber.toLowerCase()}`,
          tenantId: fixture.tenantId,
          orderNumber,
        },
        update: {},
      });
      orders.set(orderNumber, order.id);
    }

    const containers = new Map<string, string>();
    for (const source of fixture.containers) {
      const orderId = requiredMapValue(orders, source.orderNumber, "order");
      const containerId = source.id;
      const existingContainer = await transaction.containerRecord.findUnique({
        where: { id: containerId },
        select: { id: true },
      });
      if (!existingContainer) {
        await transaction.containerRecord.updateMany({
          where: {
            id: `demo-container-${source.containerNumber.toLowerCase()}`,
            tenantId: fixture.tenantId,
          },
          data: { id: containerId },
        });
      }
      const container = await transaction.containerRecord.upsert({
        where: { id: containerId },
        create: {
          id: containerId,
          tenantId: fixture.tenantId,
          orderNumber: source.orderNumber,
          replenishmentOrderId: orderId,
          mainOrderNumber: fixture.shipment.mainOrderNumber,
          containerNumber: source.containerNumber,
          currentStatus: "shipped",
        },
        update: {
          tenantId: fixture.tenantId,
          orderNumber: source.orderNumber,
          replenishmentOrderId: orderId,
          mainOrderNumber: fixture.shipment.mainOrderNumber,
          containerNumber: source.containerNumber,
          currentStatus: "shipped",
        },
      });
      containers.set(source.containerNumber, container.id);
    }

    const lineIds: string[] = [];
    for (const [index, source] of fixture.productLines.entries()) {
      const sequence = String(index + 1).padStart(2, "0");
      const sourceRowId = `demo-row-26dsc01812-${sequence}`;
      const lineId = deterministicUuid(
        `${fixture.tenantId}:line:26DSC01812:${sequence}`,
      );
      const productSkuId = deterministicUuid(
        `${fixture.tenantId}:product-sku:${source.productNumber}`,
      );
      await transaction.importRow.upsert({
        where: { batchId_rowNo: { batchId: batch.id, rowNo: index + 1 } },
        create: {
          id: sourceRowId,
          batchId: batch.id,
          rowNo: index + 1,
          snapshot: source.sourceSnapshot as Prisma.InputJsonValue,
        },
        update: {
          id: sourceRowId,
          snapshot: source.sourceSnapshot as Prisma.InputJsonValue,
        },
      });
      const productSku = await transaction.productSku.upsert({
        where: {
          tenantId_productNumber: {
            tenantId: fixture.tenantId,
            productNumber: source.productNumber,
          },
        },
        create: {
          id: productSkuId,
          tenantId: fixture.tenantId,
          productNumber: source.productNumber,
        },
        update: {},
      });
      const line = await transaction.replenishmentOrderLine.upsert({
        where: {
          sourceBatchId_sourceRowId: {
            sourceBatchId: batch.id,
            sourceRowId,
          },
        },
        create: {
          id: lineId,
          tenantId: fixture.tenantId,
          replenishmentOrderId: requiredMapValue(
            orders,
            source.orderNumber,
            "order",
          ),
          productSkuId: productSku.id,
          productNumber: source.productNumber,
          shippedQuantity: source.shippedQuantity,
          quantityUnit: source.quantityUnit,
          contractNumber: source.contractNumber,
          commodityInspectionRequired: source.inspectionRequired,
          sourceBatchId: batch.id,
          sourceRowId,
          isCurrent: true,
        },
        update: {
          id: lineId,
          productSkuId: productSku.id,
          productNumber: source.productNumber,
          shippedQuantity: source.shippedQuantity,
          quantityUnit: source.quantityUnit,
          contractNumber: source.contractNumber,
          commodityInspectionRequired: source.inspectionRequired,
          isCurrent: true,
          supersededByBatchId: null,
        },
      });
      lineIds.push(line.id);
    }

    const allocationPayload = fixture.productLines.map((line, index) => ({
      replenishmentOrderLineId: lineIds[index]!,
      allocatedQuantity: String(line.shippedQuantity),
      quantityUnit: line.quantityUnit,
    }));
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(allocationPayload), "utf8")
      .digest("hex");
    const targetContainerId = requiredMapValue(
      containers,
      "HMMU4956442",
      "container",
    );
    const evidenceId = deterministicUuid(
      `${fixture.tenantId}:evidence:validation-report`,
    );
    const evidence = await transaction.evidenceRecord.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: fixture.tenantId,
          idempotencyKey: "real-sample-20260921:validation-report",
        },
      },
      create: {
        id: evidenceId,
        tenantId: fixture.tenantId,
        idempotencyKey: "real-sample-20260921:validation-report",
        evidenceType: "validation_report",
        subjectType: "container_cargo_allocation",
        subjectId: targetContainerId,
        authorityLevel: "operational",
        contentRef: EVIDENCE_CONTENT_REF,
        contentHash: evidenceContentHash,
        source: {
          kind: "repository_file",
          fixtureVersion: fixture.fixtureVersion,
          sourceFileCount: fixture.sources.sourceDirectoryFileCount,
        },
        verificationState: "pending",
        confidenceState: "unknown",
        validity: "effective",
        receivedAt: new Date(fixture.sourceDate),
        recordedAt: new Date(fixture.sourceDate),
      },
      update: {
        subjectId: targetContainerId,
        contentRef: EVIDENCE_CONTENT_REF,
        contentHash: evidenceContentHash,
        source: {
          kind: "repository_file",
          fixtureVersion: fixture.fixtureVersion,
          sourceFileCount: fixture.sources.sourceDirectoryFileCount,
        },
      },
    });
    const existingSet =
      await transaction.containerCargoAllocationSet.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: fixture.tenantId,
            idempotencyKey: ALLOCATION_IDEMPOTENCY_KEY,
          },
        },
        include: { allocations: true },
      });
    if (existingSet) {
      assertExistingAllocationSet(
        existingSet,
        targetContainerId,
        payloadHash,
        allocationPayload,
      );
      if (
        !Array.isArray(existingSet.evidenceRefs) ||
        existingSet.evidenceRefs.length !== 1 ||
        existingSet.evidenceRefs[0] !== evidence.id
      ) {
        await transaction.containerCargoAllocationSet.update({
          where: { id: existingSet.id },
          data: { evidenceRefs: [evidence.id] },
        });
      }
    } else {
      await transaction.containerCargoAllocationSet.create({
        data: {
          id: deterministicUuid(
            `${fixture.tenantId}:allocation-set:HMMU4956442:v1`,
          ),
          tenantId: fixture.tenantId,
          containerRecordId: targetContainerId,
          version: 1,
          state: "active",
          ingestionChannel: "file_import",
          sourceSystem: "real-replenishment-sample-fixture",
          evidenceRefs: [evidence.id],
          idempotencyKey: ALLOCATION_IDEMPOTENCY_KEY,
          payloadHash,
          allocations: {
            create: allocationPayload.map((allocation) => ({
              id: deterministicUuid(
                `${fixture.tenantId}:allocation:${allocation.replenishmentOrderLineId}`,
              ),
              ...allocation,
            })),
          },
        },
      });
    }

    return collectSeedResult(transaction, fixture.tenantId);
  });
}

async function readFixture(): Promise<RealSampleFixture> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as RealSampleFixture;
}

function validateFixture(fixture: RealSampleFixture): void {
  const orderNumbers = new Set(fixture.shipment.combinedOrderNumbers);
  const productTotal = fixture.productLines.reduce(
    (total, line) => total + line.shippedQuantity,
    0,
  );
  if (
    fixture.fixtureVersion !== 1 ||
    fixture.tenantId !== "demo-real-sample-20260921" ||
    fixture.containers.length !== 2 ||
    orderNumbers.size !== 2 ||
    !orderNumbers.has("26DSC01811") ||
    !orderNumbers.has("26DSC01812") ||
    fixture.productLines.length !== 15 ||
    fixture.productLines.some((line) => line.orderNumber !== "26DSC01812") ||
    fixture.containers.some((container) => !UUID_PATTERN.test(container.id)) ||
    productTotal !== 504
  ) {
    throw new Error("REAL_REPLENISHMENT_SAMPLE_FIXTURE_INVARIANT_FAILED");
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256")
    .update(value, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requiredMapValue(
  values: Map<string, string>,
  key: string,
  kind: string,
): string {
  const value = values.get(key);
  if (!value)
    throw new Error(`REAL_REPLENISHMENT_SAMPLE_MISSING_${kind}:${key}`);
  return value;
}

function assertExistingAllocationSet(
  existing: {
    containerRecordId: string;
    payloadHash: string;
    allocations: Array<{
      replenishmentOrderLineId: string;
      allocatedQuantity: Prisma.Decimal;
      quantityUnit: string;
    }>;
  },
  expectedContainerId: string,
  expectedPayloadHash: string,
  expectedAllocations: Array<{
    replenishmentOrderLineId: string;
    allocatedQuantity: string;
    quantityUnit: string;
  }>,
): void {
  const actual = existing.allocations
    .map((allocation) => ({
      replenishmentOrderLineId: allocation.replenishmentOrderLineId,
      allocatedQuantity: allocation.allocatedQuantity.toString(),
      quantityUnit: allocation.quantityUnit,
    }))
    .sort((left, right) =>
      left.replenishmentOrderLineId.localeCompare(
        right.replenishmentOrderLineId,
      ),
    );
  const expected = [...expectedAllocations].sort((left, right) =>
    left.replenishmentOrderLineId.localeCompare(right.replenishmentOrderLineId),
  );
  if (
    existing.containerRecordId !== expectedContainerId ||
    existing.payloadHash !== expectedPayloadHash ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    throw new Error(
      `REAL_REPLENISHMENT_SAMPLE_ALLOCATION_REPLAY_CONFLICT:${JSON.stringify({
        actualContainerId: existing.containerRecordId,
        expectedContainerId,
        actualPayloadHash: existing.payloadHash,
        expectedPayloadHash,
        actual,
        expected,
      })}`,
    );
  }
}

async function collectSeedResult(
  transaction: Prisma.TransactionClient,
  tenantId: string,
): Promise<RealReplenishmentSeedResult> {
  const [
    replenishmentOrderCount,
    containerCount,
    productSkuCount,
    replenishmentOrderLineCount,
    allocationSetCount,
    allocationCount,
  ] = await Promise.all([
    transaction.replenishmentOrder.count({ where: { tenantId } }),
    transaction.containerRecord.count({ where: { tenantId } }),
    transaction.productSku.count({ where: { tenantId } }),
    transaction.replenishmentOrderLine.count({ where: { tenantId } }),
    transaction.containerCargoAllocationSet.count({ where: { tenantId } }),
    transaction.containerCargoAllocation.count({ where: { tenantId } }),
  ]);
  return {
    tenantId,
    replenishmentOrderCount,
    containerCount,
    productSkuCount,
    replenishmentOrderLineCount,
    allocationSetCount,
    allocationCount,
  };
}
