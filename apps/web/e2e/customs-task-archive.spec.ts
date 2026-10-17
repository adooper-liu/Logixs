import { expect, test, type Page } from "@playwright/test";

// Synthetic, controlled E2E fixture data. It is not a real business sample.
const fixture = {
  firstContainerId: "e2e-customs-container-001",
  firstContainerNumber: "E2E-CUSTOMS-01",
  firstTaskId: "e2e-customs-task-001",
  firstOutcomeId: "e2e-customs-outcome-001",
  firstActivityText: "E2E 受控测试数据：货柜一原任务操作回执。",
  firstRelatedText: "E2E 受控测试数据：货柜一相关生命周期事实。",
  olderActivityText: "E2E 受控测试数据：货柜一更早的原任务记录。",
  secondContainerId: "e2e-customs-container-002",
  secondContainerNumber: "E2E-CUSTOMS-02",
  secondTaskId: "e2e-customs-task-002",
  secondActivityText: "E2E 受控测试数据：货柜二当前任务记录。",
  secondRelatedText: "E2E 受控测试数据：货柜二相关生命周期事实。",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
  threshold: 0.3,
};

interface ActivityFailure {
  readonly containerId: string;
  readonly status: number;
  readonly message: string;
}

interface FixtureControl {
  failNextActivity: ActivityFailure | null;
  holdNextActivityFor: string | null;
  releaseHeldActivity: (() => void) | null;
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    failNextActivity: null,
    holdNextActivityFor: null,
    releaseHeldActivity: null,
  };

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/containers") {
      await route.fulfill({ json: containerPage });
      return;
    }
    if (path === "/api/node-tasks") {
      await route.fulfill({
        json: taskPage(url.searchParams.get("containerId")),
      });
      return;
    }

    const containerId = containerIdFrom(path);
    if (!containerId) throw new Error(`Unhandled customs E2E path: ${path}`);

    if (path === `/api/containers/${containerId}`) {
      await route.fulfill({ json: containerFor(containerId) });
      return;
    }
    if (path.endsWith("/lifecycle-nodes")) {
      await route.fulfill({ json: lifecyclePage(containerId) });
      return;
    }
    if (path.endsWith("/customs-clearance-case")) {
      await route.fulfill({ json: null });
      return;
    }
    if (path.endsWith("/date-facts")) {
      await route.fulfill({ json: dateFactPage(containerId) });
      return;
    }
    if (path.endsWith("/activities")) {
      if (control.holdNextActivityFor === containerId) {
        control.holdNextActivityFor = null;
        await new Promise<void>((resolve) => {
          control.releaseHeldActivity = resolve;
        });
        control.releaseHeldActivity = null;
      }
      if (control.failNextActivity?.containerId === containerId) {
        const failure = control.failNextActivity;
        control.failNextActivity = null;
        await route.fulfill({
          status: failure.status,
          json: { message: failure.message },
        });
        return;
      }
      await route.fulfill({
        json: activityPage(containerId, url.searchParams.get("cursor")),
      });
      return;
    }

    throw new Error(`Unhandled customs E2E path: ${path}`);
  });

  return control;
}

