import { expect, test, type Page } from "@playwright/test";

const disableMotion = async (page: Page) => {
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
};

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

test("task workbench remains readable", async ({ page }) => {
  await page.goto("/tasks?task=task_1027");
  await disableMotion(page);

  await expect(
    page.getByRole("heading", { name: "确认实际离港时间" }),
  ).toBeVisible();
  await expect(page.locator('[aria-label="任务状态：待复核"]')).toBeVisible();
  await expect(page.locator('[aria-label="货柜状态：在途"]')).toBeVisible();
  await expect(page.getByText("原因", { exact: true })).toBeVisible();
  await expect(page.getByText("下一步", { exact: true })).toBeVisible();
  await expect(page.getByText("完成标准", { exact: true })).toBeVisible();
  await expect(page.getByText("安全边界", { exact: true })).toBeVisible();
  await expect(page.getByText("船司与码头离港记录相差 45 分钟")).toBeVisible();
  await expect(page.getByRole("heading", { name: "操作记录" })).toHaveCount(0);
  const guide = page.getByRole("navigation", { name: "任务执行导引" });
  await expect(guide).toBeVisible();
  await expect(guide.locator('[aria-current="step"]')).toContainText("证据");
  const currentWorkspace = page.getByRole("region", { name: "当前工作区" });
  await expect(currentWorkspace).toHaveCount(1);
  await expect(currentWorkspace).toContainText("采纳理由");
  await expect(page.getByRole("region", { name: "其他任务要求" })).toHaveCount(
    0,
  );
  await expect(
    currentWorkspace.getByRole("button", { name: "确认完成" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("task-workbench.png", {
    animations: "disabled",
  });
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /全部要求/ }).click();
  const supporting = page.getByRole("region", { name: "其他任务要求" });
  await expect(supporting).toBeVisible();
  await expect(supporting).toContainText("前置条件");
  await expect(supporting).toContainText("资料与资源");
});

test("operation record remains readable", async ({ page }) => {
  await page.goto("/tasks?task=task_1025");
  await disableMotion(page);

  const record = page.getByRole("region", { name: "本次操作记录" });
  await expect(record).toBeVisible();
  await expect(record).toContainText("重新核验条件");
  await expect(record).toContainText("服务器已收到");
  await expect(record).toContainText("业务已接受");
  await expect(record).toContainText("结果已落账");
  await expect(record).not.toContainText("candidate_recheck_pickup_readiness");
  await expect(record).toHaveScreenshot("task-operation-record.png", {
    animations: "disabled",
  });

  await record.getByRole("button", { name: "了解操作记录" }).click();
  await expect(page.getByRole("tooltip")).toContainText(
    "只有结果落账才计入业务事实",
  );
});

test("task queue keeps work items visually separated", async ({ page }) => {
  await page.goto("/tasks");
  await disableMotion(page);

  const queue = page.getByRole("region", { name: "待处理任务" });
  const queueViewport = queue.getByLabel("任务列表");
  const tasks = queue.getByTestId("actionable-task");
  await expect(tasks).toHaveCount(4);
  const queueFrame = await queue.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderTopWidth: style.borderTopWidth,
      borderTopStyle: style.borderTopStyle,
    };
  });
  expect(queueFrame).toEqual({
    borderTopWidth: "1px",
    borderTopStyle: "solid",
  });
  const gaps = await tasks.evaluateAll((items) =>
    items.slice(1).map((item, index) => {
      const previous = items[index].getBoundingClientRect();
      const current = item.getBoundingClientRect();
      return Math.round(current.top - previous.bottom);
    }),
  );
  expect(gaps.every((gap) => gap >= 8)).toBe(true);

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(queueViewport).toHaveCSS("overflow-y", "auto");
    const scrollMetrics = await queueViewport.evaluate((viewport) => {
      const taskList = viewport.querySelector(".task-list");
      const task = taskList?.querySelector(".task-row");
      if (!taskList || !task) return null;

      for (let index = 0; index < 12; index += 1) {
        taskList.append(task.cloneNode(true));
      }
      viewport.scrollTop = viewport.scrollHeight;
      return {
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
    });
    expect(scrollMetrics).not.toBeNull();
    expect(scrollMetrics!.scrollHeight).toBeGreaterThan(
      scrollMetrics!.clientHeight,
    );
    expect(scrollMetrics!.scrollTop).toBeGreaterThan(0);
    await page.reload();
    await disableMotion(page);
  } else {
    await expect(queueViewport).toHaveCSS("overflow-y", "visible");
  }

  await expect(queue).toHaveScreenshot("task-queue.png", {
    animations: "disabled",
  });
});

