import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProductEvaluationRequirementsPanel from "./ProductEvaluationRequirementsPanel.vue";

describe("ProductEvaluationRequirementsPanel", () => {
  it("keeps only requirement, action and on-demand explanations", async () => {
    const wrapper = mount(ProductEvaluationRequirementsPanel, {
      props: {
        requirements: [
          {
            code: "competitive_supply_evidence",
            label: "竞争供给证据",
            fieldLabel: "竞争供给证据",
            placeholder: "填写关键事实",
            rationale: "已选定商品范围，需要竞争供给事实。",
            reviewPointCode: "competitive_supply",
          },
        ],
        withheld: [
          {
            code: "price_band",
            label: "目标价格带",
            missing: "尚未选定商品范围",
            reviewPointCode: "price_band_and_margin",
          },
        ],
        busy: false,
        saveEvidence: vi.fn().mockResolvedValue(true),
      },
    });

    expect(wrapper.get("h3").text()).toBe("专业要求");
    expect(wrapper.get(".requirement-head").text()).not.toContain("已登记证据");
    expect(wrapper.get(".requirement-head").text()).not.toContain("待添加证据");
    expect(wrapper.get("button.add-evidence").text()).toContain("添加证据");
    expect(wrapper.findAll('[aria-label="查看专业要求说明"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain("评估阶段才会出现");
    expect(wrapper.text()).not.toContain("为什么适用");
    expect(wrapper.text()).not.toContain("补进去会成为");
    expect(wrapper.get(".withheld-notice summary").text()).toContain(
      "另有 1 项",
    );
    expect(
      (wrapper.get(".withheld-notice").element as HTMLDetailsElement).open,
    ).toBe(false);

    await wrapper.get(".withheld-notice summary").trigger("click");
    expect(
      (wrapper.get(".withheld-notice").element as HTMLDetailsElement).open,
    ).toBe(true);
    expect(wrapper.get(".withheld-notice li").text()).toContain("目标价格带");
  });
});
