import { expect, test } from "@playwright/test";

test("shell follows the responsive navigation contract", async ({
  page,
}, testInfo) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  const sidebar = page.getByTestId("app-sidebar");
  const viewportWidth = page.viewportSize()!.width;

  if (viewportWidth >= 1280) {
    await expect(sidebar).toHaveCSS("width", "232px");
    await page.getByRole("button", { name: "收起侧栏" }).click();
    await expect(sidebar).toHaveCSS("width", "64px");
    await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();
  } else if (viewportWidth >= 960) {
    await expect(sidebar).toHaveCSS("width", "64px");
    await expect(page.getByRole("button", { name: "打开主导航" })).toBeHidden();
  } else {
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole("button", { name: "打开主导航" }).click();
    await expect(sidebar).toBeInViewport();
    await page.getByRole("link", { name: "干活" }).click();
    await expect(page).toHaveURL(/\/containers$/);
    await expect(sidebar).not.toBeInViewport();
  }

  await expect(
    page
      .getByRole("main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).resolves.toBe(true);
  await testInfo.attach("viewport", {
    body: `${page.viewportSize()!.width}x${page.viewportSize()!.height}`,
    contentType: "text/plain",
  });
});

test("sidebar exposes one workbench directory entry and no formal workbench shortcuts", async ({
  page,
}) => {
  await page.goto("/workspaces");
  const navigation = page.getByRole("navigation", { name: "主导航" });

  await expect(
    navigation.getByRole("link", { name: "业务工作台" }),
  ).toHaveCount(1);
  for (const label of [
    "备货工作台",
    "装箱工作台",
    "出运工作台",
    "进口清关工作台",
    "提柜工作台",
    "送仓工作台",
    "卸柜工作台",
  ]) {
    await expect(navigation.getByRole("link", { name: label })).toHaveCount(0);
  }
  await expect(page.locator(".workspace-switcher")).toHaveCount(0);
});

test("all 23 workbench deep links remain reachable after sidebar convergence", async ({
  page,
}) => {
  for (const path of [
    "/workspaces/market-signals",
    "/workspaces/product-selection",
    "/workspaces/product-npi",
    "/workspaces/master-data",
    "/workspaces/sourcing",
    "/workspaces/demand-replenishment",
    "/workspaces/procurement",
    "/workspaces/supply-readiness",
    "/workspaces/shipment-planning",
    "/workspaces/booking",
    "/workspaces/cargo-ready",
    "/workspaces/stuffing",
    "/workspaces/export-customs",
    "/workspaces/dispatch",
    "/workspaces/ocean-operations",
    "/workspaces/customs",
    "/workspaces/pickup",
    "/workspaces/delivery",
    "/workspaces/unloading",
    "/workspaces/empty-return",
    "/workspaces/compliance-operations",
    "/workspaces/charges",
    "/workspaces/exceptions",
  ]) {
    await page.goto(path);
    await expect(page.locator("main h2").first()).toBeVisible();
  }
});

test("mobile drawer preserves entry order and closes after navigation", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 960, "mobile drawer only");
  await page.goto("/tasks");
  await page.getByRole("button", { name: "打开主导航" }).click();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const links = navigation.getByRole("link");
  await expect(links.nth(0)).toHaveAccessibleName("我的任务");
  await expect(links.nth(1)).toHaveAccessibleName("业务工作台");
  await navigation.getByRole("link", { name: "业务工作台" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByTestId("app-sidebar")).not.toBeInViewport();
});

test("mobile drawer closes with Escape", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 960, "mobile drawer only");
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  const sidebar = page.getByTestId("app-sidebar");

  await page.getByRole("button", { name: "打开主导航" }).click();
  await expect(sidebar).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(sidebar).not.toBeInViewport();
});

test("mobile task panes stay available", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 768, "mobile task panes only");
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: /任务列表/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /当前任务/ })).toBeVisible();
});

test("explanatory tooltips work with click and Escape", async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(width >= 960 && width < 1280, "folded rail hides workspace help");

  await page.goto("/meso");
  await expect(page.getByRole("heading", { name: "看档" })).toBeVisible();
  if (width < 960) {
    await page.getByRole("button", { name: "打开主导航" }).click();
    await expect(page.getByTestId("app-sidebar")).toBeInViewport();
  }

  const explanation = "角色切换只裁剪演示视图，不代表生产环境的服务端权限。";
  await expect(page.getByText(explanation)).toHaveCount(0);
  await page.getByRole("button", { name: "查看演示角色说明" }).click();
  await expect(page.getByRole("tooltip")).toHaveText(explanation);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("all migrated workspaces keep the shared shell and bounded overflow", async ({
  page,
}) => {
  const routes = [
    ["/containers", "干活"],
    ["/workspaces/cargo-ready", "备货"],
    ["/workspaces/stuffing", "装箱"],
    ["/real-tasks", "我的任务"],
    ["/real-containers", "干活"],
    ["/dashboard", "货柜"],
    ["/meso", "看档"],
    ["/real-operations", "看提交"],
    ["/dead-letters", "看失败"],
  ] as const;

  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByTestId("app-shell")).toBeVisible();
    const widths = await page.evaluate(() => ({
      pageClient: document.documentElement.clientWidth,
      pageScroll: document.documentElement.scrollWidth,
      contentClient:
        document.querySelector<HTMLElement>(".app-content")?.clientWidth ?? 0,
      contentScroll:
        document.querySelector<HTMLElement>(".app-content")?.scrollWidth ?? 0,
    }));
    expect(widths.pageScroll).toBeLessThanOrEqual(widths.pageClient + 1);
    expect(widths.contentScroll).toBeLessThanOrEqual(widths.contentClient + 1);
  }
});
