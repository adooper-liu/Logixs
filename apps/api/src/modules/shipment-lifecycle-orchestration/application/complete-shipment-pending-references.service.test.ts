import { describe, expect, it, vi } from "vitest";
import { BindShipmentPendingSkuService } from "./bind-shipment-pending-sku.service";
import { CompleteShipmentPendingDocumentsService } from "./complete-shipment-pending-documents.service";

const shipmentId = "11111111-1111-4111-8111-111111111111";
const cargoLineId = "22222222-2222-4222-8222-222222222222";
const containerId = "33333333-3333-4333-8333-333333333333";
const tenantId = "44444444-4444-4444-8444-444444444444";
const productSkuId = "55555555-5555-4555-8555-555555555555";

describe("BindShipmentPendingSkuService", () => {
  it("registers a missing exact SKU and passes the resolved identity to the audited writer", async () => {
    const resolveProductSkus = { execute: vi.fn().mockResolvedValue([]) };
    const registerProductSku = {
      execute: vi.fn().mockResolvedValue({
        productSkuId,
        productNumber: "SKU-NEW",
        version: 1,
        registrationState: "recorded",
      }),
    };
    const getShipment = {
      execute: vi.fn().mockResolvedValue(shipmentDetail()),
    };
    const binding = {
      bind: vi.fn().mockResolvedValue({
        duplicate: false,
        relationshipVersion: 2,
        cargoLineVersion: 4,
        skuResolution: "registered",
        traceId: "sku-trace",
      }),
    };
    const service = new BindShipmentPendingSkuService(
      resolveProductSkus as never,
      registerProductSku as never,
      getShipment as never,
      binding as never,
    );

    const result = await service.execute(shipmentId, skuCommand(), {
      tenantId,
      actorId: "operator-1",
    });

    expect(resolveProductSkus.execute).toHaveBeenCalledWith({
      tenantId,
      productNumbers: ["SKU-NEW"],
    });
    expect(registerProductSku.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, productNumber: "SKU-NEW" }),
    );
    expect(binding.bind).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        shipmentId,
        productSkuId,
        productNumber: "SKU-NEW",
        skuResolution: "registered",
      }),
    );
    expect(result).toMatchObject({
      status: "saved",
      cargoLineVersion: 4,
      productSkuId,
      productNumber: "SKU-NEW",
      skuResolution: "registered",
    });
  });

  it("rejects a stale cargo line before creating SKU master data", async () => {
    const registerProductSku = { execute: vi.fn() };
    const service = new BindShipmentPendingSkuService(
      { execute: vi.fn() } as never,
      registerProductSku as never,
      { execute: vi.fn().mockResolvedValue(shipmentDetail()) } as never,
      { bind: vi.fn() } as never,
    );

    await expect(
      service.execute(
        shipmentId,
        { ...skuCommand(), expectedCargoLineVersion: 2 },
        { tenantId, actorId: "operator-1" },
      ),
    ).rejects.toThrow("SHIPMENT_CARGO_LINE_VERSION_CONFLICT");
    expect(registerProductSku.execute).not.toHaveBeenCalled();
  });

  it("lets a completed line reach the Handoff replay path", async () => {
    const registerProductSku = { execute: vi.fn() };
    const binding = {
      bind: vi.fn().mockResolvedValue({
        duplicate: true,
        relationshipVersion: 2,
        cargoLineVersion: 4,
        skuResolution: "registered",
        traceId: "original-trace",
      }),
    };
    const detail = shipmentDetail();
    (detail.cargoLines[0] as { productSkuId: string | null }).productSkuId =
      productSkuId;
    detail.cargoLines[0]!.version = 4;
    const service = new BindShipmentPendingSkuService(
      {
        execute: vi
          .fn()
          .mockResolvedValue([
            { productSkuId, productNumber: "SKU-NEW", version: 1 },
          ]),
      } as never,
      registerProductSku as never,
      { execute: vi.fn().mockResolvedValue(detail) } as never,
      binding as never,
    );

    await expect(
      service.execute(shipmentId, skuCommand(), {
        tenantId,
        actorId: "operator-1",
      }),
    ).resolves.toMatchObject({
      status: "duplicate",
      skuResolution: "registered",
      traceId: "original-trace",
    });
    expect(registerProductSku.execute).not.toHaveBeenCalled();
    expect(binding.bind).toHaveBeenCalled();
  });
});

describe("CompleteShipmentPendingDocumentsService", () => {
  it("normalizes SCAC and verifies visible container scope before writing", async () => {
    const completion = {
      complete: vi.fn().mockResolvedValue({
        duplicate: false,
        relationshipVersion: 2,
        documentCount: 1,
        traceId: "document-trace",
      }),
    };
    const service = new CompleteShipmentPendingDocumentsService(
      { execute: vi.fn().mockResolvedValue(shipmentDetail()) } as never,
      completion as never,
    );

    const result = await service.execute(
      shipmentId,
      {
        contractVersion: "shipment-pending-document-completion.v1",
        expectedRelationshipVersion: 2,
        occurredAt: "2026-09-25T08:00:00.000Z",
        idempotencyKey: "document-1",
        documents: [
          {
            documentType: "mbl",
            documentNumber: " NBOZ9FF56400 ",
            scac: "hmmu",
            containerRecordIds: [containerId],
          },
        ],
      },
      { tenantId, actorId: "operator-1" },
    );

    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        shipmentId,
        command: expect.objectContaining({
          documents: [
            {
              documentType: "mbl",
              documentNumber: "NBOZ9FF56400",
              scac: "HMMU",
              containerRecordIds: [containerId],
            },
          ],
        }),
      }),
    );
    expect(result).toMatchObject({ status: "saved", documentCount: 1 });
  });

  it("rejects a container outside the Shipment before the writer runs", async () => {
    const completion = { complete: vi.fn() };
    const service = new CompleteShipmentPendingDocumentsService(
      { execute: vi.fn().mockResolvedValue(shipmentDetail()) } as never,
      completion as never,
    );

    await expect(
      service.execute(
        shipmentId,
        {
          contractVersion: "shipment-pending-document-completion.v1",
          expectedRelationshipVersion: 2,
          occurredAt: "2026-09-25T08:00:00.000Z",
          idempotencyKey: "document-1",
          documents: [
            {
              documentType: "mbl",
              documentNumber: "NBOZ9FF56400",
              scac: null,
              containerRecordIds: ["66666666-6666-4666-8666-666666666666"],
            },
          ],
        },
        { tenantId, actorId: "operator-1" },
      ),
    ).rejects.toThrow("SHIPMENT_CONTAINER_REFERENCE_INVALID");
    expect(completion.complete).not.toHaveBeenCalled();
  });
});

function skuCommand() {
  return {
    contractVersion: "shipment-pending-sku-binding.v1",
    expectedRelationshipVersion: 2,
    expectedCargoLineVersion: 3,
    occurredAt: "2026-09-25T08:00:00.000Z",
    idempotencyKey: "sku-binding-1",
    cargoLineId,
  };
}

function shipmentDetail() {
  return {
    shipment: { id: shipmentId, relationshipVersion: 2 },
    containers: [{ containerRecordId: containerId }],
    cargoLines: [
      {
        id: cargoLineId,
        productSkuId: null,
        productNumber: "SKU-NEW",
        version: 3,
      },
    ],
  };
}
