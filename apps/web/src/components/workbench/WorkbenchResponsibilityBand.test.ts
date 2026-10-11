import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchResponsibilityBand from "./WorkbenchResponsibilityBand.vue";

describe("WorkbenchResponsibilityBand", () => {
  it("renders known, unknown, and not-applicable responsibility facts without defaults", () => {
    const wrapper = mount(WorkbenchResponsibilityBand, {
      props: {
        ariaLabel: "岗位、对象与责任上下文",
        items: [
          { label: "当前对象", value: "机会 A", state: "known" },
          { label: "下一责任", value: null, state: "unknown" },
          { label: "等待对象", value: null, state: "not-applicable" },
        ],
      },
    });

    expect(wrapper.text()).toContain("机会 A");
    expect(wrapper.text()).toContain("未知");
    expect(wrapper.text()).toContain("不适用");
    expect(wrapper.text()).not.toContain("0");
    expect(wrapper.get("section").attributes("aria-label")).toBe(
      "岗位、对象与责任上下文",
    );
  });
});
