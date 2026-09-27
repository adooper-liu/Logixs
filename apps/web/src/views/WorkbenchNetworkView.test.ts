import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchNetworkView from "./WorkbenchNetworkView.vue";

describe("WorkbenchNetworkView", () => {
  it("shows the complete business chain and distinguishes live workbenches", () => {
    const wrapper = mount(WorkbenchNetworkView, {
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

    expect(wrapper.get("h1").text()).toBe("业务工作台");
    expect(
      wrapper.findAll('[data-testid="main-workbench-stage"]'),
    ).toHaveLength(18);
    expect(wrapper.findAll('[data-implementation="live"]')).toHaveLength(11);
    expect(wrapper.findAll('[data-implementation="prototype"]')).toHaveLength(
      0,
    );
    expect(wrapper.text()).toContain("市场与经营信号");
    expect(wrapper.text()).toContain("还箱工作台");
    expect(wrapper.text()).toContain("费用结算工作台");
    expect(wrapper.text()).toContain("异常中心");
    expect(wrapper.get('a[href="/workspaces/dispatch"]')).toBeTruthy();
  });
});
