import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Every /tasks request is local, including the eagerly loaded collaboration/AI.
async function installTaskFixture(page: Page) {
  const containerId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  const asOf = "2026-10-23T08:00:00.000Z";
  const pageInfo = { nextCursor: null, hasNextPage: false, pageSize: 200 };
  const container = {
    id: containerId,
    containerNumber: "E2E-PANE-A",
    orderNumber: "E2E-PANE-ORDER",
    currentStatus: "at_port",
    updatedAt: asOf,
  };
  const nextAction = {
    actionCode: "work_execution.complete_work_order",
    workOrderId: "work-pane-a",
    workOrderDefinitionKey: "stuffing",
    assignmentState: "assigned",
    assigneeId: "dev-operator",
    dueAt: null,
  };
  const task = {
    id: taskId,
    containerId,
    flowInstanceId: "flow-pane-a",
    nodeInstanceId: "node-pane-a",
    nodeCode: "container_stuffing",
    taskDefinitionKey: "node-stuffing",
    state: "in_progress",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: nextAction.workOrderId,
        workOrderDefinitionKey: "stuffing",
        state: "in_progress",
        assignmentState: "assigned",
        assigneeId: "dev-operator",
        dueAt: null,
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction,
  };
  const unexpected: string[] = [];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/containers")
      return route.fulfill({
        json: { items: [container], pageInfo, asOf, projectionVersion: 1 },
      });
    if (path === `/api/containers/${containerId}`)
      return route.fulfill({ json: container });
    if (path === "/api/node-tasks")
      return route.fulfill({
        json: {
          items: [
            task,
            {
              ...task,
              id: "33333333-3333-4333-8333-333333333333",
              workOrders: [{ ...task.workOrders[0], id: "work-pane-b" }],
              nextAction: { ...nextAction, workOrderId: "work-pane-b" },
            },
          ],
          pageInfo,
          asOf,
          projectionVersion: 1,
        },
      });
    const collaboration = path.match(/\/node-tasks\/([^/]+)\/collaboration$/);
    if (collaboration)
      return route.fulfill({
        json: {
          contractVersion: "task-collaboration-page.v1",
          thread: null,
          subjectRef: { kind: "container", id: containerId },
          workRef: { kind: "node_task", id: collaboration[1] },
          visibility: "task_scope",
          visibilityLabel: "当前任务参与者",
          messages: [],
          asOf,
          pageSize: 25,
          nextCursor: null,
          canPost: false,
          postDisabledReason: "本地只读布局演练",
          mentionOptions: [],
          evidenceOptions: [],
        },
      });
    if (path.endsWith("/ai/action-candidates"))
      return route.fulfill({
        status: 409,
        json: {
          message: "NO_CLAIM_ACTION",
          details: [{ reasonCode: "NO_CLAIM_ACTION" }],
        },
      });
    if (path.endsWith("/activities"))
      return route.fulfill({
        json: {
          items: [],
          nextActions: [],
          pageInfo: { ...pageInfo, pageSize: 25 },
          asOf,
          projectionVersion: 1,
        },
      });
    unexpected.push(`${route.request().method()} ${path}`);
    await route.fulfill({
      status: 404,
      json: { message: "UNHANDLED_LOCAL_FIXTURE_REQUEST" },
    });
  });
  return { taskId, unexpected };
}

async function expectLegalTaskFocus(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.closest("[hidden], [inert]"))
          return false;
        const rect = el.getBoundingClientRect();
        return el.checkVisibility() && rect.width > 1 && rect.height > 1;
      }),
    )
    .toBe(true);
}

