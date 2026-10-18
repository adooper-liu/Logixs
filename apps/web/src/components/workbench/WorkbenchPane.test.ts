import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WorkbenchPane from "./WorkbenchPane.vue";

describe("WorkbenchPane", () => {
  it.each(["loading", "empty", "error", "receipt"] as const)(
    "renders the %s state while preserving the pane heading",
    (kind) => {
      const state =
        kind === "error"
          ? ({ kind, message: "没能加载", traceId: "trace-1" } as const)
          : ({ kind, message: `${kind}-message` } as const);
      const wrapper = mount(WorkbenchPane, {
        props: {
          id: "detail-pane",
          title: "事实、缺口与推进任务",
          regionLabel: "事实、缺口与推进任务",
          state,
        },
      });

      expect(wrapper.get("h2").text()).toBe("事实、缺口与推进任务");
      expect(wrapper.text()).toContain(state.message);
      expect(wrapper.get("section").attributes("aria-label")).toBe(
        "事实、缺口与推进任务",
      );
    },
  );

  it("emits retry once for an error state", async () => {
    const wrapper = mount(WorkbenchPane, {
      props: {
        id: "detail-pane",
        title: "事实、缺口与推进任务",
        regionLabel: "事实、缺口与推进任务",
        state: { kind: "error", message: "没能加载", traceId: "trace-1" },
      },
      attrs: { onRetry: () => undefined },
    });

    await wrapper.get('button[type="button"]').trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
    expect(wrapper.text()).toContain("trace-1");
  });

  it("keeps a single independently scrollable body inside a bounded pane", () => {
    const wrapper = mount(WorkbenchPane, {
      props: {
        id: "queue-pane",
        title: "对象与任务队列",
        regionLabel: "对象与任务队列",
      },
      slots: { default: '<div style="height: 900px">长队列</div>' },
      attachTo: document.body,
    });

    const pane = wrapper.get(".workbench-pane");
    const scroll = wrapper.get(".workbench-pane__scroll");
    expect(pane.classes()).toContain("workbench-pane--bounded");
    expect(scroll.classes()).toContain("workbench-pane__scroll--independent");
    wrapper.unmount();
  });

  it("renders ready content inside the single scroll owner", () => {
    const wrapper = mount(WorkbenchPane, {
      props: {
        id: "queue-pane",
        title: "对象与任务队列",
        regionLabel: "对象与任务队列",
      },
      slots: { default: "队列内容" },
    });

    expect(wrapper.get(".workbench-pane__scroll").text()).toContain("队列内容");
    expect(wrapper.findAll(".workbench-pane__scroll")).toHaveLength(1);
    expect(
      wrapper.findAll(".workbench-pane__scroll--independent"),
    ).toHaveLength(1);
  });
});
