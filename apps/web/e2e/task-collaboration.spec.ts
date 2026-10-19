import { expect, test, type Page } from "@playwright/test";

const fixture = {
  containerId: "11111111-1111-4111-8111-111111111111",
  containerNumber: "E2E-COLLAB-01",
  activeTaskId: "22222222-2222-4222-8222-222222222222",
  completedTaskId: "33333333-3333-4333-8333-333333333333",
  parentMessageId: "44444444-4444-4444-8444-444444444444",
  latestMessageId: "55555555-5555-4555-8555-555555555555",
  completedMessageId: "66666666-6666-4666-8666-666666666666",
  evidenceId: "77777777-7777-4777-8777-777777777777",
  actorId: "operator-e2e",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
  threshold: 0.3,
};

interface FixtureControl {
  visibleTaskId: string;
  failNextGetStatus: number | null;
  failNextPost: boolean;
  hideEvidence: boolean;
  nextPagination: "normal" | "drift" | "fail";
  holdNextTaskId: string | null;
  releaseHeld: (() => void) | null;
  posts: Array<Record<string, unknown>>;
  gets: string[];
}

function nodeTaskPage() {
  return {
    items: [
      {
        id: fixture.activeTaskId,
        flowInstanceId: "flow-active",
        nodeInstanceId: "node-active",
        nodeCode: "container_stuffing",
        containerId: fixture.containerId,
        taskDefinitionKey: "node-container-stuffing",
        state: "in_progress",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [
          {
            id: "work-order-active",
            workOrderDefinitionKey: "wo-container-stuffing",
            state: "in_progress",
            assignmentState: "assigned",
            assigneeId: fixture.actorId,
            dueAt: "2026-10-18T08:00:00.000Z",
            completedAt: null,
          },
        ],
        outcome: null,
        nextAction: {
          actionCode: "work_execution.complete_work_order",
          workOrderId: "work-order-active",
          workOrderDefinitionKey: "wo-container-stuffing",
          assignmentState: "assigned",
          assigneeId: fixture.actorId,
          dueAt: "2026-10-18T08:00:00.000Z",
        },
      },
      {
        id: fixture.completedTaskId,
        flowInstanceId: "flow-completed",
        nodeInstanceId: "node-completed",
        nodeCode: "customs_clearance",
        containerId: fixture.containerId,
        taskDefinitionKey: "node-customs",
        state: "completed",
        applicability: "required",
        readinessState: "ready",
        completionEligibility: "eligible",
        conditionFactRefs: [],
        workOrders: [
          {
            id: "work-order-completed",
            workOrderDefinitionKey: "wo-customs",
            state: "completed",
            assignmentState: "assigned",
            assigneeId: fixture.actorId,
            dueAt: "2026-10-17T08:00:00.000Z",
            completedAt: "2026-10-17T07:45:00.000Z",
          },
        ],
        outcome: {
          id: "outcome-1",
          previousState: "in_progress",
          nextState: "completed",
          resultPolicyMode: "all_required_work_orders_completed",
          eventCode: "container_customs_completed",
          requiredWorkOrderIds: ["work-order-completed"],
          completedWorkOrderIds: ["work-order-completed"],
          evaluatedAt: "2026-10-17T07:45:00.000Z",
        },
        nextAction: null,
      },
    ],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
    asOf: "2026-10-18T08:30:00.000Z",
    projectionVersion: 17,
  };
}

function collaborationMessage(
  messageId: string,
  body: string,
  parentMessageId: string | null = null,
  withEvidence = false,
) {
  return {
    contractVersion: "task-collaboration-message.v1",
    messageId,
    threadId: "88888888-8888-4888-8888-888888888888",
    author: {
      kind: "actor",
      id: fixture.actorId,
      displayName: "当前经办人",
    },
    body,
    parentMessageId,
    mentions: [],
    evidenceRefs: withEvidence
      ? [{ kind: "evidence_record", id: fixture.evidenceId }]
      : [],
    sourceRefs: [],
    occurredAt: "2026-10-18T08:01:00.000Z",
    recordedAt: "2026-10-18T08:01:01.000Z",
  };
}

