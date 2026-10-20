import { expect, test, type Page } from "@playwright/test";

const fixture = {
  containerId: "11111111-1111-4111-8111-111111111111",
  containerNumber: "E2E-AI-FIXTURE-01",
  taskA: "22222222-2222-4222-8222-222222222221",
  taskB: "22222222-2222-4222-8222-222222222222",
  candidateA: "33333333-3333-4333-8333-333333333331",
  candidateB: "33333333-3333-4333-8333-333333333332",
  workOrderA: "44444444-4444-4444-8444-444444444441",
  workOrderB: "44444444-4444-4444-8444-444444444442",
  actorId: "77777777-7777-4777-8777-777777777777",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
  threshold: 0.3,
};

type RequestKind = "generate" | "get" | "confirm" | "reject";

interface FixtureControl {
  visibleTaskId: string;
  sourceKind: "rule" | "model" | "fallback";
  generateFailure: { status: number; code: string } | null;
  getStatuses: number[];
  getCandidateStatuses: Array<"proposed" | "accepted" | "rejected" | "expired">;
  confirmStatuses: number[];
  rejectStatuses: number[];
  clearTasksAfterConfirm: boolean;
  tasksCleared: boolean;
  claimed: Set<string>;
  nodeTaskReads: number;
  generates: Array<Record<string, unknown>>;
  confirmations: Array<Record<string, unknown>>;
  rejections: Array<Record<string, unknown>>;
  directClaims: number;
  holdNext: Partial<Record<RequestKind, string>>;
  releases: Partial<Record<RequestKind, () => void>>;
}

function taskPage(control: FixtureControl) {
  return {
    items: control.tasksCleared
      ? []
      : [
          taskDetail(fixture.taskA, fixture.workOrderA, control),
          taskDetail(fixture.taskB, fixture.workOrderB, control),
        ],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
    asOf: "2026-10-20T09:00:00.000Z",
    projectionVersion: 21,
  };
}

function taskDetail(
  taskId: string,
  workOrderId: string,
  control: FixtureControl,
) {
  const claimed = control.claimed.has(taskId);
  return {
    id: taskId,
    flowInstanceId: `flow-${taskId}`,
    nodeInstanceId: `node-${taskId}`,
    nodeCode:
      taskId === fixture.taskA ? "container_pickup" : "container_stuffing",
    containerId: fixture.containerId,
    taskDefinitionKey: `definition-${taskId}`,
    state: claimed ? "in_progress" : "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: workOrderId,
        workOrderDefinitionKey: `work-${taskId}`,
        state: claimed ? "in_progress" : "available",
        assignmentState: claimed ? "assigned" : "pool",
        assigneeId: claimed ? "operator-e2e" : null,
        dueAt: "2026-10-21T08:00:00.000Z",
        completedAt: null,
      },
    ],
    outcome: null,
    nextAction: claimed
      ? {
          actionCode: "work_execution.complete_work_order",
          workOrderId,
          workOrderDefinitionKey: `work-${taskId}`,
          assignmentState: "assigned",
          assigneeId: "operator-e2e",
          dueAt: "2026-10-21T08:00:00.000Z",
        }
      : {
          actionCode: "work_execution.claim_work_order",
          workOrderId,
          workOrderDefinitionKey: `work-${taskId}`,
          assignmentState: "pool",
          assigneeId: null,
          dueAt: "2026-10-21T08:00:00.000Z",
        },
  };
}

