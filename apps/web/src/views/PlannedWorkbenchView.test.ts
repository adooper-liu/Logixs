import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PlannedWorkbenchView from "./PlannedWorkbenchView.vue";

describe("PlannedWorkbenchView", () => {
  it("shows the role result and handoff boundaries without fake execution controls", () => {
    const wrapper = mount(PlannedWorkbenchView, {
      props: { stageCode: "procurement" },
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

    expect(wrapper.get("h1").text()).toBe("采购履约工作台");
    expect(wrapper.text()).toContain("形成可追踪的采购承诺");
    expect(wrapper.text()).toContain("补货决策交接");
    expect(wrapper.text()).toContain("采购承诺交接");
    expect(wrapper.text()).toContain("框架已建立，业务能力待接通");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
