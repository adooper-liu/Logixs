import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { AssertEvidenceAvailableService } from "../../modules/document-records/application/assert-evidence-available.service";
import { PrismaEvidenceRepository } from "../../modules/document-records/infrastructure/prisma-evidence.repository";
import { RegisterProductSkuService } from "../../modules/master-data/application/register-product-sku.service";
import { ResolveProductSkusService } from "../../modules/master-data/application/resolve-product-skus.service";
import { PrismaProductSkuRepository } from "../../modules/master-data/infrastructure/prisma-product-sku.repository";
import { AcceptInternalShipmentHandoffBatchService } from "../../modules/shipment-lifecycle-orchestration/application/accept-internal-shipment-handoff-batch.service";
import { AcceptInternalShipmentHandoffService } from "../../modules/shipment-lifecycle-orchestration/application/accept-internal-shipment-handoff.service";
import { AcceptShipmentHandoffService } from "../../modules/shipment-lifecycle-orchestration/application/accept-shipment-handoff.service";
import { BindShipmentPendingSkuService } from "../../modules/shipment-lifecycle-orchestration/application/bind-shipment-pending-sku.service";
import { CompleteShipmentPendingDocumentsService } from "../../modules/shipment-lifecycle-orchestration/application/complete-shipment-pending-documents.service";
import { PreflightShipmentHandoffService } from "../../modules/shipment-lifecycle-orchestration/application/preflight-shipment-handoff.service";
import { CommitShipmentHandoffService } from "../../modules/shipment-registry/application/commit-shipment-handoff.service";
import { GetShipmentService } from "../../modules/shipment-registry/application/get-shipment.service";
import { PrismaInternalShipmentHandoffSource } from "../../modules/shipment-registry/infrastructure/prisma-internal-shipment-handoff-source";
import { PrismaShipmentHandoffAcceptanceRepository } from "../../modules/shipment-registry/infrastructure/prisma-shipment-handoff-acceptance.repository";
import { PrismaShipmentHandoffConflictInspector } from "../../modules/shipment-registry/infrastructure/prisma-shipment-handoff-conflict-inspector";
import { PrismaShipmentPendingDocumentCompletion } from "../../modules/shipment-registry/infrastructure/prisma-shipment-pending-document-completion";
import { PrismaShipmentPendingSkuBinding } from "../../modules/shipment-registry/infrastructure/prisma-shipment-pending-sku-binding";
import { PrismaShipmentReadRepository } from "../../modules/shipment-registry/infrastructure/prisma-shipment-read.repository";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_int_handoff_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const repositoryRoot = resolve(__dirname, "../../../../..");
let prisma: PrismaClient;

beforeAll(async () => {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error("INTEGRATION_PNPM_ENTRYPOINT_MISSING");
  execFileSync(process.execPath, [pnpmEntrypoint, "db:migrate"], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
  prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: testDatabaseUrl },
      { schema: schemaName },
    ),
  });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
  const admin = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: withSchema(BASE_DATABASE_URL, "public") },
      { schema: "public" },
    ),
  });
  try {
    await admin.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await admin.$disconnect();
  }
});

