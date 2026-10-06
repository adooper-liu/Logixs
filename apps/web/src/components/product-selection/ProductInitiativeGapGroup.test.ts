import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ProductInitiativeGapGroup from "./ProductInitiativeGapGroup.vue";

describe("ProductInitiativeGapGroup", () => {
  it("按业务区域显示聚合缺口，并发出直接定位", async () => {
    const wrapper = mount(ProductInitiativeGapGroup, {
      props: {
        activePanel: "objective",
        groups: [
          { panel: "objective", label: "目标结果", count: 1 },
          { panel: "unit_economics", label: "单位经济", count: 49 },
        ],
      },
    });
    expect(wrapper.text()).toContain("目标结果· 1 项未齐");
    expect(wrapper.text()).toContain("单位经济· 49 项未齐");
    await wrapper.get("button:nth-child(2)").trigger("click");
    expect(wrapper.emitted("select")).toEqual([["unit_economics"]]);
  });
});
