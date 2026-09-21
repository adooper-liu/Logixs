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

  const explanation = "看出运后的货柜，并做这一柜的任务。";
  await expect(page.getByText(explanation)).toHaveCount(0);
  await page.getByRole("button", { name: "查看工作区范围" }).click();
  await expect(page.getByRole("tooltip")).toHaveText(explanation);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("all migrated workspaces keep the shared shell and bounded overflow", async ({
  page,
}) => {
  const routes = [
    ["/containers", "干活"],
    ["/workspaces/cargo-ready", "备货工作台"],
    ["/workspaces/stuffing", "装箱工作台"],
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
