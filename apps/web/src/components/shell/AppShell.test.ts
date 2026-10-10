import { flushPromises, mount } from "@vue/test-utils";
import { computed, shallowRef } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionProfile, SessionStatus } from "../../auth/session";
import AppShell from "../../themes/logix/LogixAppShell.vue";
import { resetDemoRole } from "../../composables/useDemoRole";

const auth = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock("../../auth/useAuthSession", () => ({
  useAuthSession: () => auth.current,
}));

function fakeAuth(input: {
  mode: "development" | "oidc";
  profile: SessionProfile | null;
  status?: SessionStatus;
  signOut?: () => Promise<void>;
}) {
  const status = shallowRef<SessionStatus>(input.status ?? "authenticated");
  const profile = shallowRef(input.profile);
  const signOut = vi.fn(input.signOut ?? (() => new Promise<void>(() => {})));
  auth.current = {
    mode: input.mode,
    status: computed(() => status.value),
    profile: computed(() => profile.value),
    signOut,
  };
  return { status, signOut };
}

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
    fakeAuth({
      mode: "development",
      profile: { subject: "dev-operator", displayName: null },
    });
  });

  const mountShell = async () => {
    const router = createTestRouter();
    await router.push("/tasks");
    await router.isReady();
    return mount(AppShell, { global: { plugins: [router] } });
  };

  it("development 身份标示本机开发身份且不提供 IdP 注销", async () => {
    const wrapper = await mountShell();

    const identity = wrapper.get('[data-testid="login-identity"]');
    expect(identity.text()).toContain("dev-operator");
    expect(identity.text()).toContain("本机开发身份");
    expect(wrapper.get('[data-testid="demo-role"]').text()).toContain(
      "当前演示角色",
    );
    expect(wrapper.find('[aria-label="退出登录"]').exists()).toBe(false);
  });

  it("OIDC 身份优先显示名，否则显示稳定 subject", async () => {
    fakeAuth({
      mode: "oidc",
      profile: { subject: "user-1", displayName: "张三" },
    });
    const named = await mountShell();
    expect(named.get('[data-testid="login-identity"]').text()).toBe("张三");
    named.unmount();

    fakeAuth({
      mode: "oidc",
      profile: { subject: "user-1", displayName: null },
    });
    const anonymousName = await mountShell();
    expect(anonymousName.get('[data-testid="login-identity"]').text()).toBe(
      "user-1",
    );
  });

  it("OIDC 注销只调用一次 signOut，提交中禁用重复点击", async () => {
    const { signOut } = fakeAuth({
      mode: "oidc",
      profile: { subject: "user-1", displayName: "张三" },
    });
    const wrapper = await mountShell();

    const button = wrapper.get('[aria-label="退出登录"]');
    await button.trigger("click");
    await button.trigger("click");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("注销失败时恢复按钮并提示可重试", async () => {
    const { signOut } = fakeAuth({
      mode: "oidc",
      profile: { subject: "user-1", displayName: "张三" },
      signOut: async () => {
        throw new Error("offline");
      },
    });
    const wrapper = await mountShell();

    await wrapper.get('[aria-label="退出登录"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("退出登录失败，请重试");
    expect(
      wrapper.get('[aria-label="退出登录"]').attributes("disabled"),
    ).toBeUndefined();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("会话被拒绝或已注销时显示对应状态而非旧身份", async () => {
    const { status } = fakeAuth({
      mode: "oidc",
      profile: null,
      status: "error",
    });
    const wrapper = await mountShell();
    expect(wrapper.get('[data-testid="login-identity"]').text()).toBe(
      "会话无效，请重新登录",
    );
    expect(wrapper.find('[aria-label="退出登录"]').exists()).toBe(false);

    status.value = "signed_out";
    await flushPromises();
    expect(wrapper.get('[data-testid="login-identity"]').text()).toBe(
      "已退出登录",
    );
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
    expect(wrapper.get('a[href="/tasks"]').attributes("aria-label")).toBe(
      "我的任务",
    );

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

  it("does not render an obsolete static workspace scope", async () => {
    const wrapper = await mountShell();

    expect(wrapper.find(".workspace-switcher").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("工作区");
    expect(wrapper.find('[aria-label="查看工作区范围"]').exists()).toBe(false);

    await wrapper.get('[aria-label="打开主导航"]').trigger("click");
    expect(wrapper.get('[data-testid="app-sidebar"]').classes()).toContain(
      "sidebar--open",
    );
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
