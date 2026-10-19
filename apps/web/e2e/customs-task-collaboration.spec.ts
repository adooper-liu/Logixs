import { expect, test, type Page, type Route } from "@playwright/test";

// Synthetic, controlled E2E fixture data. It is not a real business sample.
const fixture = {
  activeContainerId: "11111111-1111-4111-8111-111111111111",
  activeContainerNumber: "E2E-CUSTOMS-COLLAB-01",
  activeTaskId: "22222222-2222-4222-8222-222222222222",
  completedContainerId: "33333333-3333-4333-8333-333333333333",
  completedContainerNumber: "E2E-CUSTOMS-COLLAB-02",
  completedTaskId: "44444444-4444-4444-8444-444444444444",
  noTaskContainerId: "55555555-5555-4555-8555-555555555555",
  noTaskContainerNumber: "E2E-CUSTOMS-NO-TASK",
  actorId: "customs-e2e-operator",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.04,
  scale: "css" as const,
  threshold: 0.3,
};

interface FixtureControl {
  gets: string[];
  posts: Array<Record<string, unknown>>;
  failNextPostStatus: number | null;
  holdPostFor: string | null;
  releasePost: (() => void) | null;
  holdGetFor: string | null;
  releaseGet: (() => void) | null;
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    gets: [],
    posts: [],
    failNextPostStatus: null,
    holdPostFor: null,
    releasePost: null,
    holdGetFor: null,
    releaseGet: null,
  };

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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

    const taskMatch = path.match(
      /^\/api\/node-tasks\/([^/]+)\/collaboration(?:\/messages)?$/,
    );
    if (taskMatch?.[1]) {
      const taskId = decodeURIComponent(taskMatch[1]);
      if (path.endsWith("/messages")) {
        await handlePost(route, taskId, control);
      } else {
        await handleGet(route, taskId, control, url);
      }
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
      await route.fulfill({ json: dateFactPage });
      return;
    }
    if (path.endsWith("/activities")) {
      await route.fulfill({ json: activityPage(containerId) });
      return;
    }
    throw new Error(`Unhandled customs E2E path: ${path}`);
  });

  return control;
}

async function handleGet(
  route: Route,
  taskId: string,
  control: FixtureControl,
  url: URL,
): Promise<void> {
  const expectedContainerId =
    taskId === fixture.activeTaskId
      ? fixture.activeContainerId
      : fixture.completedContainerId;
  expect(url.searchParams.get("subjectKind")).toBe("container");
  expect(url.searchParams.get("subjectId")).toBe(expectedContainerId);
  control.gets.push(taskId);
  if (control.holdGetFor === taskId) {
    control.holdGetFor = null;
    await new Promise<void>((resolve) => {
      control.releaseGet = resolve;
    });
    control.releaseGet = null;
  }
  await route.fulfill({
    json: collaborationPage(taskId, url.searchParams.get("cursor")),
  });
}

async function handlePost(
  route: Route,
  taskId: string,
  control: FixtureControl,
): Promise<void> {
  const command = route.request().postDataJSON() as Record<string, unknown>;
  control.posts.push(command);
  if (control.holdPostFor === taskId) {
    control.holdPostFor = null;
    await new Promise<void>((resolve) => {
      control.releasePost = resolve;
    });
    control.releasePost = null;
  }
  if (control.failNextPostStatus !== null) {
    const status = control.failNextPostStatus;
    control.failNextPostStatus = null;
    await route.fulfill({
      status,
      json: {
        message:
          status === 503
            ? "CUSTOMS_COLLABORATION_POST_FAILED"
            : `POST_${status}`,
      },
    });
    return;
  }
  await route.fulfill({
    json: {
      contractVersion: "task-collaboration-post-result.v1",
      message: collaborationMessage(
        "66666666-6666-4666-8666-666666666666",
        String(command.body),
      ),
      idempotencyReplay: false,
    },
  });
}

