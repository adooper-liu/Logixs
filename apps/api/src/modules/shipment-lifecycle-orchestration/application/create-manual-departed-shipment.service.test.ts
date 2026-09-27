import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { CreateManualDepartedShipmentService } from "./create-manual-departed-shipment.service";

const requestId = "11111111-1111-4111-8111-111111111111";
const cargoOwnerId = "22222222-2222-4222-8222-222222222222";

describe("CreateManualDepartedShipmentService", () => {
  it("maps business input to the shared Handoff and keeps ordinary gaps non-blocking", async () => {
    const accept = {
      accept: vi.fn().mockResolvedValue({
        shipmentId: "33333333-3333-4333-8333-333333333333",
      }),
    };
    const ports = {
      findByUnlocodes: vi
        .fn()
        .mockResolvedValue([
          port("CNNGB", "CN", "宁波"),
          port("USLAX", "US", "洛杉矶"),
        ]),
    };
    const cargoOwners = {
      findActiveById: vi.fn().mockResolvedValue({
        id: cargoOwnerId,
        stableCode: "AOSOM_US",
        legalName: "AOSOM LLC",
        salesCountryCode: "US",
        salesCountryNameChinese: "美国",
      }),
    };
    const service = new CreateManualDepartedShipmentService(
      accept as never,
      ports as never,
      cargoOwners as never,
    );

    await service.execute(
      {
        contractVersion: "manual-departed-shipment-create.v1",
        requestId,
        shipmentNumber: " SHIP-2026-001 ",
        vesselName: " ONE TRUTH ",
        originPortCode: "CNNGB",
        destinationPortCode: "USLAX",
        cargoOwnerReferenceId: cargoOwnerId,
        containers: [{ containerNumber: "HMMU4956442" }],
      },
      { tenantId: "tenant-a", actorId: "operator-a" },
    );

    expect(accept.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        contractVersion: "shipment-handoff.v2",
        tenantId: "tenant-a",
        sourceProfile: "api_v1",
        source: expect.objectContaining({
          channel: "manual",
          system: "logix.workbench",
          externalHandoffId: `manual:${requestId}`,
          idempotencyKey: `manual-shipment:${requestId}`,
        }),
        shipment: expect.objectContaining({
          shipmentNumber: "SHIP-2026-001",
          vesselName: "ONE TRUTH",
          originPortCode: "CNNGB",
          destinationPortCode: "USLAX",
          destinationCountryCode: "US",
          cargoOwnerReferenceId: cargoOwnerId,
          cargoOwnerName: "AOSOM LLC",
          salesCountryCode: "US",
        }),
        containers: [
          expect.objectContaining({
            containerNumber: "HMMU4956442",
            billReferences: [],
            upstreamReferences: [],
          }),
        ],
        billsOfLading: [],
        evidenceReferences: [],
      }),
      { tenantId: "tenant-a", actorId: "operator-a" },
    );
  });

  it("rejects a provided port that is absent from the active directory", async () => {
    const service = new CreateManualDepartedShipmentService(
      { accept: vi.fn() } as never,
      { findByUnlocodes: vi.fn().mockResolvedValue([]) } as never,
      { findActiveById: vi.fn() } as never,
    );

    await expect(
      service.execute(
        {
          contractVersion: "manual-departed-shipment-create.v1",
          requestId,
          shipmentNumber: "SHIP-2026-001",
          originPortCode: "CNNGB",
          containers: [{ containerNumber: "HMMU4956442" }],
        },
        { tenantId: "tenant-a", actorId: "operator-a" },
      ),
    ).rejects.toThrow("UNKNOWN_REFERENCE_CODE");
  });

  it("rejects a command without a valid Shipment and container identity", async () => {
    const service = new CreateManualDepartedShipmentService(
      { accept: vi.fn() } as never,
      { findByUnlocodes: vi.fn() } as never,
      { findActiveById: vi.fn() } as never,
    );

    await expect(
      service.execute(
        {
          contractVersion: "manual-departed-shipment-create.v1",
          requestId,
          shipmentNumber: "SHIP-2026-001",
          containers: [],
        },
        { tenantId: "tenant-a", actorId: "operator-a" },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function port(unlocode: string, areaCode: string, nameChinese: string) {
  return {
    portId: `${areaCode === "CN" ? "4" : "5"}4444444-4444-4444-8444-444444444444`,
    unlocode,
    officialName: nameChinese,
    areaCode,
    countryNameChinese: areaCode === "CN" ? "中国" : "美国",
    nameChinese,
    nameChineseState: "confirmed" as const,
  };
}
