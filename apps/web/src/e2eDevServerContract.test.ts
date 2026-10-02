import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_URL,
  DEV_SERVER_PORT,
  E2E_SERVER_META,
  OIDC_APP_URL,
  OIDC_DEV_SERVER_PORT,
  devServerProbeUrls,
  probeLogixDevServer,
  selectsOnlyProject,
} from "./e2eDevServer";

const FINGERPRINT = "abc123";

function page(head: string) {
  return {
    ok: true,
    text: async () => `<html data-ui-theme="logix"><head>${head}</head></html>`,
  };
}

describe("e2e dev server loopback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("探测 IPv4 与 localhost，baseURL 落在探测列表里", () => {
    expect(DEV_SERVER_PORT).toBe(5173);
    expect(devServerProbeUrls(DEV_SERVER_PORT)).toEqual([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ]);
    expect(devServerProbeUrls(DEV_SERVER_PORT)).toContain(APP_URL);
    expect(devServerProbeUrls(OIDC_DEV_SERVER_PORT)).toContain(OIDC_APP_URL);
    expect(OIDC_DEV_SERVER_PORT).not.toBe(DEV_SERVER_PORT);
  });

  it("CI 上默认探测直接视为未在跑", async () => {
    vi.stubEnv("CI", "true");
    await expect(
      probeLogixDevServer(DEV_SERVER_PORT, FINGERPRINT),
    ).resolves.toBe("absent");
  });

  it("任一回环上指纹一致的 Logix 壳才可复用", async () => {
    vi.stubEnv("CI", "true");
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(
        page(`<meta name="${E2E_SERVER_META}" content="${FINGERPRINT}">`),
      );
    await expect(
      probeLogixDevServer(DEV_SERVER_PORT, FINGERPRINT, fetchImpl),
    ).resolves.toBe("matching");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("没有指纹或指纹不符的 Logix 壳视为外来服务器", async () => {
    vi.stubEnv("CI", "true");
    const manual = vi.fn().mockResolvedValue(page(""));
    await expect(
      probeLogixDevServer(DEV_SERVER_PORT, FINGERPRINT, manual),
    ).resolves.toBe("foreign");

    const otherConfig = vi
      .fn()
      .mockResolvedValue(
        page(`<meta name="${E2E_SERVER_META}" content="other">`),
      );
    await expect(
      probeLogixDevServer(DEV_SERVER_PORT, FINGERPRINT, otherConfig),
    ).resolves.toBe("foreign");
  });

  it("只有明确只选单个项目时才视为只跑该项目", () => {
    const only = (argv: string[]) => selectsOnlyProject(argv, "oidc-chromium");
    expect(only(["node", "pw", "test", "--project=oidc-chromium"])).toBe(true);
    expect(only(["node", "pw", "test", "--project", "oidc-chromium"])).toBe(
      true,
    );
    expect(only(["node", "pw", "test"])).toBe(false);
    expect(
      only(["test", "--project", "oidc-chromium", "desktop-chromium"]),
    ).toBe(false);
    expect(only(["test", "--project=*chromium"])).toBe(false);
    expect(
      only(["test", "--project=oidc-chromium", "--project=desktop-chromium"]),
    ).toBe(false);
  });

  it("非 Logix 页面或无人监听视为未在跑", async () => {
    vi.stubEnv("CI", "true");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => "<html></html>" })
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      probeLogixDevServer(DEV_SERVER_PORT, FINGERPRINT, fetchImpl),
    ).resolves.toBe("absent");
  });
});