test("container record remains readable", async ({ page }) => {
  await page.goto("/container/cr_01J9LAX7K2D4");
  await disableMotion(page);

  await expect(
    page.getByRole("heading", { name: "TCLU-2387642" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "当前节点事实" }),
  ).toBeVisible();
  await expect(page.getByLabel("节点关键事实")).toBeVisible();
  const eventTimeline = page.getByRole("region", { name: "事件时间证据" });
  await expect(eventTimeline).toContainText("事实时间轴");
  await expect(page.getByText("最近操作已落账", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("container-record.png", {
    animations: "disabled",
  });
  await expectNoHorizontalOverflow(page);
  await page.getByText("事实时间轴", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("事实时间轴", { exact: true })).toBeVisible();
  await expect(eventTimeline).toHaveScreenshot("container-event-timeline.png", {
    animations: "disabled",
  });

  await page.goto("/container/cr_01J9LAX8M5Q7");
  await expect(page.getByText("无待确认操作", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("dark task shell remains readable", async ({ page }) => {
  await page.goto("/tasks?task=task_1026");
  await disableMotion(page);
  await page.getByRole("button", { name: "切换深色主题" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "卸柜并核对实收数量" }),
  ).toBeVisible();
  await expect(page.getByText("现场人工执行", { exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot("task-workbench-dark.png", {
    animations: "disabled",
  });
  await expectNoHorizontalOverflow(page);
});

const overviewPages = [
  {
    name: "container-list",
    path: "/containers",
    heading: "已出运货柜",
  },
  {
    name: "planning-workbench",
    path: "/meso",
    heading: "First Mile PDCA 运营",
  },
  {
    name: "management-dashboard",
    path: "/dashboard",
    heading: "货柜运营态势",
  },
] as const;

for (const overview of overviewPages) {
  test(`${overview.name} remains readable`, async ({ page }, testInfo) => {
    await page.goto(overview.path);
    await disableMotion(page);

    await expect(
      page.getByRole("heading", { name: overview.heading }),
    ).toBeVisible();
    if (overview.name === "container-list") {
      const table = page.getByRole("table", { name: "已出运货柜数据表" });
      await expect(table).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: /货柜状态/ }),
      ).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: /任务状态/ }),
      ).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: /同步状态/ }),
      ).toBeVisible();
      await expect(table).toContainText(
        "TRLU-991203424DSA1955 · MAEU254620101送仓",
      );
      if (testInfo.project.name === "desktop-chromium") {
        await expect(
          table.getByRole("columnheader", { name: /实际到港/ }),
        ).toBeInViewport();
        await expect(
          table.getByRole("columnheader", { name: /当前风险/ }),
        ).toBeInViewport();
      }
      await expect(page.getByTestId("data-table-scroll")).toHaveCSS(
        "overflow-x",
        "auto",
      );
    }
    if (overview.name === "management-dashboard") {
      const kpis = page.getByRole("navigation", { name: "管理看板 KPI" });
      await expect(kpis.getByRole("link")).toHaveCount(5);
      await expect(kpis).toContainText("滞箱滞港费用占比76%");
      await expect(kpis).toContainText("未关闭异常数2 项");
      await expect(kpis).not.toContainText("周计划达成");
      await expect(
        page.getByRole("heading", { name: "货柜流向扫描" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "待决策" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "执行与能力" }),
      ).toBeVisible();
      await expect(
        page.getByRole("table", { name: "计划与达成，完成 / 计划" }),
      ).toContainText("清关13/1512/1513/1510/15");
      const analytics = page.getByRole("region", { name: "执行与能力" });
      await expect(analytics.locator(".analytics-grid")).toHaveCSS(
        "gap",
        "12px",
      );
      await expect(analytics.locator(".analytics-grid > section")).toHaveCount(
        3,
      );
      await expect(page.getByRole("progressbar")).toHaveCount(3);
    }
    if (overview.name === "planning-workbench") {
      const raci = page.getByRole("region", { name: "RACI 责任投影" });
      await expect(raci.getByRole("row")).toHaveCount(15);
      await expect(raci.getByRole("columnheader")).toHaveCount(9);
      await expect(raci.locator(".accountable")).toHaveCount(14);
      await expect(raci.getByTestId("raci-scroll")).toHaveCSS(
        "overflow-x",
        "auto",
      );
    }
    await expect(page).toHaveScreenshot(`${overview.name}.png`, {
      animations: "disabled",
      fullPage: true,
    });
    await expectNoHorizontalOverflow(page);
  });
}