function collaborationPage(
  taskId: string,
  control: FixtureControl,
  cursor: string | null,
) {
  const isCompleted = taskId === fixture.completedTaskId;
  const asOf =
    cursor && control.nextPagination === "drift"
      ? "2026-10-18T09:00:00.000Z"
      : "2026-10-18T08:30:00.000Z";
  const messages = cursor
    ? [
        collaborationMessage(
          "99999999-9999-4999-8999-999999999999",
          "更早的协作记录",
        ),
      ]
    : isCompleted
      ? [
          collaborationMessage(
            fixture.completedMessageId,
            "已完成任务的历史协作",
          ),
        ]
      : [
          collaborationMessage(
            fixture.latestMessageId,
            "请回复并核对当前证据引用",
            fixture.parentMessageId,
            !control.hideEvidence,
          ),
          collaborationMessage(fixture.parentMessageId, "这是父消息摘要"),
          collaborationMessage(
            "10101010-1010-4010-8010-101010101010",
            "当前任务协作记录三",
          ),
          collaborationMessage(
            "12121212-1212-4212-8212-121212121212",
            "当前任务协作记录四",
          ),
        ];
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: {
      contractVersion: "task-collaboration-thread.v1",
      threadId: "88888888-8888-4888-8888-888888888888",
      subjectRef: { kind: "container", id: fixture.containerId },
      workRef: { kind: "node_task", id: taskId },
      visibility: "task_scope",
      policyVersion: 1,
      createdAt: "2026-10-18T08:00:00.000Z",
    },
    subjectRef: { kind: "container", id: fixture.containerId },
    workRef: { kind: "node_task", id: taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages,
    asOf,
    pageSize: 25,
    nextCursor: cursor ? null : "older-page",
    canPost: !isCompleted,
    postDisabledReason: isCompleted ? "任务已完成，只能查看历史协作。" : null,
    mentionOptions: isCompleted
      ? []
      : [
          {
            kind: "actor",
            id: fixture.actorId,
            displayName: "当前经办人",
          },
        ],
    evidenceOptions:
      isCompleted || control.hideEvidence
        ? []
        : [
            {
              ref: { kind: "evidence_record", id: fixture.evidenceId },
              label: "装箱照片",
            },
          ],
  };
}

function activityPage() {
  return {
    items: Array.from({ length: 14 }, (_, index) => ({
      id: "activity-" + index,
      activityCode: index % 2 ? "task_created" : "work_order_completed",
      sourceType: "node_task",
      sourceId: "source-" + index,
      occurredAt: "2026-10-17T07:30:00.000Z",
      recordedAt: "2026-10-17T07:31:00.000Z",
      containerId: fixture.containerId,
      taskId: fixture.activeTaskId,
      workOrderId: null,
      actorId: null,
      nodeCode: "container_stuffing",
      title: "装箱任务记录",
      detail: "当前可见档案记录 " + (index + 1),
      severity: null,
      targetPath: null,
    })),
    nextActions: [],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
    asOf: "2026-10-18T08:30:00.000Z",
    projectionVersion: 23,
  };
}

