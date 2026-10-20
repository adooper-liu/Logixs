import { expect, test, type Page, type Route } from "@playwright/test";

// Synthetic, controlled E2E fixture data. It is not a real business sample.
const fixture = {
  activeContainerId: "11111111-1111-4111-8111-111111111111",
  activeContainerNumber: "E2E-CUSTOMS-AI-01",
  activeTaskId: "22222222-2222-4222-8222-222222222221",
  activeCandidateId: "33333333-3333-4333-8333-333333333331",
  activeWorkOrderId: "44444444-4444-4444-8444-444444444441",
  secondContainerId: "11111111-1111-4111-8111-111111111112",
  secondContainerNumber: "E2E-CUSTOMS-AI-02",
  secondTaskId: "22222222-2222-4222-8222-222222222222",
  secondCandidateId: "33333333-3333-4333-8333-333333333332",
  secondWorkOrderId: "44444444-4444-4444-8444-444444444442",
  completedContainerId: "11111111-1111-4111-8111-111111111113",
  completedContainerNumber: "E2E-CUSTOMS-AI-DONE",
  completedTaskId: "22222222-2222-4222-8222-222222222223",
  noTaskContainerId: "11111111-1111-4111-8111-111111111114",
  noTaskContainerNumber: "E2E-CUSTOMS-AI-NO-TASK",
  actorId: "77777777-7777-4777-8777-777777777777",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.04,
  scale: "css" as const,
  threshold: 0.3,
};

interface FixtureControl {
  claimed: Set<string>;
  nodeTaskReads: number;
  generates: Array<Record<string, unknown>>;
  confirmations: Array<Record<string, unknown>>;
  rejections: Array<Record<string, unknown>>;
  directClaims: number;
  confirmStatuses: number[];
  getCandidateStatuses: Array<"proposed" | "accepted" | "rejected">;
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    claimed: new Set(),
    nodeTaskReads: 0,
    generates: [],
    confirmations: [],
    rejections: [],
    directClaims: 0,
    confirmStatuses: [],
    getCandidateStatuses: [],
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
      control.nodeTaskReads += 1;
      await route.fulfill({
        json: taskPage(url.searchParams.get("containerId"), control),
      });
      return;
    }
    if (/^\/api\/work-orders\/[^/]+\/claim$/.test(path)) {
      control.directClaims += 1;
      await route.fulfill({
        status: 500,
        json: { message: "CUSTOMS_MUST_NOT_CLAIM_DIRECTLY" },
      });
      return;
    }

    const aiMatch = path.match(
      /^\/api\/node-tasks\/([^/]+)\/ai\/action-candidates(?:\/([^/]+))?(?:\/(confirmations|rejections))?$/,
    );
    if (aiMatch?.[1]) {
      await handleAi(
        route,
        decodeURIComponent(aiMatch[1]),
        aiMatch[3],
        control,
      );
      return;
    }

    const collaborationMatch = path.match(
      /^\/api\/node-tasks\/([^/]+)\/collaboration$/,
    );
    if (collaborationMatch?.[1]) {
      const taskId = decodeURIComponent(collaborationMatch[1]);
      const containerId = containerIdForTask(taskId);
      expect(url.searchParams.get("subjectKind")).toBe("container");
      expect(url.searchParams.get("subjectId")).toBe(containerId);
      await route.fulfill({ json: collaborationPage(taskId, containerId) });
      return;
    }

    const containerId = containerIdFrom(path);
    if (!containerId) throw new Error(`Unhandled Customs AI path: ${path}`);
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
      await route.fulfill({ json: activityPage });
      return;
    }
    throw new Error(`Unhandled Customs AI path: ${path}`);
  });

  return control;
}

