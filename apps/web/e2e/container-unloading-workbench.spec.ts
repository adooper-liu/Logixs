import { expect, test, type Page } from "@playwright/test";

type MutableUnloadingTask = {
  id: string;
  state: string;
  [key: string]: unknown;
  workOrders: Array<{
    id: string;
    state: string;
    assignmentState: string;
    assigneeId: string | null;
    completedAt: string | null;
    [key: string]: unknown;
  }>;
  nextAction: {
    actionCode: string;
    [key: string]: unknown;
  } | null;
};

test("warehouse operator records partial unloading then submits completed unloading for review", async ({
  page,
}) => {
  let report: Record<string, unknown> | null = null;
  let unloadingFact: Record<string, unknown> | null = null;
  const reportCommands: Record<string, unknown>[] = [];
  let factCommand: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body =
      request.method() === "POST"
        ? (request.postDataJSON() as Record<string, unknown>)
        : {};
    const aiMatch = path.match(/\/node-tasks\/([^/]+)\/ai\/action-candidates/);
    if (aiMatch) {
      const candidate = {
        candidateId: "41111111-1111-4111-8111-111111111111",
        candidateHash: "synthetic-unloading-candidate",
        context: {
          subjectRef: {
            kind: "container",
            id: "11111111-1111-4111-8111-111111111111",
          },
          workRef: { kind: "node_task", id: aiMatch[1] },
        },
        workOrderId: "31111111-1111-4111-8111-111111111111",
        actionCode: "work_execution.claim_work_order",
        actionVersion: 1,
        title: "建议领取当前卸柜工单",
        rationale: "合成演练：领取建立工单责任。",
        impact: "领取不证明卸柜报告、日期采信或卸空。",
        riskLevel: "low",
        warningCodes: [],
        status: "proposed",
        source: {
          kind: "rule",
          capabilityId: "task.claim-assistance",
          capabilityVersion: 1,
          schemaVersion: 1,
          promptVersion: null,
          modelId: null,
          inputSnapshotHash: "synthetic-input",
          inputRefs: [],
          generatedAt: "2026-10-24T00:00:00.000Z",
        },
      };
      if (path.endsWith("/confirmations")) {
        await route.fulfill({
          json: {
            contractVersion: "task-action-candidate-confirm-result.v1",
            candidate: { ...candidate, status: "accepted" },
            decision: null,
            claimWorkOrderResult: {
              workOrderId: "31111111-1111-4111-8111-111111111111",
              workOrderState: "in_progress",
              taskId: aiMatch[1],
              taskState: "in_progress",
              assignmentState: "assigned",
              assigneeId: "operator",
              applied: true,
              clientOperationId: "op-1",
              receptionState: "received",
              businessDecisionState: "accepted",
              commitState: "committed",
              committedAt: "2026-10-24T00:00:00.000Z",
            },
            idempotencyReplay: false,
          },
        });
      } else await route.fulfill({ json: candidate });
      return;
    }
    const workOrderMatch = path.match(
      /\/work-orders\/([^/]+)\/(claim|complete)$/,
    );
    if (workOrderMatch) {
      const completing = workOrderMatch[2] === "complete";
      const current = taskPage.items[0];
      if (!current) throw new Error("missing unloading task fixture");
      const currentWorkOrder = current.workOrders[0];
      if (!currentWorkOrder) throw new Error("missing work order fixture");
      const currentNextAction = current.nextAction;
      if (!currentNextAction) throw new Error("missing next action fixture");
      current.workOrders[0] = {
        ...currentWorkOrder,
        state: completing ? "completed" : "in_progress",
        assignmentState: completing ? "assigned" : "assigned",
        assigneeId: "dev-operator",
        completedAt: completing ? "2026-10-24T00:05:00Z" : null,
      };
      current.state = completing ? "completed" : "in_progress";
      current.nextAction = completing
        ? null
        : {
            ...currentNextAction,
            actionCode: "work_execution.complete_work_order",
          };
      await route.fulfill({
        json: {
          workOrderId: workOrderMatch[1],
          workOrderState: completing ? "completed" : "in_progress",
          taskId: current.id,
          taskState: current.state,
          assignmentState: "assigned",
          assigneeId: "dev-operator",
          applied: true,
          clientOperationId: `unloading-${workOrderMatch[2]}`,
          receptionState: "received",
          businessDecisionState: "accepted",
          commitState: "committed",
          committedAt: "2026-10-24T00:05:00Z",
        },
      });
      return;
    }
    if (path.endsWith("/collaboration")) {
      await route.fulfill({
        json: {
          contractVersion: "task-collaboration-page.v1",
          thread: null,
          subjectRef: {
            kind: "container",
            id: "11111111-1111-4111-8111-111111111111",
          },
          workRef: {
            kind: "node_task",
            id: "21111111-1111-4111-8111-111111111111",
          },
          visibility: "task_scope",
          visibilityLabel: "当前任务参与者",
          messages: [],
          asOf: "2026-10-24T00:00:00Z",
          pageSize: 25,
          nextCursor: null,
          canPost: false,
          postDisabledReason: "合成只读演练",
          mentionOptions: [],
          evidenceOptions: [],
        },
      });
      return;
    }
    if (
      path ===
      "/api/containers/11111111-1111-4111-8111-111111111111/unloading-report"
    ) {
      if (request.method() === "POST") {
        const command = body;
        reportCommands.push(command);
        report = {
          reportId: `44444444-4444-4444-8444-44444444444${reportCommands.length}`,
          containerRecordId: "11111111-1111-4111-8111-111111111111",
          version: reportCommands.length,
          ...command,
          evidenceRefs: command.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: command.reasonCode,
          createdAt: "2026-09-21T05:00:00Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: report,
      });
      return;
    }
    if (
      path === "/api/containers/11111111-1111-4111-8111-111111111111/date-facts"
    ) {
      if (request.method() === "POST") {
        factCommand = request.postDataJSON() as Record<string, unknown>;
        unloadingFact = {
          factId: "55555555-5555-4555-8555-555555555555",
          nodeCode: "container_unloading",
          eventCode: "unloaded",
          timeKind: "actual",
          occurredAt: factCommand.occurredAt,
          rawValue: factCommand.rawValue,
          sourceUtcOffset: factCommand.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "warehouse-receiving",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: null,
          location: factCommand.location,
          evidenceRefs: factCommand.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 3,
          recordedAt: "2026-09-21T05:10:00Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: unloadingFact.factId,
            recordState: "recorded",
            applicationState: "review_required",
            reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
            canonicalEventId: null,
            projectionVersion: 3,
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            items: unloadingFact
              ? [deliveryFact, unloadingFact]
              : [deliveryFact],
            projectionVersion: unloadingFact ? 3 : 2,
            asOf: "2026-09-21T05:10:00Z",
          },
        });
      }
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: responseFor(path),
    });
  });

  await page.goto(
    "/workspaces/unloading?containerId=11111111-1111-4111-8111-111111111111",
  );
  await expect(
    page.getByRole("heading", { name: "卸柜", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("开始或部分卸货只更新进度")).toBeVisible();

  if (test.info().project.name === "mobile-chromium") {
    await page.locator('[data-mobile-target="detail"]').click();
    await page.locator('[data-mobile-target="context"]').click();
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
  }

  const detailPane = page.locator('[data-workbench-pane="context"]');
  const partialButton = detailPane
    .locator(".segmented")
    .first()
    .locator("button")
    .nth(1);
  await partialButton.scrollIntoViewIfNeeded();
  await partialButton.focus();
  await page.keyboard.press("Enter");
  await detailPane.getByLabel(/卸货开始时间/).fill("2026-04-23T08:00");
  await detailPane.getByLabel("计划数量").fill("524");
  await detailPane.getByLabel("已卸数量").fill("300");
  await detailPane.getByLabel("剩余数量").fill("224");
  await page
    .getByLabel("卸货清单、照片或仓方确认")
    .fill("33333333-3333-4333-8333-333333333333");
  await detailPane.getByRole("button", { name: "保存卸货进度" }).click();
  await expect(
    page
      .getByRole("region", { name: "卸货进度" })
      .getByText("部分卸货", { exact: true }),
  ).toBeVisible();
  expect(factCommand).toBeNull();

  await detailPane.getByRole("button", { name: "卸柜完成" }).click();
  await detailPane.getByLabel("实际卸完时间").fill("2026-04-23T10:30");
  await detailPane.getByLabel("已卸数量").fill("524");
  await detailPane.getByLabel("剩余数量").fill("0");
  await detailPane.getByRole("button", { name: "保存完成并提交复核" }).click();

  await expect(
    page.getByText("卸柜完成已保存，等待另一名复核人采信"),
  ).toBeVisible();
  expect(reportCommands).toHaveLength(2);
  expect(reportCommands[0]).toMatchObject({
    operationState: "partial",
    remainingQuantity: "224",
  });
  expect(reportCommands[1]).toMatchObject({
    operationState: "completed",
    remainingQuantity: "0",
  });
  expect(factCommand).toMatchObject({
    nodeCode: "container_unloading",
    eventCode: "unloaded",
    timeKind: "actual",
    authoritySystem: "warehouse-receiving",
    location: {
      locationType: "warehouse",
      locationId: instruction.warehouseLocationId,
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
    },
  });

  await page.locator('[data-mode-control="work"]').click();
  const workEvidence = await captureViewportEvidence(page, "work");
  await test.info().attach("unloading-work-viewport-evidence", {
    body: Buffer.from(JSON.stringify(workEvidence, null, 2)),
    contentType: "application/json",
  });
  assertViewportEvidence(workEvidence);

  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await expect(
    page.getByText("建议领取当前卸柜工单", { exact: true }),
  ).toBeVisible();
  const aiEvidence = await captureViewportEvidence(page, "ai");
  await test.info().attach("unloading-ai-viewport-evidence", {
    body: Buffer.from(JSON.stringify(aiEvidence, null, 2)),
    contentType: "application/json",
  });
  assertViewportEvidence(aiEvidence);

  const projectName = test.info().project.name;
  if (projectName === "desktop-chromium") {
    await expectScreenshotWithExactPath(
      page,
      "unloading-standard-geometry-desktop-chromium-win32.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
  } else if (projectName === "narrow-chromium") {
    await expectScreenshotWithExactPath(
      page,
      "unloading-standard-geometry-narrow-chromium-win32.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
  } else {
    const queue = page.locator('[data-mobile-target="queue"]');
    const detail = page.locator('[data-mobile-target="detail"]');
    const context = page.locator('[data-mobile-target="context"]');
    await queue.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
    await expectScreenshotWithExactPath(
      page,
      "unloading-standard-geometry-mobile-queue-chromium-win32.png",
      { animations: "disabled", caret: "hide" },
    );
    await detail.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
    await expectScreenshotWithExactPath(
      page,
      "unloading-standard-geometry-mobile-detail-chromium-win32.png",
      { animations: "disabled", caret: "hide" },
    );
    await context.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(page.locator('[data-mobile-active="true"]')).toHaveCount(1);
    await expectScreenshotWithExactPath(
      page,
      "unloading-standard-geometry-mobile-context-chromium-win32.png",
      { animations: "disabled", caret: "hide" },
    );
    const metrics = await captureViewportEvidence(page, "ai");
    expect(metrics.mobileActivePanes).toBe(1);
    assertViewportEvidence(metrics);
    await context.focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-mode-control="work"]').click();
    const taskButton = page.locator(".task-action > button");
    await taskButton.click();
    expect(taskPage.items[0]?.state).toBe("in_progress");
    await taskButton.click();
    expect(taskPage.items[0]?.state).toBe("completed");
  }
});

type ViewportEvidence = {
  mode: "work" | "ai";
  viewport: { width: number; height: number };
  document: {
    clientWidth: number;
    scrollWidth: number;
    horizontalOverflow: boolean;
  };
  panes: Array<{
    name: string | null;
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  }>;
  contextRoot: {
    visible: boolean;
    name: string | null;
    overflowY: string;
    clientHeight: number;
    scrollHeight: number;
  } | null;
  contextDescendants: Array<{
    name: string | null;
    overflowY: string;
    clientHeight: number;
    scrollHeight: number;
  }>;
  innerScrollOwners: Array<{
    name: string | null;
    overflowY: string;
    clientHeight: number;
    scrollHeight: number;
  }>;
  outerScrollOwners: Array<{
    name: string | null;
    overflowY: string;
    clientHeight: number;
    scrollHeight: number;
  }>;
  mobileActivePanes: number;
};

type ScreenshotOptions = {
  animations: "disabled";
  caret: "hide";
};

type InternalProject = {
  expect?: {
    toHaveScreenshot?: { pathTemplate?: string };
  };
};

async function expectScreenshotWithExactPath(
  page: Page,
  name: string,
  options: ScreenshotOptions,
): Promise<void> {
  const internal = test.info() as unknown as {
    _projectInternal?: InternalProject;
  };
  const project = internal._projectInternal;
  if (!project) throw new Error("Playwright project internals unavailable");
  const hadExpect = Object.prototype.hasOwnProperty.call(project, "expect");
  const previousExpect = project.expect;
  try {
    project.expect = {
      ...(project.expect ?? {}),
      toHaveScreenshot: {
        ...(project.expect?.toHaveScreenshot ?? {}),
        pathTemplate:
          "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
      },
    };
    await expect(page).toHaveScreenshot(name, options);
  } finally {
    if (hadExpect) project.expect = previousExpect;
    else delete project.expect;
  }
}

async function captureViewportEvidence(
  page: Page,
  mode: ViewportEvidence["mode"],
): Promise<ViewportEvidence> {
  return page.evaluate((contextMode) => {
    const visible = (element: Element): element is HTMLElement => {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return (
        !node.closest("[hidden], [inert], [aria-hidden='true']") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const nameOf = (element: HTMLElement): string | null =>
      element.getAttribute("data-workbench-pane") ??
      element.getAttribute("data-context-mode") ??
      element.tagName.toLowerCase();
    const scrollInfo = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return {
        name: nameOf(element),
        overflowY: style.overflowY,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    };
    const trulyScrollable = (element: HTMLElement) => {
      const overflowY = getComputedStyle(element).overflowY;
      return (
        visible(element) &&
        (overflowY === "auto" || overflowY === "scroll") &&
        element.scrollHeight > element.clientHeight + 1
      );
    };
    const contextRoot = document.querySelector<HTMLElement>(
      `[data-context-mode="${contextMode}"]`,
    );
    const contextElements = contextRoot
      ? [contextRoot, ...contextRoot.querySelectorAll<HTMLElement>("*")]
      : [];
    const innerScrollOwners = contextElements
      .filter(trulyScrollable)
      .map(scrollInfo);
    const outerElements = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-workbench-pane], [data-workbench-pane] *",
      ),
    ].filter((element) => !contextRoot?.contains(element));
    const outerScrollOwners = outerElements
      .filter(trulyScrollable)
      .map(scrollInfo);
    return {
      mode: contextMode,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      },
      panes: [
        ...document.querySelectorAll<HTMLElement>("[data-workbench-pane]"),
      ]
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            name: nameOf(element),
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          };
        }),
      contextRoot:
        contextRoot && visible(contextRoot)
          ? { visible: true, ...scrollInfo(contextRoot) }
          : contextRoot
            ? { visible: false, ...scrollInfo(contextRoot) }
            : null,
      contextDescendants: contextElements.slice(1).map(scrollInfo),
      innerScrollOwners,
      outerScrollOwners,
      mobileActivePanes: document.querySelectorAll(
        '[data-mobile-active="true"]',
      ).length,
    };
  }, mode);
}

