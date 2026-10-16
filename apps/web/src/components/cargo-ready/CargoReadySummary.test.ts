import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CargoReadySummary from "./CargoReadySummary.vue";

describe("CargoReadySummary", () => {
  it("shows missing order lines as the primary gap instead of claiming no gaps", () => {
    const wrapper = mount(CargoReadySummary, {
      props: {
        order: {
          id: "order-empty",
          orderNumber: "26DSC01811",
          updatedAt: "2026-10-15T00:00:00.000Z",
          workReason: {
            code: "complete_order_lines",
            label: "补充备货明细",
            detail: "备货单尚无当前 SKU 明细",
            responsibility: "mine",
          },
          nextAction: {
            code: "replenishment.import",
            label: "导入备货明细",
          },
          relatedContainers: [],
          handoffShipments: [],
          lines: [],
        },
        skuViews: [],
      },
    });

    expect(wrapper.text()).toContain("1 项需处理");
    expect(wrapper.text()).toContain("备货明细尚未导入");
    expect(wrapper.text()).toContain("请导入当前备货单的 SKU、数量和单位");
    expect(wrapper.text()).not.toContain("没有物料属性或适用资料缺口");
    expect(wrapper.text()).not.toContain("0 个需处理");
  });
});
