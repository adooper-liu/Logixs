import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkbenchLayout from "./WorkbenchLayout.vue";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function installViewport({
  mobile = false,
  narrow = false,
}: { mobile?: boolean; narrow?: boolean } = {}) {
  const entries = new Map<
    "mobile" | "narrow",
    {
      matches: boolean;
      listeners: Set<(event: MediaQueryListEvent) => void>;
      query: string;
    }
  >();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const key = query.includes("680") ? "mobile" : "narrow";
    const entry = entries.get(key) ?? {
      matches: key === "mobile" ? mobile : narrow,
      listeners: new Set(),
      query,
    };
    entries.set(key, entry);
    return {
      media: entry.query,
      get matches() {
        return entry.matches;
      },
      onchange: null,
      addEventListener: (_event: string, listener: EventListener) =>
        entry.listeners.add(listener as (event: MediaQueryListEvent) => void),
      removeEventListener: (_event: string, listener: EventListener) =>
        entry.listeners.delete(
          listener as (event: MediaQueryListEvent) => void,
        ),
      addListener: (listener: (event: MediaQueryListEvent) => void) =>
        entry.listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        entry.listeners.delete(listener),
      dispatchEvent: () => true,
    } as MediaQueryList;
  });
  return {
    listeners: () =>
      [...entries.values()].reduce(
        (count, entry) => count + entry.listeners.size,
        0,
      ),
    setWidth(width: number) {
      const changed: typeof entries extends Map<unknown, infer V>
        ? V[]
        : never = [];
      for (const [type, entry] of entries) {
        const matches = width <= (type === "mobile" ? 680 : 1100);
        if (entry.matches !== matches) {
          entry.matches = matches;
          changed.push(entry);
        }
      }
      for (const entry of changed)
        for (const listener of entry.listeners)
          listener({
            matches: entry.matches,
            media: entry.query,
          } as MediaQueryListEvent);
    },
    set(type: "mobile" | "narrow", matches: boolean) {
      const entry = entries.get(type);
      if (!entry) throw new Error(`media query ${type} was not initialized`);
      entry.matches = matches;
      for (const listener of entry.listeners)
        listener({ matches, media: entry.query } as MediaQueryListEvent);
    },
  };
}

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
  it("recovers invalid breakpoint focus before another interaction (REVIEW-001)", async () => {
    const viewport = installViewport();
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    const wrapper = mountLayout({ mobileScreen: "detail" });
    await wrapper.vm.$nextTick();
    const context = wrapper.get("#context-action").element as HTMLElement;
    context.focus();
    viewport.set("mobile", true);
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.get("#detail-item").element);
    expect(wrapper.emitted("restoreFocus")?.at(-1)).toEqual(["detail"]);
  });

  it("does not steal surviving detail focus for derived collapse (REVIEW-002)", async () => {
    const viewport = installViewport({ mobile: true });
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout({
      mobileScreen: "detail",
      leftCollapsed: true,
      rightCollapsed: true,
    });
    await wrapper.vm.$nextTick();
    const detail = wrapper.get("#detail-secondary").element as HTMLElement;
    detail.focus();
    viewport.set("mobile", false);
    await wrapper.vm.$nextTick();
    await frames.flushAll();
    expect(document.activeElement).toBe(detail);
    expect(wrapper.props("leftCollapsed")).toBe(true);
    expect(wrapper.props("rightCollapsed")).toBe(true);
  });

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
    const wrapper = mountLayout({ responsiveMode: "standard" });
    const input = wrapper.get("#draft");
    const inputElement = input.element;
    await input.setValue("未提交草稿");

    await wrapper.setProps({ mobileScreen: "queue" });
    await wrapper.setProps({ mobileScreen: "detail" });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ mobileScreen: "context" });
    await wrapper.setProps({ mobileScreen: "queue" });
    await wrapper.setProps({ mobileScreen: "detail" });

    expect(wrapper.get("#draft").element).toBe(inputElement);
    expect((wrapper.get("#draft").element as HTMLInputElement).value).toBe(
      "未提交草稿",
    );
  });

  it("scrolls and focuses the selected mobile screen action", async () => {
    installViewport({ mobile: true });
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
    installViewport({ mobile: true });
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
    installViewport({ narrow: true });
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
    installViewport({ mobile: true });
    const wrapper = mountLayout();

    await wrapper.setProps({ mobileScreen: "context" });
    await wrapper.get('[data-mobile-target="detail"]').trigger("click");

    expect(wrapper.emitted("restoreFocus")?.at(-1)).toEqual(["detail"]);
  });

  it("isolates inactive standard mobile panes and focuses a stable pane fallback", async () => {
    installViewport({ mobile: true });
    const wrapper = mountLayout();
    const detail = wrapper.get('[data-workbench-pane="detail"]');
    const detailFocus = vi.spyOn(detail.element as HTMLElement, "focus");

    await wrapper.vm.$nextTick();
    await wrapper.setProps({ mobileScreen: "detail" });
    detail.element
      .querySelectorAll("button, input, textarea, select, a")
      .forEach((control) => control.remove());
    await wrapper.setProps({ mobileScreen: "queue" });
    await wrapper.setProps({ mobileScreen: "detail" });

    expect(
      wrapper.get('[data-workbench-pane="queue"]').attributes("inert"),
    ).toBe("");
    expect(detail.attributes("inert")).toBeUndefined();
    expect(detail.attributes("tabindex")).toBe("-1");
    expect(detailFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("derives expanded standard mobile rails without changing the desktop preference", async () => {
    const viewport = installViewport({ mobile: true });
    const wrapper = mountLayout({ leftCollapsed: true, rightCollapsed: true });
    await wrapper.vm.$nextTick();

    expect(
      wrapper
        .get('[data-workbench-pane="queue"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBeUndefined();
    expect(
      wrapper
        .get('[data-workbench-pane="context"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBeUndefined();
    expect(wrapper.props("leftCollapsed")).toBe(true);
    expect(wrapper.props("rightCollapsed")).toBe(true);

    viewport.set("mobile", false);
    await wrapper.vm.$nextTick();
    expect(
      wrapper
        .get('[data-workbench-pane="queue"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBe("");
    expect(
      wrapper
        .get('[data-workbench-pane="context"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBe("");
  });

  it("clears a narrow drawer on mobile and keeps stacked panes operable", async () => {
    const viewport = installViewport({ narrow: true });
    const wrapper = mountLayout();
    const trigger = wrapper.get('[aria-label="打开任务队列"]');

    await trigger.trigger("click");
    expect(
      wrapper.get('[data-workbench-pane="queue"]').attributes("role"),
    ).toBe("dialog");
    viewport.set("mobile", true);
    await wrapper.setProps({ mobileScreen: "context" });
    await wrapper.vm.$nextTick();

    expect(
      wrapper.find('[data-workbench-pane="queue"][role="dialog"]').exists(),
    ).toBe(false);
    expect(wrapper.find(".workbench-layout__narrow-backdrop").exists()).toBe(
      false,
    );
    expect(
      wrapper.get('[data-workbench-pane="detail"]').attributes("inert"),
    ).toBe("");
    expect(
      wrapper.get('[data-workbench-pane="context"]').attributes("inert"),
    ).toBeUndefined();

    await wrapper.setProps({ responsiveMode: "stacked" });
    expect(wrapper.findAll("[data-workbench-pane][inert]").length).toBe(0);
  });

  it("invalidates actual mobile control, fallback, scroll and event recovery on resize", async () => {
    const viewport = installViewport({ mobile: true });
    const wrapper = mountLayout();
    const control = vi.spyOn(
      wrapper.get("#detail-item").element as HTMLElement,
      "focus",
    );
    const fallback = vi.spyOn(
      wrapper.get('[data-workbench-pane="detail"]').element as HTMLElement,
      "focus",
    );
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const pageScroll = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => {});
    const change = wrapper.setProps({ mobileScreen: "detail" });
    await nextTick();
    viewport.set("mobile", false);
    await change;
    await nextTick();
    expect(control).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
    expect(wrapper.emitted("restoreFocus")).toBeUndefined();
  });

  it("opens a collapsed narrow drawer without accepting parent collapse requests", async () => {
    const viewport = installViewport({ narrow: true });
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout({ leftCollapsed: true }, document.body, false);
    const queueItem = wrapper.get("#queue-item").element;
    await nextTick();
    await wrapper.get('[aria-label="打开任务队列"]').trigger("click");
    expect(
      wrapper
        .get('[data-workbench-pane="queue"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBeUndefined();
    expect(document.activeElement).toBe(queueItem);
    expect(wrapper.props("leftCollapsed")).toBe(true);
    expect(wrapper.emitted("update:leftCollapsed")).toBeUndefined();
    viewport.setWidth(1101);
    await nextTick();
    await frames.flushAll();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find(".workbench-layout__narrow-backdrop").exists()).toBe(
      false,
    );
    expect(
      wrapper
        .get('[data-workbench-pane="queue"] .collapsible-rail__body')
        .attributes("hidden"),
    ).toBe("");
    expect(wrapper.findAll("[data-workbench-pane][inert]")).toHaveLength(0);
    expect(wrapper.get("#queue-item").element).toBe(queueItem);
  });

  it("clears an open drawer on standard to stacked without stealing legal queue focus", async () => {
    installViewport({ narrow: true });
    const wrapper = mountLayout();
    await wrapper.get('[aria-label="打开任务队列"]').trigger("click");
    const control = wrapper.get("#queue-item").element;
    expect(document.activeElement).toBe(control);
    await wrapper.setProps({ responsiveMode: "stacked" });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.find(".workbench-layout__narrow-backdrop").exists()).toBe(
      false,
    );
    expect(wrapper.findAll("[data-workbench-pane][inert]")).toHaveLength(0);
    expect(document.activeElement).toBe(control);
    await wrapper.setProps({ responsiveMode: "standard" });
    expect(
      wrapper.get('[aria-label="打开任务队列"]').attributes("aria-expanded"),
    ).toBe("false");
  });

  it("uses the exact 680/681 and 1100/1101 boundaries and cleans media listeners", async () => {
    const viewport = installViewport();
    const wrapper = mountLayout({
      mobileScreen: "detail",
      leftCollapsed: true,
      rightCollapsed: true,
    });
    await nextTick();
    expect(viewport.listeners()).toBe(2);
    for (const width of [1101, 1100, 681, 680, 681, 1100, 1101]) {
      viewport.setWidth(width);
      await nextTick();
      expect(
        wrapper.get('[data-workbench-pane="queue"]').attributes("inert"),
      ).toBe(width <= 680 ? "" : undefined);
      expect(
        wrapper
          .get('[data-workbench-pane="context"] .collapsible-rail__body')
          .attributes("hidden"),
      ).toBe(width <= 680 ? undefined : "");
      if (width > 680 && width <= 1100) {
        await wrapper.get(".workbench-layout__narrow-queue").trigger("click");
        expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
        await wrapper
          .get('[role="dialog"]')
          .trigger("keydown", { key: "Escape" });
      } else {
        expect(
          wrapper
            .get(".workbench-layout__narrow-queue")
            .attributes("aria-expanded"),
        ).toBe("false");
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      }
    }
    wrapper.unmount();
    expect(viewport.listeners()).toBe(0);
    viewport.setWidth(680);
    await nextTick();
    expect(wrapper.emitted("restoreFocus")).toBeUndefined();
  });

  it("preserves newer legal user focus while an invalid breakpoint target settles", async () => {
    const viewport = installViewport();
    const wrapper = mountLayout({ mobileScreen: "detail" });
    await nextTick();
    (wrapper.get("#context-action").element as HTMLElement).focus();
    viewport.setWidth(680);
    const detail = wrapper.get("#detail-secondary").element as HTMLElement;
    detail.focus();
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(detail);
    expect(wrapper.emitted("restoreFocus")).toBeUndefined();
  });

  it("removes legacy media listeners with the same callback on unmount", async () => {
    const queries = [680, 1100].map((width) => ({
      matches: false,
      media: `(max-width: ${width}px)`,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        queries[query.includes("680") ? 0 : 1] as unknown as MediaQueryList,
    );
    const wrapper = mountLayout();
    await nextTick();
    wrapper.unmount();
    for (const query of queries) {
      expect(query.addListener).toHaveBeenCalledTimes(1);
      expect(query.removeListener).toHaveBeenCalledWith(
        query.addListener.mock.calls[0]![0],
      );
    }
  });

  it.each(["disabled", "hidden", "inert", "removed", "outside"] as const)(
    "ignores a remembered %s control and uses the actual pane fallback",
    async (unavailable) => {
      installViewport({ mobile: true });
      const wrapper = mountLayout({ mobileScreen: "detail" });
      await nextTick();
      const draft = wrapper.get("#draft").element as HTMLInputElement;
      draft.focus();
      await wrapper.setProps({ mobileScreen: "context" });
      if (unavailable === "disabled") draft.disabled = true;
      if (unavailable === "hidden") draft.hidden = true;
      if (unavailable === "inert") draft.setAttribute("inert", "");
      if (unavailable === "removed") draft.remove();
      if (unavailable === "outside") document.body.appendChild(draft);
      wrapper.get("#detail-item").element.remove();
      wrapper.get("#detail-secondary").element.remove();
      const focus = vi.spyOn(draft, "focus");
      const pane = wrapper.get('[data-workbench-pane="detail"]')
        .element as HTMLElement;
      const fallback = vi.spyOn(pane, "focus");
      await wrapper.setProps({ mobileScreen: "detail" });
      await nextTick();
      expect(focus).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledWith({ preventScroll: true });
      expect(document.activeElement).toBe(pane);
      expect(wrapper.emitted("restoreFocus")?.at(-1)).toEqual(["detail"]);
    },
  );

  it("recovers mode-hidden focus but preserves it when switching back to stacked", async () => {
    installViewport({ mobile: true });
    const wrapper = mountLayout({
      responsiveMode: "stacked",
      mobileScreen: "detail",
    });
    await nextTick();
    (wrapper.get("#context-action").element as HTMLElement).focus();
    await wrapper.setProps({ responsiveMode: "standard" });
    await nextTick();
    expect(document.activeElement).toBe(wrapper.get("#detail-item").element);
    await wrapper.setProps({ responsiveMode: "stacked" });
    expect(document.activeElement).toBe(wrapper.get("#detail-item").element);
    expect(wrapper.findAll("[data-workbench-pane][inert]")).toHaveLength(0);
  });

  it.each(["pane", "resize", "unmount"] as const)(
    "invalidates pending breakpoint focus and scroll on a newer %s",
    async (action) => {
      const viewport = installViewport();
      const wrapper = mountLayout({ mobileScreen: "detail" });
      await nextTick();
      (wrapper.get("#context-action").element as HTMLElement).focus();
      const control = vi.spyOn(
        wrapper.get("#detail-item").element as HTMLElement,
        "focus",
      );
      const fallback = vi.spyOn(
        wrapper.get('[data-workbench-pane="detail"]').element as HTMLElement,
        "focus",
      );
      const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
      const pageScroll = vi
        .spyOn(window, "scrollTo")
        .mockImplementation(() => {});
      viewport.setWidth(680);
      if (action === "pane")
        await wrapper.get('[data-mobile-target="context"]').trigger("click");
      else if (action === "resize") viewport.setWidth(1440);
      else wrapper.unmount();
      await nextTick();
      await nextTick();
      expect(control).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
      if (action !== "pane") {
        expect(scroll).not.toHaveBeenCalled();
        expect(pageScroll).not.toHaveBeenCalled();
      }
      expect(
        wrapper.emitted("restoreFocus")?.some(([pane]) => pane === "detail") ??
          false,
      ).toBe(false);
    },
  );

  it("invalidates queued rail focus, rail scroll and drawer focus on pane/resize/unmount", async () => {
    const viewport = installViewport();
    const frames = installAnimationFrameQueue();
    const wrapper = mountLayout();
    await nextTick();
    const queueScroll = railScrollOwner(wrapper, "queue");
    const queue = wrapper.get("#queue-item").element as HTMLElement;
    queue.focus();
    queueScroll.scrollTop = 123;
    await wrapper.setProps({ leftCollapsed: true });
    queueScroll.scrollTop = 0;
    await wrapper.setProps({ leftCollapsed: false });
    await settleWatchers();
    const focus = vi.spyOn(queue, "focus");
    viewport.setWidth(1024);
    const opening = wrapper
      .get(".workbench-layout__narrow-queue")
      .trigger("click");
    viewport.setWidth(680);
    const navigating = wrapper.setProps({ mobileScreen: "detail" });
    wrapper.unmount();
    await Promise.all([opening, navigating]);
    await frames.flushAll();
    expect(focus).not.toHaveBeenCalled();
    expect(queueScroll.scrollTop).toBe(0);
    expect(wrapper.emitted("restoreFocus")).toBeUndefined();
    expect(viewport.listeners()).toBe(0);
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
