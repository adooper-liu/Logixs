import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
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
});
