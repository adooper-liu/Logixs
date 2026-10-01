import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const WEB_ROOT = fileURLToPath(new URL(".", import.meta.url));

// VITE_ 前缀变量会原样进入浏览器产物；公共客户端不得持有任何密钥，必须在构建/启动前拒绝。
function rejectBrowserSecrets(mode: string): void {
  const leaked = Object.keys(loadEnv(mode, WEB_ROOT, "VITE_")).filter((key) =>
    /SECRET/i.test(key),
  );
  if (leaked.length > 0) {
    throw new Error(
      `BROWSER_SECRET_REJECTED: ${leaked.join(", ")} 不得进入浏览器配置`,
    );
  }
}

// 生产边界以 Vite 命令为准：`vite build` 下 NODE_ENV=development 会让 import.meta.env.DEV 为真，
// 浏览器侧的 DEV 分支因此不能证明产物里没有开发身份。错误信息只给键名，不回显身份值。
function rejectDevelopmentAuthInBuild(mode: string): void {
  const authMode = loadEnv(mode, WEB_ROOT, "VITE_").VITE_AUTH_MODE?.trim();
  if (authMode === "development") {
    throw new Error(
      "BUILD_DEVELOPMENT_AUTH_REJECTED: vite build 不得使用 VITE_AUTH_MODE=development，生产构建只允许 oidc",
    );
  }
}

export default defineConfig(({ command, mode }) => {
  rejectBrowserSecrets(mode);
  if (command === "build") rejectDevelopmentAuthInBuild(mode);
  return {
    plugins: [vue()],
    server: {
      // 同时听 IPv4/IPv6，避免 Windows 上 localhost=::1 而 Playwright 走 127.0.0.1。
      host: true,
      port: 5173,
      open: false,
      // 薄真实链路：/api 代理到本地 NestJS API（apps/api，端口 3000）。
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
        // 开发控制台的实时服务探测（避免跨域）
        "/ai": {
          target: "http://localhost:8001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ai/, ""),
        },
        "/temporal": {
          target: "http://localhost:8233",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/temporal/, ""),
        },
      },
    },
    test: {
      environment: "happy-dom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.ts"],
      restoreMocks: true,
    },
  };
});
