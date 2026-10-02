import { defineConfig, devices } from "@playwright/test";
import { OIDC_PROJECT } from "./e2e/support/testServers";
import { APP_URL, OIDC_APP_URL } from "./src/e2eDevServer";

const AUTH_SESSION_SPEC = /auth-session\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: APP_URL,
    colorScheme: "light",
    locale: "zh-CN",
    reducedMotion: "reduce",
    timezoneId: "Asia/Shanghai",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: AUTH_SESSION_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "narrow-chromium",
      testIgnore: AUTH_SESSION_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "mobile-chromium",
      testIgnore: AUTH_SESSION_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: OIDC_PROJECT,
      testMatch: AUTH_SESSION_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: OIDC_APP_URL,
        viewport: { width: 1440, height: 900 },
        // trace/截图/录像会记下请求头与页面，认证用例一律不产出。
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
  ],
});
