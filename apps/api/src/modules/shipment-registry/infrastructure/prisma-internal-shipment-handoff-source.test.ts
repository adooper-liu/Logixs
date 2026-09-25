import { describe, expect, it, vi } from "vitest";
import { PrismaInternalShipmentHandoffSource } from "./prisma-internal-shipment-handoff-source";

describe("PrismaInternalShipmentHandoffSource", () => {
  it("只投影无活动 Shipment 且具备实际离港事实的内部装箱记录", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "dispatch-1",
        bookingNumber: "BK-001",
        carrierCode: "HMM",
        vesselName: "ONE INNOVATION",
        voyageNumber: "001E",
        masterBillNumber: "MBL-001",
        houseBillNumber: null,
        evidenceRefs: [],
        stuffingSnapshot: {
          id: "22222222-2222-4222-8222-222222222222",
          containerRecordId: "11111111-1111-4111-8111-111111111111",
          containerNumber: "HMMU4956442",
          evidenceRefs: [],
          containerRecord: {
            containerTypeCode: "40HQ",
            shipmentLinks: [],
            oceanRoutePlans: [
              {
                evidenceRefs: [],
                segments: [
                  {
                    originUnlocode: "CNSHA",
                    originTimezone: "Asia/Shanghai",
                    destinationUnlocode: "USLAX",
                    destinationTimezone: "America/Los_Angeles",
                    isFinal: true,
                  },
                ],
              },
            ],
            lifecycleDateFacts: [
              {
                occurredAt: new Date("2026-09-24T00:00:00.000Z"),
                locationTimezone: "Asia/Shanghai",
                evidenceRefs: ["66666666-6666-4666-8666-666666666666"],
              },
            ],
          },
          allocationSet: {
            evidenceRefs: [],
            allocations: [
              {
                allocatedQuantity: { toString: () => "20" },
                quantityUnit: "piece",
                packageCount: null,
                packageUnit: null,
                grossWeight: null,
                weightUnit: null,
                volume: null,
                volumeUnit: null,
                replenishmentOrderLine: {
                  id: "44444444-4444-4444-8444-444444444444",
                  productSkuId: "55555555-5555-4555-8555-555555555555",
                  productNumber: "311-013GY",
                  replenishmentOrder: {
                    id: "33333333-3333-4333-8333-333333333333",
                    orderNumber: "26DSC01812",
                  },
                },
              },
            ],
          },
        },
      },
    ]);
    const source = new PrismaInternalShipmentHandoffSource({
      containerDispatchSnapshot: { findMany },
    } as never);

    const candidates = await source.listCandidates({ tenantId: "tenant-a" });

    expect(candidates).toMatchObject([
      {
        bookingNumber: "BK-001",
        originPortCode: "CNSHA",
        destinationPortCode: "USLAX",
        departureEvidenceRef: "66666666-6666-4666-8666-666666666666",
        containers: [{ containerNumber: "HMMU4956442" }],
        replenishmentOrders: [{ orderNumber: "26DSC01812" }],
        cargoLines: [
          {
            productNumber: "311-013GY",
            replenishmentOrderNumber: "26DSC01812",
          },
        ],
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-a",
          stuffingSnapshot: expect.objectContaining({
            containerRecord: expect.objectContaining({
              shipmentLinks: {
                none: { state: "active", supersededAt: null },
              },
              lifecycleDateFacts: {
                some: expect.objectContaining({
                  eventCode: "departed",
                  validity: "effective",
                }),
              },
            }),
          }),
        }),
      }),
    );

    findMany.mockClear();
    await expect(
      source.findCandidate({
        tenantId: "tenant-a",
        candidateRef: candidates[0]!.candidateRef,
      }),
    ).resolves.toMatchObject({ candidateRef: candidates[0]!.candidateRef });
    const acceptanceLookup = findMany.mock.calls[0]?.[0];
    expect(
      acceptanceLookup.where.stuffingSnapshot.containerRecord,
    ).not.toHaveProperty("shipmentLinks");
  });
});