function assertViewportEvidence(evidence: ViewportEvidence): void {
  expect(evidence.viewport).toEqual(
    expect.objectContaining({
      width: expect.any(Number),
      height: expect.any(Number),
    }),
  );
  expect(evidence.document.horizontalOverflow).toBe(false);
  expect(evidence.document.scrollWidth).toBeLessThanOrEqual(
    evidence.document.clientWidth + 1,
  );
  expect(evidence.panes.length).toBeGreaterThan(0);
  expect(
    evidence.panes.every((pane) => pane.width > 0 && pane.height > 0),
  ).toBe(true);
  expect(evidence.contextRoot?.visible).toBe(true);
  expect(evidence.innerScrollOwners).toEqual([]);
  expect(evidence.outerScrollOwners.length).toBeGreaterThanOrEqual(0);
}

function responseFor(path: string): unknown {
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/11111111-1111-4111-8111-111111111111")
    return container;
  if (
    path ===
    "/api/containers/11111111-1111-4111-8111-111111111111/lifecycle-nodes"
  )
    return lifecycleNodes;
  if (
    path ===
    "/api/containers/11111111-1111-4111-8111-111111111111/delivery-instruction"
  )
    return instruction;
  if (path.endsWith("/activities"))
    return {
      items: [],
      nextActions: [],
      pageInfo: { hasNextPage: false },
      projectionVersion: 1,
    };
  throw new Error(`Unhandled unloading E2E API path: ${path}`);
}

