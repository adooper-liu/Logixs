import { expect, test } from "@playwright/test";

test("shell follows the responsive navigation contract", async ({
  page,
}, testInfo) => {
  await page.goto("/tasks?task=task_1026");
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
    await page.getByRole("link", { name: "已出运货柜" }).click();
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

test("mobile task link opens the active work instead of the full queue", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width >= 768, "mobile task panes only");
  await page.goto("/tasks?task=task_1026");

  await expect(
    page.getByRole("heading", { name: "卸柜并核对实收数量" }),
  ).toBeVisible();
  await expect(page.getByText("复核离港时间冲突")).toBeHidden();

  await page.getByRole("button", { name: /任务列表/ }).click();
  await expect(page.getByText("复核离港时间冲突")).toBeVisible();
});

test("explanatory tooltips work with click and Escape", async ({ page }) => {
  await page.goto("/meso");
  const explanation =
    "完整性范围：计划、达成、状态、时效、费用、异常与复盘；管理维度映射到流程节点和责任动作。";

  await expect(page.getByText(explanation)).toHaveCount(0);
  await page.getByRole("button", { name: "查看七维管理范围" }).click();
  await expect(page.getByRole("tooltip")).toHaveText(explanation);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("all migrated workspaces keep the shared shell and bounded overflow", async ({
  page,
}) => {
  const routes = [
    ["/containers", "已出运货柜"],
    ["/dashboard", "货柜运营态势"],
    ["/meso", "First Mile PDCA 运营"],
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
