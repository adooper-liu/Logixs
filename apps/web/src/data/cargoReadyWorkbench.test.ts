import { describe, expect, it } from "vitest";
import type { ReplenishmentOrderWorkbenchItem } from "../api/replenishmentOrders";
import {
  buildCargoReadyOrderQueue,
  buildCargoReadySkuViews,
  filterCargoReadyQueue,
} from "./cargoReadyWorkbench";

describe("cargo-ready workbench presentation", () => {
  it("uses business reasons and only human-facing filters", () => {
    const queue = buildCargoReadyOrderQueue([
      workbenchOrder({
        workReason: {
          code: "complete_product_profile",
          label: "补物料资料",
          detail: "1 个 SKU 的物料属性需要确认",
          responsibility: "mine",
        },
      }),
      workbenchOrder({
        id: "order-2",
        orderNumber: "26DSC01811",
        workReason: {
          code: "waiting_other",
          label: "等待合规",
          detail: "等待合规责任岗完成评审",
          responsibility: "waiting_other",
        },
      }),
    ]);

    expect(queue.map((item) => item.title)).toEqual(["补物料资料", "等待合规"]);
    expect(filterCargoReadyQueue(queue, "mine")).toHaveLength(1);
    expect(filterCargoReadyQueue(queue, "waiting_other")).toHaveLength(1);
    expect(filterCargoReadyQueue(queue, "all")).toHaveLength(2);
  });

  it("folds a normal SKU and describes explicit absent facts", () => {
    const order = workbenchOrder();
    const views = buildCargoReadySkuViews(order, [
      {
        productSkuId: order.lines[0]!.productSkuId!,
        evaluated: true,
        requirements: [],
      },
    ]);

    expect(views[0]).toMatchObject({
      overall: "ready",
      attributeSummary: ["不含电池", "非危险品", "不含制冷剂"],
      gaps: [],
      requirementSummary: "本次无需补充合规资料",
    });
  });

  it("only expands the unknown attribute and applicable evidence gap", () => {
    const base = workbenchOrder();
    const order = workbenchOrder({
      lines: [
        {
          ...base.lines[0]!,
          productNumber: "311-023V01CW",
          profile: {
            ...base.lines[0]!.profile!,
            battery: {
              presenceState: "present",
              packingMode: "packed_with_equipment",
            },
            dangerousGoods: { classificationState: "undetermined" },
          },
          gaps: [
            {
              code: "dangerous_goods_unknown",
              label: "尚未确认是否属于危险品",
            },
          ],
        },
      ],
    });
    const views = buildCargoReadySkuViews(order, [
      {
        productSkuId: order.lines[0]!.productSkuId!,
        evaluated: true,
        requirements: [
          {
            productSkuId: order.lines[0]!.productSkuId!,
            certificateType: "transport_safety_assessment",
            label: "运输条件鉴定",
            status: "missing_or_invalid",
            reason: "EU-BATTERY v1 要求",
          },
        ],
      },
    ]);

    expect(views[0]).toMatchObject({
      overall: "attention",
      attributeSummary: [
        "含电池 · 随设备包装",
        "危险品属性待确认",
        "不含制冷剂",
      ],
      gaps: [
        { label: "尚未确认是否属于危险品" },
        { label: "运输条件鉴定缺失或无效" },
      ],
    });
    expect(views[0]?.attributeSummary).not.toContain("制冷剂未评审");
  });
});

function workbenchOrder(
  override: Partial<ReplenishmentOrderWorkbenchItem> = {},
): ReplenishmentOrderWorkbenchItem {
  return {
    id: "order-1",
    orderNumber: "26DSC01812",
    updatedAt: "2026-09-21T12:00:00.000Z",
    workReason: {
      code: "ready_for_container_review",
      label: "完成备货确认",
      detail: "物料事实齐全，已完成装柜分配",
      responsibility: "mine",
    },
    nextAction: {
      code: "work_execution.continue_cargo_ready",
      label: "继续备货确认",
    },
    relatedContainers: [{ id: "container-1", containerNumber: "HMMU4956442" }],
    handoffShipments: [],
    lines: [
      {
        id: "line-1",
        productSkuId: "11111111-1111-4111-8111-111111111111",
        productNumber: "311-013GY",
        shippedQuantity: "20",
        quantityUnit: "piece",
        allocatedQuantity: "20",
        unallocatedQuantity: "0",
        allocations: [
          {
            containerId: "container-1",
            containerNumber: "HMMU4956442",
            allocatedQuantity: "20",
            quantityUnit: "piece",
          },
        ],
        profile: {
          profileId: "profile-1",
          version: 1,
          verificationState: "verified",
          sourceSystem: "verified-master-data",
          createdAt: "2026-09-20T00:00:00.000Z",
          battery: { presenceState: "absent", packingMode: null },
          refrigerant: { presenceState: "absent" },
          dangerousGoods: { classificationState: "not_regulated" },
          inspectionRequirements: [],
        },
        gaps: [],
      },
    ],
    ...override,
  };
}
