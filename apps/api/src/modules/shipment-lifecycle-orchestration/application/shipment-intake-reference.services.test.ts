import { describe, expect, it, vi } from "vitest";
import { ListShipmentIntakeReferenceDataService } from "./list-shipment-intake-reference-data.service";
import { SearchShipmentIntakePortsService } from "./search-shipment-intake-ports.service";

describe("Shipment intake reference services", () => {
  it("returns cargo owner and sales country as separate business facts", async () => {
    const owners = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        stableCode: "AOSOM_US",
        legalName: "AOSOM LLC",
        salesCountryCode: "US",
        salesCountryNameChinese: "美国",
      },
    ];
    const service = new ListShipmentIntakeReferenceDataService({
      listActive: vi.fn().mockResolvedValue(owners),
    } as never);

    await expect(service.execute()).resolves.toEqual({
      contractVersion: "shipment-intake-reference-data.v1",
      cargoOwners: owners,
    });
  });

  it("returns localized port choices for business selection", async () => {
    const port = {
      portId: "22222222-2222-4222-8222-222222222222",
      unlocode: "USLAX",
      officialName: "Los Angeles",
      areaCode: "US",
      countryNameChinese: "美国",
      nameChinese: "洛杉矶",
      nameChineseState: "confirmed" as const,
    };
    const directory = {
      search: vi.fn().mockResolvedValue({ items: [port], nextCursor: null }),
    };
    const service = new SearchShipmentIntakePortsService(directory as never);

    await expect(
      service.execute({ query: "洛杉矶", pageSize: 20 }),
    ).resolves.toEqual({
      contractVersion: "shipment-intake-port-search.v1",
      items: [port],
      pageSize: 20,
      nextCursor: null,
    });
  });
});
