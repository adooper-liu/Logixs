import { expect, test, type Page } from "@playwright/test";

const fixture = {
  containerId: "e2e-fixture-container-001",
  containerNumber: "E2E-FIXTURE-01",
  activeTaskId: "e2e-fixture-task-active",
  completedTaskId: "e2e-fixture-task-completed",
  opaqueAssigneeId: "user-uuid-e2e-fixture",
  internalDefinitionKey: "internal-e2e-definition-key",
  internalActivityTitle: "customs_cleared_internal_e2e",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
  threshold: 0.3,
};

function nodeTaskPage() {
  return {
    items: [
      {
        id: fixture.activeTaskId,
        flowInstanceId: "e2e-fixture-flow-active",
        nodeInstanceId: "e2e-fixture-node-active",
        nodeCode: "container_stuffing",
        containerId: fixture.containerId,
        taskDefinitionKey: fixture.internalDefinitionKey,
        state: "in_progress",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [
          {
            id: "e2e-fixture-work-order-active",
            workOrderDefinitionKey: "internal-e2e-work-order-key",
            state: "in_progress",
            assignmentState: "assigned",
            assigneeId: fixture.opaqueAssigneeId,
            dueAt: "2026-10-18T08:00:00.000Z",
            completedAt: null,
          },
        ],
        outcome: null,
        nextAction: {
          actionCode: "work_execution.complete_work_order",
          workOrderId: "e2e-fixture-work-order-active",
          workOrderDefinitionKey: "internal-e2e-work-order-key",
          assignmentState: "assigned",
          assigneeId: fixture.opaqueAssigneeId,
          dueAt: "2026-10-18T08:00:00.000Z",
        },
      },
      {
        id: fixture.completedTaskId,
        flowInstanceId: "e2e-fixture-flow-completed",
        nodeInstanceId: "e2e-fixture-node-completed",
        nodeCode: "customs_clearance",
        containerId: fixture.containerId,
        taskDefinitionKey: "internal-e2e-completed-definition-key",
        state: "completed",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [
          {
            id: "e2e-fixture-work-order-completed",
            workOrderDefinitionKey: "internal-e2e-completed-work-order-key",
            state: "completed",
            assignmentState: "assigned",
            assigneeId: fixture.opaqueAssigneeId,
            dueAt: "2026-10-17T08:00:00.000Z",
            completedAt: "2026-10-17T07:45:00.000Z",
          },
        ],
        outcome: {
          id: "e2e-fixture-outcome-001",
          previousState: "in_progress",
          nextState: "completed",
          resultPolicyMode: "all_required_work_orders_completed",
          eventCode: "container_customs_completed",
          requiredWorkOrderIds: ["e2e-fixture-work-order-completed"],
          completedWorkOrderIds: ["e2e-fixture-work-order-completed"],
          evaluatedAt: "2026-10-17T07:45:00.000Z",
        },
        nextAction: null,
      },
    ],
    pageInfo: {
      nextCursor: null,
      hasNextPage: false,
      pageSize: 200,
    },
    asOf: "2026-10-17T09:00:00.000Z",
    projectionVersion: 17,
  };
}

