import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PlannedWorkbenchView from "./PlannedWorkbenchView.vue";

describe("PlannedWorkbenchView", () => {
  function mountPlanned(stageCode: string) {
    return mount(PlannedWorkbenchView, {
      props: { stageCode },
      global: {
        stubs: {
          PageHeader: {
            props: ["title", "summary"],
            template:
              "<header><h1>{{ title }}</h1><p>{{ summary }}</p></header>",
          },
          RouterLink: {
            props: ["to"],
            template: "<a :href='to'><slot /></a>",
          },
        },
      },
    });
  }

  it("shows the role result and handoff boundaries without fake execution controls", () => {
    const wrapper = mountPlanned("procurement");

    expect(wrapper.get("h1").text()).toBe("采购履约工作台");
    expect(wrapper.text()).toContain("形成可追踪的采购承诺");
    expect(wrapper.text()).toContain("补货决策交接");
    expect(wrapper.text()).toContain("采购承诺交接");
    expect(wrapper.text()).toContain(
      "预测、库存策略和补货计算形成责任人决定时",
    );
    expect(wrapper.text()).toContain("SKU 与国家");
    expect(wrapper.text()).toContain("框架已建立，业务能力待接通");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("renders every inbound dependency for a fan-in workbench", () => {
    const wrapper = mountPlanned("dispatch");

    expect(wrapper.findAll('[data-testid="inbound-relation"]')).toHaveLength(3);
    expect(wrapper.text()).toContain("订舱");
    expect(wrapper.text()).toContain("装箱");
    expect(wrapper.text()).toContain("出口报关");
  });

  for (const stageCode of [
    "booking",
    "export_customs",
    "compliance_operations",
  ]) {
    it(`keeps the ${stageCode} catalog stub read-only`, () => {
      const wrapper = mountPlanned(stageCode);

      expect(
        wrapper.findAll(
          "button, form, input:not([readonly]), textarea:not([readonly]), select",
        ),
      ).toHaveLength(0);
    });
  }
});
