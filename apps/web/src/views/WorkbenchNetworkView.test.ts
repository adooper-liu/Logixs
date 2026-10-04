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
    ).toHaveLength(20);
    expect(
      wrapper.findAll('[data-testid="support-workbench-stage"]'),
    ).toHaveLength(3);
    expect(wrapper.findAll('[data-implementation="live"]')).toHaveLength(12);
    expect(wrapper.findAll('[data-implementation="prototype"]')).toHaveLength(
      0,
    );
    expect(wrapper.text()).toContain("市场与经营信号");
    expect(wrapper.text()).toContain("还箱工作台");
    expect(wrapper.text()).toContain("订舱");
    expect(wrapper.text()).toContain("出口报关");
    expect(wrapper.text()).toContain("合规运营");
    expect(wrapper.text()).toContain("进口清关");
    expect(wrapper.text()).toContain("费用结算工作台");
    expect(wrapper.text()).toContain("异常中心");
    expect(wrapper.text()).toContain("经营机会交接");
    expect(wrapper.text()).toContain("采购承诺交接");
    // 交接画在卡片之外的连接处，卡片链接内不再有交接页脚。
    expect(wrapper.findAll(".stage-link .stage-handoff")).toHaveLength(0);
    expect(
      wrapper.get('.stage-connector[data-from="shipment_planning"]').text(),
    ).toContain("2 项出向交接");
    expect(
      wrapper.get('a[href="/workspaces/shipment-planning"]').text(),
    ).not.toContain("出向交接");
    expect(wrapper.text()).toContain("支撑模块");
    expect(wrapper.text()).toContain("已接真实能力");
    expect(wrapper.text()).toContain("不代表业务闭环已经验收");
    expect(wrapper.text()).not.toContain("可工作");
    expect(wrapper.get('a[href="/workspaces/dispatch"]')).toBeTruthy();
  });

  it("does not invent business volume before a server projection exists", () => {
    const wrapper = mount(WorkbenchNetworkView, {
      global: {
        stubs: {
          PageHeader: true,
          RouterLink: {
            props: ["to"],
            template: "<a :href='to'><slot /></a>",
          },
        },
      },
    });

    const band = wrapper.get('[aria-label="全局业务量"]');
    expect(band.text()).toContain("尚无业务量投影");
    expect(band.findAll("dd").map((cell) => cell.text())).toEqual([
      "—",
      "—",
      "—",
    ]);
    expect(band.text()).not.toMatch(/\d/);
    expect(band.get("a").attributes("href")).toBe("/workspaces/exceptions");
  });
});