function candidate(
  taskId: string,
  control: FixtureControl,
  status = "proposed",
) {
  const isA = taskId === fixture.taskA;
  return {
    candidateId: isA ? fixture.candidateA : fixture.candidateB,
    candidateHash: `candidate-hash-${isA ? "A" : "B"}`,
    context: {
      subjectRef: { kind: "container", id: fixture.containerId },
      workRef: { kind: "node_task", id: taskId },
    },
    workOrderId: isA ? fixture.workOrderA : fixture.workOrderB,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: `当前测试 fixture：建议领取任务 ${isA ? "A" : "B"}`,
    rationale: "当前服务端快照表明该工单可领取。",
    impact: "确认后将执行正式领取，并重读当前任务。",
    riskLevel: "low",
    warningCodes: [],
    status,
    source: {
      kind: control.sourceKind,
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: control.sourceKind === "model" ? "prompt-v1" : null,
      modelId: control.sourceKind === "model" ? "model-v1" : null,
      inputSnapshotHash: `snapshot-${isA ? "A" : "B"}`,
      inputRefs: [
        { kind: "container", id: fixture.containerId, version: 3 },
        { kind: "node_task", id: taskId, version: 7 },
      ],
      generatedAt: "2026-10-20T08:00:00.000Z",
    },
  };
}

function decision(taskId: string, kind: "accepted" | "rejected") {
  const isA = taskId === fixture.taskA;
  return {
    decisionId: isA
      ? "55555555-5555-4555-8555-555555555551"
      : "55555555-5555-4555-8555-555555555552",
    candidateId: isA ? fixture.candidateA : fixture.candidateB,
    decidedByActorId: "operator-e2e",
    decision: kind,
    reason: kind === "rejected" ? "当前测试拒绝" : null,
    idempotencyKey: "66666666-6666-4666-8666-666666666666",
    decidedAt: "2026-10-20T08:01:00.000Z",
    clientOperationId:
      kind === "accepted" ? `operation-${isA ? "A" : "B"}` : null,
    traceId: kind === "accepted" ? `trace-${isA ? "A" : "B"}` : null,
    executionState: kind === "accepted" ? "applied" : null,
    resultRefs: [],
  };
}