async function installFixture(page: Page): Promise<FixtureControl> {
  const control: FixtureControl = {
    visibleTaskId: fixture.activeTaskId,
    failNextGetStatus: null,
    failNextPost: false,
    hideEvidence: false,
    nextPagination: "normal",
    holdNextTaskId: null,
    releaseHeld: null,
    posts: [],
    gets: [],
  };
  await page.route(/\/api\/containers(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            id: fixture.containerId,
            orderNumber: "E2E-COLLAB-ORDER-01",
            containerNumber: fixture.containerNumber,
            currentStatus: "at_port",
            updatedAt: "2026-10-18T08:00:00.000Z",
          },
        ],
        pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 200 },
        asOf: "2026-10-18T08:30:00.000Z",
        projectionVersion: 11,
      },
    });
  });
  await page.route(/\/api\/node-tasks(?:\?.*)?$/, async (route) => {
    await route.fulfill({ json: nodeTaskPage() });
  });
  await page.route(
    new RegExp(
      "/api/containers/" + fixture.containerId + "/activities(?:\\?.*)?$",
    ),
    async (route) => {
      await route.fulfill({ json: activityPage() });
    },
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/collaboration(?:\?.*)?$/,
    async (route) => {
      const url = new URL(route.request().url());
      const taskId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
      expect(taskId).toBe(control.visibleTaskId);
      expect(url.searchParams.get("subjectKind")).toBe("container");
      expect(url.searchParams.get("subjectId")).toBe(fixture.containerId);
      const failStatus = control.failNextGetStatus;
      if (failStatus !== null) control.failNextGetStatus = null;
      const paginationBehavior = control.nextPagination;
      if (url.searchParams.has("cursor")) control.nextPagination = "normal";
      control.gets.push(
        taskId +
          ":" +
          (url.searchParams.get("cursor") ?? "first") +
          ":" +
          failStatus,
      );
      if (control.holdNextTaskId === taskId) {
        control.holdNextTaskId = null;
        await new Promise<void>((resolve) => {
          control.releaseHeld = resolve;
        });
        control.releaseHeld = null;
      }
      if (failStatus !== null) {
        await route.fulfill({
          status: failStatus,
          json: {
            message: "COLLABORATION_" + failStatus,
            traceId: "trace-e2e",
          },
        });
        return;
      }
      const cursor = url.searchParams.get("cursor");
      if (cursor && paginationBehavior === "fail") {
        await route.fulfill({
          status: 503,
          json: { message: "PAGINATION_FAILED", traceId: "trace-page" },
        });
        return;
      }
      const pageControl = {
        ...control,
        nextPagination: paginationBehavior,
      };
      const response = collaborationPage(taskId, pageControl, cursor);
      await route.fulfill({ json: response });
    },
  );
  await page.route(
    /\/api\/node-tasks\/([^/]+)\/collaboration\/messages$/,
    async (route) => {
      const command = route.request().postDataJSON() as Record<string, unknown>;
      control.posts.push(command);
      if (control.failNextPost) {
        control.failNextPost = false;
        await route.fulfill({
          status: 503,
          json: { message: "POST_FAILED", traceId: "trace-post" },
        });
        return;
      }
      const repeated = control.posts.filter(
        ({ idempotencyKey }) => idempotencyKey === command.idempotencyKey,
      ).length;
      await route.fulfill({
        json: {
          contractVersion: "task-collaboration-post-result.v1",
          message: {
            ...collaborationMessage(
              "13131313-1313-4313-8313-131313131313",
              String(command.body),
              (command.parentMessageId as string | null) ?? null,
              Array.isArray(command.evidenceRecordIds) &&
                command.evidenceRecordIds.length > 0,
            ),
            mentions: Array.isArray(command.mentionActorIds)
              ? command.mentionActorIds.map((id) => ({
                  kind: "actor",
                  id,
                  displayName: "当前经办人",
                }))
              : [],
          },
          idempotencyReplay: repeated > 1,
        },
      });
    },
  );
  return control;
}

async function gotoActiveTask(page: Page): Promise<FixtureControl> {
  const control = await installFixture(page);
  await page.goto(
    "/tasks?containerId=" +
      fixture.containerId +
      "&task=" +
      fixture.activeTaskId,
  );
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  return control;
}

async function openCollaboration(page: Page): Promise<void> {
  if (page.viewportSize()?.width === 390) {
    await page.getByRole("button", { name: "上下文", exact: true }).click();
  }
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("请回复并核对当前证据引用")).toBeVisible();
}

function taskSelector(taskId: string): string {
  return '[data-task-id="' + taskId + '"]';
}

async function selectFixtureTask(
  page: Page,
  control: FixtureControl,
  taskId: string,
): Promise<void> {
  control.visibleTaskId = taskId;
  await page.locator(taskSelector(taskId)).click();
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
          ...measure(pane),
        }),
      ),
    };
  });
  expect(facts.document.scroll).toBeLessThanOrEqual(facts.document.client + 1);
  expect(facts.appContent.scroll).toBeLessThanOrEqual(
    facts.appContent.client + 1,
  );
  for (const pane of facts.panes) {
    expect(pane.scroll, pane.id + " pane overflow").toBeLessThanOrEqual(
      pane.client + 1,
    );
  }
}

async function expectNoNestedScrollOwner(page: Page): Promise<void> {
  const overflowOwners = await page
    .locator(
      ".task-context, .task-context__mode, .collaboration, .collaboration__messages, .collaboration-composer",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) =>
          /(auto|scroll)/.test(
            getComputedStyle(element).overflow +
              " " +
              getComputedStyle(element).overflowY,
          ),
        )
        .map((element) => (element as HTMLElement).className),
    );
  expect(overflowOwners).toEqual([]);
}

