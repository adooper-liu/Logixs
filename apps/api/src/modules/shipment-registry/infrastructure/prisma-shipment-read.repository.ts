import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerLifecycleState,
  LifecycleNodeCode,
  ShipmentContainerAllocationV1,
  ShipmentDetailV1,
  ShipmentLifecycleInitializationStateV1,
  ShipmentLifecycleStatusV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ShipmentByIdQuery,
  ShipmentDetailProjection,
  ShipmentListQuery,
  ShipmentReadRepository,
} from "../domain/shipment-read.repository";

const POST_DEPARTURE_EVENT_TYPE = "shipment.lifecycle_initialization_requested";
const POST_DEPARTURE_DEFINITION = "post_departure_ocean";
const POST_DEPARTURE_DEFINITION_VERSION = 1;

const summarySelect = Prisma.validator<Prisma.ShipmentSelect>()({
  id: true,
  shipmentNumber: true,
  transportMode: true,
  carrierCode: true,
  vesselName: true,
  voyageNumber: true,
  originCountryCode: true,
  originUnlocode: true,
  destinationCountryCode: true,
  destinationUnlocode: true,
  cargoOwnerId: true,
  cargoOwner: {
    select: {
      legalName: true,
      salesCountry: { select: { alpha2: true } },
    },
  },
  atdAt: true,
  etaAt: true,
  currentLifecycleStatus: true,
  lifecycleVersion: true,
  relationshipVersion: true,
  updatedAt: true,
  containerLinks: {
    where: { state: "active", supersededAt: null },
    select: { containerRecordId: true },
  },
  cargoLines: {
    where: { state: "active", supersededAt: null },
    select: { id: true },
  },
  lifecycleFlows: {
    select: {
      containerId: true,
      definitionCode: true,
      definitionVersion: true,
      shipmentRelationshipVersion: true,
    },
  },
});