function confirmResult(
  taskId: string,
  control: FixtureControl,
  replay: boolean,
) {
  const isA = taskId === fixture.taskA;
  const workOrderId = isA ? fixture.workOrderA : fixture.workOrderB;
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
      clientOperationId: `operation-${isA ? "A" : "B"}`,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    },
    idempotencyReplay: replay,
  };
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    visibleTaskId: fixture.taskA,
    sourceKind: "rule",
    generateFailure: null,
    getStatuses: [],
    getCandidateStatuses: [],
    confirmStatuses: [],
    rejectStatuses: [],
    clearTasksAfterConfirm: false,
    tasksCleared: false,
    claimed: new Set(),
    nodeTaskReads: 0,
    generates: [],
    confirmations: [],
    rejections: [],
    directClaims: 0,
    holdNext: {},
    releases: {},
  };

  await page.route(/\/api\/containers(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: fixture.containerId,
            orderNumber: "E2E-AI-ORDER-01",
            containerNumber: fixture.containerNumber,
            currentStatus: "at_port",
            updatedAt: "2026-10-20T08:00:00.000Z",
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-10-20T09:00:00.000Z",
        projectionVersion: 12,
      },
    }),
  );
  await page.route(/\/api\/node-tasks(?:\?.*)?$/, (route) => {
    control.nodeTaskReads += 1;
    return route.fulfill({ json: taskPage(control) });
  });
  await page.route(/\/api\/containers\/[^/]+\/activities(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        items: [],
        nextActions: [],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
        asOf: "2026-10-20T09:00:00.000Z",
        projectionVersion: 1,
      },
    }),
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/collaboration(?:\?.*)?$/,
    (route) => {
      const url = new URL(route.request().url());
      const taskId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
      expect(url.searchParams.get("subjectKind")).toBe("container");
      expect(url.searchParams.get("subjectId")).toBe(fixture.containerId);
      return route.fulfill({
        json: {
          contractVersion: "task-collaboration-page.v1",
          thread: null,
          subjectRef: { kind: "container", id: fixture.containerId },
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
        },
      });
    },
  );
  await page.route(/\/api\/work-orders\/[^/]+\/claim$/, (route) => {
    control.directClaims += 1;
    return route.fulfill({
      status: 500,
      json: { message: "WEB_MUST_NOT_CLAIM_DIRECTLY" },
    });
  });
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/ai\/action-candidates$/,
    async (route) => {
      const taskId = decodeURIComponent(
        route
          .request()
          .url()
          .match(/node-tasks\/([^/]+)/)?.[1] ?? "",
      );
      const command = route.request().postDataJSON() as Record<string, unknown>;
      control.generates.push(command);
      expect(command).toEqual({
        contractVersion: "task-action-candidate-generate.v1",
        subjectRef: { kind: "container", id: fixture.containerId },
        workRef: { kind: "node_task", id: taskId },
      });
      await holdIfRequested(control, "generate", taskId);
      if (control.generateFailure) {
        const failure = control.generateFailure;
        control.generateFailure = null;
        await route.fulfill({
          status: failure.status,
          json: { message: failure.code, traceId: "trace-generate" },
        });
        return;
      }
      await safelyFulfill(route, { json: candidate(taskId, control) });
    },
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/ai\/action-candidates\/([^/]+)$/,
    async (route) => {
      const match = route
        .request()
        .url()
        .match(/node-tasks\/([^/]+)\/ai/);
      const taskId = decodeURIComponent(match?.[1] ?? "");
      await holdIfRequested(control, "get", taskId);
      const status = control.getStatuses.shift() ?? 200;
      if (status !== 200) {
        await safelyFulfill(route, {
          status,
          json: { message: `GET_${status}` },
        });
        return;
      }
      await safelyFulfill(route, {
        json: candidate(
          taskId,
          control,
          control.getCandidateStatuses.shift() ?? "rejected",
        ),
      });
    },
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/ai\/action-candidates\/([^/]+)\/rejections$/,
    async (route) => {
      const match = route
        .request()
        .url()
        .match(/node-tasks\/([^/]+)\/ai/);
      const taskId = decodeURIComponent(match?.[1] ?? "");
      control.rejections.push(
        route.request().postDataJSON() as Record<string, unknown>,
      );
      await holdIfRequested(control, "reject", taskId);
      const status = control.rejectStatuses.shift() ?? 200;
      if (status !== 200) {
        await safelyFulfill(route, {
          status,
          json: { message: `REJECT_${status}` },
        });
        return;
      }
      await safelyFulfill(route, { json: decision(taskId, "rejected") });
    },
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/ai\/action-candidates\/([^/]+)\/confirmations$/,
    async (route) => {
      const match = route
        .request()
        .url()
        .match(/node-tasks\/([^/]+)\/ai/);
      const taskId = decodeURIComponent(match?.[1] ?? "");
      const command = route.request().postDataJSON() as Record<string, unknown>;
      control.confirmations.push(command);
      await holdIfRequested(control, "confirm", taskId);
      const status = control.confirmStatuses.shift() ?? 200;
      if (status !== 200) {
        await safelyFulfill(route, {
          status,
          json: { message: `CONFIRM_${status}` },
        });
        return;
      }
      const repeated =
        control.confirmations.filter(
          (item) => item.idempotencyKey === command.idempotencyKey,
        ).length > 1;
      control.claimed.add(taskId);
      if (control.clearTasksAfterConfirm) {
        control.visibleTaskId = "";
        control.tasksCleared = true;
      }
      await safelyFulfill(route, {
        json: confirmResult(taskId, control, repeated),
      });
    },
  );
  return control;
}

async function safelyFulfill(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  options: Parameters<typeof route.fulfill>[0],
): Promise<void> {
  try {
    await route.fulfill(options);
  } catch (cause) {
    if (!/aborted|canceled|cancelled|Target page/i.test(String(cause)))
      throw cause;
  }
}

async function holdIfRequested(
  control: FixtureControl,
  kind: RequestKind,
  taskId: string,
): Promise<void> {
  if (control.holdNext[kind] !== taskId) return;
  delete control.holdNext[kind];
  await new Promise<void>((resolve) => {
    control.releases[kind] = resolve;
  });
  delete control.releases[kind];
}

async function gotoTask(
  page: Page,
  configure?: (control: FixtureControl) => void,
) {
  const control = await installFixture(page);
  configure?.(control);
  await page.goto(
    `/tasks?containerId=${fixture.containerId}&task=${fixture.taskA}`,
  );
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  return control;
}