test("desktop consumes DTOs, restores modes, and retries the exact command", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "desktop behavior only");
  const control = await gotoActiveTask(page);
  await openCollaboration(page);

  const contextPane = page.locator('[data-workbench-pane="context"]');
  const scrollOwner = contextPane.locator(
    ".workbench-pane__scroll--independent",
  );
  const archiveRoot = page.locator('[data-context-mode="archive"]');
  await page.getByRole("button", { name: "档案", exact: true }).click();
  const archiveFocus = page.getByTestId("archive-refresh");
  await archiveFocus.focus();
  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(
      160,
      element.scrollHeight - element.clientHeight,
    );
  });
  const archiveScroll = await scrollOwner.evaluate(
    (element) => element.scrollTop,
  );
  expect(archiveScroll).toBeGreaterThan(0);

  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(archiveRoot).toHaveAttribute("hidden", "");
  await expect(archiveRoot).toHaveAttribute("inert", "");
  await expect(archiveRoot).toHaveAttribute("aria-hidden", "true");
  const draft = page.getByRole("textbox", { name: "协作消息" });
  await draft.focus();
  await scrollOwner.evaluate((element) => {
    element.scrollTop = Math.min(
      90,
      element.scrollHeight - element.clientHeight,
    );
  });
  const collaborationScroll = await scrollOwner.evaluate(
    (element) => element.scrollTop,
  );
  expect(collaborationScroll).toBeGreaterThan(0);

  await page.getByRole("button", { name: "档案", exact: true }).click();
  await expect(archiveFocus).toBeFocused();
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBe(archiveScroll);
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(draft).toBeFocused();
  await expect
    .poll(() => scrollOwner.evaluate((element) => element.scrollTop))
    .toBe(collaborationScroll);

  await page
    .locator('[data-reply-id="' + fixture.latestMessageId + '"]')
    .click();
  await page.locator('[data-mention-id="' + fixture.actorId + '"]').check();
  await page.locator('[data-evidence-id="' + fixture.evidenceId + '"]').check();
  await draft.fill("E2E 协作回复");
  control.failNextPost = true;
  await page.getByTestId("collaboration-send").click();
  await expect(page.getByTestId("send-error")).toContainText("POST_FAILED");
  await expect(draft).toHaveValue("E2E 协作回复");
  await page.getByTestId("collaboration-send-retry").click();
  await expect(page.getByText("E2E 协作回复", { exact: true })).toBeVisible();

  expect(control.posts).toHaveLength(2);
  expect(control.posts[1]).toEqual(control.posts[0]);
  expect(control.posts[0]).toMatchObject({
    contractVersion: "task-collaboration-post-command.v1",
    subjectRef: { kind: "container", id: fixture.containerId },
    workRef: { kind: "node_task", id: fixture.activeTaskId },
    body: "E2E 协作回复",
    parentMessageId: fixture.latestMessageId,
    mentionActorIds: [fixture.actorId],
    evidenceRecordIds: [fixture.evidenceId],
    sourceRefs: [],
  });
  expect(control.posts[0]).not.toHaveProperty("tenantId");
  expect(control.posts[0]).not.toHaveProperty("authorActorId");
  expect(control.posts[0]).not.toHaveProperty("visibility");
  await expectNoNestedScrollOwner(page);
  await expectNoHorizontalOverflow(page);
});

test("desktop clears late, forbidden, missing, and changed pages", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "desktop failure behavior only",
  );
  const control = await installFixture(page);
  control.holdNextTaskId = fixture.activeTaskId;
  await page.goto(
    "/tasks?containerId=" +
      fixture.containerId +
      "&task=" +
      fixture.activeTaskId,
  );
  await expect(
    page.locator(taskSelector(fixture.completedTaskId)),
  ).toBeVisible();
  await selectFixtureTask(page, control, fixture.completedTaskId);
  await expect.poll(() => control.releaseHeld !== null).toBe(true);
  control.releaseHeld?.();
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("已完成任务的历史协作")).toBeVisible();
  await expect(page.getByText("请回复并核对当前证据引用")).toHaveCount(0);
  await expect(page.getByText("任务已完成，只能查看历史协作。")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "协作消息" })).toHaveCount(0);

  control.failNextGetStatus = 403;
  await selectFixtureTask(page, control, fixture.activeTaskId);
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("装箱完成");
  await expect.poll(() => control.gets.length).toBe(3);
  expect(control.gets).toEqual([
    fixture.activeTaskId + ":first:null",
    fixture.completedTaskId + ":first:null",
    fixture.activeTaskId + ":first:403",
  ]);
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("COLLABORATION_403");
  await expect(page.getByText("已完成任务的历史协作")).toHaveCount(0);
  await page.getByTestId("collaboration-retry").click();
  await expect(page.getByText("请回复并核对当前证据引用")).toBeVisible();

  control.failNextGetStatus = 404;
  await selectFixtureTask(page, control, fixture.completedTaskId);
  await expect(page.getByTestId("frozen-outcome")).toHaveText("已完成");
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("COLLABORATION_404");
  await expect(page.getByText("请回复并核对当前证据引用")).toHaveCount(0);
  await page.getByTestId("collaboration-retry").click();
  await expect(page.getByText("已完成任务的历史协作")).toBeVisible();

  await selectFixtureTask(page, control, fixture.activeTaskId);
  await expect(
    page.getByRole("region", { name: "当前任务详情" }),
  ).toContainText("装箱完成");
  await page.getByRole("button", { name: "协作", exact: true }).click();
  await expect(page.getByText("请回复并核对当前证据引用")).toBeVisible();
  control.nextPagination = "drift";
  await page.getByTestId("collaboration-load-more").click();
  await expect(page.getByRole("alert")).toContainText("快照");
  await expect(page.getByText("请回复并核对当前证据引用")).toHaveCount(0);
  await page.getByTestId("collaboration-retry").click();
  await expect(page.getByText("请回复并核对当前证据引用")).toBeVisible();
  control.nextPagination = "fail";
  await page.getByTestId("collaboration-load-more").click();
  await expect(page.getByRole("alert")).toContainText("PAGINATION_FAILED");
  await expect(page.getByText("请回复并核对当前证据引用")).toHaveCount(0);
});

