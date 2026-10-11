import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkbenchLayout from "./WorkbenchLayout.vue";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const mountLayout = () => {
  const wrapper = mount(WorkbenchLayout, {
    attachTo: document.body,
    props: {
      leftCollapsed: false,
      rightCollapsed: false,
      mobileScreen: "queue" as const,
      leftRailLabel: "任务队列",
      rightRailLabel: "操作上下文",
      "onUpdate:leftCollapsed": (value: boolean) =>
        wrapper.setProps({ leftCollapsed: value }),
      "onUpdate:rightCollapsed": (value: boolean) =>
        wrapper.setProps({ rightCollapsed: value }),
      "onUpdate:mobileScreen": (value: "queue" | "detail" | "context") =>
        wrapper.setProps({ mobileScreen: value }),
    },
    slots: {
      header: '<div data-region="header">header</div>',
      responsibility: '<div data-region="responsibility">responsibility</div>',
      decision: '<div data-region="decision">decision</div>',
      queue: '<button data-region="queue" id="queue-item">queue</button>',
      detail:
        '<div data-region="detail"><div class="workbench-pane__scroll--independent"><button id="detail-item">detail</button><button id="detail-secondary">secondary</button><input id="draft" /></div></div>',
      context:
        '<div data-region="context"><button id="context-action">context</button></div>',
    },
  });
  mounted.push(wrapper);
  return wrapper;
};

describe("WorkbenchLayout", () => {
  it("keeps identity, responsibility, decision, and all three panes in stable order", () => {
    const wrapper = mountLayout();

    expect(
      wrapper
        .findAll("[data-region]")
        .map((node) => node.attributes("data-region")),
    ).toEqual([
      "header",
      "responsibility",
      "decision",
      "queue",
      "detail",
      "context",
    ]);
  });

  it("updates slot content without changing pane count or order", async () => {
    const wrapper = mountLayout();
    expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);

    await wrapper.setProps({ rightRailSummary: "结论已冻结" });

    expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
    expect(
      wrapper
        .findAll("[data-workbench-pane]")
        .map((node) => node.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
  });

  it("folds either or both rails without removing pane content", async () => {
    const wrapper = mountLayout();

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    await wrapper.get('[aria-label="折叠操作上下文"]').trigger("click");

    expect(wrapper.props("leftCollapsed")).toBe(true);
    expect(wrapper.props("rightCollapsed")).toBe(true);
    expect(wrapper.find("#queue-item").exists()).toBe(true);
    expect(wrapper.find("#context-action").exists()).toBe(true);
  });

  it("keeps typed draft state while moving between mobile screens", async () => {
    const wrapper = mountLayout();
    const input = wrapper.get("#draft");
    await input.setValue("未提交草稿");

    await wrapper.setProps({ mobileScreen: "detail" });
    await wrapper.setProps({ mobileScreen: "context" });
    await wrapper.setProps({ mobileScreen: "detail" });

    expect((wrapper.get("#draft").element as HTMLInputElement).value).toBe(
      "未提交草稿",
    );
  });

  it("scrolls and focuses the selected mobile screen action", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const wrapper = mountLayout();

    await wrapper.get('[data-mobile-target="context"]').trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(document.activeElement).toBe(wrapper.get("#context-action").element);
  });

  it("restores each mobile pane's focused control and scroll position", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const wrapper = mountLayout();
    const detailScroll = wrapper.get(
      '[data-workbench-pane="detail"] .workbench-pane__scroll--independent',
    ).element as HTMLElement;

    await wrapper.setProps({ mobileScreen: "detail" });
    detailScroll.scrollTop = 144;
    (wrapper.get("#detail-secondary").element as HTMLElement).focus();

    await wrapper.setProps({ mobileScreen: "context" });
    detailScroll.scrollTop = 0;
    await wrapper.setProps({ mobileScreen: "detail" });
    await wrapper.vm.$nextTick();

    expect(detailScroll.scrollTop).toBe(144);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(document.activeElement).toBe(
      wrapper.get("#detail-secondary").element,
    );
  });

  it("treats the narrow queue overlay as a dismissible drawer", async () => {
    const wrapper = mountLayout();
    const trigger = wrapper.get('[aria-label="打开任务队列"]');

    await trigger.trigger("click");
    expect(
      wrapper.get('[data-workbench-pane="queue"]').attributes("role"),
    ).toBe("dialog");
    expect(
      wrapper.get('[data-workbench-pane="detail"]').attributes("inert"),
    ).toBe("");

    await wrapper.get('[data-workbench-pane="queue"]').trigger("keydown", {
      key: "Escape",
    });
    expect(
      wrapper.get('[aria-label="打开任务队列"]').attributes("aria-expanded"),
    ).toBe("false");
    expect(document.activeElement).toBe(trigger.element);
  });

  it("requests detail focus restoration after returning from context", async () => {
    const wrapper = mountLayout();

    await wrapper.setProps({ mobileScreen: "context" });
    await wrapper.get('[data-mobile-target="detail"]').trigger("click");

    expect(wrapper.emitted("restoreFocus")?.at(-1)).toEqual(["detail"]);
  });
});