async function openAi(page: Page): Promise<void> {
  if (page.viewportSize()?.width === 390) {
    await page.getByRole("button", { name: "上下文", exact: true }).click();
  }
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
}

async function selectTask(page: Page, control: FixtureControl, taskId: string) {
  control.visibleTaskId = taskId;
  await page.locator(`[data-task-id="${taskId}"]`).click();
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
      app: measure(document.querySelector(".app-content")),
      panes: Array.from(document.querySelectorAll("[data-workbench-pane]")).map(
        measure,
      ),
    };
  });
  expect(facts.document.scroll).toBeLessThanOrEqual(facts.document.client + 1);
  expect(facts.app.scroll).toBeLessThanOrEqual(facts.app.client + 1);
  for (const pane of facts.panes) {
    expect(pane.scroll).toBeLessThanOrEqual(pane.client + 1);
  }
}

async function expectNoNestedScrollOwner(page: Page): Promise<void> {
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

test("auto-generates a structured proposal while leaving task responsibility unchanged", async ({
  page,
}) => {
  const control = await gotoTask(page);
  await openAi(page);

  await expect(
    page.getByText("当前测试 fixture：建议领取任务 A"),
  ).toBeVisible();
  await expect(page.getByText("未采信，不改变任务状态")).toBeVisible();
  await expect(page.getByText("规则建议")).toBeVisible();
  await expect(
    page.locator("[data-task-ai-assistance-panel]").getByText("待领取", {
      exact: true,
    }),
  ).toBeVisible();
  expect(control.confirmations).toHaveLength(0);
  expect(control.directClaims).toBe(0);
  await expect(page.locator("details.task-ai__details")).not.toHaveAttribute(
    "open",
    "",
  );
});

test("rejects explicitly without any formal claim", async ({ page }) => {
  const control = await gotoTask(page);
  await openAi(page);
  await page.getByLabel("拒绝原因（可选）").fill("当前测试拒绝");
  await page.getByTestId("ai-reject").click();

  await expect(page.getByText("已拒绝建议")).toBeVisible();
  expect(control.rejections).toHaveLength(1);
  expect(control.confirmations).toHaveLength(0);
  expect(control.directClaims).toBe(0);
});

test("confirms through AI1, shows the formal receipt, and rereads the task", async ({
  page,
}) => {
  const control = await gotoTask(page);
  await openAi(page);
  const readsBefore = control.nodeTaskReads;
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByText("正式执行回执")).toBeVisible();
  await expect(page.getByText("已应用")).toBeVisible();
  const receipt = page.locator('[data-ai-spine-step="receipt"]');
  await receipt.scrollIntoViewIfNeeded();
  await expect(receipt).toContainText("当前负责人你");
  await expect(receipt).toContainText("任务状态进行中");
  await expect(receipt).toContainText("操作状态已接收 / 已确认 / 已入账");
  await expect(receipt).not.toContainText(fixture.actorId);
  await expect(receipt).not.toContainText("in_progress");
  const details = page.locator("details.task-ai__details");
  await expect(details).toContainText(fixture.actorId);
  await expect(details).toContainText("in_progress");
  await expect(details).toContainText("received");
  await expect(details).toContainText("accepted");
  await expect(details).toContainText("committed");
  expect(control.nodeTaskReads).toBeGreaterThan(readsBefore);
  expect(control.confirmations).toHaveLength(1);
  expect(control.directClaims).toBe(0);
});

test("confirm 403 clears the sensitive candidate and recovery command", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) =>
    item.confirmStatuses.push(403),
  );
  await openAi(page);
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByRole("alert")).toContainText("重新读取任务和授权");
  await expect(page.getByText("当前测试 fixture：建议领取任务 A")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("ai-retry-confirm")).toHaveCount(0);
  expect(control.confirmations).toHaveLength(1);
});

