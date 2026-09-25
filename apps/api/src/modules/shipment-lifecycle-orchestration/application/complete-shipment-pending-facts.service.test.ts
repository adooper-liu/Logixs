import { describe, expect, it, vi } from "vitest";
import { CompleteShipmentPendingFactsService } from "./complete-shipment-pending-facts.service";

const shipmentId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

describe("CompleteShipmentPendingFactsService", () => {
  it("sends normalized operator facts to the transactional Handoff writer", async () => {
    const getShipment = {
      execute: vi.fn().mockResolvedValue(detail(3)),
    };
    const completion = {
      complete: vi.fn().mockResolvedValue({
        duplicate: false,
        relationshipVersion: 4,
        traceId: "handoff-trace",
      }),
    };
    const service = new CompleteShipmentPendingFactsService(
      getShipment as never,
      completion as never,
    );

    const result = await service.execute(
      shipmentId,
      {
        contractVersion: "shipment-pending-fact-completion.v1",
        expectedRelationshipVersion: 3,
        occurredAt: "2026-09-24T08:00:00.000Z",
        idempotencyKey: "pending-facts-1",
        facts: {
          carrierCode: "HMM",
          originPortCode: "CNNGB",
          destinationPortCode: "USLAX",
        },
      },
      { tenantId, actorId },
    );

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        shipmentId,
        command: expect.objectContaining({
          contractVersion: "shipment-pending-fact-completion.v1",
          idempotencyKey: "pending-facts-1",
          expectedRelationshipVersion: 3,
          facts: expect.objectContaining({
            carrierCode: "HMM",
            originPortCode: "CNNGB",
            destinationPortCode: "USLAX",
          }),
        }),
        traceId: expect.stringMatching(/^shipment-completion:/),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "saved",
        shipmentId,
        relationshipVersion: 4,
        traceId: "handoff-trace",
      }),
    );
  });

  it("accepts an empty partial save without creating an empty Handoff", async () => {
    const getShipment = { execute: vi.fn().mockResolvedValue(detail(3)) };
    const completion = { complete: vi.fn() };
    const service = new CompleteShipmentPendingFactsService(
      getShipment as never,
      completion as never,
    );

    const result = await service.execute(
      shipmentId,
      {
        contractVersion: "shipment-pending-fact-completion.v1",
        expectedRelationshipVersion: 3,
        occurredAt: "2026-09-24T08:00:00.000Z",
        idempotencyKey: "pending-facts-empty",
        facts: {
          carrierCode: null,
          vesselName: "  ",
          originPortCode: null,
        },
      },
      { tenantId, actorId },
    );

    expect(completion.complete).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: "no_change",
        relationshipVersion: 3,
      }),
    );
  });

  it.each([
    {
      label: "unsupported proof kind",
      departureProof: {
        kind: "estimated_departure_time",
        occurredAt: "2026-09-24T08:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "44444444-4444-4444-8444-444444444444",
      },
    },
    {
      label: "invalid source timezone",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-24T08:00:00.000Z",
        sourceTimezone: "Shanghai time",
        evidenceRef: "44444444-4444-4444-8444-444444444444",
      },
    },
    {
      label: "invalid evidence reference",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-24T08:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "evidence-1",
      },
    },
    {
      label: "unexpected proof field",
      departureProof: {
        kind: "actual_departure_time",
        occurredAt: "2026-09-24T08:00:00.000Z",
        sourceTimezone: "Asia/Shanghai",
        evidenceRef: "44444444-4444-4444-8444-444444444444",
        operatorNote: "ignore me",
      },
    },
  ])("rejects $label at the API boundary", async ({ departureProof }) => {
    const getShipment = { execute: vi.fn() };
    const completion = { complete: vi.fn() };
    const service = new CompleteShipmentPendingFactsService(
      getShipment as never,
      completion as never,
    );

    await expect(
      service.execute(
        shipmentId,
        {
          contractVersion: "shipment-pending-fact-completion.v1",
          expectedRelationshipVersion: 3,
          occurredAt: "2026-09-24T08:00:00.000Z",
          idempotencyKey: "pending-facts-invalid-proof",
          facts: { departureProof },
        },
        { tenantId, actorId },
      ),
    ).rejects.toThrow("SHIPMENT_PENDING_FACTS_INVALID");
    expect(getShipment.execute).not.toHaveBeenCalled();
    expect(completion.complete).not.toHaveBeenCalled();
  });
});

function detail(relationshipVersion: number) {
  return {
    shipment: {
      id: shipmentId,
      relationshipVersion,
      transportMode: "ocean",
    },
    containers: [
      {
        containerRecordId: "container-record-1",
        containerNumber: "MSNU9762671",
        containerTypeCode: "40HQ",
        sealNumber: "SEAL-1",
      },
    ],
  };
}
