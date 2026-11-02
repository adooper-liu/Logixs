import { createHash } from "node:crypto";
import type { PrismaClient } from "../../../../../../generated/prisma";

export const OCEAN_DEMO = {
  tenantId: "demo-real-sample-20260921",
  containerNumber: "MEDU7620177",
  orderNumber: "26DSA01885",
  houseBillNumber: "1811F026PE36668R2",
  shipmentSourceRecordId: "development-demo:MEDU7620177:HD638A",
  sourceVersion: "post-departure-20260923-v1",
  etaIdempotencyKey: "development-demo:ocean:MEDU7620177:destination-eta:v1",
} as const;

const IDS = {
  shipment: "71000000-0000-4000-8000-000000000003",
  handoff: "71000000-0000-4000-8000-000000000004",
  link: "71000000-0000-4000-8000-000000000005",
  document: "71000000-0000-4000-8000-000000000006",
  reference: "71000000-0000-4000-8000-000000000007",
  sourceIdentity: "71000000-0000-4000-8000-000000000008",
} as const;

export interface OceanDemoRestoreResult {
  tenantId: string;
  containerId: string;
  shipmentId: string;
  handoffId: string;
  linkId: string;
  documentId: string;
  referenceId: string;
  etaFactId: string;
  created: string[];
  reused: string[];
}

export function assertRestoreTarget(
  connectionString: string,
  tenantId: string,
): { database: string; schema: string } {
  const url = new URL(connectionString);
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    [...url.searchParams.keys()].some((key) => key !== "schema")
  )
    throw new Error("OCEAN_DEMO_TARGET_MUST_BE_LOCAL");
  const database = url.pathname.replace(/^\//, "");
  const schema = url.searchParams.get("schema") ?? "public";
  if (database !== "logix" || schema !== "public")
    throw new Error("OCEAN_DEMO_TARGET_MUST_BE_LOGIX_PUBLIC");
  if (tenantId !== OCEAN_DEMO.tenantId)
    throw new Error("OCEAN_DEMO_TENANT_NOT_ALLOWED");
  return { database, schema };
}

