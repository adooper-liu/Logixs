import { describe, expect, it, vi } from "vitest";
import {
  APP_URL,
  DEV_SERVER_PORT,
  DEV_SERVER_PROBE_URLS,
  isLogixDevServerRunning,
} from "./e2eDevServer";

describe("e2e dev server loopback", () => {
  it("探测 IPv4 与 localhost，baseURL 落在探测列表里", () => {
    expect(DEV_SERVER_PORT).toBe(5173);
    expect(DEV_SERVER_PROBE_URLS).toEqual([
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ]);
    expect(DEV_SERVER_PROBE_URLS).toContain(APP_URL);
  });

  it("CI 上默认探测直接视为未在跑", async () => {
    vi.stubEnv("CI", "true");
    await expect(isLogixDevServerRunning()).resolves.toBe(false);
    vi.unstubAllEnvs();
  });

  it("任一回环已有 Logix 壳即视为开发服务器在跑", async () => {
    vi.stubEnv("CI", "true");
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<html data-ui-theme="logix"></html>',
      });
    await expect(isLogixDevServerRunning(fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.unstubAllEnvs();
  });
});