for (const status of [403, 404]) {
  test(`generate ${status} rereads task context before generating again`, async ({
    page,
  }) => {
    const control = await gotoTask(page, (item) => {
      item.generateFailure = { status, code: `GENERATE_${status}` };
    });
    await openAi(page);
    await expect(page.getByTestId("ai-retry-context")).toBeVisible();
    await expect(page.getByTestId("ai-retry-generate")).toHaveCount(0);
    const readsBefore = control.nodeTaskReads;
    const generatesBefore = control.generates.length;

    await page.getByTestId("ai-retry-context").click();

    await expect(
      page.getByText("当前测试 fixture：建议领取任务 A"),
    ).toBeVisible();
    expect(control.nodeTaskReads).toBe(readsBefore + 1);
    expect(control.generates).toHaveLength(generatesBefore + 1);
  });
}

test("confirmation refresh removes stale receipt when the task disappears", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) => {
    item.clearTasksAfterConfirm = true;
  });
  await openAi(page);
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByText("正式执行回执")).toHaveCount(0);
  await expect(page.getByTestId("ai-confirm")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI 辅助" })).toHaveCount(0);
  expect(control.confirmations).toHaveLength(1);
});

test("confirm 409 shows conflict and rereads candidate and task", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) =>
    item.confirmStatuses.push(409),
  );
  await openAi(page);
  const readsBefore = control.nodeTaskReads;
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByRole("alert")).toContainText("冲突");
  await expect(page.getByText("已拒绝建议")).toBeVisible();
  expect(control.nodeTaskReads).toBeGreaterThan(readsBefore);
  await expect(page.getByTestId("ai-retry-confirm")).toHaveCount(0);
});

test("confirm 409 followed by candidate 403 preserves context recovery", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) => {
    item.confirmStatuses.push(409);
    item.getStatuses.push(403);
  });
  await openAi(page);
  await page.getByTestId("ai-confirm").click();

  await expect(page.getByRole("alert")).toContainText("重新读取任务和授权");
  await expect(page.getByRole("alert")).not.toContainText("发生冲突");
  await expect(page.getByTestId("ai-retry-context")).toBeVisible();
  await expect(page.getByTestId("ai-retry-confirm")).toHaveCount(0);
  expect(control.confirmations).toHaveLength(1);
});