async function taskBreakpointEvidence(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const data = await page.evaluate(() => ({
    width: innerWidth,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    focus: document.activeElement?.outerHTML.slice(0, 300),
  }));
  expect(data.scroll).toBeLessThanOrEqual(data.client + 1);
  await testInfo.attach(name, {
    body: JSON.stringify(data),
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

test("shell follows the responsive navigation contract", async ({
  page,
}, testInfo) => {
  await installTaskFixture(page);
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
  const fixture = await installTaskFixture(page);
  await page.goto("/tasks");
  // The shell mounts before the lazy route; route completion closes navigation.
  await expect(
    page.getByRole("heading", { name: "我的任务", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`[data-task-id="${fixture.taskId}"]`),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开主导航" }).click();
  await expect(page.getByTestId("app-sidebar")).toBeInViewport();
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
  await installTaskFixture(page);
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
  await installTaskFixture(page);
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  const steps = page.getByRole("navigation", { name: "工作台办理步骤" });
  const queueButton = steps.getByRole("button", {
    name: "队列",
    exact: true,
  });
  const detailButton = steps.getByRole("button", {
    name: "详情",
    exact: true,
  });
  const contextButton = steps.getByRole("button", {
    name: "上下文",
    exact: true,
  });
  const queuePane = page.locator('[data-workbench-pane="queue"]');
  const detailPane = page.locator('[data-workbench-pane="detail"]');
  const contextPane = page.locator('[data-workbench-pane="context"]');
  const activePane = page.locator(
    '[data-workbench-pane][data-mobile-active="true"]',
  );

  await expect(queueButton).toBeVisible();
  await expect(detailButton).toBeVisible();
  await expect(contextButton).toBeVisible();
  await expect(steps.getByRole("button")).toHaveCount(3);
  await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);

  await expect(queuePane).toHaveAttribute("data-mobile-active", "true");
  await expect(detailPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(contextPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(queuePane).not.toHaveAttribute("inert");
  await expect(detailPane).toHaveAttribute("inert", "");
  await expect(contextPane).toHaveAttribute("inert", "");
  await expect(activePane).toHaveCount(1);

  await detailButton.click();
  await expect(detailPane).toHaveAttribute("data-mobile-active", "true");
  await expect(queuePane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(contextPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(queuePane).toHaveAttribute("inert", "");
  await expect(detailPane).not.toHaveAttribute("inert");
  await expect(contextPane).toHaveAttribute("inert", "");
  await expect(activePane).toHaveCount(1);

  await contextButton.click();
  await expect(contextPane).toHaveAttribute("data-mobile-active", "true");
  await expect(queuePane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(detailPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(queuePane).toHaveAttribute("inert", "");
  await expect(detailPane).toHaveAttribute("inert", "");
  await expect(contextPane).not.toHaveAttribute("inert");
  await expect(activePane).toHaveCount(1);

  await queueButton.click();
  await expect(queuePane).toHaveAttribute("data-mobile-active", "true");
  await expect(detailPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(contextPane).not.toHaveAttribute("data-mobile-active", /.+/);
  await expect(queuePane).not.toHaveAttribute("inert");
  await expect(detailPane).toHaveAttribute("inert", "");
  await expect(contextPane).toHaveAttribute("inert", "");
  await expect(activePane).toHaveCount(1);

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
});

test("tasks collapse mobile desktop preserves draft, instance and legal detail focus", async ({
  page,
}, testInfo) => {
  const fixture = await installTaskFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tasks");
  await page.locator(`[data-task-id="${fixture.taskId}"]`).click();
  const input = page.locator(".execution .scan-row input");
  await expect(input).toHaveCount(1);
  await input.fill("SP3C1 preserved evidence draft");
  const original = await input.elementHandle();
  await page.getByRole("button", { name: "折叠任务队列", exact: true }).click();
  await page
    .getByRole("button", { name: "折叠任务上下文", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalTaskFocus(page);
  await taskBreakpointEvidence(
    page,
    testInfo,
    "tasks-collapse-mobile-before-click",
  );
  for (const pane of ["queue", "context", "detail"]) {
    await page.locator(`[data-mobile-target="${pane}"]`).click();
    await expect(
      page.locator(`[data-workbench-pane="${pane}"]`),
    ).not.toHaveAttribute("inert");
    if (pane !== "detail")
      await expect(
        page.locator(`[data-workbench-pane="${pane}"] .collapsible-rail__body`),
      ).not.toHaveAttribute("hidden");
  }
  await input.focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("SP3C1 preserved evidence draft");
  expect(await input.evaluate((el, before) => el === before, original)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "展开任务队列", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "展开任务上下文", exact: true }),
  ).toBeVisible();
  await taskBreakpointEvidence(
    page,
    testInfo,
    "tasks-collapse-desktop-before-click",
  );
  expect(fixture.unexpected).toEqual([]);
});

test("tasks drawer mobile desktop and exact breakpoints recover before click", async ({
  page,
}, testInfo) => {
  const fixture = await installTaskFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tasks");
  const queueItem = page.locator(`[data-task-id="${fixture.taskId}"]`);
  await queueItem.click();
  await queueItem.focus();
  await page.setViewportSize({ width: 1100, height: 768 });
  await expectLegalTaskFocus(page);
  const trigger = page.locator(".workbench-layout__narrow-queue");
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 1101, height: 900 });
  await expectLegalTaskFocus(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".workbench-layout__narrow-backdrop")).toHaveCount(
    0,
  );
  await expect(page.locator("[data-workbench-pane][inert]")).toHaveCount(0);
  await taskBreakpointEvidence(
    page,
    testInfo,
    "tasks-drawer-desktop-before-click",
  );
  await page.setViewportSize({ width: 681, height: 768 });
  await expectLegalTaskFocus(page);
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 680, height: 844 });
  await expectLegalTaskFocus(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".workbench-layout__narrow-backdrop")).toHaveCount(
    0,
  );
  await expect(
    page.locator('[data-workbench-pane="detail"]'),
  ).not.toHaveAttribute("inert");
  await taskBreakpointEvidence(page, testInfo, "tasks-drawer-680-before-click");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalTaskFocus(page);
  await page.locator('[data-mobile-target="context"]').click();
  await expect(page.locator('[data-mode-control="work"]')).toBeEnabled();
  await page.locator('[data-mode-control="work"]').focus();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-mode-control="work"]')).toBeFocused();
  await expect(page.locator("[data-workbench-pane][inert]")).toHaveCount(0);
  expect(fixture.unexpected).toEqual([]);
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
    if (path === "/real-tasks") await installTaskFixture(page);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
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
