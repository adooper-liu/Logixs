import { describe, expect, it, vi } from "vitest";
import { CompleteShipmentPendingCargoService } from "./complete-shipment-pending-cargo.service";

const shipmentId = "11111111-1111-4111-8111-111111111111";
const containerId = "22222222-2222-4222-8222-222222222222";
const tenantId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";

describe("CompleteShipmentPendingCargoService", () => {
  it("matches known SKU identities and preserves unmatched rows as pending", async () => {
    const resolveProductSkus = {
      execute: vi.fn().mockResolvedValue([
        {
          productSkuId: "55555555-5555-4555-8555-555555555555",
          productNumber: "SKU-001",
          version: 1,
        },
      ]),
    };
    const registerEvidence = {
      execute: vi.fn().mockResolvedValue({
        id: "66666666-6666-4666-8666-666666666666",
      }),
    };
    const getShipment = {
      execute: vi.fn().mockResolvedValue(shipmentDetail()),
    };
    const completion = {
      complete: vi.fn().mockResolvedValue({
        duplicate: false,
        relationshipVersion: 2,
        cargoLineCount: 2,
        unmatchedSkuCount: 1,
        traceId: "cargo-trace",
      }),
    };
    const service = new CompleteShipmentPendingCargoService(
      registerEvidence as never,
      resolveProductSkus as never,
      getShipment as never,
      completion as never,
    );

    const result = await service.execute(
      shipmentId,
      command([line("SKU-001", "10.0000"), line("SKU-NEW", "5")]),
      { tenantId, actorId },
    );

    expect(resolveProductSkus.execute).toHaveBeenCalledWith({
      tenantId,
      productNumbers: ["SKU-001", "SKU-NEW"],
    });
    expect(registerEvidence.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        evidenceType: "attestation",
        subjectType: "domain_fact",
        subjectId: shipmentId,
        sourceType: "person",
        ingestionChannel: "manual_ui",
      }),
    );
    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        actorId,
        shipmentId,
        evidenceRef: "66666666-6666-4666-8666-666666666666",
        command: expect.objectContaining({
          lines: [
            expect.objectContaining({
              productNumber: "SKU-001",
              quantity: "10",
            }),
            expect.objectContaining({
              productNumber: "SKU-NEW",
              quantity: "5",
            }),
          ],
        }),
        resolvedProductSkuIds: new Map([
          ["SKU-001", "55555555-5555-4555-8555-555555555555"],
        ]),
      }),
    );
    expect(result).toEqual({
      contractVersion: "shipment-pending-cargo-completion-result.v1",
      status: "saved",
      shipmentId,
      relationshipVersion: 2,
      cargoLineCount: 2,
      unmatchedSkuCount: 1,
      traceId: "cargo-trace",
    });
  });

  it("rejects malformed rows before SKU lookup", async () => {
    const resolveProductSkus = { execute: vi.fn() };
    const registerEvidence = { execute: vi.fn() };
    const getShipment = { execute: vi.fn() };
    const completion = { complete: vi.fn() };
    const service = new CompleteShipmentPendingCargoService(
      registerEvidence as never,
      resolveProductSkus as never,
      getShipment as never,
      completion as never,
    );

    await expect(
      service.execute(shipmentId, command([line("", "0")]), {
        tenantId,
        actorId,
      }),
    ).rejects.toThrow("SHIPMENT_PENDING_CARGO_INVALID");
    expect(getShipment.execute).not.toHaveBeenCalled();
    expect(resolveProductSkus.execute).not.toHaveBeenCalled();
    expect(completion.complete).not.toHaveBeenCalled();
  });
});

function command(lines: ReturnType<typeof line>[]) {
  return {
    contractVersion: "shipment-pending-cargo-completion.v1",
    expectedRelationshipVersion: 2,
    occurredAt: "2026-09-24T08:00:00.000Z",
    idempotencyKey: "pending-cargo-1",
    lines,
  };
}

function line(productNumber: string, quantity: string) {
  return {
    containerRecordId: containerId,
    productNumber,
    quantity,
    quantityUnit: "piece",
  };
}

function shipmentDetail() {
  return {
    shipment: { id: shipmentId, relationshipVersion: 2 },
    containers: [
      {
        containerRecordId: containerId,
        allocations: [],
      },
    ],
    cargoLines: [],
  };
}
