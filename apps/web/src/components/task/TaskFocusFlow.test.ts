import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import TaskFocusFlow from "./TaskFocusFlow.vue";

describe("TaskFocusFlow", () => {
  it("exposes the current step without turning the guide into controls", () => {
    const wrapper = mount(TaskFocusFlow, {
      props: {
        currentCode: "inputs",
        steps: [
          { code: "claim", label: "领取", state: "done" },
          {
            code: "inputs",
            label: "资料",
            state: "current",
            progress: "1/2",
          },
          { code: "submit", label: "提交", state: "upcoming" },
          { code: "sync", label: "落账", state: "upcoming" },
        ],
      },
    });

    expect(wrapper.get("nav").attributes("aria-label")).toBe("任务执行导引");
    expect(wrapper.get('[aria-current="step"]').text()).toContain("资料1/2");
    expect(wrapper.findAll("button")).toHaveLength(0);
  });
});
