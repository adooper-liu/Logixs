import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { E2E_SERVER_META, probeLogixDevServer } from "../src/e2eDevServer";
import { serversForArgv, type E2eServerTarget } from "./support/testServers";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

export default async function globalSetup() {
  const started: ViteDevServer[] = [];
  const closeAll = () => Promise.all(started.map((server) => server.close()));
  try {
    for (const target of serversForArgv(process.argv)) {
      const server = await ensureServer(target);
      if (server) started.push(server);
    }
  } catch (error) {
    await closeAll();
    throw error;
  }
  return async () => {
    await closeAll();
  };
}

async function ensureServer(
  target: E2eServerTarget,
): Promise<ViteDevServer | null> {
  const fingerprint = fingerprintOf(target);
  const probe = await probeLogixDevServer(target.port, fingerprint);
  if (probe === "matching") return null;
  if (probe === "foreign") {
    throw new Error(
      `E2E_DEV_SERVER_CONFLICT: 端口 ${target.port} 已有非本测试配置的 Logix 开发服务器（${target.name}），请先停止后再运行 E2E。`,
    );
  }
  const server = await withAuthEnv(target.env, () =>
    createServer({
      root: webRoot,
      ...(target.cacheDir ? { cacheDir: target.cacheDir } : {}),
      plugins: [e2eServerMeta(fingerprint)],
      server: { host: true, port: target.port, strictPort: true },
    }),
  );
  await server.listen();
  return server;
}

function fingerprintOf(target: E2eServerTarget): string {
  return createHash("sha256")
    .update(JSON.stringify([target.name, target.port, target.env]))
    .digest("hex")
    .slice(0, 16);
}

function e2eServerMeta(fingerprint: string): Plugin {
  return {
    name: "logix-e2e-server-meta",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { name: E2E_SERVER_META, content: fingerprint },
        injectTo: "head",
      },
    ],
  };
}

/** Vite 在 createServer 时解析 env，进程变量优先于 `.env*`；解析完立刻恢复，两台服务器互不串味。 */
async function withAuthEnv<T>(
  env: Readonly<Record<string, string>>,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map(
    Object.keys(env).map((key) => [key, process.env[key]] as const),
  );
  Object.assign(process.env, env);
  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
