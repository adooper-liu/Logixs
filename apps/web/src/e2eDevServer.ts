export const DEV_SERVER_PORT = 5173;
export const OIDC_DEV_SERVER_PORT = 5174;

export const APP_URL = `http://localhost:${DEV_SERVER_PORT}`;
export const OIDC_APP_URL = `http://localhost:${OIDC_DEV_SERVER_PORT}`;

/** 只由 Playwright 启动的 Vite 注入；带上认证配置指纹，用来识别“本测试配置”的服务器。 */
export const E2E_SERVER_META = "logix-e2e-server";

export type DevServerProbe = "absent" | "matching" | "foreign";

export function devServerProbeUrls(port: number): readonly string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

/**
 * 命令行是否只选了指定项目。通配、多选、位置参数或无法识别都返回 false，调用方据此全量启动，
 * 确保任何会跑到的项目都经过指纹检查。
 */
export function selectsOnlyProject(
  argv: readonly string[],
  project: string,
): boolean {
  const selected: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith("--project=")) {
      selected.push(arg.slice("--project=".length));
    } else if (arg === "--project") {
      while (argv[index + 1] && !argv[index + 1]!.startsWith("-")) {
        index += 1;
        selected.push(argv[index]!);
      }
    }
  }
  return selected.length > 0 && selected.every((name) => name === project);
}

/**
 * 判断端口上是否已有本测试配置的 Logix 开发服务器。已有 Logix 壳但指纹不符（例如手动
 * `pnpm dev`、别的认证模式）返回 `foreign`，调用方必须失败关闭，不得静默复用。
 */
export async function probeLogixDevServer(
  port: number,
  fingerprint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DevServerProbe> {
  // CI 自起 Vite，不复用本机监听；端口被占由 strictPort 失败关闭。注入 fetch 的契约测试仍走探测逻辑。
  if (process.env.CI && fetchImpl === fetch) return "absent";

  for (const url of devServerProbeUrls(port)) {
    let body: string;
    try {
      const response = await fetchImpl(url);
      if (!response.ok) continue;
      body = await response.text();
    } catch {
      // 下一地址：Windows 上 localhost 常为 ::1，127.0.0.1 可能没有监听。
      continue;
    }
    if (!body.includes('data-ui-theme="logix"')) continue;
    return body.includes(
      `<meta name="${E2E_SERVER_META}" content="${fingerprint}"`,
    )
      ? "matching"
      : "foreign";
  }
  return "absent";
}