test("desktop does not reveal filtered EvidenceRef existence", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "desktop redaction only");
  const control = await installFixture(page);
  control.hideEvidence = true;
  await page.goto(
    "/tasks?containerId=" +
      fixture.containerId +
      "&task=" +
      fixture.activeTaskId,
  );
  await openCollaboration(page);
  await expect(
    page.locator('[data-evidence-id="' + fixture.evidenceId + '"]'),
  ).toHaveCount(0);
  expect(await page.locator("body").textContent()).not.toContain(
    fixture.evidenceId,
  );
  await expect(page.getByText(/隐藏了|未显示 \d+|隐藏附件/)).toHaveCount(0);
  await expect(
    page.getByText("仅显示当前有权读取的证据引用；未显示不表示不存在。"),
  ).toBeVisible();
});

test("desktop collaboration viewport structure is stable", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 1440, "desktop evidence only");
  await gotoActiveTask(page);
  await openCollaboration(page);
  await expect(page.locator("[data-workbench-pane]")).toHaveCount(3);
  const geometry = await page
    .locator("[data-workbench-pane]")
    .evaluateAll((panes) =>
      panes.map((pane) => {
        const box = pane.getBoundingClientRect();
        return { y: box.y, height: box.height };
      }),
    );
  expect(new Set(geometry.map(({ y }) => Math.round(y))).size).toBe(1);
  expect(new Set(geometry.map(({ height }) => Math.round(height))).size).toBe(
    1,
  );
  await page.getByTestId("collaboration-send").scrollIntoViewIfNeeded();
  await expectNoNestedScrollOwner(page);
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(
    "task-collaboration.png",
    screenshotOptions,
  );
});

test("narrow collaboration keeps detail and context adjacent", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1024, "narrow evidence only");
  await gotoActiveTask(page);
  await openCollaboration(page);
  const detail = await page
    .locator('[data-workbench-pane="detail"]')
    .boundingBox();
  const context = await page
    .locator('[data-workbench-pane="context"]')
    .boundingBox();
  expect(Math.abs((detail?.y ?? 0) - (context?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(detail?.x ?? 0).toBeLessThan(context?.x ?? 0);
  await expect(page.getByTestId("collaboration-send")).toBeVisible();
  await page.getByTestId("collaboration-send").scrollIntoViewIfNeeded();
  await expectNoNestedScrollOwner(page);
  await expectNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(
    "task-collaboration.png",
    screenshotOptions,
  );
});

test("mobile keeps collaboration inside the third context screen", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile evidence only");
  await gotoActiveTask(page);
  const nav = page.getByRole("navigation", { name: "工作台办理步骤" });
  await expect(nav).toContainText("队列详情上下文");
  await expect(page.locator("[data-workbench-pane]")).toHaveCount(3);
  await expect(page.locator('[data-workbench-pane="detail"]')).toHaveAttribute(
    "data-mobile-active",
    "true",
  );
  await openCollaboration(page);
  await expect(page.locator('[data-workbench-pane="context"]')).toHaveAttribute(
    "data-mobile-active",
    "true",
  );
  await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  const draft = page.getByRole("textbox", { name: "协作消息" });
  await draft.scrollIntoViewIfNeeded();
  await expect(draft).toBeVisible();
  await expect(page.getByTestId("collaboration-send")).toBeVisible();
  await expectNoNestedScrollOwner(page);
  await expectNoHorizontalOverflow(page);
  await nav.scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot(
    "task-collaboration.png",
    screenshotOptions,
  );
});