function activityPage(cursor?: string | null) {
  if (cursor) {
    return {
      items: [
        {
          id: "e2e-fixture-activity-older",
          activityCode: "task_created",
          sourceType: "node_task",
          sourceId: "e2e-fixture-node-task-record",
          occurredAt: "2026-10-17T07:30:00.000Z",
          recordedAt: "2026-10-17T07:31:00.000Z",
          containerId: fixture.containerId,
          taskId: fixture.completedTaskId,
          workOrderId: null,
          actorId: null,
          nodeCode: "customs_clearance",
          title: "internal-e2e-node-task-title",
          detail: "E2E fixture：更早的原任务记录。",
          severity: null,
          targetPath: null,
        },
      ],
      nextActions: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 50 },
      asOf: "2026-10-17T09:00:00.000Z",
      projectionVersion: 23,
    };
  }
  return {
    items: [
      {
        id: "e2e-fixture-activity-task",
        activityCode: "work_order_completed",
        sourceType: "client_operation",
        sourceId: "e2e-fixture-operation-001",
        occurredAt: "2026-10-17T07:44:00.000Z",
        recordedAt: "2026-10-17T07:45:00.000Z",
        containerId: fixture.containerId,
        taskId: fixture.completedTaskId,
        workOrderId: "e2e-fixture-work-order-completed",
        actorId: fixture.opaqueAssigneeId,
        nodeCode: "customs_clearance",
        title: "internal-e2e-client-operation-title",
        detail: "E2E fixture：原任务操作回执。",
        severity: null,
        targetPath: null,
      },
      {
        id: "e2e-fixture-activity-lifecycle",
        activityCode: "lifecycle_event_recorded",
        sourceType: "canonical_event",
        sourceId: "e2e-fixture-event-001",
        occurredAt: "2026-10-17T07:46:00.000Z",
        recordedAt: "2026-10-17T07:47:00.000Z",
        containerId: fixture.containerId,
        taskId: null,
        workOrderId: null,
        actorId: null,
        nodeCode: "customs_clearance",
        title: fixture.internalActivityTitle,
        detail: "E2E fixture：当前身份可见的相关对象事实。",
        severity: null,
        targetPath: null,
      },
    ],
    nextActions: [
      {
        actionCode: "work_execution.complete_work_order",
        containerId: fixture.containerId,
        taskId: fixture.activeTaskId,
        workOrderId: "e2e-fixture-work-order-active",
        nodeCode: "container_stuffing",
        taskDefinitionKey: fixture.internalDefinitionKey,
        workOrderDefinitionKey: "internal-e2e-work-order-key",
        assignmentState: "assigned",
        assigneeId: fixture.opaqueAssigneeId,
        dueAt: "2026-10-18T08:00:00.000Z",
        targetPath: `/tasks?containerId=${fixture.containerId}&task=${fixture.activeTaskId}`,
      },
    ],
    pageInfo: {
      nextCursor: "e2e-fixture-older-page",
      hasNextPage: true,
      pageSize: 50,
    },
    asOf: "2026-10-17T09:00:00.000Z",
    projectionVersion: 23,
  };
}

interface FixtureControl {
  failNextActivity: boolean;
  holdNextActivity: boolean;
  releaseNextActivity: (() => void) | null;
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    failNextActivity: false,
    holdNextActivity: false,
    releaseNextActivity: null,
  };
  await page.route(/\/api\/containers(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            id: fixture.containerId,
            orderNumber: "E2E-FIXTURE-ORDER-01",
            containerNumber: fixture.containerNumber,
            currentStatus: "at_port",
            updatedAt: "2026-10-17T07:47:00.000Z",
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-10-17T09:00:00.000Z",
        projectionVersion: 11,
      },
    });
  });
  await page.route(/\/api\/node-tasks(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: nodeTaskPage() });
  });
  await page.route(
    new RegExp(`/api/containers/${fixture.containerId}/activities(?:\\?.*)?$`),
    async (route) => {
      if (control.holdNextActivity) {
        control.holdNextActivity = false;
        await new Promise<void>((resolve) => {
          control.releaseNextActivity = resolve;
        });
        control.releaseNextActivity = null;
      }
      if (control.failNextActivity) {
        control.failNextActivity = false;
        await route.fulfill({
          status: 503,
          json: { code: "E2E_FIXTURE_FAILURE" },
        });
        return;
      }
      const cursor = new URL(route.request().url()).searchParams.get("cursor");
      await route.fulfill({ json: activityPage(cursor) });
    },
  );
  return control;
}

async function gotoCompletedTask(page: Page): Promise<FixtureControl> {
  const control = await installFixture(page);
  await page.goto(
    `/tasks?containerId=${fixture.containerId}&task=${fixture.completedTaskId}`,
  );
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(page.getByTestId("frozen-outcome")).toHaveText("已完成");
  await expect(page.getByRole("region", { name: "任务档案" })).toContainText(
    "E2E fixture",
  );
  return control;
}

