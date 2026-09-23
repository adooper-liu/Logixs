import { describe, expect, it, vi } from "vitest";
import type { GetContainerCargoComplianceScopeService } from "../application/get-container-cargo-compliance-scope.service";
import type { GetContainerOperationalViewService } from "../application/get-container-operational-view.service";
import type { GetContainerService } from "../application/get-container.service";
import type { ListContainersService } from "../application/list-containers.service";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import { ContainersController } from "./containers.controller";

describe("ContainersController.getCargo", () => {
  it("returns the active tenant-scoped cargo projection", async () => {
    const getContainer = {
      execute: vi.fn().mockResolvedValue({ id: "container-1" }),
    };
    const getCargo = {
      execute: vi.fn().mockResolvedValue({
        containerRecordId: "container-1",
        allocationSetId: "11111111-1111-4111-8111-111111111111",
        allocationSetVersion: 2,
        items: [
          {
            replenishmentOrderLineId: "line-1",
            productSkuId: "22222222-2222-4222-8222-222222222222",
            productNumber: "SKU-1",
            allocatedQuantity: "12",
            quantityUnit: "carton",
          },
        ],
      }),
    };
    const controller = createController(getContainer, getCargo);

    await expect(
      controller.getCargo(
        { identity: { tenantId: "tenant-1" } },
        "container-1",
      ),
    ).resolves.toMatchObject({
      allocationSetVersion: 2,
      items: [{ productNumber: "SKU-1", allocatedQuantity: "12" }],
    });
    expect(getContainer.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      id: "container-1",
    });
    expect(getCargo.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerRecordId: "container-1",
    });
  });

  it("returns an explicit empty projection when no active allocation exists", async () => {
    const getContainer = {
      execute: vi.fn().mockResolvedValue({ id: "container-1" }),
    };
    const controller = createController(getContainer, {
      execute: vi.fn().mockResolvedValue(null),
    });

    await expect(
      controller.getCargo(
        { identity: { tenantId: "tenant-1" } },
        "container-1",
      ),
    ).resolves.toEqual({
      containerRecordId: "container-1",
      allocationSetId: null,
      allocationSetVersion: null,
      items: [],
    });
  });
});

describe("ContainersController.getOperationalView", () => {
  it("requires container and lifecycle read capabilities", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_CAPABILITIES_KEY,
        ContainersController.prototype.getOperationalView,
      ),
    ).toEqual(["container.read", "lifecycle.read"]);
  });

  it("passes only authenticated scope and capabilities to the use case", async () => {
    const getOperationalView = { execute: vi.fn().mockResolvedValue({}) };
    const controller = createController(
      { execute: vi.fn() },
      { execute: vi.fn() },
      getOperationalView,
    );

    await controller.getOperationalView(
      {
        identity: {
          tenantId: "tenant-1",
          capabilities: ["container.read", "lifecycle.read", "evidence.read"],
        },
      },
      "container-1",
    );

    expect(getOperationalView.execute).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      containerId: "container-1",
      capabilities: ["container.read", "lifecycle.read", "evidence.read"],
    });
  });
});

function createController(
  getContainer: { execute: ReturnType<typeof vi.fn> },
  getCargo: { execute: ReturnType<typeof vi.fn> },
  getOperationalView: { execute: ReturnType<typeof vi.fn> } = {
    execute: vi.fn(),
  },
): ContainersController {
  return new ContainersController(
    {} as ListContainersService,
    getContainer as unknown as GetContainerService,
    getCargo as unknown as GetContainerCargoComplianceScopeService,
    getOperationalView as unknown as GetContainerOperationalViewService,
  );
}
