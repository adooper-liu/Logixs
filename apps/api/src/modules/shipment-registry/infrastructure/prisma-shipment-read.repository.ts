import { Inject, Injectable } from "@nestjs/common";
import type {
  ContainerLifecycleState,
  LifecycleNodeCode,
  ShipmentContainerAllocationV1,
  ShipmentDetailV1,
  ShipmentLifecycleInitializationStateV1,
  ShipmentLifecycleStatusV1,
  ShipmentPendingCompletionItemV1,
  ShipmentPendingItemV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import { shipmentRisk } from "../domain/shipment-risk";
import type { ShipmentDeadline } from "../domain/shipment-risk";
import type {
  ShipmentByIdQuery,
  ShipmentDetailProjection,
  ShipmentListQuery,
  ShipmentPendingCompletionQuery,
  ShipmentReadRepository,
  ShipmentRiskQueueQuery,
  ShipmentRiskQueueRow,
} from "../domain/shipment-read.repository";
import { buildRiskQueueSql } from "./shipment-risk-queue-sql";
import type { RiskQueueSqlRow } from "./shipment-risk-queue-sql";

const POST_DEPARTURE_EVENT_TYPE = "shipment.lifecycle_initialization_requested";
const POST_DEPARTURE_DEFINITION = "post_departure_ocean";
const POST_DEPARTURE_DEFINITION_VERSION = 1;

const summarySelect = Prisma.validator<Prisma.ShipmentSelect>()({
  id: true,
  sourceSystem: true,
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

const pendingCompletionSelect = Prisma.validator<Prisma.ShipmentSelect>()({
  ...summarySelect,
  cargoLines: {
    where: { state: "active", supersededAt: null },
    orderBy: [{ lineNo: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productSkuId: true,
      productNumberSnapshot: true,
    },
  },
  transportDocuments: {
    where: { state: "active", supersededAt: null },
    select: { id: true, documentType: true, documentNumber: true },
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
type PendingCompletionRow = Prisma.ShipmentGetPayload<{
  select: typeof pendingCompletionSelect;
}>;
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

  async listPendingCompletion(
    query: ShipmentPendingCompletionQuery,
  ): Promise<ShipmentPendingCompletionItemV1[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        tenantId: query.tenantId,
        handoffs: { some: { status: { in: ["accepted", "superseded"] } } },
        OR: [
          { carrierCode: null },
          { vesselName: null },
          { voyageNumber: null },
          { originUnlocode: null },
          { destinationUnlocode: null },
          { atdAt: null },
          { cargoLines: { none: { state: "active", supersededAt: null } } },
          {
            cargoLines: {
              some: {
                state: "active",
                supersededAt: null,
                productSkuId: null,
              },
            },
          },
          {
            transportDocuments: {
              none: {
                state: "active",
                supersededAt: null,
                documentType: { in: ["mbl", "hbl"] },
              },
            },
          },
        ],
        ...(query.after
          ? {
              AND: [
                {
                  OR: [
                    { updatedAt: { lt: query.after.updatedAt } },
                    {
                      AND: [
                        { updatedAt: query.after.updatedAt },
                        { id: { lt: query.after.id } },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.take,
      select: pendingCompletionSelect,
    });
    const signals = await this.loadLifecycleSignals(
      query.tenantId,
      rows.map(({ id }) => id),
    );
    return rows.flatMap((row) => {
      const pendingItems = shipmentPendingItems(row);
      return pendingItems.length > 0
        ? [{ shipment: toSummary(row, signals.get(row.id)), pendingItems }]
        : [];
    });
  }

  /**
   * 风险队列取页。分两步：**取页与排序交给裸 SQL**（排序值是跨三跳的聚合，
   * Prisma 的 `orderBy` 表达不了），**逐行事实交给 Prisma**（复用 `list` 与
   * `listPendingCompletion` 的同一套 select 与映射，不另写一份）。
   *
   * 两步之间用 `id` 对齐并**保持 SQL 给出的顺序** —— 队列的顺序是这一页的
   * 全部意义，按 Prisma 返回顺序渲染就等于把排序丢了。
   */
  async listRiskQueue(
    query: ShipmentRiskQueueQuery,
  ): Promise<ShipmentRiskQueueRow[]> {
    const { text, values } = buildRiskQueueSql(query);
    const page = await this.prisma.$queryRawUnsafe<RiskQueueSqlRow[]>(
      text,
      ...values,
    );
    if (page.length === 0) return [];

    const ids = page.map(({ id }) => id);
    const [rows, signals] = await Promise.all([
      this.prisma.shipment.findMany({
        where: { tenantId: query.tenantId, id: { in: ids } },
        select: pendingCompletionSelect,
      }),
      this.loadLifecycleSignals(query.tenantId, ids),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));

    const now = new Date();
    return page.map((fact) => {
      const row = byId.get(fact.id);
      if (!row) {
        // 取页与取事实之间票被删掉/改了租户：宁可明确失败，也不要静默少一行
        // —— 少一行在分页里表现为"翻页丢行"，是最难发现的一类缺陷。
        throw new Error("SHIPMENT_RISK_QUEUE_ROW_MISSING");
      }
      const pendingItems = shipmentPendingItems(row);
      // 截止**只用 SQL 取回的那两个事实**推，不再从 Prisma 行里另取一遍：
      // 排序用它、展示也用它，"为什么排在这"才和"排在第几"是同一份数据。
      const risk = shipmentRisk(
        {
          deadlines: deadlinesOf(fact),
          pendingGapCount: pendingItems.length,
          openExceptionCount: fact.openExceptionCount,
          unassignedExceptionCount: fact.unassignedExceptionCount,
        },
        now,
      );
      return {
        shipment: toSummary(row, signals.get(row.id)),
        risk: {
          nearestDeadline: risk.nearestDeadline
            ? {
                kind: risk.nearestDeadline.kind,
                at: risk.nearestDeadline.at.toISOString(),
              }
            : null,
          overdue: risk.overdue,
          reasons: [...risk.reasons],
          openExceptionCount: fact.openExceptionCount,
          unassignedExceptionCount: fact.unassignedExceptionCount,
        },
        pendingItems,
        sortValue: fact.sortValue,
      };
    });
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

/**
 * 取页 SQL 交回的截止事实 → 领域层的截止列表。
 * **只有 SQL 说存在的截止才会进来**：缺失与"不适用"在这里不做区分，
 * 由领域规则决定没有截止时的排序与理由。
 */
function deadlinesOf(row: RiskQueueSqlRow): ShipmentDeadline[] {
  const deadlines: ShipmentDeadline[] = [];
  if (row.etaAt) deadlines.push({ kind: "eta", at: row.etaAt });
  if (row.taskDueAt) deadlines.push({ kind: "task_due", at: row.taskDueAt });
  return deadlines;
}

function shipmentPendingItems(
  row: Pick<
    PendingCompletionRow,
    | "id"
    | "sourceSystem"
    | "carrierCode"
    | "vesselName"
    | "voyageNumber"
    | "originUnlocode"
    | "destinationUnlocode"
    | "atdAt"
    | "cargoLines"
    | "transportDocuments"
  >,
): ShipmentDetailV1["pendingItems"] {
  const items: ShipmentDetailV1["pendingItems"] = [];
  const add = (
    code: string,
    label: string,
    directAction: ShipmentPendingItemV1["directAction"],
    currentValue: string | null = null,
    sourceValue: string | null = currentValue,
    subjectType: ShipmentDetailV1["pendingItems"][number]["subjectType"] = "shipment",
    subjectRef = row.id,
  ) =>
    items.push({
      code,
      label,
      subjectType,
      subjectRef,
      currentValue,
      sourceSystem: row.sourceSystem,
      sourceValue,
      candidateValues: [],
      responsibility: {
        roleCode: "operations_dispatcher",
        roleLabel: "出运运营",
      },
      deadline: {
        dueAt: null,
        source: "not_configured",
        label: "未设定",
      },
      restrictedActions: [],
      directAction,
    });
  if (!row.carrierCode) {
    add("carrier_missing", "补充船公司", {
      code: "edit_shipment_facts",
      label: "补录船公司",
    });
  }
  if (!row.vesselName || !row.voyageNumber) {
    const currentValue = [row.vesselName, row.voyageNumber]
      .filter(Boolean)
      .join(" / ");
    add(
      "vessel_voyage_missing",
      "补充船名航次",
      { code: "edit_shipment_facts", label: "补录船名航次" },
      currentValue || null,
    );
  }
  if (!row.originUnlocode) {
    add("origin_port_missing", "补充起运港", {
      code: "edit_shipment_facts",
      label: "选择起运港",
    });
  }
  if (!row.destinationUnlocode) {
    add("destination_port_missing", "补充目的港", {
      code: "edit_shipment_facts",
      label: "选择目的港",
    });
  }
  if (!row.atdAt) {
    add("departure_proof_missing", "补充实际离港证据", {
      code: "edit_shipment_facts",
      label: "登记离港事实",
    });
  }
  if (row.cargoLines.length === 0) {
    add(
      "cargo_detail_missing",
      "补充 SKU 装载明细",
      { code: "add_cargo_lines", label: "补录明细" },
      null,
      null,
      "cargo",
    );
  }
  for (const line of row.cargoLines) {
    if (!line.productSkuId) {
      add(
        "product_sku_missing",
        `匹配 SKU ${line.productNumberSnapshot}`,
        { code: "bind_product_sku", label: "匹配 SKU" },
        null,
        line.productNumberSnapshot,
        "cargo",
        line.id,
      );
    }
  }
  if (
    !row.transportDocuments.some(({ documentType }) =>
      ["mbl", "hbl"].includes(documentType),
    )
  ) {
    const bookingNumbers = row.transportDocuments
      .filter(({ documentType }) => documentType === "booking")
      .map(({ documentNumber }) => documentNumber)
      .join("、");
    add(
      "bill_of_lading_missing",
      "补充提单资料",
      { code: "add_transport_document", label: "补录提单" },
      bookingNumbers ? `Booking ${bookingNumbers}` : null,
      bookingNumbers || null,
      "document",
    );
  }
  return items;
}