async function capturePaneGeometry(page: Page) {
  return page.locator("[data-workbench-pane]").evaluateAll((panes) =>
    panes.map((pane) => {
      const box = pane.getBoundingClientRect();
      return {
        id: (pane as HTMLElement).dataset.workbenchPane ?? "",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }),
  );
}

async function expectCausalRegionOrder(page: Page): Promise<void> {
  const order = await page.locator(".workbench-layout").evaluate((layout) => {
    const selectors = [
      ".workbench-layout__header",
      ".workbench-layout__responsibility",
      ".workbench-layout__decision",
      '[data-workbench-pane="queue"]',
      '[data-workbench-pane="detail"]',
      '[data-workbench-pane="context"]',
    ];
    const children = Array.from(layout.querySelectorAll("*"));
    return selectors.map((selector) =>
      children.indexOf(layout.querySelector(selector) as Element),
    );
  });
  expect(order).toEqual(order.slice().sort((left, right) => left - right));
  expect(new Set(order).size).toBe(6);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const facts = await page.evaluate(() => {
    const measure = (element: Element | null) => {
      const target = element as HTMLElement | null;
      return {
        client: target?.clientWidth ?? 0,
        scroll: target?.scrollWidth ?? 0,
      };
    };
    return {
      document: measure(document.documentElement),
      appContent: measure(document.querySelector(".app-content")),
      panes: Array.from(document.querySelectorAll("[data-workbench-pane]")).map(
        (pane) => ({
          id: (pane as HTMLElement).dataset.workbenchPane ?? "",
          checkScrollOwner:
            matchMedia("(min-width: 681px)").matches ||
            (pane as HTMLElement).dataset.mobileActive === "true",
          ...measure(pane),
          scrollOwner: measure(
            pane.querySelector(".workbench-pane__scroll--independent"),
          ),
        }),
      ),
    };
  });

  expect(facts.document.scroll).toBeLessThanOrEqual(facts.document.client + 1);
  expect(facts.appContent.scroll).toBeLessThanOrEqual(
    facts.appContent.client + 1,
  );
  for (const pane of facts.panes) {
    expect(pane.scroll, `${pane.id} pane overflow`).toBeLessThanOrEqual(
      pane.client + 1,
    );
    if (pane.checkScrollOwner) {
      expect(
        pane.scrollOwner.scroll,
        `${pane.id} scroll owner overflow`,
      ).toBeLessThanOrEqual(pane.scrollOwner.client + 1);
    }
  }
}

test("1440 keeps the archive consumer in three stable read-only panes", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "1440 desktop evidence only");
  await gotoCompletedTask(page);

  await expect(page.getByRole("region", { name: "责任上下文" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "当前任务结论" }),
  ).toBeVisible();
  await expectCausalRegionOrder(page);
  const panes = page.locator("[data-workbench-pane]");
  await expect(panes).toHaveCount(3);
  expect(
    await panes.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-workbench-pane")),
    ),
  ).toEqual(["queue", "detail", "context"]);

  const completedGeometry = await capturePaneGeometry(page);
  expect(new Set(completedGeometry.map(({ y }) => Math.round(y))).size).toBe(1);
  expect(
    new Set(completedGeometry.map(({ height }) => Math.round(height))).size,
  ).toBe(1);
  await expect(page.getByTestId("actionable-count")).toHaveText("1");
  await expect(page.getByTestId("completed-count")).toHaveText("1");
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("这是该任务完成时形成的只读结果");
  await expect(page.getByRole("region", { name: "任务档案" })).toContainText(
    "当前身份可见来源",
  );
  await expect(
    page.getByRole("region", { name: "当前任务详情" }).getByRole("button", {
      name: /领取|完成工单|补证|异常上报|提交|同步中/,
    }),
  ).toHaveCount(0);

  await page.locator(`[data-task-id="${fixture.activeTaskId}"]`).click();
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("装箱完成");
  const activeGeometry = await capturePaneGeometry(page);
  expect(activeGeometry.map(({ id }) => id)).toEqual(
    completedGeometry.map(({ id }) => id),
  );
  activeGeometry.forEach((pane, index) => {
    expect(
      Math.abs(pane.width - completedGeometry[index]!.width),
    ).toBeLessThanOrEqual(1);
  });

  await page.locator(`[data-task-id="${fixture.completedTaskId}"]`).click();
  await expect(page.getByTestId("frozen-outcome")).toHaveText("已完成");
  await expect(page.getByRole("region", { name: "任务档案" })).toContainText(
    "原任务操作回执",
  );
  await expect(
    page.getByRole("region", { name: "责任上下文" }),
  ).not.toContainText(fixture.opaqueAssigneeId);
  await expect(
    page.getByText(fixture.opaqueAssigneeId, { exact: true }).first(),
  ).toBeHidden();
  await expect(
    page.getByText(fixture.internalDefinitionKey, { exact: true }),
  ).toBeHidden();
  await expect(
    page.getByText(fixture.internalActivityTitle, { exact: true }),
  ).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(
    "task-archive-completed.png",
    screenshotOptions,
  );
});