test("container table supports data operations without changing the page template", async ({
  page,
}) => {
  await page.goto("/containers");

  const table = page.getByRole("table", { name: "已出运货柜数据表" });
  await page.getByPlaceholder("柜号 / 备货单 / 提单").fill("MSKU-5521087");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("MSKU-5521087");
  await expect(table).not.toContainText("TCLU-2387642");

  await page.getByPlaceholder("柜号 / 备货单 / 提单").fill("");
  await page.getByRole("button", { name: "风险", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(3);

  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "按预计到港降序排列" }).click();
  await expect(
    table.getByRole("columnheader", { name: /预计到港/ }),
  ).toHaveAttribute("aria-sort", "descending");

  await page.getByText("字段", { exact: true }).click();
  await page.getByTestId("column-toggle-actualAt").uncheck();
  await expect(
    table.getByRole("columnheader", { name: /实际到港/ }),
  ).toHaveCount(0);
  await page.getByText("字段", { exact: true }).click();

  await table
    .getByRole("button", { name: "TCLU-2387642", exact: true })
    .click();
  await expect(page).toHaveURL(/\/container\/cr_01J9LAX7K2D4$/);
});

test("management achievement calendar remains readable", async ({ page }) => {
  await page.goto("/dashboard");
  await disableMotion(page);

  const achievement = page.getByRole("region", { name: "计划与达成" });
  const calendar = achievement.getByRole("table", {
    name: "计划与达成，完成 / 计划",
  });
  await achievement.scrollIntoViewIfNeeded();

  await expect(calendar).toContainText("节点W35W36W37W38");
  await expect(calendar).toContainText("清关13/1512/1513/1510/15");
  const widths = await achievement.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  await expect(achievement).toHaveScreenshot(
    "management-achievement-calendar.png",
    {
      animations: "disabled",
    },
  );

  await achievement.getByRole("button", { name: "周", exact: true }).click();
  await expect(calendar).toContainText("节点周一周二周三周四周五周六周日");
  await expect(calendar).toContainText("清关2/32/32/32/32/30/00/0");
  const weeklyWidths = await achievement.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(weeklyWidths.scroll).toBeLessThanOrEqual(weeklyWidths.client + 1);
  await expect(achievement).toHaveScreenshot(
    "management-achievement-calendar-week.png",
    { animations: "disabled" },
  );

  await achievement.getByRole("button", { name: "日", exact: true }).click();
  await expect(calendar).toContainText("节点08:0010:0012:0014:0016:0018:00");
  await expect(achievement).toHaveScreenshot(
    "management-achievement-calendar-day.png",
    { animations: "disabled" },
  );
});

test("management dashboard uses a wide viewport as an operations canvas", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.setViewportSize({ width: 1624, height: 749 });
  await page.goto("/dashboard");
  await disableMotion(page);

  const signals = page
    .getByRole("navigation", { name: "管理看板 KPI" })
    .getByRole("link");
  await expect(signals).toHaveCount(5);
  const signalPositions = await signals.evaluateAll((links) =>
    links.map((link) => Math.round(link.getBoundingClientRect().top)),
  );
  expect(new Set(signalPositions).size).toBe(1);

  const flowBox = await page
    .getByRole("heading", { name: "货柜流向扫描" })
    .locator("..")
    .locator("..")
    .boundingBox();
  const decisionBox = await page
    .getByRole("heading", { name: "待决策" })
    .locator("..")
    .locator("..")
    .boundingBox();
  expect(flowBox).not.toBeNull();
  expect(decisionBox).not.toBeNull();
  expect(flowBox!.width).toBeGreaterThan(decisionBox!.width * 1.8);

  await expect(page).toHaveScreenshot("management-dashboard-wide.png", {
    animations: "disabled",
    fullPage: true,
  });
  await expectNoHorizontalOverflow(page);
});

test("management RACI supports node drill-down and dark mode", async ({
  page,
}) => {
  await page.goto("/meso");
  await disableMotion(page);

  const raci = page.getByRole("region", { name: "RACI 责任投影" });
  await raci.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "切换深色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(raci).toHaveScreenshot("management-raci-dark.png", {
    animations: "disabled",
  });
  await expectNoHorizontalOverflow(page);

  await raci.locator("tbody tr").nth(6).getByRole("link").click();
  await expect(page).toHaveURL(/\/container\/cr_01J9LAX7K2D4\?node=customs$/);
  await expect(page.locator(".rail-node.active")).toContainText("清关");
});
