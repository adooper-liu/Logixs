import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import InfoTooltip from "./InfoTooltip.vue";

const tooltip = () => document.body.querySelector('[role="tooltip"]');

describe("InfoTooltip", () => {
  it("keeps explanatory text hidden until the user requests it", async () => {
    const wrapper = mount(InfoTooltip, {
      attachTo: document.body,
      props: { text: "按风险优先，再按截止时间升序。" },
    });
    const trigger = wrapper.get("button");

    expect(tooltip()).toBeNull();
    expect(trigger.attributes("aria-expanded")).toBe("false");

    await wrapper.trigger("mouseenter");
    await nextTick();
    expect(tooltip()?.textContent).toBe("按风险优先，再按截止时间升序。");

    await wrapper.trigger("mouseleave");
    expect(tooltip()).toBeNull();
  });

  it("supports focus, click, outside click, and Escape", async () => {
    const wrapper = mount(InfoTooltip, {
      attachTo: document.body,
      props: { text: "仅改变演示视图，不代表生产权限。" },
    });
    const trigger = wrapper.get("button");

    await trigger.trigger("focus");
    expect(tooltip()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(tooltip()).toBeNull();

    await trigger.trigger("blur");
    await trigger.trigger("click");
    await nextTick();
    expect(tooltip()).not.toBeNull();

    document.dispatchEvent(new PointerEvent("pointerdown"));
    await nextTick();
    expect(tooltip()).toBeNull();
  });
});
