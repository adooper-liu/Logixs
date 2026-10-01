import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AppTopbar from "./AppTopbar.vue";

const RouterLinkStub = { template: "<a><slot /></a>" };

function mountTopbar(overrides: Record<string, unknown> = {}) {
  return mount(AppTopbar, {
    props: {
      collapsed: false,
      title: "我的任务",
      section: "作业",
      roleLabel: "一线作业",
      theme: "light",
      identityLabel: "张三",
      identityMode: "oidc",
      canSignOut: true,
      signOutPending: false,
      signOutFailed: false,
      ...overrides,
    },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}

describe("AppTopbar 身份区", () => {
  it("分开展示登录身份与当前演示角色", () => {
    const wrapper = mountTopbar();

    expect(wrapper.get('[data-testid="login-identity"]').text()).toBe("张三");
    const demoRole = wrapper.get('[data-testid="demo-role"]');
    expect(demoRole.text()).toContain("当前演示角色");
    expect(demoRole.text()).toContain("一线作业");
    expect(demoRole.attributes("title")).toContain("不代表登录权限");
  });

  it("development 身份标示本机开发身份", () => {
    const wrapper = mountTopbar({
      identityLabel: "dev-operator",
      identityMode: "development",
      canSignOut: false,
    });

    const identity = wrapper.get('[data-testid="login-identity"]');
    expect(identity.text()).toContain("dev-operator");
    expect(identity.text()).toContain("本机开发身份");
    expect(wrapper.find('[aria-label="退出登录"]').exists()).toBe(false);
  });

  it("点击退出登录只发出 signOut；提交中禁用，失败时提示", async () => {
    const wrapper = mountTopbar();
    await wrapper.get('[aria-label="退出登录"]').trigger("click");
    expect(wrapper.emitted("signOut")).toHaveLength(1);

    await wrapper.setProps({ signOutPending: true });
    expect(
      wrapper.get('[aria-label="退出登录"]').attributes("disabled"),
    ).toBeDefined();

    await wrapper.setProps({ signOutPending: false, signOutFailed: true });
    expect(wrapper.get('[role="alert"]').text()).toBe("退出登录失败，请重试");
  });
});