test("expired conflict candidate is non-executable and regenerates after context reread", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) => {
    item.confirmStatuses.push(409);
    item.getCandidateStatuses.push("expired");
  });
  await openAi(page);
  await page.getByTestId("ai-confirm").click();

  await expect(
    page
      .locator('[data-ai-spine-step="decision"]')
      .getByRole("heading", { name: "建议已失效", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("当前建议不可执行", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("等待你的决定", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("ai-confirm")).toHaveCount(0);
  await expect(page.getByTestId("ai-reject")).toHaveCount(0);
  const generatesBefore = control.generates.length;

  await page.getByTestId("ai-retry-context").click();

  await expect(
    page.getByText("当前测试 fixture：建议领取任务 A"),
  ).toBeVisible();
  await expect(page.getByText("等待你的决定", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(control.generates).toHaveLength(generatesBefore + 1);
});

test("recovers a lost confirmation response with the exact same candidate hash and key", async ({
  page,
}) => {
  const control = await gotoTask(page, (item) =>
    item.confirmStatuses.push(503, 200),
  );
  await openAi(page);
  await page.getByTestId("ai-confirm").click();
  await expect(page.getByTestId("ai-retry-confirm")).toBeVisible();
  await page.getByTestId("ai-retry-confirm").click();

  await expect(page.getByText("正式执行回执")).toBeVisible();
  expect(control.confirmations).toHaveLength(2);
  expect(control.confirmations[1]).toEqual(control.confirmations[0]);
  expect(control.confirmations[0]).toMatchObject({
    candidateId: fixture.candidateA,
    candidateHash: "candidate-hash-A",
  });
  await expect(page.getByText("同一操作的幂等恢复回执")).toBeVisible();
});

test("renders fallback source and a non-retryable no-claim state", async ({
  page,
}) => {
  const fallback = await gotoTask(page, (item) => {
    item.sourceKind = "fallback";
  });
  await openAi(page);
  await expect(page.getByText("确定性降级建议")).toBeVisible();
  expect(fallback.generates).toHaveLength(1);

  fallback.generateFailure = { status: 409, code: "NO_CLAIM_ACTION" };
  await page.reload();
  await openAi(page);
  await expect(page.getByText("当前没有可建议的领取动作")).toBeVisible();
  await expect(page.getByTestId("ai-confirm")).toHaveCount(0);
  await expect(page.getByTestId("ai-retry-generate")).toHaveCount(0);
});

test("drops late generate, get, confirm, and reject responses after task A switches to B", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "late-response matrix runs once",
  );
  const control = await gotoTask(page, (item) => {
    item.holdNext.generate = fixture.taskA;
  });
  await expect.poll(() => Boolean(control.releases.generate)).toBe(true);
  await selectTask(page, control, fixture.taskB);
  control.releases.generate?.();
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取任务 B"),
  ).toBeVisible();
  await expect(page.getByText("当前测试 fixture：建议领取任务 A")).toHaveCount(
    0,
  );

  await selectTask(page, control, fixture.taskA);
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取任务 A"),
  ).toBeVisible();
  control.confirmStatuses.push(409);
  control.holdNext.get = fixture.taskA;
  await page.getByTestId("ai-confirm").click();
  await expect.poll(() => Boolean(control.releases.get)).toBe(true);
  await selectTask(page, control, fixture.taskB);
  control.releases.get?.();
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取任务 B"),
  ).toBeVisible();

  await selectTask(page, control, fixture.taskA);
  await openAi(page);
  control.holdNext.confirm = fixture.taskA;
  await page.getByTestId("ai-confirm").click();
  await expect.poll(() => Boolean(control.releases.confirm)).toBe(true);
  await selectTask(page, control, fixture.taskB);
  control.releases.confirm?.();
  await openAi(page);
  await expect(page.getByText("正式执行回执")).toHaveCount(0);

  await selectTask(page, control, fixture.taskA);
  await openAi(page);
  control.holdNext.reject = fixture.taskA;
  await page.getByTestId("ai-reject").click();
  await expect.poll(() => Boolean(control.releases.reject)).toBe(true);
  await selectTask(page, control, fixture.taskB);
  control.releases.reject?.();
  await openAi(page);
  await expect(page.getByText("已拒绝建议")).toHaveCount(0);
  await expect(
    page.getByText("当前测试 fixture：建议领取任务 B"),
  ).toBeVisible();
});

test("keyboard mode switching restores outer scroll and keeps AI in the context screen", async ({
  page,
}) => {
  const control = await gotoTask(page);
  void control;
  if (page.viewportSize()?.width === 390) {
    const navigation = page.getByRole("navigation", { name: "工作台办理步骤" });
    await expect(navigation).toContainText("队列详情上下文");
    await page.getByRole("button", { name: "上下文", exact: true }).click();
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  }
  const contextPane = page.locator('[data-workbench-pane="context"]');
  const scrollOwner = contextPane.locator(
    ".workbench-pane__scroll--independent",
  );
  if (page.viewportSize()?.width === 390) {
    await contextPane.evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
  }
  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(
      80,
      element.scrollHeight - element.clientHeight,
    );
  });
  const workScroll = await scrollOwner.evaluate((element) => element.scrollTop);
  const aiMode = page.getByRole("button", { name: "AI 辅助", exact: true });
  await aiMode.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("拒绝原因（可选）")).toBeVisible();
  await page.getByLabel("拒绝原因（可选）").focus();
  const workMode = page.getByRole("button", { name: "办理", exact: true });
  await workMode.focus();
  await page.keyboard.press("Enter");
  await expect(workMode).toBeFocused();
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBe(workScroll);
});

