import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { assertRestoreTarget } from "../apps/api/src/modules/ocean-operations/infrastructure/restore-ocean-review-sample";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { RegisterProductSkuService } from "../apps/api/src/modules/master-data/application/register-product-sku.service";
import { GetProductSkuService } from "../apps/api/src/modules/master-data/application/get-product-sku.service";
import { PrismaProductSkuRepository } from "../apps/api/src/modules/master-data/infrastructure/prisma-product-sku.repository";
import { ReplaceReplenishmentOrderLinesService } from "../apps/api/src/modules/shipment-registry/application/replace-replenishment-order-lines.service";
import { PrismaReplaceReplenishmentOrderLinesRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-replace-replenishment-order-lines.repository";
import { BindReplenishmentLineProductSkuService } from "../apps/api/src/modules/shipment-registry/application/bind-replenishment-line-product-sku.service";
import { PrismaReplenishmentLineSkuBinder } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-replenishment-line-sku-binder";
import { ReplaceContainerCargoAllocationsService } from "../apps/api/src/modules/shipment-registry/application/replace-container-cargo-allocations.service";
import { PrismaContainerCargoAllocationRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-cargo-allocation.repository";
import { ReplaceContainerStuffingSnapshotService } from "../apps/api/src/modules/shipment-registry/application/replace-container-stuffing-snapshot.service";
import { PrismaContainerStuffingSnapshotRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-stuffing-snapshot.repository";
import { ReplaceContainerDispatchSnapshotService } from "../apps/api/src/modules/shipment-registry/application/replace-container-dispatch-snapshot.service";
import { PrismaContainerDispatchSnapshotRepository } from "../apps/api/src/modules/shipment-registry/infrastructure/prisma-container-dispatch-snapshot.repository";
import { GetContainerDispatchReadinessService } from "../apps/api/src/modules/shipment-registry/application/get-container-dispatch-readiness.service";
import { normalizeReplaceContainerCargoAllocationsCommand } from "../apps/api/src/modules/shipment-registry/domain/container-cargo-allocation";
import { normalizeContainerStuffingSnapshotCommand } from "../apps/api/src/modules/shipment-registry/domain/container-stuffing-snapshot";
import { normalizeContainerDispatchSnapshotCommand } from "../apps/api/src/modules/shipment-registry/domain/container-dispatch-snapshot";

export interface ReferenceFixture {
  scenarioVersion: string;
  classification: string;
  tenantId: string;
  containerId: string;
  shipmentId: string;
  orderNumber: string;
  containerNumber: string;
  shipmentNumber: string;
  sourceSystem: string;
  retained: {
    sourceFile: string;
    packageCount: number;
    grossWeight: string;
    grossWeightUnit: "KGM";
    volume: string;
    volumeUnit: "MTQ";
    carrierCode: string;
    vesselName: string;
    voyageNumber: string;
    originUnlocode: string;
    destinationUnlocode: string;
    houseBillNumber: string;
  };
  synthetic: {
    lines: Array<{
      productNumber: string;
      quantity: string;
      quantityUnit: "piece";
      packages: number;
    }>;
    packagingAssumption: string;
    sealNumber: string;
    bookingNumber: string;
    stuffedAt: string;
    vgm: {
      weight: string;
      weightUnit: "KGM";
      method: "method_1";
      verifiedAt: string;
      assumedTareWeight: string;
    };
    actualDepartureAt: string;
    sourceTimezone: string;
    sourcePrecision: string;
    vgmHandoffState: "accepted";
    notice: string;
  };
}
export const referenceFixture = JSON.parse(
  readFileSync(
    new URL(
      "../database/seeds/fixtures/ocean-reference-case-v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as ReferenceFixture;
export const referenceHash = hash(referenceFixture);
const evidenceId = "71000000-0000-4000-8000-000000000020";
const referenceId = "71000000-0000-4000-8000-000000000021";
const sourceLineId = "reference-case-initial-conditions";
const key = (part: string) => `ocean-reference-case-v1:${part}`;

export interface ReferenceOptions {
  connectionString: string;
  mode: "audit" | "apply";
  confirm?: string;
  expectedAuditHash?: string;
}

export function assertReferenceApply(
  options: ReferenceOptions,
  fixture: ReferenceFixture,
): void {
  assertRestoreTarget(options.connectionString, fixture.tenantId);
  if (
    process.env.NODE_ENV === "production" ||
    options.mode !== "apply" ||
    options.confirm !== referenceFixture.scenarioVersion ||
    !options.expectedAuditHash ||
    !/^[a-f0-9]{64}$/.test(options.expectedAuditHash) ||
    hash(fixture) !== referenceHash
  )
    throw new Error("REFERENCE_APPLY_NOT_AUTHORIZED");
}

export async function auditReferenceCase(
  prisma: PrismaClient,
  f = referenceFixture,
) {
  if (hash(f) !== referenceHash) throw new Error("REFERENCE_SCENARIO_CONFLICT");
  const scope = { tenantId: f.tenantId, containerRecordId: f.containerId };
  const container = await prisma.containerRecord.findFirst({
    where: { id: f.containerId, tenantId: f.tenantId },
  });
  const shipment = await prisma.shipment.findFirst({
    where: { id: f.shipmentId, tenantId: f.tenantId },
  });
  if (!container || !shipment)
    return {
      mode: "audit" as const,
      ready: false,
      conflicts: ["REFERENCE_IDENTITY_MISSING"],
      scenarioHash: referenceHash,
    };
  const [
    order,
    links,
    documents,
    documentLinks,
    lines,
    allocations,
    stuffing,
    dispatch,
    refs,
    evidence,
    cargo,
    otherContainers,
    pending,
    reviews,
    arrivals,
  ] = await Promise.all([
    prisma.replenishmentOrder.findUnique({
      where: {
        tenantId_orderNumber: {
          tenantId: f.tenantId,
          orderNumber: f.orderNumber,
        },
      },
    }),
    prisma.shipmentContainerLink.findMany({
      where: { ...scope, state: "active", supersededAt: null },
    }),
    prisma.shipmentTransportDocument.findMany({
      where: {
        tenantId: f.tenantId,
        shipmentId: f.shipmentId,
        state: "active",
      },
    }),
    prisma.shipmentContainerDocumentLink.findMany({ where: scope }),
    prisma.replenishmentOrderLine.findMany({
      where: {
        tenantId: f.tenantId,
        replenishmentOrder: { orderNumber: f.orderNumber },
      },
      orderBy: { productNumber: "asc" },
    }),
    prisma.containerCargoAllocationSet.findMany({
      where: scope,
      include: { allocations: true },
    }),
    prisma.containerStuffingSnapshot.findMany({ where: scope }),
    prisma.containerDispatchSnapshot.findMany({ where: scope }),
    prisma.shipmentUpstreamReference.findMany({
      where: { ...scope, shipmentId: f.shipmentId, state: "active" },
    }),
    prisma.evidenceRecord.findUnique({ where: { id: evidenceId } }),
    prisma.shipmentCargoLine.findMany({
      where: {
        tenantId: f.tenantId,
        shipmentId: f.shipmentId,
        state: "active",
      },
      orderBy: { lineNo: "asc" },
    }),
    prisma.containerRecord.findMany({
      where: {
        tenantId: f.tenantId,
        id: { not: f.containerId },
        replenishmentOrder: { orderNumber: f.orderNumber },
      },
    }),
    prisma.lifecycleDateFact.findMany({
      where: { tenantId: f.tenantId, containerId: f.containerId },
      orderBy: { id: "asc" },
    }),
    prisma.oceanOperationsSourceReview.findMany({
      where: { tenantId: f.tenantId, containerId: f.containerId },
      orderBy: { id: "asc" },
    }),
    prisma.oceanOperationsArrivalPreparationResult.findMany({
      where: { tenantId: f.tenantId, containerId: f.containerId },
      orderBy: { id: "asc" },
    }),
  ]);
  const fixedProvenance = await prisma.shipmentUpstreamReference.findUnique({
    where: { id: referenceId },
  });
  const conflicts: string[] = [];
  if (fixedProvenance && !validProvenance(fixedProvenance, f))
    conflicts.push("REFERENCE_PROVENANCE_CONFLICT");
  if (
    container.containerNumber !== f.containerNumber ||
    container.orderNumber !== f.orderNumber ||
    !order ||
    container.replenishmentOrderId !== order.id ||
    otherContainers.length
  )
    conflicts.push("REFERENCE_CONTAINER_ORDER_CONFLICT");
  if (
    shipment.sourceSystem !== "development_demo.retained_source_package" ||
    shipment.vesselName !== f.retained.vesselName ||
    shipment.voyageNumber !== f.retained.voyageNumber ||
    shipment.carrierCode !== f.retained.carrierCode ||
    shipment.originUnlocode !== f.retained.originUnlocode ||
    shipment.destinationUnlocode !== f.retained.destinationUnlocode ||
    links.length !== 1 ||
    links[0]?.shipmentId !== f.shipmentId
  )
    conflicts.push("REFERENCE_SHIPMENT_LINK_CONFLICT");
  if (
    !["shipped", "in_transit"].includes(container.currentStatus) ||
    shipment.ataAt
  )
    conflicts.push("REFERENCE_CASE_HAS_ADVANCED");
  if (shipment.shipmentNumber && shipment.shipmentNumber !== f.shipmentNumber)
    conflicts.push("REFERENCE_SHIPMENT_NUMBER_CONFLICT");
  const provenance = refs.find(
    (r) =>
      r.sourceSystem === f.sourceSystem &&
      r.sourceRecordId === f.scenarioVersion,
  );
  if (
    provenance &&
    (provenance.metadata as Record<string, unknown>)?.scenarioHash !==
      referenceHash
  )
    conflicts.push("REFERENCE_SCENARIO_HASH_CONFLICT");
  if (
    shipment.atdAt &&
    (shipment.atdAt.toISOString() !==
      new Date(f.synthetic.actualDepartureAt).toISOString() ||
      !provenance)
  )
    conflicts.push("REFERENCE_ATD_CONFLICT");
  if (
    evidence &&
    (evidence.tenantId !== f.tenantId ||
      evidence.subjectType !== "container" ||
      evidence.subjectId !== f.containerId ||
      evidence.contentHash !== referenceHash ||
      (evidence.source as Record<string, unknown>)?.classification !==
        f.classification)
  )
    conflicts.push("REFERENCE_EVIDENCE_CONFLICT");
  const document = documents.find(
    (d) =>
      d.documentType === "hbl" &&
      d.documentNumber === f.retained.houseBillNumber,
  );
  if (
    !document ||
    documentLinks.some(
      (d) =>
        d.shipmentId !== f.shipmentId ||
        d.shipmentContainerLinkId !== links[0]?.id,
    )
  )
    conflicts.push("REFERENCE_DOCUMENT_CONFLICT");
  if (
    lines.some(
      (l) =>
        l.sourceBatchId !== key("lines") ||
        !l.isCurrent ||
        !f.synthetic.lines.some(
          (x) =>
            x.productNumber === l.productNumber &&
            x.quantity === l.shippedQuantity.toString() &&
            x.quantityUnit === l.quantityUnit,
        ),
    )
  )
    conflicts.push("REFERENCE_EXISTING_ORDER_LINES_CONFLICT");
  if (lines.length && lines.length !== f.synthetic.lines.length)
    conflicts.push("REFERENCE_ORDER_LINES_INCOMPLETE");
  if (
    allocations.some(
      (a) => a.idempotencyKey !== key("allocation") || a.state !== "active",
    ) ||
    stuffing.some(
      (s) => s.idempotencyKey !== key("stuffing") || s.state !== "active",
    ) ||
    dispatch.some(
      (s) => s.idempotencyKey !== key("dispatch") || s.state !== "active",
    )
  )
    conflicts.push("REFERENCE_FOREIGN_SNAPSHOT_CONFLICT");
  if (
    cargo.some(
      (c) =>
        !f.synthetic.lines.some(
          (l) =>
            c.sourceLineId === l.productNumber &&
            c.productNumberSnapshot === l.productNumber &&
            c.quantity.toString() === l.quantity &&
            c.quantityUnit === l.quantityUnit &&
            c.replenishmentOrderLineId ===
              lines.find((line) => line.productNumber === l.productNumber)
                ?.id &&
            !!c.productSkuId &&
            c.productSkuId ===
              lines.find((line) => line.productNumber === l.productNumber)
                ?.productSkuId &&
            c.packageCount?.toString() === String(l.packages) &&
            c.packageUnit === "carton" &&
            c.sourceHandoffId === links[0]?.sourceHandoffId,
        ),
    )
  )
    conflicts.push("REFERENCE_SHIPMENT_CARGO_CONFLICT");
  const common = {
    tenantId: f.tenantId,
    containerRecordId: f.containerId,
    expectedVersion: 0,
    ingestionChannel: "file_import" as const,
    sourceSystem: f.sourceSystem,
    evidenceRefs: [evidenceId],
  };
  if (allocations.length) {
    if (lines.length !== f.synthetic.lines.length)
      conflicts.push("REFERENCE_ALLOCATION_CONFLICT");
    else {
      const expected = normalizeReplaceContainerCargoAllocationsCommand({
        ...common,
        idempotencyKey: key("allocation"),
        allocations: lines.map((l) => ({
          replenishmentOrderLineId: l.id,
          allocatedQuantity: l.shippedQuantity.toString(),
          quantityUnit: "piece" as const,
        })),
      });
      if (
        allocations.length !== 1 ||
        allocations[0]!.payloadHash !== expected.payloadHash ||
        allocations[0]!.version !== 1 ||
        allocations[0]!.allocations.length !== lines.length ||
        allocations[0]!.allocations.some(
          (a) =>
            !lines.some(
              (l) =>
                a.replenishmentOrderLineId === l.id &&
                a.allocatedQuantity.toString() ===
                  l.shippedQuantity.toString() &&
                a.quantityUnit === l.quantityUnit,
            ),
        )
      )
        conflicts.push("REFERENCE_ALLOCATION_CONFLICT");
    }
  }
  if (stuffing.length) {
    if (allocations.length !== 1) conflicts.push("REFERENCE_STUFFING_CONFLICT");
    else {
      const expected = normalizeContainerStuffingSnapshotCommand({
        ...common,
        allocationSetId: allocations[0]!.id,
        allocationSetVersion: 1,
        containerNumber: f.containerNumber,
        sealNumber: f.synthetic.sealNumber,
        packageCount: f.retained.packageCount,
        grossWeight: f.retained.grossWeight,
        grossWeightUnit: "KGM",
        netWeight: null,
        volume: f.retained.volume,
        volumeUnit: "MTQ",
        vgm: f.synthetic.vgm,
        actorId: "development_demo",
        reasonCode: "synthetic_initial_conditions",
        idempotencyKey: key("stuffing"),
      });
      if (
        stuffing.length !== 1 ||
        stuffing[0]!.payloadHash !== expected.payloadHash ||
        stuffing[0]!.version !== 1 ||
        stuffing[0]!.allocationSetId !== expected.allocationSetId ||
        stuffing[0]!.allocationSetVersion !== expected.allocationSetVersion ||
        stuffing[0]!.sealNumber !== expected.sealNumber ||
        stuffing[0]!.containerNumber !== f.containerNumber ||
        stuffing[0]!.packageCount !== expected.packageCount ||
        stuffing[0]!.grossWeight.toString() !== expected.grossWeight ||
        stuffing[0]!.volume.toString() !== expected.volume ||
        stuffing[0]!.vgmWeight?.toString() !== expected.vgm?.weight ||
        stuffing[0]!.vgmMethod !== expected.vgm?.method ||
        stuffing[0]!.vgmVerifiedAt?.toISOString() !==
          expected.vgm?.verifiedAt ||
        hash(stuffing[0]!.evidenceRefs) !== hash(expected.evidenceRefs)
      )
        conflicts.push("REFERENCE_STUFFING_CONFLICT");
    }
  }
  if (dispatch.length) {
    if (stuffing.length !== 1) conflicts.push("REFERENCE_DISPATCH_CONFLICT");
    else {
      const expected = normalizeContainerDispatchSnapshotCommand({
        ...common,
        stuffingSnapshotId: stuffing[0]!.id,
        stuffingSnapshotVersion: 1,
        bookingNumber: f.synthetic.bookingNumber,
        carrierCode: f.retained.carrierCode,
        vesselName: f.retained.vesselName,
        voyageNumber: f.retained.voyageNumber,
        masterBillNumber: null,
        houseBillNumber: f.retained.houseBillNumber,
        vgmHandoffState: "accepted",
        actorId: "development_demo",
        reasonCode: "synthetic_initial_conditions",
        idempotencyKey: key("dispatch"),
      });
      if (
        dispatch.length !== 1 ||
        dispatch[0]!.payloadHash !== expected.payloadHash ||
        dispatch[0]!.version !== 1 ||
        Object.entries(expected).some(
          ([field, value]) =>
            ![
              "expectedVersion",
              "contractVersion",
              "payloadHash",
              "tenantId",
              "containerRecordId",
            ].includes(field) &&
            hash((dispatch[0] as unknown as Record<string, unknown>)[field]) !==
              hash(value),
        )
      )
        conflicts.push("REFERENCE_DISPATCH_CONFLICT");
    }
  }
  const state = {
    container,
    shipment,
    order,
    links,
    documents,
    documentLinks,
    lines,
    allocations,
    stuffing,
    dispatch,
    refs,
    evidence,
    cargo,
    pending,
    reviews,
    arrivals,
  };
  return {
    mode: "audit" as const,
    ready: conflicts.length === 0,
    conflicts,
    scenarioHash: referenceHash,
    auditHash: hash(state),
    preservedHash: hash({ pending, reviews, arrivals }),
    state,
  };
}

export async function runReferenceCase(options: ReferenceOptions) {
  assertRestoreTarget(options.connectionString, referenceFixture.tenantId);
  if (options.mode === "apply") assertReferenceApply(options, referenceFixture);
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: options.connectionString },
      { schema: "public" },
    ),
  });
  try {
    if (options.mode === "audit")
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return auditReferenceCase(tx as unknown as PrismaClient);
      });
    const before = await auditReferenceCase(prisma);
    if (!before.ready || !before.state)
      throw new Error(
        `REFERENCE_PREFLIGHT_CONFLICT:${before.conflicts.join(",")}`,
      );
    if (options.expectedAuditHash !== before.auditHash)
      throw new Error("REFERENCE_AUDIT_STALE");
    const result = await initializeReferenceCase(prisma, before.state);
    const after = await auditReferenceCase(prisma);
    if (!after.ready || after.preservedHash !== before.preservedHash)
      throw new Error("REFERENCE_POSTCHECK_CONFLICT");
    return {
      mode: "apply",
      scenarioHash: referenceHash,
      stages: result,
      audit: after,
    };
  } finally {
    await prisma.$disconnect();
  }
}

