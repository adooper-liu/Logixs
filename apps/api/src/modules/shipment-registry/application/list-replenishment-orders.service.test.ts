import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { GET_PRODUCT_COMPLIANCE_PROFILE } from "../../master-data";
import { encodeContainerCursor } from "../domain/container-page";
import { REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY } from "../domain/replenishment-order-workbench.repository";
import type { ReplenishmentOrderWorkbenchRecord } from "../domain/replenishment-order-workbench.repository";
import { ListReplenishmentOrdersService } from "./list-replenishment-orders.service";

const order: ReplenishmentOrderWorkbenchRecord = {
  id: "order-1",
  orderNumber: "26DSC01812",
  updatedAt: "2026-09-21T12:00:00.000Z",
  linkedContainers: [],
  handoffShipments: [],
  lines: [
    {
      id: "line-1",
      productSkuId: "11111111-1111-4111-8111-111111111111",
      productNumber: "311-013GY",
      shippedQuantity: "20",
      quantityUnit: "piece",
      allocations: [],
      handoffShipments: [],
    },
  ],
};

async function buildService(options: {
  orders?: ReplenishmentOrderWorkbenchRecord[];
  profile?: object | null;
}) {
  const repository = {
    list: vi.fn().mockResolvedValue(options.orders ?? [order]),
  };
  const getProfile = {
    execute: vi.fn().mockResolvedValue(options.profile ?? null),
  };
  const module = await Test.createTestingModule({
    providers: [
      ListReplenishmentOrdersService,
      {
        provide: REPLENISHMENT_ORDER_WORKBENCH_REPOSITORY,
        useValue: repository,
      },
      { provide: GET_PRODUCT_COMPLIANCE_PROFILE, useValue: getProfile },
    ],
  }).compile();
  return {
    service: module.get(ListReplenishmentOrdersService),
    repository,
  };
}

describe("ListReplenishmentOrdersService", () => {
  it("拒绝缺少租户和跨租户 cursor", async () => {
    const { service, repository } = await buildService({});
    await expect(service.execute({})).rejects.toThrow(
      "AUTHORIZATION_SCOPE_DENIED",
    );
    await expect(
      service.execute({
        tenantId: "tenant-a",
        cursor: encodeContainerCursor({
          tenantId: "tenant-b",
          updatedAt: new Date(order.updatedAt),
          id: order.id,
        }),
      }),
    ).rejects.toThrow("VALIDATION_FORMAT");
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("无货柜时仍返回备货单，并把档案缺失作为真实缺口", async () => {
    const { service } = await buildService({ profile: null });
    const page = await service.execute({ tenantId: "tenant-a" });

    expect(page.items[0]).toMatchObject({
      orderNumber: "26DSC01812",
      workReason: {
        code: "complete_product_profile",
        label: "补物料资料",
        responsibility: "mine",
      },
      nextAction: {
        code: "master_data.review_product",
        label: "确认物料属性",
      },
      lines: [
        {
          allocations: [],
          allocatedQuantity: "0",
          unallocatedQuantity: "20",
          gaps: [{ code: "product_profile_missing" }],
        },
      ],
    });
  });

  it("没有当前明细时要求补充备货明细，而不是宣告可确认", async () => {
    const { service } = await buildService({
      orders: [
        {
          ...order,
          lines: [],
          linkedContainers: [
            { id: "container-1", containerNumber: "HMMU4207629" },
          ],
        },
      ],
    });

    const page = await service.execute({ tenantId: "tenant-a" });

    expect(page.items[0]).toMatchObject({
      relatedContainers: [
        { id: "container-1", containerNumber: "HMMU4207629" },
      ],
      workReason: {
        code: "complete_order_lines",
        label: "补充备货明细",
      },
      nextAction: {
        code: "replenishment.import",
        label: "导入备货明细",
      },
    });
  });

  it("明确否属性不会产生评审项，并保留一单多柜分配", async () => {
    const profile = {
      profileId: "profile-1",
      productSkuId: order.lines[0]!.productSkuId,
      version: 2,
      verificationState: "verified",
      battery: { presenceState: "absent", packingMode: null },
      refrigerant: { presenceState: "absent" },
      dangerousGoods: { classificationState: "not_regulated" },
      inspectionRequirements: [
        {
          requirementType: "commodity_inspection",
          requirementState: "not_required",
          jurisdictionCountryCode: null,
        },
      ],
      certificates: [],
      sourceSystem: "verified-master-data",
      createdAt: "2026-09-20T00:00:00.000Z",
    };
    const allocatedOrder = {
      ...order,
      lines: [
        {
          ...order.lines[0]!,
          allocations: [
            {
              containerId: "container-1",
              containerNumber: "HMMU4956442",
              allocatedQuantity: "12",
              quantityUnit: "piece",
            },
            {
              containerId: "container-2",
              containerNumber: "HMMU4207629",
              allocatedQuantity: "8",
              quantityUnit: "piece",
            },
          ],
        },
      ],
    };
    const { service } = await buildService({
      orders: [allocatedOrder],
      profile,
    });
    const page = await service.execute({ tenantId: "tenant-a" });

    expect(page.items[0]?.lines[0]).toMatchObject({
      gaps: [],
      allocatedQuantity: "20",
      unallocatedQuantity: "0",
      profile: {
        battery: { presenceState: "absent" },
        refrigerant: { presenceState: "absent" },
        dangerousGoods: { classificationState: "not_regulated" },
      },
    });
    expect(page.items[0]?.relatedContainers).toHaveLength(2);
    expect(page.items[0]?.workReason.code).toBe("ready_for_container_review");
  });

  it("拒绝把历史超分配静默显示为零", async () => {
    const overAllocated = {
      ...order,
      lines: [
        {
          ...order.lines[0]!,
          allocations: [
            {
              containerId: "container-1",
              containerNumber: "HMMU4956442",
              allocatedQuantity: "21",
              quantityUnit: "piece",
            },
          ],
        },
      ],
    };
    const { service } = await buildService({ orders: [overAllocated] });

    await expect(service.execute({ tenantId: "tenant-a" })).rejects.toThrow(
      "CARGO_ALLOCATION_EXCEEDS_SHIPPED_QUANTITY",
    );
  });
});