test("1024 keeps detail and archive adjacent while the queue uses an accessible drawer", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1024, "1024 narrow evidence only");
  const control = await gotoCompletedTask(page);
  const queueTrigger = page.getByRole("button", { name: "打开任务队列" });
  const detailPane = page.locator('[data-workbench-pane="detail"]');
  const contextPane = page.locator('[data-workbench-pane="context"]');

  await expect(queueTrigger).toBeVisible();
  const [detailBox, contextBox] = await Promise.all([
    detailPane.boundingBox(),
    contextPane.boundingBox(),
  ]);
  expect(
    Math.abs((detailBox?.y ?? 0) - (contextBox?.y ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(detailBox?.x ?? 0).toBeLessThan(contextBox?.x ?? 0);

  await queueTrigger.click();
  const drawer = page.getByRole("dialog", { name: "任务队列" });
  await expect(drawer).toBeVisible();
  await expect(detailPane).toHaveAttribute("inert", "");
  await expect(contextPane).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(queueTrigger).toBeFocused();

  await queueTrigger.click();
  await expect(drawer).toBeVisible();
  await page
    .getByRole("button", { name: "关闭任务队列抽屉", exact: true })
    .click();
  await expect(drawer).toBeHidden();
  await expect(queueTrigger).toBeFocused();

  await queueTrigger.click();
  await drawer.locator(`[data-task-id="${fixture.activeTaskId}"]`).click();
  await expect(drawer).toBeHidden();
  await expect(queueTrigger).toBeFocused();
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("装箱完成");
  await queueTrigger.click();
  await drawer.locator(`[data-task-id="${fixture.completedTaskId}"]`).click();
  await expect(drawer).toBeHidden();
  await expect(queueTrigger).toBeFocused();
  await expect(page.getByTestId("frozen-outcome")).toHaveText("已完成");

  control.failNextActivity = true;
  await page.getByTestId("archive-refresh").click();
  await expect(page.getByRole("alert")).toContainText("加载对象动态失败");
  expect(
    await page
      .getByRole("alert")
      .evaluate((element) => getComputedStyle(element).position),
  ).toBe("static");
  await expect(page.getByTestId("archive-retry")).toBeVisible();
  await page.getByTestId("archive-retry").click();
  await expect(page.getByTestId("archive-load-more")).toBeVisible();
  await page.getByTestId("archive-load-more").click();
  await expect(page.getByRole("region", { name: "原任务记录" })).toContainText(
    "更早的原任务记录",
  );
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(
    "task-archive-completed.png",
    screenshotOptions,
  );
});

test("390 uses explicit queue detail and archive screens with stable return state", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 390, "390 mobile evidence only");
  const control = await installFixture(page);
  await page.goto(`/tasks?containerId=${fixture.containerId}`);
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "当前任务结论" }),
  ).toContainText("办理中");
  await expectCausalRegionOrder(page);
  await expect(
    page.getByRole("navigation", { name: "工作台办理步骤" }),
  ).toContainText("队列详情档案");
  const queuePane = page.locator('[data-workbench-pane="queue"]');
  const detailPane = page.locator('[data-workbench-pane="detail"]');
  const contextPane = page.locator('[data-workbench-pane="context"]');
  await expect(queuePane).toHaveAttribute("data-mobile-active", "true");
  await expect(detailPane).not.toHaveAttribute("data-mobile-active", "true");
  await expect(contextPane).not.toHaveAttribute("data-mobile-active", "true");
  await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);

  await page.locator(`[data-task-id="${fixture.completedTaskId}"]`).click();
  await expect(detailPane).toHaveAttribute("data-mobile-active", "true");
  await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  await expect(page.getByTestId("frozen-outcome")).toHaveText("已完成");
  await expect(page.locator(".mobile-breadcrumb")).toContainText(
    `${fixture.containerNumber} · 清关`,
  );
  await expect(
    page.getByRole("region", { name: "当前任务详情" }).getByRole("button", {
      name: /领取|完成工单|补证|异常上报|提交|同步中/,
    }),
  ).toHaveCount(0);

  const detailFocus = page.getByRole("link", { name: "查看货柜档案" });
  const appContent = page.locator(".app-content");
  await detailFocus.focus();
  await appContent.evaluate((element) => {
    element.scrollTop = Math.min(
      120,
      element.scrollHeight - element.clientHeight,
    );
  });
  const detailScroll = await appContent.evaluate(
    (element) => element.scrollTop,
  );
  expect(detailScroll).toBeGreaterThan(0);

  await page.getByRole("button", { name: "档案", exact: true }).click();
  await expect(contextPane).toHaveAttribute("data-mobile-active", "true");
  await expect(detailPane).not.toHaveAttribute("data-mobile-active", "true");
  await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "任务档案" })).toContainText(
    "当前身份可见来源",
  );

  control.failNextActivity = true;
  await page.getByTestId("archive-refresh").click();
  await expect(page.getByRole("alert")).toContainText("加载对象动态失败");
  expect(
    await page
      .getByRole("alert")
      .evaluate((element) => getComputedStyle(element).position),
  ).toBe("static");
  await expect(page.getByTestId("archive-retry")).toBeVisible();
  await page.getByTestId("archive-retry").click();
  await expect(page.getByTestId("archive-load-more")).toBeVisible();

  control.holdNextActivity = true;
  await page.getByTestId("archive-load-more").click();
  const loadingState = page.getByText("正在读取档案…", { exact: true });
  await expect(loadingState).toBeVisible();
  expect(
    await loadingState.evaluate(
      (element) => getComputedStyle(element).position,
    ),
  ).toBe("static");
  await expect(
    page.getByRole("navigation", { name: "工作台办理步骤" }),
  ).toBeVisible();
  await expect.poll(() => control.releaseNextActivity !== null).toBe(true);
  control.releaseNextActivity?.();
  await expect(page.getByRole("region", { name: "原任务记录" })).toContainText(
    "更早的原任务记录",
  );
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(
    "task-archive-completed.png",
    screenshotOptions,
  );

  await page.getByRole("button", { name: "详情", exact: true }).click();
  await expect(detailPane).toHaveAttribute("data-mobile-active", "true");
  await expect(detailFocus).toBeFocused();
  await expect
    .poll(() => appContent.evaluate((element) => element.scrollTop))
    .toBe(detailScroll);

  await page.getByRole("button", { name: "队列", exact: true }).click();
  await page.locator(`[data-task-id="${fixture.activeTaskId}"]`).click();
  await expect(detailPane).toHaveAttribute("data-mobile-active", "true");
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("装箱完成");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(page.locator("[data-workbench-pane]")).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});