test("AI viewport evidence keeps the established three-pane geometry", async ({
  page,
}) => {
  await gotoTask(page);
  await openAi(page);
  await expect(
    page.getByText("当前测试 fixture：建议领取任务 A"),
  ).toBeVisible();
  const contextPane = page.locator('[data-workbench-pane="context"]');
  if (page.viewportSize()?.width === 390) {
    await contextPane.evaluate((element) => {
      const pageScrollOwner = element.closest<HTMLElement>(".app-content");
      if (!pageScrollOwner) throw new Error("Missing app content scroll owner");
      pageScrollOwner.scrollTop +=
        element.getBoundingClientRect().top -
        pageScrollOwner.getBoundingClientRect().top;
    });
    await expect
      .poll(() =>
        contextPane.evaluate((element) => {
          const pageScrollOwner = element.closest<HTMLElement>(".app-content");
          if (!pageScrollOwner) return Number.POSITIVE_INFINITY;
          return Math.abs(
            element.getBoundingClientRect().top -
              pageScrollOwner.getBoundingClientRect().top,
          );
        }),
      )
      .toBeLessThanOrEqual(1);
  }
  const scrollOwner = contextPane.locator(
    ".workbench-pane__scroll--independent",
  );
  await scrollOwner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(
    page.getByRole("button", { name: "AI 辅助", exact: true }),
  ).toBeVisible();
  const aiPanel = page.locator("[data-task-ai-assistance-panel]");
  const taskStep = aiPanel.getByText("当前任务与动作", { exact: true });
  const sourceStep = aiPanel.getByText("建议来源与依据", { exact: true });
  const impactStep = aiPanel.getByText("影响与风险", { exact: true });
  await expect(taskStep).toBeVisible();
  await expect(taskStep).toBeInViewport();
  await expect(
    aiPanel.getByRole("heading", {
      name: `${fixture.containerNumber} · 提柜`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    aiPanel.getByText(`当前领取工单 ${fixture.workOrderA}`, { exact: true }),
  ).toBeVisible();
  await expect(sourceStep).toBeVisible();
  await expect(sourceStep).toBeInViewport();
  await expect(aiPanel.getByText("规则建议", { exact: true })).toBeVisible();
  await expect(
    aiPanel
      .locator('[data-ai-spine-step="source"]')
      .locator(".task-ai__reference"),
  ).toHaveText("task.claim-assistance / v1");
  await expect(
    aiPanel.getByText("当前服务端快照表明该工单可领取。", { exact: true }),
  ).toBeVisible();
  await expect(
    aiPanel.getByText(
      "确认后服务端会重新验证当前身份、task.execute、tenant/object scope、当前业务状态和并发版本。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(impactStep).toBeVisible();
  await expect(impactStep).toBeInViewport({ ratio: 0.01 });
  await expectNoNestedScrollOwner(page);
  await expectNoHorizontalOverflow(page);

  if (page.viewportSize()?.width === 1440) {
    const geometry = await page
      .locator("[data-workbench-pane]")
      .evaluateAll((panes) =>
        panes.map((pane) => {
          const box = pane.getBoundingClientRect();
          return { y: Math.round(box.y), height: Math.round(box.height) };
        }),
      );
    expect(new Set(geometry.map((item) => item.y)).size).toBe(1);
    expect(new Set(geometry.map((item) => item.height)).size).toBe(1);
  }
  if (page.viewportSize()?.width === 1024) {
    const detail = await page
      .locator('[data-workbench-pane="detail"]')
      .boundingBox();
    const context = await contextPane.boundingBox();
    expect(Math.abs((detail?.y ?? 0) - (context?.y ?? 0))).toBeLessThanOrEqual(
      1,
    );
    expect(detail?.x ?? 0).toBeLessThan(context?.x ?? 0);
  }
  if (page.viewportSize()?.width === 390) {
    await expect(
      page.locator('[data-workbench-pane="context"]'),
    ).toHaveAttribute("data-mobile-active", "true");
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  }
  await scrollOwner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(taskStep).toBeInViewport();
  await expect(sourceStep).toBeInViewport();
  await expect(impactStep).toBeInViewport({ ratio: 0.01 });
  await expect(page).toHaveScreenshot(
    "task-ai-assisted-execution.png",
    screenshotOptions,
  );
});