async function handleAi(
  route: Route,
  taskId: string,
  operation: string | undefined,
  control: FixtureControl,
): Promise<void> {
  const request = route.request();
  if (!operation && request.method() === "POST") {
    const command = request.postDataJSON() as Record<string, unknown>;
    control.generates.push(command);
    expect(command).toEqual({
      contractVersion: "task-action-candidate-generate.v1",
      subjectRef: { kind: "container", id: containerIdForTask(taskId) },
      workRef: { kind: "node_task", id: taskId },
    });
    if (taskId === fixture.completedTaskId) {
      await route.fulfill({
        status: 409,
        json: { message: "NO_CLAIM_ACTION" },
      });
      return;
    }
    await route.fulfill({ json: candidate(taskId, control) });
    return;
  }
  if (operation === "confirmations") {
    const command = request.postDataJSON() as Record<string, unknown>;
    control.confirmations.push(command);
    const status = control.confirmStatuses.shift() ?? 200;
    if (status !== 200) {
      await route.fulfill({ status, json: { message: `CONFIRM_${status}` } });
      return;
    }
    const replay =
      control.confirmations.filter(
        (item) => item.idempotencyKey === command.idempotencyKey,
      ).length > 1;
    control.claimed.add(taskId);
    await route.fulfill({ json: confirmResult(taskId, control, replay) });
    return;
  }
  if (operation === "rejections") {
    control.rejections.push(request.postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: decision(taskId, "rejected") });
    return;
  }
  await route.fulfill({
    json: candidate(
      taskId,
      control,
      control.getCandidateStatuses.shift() ?? "rejected",
    ),
  });
}

async function gotoTask(
  page: Page,
  containerId: string = fixture.activeContainerId,
  taskId: string = fixture.activeTaskId,
): Promise<FixtureControl> {
  const control = await installFixture(page);
  await page.goto(
    `/workspaces/customs?containerId=${containerId}&taskId=${taskId}`,
  );
  await expect(page.getByRole("heading", { name: "进口清关" })).toBeVisible();
  await expect(page.getByRole("region", { name: "清关办理" })).toBeVisible();
  return control;
}

async function openAi(page: Page): Promise<void> {
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
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

async function alignContextToViewport(page: Page): Promise<void> {
  if (page.viewportSize()?.width === 1440) return;
  await contextPane(page).evaluate((element) => {
    const owner = element.closest<HTMLElement>(".app-content");
    if (!owner) throw new Error("Missing app content scroll owner");
    owner.scrollTop +=
      element.getBoundingClientRect().top - owner.getBoundingClientRect().top;
  });
}

async function expectPaneOrder(page: Page): Promise<void> {
  const panes = await page
    .locator("[data-workbench-pane]")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return {
          id: (item as HTMLElement).dataset.workbenchPane,
          x: Math.round(box.x),
          y: Math.round(box.y),
        };
      }),
    );
  const queue = panes.find(({ id }) => id === "queue")!;
  const detail = panes.find(({ id }) => id === "detail")!;
  const context = panes.find(({ id }) => id === "context")!;
  if (page.viewportSize()?.width === 1440) {
    expect(queue.x).toBeLessThan(detail.x);
    expect(detail.x).toBeLessThan(context.x);
  } else if (page.viewportSize()?.width === 1024) {
    expect(queue.x).toBeLessThan(detail.x);
    expect(context.y).toBeGreaterThan(detail.y);
  } else {
    expect(queue.y).toBeLessThan(detail.y);
    expect(detail.y).toBeLessThan(context.y);
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => {
    const measure = (element: Element | null) => {
      const target = element as HTMLElement | null;
      return {
        client: target?.clientWidth ?? 0,
        scroll: target?.scrollWidth ?? 0,
      };
    };
    return {
      document: measure(document.documentElement),
      app: measure(document.querySelector(".app-content")),
      panes: Array.from(document.querySelectorAll("[data-workbench-pane]")).map(
        measure,
      ),
    };
  });
  expect(widths.document.scroll).toBeLessThanOrEqual(
    widths.document.client + 1,
  );
  expect(widths.app.scroll).toBeLessThanOrEqual(widths.app.client + 1);
  for (const pane of widths.panes) {
    expect(pane.scroll).toBeLessThanOrEqual(pane.client + 1);
  }
}

async function expectNoNestedAiScrollOwner(page: Page): Promise<void> {
  const owners = await page
    .locator(
      ".task-context, .task-context__mode, .task-ai, .task-ai__spine, .task-ai__details",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) =>
          /(auto|scroll)/.test(
            `${getComputedStyle(element).overflow} ${getComputedStyle(element).overflowY}`,
          ),
        )
        .map((element) => (element as HTMLElement).className),
    );
  expect(owners).toEqual([]);
}

