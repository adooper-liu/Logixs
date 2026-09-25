import { describe, expect, it, vi } from "vitest";
import { AcceptInternalShipmentHandoffService } from "./accept-internal-shipment-handoff.service";

const containerId = "11111111-1111-4111-8111-111111111111";
const stuffingId = "22222222-2222-4222-8222-222222222222";
const orderId = "33333333-3333-4333-8333-333333333333";
const lineId = "44444444-4444-4444-8444-444444444444";
const skuId = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";

describe("AcceptInternalShipmentHandoffService", () => {
  it("把内部备货、装箱和离港事实映射到统一 handoff，而不另写 Shipment", async () => {
    const candidate = {
      candidateRef: `internal:${"a".repeat(64)}`,
      bookingNumber: "BK-001",
      carrierCode: "HMM",
      vesselName: "ONE INNOVATION",
      voyageNumber: "001E",
      originPortCode: "CNSHA",
      destinationPortCode: "USLAX",
      departedAt: "2026-09-24T00:00:00.000Z",
      departureSourceTimezone: "Asia/Shanghai",
      departureEvidenceRef: evidenceId,
      containers: [
        {
          containerRecordId: containerId,
          containerNumber: "HMMU4956442",
          containerTypeCode: "40HQ",
          stuffingSnapshotRef: stuffingId,
        },
      ],
      replenishmentOrders: [{ id: orderId, orderNumber: "26DSC01812" }],
      cargoLines: [
        {
          replenishmentOrderId: orderId,
          replenishmentOrderNumber: "26DSC01812",
          replenishmentOrderLineId: lineId,
          productSkuId: skuId,
          productNumber: "311-013GY",
          quantity: "20",
          quantityUnit: "piece" as const,
          packageCount: null,
          packageUnit: null,
          grossWeight: null,
          weightUnit: null,
          volume: null,
          volumeUnit: null,
          containerRecordId: containerId,
        },
      ],
      transportDocuments: [
        {
          referenceId: "internal-booking-1",
          documentType: "booking" as const,
          documentNumber: "BK-001",
          containerRecordIds: [containerId] as [string, ...string[]],
        },
      ],
      pendingItems: [],
    };
    const source = { findCandidate: vi.fn().mockResolvedValue(candidate) };
    const accept = {
      accept: vi.fn().mockResolvedValue({
        shipmentId: "77777777-7777-4777-8777-777777777777",
      }),
    };
    const service = new AcceptInternalShipmentHandoffService(
      source as never,
      accept as never,
    );

    const result = await service.execute(
      {
        contractVersion: "internal-shipment-handoff-accept.v1",
        candidateRef: candidate.candidateRef,
        idempotencyKey: "internal-handoff:test-1",
      },
      { tenantId: "tenant-a", actorId: "actor-a" },
    );

    expect(result.candidateRef).toBe(candidate.candidateRef);
    expect(accept.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceProfile: "internal_fulfillment_v1",
        shipment: expect.objectContaining({
          externalShipmentId: candidate.candidateRef,
          originPortCode: "CNSHA",
          destinationPortCode: "USLAX",
        }),
        containers: [
          expect.objectContaining({
            stuffingSnapshotRef: stuffingId,
            cargoAllocations: [
              expect.objectContaining({
                replenishmentOrderLineId: lineId,
                productSkuId: skuId,
              }),
            ],
            upstreamReferences: [
              expect.objectContaining({
                referenceType: "stocking_order",
                sourceRecordId: "26DSC01812",
                sourceLineId: lineId,
              }),
            ],
          }),
        ],
      }),
      { tenantId: "tenant-a", actorId: "actor-a" },
    );

    const firstCommand = accept.accept.mock.calls[0]?.[0];
    await service.execute(
      {
        contractVersion: "internal-shipment-handoff-accept.v1",
        candidateRef: candidate.candidateRef,
        idempotencyKey: "internal-handoff:test-1",
      },
      { tenantId: "tenant-a", actorId: "actor-a" },
    );
    const replayCommand = accept.accept.mock.calls[1]?.[0];
    expect(replayCommand.source.correlationId).toBe(
      firstCommand.source.correlationId,
    );
    expect(replayCommand.source.traceId).toBe(firstCommand.source.traceId);
  });
});