describe("internal Shipment handoff operational closeout", () => {
  it("reuses fulfillment facts, survives a new read session and closes after missing data is completed", async () => {
    const fixture = await createInternalFulfillmentFixture();
    const source = new PrismaInternalShipmentHandoffSource(prisma as never);
    const candidates = await source.listCandidates({
      tenantId: fixture.tenantId,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      containers: [{ containerRecordId: fixture.containerId }],
      replenishmentOrders: [{ orderNumber: "26DSC01812" }],
      cargoLines: [
        {
          replenishmentOrderLineId: fixture.orderLineId,
          productSkuId: null,
          productNumber: "311-013GY",
        },
      ],
    });

    const acceptanceRepository = new PrismaShipmentHandoffAcceptanceRepository(
      prisma as never,
    );
    const accept = new AcceptShipmentHandoffService(
      new PreflightShipmentHandoffService(
        new PrismaShipmentHandoffConflictInspector(prisma as never),
      ),
      new CommitShipmentHandoffService(acceptanceRepository),
      new AssertEvidenceAvailableService(
        new PrismaEvidenceRepository(prisma as never),
      ),
    );
    const internalAcceptance = new AcceptInternalShipmentHandoffService(
      source,
      accept,
    );
    const batch = new AcceptInternalShipmentHandoffBatchService(
      internalAcceptance,
    );
    const command = {
      contractVersion: "internal-shipment-handoff-batch-accept.v1" as const,
      candidateRefs: [candidates[0]!.candidateRef] as [string, ...string[]],
      idempotencyKey: "internal-closeout-batch-1",
    };

    const accepted = await batch.execute(command, {
      tenantId: fixture.tenantId,
      actorId: fixture.actorId,
    });
    const replay = await batch.execute(command, {
      tenantId: fixture.tenantId,
      actorId: fixture.actorId,
    });
    const shipmentId = accepted.items[0]!.shipmentId!;

    expect(accepted.items[0]).toMatchObject({
      status: "accepted",
      shipmentId,
      recoveryAction: "open_shipment",
    });
    expect(replay.items[0]).toMatchObject({
      status: "duplicate",
      shipmentId,
    });
    await expect(
      prisma.containerRecord.count({ where: { tenantId: fixture.tenantId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.containerCargoAllocationSet.count({
        where: {
          tenantId: fixture.tenantId,
          containerRecordId: fixture.containerId,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.containerCargoAllocation.findMany({
        where: {
          tenantId: fixture.tenantId,
          allocationSet: { containerRecordId: fixture.containerId },
        },
        select: {
          replenishmentOrderLineId: true,
          shipmentCargoLine: { select: { replenishmentOrderLineId: true } },
        },
      }),
    ).resolves.toEqual([
      {
        replenishmentOrderLineId: fixture.orderLineId,
        shipmentCargoLine: {
          replenishmentOrderLineId: fixture.orderLineId,
        },
      },
    ]);

    const resumedReadRepository = new PrismaShipmentReadRepository(
      prisma as never,
    );
    const pending = await resumedReadRepository.listPendingCompletion({
      tenantId: fixture.tenantId,
      take: 20,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]?.shipment.id).toBe(shipmentId);
    expect(pending[0]?.pendingItems.map(({ code }) => code).sort()).toEqual([
      "bill_of_lading_missing",
      "product_sku_missing",
    ]);

    const getShipment = new GetShipmentService(resumedReadRepository);
    const detail = await getShipment.execute({
      tenantId: fixture.tenantId,
      id: shipmentId,
    });
    expect(detail.containers).toMatchObject([
      {
        containerRecordId: fixture.containerId,
        allocations: [
          {
            allocatedQuantity: "20",
            quantityUnit: "piece",
          },
        ],
      },
    ]);
    expect(detail.upstreamReferences).toMatchObject([
      {
        sourceRecordId: "26DSC01812",
        sourceLineId: fixture.orderLineId,
      },
    ]);

    const skuRepository = new PrismaProductSkuRepository(prisma as never);
    const bindSku = new BindShipmentPendingSkuService(
      new ResolveProductSkusService(skuRepository),
      new RegisterProductSkuService(skuRepository),
      getShipment,
      new PrismaShipmentPendingSkuBinding(prisma as never),
    );
    await bindSku.execute(
      shipmentId,
      {
        contractVersion: "shipment-pending-sku-binding.v1",
        expectedRelationshipVersion: detail.shipment.relationshipVersion,
        expectedCargoLineVersion: detail.cargoLines[0]!.version,
        occurredAt: "2026-09-25T08:00:00.000Z",
        idempotencyKey: "internal-closeout-bind-sku-1",
        cargoLineId: detail.cargoLines[0]!.id,
      },
      { tenantId: fixture.tenantId, actorId: fixture.actorId },
    );
    await new CompleteShipmentPendingDocumentsService(
      getShipment,
      new PrismaShipmentPendingDocumentCompletion(prisma as never),
    ).execute(
      shipmentId,
      {
        contractVersion: "shipment-pending-document-completion.v1",
        expectedRelationshipVersion: detail.shipment.relationshipVersion,
        occurredAt: "2026-09-25T08:01:00.000Z",
        idempotencyKey: "internal-closeout-add-mbl-1",
        documents: [
          {
            documentType: "mbl",
            documentNumber: "NBOZ9FF56400",
            scac: "HDMU",
            containerRecordIds: [fixture.containerId],
          },
        ],
      },
      { tenantId: fixture.tenantId, actorId: fixture.actorId },
    );

    const nextSessionReadRepository = new PrismaShipmentReadRepository(
      prisma as never,
    );
    await expect(
      nextSessionReadRepository.listPendingCompletion({
        tenantId: fixture.tenantId,
        take: 20,
      }),
    ).resolves.toEqual([]);
    await expect(
      source.listCandidates({ tenantId: fixture.tenantId }),
    ).resolves.toEqual([]);
  });
});

async function createInternalFulfillmentFixture(): Promise<{
  tenantId: string;
  actorId: string;
  containerId: string;
  orderLineId: string;
}> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const containerId = randomUUID();
  const orderId = randomUUID();
  const orderLineId = randomUUID();
  const allocationSetId = randomUUID();
  const stuffingSnapshotId = randomUUID();
  const dispatchSnapshotId = randomUUID();
  const routePlanId = randomUUID();
  const evidenceId = randomUUID();
  const occurredAt = new Date("2026-09-24T00:00:00.000Z");

  await prisma.replenishmentOrder.create({
    data: { id: orderId, tenantId, orderNumber: "26DSC01812" },
  });
  await prisma.replenishmentOrderLine.create({
    data: {
      id: orderLineId,
      tenantId,
      replenishmentOrderId: orderId,
      productNumber: "311-013GY",
      shippedQuantity: "20",
      quantityUnit: "piece",
      sourceBatchId: `fixture-${tenantId}`,
      sourceRowId: "line-1",
    },
  });
  await prisma.containerRecord.create({
    data: {
      id: containerId,
      tenantId,
      containerNumber: "HMMU4956442",
      containerTypeCode: "40HQ",
      currentStatus: "shipped",
    },
  });
  await prisma.containerCargoAllocationSet.create({
    data: {
      id: allocationSetId,
      tenantId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      ingestionChannel: "api",
      sourceSystem: "logix.container_stuffing",
      evidenceRefs: [evidenceId],
      idempotencyKey: `allocation-${containerId}`,
      payloadHash: "a".repeat(64),
    },
  });
  await prisma.containerCargoAllocation.create({
    data: {
      tenantId,
      allocationSetId,
      replenishmentOrderLineId: orderLineId,
      allocatedQuantity: "20",
      quantityUnit: "piece",
      packageCount: "2",
      packageUnit: "carton",
      grossWeight: "120.5",
      weightUnit: "kg",
      volume: "3.25",
      volumeUnit: "m3",
    },
  });
  await prisma.containerStuffingSnapshot.create({
    data: {
      id: stuffingSnapshotId,
      tenantId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      allocationSetId,
      allocationSetVersion: 1,
      containerNumber: "HMMU4956442",
      sealNumber: "SEAL-001",
      packageCount: 2,
      grossWeight: "120.5",
      grossWeightUnit: "KGM",
      volume: "3.25",
      volumeUnit: "MTQ",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.container_stuffing",
      evidenceRefs: [evidenceId],
      actorId,
      reasonCode: "stuffing_confirmed",
      idempotencyKey: `stuffing-${containerId}`,
      payloadHash: "b".repeat(64),
    },
  });
  await prisma.containerDispatchSnapshot.create({
    data: {
      id: dispatchSnapshotId,
      tenantId,
      containerRecordId: containerId,
      version: 1,
      state: "active",
      stuffingSnapshotId,
      stuffingSnapshotVersion: 1,
      bookingNumber: "BK-001",
      carrierCode: "HMM",
      vesselName: "ONE INNOVATION",
      voyageNumber: "001E",
      vgmHandoffState: "accepted",
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.shipment_dispatch",
      evidenceRefs: [evidenceId],
      actorId,
      reasonCode: "loaded_on_vessel",
      idempotencyKey: `dispatch-${containerId}`,
      payloadHash: "c".repeat(64),
    },
  });
  await prisma.oceanRoutePlan.create({
    data: {
      id: routePlanId,
      containerId,
      version: 1,
      status: "active",
      activatedAt: occurredAt,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.shipment_dispatch",
      evidenceRefs: [evidenceId],
      actorId,
      reasonCode: "route_confirmed",
      idempotencyKey: `route-${containerId}`,
      payloadHash: "d".repeat(64),
      traceId: `trace-route-${containerId}`,
      segments: {
        create: {
          sequence: 1,
          transportMode: "vessel",
          originUnlocode: "CNSHA",
          originTimezone: "Asia/Shanghai",
          destinationLocationType: "port",
          destinationUnlocode: "USLAX",
          destinationTimezone: "America/Los_Angeles",
          isFinal: true,
        },
      },
    },
  });
  await prisma.evidenceRecord.create({
    data: {
      id: evidenceId,
      tenantId,
      idempotencyKey: `departure-evidence-${containerId}`,
      evidenceType: "carrier_event",
      subjectType: "container",
      subjectId: containerId,
      authorityLevel: "authoritative",
      contentRef: `fixture://${evidenceId}`,
      contentHash: "e".repeat(64),
      source: { sourceSystem: "carrier" },
      verificationState: "verified",
      confidenceState: "confirmed",
      validity: "effective",
      receivedAt: occurredAt,
      recordedAt: occurredAt,
    },
  });
  await prisma.lifecycleDateFact.create({
    data: {
      tenantId,
      containerId,
      nodeCode: "origin_departure",
      eventCode: "departed",
      timeKind: "actual",
      occurredAt,
      rawValue: "2026-09-24",
      sourceUtcOffset: "+08:00",
      ingestionChannel: "api",
      captureSource: "external_evidence",
      sourceSystem: "carrier",
      authoritySystem: "carrier",
      verificationState: "verified",
      confidenceState: "confirmed",
      validity: "effective",
      locationType: "port",
      unlocode: "CNSHA",
      locationTimezone: "Asia/Shanghai",
      evidenceRefs: [evidenceId],
      idempotencyKey: `departure-fact-${containerId}`,
      payloadHash: "f".repeat(64),
      applicationState: "pending_application",
      projectionVersion: 1,
      traceId: `trace-departure-${containerId}`,
      receivedAt: occurredAt,
    },
  });

  return { tenantId, actorId, containerId, orderLineId };
}

function withSchema(connectionString: string, schema: string): string {
  const url = new URL(connectionString);
  url.searchParams.set("schema", schema);
  return url.toString();
}