test("Customs reuses the shared four-mode AI facade without losing its form or stacked geometry", async ({
  page,
}) => {
  const control = await gotoTask(page);
  const country = page.getByLabel("进口国/地区代码");
  const scrollOwner = contextScrollOwner(page);
  await country.fill("US");
  await country.focus();
  const workScroll = await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(
      96,
      element.scrollHeight - element.clientHeight,
    );
    return element.scrollTop;
  });

  for (const mode of ["档案", "协作", "AI 辅助"] as const) {
    const button = page.getByRole("button", { name: mode, exact: true });
    await button.dispatchEvent("pointerdown");
    await button.click();
  }
  await expect(
    page.getByText("当前测试 fixture：建议领取清关任务 1"),
  ).toBeVisible();
  await expect(page.getByText("未采信，不改变任务状态")).toBeVisible();
  await expect(
    page.getByText(`当前领取工单 ${fixture.activeWorkOrderId}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator('[data-ai-spine-step="source"]')
      .locator(".task-ai__reference"),
  ).toHaveText("task.claim-assistance / v1");
  await expect(page.getByText("影响与风险", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "确认后服务端会重新验证当前身份、task.execute、tenant/object scope、当前业务状态和并发版本。",
      { exact: true },
    ),
  ).toBeVisible();
  expect(control.directClaims).toBe(0);

  await page.getByRole("button", { name: "办理", exact: true }).click();
  await expect(country).toHaveValue("US");
  await expect(country).toBeFocused();
  if (workScroll > 0) {
    await expect
      .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
      .toBe(workScroll);
  }

  await openAi(page);
  await alignContextToViewport(page);
  await scrollOwner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expectPaneOrder(page);
  await expectNoHorizontalOverflow(page);
  await expectNoNestedAiScrollOwner(page);
  await expect(page.getByLabel("清关事实总览")).toBeVisible();
  await expect(page.getByLabel("当前清关上下文")).toContainText(
    fixture.activeContainerNumber,
  );
  await expect(page).toHaveScreenshot(
    "customs-task-ai-assisted-execution.png",
    {
      ...screenshotOptions,
    },
  );
});

test("confirmation rereads Customs tasks and preserves the current worksite", async ({
  page,
}) => {
  const control = await gotoTask(page);
  const country = page.getByLabel("进口国/地区代码");
  await country.fill("CN");
  await openAi(page);
  const readsBefore = control.nodeTaskReads;
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByText("正式执行回执")).toBeVisible();
  await expect(page.getByText("已应用")).toBeVisible();
  expect(control.nodeTaskReads).toBeGreaterThan(readsBefore);
  expect(control.confirmations).toHaveLength(1);
  expect(control.directClaims).toBe(0);
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.activeContainerId}.*taskId=${fixture.activeTaskId}`,
    ),
  );
  await expect(queueItem(page, fixture.activeContainerNumber)).toHaveClass(
    /queue-item--active/,
  );
  await page.getByRole("button", { name: "办理", exact: true }).click();
  await expect(country).toHaveValue("CN");
});

test("lost confirmation response reuses the identical candidate, hash, and idempotency key", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "same-key recovery runs once");
  const control = await gotoTask(page);
  control.confirmStatuses.push(503, 200);
  await openAi(page);
  await page.getByTestId("ai-confirm").click();
  await expect(page.getByTestId("ai-retry-confirm")).toBeVisible();
  await page.getByTestId("ai-retry-confirm").click();

  await expect(page.getByText("同一操作的幂等恢复回执")).toBeVisible();
  expect(control.confirmations).toHaveLength(2);
  expect(control.confirmations[1]).toEqual(control.confirmations[0]);
  expect(control.confirmations[0]).toMatchObject({
    candidateId: fixture.activeCandidateId,
    candidateHash: "candidate-hash-1",
  });
});

