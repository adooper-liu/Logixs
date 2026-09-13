import { expect, test, type Page } from "@playwright/test";

// 产品路径已改为真实 API。依赖演示柜号/任务标题的像素基线退出产品路径，不在本文件更新。
const disableMotion = async (page: Page) => {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
};

const waitForLiveReady = async (page: Page) => {
  await expect(page.getByText("加载中…")).toHaveCount(0, { timeout: 15_000 });
};

const liveFailed = (page: Page) => page.getByText(/没能加载/);

const expectNoHorizontalOverflow = async (page: Page) => {
  const widths = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".app-content");
    return {
      pageClient: document.documentElement.clientWidth,
      pageScroll: document.documentElement.scrollWidth,
      contentClient: content?.clientWidth ?? 0,
      contentScroll: content?.scrollWidth ?? 0,
    };
  });

  expect(widths.pageScroll).toBeLessThanOrEqual(widths.pageClient + 1);
  expect(widths.contentScroll).toBeLessThanOrEqual(widths.contentClient + 1);
};

test("operations shell does not advertise the developer console", async ({
  page,
}) => {
  await page.goto("/tasks");
  const nav = page.getByRole("navigation", { name: "主导航" });
  await expect(nav.getByRole("link", { name: "开发控制台" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "看提交" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "真实任务" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "真实货柜" })).toHaveCount(0);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 1280) {
    await expect(nav.getByRole("link", { name: "我的任务" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "干活" })).toBeVisible();
  } else if (viewportWidth < 960) {
    await page.getByRole("button", { name: "打开主导航" }).click();
    await expect(nav.getByRole("link", { name: "我的任务" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "干活" })).toBeVisible();
  }
  await page.goto("/dev");
  await expect(page.getByRole("heading", { name: "开发控制台" })).toBeVisible();
});

