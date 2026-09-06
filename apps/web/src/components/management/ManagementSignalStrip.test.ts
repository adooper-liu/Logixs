import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ManagementSignalStrip from "./ManagementSignalStrip.vue";

const TestIcon = defineComponent({ template: "<span />" });

describe("ManagementSignalStrip", () => {
  it("renders four focused signals without decorative charts", async () => {
    const items = [
      {
        label: "在线货柜",
        value: "3 柜",
        helpText: "当前生命周期投影",
        tone: "brand" as const,
        icon: TestIcon,
        to: "/containers",
      },
      {
        label: "高风险货柜",
        value: "1 柜",
        helpText: "优先进入决策队列",
        tone: "risk" as const,
        icon: TestIcon,
        to: "/containers?filter=risk",
      },
      {
        label: "周计划达成",
        value: "72%",
        supportingText: "完成 36 / 计划 50",
        tone: "warn" as const,
        icon: TestIcon,
        to: "/meso?dimension=achievement",
      },
      {
        label: "待服务器确认",
        value: "0 项",
        supportingText: "全部已落账",
        tone: "ok" as const,
        icon: TestIcon,
        to: "/tasks",
      },
    ];

    const wrapper = mount(ManagementSignalStrip, {
      props: { items },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.attributes("aria-label")).toBe("关键运营信号");
    expect(wrapper.findAll(".signal")).toHaveLength(4);
    expect(wrapper.find("[role='img']").exists()).toBe(false);
    expect(wrapper.find("[data-visual-bar]").exists()).toBe(false);
    expect(wrapper.text()).toContain("待服务器确认0 项全部已落账");
    expect(wrapper.text()).not.toContain("当前生命周期投影");

    await wrapper.get('[aria-label="查看在线货柜口径"]').trigger("click");
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      "当前生命周期投影",
    );
  });
});