test("container switch removes the old candidate and binds exact new refs", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "switch regression runs once");
  const control = await gotoTask(page);
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取清关任务 1"),
  ).toBeVisible();

  await queueItem(page, fixture.secondContainerNumber).click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${fixture.secondContainerId}.*taskId=${fixture.secondTaskId}`,
    ),
  );
  await expect(
    page.getByRole("button", { name: "办理", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("当前测试 fixture：建议领取清关任务 1"),
  ).toHaveCount(0);
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取清关任务 2"),
  ).toBeVisible();
  expect(control.generates.at(-1)).toEqual({
    contractVersion: "task-action-candidate-generate.v1",
    subjectRef: { kind: "container", id: fixture.secondContainerId },
    workRef: { kind: "node_task", id: fixture.secondTaskId },
  });
});

test("completed and no-task Customs contexts expose no executable candidate", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "boundary regression runs once",
  );
  const control = await gotoTask(
    page,
    fixture.completedContainerId,
    fixture.completedTaskId,
  );
  await openAi(page);
  await expect(page.getByText("当前没有可建议的领取动作")).toBeVisible();
  await expect(page.getByTestId("ai-confirm")).toHaveCount(0);
  expect(control.confirmations).toHaveLength(0);

  await page.goto(
    `/workspaces/customs?containerId=${fixture.noTaskContainerId}`,
  );
  await expect(page.getByLabel("当前清关上下文")).toContainText(
    "清关任务待选择",
  );
  await expect(page.getByRole("button", { name: "AI 辅助" })).toHaveCount(0);
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveCount(1);
});

test("Customs preserves shared withdrawal and conflict recovery semantics", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "recovery regression runs once",
  );
  const control = await gotoTask(page);
  control.confirmStatuses.push(403);
  await openAi(page);
  await page.getByTestId("ai-confirm").click();
  await expect(page.getByRole("alert")).toContainText("重新读取任务和授权");
  await expect(
    page.getByText("当前测试 fixture：建议领取清关任务 1"),
  ).toHaveCount(0);
  await expect(page.getByTestId("ai-retry-confirm")).toHaveCount(0);

  await page.reload();
  control.confirmStatuses.push(409);
  control.getCandidateStatuses.push("rejected");
  await openAi(page);
  const readsBefore = control.nodeTaskReads;
  await page.getByTestId("ai-confirm").click();
  await expect(page.getByRole("alert")).toContainText("冲突");
  await expect(page.getByText("已拒绝建议")).toBeVisible();
  expect(control.nodeTaskReads).toBeGreaterThan(readsBefore);
  expect(control.directClaims).toBe(0);
});

function containerIdFrom(path: string): string | null {
  const match = path.match(/^\/api\/containers\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function containerIdForTask(taskId: string): string {
  if (taskId === fixture.activeTaskId) return fixture.activeContainerId;
  if (taskId === fixture.secondTaskId) return fixture.secondContainerId;
  if (taskId === fixture.completedTaskId) return fixture.completedContainerId;
  throw new Error(`Unknown fixture task: ${taskId}`);
}

function containerFor(containerId: string) {
  const numbers: Record<string, string> = {
    [fixture.activeContainerId]: fixture.activeContainerNumber,
    [fixture.secondContainerId]: fixture.secondContainerNumber,
    [fixture.completedContainerId]: fixture.completedContainerNumber,
    [fixture.noTaskContainerId]: fixture.noTaskContainerNumber,
  };
  return {
    id: containerId,
    orderNumber: `E2E-ORDER-${containerId.slice(-4)}`,
    containerNumber: numbers[containerId],
    currentStatus: "at_port",
    updatedAt: "2026-10-20T08:00:00.000Z",
  };
}

const containerPage = {
  items: [
    containerFor(fixture.activeContainerId),
    containerFor(fixture.secondContainerId),
    containerFor(fixture.completedContainerId),
    containerFor(fixture.noTaskContainerId),
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-10-20T09:00:00.000Z",
  projectionVersion: 3,
};

function taskPage(containerId: string | null, control: FixtureControl) {
  const items = [
    taskFixture(
      fixture.activeTaskId,
      fixture.activeContainerId,
      fixture.activeWorkOrderId,
      "pending",
      control,
    ),
    taskFixture(
      fixture.secondTaskId,
      fixture.secondContainerId,
      fixture.secondWorkOrderId,
      "pending",
      control,
    ),
    taskFixture(
      fixture.completedTaskId,
      fixture.completedContainerId,
      "44444444-4444-4444-8444-444444444443",
      "completed",
      control,
    ),
  ];
  return {
    items: containerId
      ? items.filter((task) => task.containerId === containerId)
      : items,
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-20T09:00:00.000Z",
    projectionVersion: 3,
  };
}

function taskFixture(
  id: string,
  containerId: string,
  workOrderId: string,
  initialState: "pending" | "completed",
  control: FixtureControl,
) {
  const claimed = control.claimed.has(id);
  const state = claimed ? "in_progress" : initialState;
  return {
    id,
    flowInstanceId: `${id}-flow`,
    nodeInstanceId: `${id}-node`,
    nodeCode: "customs_clearance",
    containerId,
    taskDefinitionKey: "node-customs-clearance",
    state,
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: workOrderId,
        workOrderDefinitionKey: "customs-clearance",
        state: claimed ? "in_progress" : "available",
        assignmentState: claimed ? "assigned" : "pool",
        assigneeId: claimed ? fixture.actorId : null,
        dueAt: "2026-10-21T08:00:00.000Z",
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction:
      state === "completed"
        ? null
        : {
            actionCode: claimed
              ? "work_execution.complete_work_order"
              : "work_execution.claim_work_order",
            workOrderId,
            workOrderDefinitionKey: "customs-clearance",
            assignmentState: claimed ? "assigned" : "pool",
            assigneeId: claimed ? fixture.actorId : null,
            dueAt: "2026-10-21T08:00:00.000Z",
          },
  };
}

function candidate(
  taskId: string,
  control: FixtureControl,
  status: "proposed" | "accepted" | "rejected" = "proposed",
) {
  const second = taskId === fixture.secondTaskId;
  const suffix = second ? "2" : "1";
  return {
    candidateId: second ? fixture.secondCandidateId : fixture.activeCandidateId,
    candidateHash: `candidate-hash-${suffix}`,
    context: {
      subjectRef: { kind: "container", id: containerIdForTask(taskId) },
      workRef: { kind: "node_task", id: taskId },
    },
    workOrderId: second ? fixture.secondWorkOrderId : fixture.activeWorkOrderId,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: `当前测试 fixture：建议领取清关任务 ${suffix}`,
    rationale: "当前服务端快照表明该清关工单可领取。",
    impact: "确认后将执行正式领取，并重读当前清关任务。",
    riskLevel: "low",
    warningCodes: [],
    status: control.claimed.has(taskId) ? "accepted" : status,
    source: {
      kind: "rule",
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: `snapshot-${suffix}`,
      inputRefs: [
        { kind: "container", id: containerIdForTask(taskId), version: 3 },
        { kind: "node_task", id: taskId, version: 7 },
      ],
      generatedAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

function decision(taskId: string, kind: "accepted" | "rejected") {
  return {
    decisionId:
      taskId === fixture.secondTaskId
        ? "55555555-5555-4555-8555-555555555552"
        : "55555555-5555-4555-8555-555555555551",
    candidateId:
      taskId === fixture.secondTaskId
        ? fixture.secondCandidateId
        : fixture.activeCandidateId,
    decidedByActorId: fixture.actorId,
    decision: kind,
    reason: kind === "rejected" ? "当前测试拒绝" : null,
    idempotencyKey: "66666666-6666-4666-8666-666666666666",
    decidedAt: "2026-10-20T08:01:00.000Z",
    clientOperationId: kind === "accepted" ? `operation-${taskId}` : null,
    traceId: kind === "accepted" ? `trace-${taskId}` : null,
    executionState: kind === "accepted" ? "applied" : null,
    resultRefs: [],
  };
}

function confirmResult(
  taskId: string,
  control: FixtureControl,
  replay: boolean,
) {
  const workOrderId =
    taskId === fixture.secondTaskId
      ? fixture.secondWorkOrderId
      : fixture.activeWorkOrderId;
  return {
    contractVersion: "task-action-candidate-confirm-result.v1",
    candidate: candidate(taskId, control, "accepted"),
    decision: decision(taskId, "accepted"),
    claimWorkOrderResult: {
      workOrderId,
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: fixture.actorId,
      taskId,
      taskState: "in_progress",
      applied: true,
      clientOperationId: `operation-${taskId}`,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    },
    idempotencyReplay: replay,
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
    asOf: "2026-10-20T09:00:00.000Z",
    projectionVersion: 1,
  };
}

const dateFactPage = {
  items: [],
  projectionVersion: 0,
  asOf: "2026-10-20T09:00:00.000Z",
};

function activityPage() {
  return {
    items: [],
    nextActions: [],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
    asOf: "2026-10-20T09:00:00.000Z",
    projectionVersion: 1,
  };
}

function collaborationPage(taskId: string, containerId: string) {
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: { kind: "container", id: containerId },
    workRef: { kind: "node_task", id: taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: [],
    asOf: "2026-10-20T09:00:00.000Z",
    pageSize: 25,
    nextCursor: null,
    canPost: true,
    postDisabledReason: null,
    mentionOptions: [],
    evidenceOptions: [],
  };
}
