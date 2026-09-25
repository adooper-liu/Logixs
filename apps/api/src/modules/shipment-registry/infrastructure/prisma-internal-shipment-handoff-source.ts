import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  InternalShipmentHandoffCandidateV1,
  InternalShipmentHandoffPendingItemV1,
} from "@logix/contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type { InternalShipmentHandoffSourcePort } from "../internal-shipment-handoff-source.port";

const dispatchSelect =
  Prisma.validator<Prisma.ContainerDispatchSnapshotSelect>()({
    id: true,
    bookingNumber: true,
    carrierCode: true,
    vesselName: true,
    voyageNumber: true,
    masterBillNumber: true,
    houseBillNumber: true,
    evidenceRefs: true,
    stuffingSnapshot: {
      select: {
        id: true,
        containerRecordId: true,
        containerNumber: true,
        evidenceRefs: true,
        containerRecord: {
          select: {
            containerTypeCode: true,
            shipmentLinks: {
              where: { state: "active", supersededAt: null },
              select: { id: true },
            },
            oceanRoutePlans: {
              where: { status: "active", supersededAt: null },
              orderBy: { version: "desc" },
              take: 1,
              select: {
                evidenceRefs: true,
                segments: {
                  orderBy: { sequence: "asc" },
                  select: {
                    originUnlocode: true,
                    originTimezone: true,
                    destinationUnlocode: true,
                    destinationTimezone: true,
                    isFinal: true,
                  },
                },
              },
            },
            lifecycleDateFacts: {
              where: {
                eventCode: "departed",
                timeKind: "actual",
                isCurrent: true,
                validity: "effective",
              },
              orderBy: [{ occurredAt: "desc" }, { recordedAt: "desc" }],
              take: 1,
              select: {
                occurredAt: true,
                locationTimezone: true,
                evidenceRefs: true,
              },
            },
          },
        },
        allocationSet: {
          select: {
            evidenceRefs: true,
            allocations: {
              orderBy: { replenishmentOrderLineId: "asc" },
              select: {
                allocatedQuantity: true,
                quantityUnit: true,
                packageCount: true,
                packageUnit: true,
                grossWeight: true,
                weightUnit: true,
                volume: true,
                volumeUnit: true,
                replenishmentOrderLine: {
                  select: {
                    id: true,
                    productSkuId: true,
                    productNumber: true,
                    replenishmentOrder: {
                      select: { id: true, orderNumber: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

type DispatchRow = Prisma.ContainerDispatchSnapshotGetPayload<{
  select: typeof dispatchSelect;
}>;

@Injectable()
export class PrismaInternalShipmentHandoffSource implements InternalShipmentHandoffSourcePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCandidates(input: {
    tenantId: string;
  }): Promise<InternalShipmentHandoffCandidateV1[]> {
    return groupCandidates(
      await this.loadRows({ tenantId: input.tenantId, unacceptedOnly: true }),
    );
  }

  async findCandidate(input: {
    tenantId: string;
    candidateRef: string;
  }): Promise<InternalShipmentHandoffCandidateV1 | null> {
    const candidates = groupCandidates(
      await this.loadRows({ tenantId: input.tenantId, unacceptedOnly: false }),
    );
    return (
      candidates.find(
        ({ candidateRef }) => candidateRef === input.candidateRef,
      ) ?? null
    );
  }

  private async loadRows(input: {
    tenantId: string;
    unacceptedOnly: boolean;
  }): Promise<DispatchRow[]> {
    const rows = await this.prisma.containerDispatchSnapshot.findMany({
      where: {
        tenantId: input.tenantId,
        state: "active",
        supersededAt: null,
        stuffingSnapshot: {
          state: "active",
          supersededAt: null,
          allocationSet: { state: "active", supersededAt: null },
          containerRecord: {
            ...(input.unacceptedOnly
              ? {
                  shipmentLinks: {
                    none: { state: "active", supersededAt: null },
                  },
                }
              : {}),
            lifecycleDateFacts: {
              some: {
                eventCode: "departed",
                timeKind: "actual",
                isCurrent: true,
                validity: "effective",
              },
            },
          },
        },
      },
      orderBy: [
        { bookingNumber: "asc" },
        { carrierCode: "asc" },
        { vesselName: "asc" },
        { voyageNumber: "asc" },
        { containerRecordId: "asc" },
      ],
      take: 500,
      select: dispatchSelect,
    });
    return rows;
  }
}

function groupCandidates(
  rows: DispatchRow[],
): InternalShipmentHandoffCandidateV1[] {
  const groups = new Map<string, DispatchRow[]>();
  for (const row of rows) {
    const route = routeOf(row);
    const departure =
      row.stuffingSnapshot.containerRecord.lifecycleDateFacts[0]!;
    const key = [
      row.bookingNumber,
      row.carrierCode,
      row.vesselName,
      row.voyageNumber,
      route.originPortCode ?? "",
      route.destinationPortCode ?? "",
      departure.occurredAt.toISOString(),
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([groupKey, groupRows]) =>
    toCandidate(groupKey, groupRows),
  );
}

function toCandidate(
  groupKey: string,
  rows: DispatchRow[],
): InternalShipmentHandoffCandidateV1 {
  const first = rows[0]!;
  const route = routeOf(first);
  const departure =
    first.stuffingSnapshot.containerRecord.lifecycleDateFacts[0]!;
  const candidateRef = `internal:${createHash("sha256")
    .update(
      `${groupKey}|${rows
        .map(({ stuffingSnapshot }) => stuffingSnapshot.containerRecordId)
        .sort()
        .join(",")}`,
    )
    .digest("hex")}`;
  const cargoLines = rows.flatMap((row) =>
    row.stuffingSnapshot.allocationSet.allocations.flatMap((allocation) => {
      const line = allocation.replenishmentOrderLine;
      if (!line) return [];
      return [
        {
          replenishmentOrderId: line.replenishmentOrder.id,
          replenishmentOrderNumber: line.replenishmentOrder.orderNumber,
          replenishmentOrderLineId: line.id,
          productSkuId: line.productSkuId,
          productNumber: line.productNumber,
          quantity: allocation.allocatedQuantity.toString(),
          quantityUnit: allocation.quantityUnit as
            "piece" | "carton" | "set" | "pallet",
          packageCount: allocation.packageCount?.toString() ?? null,
          packageUnit: allocation.packageUnit,
          grossWeight: allocation.grossWeight?.toString() ?? null,
          weightUnit: allocation.weightUnit,
          volume: allocation.volume?.toString() ?? null,
          volumeUnit: allocation.volumeUnit,
          containerRecordId: row.stuffingSnapshot.containerRecordId,
        },
      ];
    }),
  );
  const replenishmentOrders = [
    ...new Map(
      cargoLines.map((line) => [
        line.replenishmentOrderId,
        {
          id: line.replenishmentOrderId,
          orderNumber: line.replenishmentOrderNumber,
        },
      ]),
    ).values(),
  ].sort((left, right) => left.orderNumber.localeCompare(right.orderNumber));
  const pendingItems = pendingItemsFor({
    candidateRef,
    route,
    cargoLines,
    rows,
  });
  const transportDocuments = documentViews(rows);
  return {
    candidateRef,
    bookingNumber: first.bookingNumber,
    carrierCode: first.carrierCode,
    vesselName: first.vesselName,
    voyageNumber: first.voyageNumber,
    originPortCode: route.originPortCode,
    destinationPortCode: route.destinationPortCode,
    departedAt: departure.occurredAt.toISOString(),
    departureSourceTimezone:
      departure.locationTimezone ?? route.originTimezone ?? "UTC",
    departureEvidenceRef: uuidEvidence(departure.evidenceRefs)[0] ?? null,
    containers: rows.map((row) => ({
      containerRecordId: row.stuffingSnapshot.containerRecordId,
      containerNumber: row.stuffingSnapshot.containerNumber,
      containerTypeCode:
        row.stuffingSnapshot.containerRecord.containerTypeCode ?? "UNKNOWN",
      stuffingSnapshotRef: row.stuffingSnapshot.id,
    })) as InternalShipmentHandoffCandidateV1["containers"],
    replenishmentOrders,
    cargoLines,
    transportDocuments,
    pendingItems,
  };
}

function documentViews(
  rows: DispatchRow[],
): InternalShipmentHandoffCandidateV1["transportDocuments"] {
  const documents = new Map<
    string,
    InternalShipmentHandoffCandidateV1["transportDocuments"][number]
  >();
  for (const row of rows) {
    const containerRecordId = row.stuffingSnapshot.containerRecordId;
    for (const [documentType, documentNumber] of [
      ["booking", row.bookingNumber],
      ["mbl", row.masterBillNumber],
      ["hbl", row.houseBillNumber],
    ] as const) {
      if (!documentNumber) continue;
      const key = `${documentType}:${documentNumber}`;
      const existing = documents.get(key);
      documents.set(key, {
        referenceId: `internal-${documentType}-${createHash("sha256")
          .update(documentNumber)
          .digest("hex")
          .slice(0, 16)}`,
        documentType,
        documentNumber,
        containerRecordIds: [
          ...new Set([
            ...(existing?.containerRecordIds ?? []),
            containerRecordId,
          ]),
        ].sort() as [string, ...string[]],
      });
    }
  }
  return [...documents.values()].sort((left, right) =>
    left.referenceId.localeCompare(right.referenceId),
  );
}

function routeOf(row: DispatchRow): {
  originPortCode: string | null;
  destinationPortCode: string | null;
  originTimezone: string | null;
} {
  const segments =
    row.stuffingSnapshot.containerRecord.oceanRoutePlans[0]?.segments;
  const origin = segments?.[0];
  const destination =
    segments?.find(({ isFinal }) => isFinal) ?? segments?.at(-1);
  return {
    originPortCode: origin?.originUnlocode ?? null,
    destinationPortCode: destination?.destinationUnlocode ?? null,
    originTimezone: origin?.originTimezone ?? null,
  };
}

function pendingItemsFor(input: {
  candidateRef: string;
  route: ReturnType<typeof routeOf>;
  cargoLines: InternalShipmentHandoffCandidateV1["cargoLines"];
  rows: DispatchRow[];
}): InternalShipmentHandoffPendingItemV1[] {
  const items: InternalShipmentHandoffPendingItemV1[] = [];
  if (!input.route.originPortCode) {
    items.push(
      pending("origin_port_missing", "补充起运港", input.candidateRef),
    );
  }
  if (!input.route.destinationPortCode) {
    items.push(
      pending("destination_port_missing", "补充目的港", input.candidateRef),
    );
  }
  if (input.cargoLines.length === 0) {
    items.push(
      pending("cargo_detail_missing", "补充 SKU 装载明细", input.candidateRef),
    );
  }
  for (const row of input.rows) {
    if (!row.masterBillNumber && !row.houseBillNumber) {
      items.push(
        pending(
          "bill_of_lading_missing",
          "补充提单号",
          row.stuffingSnapshot.containerRecordId,
          "document",
        ),
      );
    }
  }
  return items;
}

function pending(
  code: string,
  label: string,
  subjectRef: string,
  subjectType: InternalShipmentHandoffPendingItemV1["subjectType"] = "shipment",
): InternalShipmentHandoffPendingItemV1 {
  return { code, label, subjectType, subjectRef };
}

function uuidEvidence(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        item,
      ),
  );
}
