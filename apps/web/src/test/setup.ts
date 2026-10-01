import { afterEach, vi } from "vitest";
import { config, enableAutoUnmount } from "@vue/test-utils";

// 仅 Vitest 生效的已认证 development 会话；生产代码没有内置身份，各测试可再以模块替身覆盖。
vi.mock("../auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth/session")>();
  const session = actual.createAuthSession({
    config: {
      mode: "development",
      tenantId: "demo-real-sample-20260921",
      operatorId: "dev-operator",
      roles: ["operations_dispatcher"],
    },
    adapter: null,
    storage: window.sessionStorage,
    origin: window.location.origin,
  });
  void session.initialize();
  return { ...actual, getAuthSession: () => session };
});

config.global.stubs = {
  transition: false,
};

enableAutoUnmount(afterEach);

afterEach(() => {
  document.body.innerHTML = "";
});