const detailSelect = Prisma.validator<Prisma.ShipmentSelect>()({
  ...summarySelect,
  containerLinks: {
    where: { state: "active", supersededAt: null },
    orderBy: [{ containerRecord: { containerNumber: "asc" } }, { id: "asc" }],
    select: {
      id: true,
      containerRecordId: true,
      version: true,
      containerRecord: {
        select: {
          containerNumber: true,
          containerTypeCode: true,
          sealNumber: true,
          currentStatus: true,
        },
      },
    },
  },
  cargoLines: {
    where: { state: "active", supersededAt: null },
    orderBy: [{ lineNo: "asc" }, { id: "asc" }],
    select: {
      id: true,
      lineNo: true,
      productSkuId: true,
      productNumberSnapshot: true,
      quantity: true,
      quantityUnit: true,
      packageCount: true,
      packageUnit: true,
      grossWeight: true,
      weightUnit: true,
      volume: true,
      volumeUnit: true,
      replenishmentOrderLineId: true,
      sourceLineId: true,
      version: true,
    },
  },
  transportDocuments: {
    where: { state: "active", supersededAt: null },
    orderBy: [
      { documentType: "asc" },
      { documentNumber: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      scac: true,
      parentDocumentId: true,
      version: true,
      effectiveFrom: true,
      containerLinks: {
        select: { containerRecordId: true },
        orderBy: { containerRecordId: "asc" },
      },
    },
  },
  upstreamReferences: {
    where: { state: "active", supersededAt: null },
    orderBy: [
      { referenceType: "asc" },
      { sourceRecordId: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      containerRecordId: true,
      shipmentCargoLineId: true,
      referenceType: true,
      sourceSystem: true,
      sourceRecordId: true,
      sourceVersion: true,
      sourceLineId: true,
      version: true,
    },
  },
  handoffs: {
    where: { status: { in: ["accepted", "superseded"] } },
    orderBy: [{ handoffVersion: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      id: true,
      handoffVersion: true,
      sourceSystem: true,
      status: true,
      occurredAt: true,
      traceId: true,
    },
  },
  lifecycleFlows: {
    select: {
      containerId: true,
      state: true,
      currentNodeCode: true,
      definitionCode: true,
      definitionVersion: true,
      shipmentRelationshipVersion: true,
    },
  },
});

const allocationSelect =
  Prisma.validator<Prisma.ContainerCargoAllocationSelect>()({
    shipmentCargoLineId: true,
    allocatedQuantity: true,
    quantityUnit: true,
    packageCount: true,
    packageUnit: true,
    grossWeight: true,
    weightUnit: true,
    volume: true,
    volumeUnit: true,
    allocationSet: { select: { containerRecordId: true } },
  });

type SummaryRow = Prisma.ShipmentGetPayload<{ select: typeof summarySelect }>;
type DetailRow = Prisma.ShipmentGetPayload<{ select: typeof detailSelect }>;
type AllocationRow = Prisma.ContainerCargoAllocationGetPayload<{
  select: typeof allocationSelect;
}>;

type LifecycleSignal = {
  state: "pending" | "manual_review";
  lastErrorCode: string | null;
};

@Injectable()
export class PrismaShipmentReadRepository implements ShipmentReadRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ShipmentListQuery): Promise<ShipmentSummaryV1[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        tenantId: query.tenantId,
        ...(query.status ? { currentLifecycleStatus: query.status } : {}),
        ...(query.after
          ? {
              OR: [
                { updatedAt: { lt: query.after.updatedAt } },
                {
                  AND: [
                    { updatedAt: query.after.updatedAt },
                    { id: { lt: query.after.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
      select: summarySelect,
    });
    const signals = await this.loadLifecycleSignals(
      query.tenantId,
      rows.map(({ id }) => id),
    );
    return rows.map((row) => toSummary(row, signals.get(row.id)));
  }

  async findById(
    query: ShipmentByIdQuery,
  ): Promise<ShipmentDetailProjection | null> {
    const row = await this.prisma.shipment.findFirst({
      where: { id: query.id, tenantId: query.tenantId },
      select: detailSelect,
    });
    if (!row) return null;

    const [allocations, signals] = await Promise.all([
      this.prisma.containerCargoAllocation.findMany({
        where: {
          tenantId: query.tenantId,
          allocationSet: { state: "active" },
          shipmentCargoLine: {
            shipmentId: query.id,
            state: "active",
            supersededAt: null,
          },
        },
        orderBy: [{ allocationSetId: "asc" }, { shipmentCargoLineId: "asc" }],
        select: allocationSelect,
      }),
      this.loadLifecycleSignals(query.tenantId, [query.id]),
    ]);
    return toDetail(row, allocations, signals.get(query.id));
  }

  private async loadLifecycleSignals(
    tenantId: string,
    shipmentIds: string[],
  ): Promise<Map<string, LifecycleSignal>> {
    if (shipmentIds.length === 0) return new Map();
    const outboxes = await this.prisma.outboxMessage.findMany({
      where: {
        tenantId,
        ownerModule: "shipment-registry",
        eventType: POST_DEPARTURE_EVENT_TYPE,
        aggregateType: "shipment",
        aggregateId: { in: shipmentIds },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        aggregateId: true,
        eventId: true,
        state: true,
        lastErrorCode: true,
      },
    });
    const latestByShipment = new Map<string, (typeof outboxes)[number]>();
    for (const outbox of outboxes) {
      if (!latestByShipment.has(outbox.aggregateId)) {
        latestByShipment.set(outbox.aggregateId, outbox);
      }
    }
    const inboxes = await this.prisma.inboxMessage.findMany({
      where: {
        tenantId,
        consumerName: "lifecycle-control-inbox",
        messageId: {
          in: [...latestByShipment.values()].map(({ eventId }) => eventId),
        },
      },
      select: { messageId: true, state: true, lastErrorCode: true },
    });
    const inboxByEvent = new Map(inboxes.map((row) => [row.messageId, row]));
    return new Map(
      [...latestByShipment].map(([shipmentId, outbox]) => {
        const inbox = inboxByEvent.get(outbox.eventId);
        const manualReview =
          outbox.state === "dead_letter" || inbox?.state === "dead_letter";
        return [
          shipmentId,
          {
            state: manualReview ? "manual_review" : "pending",
            lastErrorCode: manualReview
              ? (inbox?.lastErrorCode ?? outbox.lastErrorCode ?? null)
              : null,
          },
        ];
      }),
    );
  }
}

function toSummary(
  row: SummaryRow,
  signal: LifecycleSignal | undefined,
): ShipmentSummaryV1 {
  const initialization = lifecycleInitialization(row, signal);
  return {
    id: row.id,
    shipmentNumber: row.shipmentNumber,
    transportMode: row.transportMode,
    carrierCode: row.carrierCode,
    vesselName: row.vesselName,
    voyageNumber: row.voyageNumber,
    originCountryCode: row.originCountryCode,
    originUnlocode: row.originUnlocode,
    destinationCountryCode: row.destinationCountryCode,
    destinationUnlocode: row.destinationUnlocode,
    salesCountryCode: row.cargoOwner?.salesCountry.alpha2 ?? null,
    cargoOwnerReferenceId: row.cargoOwnerId,
    cargoOwnerName: row.cargoOwner?.legalName ?? null,
    atdAt: row.atdAt?.toISOString() ?? null,
    etaAt: row.etaAt?.toISOString() ?? null,
    currentLifecycleStatus:
      row.currentLifecycleStatus as ShipmentLifecycleStatusV1,
    lifecycleVersion: row.lifecycleVersion,
    relationshipVersion: row.relationshipVersion,
    activeContainerCount: row.containerLinks.length,
    activeCargoLineCount: row.cargoLines.length,
    lifecycleInitializationState: initialization.state,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function lifecycleInitialization(
  row: Pick<
    SummaryRow,
    "containerLinks" | "lifecycleFlows" | "relationshipVersion"
  >,
  signal: LifecycleSignal | undefined,
): {
  state: ShipmentLifecycleInitializationStateV1;
  initializedContainerCount: number;
  lastErrorCode: string | null;
} {
  const activeContainerIds = new Set(
    row.containerLinks.map(({ containerRecordId }) => containerRecordId),
  );
  const initializedContainerCount = new Set(
    row.lifecycleFlows
      .filter(
        (flow) =>
          flow.definitionCode === POST_DEPARTURE_DEFINITION &&
          flow.definitionVersion === POST_DEPARTURE_DEFINITION_VERSION &&
          flow.shipmentRelationshipVersion === row.relationshipVersion &&
          activeContainerIds.has(flow.containerId),
      )
      .map(({ containerId }) => containerId),
  ).size;
  const ready =
    activeContainerIds.size > 0 &&
    initializedContainerCount === activeContainerIds.size;
  return {
    state: ready ? "ready" : (signal?.state ?? "pending"),
    initializedContainerCount,
    lastErrorCode: ready ? null : (signal?.lastErrorCode ?? null),
  };
}

function toDetail(
  row: DetailRow,
  allocations: AllocationRow[],
  signal: LifecycleSignal | undefined,
): ShipmentDetailProjection {
  const initialization = lifecycleInitialization(row, signal);
  const allocationsByContainer = new Map<
    string,
    ShipmentContainerAllocationV1[]
  >();
  for (const allocation of allocations) {
    if (!allocation.shipmentCargoLineId) continue;
    const item: ShipmentContainerAllocationV1 = {
      shipmentCargoLineId: allocation.shipmentCargoLineId,
      allocatedQuantity: allocation.allocatedQuantity.toString(),
      quantityUnit: allocation.quantityUnit,
      packageCount: allocation.packageCount?.toString() ?? null,
      packageUnit: allocation.packageUnit,
      grossWeight: allocation.grossWeight?.toString() ?? null,
      weightUnit: allocation.weightUnit,
      volume: allocation.volume?.toString() ?? null,
      volumeUnit: allocation.volumeUnit,
    };
    const containerId = allocation.allocationSet.containerRecordId;
    allocationsByContainer.set(containerId, [
      ...(allocationsByContainer.get(containerId) ?? []),
      item,
    ]);
  }
  const flowByContainer = new Map(
    row.lifecycleFlows
      .filter(
        (flow) =>
          flow.definitionCode === POST_DEPARTURE_DEFINITION &&
          flow.definitionVersion === POST_DEPARTURE_DEFINITION_VERSION &&
          flow.shipmentRelationshipVersion === row.relationshipVersion,
      )
      .map((flow) => [flow.containerId, flow]),
  );
  const handoff = row.handoffs[0];

  return {
    shipment: toSummary(row, signal),
    handoff: handoff
      ? {
          handoffId: handoff.id,
          handoffVersion: handoff.handoffVersion,
          sourceSystem: handoff.sourceSystem,
          status: handoff.status,
          occurredAt: handoff.occurredAt.toISOString(),
          traceId: handoff.traceId,
        }
      : null,
    containers: row.containerLinks.map((link) => {
      const flow = flowByContainer.get(link.containerRecordId);
      return {
        linkId: link.id,
        containerRecordId: link.containerRecordId,
        containerNumber: link.containerRecord.containerNumber,
        containerTypeCode: link.containerRecord.containerTypeCode,
        sealNumber: link.containerRecord.sealNumber,
        currentStatus: link.containerRecord
          .currentStatus as ContainerLifecycleState,
        linkVersion: link.version,
        currentNodeCode: (flow?.currentNodeCode ??
          null) as LifecycleNodeCode | null,
        flowState: flow?.state ?? null,
        allocations: allocationsByContainer.get(link.containerRecordId) ?? [],
      };
    }),
    cargoLines: row.cargoLines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      productSkuId: line.productSkuId,
      productNumber: line.productNumberSnapshot,
      quantity: line.quantity.toString(),
      quantityUnit: line.quantityUnit,
      packageCount: line.packageCount?.toString() ?? null,
      packageUnit: line.packageUnit,
      grossWeight: line.grossWeight?.toString() ?? null,
      weightUnit: line.weightUnit,
      volume: line.volume?.toString() ?? null,
      volumeUnit: line.volumeUnit,
      replenishmentOrderLineId: line.replenishmentOrderLineId,
      sourceLineId: line.sourceLineId,
      version: line.version,
    })),
    transportDocuments: row.transportDocuments.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      scac: document.scac,
      parentDocumentId: document.parentDocumentId,
      containerRecordIds: document.containerLinks.map(
        ({ containerRecordId }) => containerRecordId,
      ),
      version: document.version,
      effectiveFrom: document.effectiveFrom.toISOString(),
    })),
    upstreamReferences: row.upstreamReferences.map((reference) => ({
      id: reference.id,
      containerRecordId: reference.containerRecordId,
      shipmentCargoLineId: reference.shipmentCargoLineId,
      referenceType: reference.referenceType,
      sourceSystem: reference.sourceSystem,
      sourceRecordId: reference.sourceRecordId,
      sourceVersion: reference.sourceVersion,
      sourceLineId: reference.sourceLineId,
      version: reference.version,
    })),
    pendingItems: shipmentPendingItems(row),
    lifecycleInitialization: {
      state: initialization.state,
      activeContainerCount: row.containerLinks.length,
      initializedContainerCount: initialization.initializedContainerCount,
      relationshipVersion: row.relationshipVersion,
      lastErrorCode: initialization.lastErrorCode,
    },
    projectionVersion: row.lifecycleVersion,
  } satisfies Omit<ShipmentDetailV1, "asOf">;
}

function shipmentPendingItems(
  row: DetailRow,
): ShipmentDetailV1["pendingItems"] {
  const items: ShipmentDetailV1["pendingItems"] = [];
  const add = (
    code: string,
    label: string,
    subjectType: ShipmentDetailV1["pendingItems"][number]["subjectType"] = "shipment",
    subjectRef = row.id,
  ) => items.push({ code, label, subjectType, subjectRef });
  if (!row.carrierCode) add("carrier_missing", "补充船公司");
  if (!row.vesselName || !row.voyageNumber) {
    add("vessel_voyage_missing", "补充船名航次");
  }
  if (!row.originUnlocode) add("origin_port_missing", "补充起运港");
  if (!row.destinationUnlocode) {
    add("destination_port_missing", "补充目的港");
  }
  if (!row.atdAt) add("departure_proof_missing", "补充实际离港证据");
  if (row.cargoLines.length === 0) {
    add("cargo_detail_missing", "补充 SKU 装载明细", "cargo");
  }
  for (const line of row.cargoLines) {
    if (!line.productSkuId) {
      add(
        "product_sku_missing",
        `匹配 SKU ${line.productNumberSnapshot}`,
        "cargo",
        line.id,
      );
    }
  }
  if (row.transportDocuments.length === 0) {
    add("bill_of_lading_missing", "补充提单资料", "document");
  }
  return items;
}