async function gotoActiveTask(page: Page): Promise<FixtureControl> {
  const control = await installFixture(page);
  await page.goto("/workspaces/customs");
  await expect(page.getByRole("heading", { name: "进口清关" })).toBeVisible();
  await queueItem(page, fixture.activeContainerNumber).click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.activeContainerId}.*taskId=${fixture.activeTaskId}`,
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

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    panes: Array.from(
      document.querySelectorAll<HTMLElement>("[data-workbench-pane]"),
    ).map((pane) => ({
      id: pane.dataset.workbenchPane,
      client: pane.clientWidth,
      scroll: pane.scrollWidth,
    })),
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  for (const pane of widths.panes) {
    expect(pane.scroll, `${pane.id} pane overflow`).toBeLessThanOrEqual(
      pane.client + 1,
    );
  }
}

async function expectNoNestedVerticalOwner(page: Page): Promise<void> {
  const offenders = await contextPane(page).evaluate((pane) =>
    Array.from(pane.querySelectorAll<HTMLElement>("*")).flatMap((element) => {
      if (element.classList.contains("workbench-pane__scroll--independent")) {
        return [];
      }
      const style = getComputedStyle(element);
      return /auto|scroll/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1
        ? [element.className || element.tagName.toLowerCase()]
        : [];
    }),
  );
  expect(offenders).toEqual([]);
}

async function expectPaneOrder(page: Page): Promise<void> {
  const panes = await page
    .locator("[data-workbench-pane]")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return {
          id: (item as HTMLElement).dataset.workbenchPane,
          x: box.x,
          y: box.y,
        };
      }),
    );
  const queue = panes.find(({ id }) => id === "queue");
  const detail = panes.find(({ id }) => id === "detail");
  const context = panes.find(({ id }) => id === "context");
  expect(queue).toBeTruthy();
  expect(detail).toBeTruthy();
  expect(context).toBeTruthy();
  const width = page.viewportSize()?.width;
  if (width === 1440) {
    expect(queue!.x).toBeLessThan(detail!.x);
    expect(detail!.x).toBeLessThan(context!.x);
  } else if (width === 1024) {
    expect(queue!.x).toBeLessThan(detail!.x);
    expect(context!.y).toBeGreaterThan(detail!.y);
  } else {
    expect(queue!.y).toBeLessThan(detail!.y);
    expect(detail!.y).toBeLessThan(context!.y);
  }
}

test("customs consumes shared work, archive, and collaboration modes in every viewport", async ({
  page,
}) => {
  const control = await gotoActiveTask(page);
  const workButton = page.getByRole("button", { name: "办理", exact: true });
  const archiveButton = page.getByRole("button", { name: "档案", exact: true });
  const collaborationButton = page.getByRole("button", {
    name: "协作",
    exact: true,
  });
  const countryInput = page.getByLabel("进口国/地区代码");
  const scrollOwner = contextScrollOwner(page);

  await expect(workButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => control.gets).toEqual([fixture.activeTaskId]);
  await countryInput.fill("US");
  await countryInput.focus();
  const workScroll = await scrollOwner.evaluate((element) => {
    const target = element as HTMLElement;
    target.scrollTop = Math.min(96, target.scrollHeight - target.clientHeight);
    return target.scrollTop;
  });

  await archiveButton.click();
  await expect(page.locator('[data-context-mode="work"]')).toHaveAttribute(
    "inert",
    "",
  );
  await expect(page.getByTestId("archive-refresh")).toBeVisible();
  await page.getByTestId("archive-refresh").focus();

  await collaborationButton.click();
  await expect(page.locator('[data-context-mode="archive"]')).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.getByText("清关协作：请核对当前申报事实")).toBeVisible();
  await page.getByRole("button", { name: "回复", exact: true }).click();
  await expect(page.getByTestId("replying-to")).toContainText(
    "清关协作：请核对当前申报事实",
  );
  await page.getByTestId("cancel-reply").click();
  await expect(page.getByTestId("replying-to")).toHaveCount(0);
  await page.getByTestId("collaboration-load-more").click();
  await expect(page.getByText("更早的清关协作记录")).toBeVisible();
  await page.getByLabel("协作消息").fill("回到办理前保留的协作草稿");
  await expect(page.getByLabel("当前清关上下文")).toContainText(
    fixture.activeContainerNumber,
  );
  await expectPaneOrder(page);
  await expectNoHorizontalOverflow(page);
  await expectNoNestedVerticalOwner(page);

  await expect(page).toHaveScreenshot("customs-task-collaboration.png", {
    ...screenshotOptions,
    fullPage: true,
    maxDiffPixelRatio:
      page.viewportSize()?.width === 390
        ? 0.06
        : screenshotOptions.maxDiffPixelRatio,
  });

  control.failNextPostStatus = 503;
  await page.getByTestId("collaboration-send").click();
  await expect(page.getByTestId("send-error")).toContainText(
    "CUSTOMS_COLLABORATION_POST_FAILED",
  );
  const firstCommand = control.posts[0];
  await page.getByTestId("collaboration-send-retry").click();
  await expect(page.getByTestId("send-error")).toHaveCount(0);
  expect(control.posts).toHaveLength(2);
  expect(control.posts[1]).toEqual(firstCommand);

  await workButton.click();
  await expect(countryInput).toHaveValue("US");
  await expect(countryInput).toBeFocused();
  if (workScroll > 0) {
    await expect
      .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
      .toBe(workScroll);
  }
  await expect(queueItem(page, fixture.activeContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
});

test("customs POST 404 clears stale collaboration and pending retry", async ({
  page,
}) => {
  const control = await gotoActiveTask(page);
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("清关协作：请核对当前申报事实")).toBeVisible();
  await page.getByRole("button", { name: "回复", exact: true }).click();
  await page.getByLabel("协作消息").fill("任务撤销后不得保留");

  control.failNextPostStatus = 404;
  await page.getByTestId("collaboration-send").click();

  await expect(page.getByRole("alert")).toContainText("重新读取");
  await expect(page.getByText("清关协作：请核对当前申报事实")).toHaveCount(0);
  await expect(page.getByTestId("replying-to")).toHaveCount(0);
  await expect(page.getByLabel("协作消息")).toHaveCount(0);
  await expect(page.getByTestId("collaboration-send-retry")).toHaveCount(0);
  expect(control.posts).toHaveLength(1);
});

test("customs clears switched collaboration, ignores late requests, and has a work-only no-task state", async ({
  page,
}) => {
  const control = await gotoActiveTask(page);
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("清关协作：请核对当前申报事实")).toBeVisible();
  control.holdPostFor = fixture.activeTaskId;
  await page.getByLabel("协作消息").fill("旧任务晚到内容");
  await page.getByTestId("collaboration-send").click();
  await expect.poll(() => control.releasePost !== null).toBe(true);

  control.holdGetFor = fixture.completedTaskId;
  await queueItem(page, fixture.completedContainerNumber).click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.completedContainerId}.*taskId=${fixture.completedTaskId}`,
    ),
  );
  await expect(
    page.getByRole("button", { name: "办理", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("清关协作：请核对当前申报事实")).toHaveCount(0);
  await expect.poll(() => control.releaseGet !== null).toBe(true);

  control.releasePost?.();
  control.releaseGet?.();
  await expect.poll(() => control.releasePost).toBeNull();
  await expect.poll(() => control.releaseGet).toBeNull();
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("已完成清关任务的历史协作")).toBeVisible();
  await expect(page.getByText("任务已完成，只能查看历史协作。")).toBeVisible();
  await expect(page.getByLabel("协作消息")).toHaveCount(0);
  await expect(page.getByText("旧任务晚到内容")).toHaveCount(0);

  const getCount = control.gets.length;
  await page.goto(
    `/workspaces/customs?containerId=${fixture.noTaskContainerId}`,
  );
  await expect(page.getByLabel("当前清关上下文")).toContainText(
    "清关任务待选择",
  );
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "办理", exact: true }),
  ).toBeVisible();
  await expect.poll(() => control.gets.length).toBe(getCount);
  await expectNoHorizontalOverflow(page);
});