test("task workbench remains readable", async ({ page }) => {
  await page.goto("/tasks");
  await disableMotion(page);
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await waitForLiveReady(page);
  await expect(page.getByText("确认实际离港时间")).toHaveCount(0);
  await expect(page.getByText("船司与码头离港记录相差 45 分钟")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("task workbench does not fabricate an operation record", async ({
  page,
}) => {
  await page.goto("/tasks");
  await disableMotion(page);
  await waitForLiveReady(page);
  await expect(page.getByRole("region", { name: "本次操作记录" })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("candidate_recheck_pickup_readiness"),
  ).toHaveCount(0);
});

test("task queue keeps the live work list bounded", async ({ page }) => {
  await page.goto("/tasks");
  await disableMotion(page);
  await waitForLiveReady(page);

  const queue = page.getByRole("region", { name: "待处理任务" });
  const empty = page.getByText("这一范围还没有待办。");
  const failed = liveFailed(page);
  await expect(queue.or(empty).or(failed).first()).toBeVisible();

  if (await queue.isVisible()) {
    const queueViewport = queue.getByLabel("任务列表");
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await expect(queueViewport).toHaveCSS("overflow-y", "auto");
    }
    await expect(page.getByText("后面的任务没能加载")).toHaveCount(0);
  }
  await expectNoHorizontalOverflow(page);
});

test("container record remains readable", async ({ page }) => {
  await page.goto("/container/missing-container");
  await disableMotion(page);
  await waitForLiveReady(page);
  await expect(page.getByText(/找不到这只货柜|货柜没能加载/)).toBeVisible();
  await expect(page.getByText("TCLU-2387642")).toHaveCount(0);
  await expect(page.getByText("最近操作已落账", { exact: true })).toHaveCount(
    0,
  );
  await expectNoHorizontalOverflow(page);

  await page.goto("/container/10000000-0000-4000-8000-000000000001");
  await waitForLiveReady(page);
  const heading = page.getByRole("heading", { name: "一柜一档" });
  const missing = page.getByText(/找不到这只货柜|货柜没能加载/);
  await expect(heading.or(missing)).toBeVisible();
  await expect(page.getByText("待发生")).toHaveCount(0);
  if (await heading.isVisible()) {
    await expect(page.getByText("MSKU1234567")).toBeVisible();
    const emptyFlow = page.getByText("这一柜还没有流程。");
    const nodeRail = page.getByLabel("货柜节点");
    await expect(emptyFlow.or(nodeRail)).toBeVisible();
    await page.getByRole("link", { name: "去做这柜的任务" }).click();
    await expect(page).toHaveURL(
      /\/tasks\?containerId=10000000-0000-4000-8000-000000000001/,
    );
  }
});

test("dark task shell remains readable", async ({ page }) => {
  await page.goto("/tasks");
  await disableMotion(page);
  await waitForLiveReady(page);
  await page.getByRole("button", { name: "切换深色主题" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(page.getByText("卸柜并核对实收数量")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

const overviewPages = [
  {
    name: "container-list",
    path: "/containers",
    heading: "干活",
  },
  {
    name: "planning-workbench",
    path: "/meso",
    heading: "看档",
  },
  {
    name: "management-dashboard",
    path: "/dashboard",
    heading: "货柜",
  },
] as const;

for (const overview of overviewPages) {
  test(`${overview.name} remains readable`, async ({ page }) => {
    await page.goto(overview.path);
    await disableMotion(page);
    await expect(
      page.getByRole("heading", { name: overview.heading }),
    ).toBeVisible();
    await waitForLiveReady(page);

    if (overview.name === "container-list") {
      const table = page.getByRole("table", { name: "干活" });
      const failed = liveFailed(page);
      await expect(table.or(failed)).toBeVisible();
      if (await table.isVisible()) {
        await expect(
          table.getByRole("columnheader", { name: /状态/ }),
        ).toBeVisible();
        await expect(
          table.getByRole("columnheader", { name: "当前站" }),
        ).toBeVisible();
        await expect(
          table.getByRole("columnheader", { name: "待办" }),
        ).toBeVisible();
        await expect(
          table.getByRole("columnheader", { name: "同步" }),
        ).toBeVisible();
        await expect(
          table.getByRole("columnheader", { name: /任务状态/ }),
        ).toHaveCount(0);
        await expect(
          table.getByRole("columnheader", { name: /同步状态/ }),
        ).toHaveCount(0);
        await expect(table).not.toContainText("TRLU-991203424DSA1955");
        await expect(page.getByTestId("data-table-scroll")).toHaveCSS(
          "overflow-x",
          "auto",
        );
      }
    }
    if (overview.name === "management-dashboard") {
      const kpis = page.getByRole("navigation", { name: "管理看板 KPI" });
      const failed = liveFailed(page);
      await expect(kpis.or(failed)).toBeVisible();
      if (!(await kpis.isVisible())) {
        await expectNoHorizontalOverflow(page);
        return;
      }
      const kpiLinks = kpis.getByRole("link");
      expect(await kpiLinks.count()).toBeGreaterThanOrEqual(1);
      expect(await kpiLinks.count()).toBeLessThanOrEqual(2);
      await expect(kpis).toContainText("货柜");
      await expect(kpis).not.toContainText("滞箱滞港费用占比");
      await expect(kpis).not.toContainText("待服务器确认数");
      await expect(kpis).not.toContainText("全部已落账");
      await expect(kpis).not.toContainText("76%");
      await expect(page.getByRole("heading", { name: "待决策" })).toHaveCount(
        0,
      );
      await expect(page.getByText("不使用演示样本")).toHaveCount(0);
      await expect(page.getByRole("progressbar")).toHaveCount(0);
    }
    if (overview.name === "planning-workbench") {
      await expect(page.getByRole("heading", { name: "看档" })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "RACI 责任投影" }),
      ).toHaveCount(0);
      await expect(page.getByText("不使用演示样本")).toHaveCount(0);
      await expect(page.getByText("待发生")).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
  });
}

test("container table supports data operations without changing the page template", async ({
  page,
}) => {
  await page.goto("/containers");
  await waitForLiveReady(page);

  const table = page.getByRole("table", { name: "干活" });
  const failed = liveFailed(page);
  await expect(table.or(failed)).toBeVisible();
  if (!(await table.isVisible())) return;

  await page.getByPlaceholder("柜号 / 备货单").fill("___no_such_box___");
  await expect(table).not.toContainText("MSKU-5521087");
  await expect(table).not.toContainText("TCLU-2387642");

  await page.getByPlaceholder("柜号 / 备货单").fill("");
  const openButton = table.locator(".open-row").first();
  if (await openButton.count()) {
    await openButton.click();
    await expect(page).toHaveURL(/\/tasks\?containerId=/);
  }
});

test("management dashboard stays a single scan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 1624, height: 749 });
  await page.goto("/dashboard");
  await disableMotion(page);
  await waitForLiveReady(page);

  const kpis = page.getByRole("navigation", { name: "管理看板 KPI" });
  const failed = liveFailed(page);
  await expect(kpis.or(failed)).toBeVisible();
  if (!(await kpis.isVisible())) {
    await expectNoHorizontalOverflow(page);
    return;
  }
  const signals = kpis.getByRole("link");
  expect(await signals.count()).toBeGreaterThanOrEqual(1);
  expect(await signals.count()).toBeLessThanOrEqual(2);
  await expect(signals.first()).toContainText("货柜");
  await expect(page.getByRole("region", { name: "计划与达成" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "货柜流向扫描" })).toHaveCount(
    0,
  );
  await expectNoHorizontalOverflow(page);
});

test("planning board stays a container list in dark theme", async ({
  page,
}) => {
  await page.goto("/meso");
  await disableMotion(page);
  await waitForLiveReady(page);

  await expect(page.getByRole("heading", { name: "看档" })).toBeVisible();
  await expect(page.getByRole("region", { name: "RACI 责任投影" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "切换深色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page).not.toHaveURL(/\/container\//);
  await expectNoHorizontalOverflow(page);
});
