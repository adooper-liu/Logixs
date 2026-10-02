import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 子进程里走 Vite 自己的配置加载链路，证明的是真实 `vite build` / `vite serve` 行为，而非测试环境里的模拟。
const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VITE_BIN = join(WEB_ROOT, "node_modules", "vite", "bin", "vite.js");

const DEVELOPMENT_IDENTITY = {
  VITE_AUTH_MODE: "development",
  VITE_DEV_TENANT_ID: "tenant-boundary-probe",
  VITE_DEV_OPERATOR_ID: "operator-boundary-probe",
  VITE_DEV_ROLES: "role-boundary-probe",
};
const IDENTITY_VALUES = Object.values(DEVELOPMENT_IDENTITY).slice(1);

function childEnv(values: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("VITE_") && !key.startsWith("VITEST")) env[key] = value;
  }
  return { ...env, ...values };
}

function run(args: string[], values: Record<string, string>) {
  const result = spawnSync(process.execPath, args, {
    cwd: WEB_ROOT,
    env: childEnv(values),
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** 只解析配置（不构建）：Vite 用与 CLI 相同的 command 调用 vite.config.ts。 */
function resolveConfig(
  command: "build" | "serve",
  values: Record<string, string>,
) {
  const script = `import { resolveConfig } from "vite";
await resolveConfig({ root: process.cwd(), logLevel: "silent" }, ${JSON.stringify(command)});`;
  return run(["--input-type=module", "-e", script], values);
}

describe("vite 构建边界", () => {
  it("NODE_ENV=development 的标准 build 带显式 development 身份时在生成产物前失败，且不回显身份值", () => {
    const outDir = join(mkdtempSync(join(tmpdir(), "logix-build-")), "dist");
    try {
      const result = run([VITE_BIN, "build", "--outDir", outDir], {
        NODE_ENV: "development",
        ...DEVELOPMENT_IDENTITY,
      });

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("BUILD_DEVELOPMENT_AUTH_REJECTED");
      expect(
        IDENTITY_VALUES.some((value) => result.output.includes(value)),
      ).toBe(false);
      expect(existsSync(outDir)).toBe(false);
    } finally {
      rmSync(dirname(outDir), { recursive: true, force: true });
    }
  });

  it("本机 serve 仍可使用显式 development 身份", () => {
    const result = resolveConfig("serve", {
      NODE_ENV: "development",
      ...DEVELOPMENT_IDENTITY,
    });
    expect(result.status).toBe(0);
  });

  it("oidc build 配置不受影响，secret 仍被拒绝", () => {
    expect(resolveConfig("build", { VITE_AUTH_MODE: "oidc" }).status).toBe(0);

    const leaked = resolveConfig("build", {
      VITE_AUTH_MODE: "oidc",
      VITE_OIDC_CLIENT_SECRET: "x",
    });
    expect(leaked.status).not.toBe(0);
    expect(leaked.output).toContain("BROWSER_SECRET_REJECTED");
  });
});
