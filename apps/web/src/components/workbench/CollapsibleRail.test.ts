import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import CollapsibleRail from "./CollapsibleRail.vue";

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

describe("CollapsibleRail", () => {
  it("folds and restores focus only after an explicit user action", async () => {
    const wrapper = mount(CollapsibleRail, {
      attachTo: document.body,
      props: {
        side: "left" as const,
        collapsed: false,
        label: "任务队列",
        summary: "当前机会 · 2 待办",
        "onUpdate:collapsed": (value: boolean) =>
          wrapper.setProps({ collapsed: value }),
      },
      slots: { default: '<button id="inside">队列内容</button>' },
    });
    mounted.push(wrapper);

    const inside = wrapper.get("#inside");
    (inside.element as HTMLElement).focus();
    expect(document.activeElement).toBe(inside.element);
    await wrapper.get('[aria-label="折叠任务队列"]').trigger("click");
    expect(wrapper.emitted("update:collapsed")?.[0]).toEqual([true]);
    expect(wrapper.text()).toContain("当前机会 · 2 待办");
    await wrapper.get('[aria-label="展开任务队列"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.get("#inside").element);
  });

  it("labels the right rail and does not emit after an unrelated prop change", async () => {
    const wrapper = mount(CollapsibleRail, {
      props: {
        side: "right" as const,
        collapsed: true,
        label: "操作上下文",
        summary: "2 阻塞 · 1 动作",
      },
    });

    await wrapper.setProps({ summary: "1 阻塞 · 1 动作" });
    expect(wrapper.emitted("update:collapsed")).toBeUndefined();
    expect(wrapper.find('[aria-label="展开操作上下文"]').exists()).toBe(true);
  });

  it("closes drawer mode with Escape", async () => {
    const wrapper = mount(CollapsibleRail, {
      attachTo: document.body,
      props: {
        side: "left" as const,
        collapsed: false,
        label: "任务队列",
        mode: "drawer" as const,
        "onUpdate:collapsed": (value: boolean) =>
          wrapper.setProps({ collapsed: value }),
      },
      slots: { default: "队列内容" },
    });
    mounted.push(wrapper);

    await wrapper.trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("update:collapsed")?.[0]).toEqual([true]);
  });
});