type ReferenceState = NonNullable<
  Awaited<ReturnType<typeof auditReferenceCase>>["state"]
>;
async function initializeReferenceCase(
  prisma: PrismaClient,
  before: ReferenceState,
) {
  const f = referenceFixture,
    t = f.tenantId,
    c = f.containerId;
  const servicesPrisma = prisma as unknown as PrismaService;
  const stages: string[] = [];
  const productRepository = new PrismaProductSkuRepository(servicesPrisma);
  const register = new RegisterProductSkuService(productRepository);
  const bind = new BindReplenishmentLineProductSkuService(
    new GetProductSkuService(productRepository),
    new PrismaReplenishmentLineSkuBinder(servicesPrisma),
  );
  for (const l of f.synthetic.lines)
    await register.execute({
      tenantId: t,
      productNumber: l.productNumber,
      idempotencyKey: key(`sku:${l.productNumber}`),
    });
  await new ReplaceReplenishmentOrderLinesService(
    new PrismaReplaceReplenishmentOrderLinesRepository(servicesPrisma),
  ).execute({
    tenantId: t,
    sourceBatchId: key("lines"),
    orderNumber: f.orderNumber,
    lines: f.synthetic.lines.map((l) => ({
      sourceRowId: l.productNumber,
      productNumber: l.productNumber,
      shippedQuantity: l.quantity,
      quantityUnit: l.quantityUnit,
      contractNumber: null,
    })),
  });
  const lines = await prisma.replenishmentOrderLine.findMany({
    where: { tenantId: t, sourceBatchId: key("lines"), isCurrent: true },
    orderBy: { productNumber: "asc" },
  });
  for (const line of lines) {
    const sku = await prisma.productSku.findUniqueOrThrow({
      where: {
        tenantId_productNumber: {
          tenantId: t,
          productNumber: line.productNumber,
        },
      },
    });
    await bind.execute({
      tenantId: t,
      replenishmentOrderLineId: line.id,
      productSkuId: sku.id,
      productNumber: line.productNumber,
      expectedVersion: line.version,
    });
  }
  stages.push("cargo-lines:initialized-or-reused");
  if (!before.evidence)
    await prisma.evidenceRecord.create({
      data: {
        id: evidenceId,
        tenantId: t,
        idempotencyKey: key("evidence"),
        evidenceType: "synthetic_fixture",
        subjectType: "container",
        subjectId: c,
        authorityLevel: "contextual",
        contentRef: "database/seeds/fixtures/ocean-reference-case-v1.json",
        contentHash: referenceHash,
        source: {
          classification: f.classification,
          scenarioVersion: f.scenarioVersion,
          notice: f.synthetic.notice,
        },
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        receivedAt: new Date(f.synthetic.stuffedAt),
        recordedAt: new Date(),
      },
    });
  const evidence = await prisma.evidenceRecord.findUniqueOrThrow({
    where: { id: evidenceId },
  });
  if (
    evidence.subjectId !== c ||
    evidence.tenantId !== t ||
    evidence.contentHash !== referenceHash ||
    evidence.verificationState !== "verified" ||
    evidence.validity !== "effective"
  )
    throw new Error("REFERENCE_EVIDENCE_CONFLICT");
  const common = {
    tenantId: t,
    containerRecordId: c,
    expectedVersion: 0,
    ingestionChannel: "file_import" as const,
    sourceSystem: f.sourceSystem,
    evidenceRefs: [evidenceId],
  };
  const allocationCommand = normalizeReplaceContainerCargoAllocationsCommand({
    ...common,
    idempotencyKey: key("allocation"),
    allocations: lines.map((l) => ({
      replenishmentOrderLineId: l.id,
      allocatedQuantity: l.shippedQuantity.toString(),
      quantityUnit: "piece" as const,
    })),
  });
  if (
    before.allocations[0] &&
    before.allocations[0].payloadHash !== allocationCommand.payloadHash
  )
    throw new Error("REFERENCE_ALLOCATION_CONFLICT");
  const allocation = before.allocations[0]
    ? {
        allocationSetId: before.allocations[0].id,
        version: before.allocations[0].version,
      }
    : await new ReplaceContainerCargoAllocationsService(
        new PrismaContainerCargoAllocationRepository(servicesPrisma),
      ).execute(allocationCommand);
  const stuffingCommand = normalizeContainerStuffingSnapshotCommand({
    ...common,
    allocationSetId: allocation.allocationSetId,
    allocationSetVersion: allocation.version,
    containerNumber: f.containerNumber,
    sealNumber: f.synthetic.sealNumber,
    packageCount: f.retained.packageCount,
    grossWeight: f.retained.grossWeight,
    grossWeightUnit: f.retained.grossWeightUnit,
    netWeight: null,
    volume: f.retained.volume,
    volumeUnit: f.retained.volumeUnit,
    vgm: f.synthetic.vgm,
    actorId: "development_demo",
    reasonCode: "synthetic_initial_conditions",
    idempotencyKey: key("stuffing"),
  });
  if (
    before.stuffing[0] &&
    before.stuffing[0].payloadHash !== stuffingCommand.payloadHash
  )
    throw new Error("REFERENCE_STUFFING_CONFLICT");
  const stuffingRepository = new PrismaContainerStuffingSnapshotRepository(
    servicesPrisma,
  );
  const stuffing = before.stuffing[0]
    ? { snapshotId: before.stuffing[0].id, version: before.stuffing[0].version }
    : await new ReplaceContainerStuffingSnapshotService(
        stuffingRepository,
      ).execute(stuffingCommand);
  const dispatchCommand = normalizeContainerDispatchSnapshotCommand({
    ...common,
    stuffingSnapshotId: stuffing.snapshotId,
    stuffingSnapshotVersion: stuffing.version,
    bookingNumber: f.synthetic.bookingNumber,
    carrierCode: f.retained.carrierCode,
    vesselName: f.retained.vesselName,
    voyageNumber: f.retained.voyageNumber,
    masterBillNumber: null,
    houseBillNumber: f.retained.houseBillNumber,
    vgmHandoffState: f.synthetic.vgmHandoffState,
    actorId: "development_demo",
    reasonCode: "synthetic_initial_conditions",
    idempotencyKey: key("dispatch"),
  });
  if (
    before.dispatch[0] &&
    before.dispatch[0].payloadHash !== dispatchCommand.payloadHash
  )
    throw new Error("REFERENCE_DISPATCH_CONFLICT");
  const dispatchRepository = new PrismaContainerDispatchSnapshotRepository(
    servicesPrisma,
  );
  const dispatch = before.dispatch[0]
    ? { snapshotId: before.dispatch[0].id, version: before.dispatch[0].version }
    : await new ReplaceContainerDispatchSnapshotService(
        dispatchRepository,
      ).execute(dispatchCommand);
  const readiness = await new GetContainerDispatchReadinessService(
    dispatchRepository,
    stuffingRepository,
  ).execute({ tenantId: t, containerRecordId: c, evidenceRefs: [evidenceId] });
  if (!readiness.confirmed) throw new Error("REFERENCE_DISPATCH_NOT_READY");
  stages.push("allocation-stuffing-dispatch:initialized-or-reused");
  await prisma.$transaction(async (tx) => {
    const current = await tx.shipment.findUniqueOrThrow({
      where: { id: f.shipmentId },
    });
    if (
      current.tenantId !== t ||
      (current.atdAt &&
        current.atdAt.toISOString() !==
          new Date(f.synthetic.actualDepartureAt).toISOString())
    )
      throw new Error("REFERENCE_ATD_CONFLICT");
    const provenance = await tx.shipmentUpstreamReference.findUnique({
      where: { id: referenceId },
    });
    if (provenance && !validProvenance(provenance, f))
      throw new Error("REFERENCE_SCENARIO_CONFLICT");
    if (!current.atdAt && provenance)
      throw new Error("REFERENCE_ATD_PROVENANCE_INCONSISTENT");
    if (current.shipmentNumber && current.shipmentNumber !== f.shipmentNumber)
      throw new Error("REFERENCE_SHIPMENT_NUMBER_CONFLICT");
    const link = before.links[0]!;
    const document = before.documents.find(
      (d) =>
        d.documentType === "hbl" &&
        d.documentNumber === f.retained.houseBillNumber,
    )!;
    const precise = await tx.shipmentContainerDocumentLink.findUnique({
      where: {
        tenantId_shipmentContainerLinkId_transportDocumentId: {
          tenantId: t,
          shipmentContainerLinkId: link.id,
          transportDocumentId: document.id,
        },
      },
    });
    if (!precise)
      await tx.shipmentContainerDocumentLink.create({
        data: {
          tenantId: t,
          shipmentId: f.shipmentId,
          containerRecordId: c,
          shipmentContainerLinkId: link.id,
          transportDocumentId: document.id,
          sourceHandoffId: link.sourceHandoffId,
        },
      });
    for (const [i, line] of lines.entries()) {
      const existing = await tx.shipmentCargoLine.findFirst({
        where: {
          tenantId: t,
          shipmentId: f.shipmentId,
          sourceLineId: line.productNumber,
          state: "active",
        },
      });
      if (!existing) {
        const bound = await tx.replenishmentOrderLine.findUniqueOrThrow({
          where: { id: line.id },
        });
        await tx.shipmentCargoLine.create({
          data: {
            tenantId: t,
            shipmentId: f.shipmentId,
            lineNo: i + 1,
            productSkuId: bound.productSkuId,
            productNumberSnapshot: line.productNumber,
            quantity: line.shippedQuantity,
            quantityUnit: line.quantityUnit,
            packageCount: f.synthetic.lines[i]!.packages,
            packageUnit: "carton",
            replenishmentOrderLineId: line.id,
            sourceHandoffId: link.sourceHandoffId,
            sourceLineId: line.productNumber,
          },
        });
      }
    }
    if (!provenance)
      await tx.shipmentUpstreamReference.create({
        data: {
          id: referenceId,
          tenantId: t,
          shipmentId: f.shipmentId,
          containerRecordId: c,
          referenceType: "stocking_order",
          sourceSystem: f.sourceSystem,
          sourceRecordId: f.scenarioVersion,
          sourceVersion: f.scenarioVersion,
          sourceLineId,
          metadata: {
            classification: f.classification,
            scenarioHash: referenceHash,
            actualDepartureAt: f.synthetic.actualDepartureAt,
            sourceTimezone: f.synthetic.sourceTimezone,
            sourcePrecision: f.synthetic.sourcePrecision,
            evidenceRefs: [evidenceId],
            allocationSetId: allocation.allocationSetId,
            stuffingSnapshotId: stuffing.snapshotId,
            dispatchSnapshotId: dispatch.snapshotId,
            synthetic: f.synthetic as unknown as Prisma.InputJsonValue,
          },
          sourceHandoffId: link.sourceHandoffId,
          version: 1,
          state: "active",
        },
      });
    if (!current.atdAt || !current.shipmentNumber)
      await tx.shipment.update({
        where: { id: f.shipmentId },
        data: {
          atdAt: new Date(f.synthetic.actualDepartureAt),
          shipmentNumber: current.shipmentNumber ?? f.shipmentNumber,
          updatedBy: "development_demo",
        },
      });
  });
  stages.push("formal-atd-and-provenance:initialized-or-reused");
  return stages;
}

function validProvenance(
  row: {
    tenantId: string;
    shipmentId: string;
    containerRecordId: string;
    state: string;
    sourceSystem: string;
    sourceRecordId: string;
    sourceVersion: string | null;
    metadata: unknown;
  },
  f: ReferenceFixture,
): boolean {
  const metadata = row.metadata as Record<string, unknown> | null;
  return (
    row.tenantId === f.tenantId &&
    row.shipmentId === f.shipmentId &&
    row.containerRecordId === f.containerId &&
    row.state === "active" &&
    row.sourceSystem === f.sourceSystem &&
    row.sourceRecordId === f.scenarioVersion &&
    row.sourceVersion === f.scenarioVersion &&
    metadata?.scenarioHash === referenceHash &&
    metadata.classification === f.classification &&
    metadata.actualDepartureAt === f.synthetic.actualDepartureAt
  );
}
function hash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value) ?? "null")
    .digest("hex");
}