async function gotoFirstTask(page: Page): Promise<FixtureControl> {
  const control = await installFixture(page);
  await page.goto("/workspaces/customs");
  await expect(page.getByRole("heading", { name: "进口清关" })).toBeVisible();
  await queueItem(page, fixture.firstContainerNumber).click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.firstContainerId}.*taskId=${fixture.firstTaskId}`,
    ),
  );
  await expect(page.getByRole("region", { name: "清关办理" })).toBeVisible();
  return control;
}

function queueItem(page: Page, containerNumber: string) {
  return page.locator(".queue-item").filter({ hasText: containerNumber });
}

function contextPane(page: Page) {
  return page.locator('[data-workbench-pane="context"]');
}

function contextScrollOwner(page: Page) {
  return contextPane(page).locator(".workbench-pane__scroll--independent");
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

async function expectPaneOrder(page: Page): Promise<void> {
  expect(
    await page
      .locator("[data-workbench-pane]")
      .evaluateAll((panes) =>
        panes.map((pane) => (pane as HTMLElement).dataset.workbenchPane ?? ""),
      ),
  ).toEqual(["queue", "detail", "context"]);
}

async function expectViewportGeometry(
  page: Page,
  actionGeometry: Awaited<ReturnType<typeof capturePaneGeometry>>,
): Promise<void> {
  const width = page.viewportSize()?.width;
  const archiveGeometry = await capturePaneGeometry(page);
  expect(archiveGeometry.map(({ id }) => id)).toEqual([
    "queue",
    "detail",
    "context",
  ]);
  archiveGeometry.forEach((pane, index) => {
    expect(
      Math.abs(pane.width - actionGeometry[index]!.width),
      `${pane.id} width changed between action and archive`,
    ).toBeLessThanOrEqual(1);
  });

  const [queue, detail, context] = archiveGeometry;
  if (!queue || !detail || !context) throw new Error("Missing workbench pane");

  if (width === 1440) {
    expect(Math.abs(queue.y - detail.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(detail.y - context.y)).toBeLessThanOrEqual(1);
    expect(queue.x).toBeLessThan(detail.x);
    expect(detail.x).toBeLessThan(context.x);
    return;
  }

  if (width === 1024) {
    const workspace = await page
      .locator(".workbench-layout__workspace")
      .boundingBox();
    expect(Math.abs(queue.y - detail.y)).toBeLessThanOrEqual(1);
    expect(queue.x).toBeLessThan(detail.x);
    expect(context.y).toBeGreaterThan(queue.y + 1);
    expect(Math.abs(context.x - (workspace?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(
      Math.abs(context.width - (workspace?.width ?? 0)),
    ).toBeLessThanOrEqual(1);
    return;
  }

  expect(queue.y).toBeLessThan(detail.y);
  expect(detail.y).toBeLessThan(context.y);
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
      panes: Array.from(document.querySelectorAll("[data-workbench-pane]")).map(
        (pane) => ({
          id: (pane as HTMLElement).dataset.workbenchPane ?? "",
          ...measure(pane),
          scrollOwner: measure(
            pane.querySelector(".workbench-pane__scroll--independent"),
          ),
        }),
      ),
    };
  });

  expect(facts.document.scroll).toBeLessThanOrEqual(facts.document.client + 1);
  for (const pane of facts.panes) {
    expect(pane.scroll, `${pane.id} pane overflow`).toBeLessThanOrEqual(
      pane.client + 1,
    );
    expect(
      pane.scrollOwner.scroll,
      `${pane.id} scroll owner overflow`,
    ).toBeLessThanOrEqual(pane.scrollOwner.client + 1);
  }
}

test("customs workbench preserves the context empty state without a selection", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/workspaces/customs");

  await expect(page.getByRole("heading", { name: "进口清关" })).toBeVisible();
  await expect(contextPane(page)).toContainText("选择对象后显示动作。");
  await expect(page.getByLabel("右栏模式")).toHaveCount(0);
  await expect(page.getByLabel("当前清关上下文")).toHaveCount(0);
  await expect(page.getByLabel("清关案件表单")).toHaveCount(0);
  await expect(page.locator(".task-archive")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("customs archive preserves action state and proves the stacked viewport", async ({
  page,
}) => {
  const control = await gotoFirstTask(page);
  const countryInput = page.getByLabel("进口国/地区代码");
  const actionButton = page.getByTestId("context-mode-action");
  const archiveButton = page.getByTestId("context-mode-archive");
  const actionPanel = page.getByTestId("customs-action-mode");
  const customsContextAnchor = page.getByLabel("当前清关上下文");
  const responsibility = page.getByRole("region", {
    name: "岗位与货柜范围",
  });

  await expect(actionButton).toHaveAttribute("aria-pressed", "true");
  await expect(archiveButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".task-archive")).toHaveCount(0);
  await expect(responsibility).toContainText("进口清关");
  await expect(responsibility).toContainText(fixture.firstContainerNumber);
  await expect(queueItem(page, fixture.firstContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
  await expect(page.getByText(/完成工单只记录清关岗位工作/)).toContainText(
    "不等于海关放行或流程过站",
  );
  await expectPaneOrder(page);

  const actionGeometry = await capturePaneGeometry(page);
  await countryInput.fill("US");
  await countryInput.focus();
  const savedScroll = await contextScrollOwner(page).evaluate((element) => {
    const target = element as HTMLElement;
    target.scrollTop = Math.min(128, target.scrollHeight - target.clientHeight);
    return target.scrollTop;
  });

  await archiveButton.focus();
  await page.keyboard.press("Enter");
  const archiveRegion = page.getByRole("region", {
    name: "当前可见任务档案",
  });
  await expect(archiveRegion).toBeVisible();
  await expect(archiveButton).toHaveAttribute("aria-pressed", "true");
  await expect(actionPanel).toBeHidden();
  await expect(actionPanel).toHaveAttribute("inert", "");
  await expect(countryInput).toBeHidden();
  if (page.viewportSize()?.width === 390) {
    await expect(customsContextAnchor).toBeVisible();
  } else {
    await expect(customsContextAnchor).toBeHidden();
  }

  await expect(responsibility).toContainText(fixture.firstContainerNumber);
  await expect(queueItem(page, fixture.firstContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
  await expect(page.getByTestId("archive-outcome")).toHaveText("已完成");
  await expect(page.getByRole("region", { name: "原任务记录" })).toContainText(
    fixture.firstActivityText,
  );
  await expect(
    page.getByRole("region", { name: "相关对象事实" }),
  ).toContainText(fixture.firstRelatedText);
  await expect(archiveRegion).toContainText("当前身份可见来源");
  await expect(archiveRegion).toContainText("当前身份的有界视图");
  await expect(archiveRegion).toContainText("正式责任交接快照未接通");
  await expect(archiveRegion).toContainText("协作和 AI 轨道未接通");
  await expect(page.getByText("完整清关案件历史", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("正式责任交接已接通", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("任务完成等于海关放行", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /聊天|协作|AI|助手|更多功能/ }),
  ).toHaveCount(0);

  const nextActions = page.getByRole("region", {
    name: "当前可见后续办理",
  });
  await expect(nextActions).toContainText("领取工单");
  await expectViewportGeometry(page, actionGeometry);
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await contextScrollOwner(page).evaluate((element) => {
    element.scrollTop = 0;
  });
  await contextPane(page).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
    element.scrollTop = 0;
  });
  const evidencePosition = await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>(
      '[data-workbench-pane="context"]',
    );
    const header = pane?.querySelector<HTMLElement>(".workbench-pane__header");
    const archiveButton = pane?.querySelector<HTMLElement>(
      '[data-testid="context-mode-archive"]',
    );
    return {
      paneTop: pane?.getBoundingClientRect().top ?? -1,
      headerTop: header?.getBoundingClientRect().top ?? -1,
      archiveButtonBottom:
        archiveButton?.getBoundingClientRect().bottom ?? Number.MAX_VALUE,
    };
  });
  expect(evidencePosition.headerTop).toBeGreaterThanOrEqual(
    evidencePosition.paneTop - 1,
  );
  expect(evidencePosition.archiveButtonBottom).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );
  if (page.viewportSize()?.width === 390) {
    await expect(customsContextAnchor).toContainText(
      `当前货柜：${fixture.firstContainerNumber}`,
    );
    await expect(customsContextAnchor).toContainText("当前任务：清关任务");
    await expect(customsContextAnchor).toContainText("当前节点：07 清关");
    const anchorPosition = await page.evaluate(() => {
      const modes = document.querySelector<HTMLElement>(
        '[aria-label="右栏模式"]',
      );
      const anchor = document.querySelector<HTMLElement>(
        '[aria-label="当前清关上下文"]',
      );
      const archive = document.querySelector<HTMLElement>(".task-archive");
      const modesBox = modes?.getBoundingClientRect();
      const anchorBox = anchor?.getBoundingClientRect();
      const archiveBox = archive?.getBoundingClientRect();
      return {
        modesBottom: modesBox?.bottom ?? Number.MAX_VALUE,
        anchorTop: anchorBox?.top ?? -1,
        anchorBottom: anchorBox?.bottom ?? Number.MAX_VALUE,
        archiveTop: archiveBox?.top ?? -1,
      };
    });
    expect(anchorPosition.anchorTop).toBeGreaterThanOrEqual(
      anchorPosition.modesBottom - 1,
    );
    expect(anchorPosition.archiveTop).toBeGreaterThanOrEqual(
      anchorPosition.anchorBottom - 1,
    );
  }
  const viewportWidth = page.viewportSize()?.width;
  await expect(page).toHaveScreenshot("customs-task-archive.png", {
    ...screenshotOptions,
    maxDiffPixelRatio:
      viewportWidth === 390 ? 0.05 : screenshotOptions.maxDiffPixelRatio,
  });

  await archiveButton.focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(
        document.activeElement?.closest('[data-testid="customs-action-mode"]'),
      ),
    ),
  ).toBe(false);

  control.failNextActivity = {
    containerId: fixture.firstContainerId,
    status: 403,
    message: "E2E_ACTIVITY_FORBIDDEN",
  };
  await page.getByTestId("archive-refresh").click();
  await expect(page.getByRole("alert")).toContainText(
    "加载对象动态失败（403）：E2E_ACTIVITY_FORBIDDEN",
  );
  await expect(page.getByText(fixture.firstActivityText)).toHaveCount(0);
  await expect(page.getByText(fixture.firstRelatedText)).toHaveCount(0);
  await expect(page.getByTestId("archive-retry")).toBeVisible();
  await page.getByTestId("archive-retry").click();
  await expect(page.getByText(fixture.firstActivityText)).toBeVisible();
  await expect(page.getByTestId("archive-load-more")).toBeVisible();
  await expect(nextActions).toContainText("领取工单");

  await page.getByTestId("archive-load-more").click();
  await expect(page.getByRole("region", { name: "原任务记录" })).toContainText(
    fixture.olderActivityText,
  );
  await expect(nextActions).toContainText("领取工单");

  await actionButton.click();
  await expect(countryInput).toBeVisible();
  await expect(countryInput).toHaveValue("US");
  await expect(countryInput).toBeFocused();
  if (savedScroll > 0) {
    await expect
      .poll(() =>
        contextScrollOwner(page).evaluate((element) => element.scrollTop),
      )
      .toBe(savedScroll);
  }
  await expect(responsibility).toContainText(fixture.firstContainerNumber);
  await expect(queueItem(page, fixture.firstContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
  await expect(page.getByText(/完成工单只记录清关岗位工作/)).toContainText(
    "不等于海关放行或流程过站",
  );
});

test("customs archive drops stale object data and ignores a late response", async ({
  page,
}) => {
  const control = await gotoFirstTask(page);
  const customsContextAnchor = page.getByLabel("当前清关上下文");
  await expect(customsContextAnchor).toContainText(
    fixture.firstContainerNumber,
  );
  await page.getByTestId("context-mode-archive").click();
  await expect(page.getByText(fixture.firstActivityText)).toBeVisible();

  control.holdNextActivityFor = fixture.firstContainerId;
  await page.getByTestId("archive-refresh").click();
  await expect(page.getByText("正在读取档案…", { exact: true })).toBeVisible();
  await expect.poll(() => control.releaseHeldActivity !== null).toBe(true);

  await queueItem(page, fixture.secondContainerNumber).click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.secondContainerId}.*taskId=${fixture.secondTaskId}`,
    ),
  );
  await expect(page.getByText(fixture.firstActivityText)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "清关办理" })).toBeVisible();
  await expect(queueItem(page, fixture.secondContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
  await expect(customsContextAnchor).toContainText(
    fixture.secondContainerNumber,
  );
  await expect(customsContextAnchor).toContainText("清关任务");
  await expect(customsContextAnchor).toContainText("07 清关");
  await expect(customsContextAnchor).not.toContainText(
    fixture.firstContainerNumber,
  );

  await page.getByTestId("context-mode-archive").click();
  await expect(page.getByText(fixture.secondActivityText)).toBeVisible();
  await expect(page.getByText(fixture.secondRelatedText)).toBeVisible();
  await expect(page.getByTestId("archive-outcome")).toHaveText("尚无正式结果");
  await expect(page.getByText(fixture.firstActivityText)).toHaveCount(0);
  await expect(page.getByText(fixture.firstRelatedText)).toHaveCount(0);

  control.releaseHeldActivity?.();
  await expect.poll(() => control.releaseHeldActivity).toBeNull();
  await expect(page.getByText(fixture.secondActivityText)).toBeVisible();
  await expect(page.getByText(fixture.firstActivityText)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

function containerIdFrom(path: string): string | null {
  const match = path.match(/^\/api\/containers\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function containerFor(containerId: string) {
  const first = containerId === fixture.firstContainerId;
  return {
    id: containerId,
    orderNumber: first ? "E2E-ORDER-01" : "E2E-ORDER-02",
    containerNumber: first
      ? fixture.firstContainerNumber
      : fixture.secondContainerNumber,
    currentStatus: "at_port",
    updatedAt: "2026-10-17T08:00:00.000Z",
  };
}

const containerPage = {
  items: [
    containerFor(fixture.firstContainerId),
    containerFor(fixture.secondContainerId),
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-10-17T09:00:00.000Z",
  projectionVersion: 7,
};

function taskPage(containerId: string | null) {
  const tasks = [firstTask, secondTask];
  return {
    items: containerId
      ? tasks.filter((task) => task.containerId === containerId)
      : tasks,
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-17T09:00:00.000Z",
    projectionVersion: 12,
  };
}

const firstTask = {
  id: fixture.firstTaskId,
  flowInstanceId: "e2e-customs-flow-001",
  nodeInstanceId: "e2e-customs-node-001",
  nodeCode: "customs_clearance",
  containerId: fixture.firstContainerId,
  taskDefinitionKey: "node-customs-clearance",
  state: "completed",
  applicability: "required",
  readinessState: "ready",
  completionEligibility: "eligible",
  conditionFactRefs: [],
  workOrders: [
    {
      id: "e2e-customs-work-order-001",
      workOrderDefinitionKey: "customs-clearance",
      state: "completed",
      assignmentState: "assigned",
      assigneeId: "e2e-customs-operator",
      dueAt: "2026-10-17T08:30:00.000Z",
      completedAt: "2026-10-17T08:20:00.000Z",
    },
  ],
  outcome: {
    id: fixture.firstOutcomeId,
    previousState: "in_progress",
    nextState: "completed",
    resultPolicyMode: "all_required_work_orders_completed",
    eventCode: null,
    requiredWorkOrderIds: ["e2e-customs-work-order-001"],
    completedWorkOrderIds: ["e2e-customs-work-order-001"],
    evaluatedAt: "2026-10-17T08:20:00.000Z",
  },
  nextAction: null,
};

const secondTask = {
  id: fixture.secondTaskId,
  flowInstanceId: "e2e-customs-flow-002",
  nodeInstanceId: "e2e-customs-node-002",
  nodeCode: "customs_clearance",
  containerId: fixture.secondContainerId,
  taskDefinitionKey: "node-customs-clearance",
  state: "pending",
  applicability: "required",
  readinessState: "ready",
  completionEligibility: "eligible",
  conditionFactRefs: [],
  workOrders: [],
  outcome: null,
  nextAction: {
    actionCode: "work_execution.claim_work_order",
    workOrderId: "e2e-customs-work-order-002",
    workOrderDefinitionKey: "customs-clearance",
    assignmentState: "pool",
    assigneeId: null,
    dueAt: null,
  },
};

function lifecyclePage(containerId: string) {
  const first = containerId === fixture.firstContainerId;
  return {
    flow: {
      id: first ? "e2e-customs-flow-001" : "e2e-customs-flow-002",
      state: "active",
      currentNodeCode: "customs_clearance",
      version: first ? 5 : 6,
    },
    nodes: [
      {
        nodeInstanceId: first ? "e2e-customs-node-001" : "e2e-customs-node-002",
        nodeCode: "customs_clearance",
        sequence: 7,
        state: "active",
        applicability: "required",
        completedAt: null,
        blockedReasonRefs: [],
        isCurrent: true,
        times: { plannedAt: null, estimatedAt: null, actualAt: null },
      },
    ],
    asOf: "2026-10-17T09:00:00.000Z",
    projectionVersion: first ? 5 : 6,
  };
}

function dateFactPage(containerId: string) {
  return {
    items: [
      {
        factId: `${containerId}-arrival-fact`,
        nodeCode: "destination_arrival",
        eventCode: "arrived",
        timeKind: "actual",
        occurredAt: "2026-10-17T07:30:00.000Z",
        rawValue: "2026-10-17 15:30",
        sourceUtcOffset: "+08:00",
        ingestionChannel: "api",
        captureSource: "external_evidence",
        sourceSystem: "e2e-controlled-fixture",
        authoritySystem: "terminal",
        verificationState: "verified",
        confidenceState: "confirmed",
        validity: "effective",
        authorityPolicyRef: "arrival:e2e",
        evidenceRefs: ["e2e-controlled-evidence"],
        applicationState: "pending_application",
        applicationReasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
        canonicalEventId: null,
        projectionVersion: 1,
        recordedAt: "2026-10-17T07:31:00.000Z",
      },
    ],
    projectionVersion: 1,
    asOf: "2026-10-17T09:00:00.000Z",
  };
}

function activityPage(containerId: string, cursor: string | null) {
  const first = containerId === fixture.firstContainerId;
  const asOf = first ? "2026-10-17T09:00:00.000Z" : "2026-10-17T09:05:00.000Z";
  const projectionVersion = first ? 31 : 32;
  if (cursor) {
    return {
      items: first ? [olderActivity] : [],
      nextActions: [],
      pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
      asOf,
      projectionVersion,
    };
  }

  return {
    items: first
      ? [firstTaskActivity, firstRelatedActivity]
      : [secondTaskActivity, secondRelatedActivity],
    nextActions: first
      ? [
          {
            actionCode: "work_execution.claim_work_order",
            containerId: fixture.secondContainerId,
            taskId: fixture.secondTaskId,
            workOrderId: "e2e-customs-work-order-002",
            nodeCode: "customs_clearance",
            taskDefinitionKey: "node-customs-clearance",
            workOrderDefinitionKey: "customs-clearance",
            assignmentState: "pool",
            assigneeId: null,
            dueAt: null,
            targetPath: `/tasks?containerId=${fixture.secondContainerId}&task=${fixture.secondTaskId}`,
          },
        ]
      : [],
    pageInfo: {
      nextCursor: first ? "e2e-customs-older-page" : null,
      hasNextPage: first,
      pageSize: 25,
    },
    asOf,
    projectionVersion,
  };
}

const firstTaskActivity = {
  id: "e2e-customs-activity-task-001",
  activityCode: "work_order_completed",
  sourceType: "client_operation",
  sourceId: "e2e-customs-operation-001",
  occurredAt: "2026-10-17T08:19:00.000Z",
  recordedAt: "2026-10-17T08:20:00.000Z",
  containerId: fixture.firstContainerId,
  taskId: fixture.firstTaskId,
  workOrderId: "e2e-customs-work-order-001",
  actorId: "e2e-customs-operator",
  nodeCode: "customs_clearance",
  title: "controlled-e2e-operation",
  detail: fixture.firstActivityText,
  severity: null,
  targetPath: null,
};

const firstRelatedActivity = {
  id: "e2e-customs-activity-related-001",
  activityCode: "lifecycle_event_recorded",
  sourceType: "canonical_event",
  sourceId: "e2e-customs-event-001",
  occurredAt: "2026-10-17T08:21:00.000Z",
  recordedAt: "2026-10-17T08:22:00.000Z",
  containerId: fixture.firstContainerId,
  taskId: null,
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: "container_customs_completed",
  detail: fixture.firstRelatedText,
  severity: null,
  targetPath: null,
};

const olderActivity = {
  id: "e2e-customs-activity-older-001",
  activityCode: "task_created",
  sourceType: "node_task",
  sourceId: "e2e-customs-task-record-001",
  occurredAt: "2026-10-17T08:00:00.000Z",
  recordedAt: "2026-10-17T08:01:00.000Z",
  containerId: fixture.firstContainerId,
  taskId: fixture.firstTaskId,
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: "controlled-e2e-task",
  detail: fixture.olderActivityText,
  severity: null,
  targetPath: null,
};

const secondTaskActivity = {
  id: "e2e-customs-activity-task-002",
  activityCode: "task_created",
  sourceType: "node_task",
  sourceId: "e2e-customs-task-record-002",
  occurredAt: "2026-10-17T08:30:00.000Z",
  recordedAt: "2026-10-17T08:31:00.000Z",
  containerId: fixture.secondContainerId,
  taskId: fixture.secondTaskId,
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: "controlled-e2e-task",
  detail: fixture.secondActivityText,
  severity: null,
  targetPath: null,
};

const secondRelatedActivity = {
  id: "e2e-customs-activity-related-002",
  activityCode: "lifecycle_event_recorded",
  sourceType: "canonical_event",
  sourceId: "e2e-customs-event-002",
  occurredAt: "2026-10-17T08:32:00.000Z",
  recordedAt: "2026-10-17T08:33:00.000Z",
  containerId: fixture.secondContainerId,
  taskId: null,
  workOrderId: null,
  actorId: null,
  nodeCode: "customs_clearance",
  title: "container_customs_completed",
  detail: fixture.secondRelatedText,
  severity: null,
  targetPath: null,
};
