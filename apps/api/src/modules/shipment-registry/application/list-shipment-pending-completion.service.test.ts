import type {
  ShipmentPendingCompletionItemV1,
  ShipmentSummaryV1,
} from "@logix/contracts";
import { describe, expect, it, vi } from "vitest";
import { ListShipmentPendingCompletionService } from "./list-shipment-pending-completion.service";
import { encodeShipmentCursor } from "../domain/shipment-page";

describe("ListShipmentPendingCompletionService", () => {
  it("returns a stable, tenant-bound page of persisted Shipment gaps", async () => {
    const items = [item("11111111-1111-4111-8111-111111111111")];
    const repository = {
      list: vi.fn(),
      findById: vi.fn(),
      listPendingCompletion: vi.fn().mockResolvedValue(items),
    };
    const service = new ListShipmentPendingCompletionService(repository);

    const page = await service.execute({
      tenantId: "tenant-1",
      pageSize: "20",
    });

    expect(repository.listPendingCompletion).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      after: undefined,
      take: 21,
    });
    expect(page.items).toEqual(items);
    expect(page.pageInfo).toEqual({
      nextCursor: null,
      hasNextPage: false,
      pageSize: 20,
    });
    expect(page.projectionVersion).toBe(2);
  });

  it("rejects requests without an authenticated tenant", async () => {
    const service = new ListShipmentPendingCompletionService({} as never);
    await expect(service.execute({ tenantId: "" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("rejects a cursor issued for the general Shipment list", async () => {
    const service = new ListShipmentPendingCompletionService({} as never);
    const cursor = encodeShipmentCursor({
      tenantId: "tenant-1",
      status: null,
      updatedAt: new Date("2026-09-24T02:00:00.000Z"),
      id: "11111111-1111-4111-8111-111111111111",
    });

    await expect(
      service.execute({ tenantId: "tenant-1", cursor }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

function item(id: string): ShipmentPendingCompletionItemV1 {
  return {
    shipment: summary(id),
    pendingItems: [
      {
        code: "cargo_detail_missing",
        label: "补充 SKU 装载明细",
        subjectType: "cargo",
        subjectRef: id,
        currentValue: null,
        sourceSystem: "integration-test",
        sourceValue: null,
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
        directAction: { code: "add_cargo_lines", label: "补录明细" },
      },
    ],
  };
}

function summary(id: string): ShipmentSummaryV1 {
  return {
    id,
    shipmentNumber: "SHIP-001",
    transportMode: "ocean",
    carrierCode: null,
    vesselName: null,
    voyageNumber: null,
    originCountryCode: null,
    originUnlocode: null,
    destinationCountryCode: null,
    destinationUnlocode: null,
    salesCountryCode: null,
    cargoOwnerReferenceId: null,
    cargoOwnerName: null,
    atdAt: null,
    etaAt: null,
    currentLifecycleStatus: "departed",
    lifecycleVersion: 2,
    relationshipVersion: 1,
    activeContainerCount: 1,
    activeCargoLineCount: 0,
    lifecycleInitializationState: "pending",
    updatedAt: "2026-09-24T02:00:00.000Z",
  };
}