export async function restoreOceanReviewSample(
  prisma: PrismaClient,
  tenantId = OCEAN_DEMO.tenantId,
): Promise<OceanDemoRestoreResult> {
  if (tenantId !== OCEAN_DEMO.tenantId)
    throw new Error("OCEAN_DEMO_TENANT_NOT_ALLOWED");

  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    const reused: string[] = [];
    const mark = (name: string, exists: boolean) =>
      (exists ? reused : created).push(name);

    const existingOrder = await tx.replenishmentOrder.findUnique({
      where: {
        tenantId_orderNumber: { tenantId, orderNumber: OCEAN_DEMO.orderNumber },
      },
    });
    const order =
      existingOrder ??
      (await tx.replenishmentOrder.create({
        data: { tenantId, orderNumber: OCEAN_DEMO.orderNumber },
      }));
    mark("replenishmentOrder", Boolean(existingOrder));

    const containers = await tx.containerRecord.findMany({
      where: { tenantId, containerNumber: OCEAN_DEMO.containerNumber },
    });
    if (containers.length > 1)
      throw new Error("OCEAN_DEMO_CONTAINER_IDENTITY_AMBIGUOUS");
    const existingContainer = containers[0] ?? null;
    if (
      existingContainer?.replenishmentOrderId &&
      existingContainer.replenishmentOrderId !== order.id
    )
      throw new Error("OCEAN_DEMO_CONTAINER_ORDER_CONFLICT");
    const container =
      existingContainer ??
      (await tx.containerRecord.create({
        data: {
          tenantId,
          orderNumber: OCEAN_DEMO.orderNumber,
          mainOrderNumber: OCEAN_DEMO.orderNumber,
          replenishmentOrderId: order.id,
          containerNumber: OCEAN_DEMO.containerNumber,
          containerTypeCode: "40HQ",
          currentStatus: "in_transit",
        },
      }));
    mark("containerRecord", Boolean(existingContainer));

    const existingIdentity = await tx.containerSourceIdentity.findUnique({
      where: {
        tenantId_sourceSystem_sourceRecordId: {
          tenantId,
          sourceSystem: "development_demo.retained_source_package",
          sourceRecordId: OCEAN_DEMO.containerNumber,
        },
      },
    });
    if (existingIdentity && existingIdentity.containerRecordId !== container.id)
      throw new Error("OCEAN_DEMO_SOURCE_IDENTITY_CONFLICT");
    const sourceIdentity =
      existingIdentity ??
      (await tx.containerSourceIdentity.create({
        data: {
          id: IDS.sourceIdentity,
          tenantId,
          sourceSystem: "development_demo.retained_source_package",
          sourceRecordId: OCEAN_DEMO.containerNumber,
          containerRecordId: container.id,
        },
      }));
    mark("containerSourceIdentity", Boolean(existingIdentity));
    void sourceIdentity;

    const existingShipment = await tx.shipment.findUnique({
      where: {
        tenantId_sourceSystem_sourceRecordId: {
          tenantId,
          sourceSystem: "development_demo.retained_source_package",
          sourceRecordId: OCEAN_DEMO.shipmentSourceRecordId,
        },
      },
    });
    if (
      existingShipment &&
      (existingShipment.transportMode !== "ocean" ||
        existingShipment.vesselName !== "MSC MAKALU III" ||
        existingShipment.voyageNumber !== "HD638A")
    )
      throw new Error("OCEAN_DEMO_SHIPMENT_IDENTITY_CONFLICT");
    const shipment =
      existingShipment ??
      (await tx.shipment.create({
        data: {
          id: IDS.shipment,
          tenantId,
          shipmentNumber: null,
          sourceSystem: "development_demo.retained_source_package",
          sourceRecordId: OCEAN_DEMO.shipmentSourceRecordId,
          sourceVersion: OCEAN_DEMO.sourceVersion,
          transportMode: "ocean",
          carrierCode: "MSC",
          vesselName: "MSC MAKALU III",
          voyageNumber: "HD638A",
          originCountryCode: "CN",
          originUnlocode: "CNFOC",
          destinationCountryCode: "US",
          destinationUnlocode: "USSAV",
          etdAt: new Date("2026-09-23T00:00:00+08:00"),
          atdAt: null,
          etaAt: null,
          ataAt: null,
          currentLifecycleStatus: "in_transit",
          createdBy: "development_demo",
          updatedBy: "development_demo",
        },
      }));
    mark("shipment", Boolean(existingShipment));

    // Historical date-only departure observations are retained, never promoted
    // or recreated as a second actual-departure field by this legacy fixture.
    const existingDepartureFact = await tx.shipmentTimeFact.findUnique({
      where: {
        sourceBatchId_sourceRowId_factCode: {
          sourceBatchId: `${OCEAN_DEMO.sourceVersion}:departure`,
          sourceRowId: OCEAN_DEMO.containerNumber,
          factCode: "departure",
        },
      },
    });
    if (
      existingDepartureFact &&
      existingDepartureFact.containerRecordId !== container.id
    )
      throw new Error("OCEAN_DEMO_DEPARTURE_FACT_CONFLICT");

    const handoffKey = "development-demo:ocean:MEDU7620177:handoff:v1";
    const existingHandoff = await tx.shipmentHandoffRecord.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey: handoffKey },
      },
    });
    if (
      existingHandoff?.shipmentId &&
      existingHandoff.shipmentId !== shipment.id
    )
      throw new Error("OCEAN_DEMO_HANDOFF_CONFLICT");
    const payloadJson = {
      classification: "development_demo",
      containerNumber: OCEAN_DEMO.containerNumber,
      retainedFixtureVersion: OCEAN_DEMO.sourceVersion,
    };
    const handoff =
      existingHandoff ??
      (await tx.shipmentHandoffRecord.create({
        data: {
          id: IDS.handoff,
          tenantId,
          sourceProfile: "standard_departed_import_v1",
          ingestionChannel: "manual",
          sourceSystem: "development_demo.retained_source_package",
          externalHandoffId: "MEDU7620177-arrival-preparation",
          handoffVersion: 1,
          occurredAt: new Date("2026-10-26T00:00:00Z"),
          idempotencyKey: handoffKey,
          payloadHash: hash(payloadJson),
          payloadJson,
          status: "accepted",
          shipmentId: shipment.id,
          actorId: "development_demo",
          traceId: "development-demo-ocean-MEDU7620177",
        },
      }));
    mark("shipmentHandoffRecord", Boolean(existingHandoff));

    const activeLinks = await tx.shipmentContainerLink.findMany({
      where: {
        tenantId,
        containerRecordId: container.id,
        state: "active",
        supersededAt: null,
      },
    });
    if (activeLinks.some((link) => link.shipmentId !== shipment.id))
      throw new Error("OCEAN_DEMO_ACTIVE_SHIPMENT_LINK_CONFLICT");
    if (activeLinks.length > 1)
      throw new Error("OCEAN_DEMO_ACTIVE_SHIPMENT_LINK_AMBIGUOUS");
    const existingLink = activeLinks[0] ?? null;
    const link =
      existingLink ??
      (await tx.shipmentContainerLink.create({
        data: {
          id: IDS.link,
          tenantId,
          shipmentId: shipment.id,
          containerRecordId: container.id,
          version: 1,
          state: "active",
          sourceHandoffId: handoff.id,
          evidenceRefs: ["retained-fixture:MEDU7620177:container"],
          idempotencyKey: "development-demo:ocean:MEDU7620177:link:v1",
          joinedAt: new Date("2026-10-26T00:00:00Z"),
        },
      }));
    mark("shipmentContainerLink", Boolean(existingLink));

    const existingDocument = await tx.shipmentTransportDocument.findFirst({
      where: {
        tenantId,
        shipmentId: shipment.id,
        documentType: "hbl",
        documentNumber: OCEAN_DEMO.houseBillNumber,
        state: "active",
      },
    });
    const document =
      existingDocument ??
      (await tx.shipmentTransportDocument.create({
        data: {
          id: IDS.document,
          tenantId,
          shipmentId: shipment.id,
          documentType: "hbl",
          documentNumber: OCEAN_DEMO.houseBillNumber,
          scac: "MSCU",
          version: 1,
          state: "active",
          sourceHandoffId: handoff.id,
          effectiveFrom: new Date("2026-09-23T00:00:00Z"),
        },
      }));
    mark("shipmentTransportDocument", Boolean(existingDocument));

    const existingReference = await tx.shipmentUpstreamReference.findFirst({
      where: {
        tenantId,
        shipmentId: shipment.id,
        containerRecordId: container.id,
        referenceType: "stocking_order",
        sourceSystem: "retained_source_package",
        sourceRecordId: OCEAN_DEMO.containerNumber,
        state: "active",
      },
    });
    const reference =
      existingReference ??
      (await tx.shipmentUpstreamReference.create({
        data: {
          id: IDS.reference,
          tenantId,
          shipmentId: shipment.id,
          containerRecordId: container.id,
          referenceType: "stocking_order",
          sourceSystem: "retained_source_package",
          sourceRecordId: OCEAN_DEMO.containerNumber,
          sourceVersion: OCEAN_DEMO.sourceVersion,
          sourceLineId: "container-row-1",
          metadata: {
            classification: "development_demo",
            replenishmentOrderNumber: OCEAN_DEMO.orderNumber,
            houseBillNumber: OCEAN_DEMO.houseBillNumber,
            oceanFreightAmount: "3925",
            oceanFreightCurrency: "USD",
            oceanFreightSourceReference:
              "retained-fixture:MEDU7620177:ocean-freight",
          },
          sourceHandoffId: handoff.id,
          version: 1,
          state: "active",
        },
      }));
    mark("shipmentUpstreamReference", Boolean(existingReference));

    const existingEta = await tx.lifecycleDateFact.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: OCEAN_DEMO.etaIdempotencyKey,
        },
      },
    });
    if (
      existingEta &&
      (existingEta.containerId !== container.id ||
        existingEta.nodeCode !== "destination_arrival" ||
        existingEta.eventCode !== "arrived" ||
        existingEta.timeKind !== "estimated" ||
        existingEta.rawValue !== "2026-11-01")
    )
      throw new Error("OCEAN_DEMO_ETA_IDEMPOTENCY_CONFLICT");
    const competingEta = await tx.lifecycleDateFact.findFirst({
      where: {
        tenantId,
        containerId: container.id,
        nodeCode: "destination_arrival",
        eventCode: "arrived",
        timeKind: "estimated",
        isCurrent: true,
        id: existingEta ? { not: existingEta.id } : undefined,
      },
    });
    if (competingEta) throw new Error("OCEAN_DEMO_CURRENT_ETA_CONFLICT");
    const maxVersion = await tx.lifecycleDateFact.aggregate({
      where: { containerId: container.id },
      _max: { projectionVersion: true },
    });
    const etaPayload = {
      containerId: container.id,
      nodeCode: "destination_arrival",
      eventCode: "arrived",
      timeKind: "estimated",
      rawValue: "2026-11-01",
      sourceVersion: OCEAN_DEMO.sourceVersion,
    };
    const eta =
      existingEta ??
      (await tx.lifecycleDateFact.create({
        data: {
          tenantId,
          containerId: container.id,
          nodeCode: "destination_arrival",
          eventCode: "arrived",
          timeKind: "estimated",
          occurredAt: new Date("2026-11-01T00:00:00-04:00"),
          rawValue: "2026-11-01",
          sourceUtcOffset: "-04:00",
          ingestionChannel: "file_import",
          captureSource: "controlled_import",
          sourceSystem: "development_demo.retained_source_package",
          authoritySystem: "development_demo",
          mappingVersion: OCEAN_DEMO.sourceVersion,
          verificationState: "pending",
          confidenceState: "provisional",
          validity: "effective",
          locationType: "port",
          unlocode: "USSAV",
          locationTimezone: "America/New_York",
          evidenceRefs: ["retained-fixture:MEDU7620177:eta"],
          actorId: "development_demo",
          reasonCode: "arrival_preparation_demo",
          idempotencyKey: OCEAN_DEMO.etaIdempotencyKey,
          payloadHash: hash(etaPayload),
          isCurrent: true,
          applicationState: "not_applicable",
          applicationReasonCode: "estimated_fact",
          canonicalEventId: null,
          projectionVersion: (maxVersion._max.projectionVersion ?? 0) + 1,
          traceId: "development-demo-ocean-MEDU7620177",
          receivedAt: new Date("2026-10-26T00:00:00Z"),
        },
      }));
    mark("lifecycleDateFact", Boolean(existingEta));

    return {
      tenantId,
      containerId: container.id,
      shipmentId: shipment.id,
      handoffId: handoff.id,
      linkId: link.id,
      documentId: document.id,
      referenceId: reference.id,
      etaFactId: eta.id,
      created,
      reused,
    };
  });
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
