import { mount } from "@vue/test-utils";
import { shallowRef } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uiThemeKey } from "../../ui-theme/contracts";
import { logixTheme } from "../../themes/logix";
import UniversalWorkbenchReferenceView from "./UniversalWorkbenchReferenceView.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/", component: UniversalWorkbenchReferenceView },
    { path: "/linked", component: { template: "<div>linked</div>" } },
  ],
});

beforeEach(async () => {
  await router.push("/");
  await router.isReady();
});

describe("UniversalWorkbenchReferenceView", () => {
  it("sets the synthetic scenario controls to the viewport contract explicitly", () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      props: { scenarioControlsOpen: true },
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    expect(wrapper.get(".reference-scenarios").attributes("open")).toBe("");
  });

  it("renders every required visual-contract scenario with production primitives", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    expect(wrapper.text()).toContain("合成结构演练数据，不是生产记录");
    for (const key of [
      "working",
      "waiting",
      "failed",
      "conflict",
      "readonly",
    ]) {
      await wrapper.get(`[data-scenario="${key}"]`).trigger("click");
      expect(
        wrapper.find('[aria-label="岗位、对象与责任上下文"]').exists(),
      ).toBe(true);
      expect(wrapper.find('[aria-label="当前结论与办理缺口"]').exists()).toBe(
        true,
      );
      expect(wrapper.findAll("[data-workbench-pane]")).toHaveLength(3);
    }
  });

  it("folds either or both rails through production controls", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    await wrapper.get('[aria-label="折叠对象与任务队列"]').trigger("click");
    await wrapper.get('[aria-label="折叠当前事项操作上下文"]').trigger("click");
    expect(wrapper.find('[aria-label="展开对象与任务队列"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[aria-label="展开当前事项操作上下文"]').exists()).toBe(
      true,
    );
  });

  it("opens and closes right-side editing without losing the selected item", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    await wrapper.get('[data-item="pricing"]').trigger("click");
    expect(wrapper.text()).toContain("正在编辑：价格带证据");
    await wrapper.get('[aria-label="返回事项上下文"]').trigger("click");
    expect(wrapper.get('[data-item="pricing"]').classes()).toContain(
      "is-selected",
    );
  });

  it("keeps exactly one current session after switching", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    await wrapper
      .get('[aria-label="切换工作现场（结构参考）"]')
      .trigger("click");
    await wrapper.get('[data-session="sourcing"]').trigger("click");
    await wrapper
      .get('[aria-label="切换工作现场（结构参考）"]')
      .trigger("click");
    expect(wrapper.findAll('[aria-current="true"]')).toHaveLength(1);
    expect(wrapper.get('[aria-current="true"]').text()).toContain("寻源");
  });

  it("does not move the current session when dirty-session save fails", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    await wrapper.get('[data-scenario="dirty-session"]').trigger("click");
    await wrapper
      .get('[aria-label="切换工作现场（结构参考）"]')
      .trigger("click");
    await wrapper.get('[data-session="sourcing"]').trigger("click");
    expect(wrapper.text()).toContain("草稿保存失败，仍停留在当前工作现场");
    expect(wrapper.get('[aria-current="true"]').text()).toContain("选品");
  });

  it("opens more-functions without changing the right-pane mode", async () => {
    const wrapper = mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });

    const before = wrapper.get('[aria-label="当前事项操作上下文"]').text();
    await wrapper
      .get('[aria-label="更多关联功能（结构参考）"]')
      .trigger("click");
    expect(wrapper.get('[aria-label="当前事项操作上下文"]').text()).toBe(
      before,
    );
    expect(wrapper.text()).toContain("关联子功能结构参考");
  });

  it("does not call fetch or production APIs", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mount(UniversalWorkbenchReferenceView, {
      global: {
        plugins: [router],
        provide: { [uiThemeKey as symbol]: shallowRef(logixTheme) },
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
