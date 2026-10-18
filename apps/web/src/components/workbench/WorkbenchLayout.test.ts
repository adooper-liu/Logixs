import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkbenchLayout from "./WorkbenchLayout.vue";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mountLayout = (
  props: Record<string, unknown> = {},
  attachTo: Element = document.body,
  syncCollapsedProps = true,
) => {
  const wrapper = mount(WorkbenchLayout, {
    attachTo,
    props: {
      leftCollapsed: false,
      rightCollapsed: false,
      mobileScreen: "queue" as const,
      leftRailLabel: "任务队列",
      rightRailLabel: "操作上下文",
      ...props,
      ...(syncCollapsedProps
        ? {
            "onUpdate:leftCollapsed": (value: boolean) =>
              wrapper.setProps({ leftCollapsed: value }),
            "onUpdate:rightCollapsed": (value: boolean) =>
              wrapper.setProps({ rightCollapsed: value }),
          }
        : {}),
      "onUpdate:mobileScreen": (value: "queue" | "detail" | "context") =>
        wrapper.setProps({ mobileScreen: value }),
    },
    slots: {
      header: '<div data-region="header">header</div>',
      responsibility: '<div data-region="responsibility">responsibility</div>',
      decision: '<div data-region="decision">decision</div>',
      queue:
        '<div class="workbench-pane__scroll--independent"><button data-region="queue" id="queue-item">queue</button></div>',
      detail:
        '<div data-region="detail"><div class="workbench-pane__scroll--independent"><button id="detail-item">detail</button><button id="detail-secondary">secondary</button><input id="draft" /></div></div>',
      context:
        '<div data-region="context"><div class="workbench-pane__scroll--independent"><button id="context-action">context</button></div></div>',
    },
  });
  mounted.push(wrapper);
  return wrapper;
};

