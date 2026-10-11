import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchDecisionStrip from "./WorkbenchDecisionStrip.vue";

describe("WorkbenchDecisionStrip", () => {
  it.each([
    ["segments", "3/8"],
    ["status", "验证待安排"],
    ["absent", ""],
  ])("passes through %s progress without inventing content", (_, progress) => {
    const wrapper = mount(WorkbenchDecisionStrip, {
      props: { conclusion: "办理中", ariaLabel: "当前结论与办理缺口" },
      slots: progress ? { progress } : {},
    });

    expect(wrapper.text()).toContain("办理中");
    if (progress) expect(wrapper.text()).toContain(progress);
    if (!progress) {
      expect(wrapper.text()).not.toContain("/");
      expect(wrapper.text()).not.toContain("%");
    }
  });

  it("renders gap controls and keeps the disabled reason inline", async () => {
    const wrapper = mount(WorkbenchDecisionStrip, {
      props: {
        conclusion: "当前门槛未满足",
        ariaLabel: "当前结论与办理缺口",
        disabledReason: "还缺价格带证据",
      },
      slots: {
        gaps: '<button data-gap="pricing">价格带证据</button>',
      },
    });

    await wrapper.get('[data-gap="pricing"]').trigger("click");
    expect(wrapper.text()).toContain("价格带证据");
    expect(wrapper.get('[role="status"]').text()).toBe("还缺价格带证据");
  });
});
