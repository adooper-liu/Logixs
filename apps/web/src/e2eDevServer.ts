export const DEV_SERVER_PORT = 5173;

export const DEV_SERVER_PROBE_URLS = [
  `http://127.0.0.1:${DEV_SERVER_PORT}`,
  `http://localhost:${DEV_SERVER_PORT}`,
] as const;

export const APP_URL = DEV_SERVER_PROBE_URLS[1];

export async function isLogixDevServerRunning(
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (process.env.CI) return false;

  for (const url of DEV_SERVER_PROBE_URLS) {
    try {
      const response = await fetchImpl(url);
      if (!response.ok) continue;
      if ((await response.text()).includes('data-ui-theme="logix"')) {
        return true;
      }
    } catch {
      // 下一地址：Windows 上 localhost 常为 ::1，127.0.0.1 可能没有监听。
    }
  }
  return false;
}