function containerIdFrom(path: string): string | null {
  const match = path.match(/^\/api\/containers\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function containerFor(containerId: string) {
  const values: Record<string, string> = {
    [fixture.activeContainerId]: fixture.activeContainerNumber,
    [fixture.completedContainerId]: fixture.completedContainerNumber,
    [fixture.noTaskContainerId]: fixture.noTaskContainerNumber,
  };
  return {
    id: containerId,
    orderNumber: `E2E-ORDER-${containerId.slice(0, 4)}`,
    containerNumber: values[containerId],
    currentStatus: "at_port",
    updatedAt: "2026-10-19T08:00:00.000Z",
  };
}

const containerPage = {
  items: [
    containerFor(fixture.activeContainerId),
    containerFor(fixture.completedContainerId),
    containerFor(fixture.noTaskContainerId),
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-10-19T08:30:00.000Z",
  projectionVersion: 3,
};

function taskPage(containerId: string | null) {
  const items = [activeTask, completedTask];
  return {
    items: containerId
      ? items.filter((task) => task.containerId === containerId)
      : items,
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-19T08:30:00.000Z",
    projectionVersion: 3,
  };
}

const activeTask = taskFixture(
  fixture.activeTaskId,
  fixture.activeContainerId,
  "in_progress",
);
const completedTask = taskFixture(
  fixture.completedTaskId,
  fixture.completedContainerId,
  "completed",
);

function taskFixture(taskId: string, containerId: string, state: string) {
  return {
    id: taskId,
    flowInstanceId: `${taskId}-flow`,
    nodeInstanceId: `${taskId}-node`,
    nodeCode: "customs_clearance",
    containerId,
    taskDefinitionKey: "node-customs-clearance",
    state,
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction:
      state === "completed"
        ? null
        : {
            actionCode: "work_execution.claim_work_order",
            workOrderId: `${taskId}-work-order`,
            workOrderDefinitionKey: "customs-clearance",
            assignmentState: "pool",
            assigneeId: null,
            dueAt: null,
          },
  };
}

function lifecyclePage(containerId: string) {
  return {
    flow: {
      id: `${containerId}-flow`,
      state: "active",
      currentNodeCode: "customs_clearance",
      version: 1,
    },
    nodes: [
      {
        nodeInstanceId: `${containerId}-node`,
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
    asOf: "2026-10-19T08:30:00.000Z",
    projectionVersion: 1,
  };
}

const dateFactPage = {
  items: [],
  projectionVersion: 0,
  asOf: "2026-10-19T08:30:00.000Z",
};

function activityPage(containerId: string) {
  return {
    items: [],
    nextActions: [],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
    asOf: "2026-10-19T08:30:00.000Z",
    projectionVersion: containerId === fixture.activeContainerId ? 1 : 2,
  };
}

function collaborationPage(taskId: string, cursor: string | null) {
  const completed = taskId === fixture.completedTaskId;
  const containerId = completed
    ? fixture.completedContainerId
    : fixture.activeContainerId;
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: { kind: "container", id: containerId },
    workRef: { kind: "node_task", id: taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: cursor
      ? [
          collaborationMessage(
            "10101010-1010-4010-8010-101010101010",
            "更早的清关协作记录",
          ),
        ]
      : [
          collaborationMessage(
            completed
              ? "77777777-7777-4777-8777-777777777777"
              : "88888888-8888-4888-8888-888888888888",
            completed
              ? "已完成清关任务的历史协作"
              : "清关协作：请核对当前申报事实",
          ),
        ],
    asOf: "2026-10-19T08:30:00.000Z",
    pageSize: 25,
    nextCursor: !completed && !cursor ? "older-page" : null,
    canPost: !completed,
    postDisabledReason: completed ? "任务已完成，只能查看历史协作。" : null,
    mentionOptions: completed
      ? []
      : [
          {
            kind: "actor",
            id: fixture.actorId,
            displayName: "清关经办",
          },
        ],
    evidenceOptions: [],
  };
}

function collaborationMessage(messageId: string, body: string) {
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId,
    threadId: "99999999-9999-4999-8999-999999999999",
    author: {
      kind: "actor",
      id: fixture.actorId,
      displayName: "清关经办",
    },
    body,
    parentMessageId: null,
    mentions: [],
    evidenceRefs: [],
    sourceRefs: [],
    occurredAt: "2026-10-19T08:01:00.000Z",
    recordedAt: "2026-10-19T08:01:01.000Z",
  };
}
