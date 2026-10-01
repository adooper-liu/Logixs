import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn(async () => undefined);
const auth = {
  completeSignIn: vi.fn<() => Promise<string>>(),
  completeSignOut: vi.fn<() => Promise<void>>(),
  signIn: vi.fn(async () => undefined),
};

vi.mock("vue-router", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./useAuthSession", () => ({ useAuthSession: () => auth }));

const { default: OidcCallbackView } = await import("./OidcCallbackView.vue");

beforeEach(() => {
  replace.mockClear();
  auth.completeSignIn.mockReset();
  auth.completeSignOut.mockReset();
  auth.signIn.mockClear();
});

describe("OidcCallbackView", () => {
  it("登录回调只处理一次并回到站内原路径", async () => {
    auth.completeSignIn.mockResolvedValue("/market-signals?view=open");

    mount(OidcCallbackView, { props: { kind: "signin" } });
    await flushPromises();

    expect(auth.completeSignIn).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/market-signals?view=open");
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("登录回调失败停在可重试状态，不自动重定向", async () => {
    auth.completeSignIn.mockRejectedValue(new Error("state mismatch"));

    const wrapper = mount(OidcCallbackView, { props: { kind: "signin" } });
    await flushPromises();

    expect(wrapper.text()).toContain("登录未完成");
    expect(replace).not.toHaveBeenCalled();
    expect(auth.signIn).not.toHaveBeenCalled();
    await wrapper.get("button").trigger("click");
    expect(auth.signIn).toHaveBeenCalledWith("/");
  });

  it("注销回调完成后展示已退出，不自动重新登录", async () => {
    auth.completeSignOut.mockResolvedValue(undefined);

    const wrapper = mount(OidcCallbackView, { props: { kind: "signout" } });
    await flushPromises();

    expect(wrapper.text()).toContain("已退出登录");
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