const container = {
  id: "11111111-1111-4111-8111-111111111111",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "picked_up",
  updatedAt: "2026-09-21T00:00:00Z",
};
const containerPage = {
  items: [container],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 1,
};
const taskPage: {
  items: MutableUnloadingTask[];
  pageInfo: { nextCursor: null; hasNextPage: boolean; pageSize: number };
  asOf: string;
  projectionVersion: number;
} = {
  items: [
    {
      id: "21111111-1111-4111-8111-111111111111",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "container_unloading",
      containerId: "11111111-1111-4111-8111-111111111111",
      taskDefinitionKey: "node-container_unloading",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [
        {
          id: "31111111-1111-4111-8111-111111111111",
          workOrderDefinitionKey: "unloading",
          state: "pending",
          assignmentState: "pool",
          assigneeId: null,
          dueAt: null,
          completedAt: null,
        },
      ],
      outcome: null,
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "31111111-1111-4111-8111-111111111111",
        workOrderDefinitionKey: "unloading",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
      },
    },
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 1,
};
const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "container_unloading",
    version: 11,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "container_unloading",
      sequence: 12,
      state: "active",
      applicability: "required",
      completedAt: null,
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 11,
};
const instruction = {
  instructionId: "11111111-1111-4111-8111-111111111111",
  containerRecordId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  warehouseLocationId: "22222222-2222-4222-8222-222222222222",
  warehouseCode: "VLS",
  warehouseName: "Barcelona VLS",
  unlocode: "ESBCN",
  timezone: "Europe/Madrid",
  appointmentStartAt: null,
  appointmentEndAt: null,
  appointmentReference: null,
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "dev-operator",
  reasonCode: "delivery_instruction_confirmed",
  createdAt: "2026-09-21T00:00:00Z",
  duplicate: false,
};
const deliveryFact = {
  factId: "66666666-6666-4666-8666-666666666666",
  nodeCode: "warehouse_delivery",
  eventCode: "delivered",
  timeKind: "actual",
  occurredAt: "2026-04-23T06:00:00Z",
  validity: "effective",
  location: {
    locationType: "warehouse",
    locationId: instruction.warehouseLocationId,
    unlocode: "ESBCN",
    timezone: "Europe/Madrid",
  },
  evidenceRefs: [],
  applicationState: "applied",
  applicationReasonCode: null,
  projectionVersion: 2,
};
