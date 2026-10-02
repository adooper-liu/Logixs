import { describe, expect, it } from "vitest";
import { safeReturnUrl } from "./returnUrl";

const ORIGIN = "https://app.logix.example";

describe("safeReturnUrl", () => {
  it("保留站内路径、查询和片段", () => {
    expect(safeReturnUrl("/market-signals?view=open#s-1", ORIGIN)).toBe(
      "/market-signals?view=open#s-1",
    );
  });

  it.each([
    "https://evil.example/tasks",
    "//evil.example/tasks",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "tasks",
    "/tasks\n//evil.example",
    "",
  ])("站外或畸形地址 %j 回落首页", (raw) => {
    expect(safeReturnUrl(raw, ORIGIN)).toBe("/");
  });

  it.each([
    "/auth/callback?code=x&state=y",
    "/auth/logout-callback",
    "/auth/silent-callback",
  ])("认证协议路径 %s 不作为回跳目标，避免递归", (raw) => {
    expect(safeReturnUrl(raw, ORIGIN)).toBe("/");
  });

  it("非字符串状态回落首页", () => {
    expect(safeReturnUrl(undefined, ORIGIN)).toBe("/");
    expect(safeReturnUrl({ returnUrl: "/tasks" }, ORIGIN)).toBe("/");
  });
});