describe("WorkbenchLayout", () => {
  it("lets a consumer name the mobile context screen while preserving the default", () => {
    const defaultLayout = mountLayout();
    const archiveLayout = mountLayout({ mobileContextLabel: "档案" });

    expect(defaultLayout.get('[data-mobile-target="context"]').text()).toBe(
      "编辑",
    );
    expect(archiveLayout.get('[data-mobile-target="context"]').text()).toBe(
      "档案",
    );
    expect(
      archiveLayout
        .findAll("[data-workbench-pane]")
        .map((node) => node.attributes("data-workbench-pane")),
    ).toEqual(["queue", "detail", "context"]);
  });

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

  it("restores each rail scroll owner without moving the other rail or page", async () => {
    const pageScrollOwner = document.createElement("div");
    pageScrollOwner.style.overflowY = "auto";
    document.body.appendChild(pageScrollOwner);
    const wrapper = mountLayout({}, pageScrollOwner);
    const queueScroll = wrapper.get(
      '[data-workbench-pane="queue"] .workbench-pane__scroll--independent',
    ).element as HTMLElement;
    const contextScroll = wrapper.get(
      '[data-workbench-pane="context"] .workbench-pane__scroll--independent',
    ).element as HTMLElement;

    pageScrollOwner.scrollTop = 47;
    queueScroll.scrollTop = 121;
    contextScroll.scrollTop = 233;

    (wrapper.get("#queue-item").element as HTMLElement).focus();
    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    expect(contextScroll.scrollTop).toBe(233);
    (wrapper.get("#context-action").element as HTMLElement).focus();
    await wrapper.get('[aria-label="折叠操作上下文"]').trigger("click");

    queueScroll.scrollTop = 0;
    contextScroll.scrollTop = 0;

    await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
    await wrapper.vm.$nextTick();
    await nextLayoutFrame();
    expect(queueScroll.scrollTop).toBe(121);
    expect(contextScroll.scrollTop).toBe(0);
    expect(pageScrollOwner.scrollTop).toBe(47);
    expect(document.activeElement).toBe(wrapper.get("#queue-item").element);

    await wrapper.get('[aria-label="展开操作上下文"]').trigger("click");
    await wrapper.vm.$nextTick();
    await nextLayoutFrame();
    expect(contextScroll.scrollTop).toBe(233);
    expect(queueScroll.scrollTop).toBe(121);
    expect(pageScrollOwner.scrollTop).toBe(47);
    expect(document.activeElement).toBe(wrapper.get("#context-action").element);
  });

  it("uses controlled rail prop transitions as the scroll memory authority", async () => {
    const pageScrollOwner = document.createElement("div");
    pageScrollOwner.style.overflowY = "auto";
    document.body.appendChild(pageScrollOwner);
    const wrapper = mountLayout({}, pageScrollOwner, false);
    const queueScroll = railScrollOwner(wrapper, "queue");
    const contextScroll = railScrollOwner(wrapper, "context");

    pageScrollOwner.scrollTop = 47;
    queueScroll.scrollTop = 121;
    contextScroll.scrollTop = 233;

    await wrapper.setProps({ leftCollapsed: true });
    queueScroll.scrollTop = 0;
    await wrapper.setProps({ leftCollapsed: false });
    await settleWatchers();
    await nextLayoutFrame();

    expect(queueScroll.scrollTop).toBe(121);
    expect(contextScroll.scrollTop).toBe(233);
    expect(pageScrollOwner.scrollTop).toBe(47);
  });

  it("does not change rail state or schedule restoration when the parent rejects an update", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout({}, document.body, false);

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("update:leftCollapsed")?.at(-1)).toEqual([true]);
    expect(wrapper.props("leftCollapsed")).toBe(false);
    expect(wrapper.get("#queue-item").isVisible()).toBe(true);
    expect(frames.pending()).toBe(0);
  });

  it("waits for delayed parent writeback and restores the rail exactly once", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout({}, document.body, false);
    const queueScroll = railScrollOwner(wrapper, "queue");
    const contextScroll = railScrollOwner(wrapper, "context");
    queueScroll.scrollTop = 121;
    contextScroll.scrollTop = 233;

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.props("leftCollapsed")).toBe(false);
    expect(frames.pending()).toBe(0);

    await wrapper.setProps({ leftCollapsed: true });
    queueScroll.scrollTop = 0;
    await wrapper.setProps({ leftCollapsed: false });
    await settleWatchers();
    expect(frames.pending()).toBe(1);

    await frames.flushAll();
    expect(queueScroll.scrollTop).toBe(121);
    expect(contextScroll.scrollTop).toBe(233);
  });

  it("preserves user scroll that changes while controlled expansion settles", async () => {
    const frames = installAnimationFrameQueue();
    const pageScrollOwner = document.createElement("div");
    pageScrollOwner.style.overflowY = "auto";
    document.body.appendChild(pageScrollOwner);
    const wrapper = mountLayout({}, pageScrollOwner, false);
    const queueScroll = railScrollOwner(wrapper, "queue");
    const contextScroll = railScrollOwner(wrapper, "context");

    pageScrollOwner.scrollTop = 47;
    queueScroll.scrollTop = 121;
    contextScroll.scrollTop = 233;

    await wrapper.setProps({ leftCollapsed: true });
    queueScroll.scrollTop = 0;
    await wrapper.setProps({ leftCollapsed: false });
    await settleWatchers();
    expect(frames.pending()).toBeGreaterThan(0);

    queueScroll.scrollTop = 77;
    await frames.flushAll();

    expect(wrapper.props("leftCollapsed")).toBe(false);
    expect(queueScroll.scrollTop).toBe(77);
    expect(contextScroll.scrollTop).toBe(233);
    expect(pageScrollOwner.scrollTop).toBe(47);
  });

  it("invalidates stale rail restoration during rapid controlled transitions", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout();
    const queueScroll = railScrollOwner(wrapper, "queue");
    queueScroll.scrollTop = 121;

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    queueScroll.scrollTop = 0;
    await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
    await settleWatchers();
    expect(frames.pending()).toBeGreaterThan(0);
    queueScroll.scrollTop = 77;
    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    queueScroll.scrollTop = 88;

    await frames.flushAll();
    expect(wrapper.props("leftCollapsed")).toBe(true);
    expect(queueScroll.scrollTop).toBe(88);
  });

  it("never rewrites the other rail while controlled transitions settle", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout();
    const queueScroll = railScrollOwner(wrapper, "queue");
    const contextScroll = railScrollOwner(wrapper, "context");
    queueScroll.scrollTop = 121;
    contextScroll.scrollTop = 233;

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
    await settleWatchers();
    contextScroll.scrollTop = 317;
    await frames.flushAll();
    expect(contextScroll.scrollTop).toBe(317);

    await wrapper.get('[aria-label="折叠操作上下文"]').trigger("click");
    await wrapper.get('[aria-label="展开操作上下文"]').trigger("click");
    await settleWatchers();
    queueScroll.scrollTop = 419;
    await frames.flushAll();
    expect(queueScroll.scrollTop).toBe(419);
  });

  it("invalidates a pending rail restoration when unmounted", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout();
    const queueScroll = railScrollOwner(wrapper, "queue");
    queueScroll.scrollTop = 121;

    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    queueScroll.scrollTop = 0;
    await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
    await settleWatchers();
    wrapper.unmount();

    await expect(frames.flushAll()).resolves.toBeUndefined();
    expect(queueScroll.scrollTop).toBe(0);
  });

  it("restores business focus after real collapse and expand button focus", async () => {
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout();
    const businessControl = wrapper.get("#queue-item").element as HTMLElement;
    const collapse = wrapper.get('[aria-label="折叠任务队列"]')
      .element as HTMLButtonElement;

    businessControl.focus();
    collapse.focus();
    collapse.click();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const expand = wrapper.get('[aria-label="展开任务队列"]')
      .element as HTMLButtonElement;
    expect(document.activeElement).toBe(expand);

    expand.click();
    await settleWatchers();
    await frames.flushAll();
    expect(document.activeElement).toBe(businessControl);
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

function nextLayoutFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function railScrollOwner(
  wrapper: ReturnType<typeof mount>,
  pane: "queue" | "context",
): HTMLElement {
  return wrapper.get(
    `[data-workbench-pane="${pane}"] .workbench-pane__scroll--independent`,
  ).element as HTMLElement;
}

async function settleWatchers(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function installAnimationFrameQueue(): {
  pending: () => number;
  flushAll: () => Promise<void>;
} {
  const callbacks: FrameRequestCallback[] = [];
  let executed = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });

  return {
    pending: () => callbacks.length,
    async flushAll() {
      while (callbacks.length > 0) {
        const callback = callbacks.shift();
        callback?.(executed++);
        await Promise.resolve();
      }
      await Promise.resolve();
    },
  };
}
