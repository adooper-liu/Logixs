import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it } from "vitest";
import AppShell from "../../themes/logix/LogixAppShell.vue";
import { resetDemoRole } from "../../composables/useDemoRole";

const EmptyView = { template: "<p>route content</p>" };

const createTestRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/tasks",
        component: EmptyView,
        meta: {
          title: "我的任务",
          navLabel: "我的任务",
          navIcon: "clipboard-check",
          navOrder: 10,
          roles: ["operator"],
          section: "作业",
        },
      },
      {
        path: "/containers",
        component: EmptyView,
        meta: {
          title: "已出运货柜",
          navLabel: "已出运货柜",
          navIcon: "container",
          navOrder: 20,
          roles: ["operator", "planner", "manager"],
          section: "货柜",
        },
      },
      {
        path: "/dashboard",
        component: EmptyView,
        meta: {
          title: "运营态势",
          navLabel: "运营态势",
          navIcon: "chart-no-axes-combined",
          navOrder: 10,
          roles: ["manager"],
          section: "管理",
        },
      },
      {
        path: "/meso",
        component: EmptyView,
        meta: {
          title: "First Mile PDCA 运营",
          section: "计划与管理",
          navLabel: "PDCA 运营",
          navIcon: "calendar-range",
          navOrder: 30,
          roles: ["planner", "manager"],
        },
      },
    ],
  });

describe("AppShell", () => {
  beforeEach(() => {
    resetDemoRole();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("folds and expands the desktop navigation", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    await wrapper.get('[aria-label="收起侧栏"]').trigger("click");
    expect(wrapper.get('[data-testid="app-shell"]').classes()).toContain(
      "shell--collapsed",
    );
    expect(wrapper.get('[aria-label="展开侧栏"]')).toBeTruthy();

    await wrapper.get('[aria-label="展开侧栏"]').trigger("click");
    expect(wrapper.get('[data-testid="app-shell"]').classes()).not.toContain(
      "shell--collapsed",
    );
  });

  it("opens the mobile drawer and closes it with Escape", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    await wrapper.get('[aria-label="打开主导航"]').trigger("click");
    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).toContain(
      "sidebar--open",
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).not.toContain(
      "sidebar--open",
    );
  });

  it("closes the drawer after navigation and trims navigation by demo role", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    expect(wrapper.text()).toContain("我的任务");
    expect(wrapper.text()).not.toContain("运营态势");

    await wrapper.get('[aria-label="打开主导航"]').trigger("click");
    await wrapper.get('a[href="/containers"]').trigger("click");
    await router.isReady();
    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).not.toContain(
      "sidebar--open",
    );

    await wrapper.get('[aria-label="演示角色"]').setValue("manager");
    await flushPromises();
    const navigation = wrapper.get('nav[aria-label="主导航"]');
    expect(navigation.text()).toContain("运营态势");
    expect(navigation.text()).not.toContain("我的任务");
  });

  it("opens quick navigation from the keyboard and closes it with Escape", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [router] },
    });

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="dialog"][aria-label="快速导航"]')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(
      wrapper.find('[role="dialog"][aria-label="快速导航"]').exists(),
    ).toBe(false);
  });

  it("persists an explicit theme choice", async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    await wrapper.get('[aria-label="切换深色主题"]').trigger("click");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("logix-theme")).toBe("dark");
    expect(wrapper.get('[aria-label="切换浅色主题"]')).toBeTruthy();
  });
});
