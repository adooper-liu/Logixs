import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-21T08:00:00Z") });
});

test("delivery operator locks the destination and sends POD arrival for review", async ({
  page,
}) => {
  let instruction: Record<string, unknown> | null = null;
  let deliveredFact: Record<string, unknown> | null = null;
  let instructionCommand: Record<string, unknown> | null = null;
  let factCommand: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/delivery-instruction") {
      if (request.method() === "POST") {
        instructionCommand = request.postDataJSON() as Record<string, unknown>;
        instruction = {
          instructionId: randomUUID(),
          containerRecordId: "container-1",
          version: Number(instruction?.version ?? 0) + 1,
          warehouseLocationId: instructionCommand.warehouseLocationId,
          warehouseCode: instructionCommand.warehouseCode,
          warehouseName: instructionCommand.warehouseName,
          unlocode: instructionCommand.unlocode,
          timezone: instructionCommand.timezone,
          appointmentStartAt: instructionCommand.appointmentStartAt,
          appointmentEndAt: instructionCommand.appointmentEndAt,
          appointmentReference: instructionCommand.appointmentReference,
          evidenceRefs: instructionCommand.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: instructionCommand.reasonCode,
          createdAt: "2026-09-21T05:00:00Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: instruction,
      });
      return;
    }
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        factCommand = request.postDataJSON() as Record<string, unknown>;
        deliveredFact = {
          factId: "77777777-7777-4777-8777-777777777777",
          nodeCode: "warehouse_delivery",
          eventCode: factCommand.eventCode,
          timeKind: "actual",
          occurredAt: factCommand.occurredAt,
          rawValue: factCommand.rawValue,
          sourceUtcOffset: factCommand.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: factCommand.authoritySystem,
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: null,
          location: factCommand.location,
          evidenceRefs: factCommand.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 2,
          recordedAt: "2026-09-21T05:10:00Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: deliveredFact.factId,
            recordState: "recorded",
            applicationState: "review_required",
            reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
            canonicalEventId: null,
            projectionVersion: 2,
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            items: deliveredFact ? [gateOutFact, deliveredFact] : [gateOutFact],
            projectionVersion: deliveredFact ? 2 : 1,
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

  await page.goto("/workspaces/delivery");
  await expect(
    page.getByRole("heading", { name: "送仓", exact: true }),
  ).toBeVisible();
  await showDeliveryPane(page, "queue");
  await page.getByRole("button", { name: /KOCU4960726.*领取送仓任务/ }).click();
  await expect(page.getByText("先锁定本柜本次目的仓")).toBeVisible();
  await showDeliveryPane(page, "context");

  await page
    .getByLabel("仓库地点 ID")
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByLabel("仓库代码").fill("VLS");
  await page.getByLabel("仓库名称").fill("Barcelona VLS");
  await page.getByLabel("UN/LOCODE（可选）").fill("ESBCN");
  await page.getByLabel("IANA 时区").fill("Europe/Madrid");
  await page
    .getByLabel("调度指令证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByRole("button", { name: "锁定目的仓" }).click();
  await showDeliveryPane(page, "detail");
  await expect(
    page.getByText("VLS · Barcelona VLS", { exact: true }),
  ).toBeVisible();

  await showDeliveryPane(page, "context");
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:30");
  await page
    .getByLabel("POD、门岗或仓库签收证据")
    .fill("55555555-5555-4555-8555-555555555555");
  await page.getByRole("button", { name: "提交实际送仓复核" }).click();

  await expect(
    page.getByText("实际送仓已保存，等待另一名复核人采信"),
  ).toBeVisible();
  await showDeliveryPane(page, "detail");
  await expect(page.getByText("待复核", { exact: true })).toBeVisible();
  expect(instructionCommand).toMatchObject({
    expectedVersion: 0,
    warehouseName: "Barcelona VLS",
    timezone: "Europe/Madrid",
  });
  expect(factCommand).toMatchObject({
    nodeCode: "warehouse_delivery",
    eventCode: "delivered",
    timeKind: "actual",
    authoritySystem: "warehouse-receiving",
    reasonCode: "DELIVERY_RECEIPT_RECORDED",
    location: {
      locationType: "warehouse",
      locationId: "33333333-3333-4333-8333-333333333333",
      unlocode: "ESBCN",
      timezone: "Europe/Madrid",
    },
  });

  await showDeliveryPane(page, "context");
  await page
    .getByRole("button", { name: "仓库 / WMS 到场", exact: true })
    .click();
  await expect(page.getByLabel(/实际到仓时间/)).toHaveValue("");
  await expect(page.getByLabel("仓库、WMS 或门岗权威证据")).toHaveValue("");
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:45");
  await page
    .getByLabel("仓库、WMS 或门岗权威证据")
    .fill("88888888-8888-4888-8888-888888888888");
  await page
    .getByRole("button", { name: "提交实际送仓复核", exact: true })
    .click();
  await expect(
    page.getByText("实际送仓已保存，等待另一名复核人采信"),
  ).toBeVisible();
  expect(factCommand).toMatchObject({
    eventCode: "warehouse_arrival",
    expectedVersion: 2,
    authoritySystem: "warehouse-wms",
    reasonCode: "WAREHOUSE_ARRIVAL_RECORDED",
    location: {
      locationId: "33333333-3333-4333-8333-333333333333",
      timezone: "Europe/Madrid",
    },
  });

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

function responseFor(path: string): unknown {
  if (path.endsWith("/activities"))
    return {
      items: [],
      nextActions: [],
      pageInfo: { hasNextPage: false },
      projectionVersion: 1,
    };
  if (path.endsWith("/collaboration"))
    return collaborationPage("task-1", "container-1");
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/container-1") return container;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  throw new Error(`Unhandled API path in warehouse delivery E2E: ${path}`);
}

const container = {
  id: "container-1",
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
const taskPage = {
  items: [
    {
      id: "task-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "warehouse_delivery",
      containerId: "container-1",
      taskDefinitionKey: "node-warehouse_delivery",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [
        {
          id: "work-1",
          workOrderDefinitionKey: "delivery",
          state: "ready",
          assignmentState: "pool",
          assigneeId: null,
          dueAt: null,
          completedAt: null,
        },
      ],
      outcome: null,
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "work-1",
        workOrderDefinitionKey: "delivery",
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
    currentNodeCode: "warehouse_delivery",
    version: 10,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "warehouse_delivery",
      sequence: 11,
      state: "active",
      applicability: "required",
      completedAt: null,
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 10,
};
const gateOutFact = {
  factId: "22222222-2222-4222-8222-222222222222",
  nodeCode: "container_pickup",
  eventCode: "gate_out",
  timeKind: "actual",
  occurredAt: "2026-09-21T04:00:00Z",
  validity: "effective",
  location: {
    locationType: "terminal",
    unlocode: "ESBCN",
    timezone: "Europe/Madrid",
  },
  evidenceRefs: [],
  applicationState: "applied",
  applicationReasonCode: null,
  projectionVersion: 1,
};

const capabilityIds = {
  containerA: "11111111-1111-4111-8111-111111111111",
  containerB: "12222222-2222-4222-8222-222222222222",
  taskA: "21111111-1111-4111-8111-111111111111",
  taskB: "22222222-2222-4222-8222-222222222222",
  workA: "31111111-1111-4111-8111-111111111111",
  workB: "32222222-2222-4222-8222-222222222222",
};
function collaborationPage(taskId: string, containerId: string) {
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: { kind: "container", id: containerId },
    workRef: { kind: "node_task", id: taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: [],
    asOf: "2026-10-21T08:00:00Z",
    pageSize: 25,
    nextCursor: null,
    canPost: false,
    postDisabledReason: "合成只读演练",
    mentionOptions: [],
    evidenceOptions: [],
  };
}
function capabilityTask(
  which: "A" | "B",
  action: string | null = "work_execution.claim_work_order",
  sameContainer = false,
) {
  const base = taskPage.items[0]!;
  const workId = capabilityIds[`work${which}`];
  return {
    ...base,
    id: capabilityIds[`task${which}`],
    containerId: sameContainer
      ? capabilityIds.containerA
      : capabilityIds[`container${which}`],
    workOrders: [
      {
        ...base.workOrders[0]!,
        id: workId,
        state:
          action === "work_execution.complete_work_order"
            ? "in_progress"
            : "ready",
      },
    ],
    nextAction: action
      ? { ...base.nextAction, actionCode: action, workOrderId: workId }
      : null,
  };
}
function capabilityCandidate(
  task: ReturnType<typeof capabilityTask>,
  status = "proposed",
) {
  return {
    candidateId:
      task.id === capabilityIds.taskA
        ? "41111111-1111-4111-8111-111111111111"
        : "42222222-2222-4222-8222-222222222222",
    candidateHash: `synthetic-${task.id}`,
    context: {
      subjectRef: { kind: "container", id: task.containerId },
      workRef: { kind: "node_task", id: task.id },
    },
    workOrderId: task.workOrders[0]!.id,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: "建议领取当前送仓工单",
    rationale: "合成演练：领取建立工单责任。",
    impact: "领取不证明实际到仓、卸柜或交接。",
    riskLevel: "low",
    warningCodes: [],
    status,
    source: {
      kind: "rule",
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: `synthetic-input-${task.id}`,
      inputRefs: [
        { kind: "container", id: task.containerId, version: 1 },
        { kind: "node_task", id: task.id, version: 1 },
      ],
      generatedAt: "2026-10-21T08:00:00.000Z",
    },
  };
}
function capabilityReceipt(
  task: ReturnType<typeof capabilityTask>,
  completed = false,
) {
  return {
    workOrderId: task.workOrders[0]!.id,
    workOrderState: completed ? "completed" : "in_progress",
    taskId: task.id,
    taskState: completed ? "completed" : "in_progress",
    assignmentState: "assigned",
    assigneeId: "synthetic-operator",
    applied: true,
    clientOperationId: `synthetic-operation-${task.id}`,
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
    lifecycleApply: "not_applicable",
  };
}
async function installCapabilities(
  page: Page,
  options: { sameContainer?: boolean; variant?: string } = {},
) {
  const a = capabilityTask("A");
  const b = capabilityTask(
    "B",
    "work_execution.claim_work_order",
    options.sameContainer,
  );
  if (options.variant === "no-action" || options.variant === "ambiguous")
    a.nextAction = null;
  if (options.variant === "ambiguous") a.workOrders = [];
  if (options.variant === "unknown") a.nextAction!.actionCode = "unknown";
  if (options.variant === "mismatch")
    a.nextAction!.workOrderId = capabilityIds.workB;
  if (options.variant === "wrong-container")
    a.containerId = capabilityIds.containerB;
  if (options.variant === "wrong-node") a.nodeCode = "container_stuffing";
  const state = {
    tasks: [a, b],
    posts: [] as { path: string; body: Record<string, unknown> }[],
    reads: [] as string[],
    failClaim: false,
    conflict: false,
    holdSelection: null as ReturnType<typeof deferred> | null,
    selectionStarted: deferred(),
    holdQueue: null as ReturnType<typeof deferred> | null,
    holdConfirm: null as ReturnType<typeof deferred> | null,
    confirmStarted: deferred(),
    confirmFinished: deferred(),
    instructions: new Map<string, Record<string, unknown>>(),
    facts: new Map<string, Record<string, unknown>[]>(),
  };
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body =
      request.method() === "POST"
        ? (request.postDataJSON() as Record<string, unknown>)
        : {};
    if (request.method() === "POST") state.posts.push({ path, body });
    else state.reads.push(request.url());
    const aiMatch = path.match(/\/node-tasks\/([^/]+)\/ai\/action-candidates/);
    if (aiMatch) {
      const task = state.tasks.find((t) => t.id === aiMatch[1])!;
      if (path.endsWith("/confirmations")) {
        state.confirmStarted.resolve();
        if (state.holdConfirm) await state.holdConfirm.promise;
        if (state.conflict) {
          await route.fulfill({
            status: 409,
            json: { message: "CONFLICT: synthetic stale claim" },
          });
          return;
        }
        const result = capabilityReceipt(task);
        task.nextAction = {
          ...task.nextAction!,
          actionCode: "work_execution.complete_work_order",
        };
        task.workOrders[0]!.state = "in_progress";
        task.workOrders[0]!.assignmentState = "assigned";
        task.state = "in_progress";
        await route.fulfill({
          json: {
            contractVersion: "task-action-candidate-confirm-result.v1",
            candidate: capabilityCandidate(task, "accepted"),
            decision: null,
            claimWorkOrderResult: result,
            idempotencyReplay: false,
          },
        });
        state.confirmFinished.resolve();
      } else await route.fulfill({ json: capabilityCandidate(task) });
      return;
    }
    const workMatch = path.match(/\/work-orders\/([^/]+)\/(claim|complete)$/);
    if (workMatch) {
      const task = state.tasks.find((t) =>
        t.workOrders.some((w) => w.id === workMatch[1]),
      )!;
      if (state.failClaim) {
        state.failClaim = false;
        await route.fulfill({
          status: 503,
          json: { message: "NETWORK_ERROR: synthetic retry" },
        });
        return;
      }
      const completed = workMatch[2] === "complete";
      const result = capabilityReceipt(task, completed);
      task.nextAction = completed
        ? null
        : {
            ...task.nextAction!,
            actionCode: "work_execution.complete_work_order",
          };
      task.workOrders[0]!.state = completed ? "completed" : "in_progress";
      task.state = completed ? "completed" : "in_progress";
      await route.fulfill({ json: result });
      return;
    }
    if (path === "/api/node-tasks") {
      if (!url.searchParams.has("containerId") && state.holdQueue)
        await state.holdQueue.promise;
      await route.fulfill({ json: { ...taskPage, items: state.tasks } });
      return;
    }
    if (path === "/api/containers") {
      await route.fulfill({
        json: {
          ...containerPage,
          items: [
            {
              ...container,
              id: capabilityIds.containerA,
              containerNumber: "DELIVERY-A",
            },
            {
              ...container,
              id: capabilityIds.containerB,
              containerNumber: "DELIVERY-B",
            },
          ],
        },
      });
      return;
    }
    const collaboration = path.match(/\/node-tasks\/([^/]+)\/collaboration$/);
    if (collaboration) {
      await route.fulfill({
        json: collaborationPage(
          collaboration[1]!,
          state.tasks.find((t) => t.id === collaboration[1])!.containerId!,
        ),
      });
      return;
    }
    if (path.endsWith("/activities")) {
      await route.fulfill({
        json: {
          items: [],
          nextActions: [],
          pageInfo: { hasNextPage: false },
          projectionVersion: 1,
        },
      });
      return;
    }
    if (path.endsWith("/delivery-instruction")) {
      const id = path.split("/")[3]!;
      const current = state.instructions.get(id) ?? {
        instructionId: "66666666-6666-4666-8666-666666666666",
        containerRecordId: id,
        version: 1,
        warehouseLocationId: "99999999-9999-4999-8999-999999999999",
        warehouseCode: "VLS",
        warehouseName: "Barcelona VLS",
        unlocode: "ESBCN",
        timezone: "Europe/Madrid",
        appointmentStartAt: null,
        appointmentEndAt: null,
        appointmentReference: null,
        evidenceRefs: [],
        actorId: "synthetic-operator",
        reasonCode: "delivery_instruction_confirmed",
        createdAt: "2026-09-21T00:00:00Z",
        duplicate: false,
      };
      if (request.method() === "POST")
        state.instructions.set(id, {
          ...current,
          ...body,
          instructionId: randomUUID(),
          version: Number(current.version) + 1,
        });
      await route.fulfill({ json: state.instructions.get(id) ?? current });
      return;
    }
    if (path.endsWith("/date-facts")) {
      const id = path.split("/")[3]!;
      if (request.method() === "POST") {
        const fact = {
          ...body,
          factId: "77777777-7777-4777-8777-777777777777",
          validity: "effective",
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          projectionVersion: 2,
        };
        state.facts.set(id, [...(state.facts.get(id) ?? []), fact]);
        await route.fulfill({
          json: {
            factId: fact.factId,
            recordState: "recorded",
            applicationState: fact.applicationState,
            reasonCode: fact.applicationReasonCode,
            canonicalEventId: null,
            projectionVersion: 2,
          },
        });
      } else {
        if (state.holdSelection) {
          state.selectionStarted.resolve();
          await state.holdSelection.promise;
        }
        await route.fulfill({
          json: {
            items: state.facts.get(id) ?? [],
            projectionVersion: state.facts.has(id) ? 2 : 1,
            asOf: "2026-10-21T08:00:00Z",
          },
        });
      }
      return;
    }
    if (path.endsWith("/lifecycle-nodes")) {
      await route.fulfill({ json: lifecycleNodes });
      return;
    }
    if (path.startsWith("/api/containers/")) {
      const id = path.split("/")[3]!;
      await route.fulfill({
        json: {
          ...container,
          id,
          containerNumber:
            id === capabilityIds.containerA ? "DELIVERY-A" : "DELIVERY-B",
        },
      });
      return;
    }
    throw new Error(`Unhandled capability fixture: ${path}`);
  });
  return state;
}

for (const correction of ["appointment", "reference", "evidence"]) {
  test(`UIPS-SP4-PROF-003 new-ID ${correction} replacement preserves dirty DOM and uses live authority`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    const time = page.getByLabel(/实际到仓时间/);
    const proof = page.getByLabel("POD、门岗或仓库签收证据");
    const originalTime = await time.elementHandle();
    const originalProof = await proof.elementHandle();
    if (correction === "appointment") {
      await page.getByLabel("预约开始（当地）").fill("2026-09-22T10:00");
      await page.getByLabel("预约结束（当地）").fill("2026-09-22T11:00");
    } else if (correction === "reference") {
      await page.getByLabel("预约参考（可选）").fill("corrected-reference");
    }
    await page.getByRole("button", { name: "保存更正版本" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "指令已保存" }),
    ).toContainText("第 2 版");
    const first = state.instructions.get(capabilityIds.containerA)!;
    expect(first.instructionId).not.toBe(
      "66666666-6666-4666-8666-666666666666",
    );
    expect(first.version).toBe(2);
    await expect(time).toHaveValue("2026-09-21T10:00");
    await expect(proof).toHaveValue("55555555-5555-4555-8555-555555555555");
    expect(
      await time.evaluate((el, original) => el === original, originalTime),
    ).toBe(true);
    expect(
      await proof.evaluate((el, original) => el === original, originalProof),
    ).toBe(true);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "保存更正版本" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "指令已保存" }),
    ).toContainText("第 3 版");
    const current = state.instructions.get(capabilityIds.containerA)!;
    expect(current.instructionId).not.toBe(first.instructionId);
    expect(current.version).toBe(3);
    expect(
      state.posts
        .filter((p) => p.path.endsWith("/delivery-instruction"))
        .map((p) => p.body.expectedVersion),
    ).toEqual([1, 2]);
    await page.getByRole("button", { name: "提交实际送仓复核" }).click();
    await expect(
      page.getByText("实际送仓已保存，等待另一名复核人采信"),
    ).toBeVisible();
    expect(
      state.posts.filter((p) => p.path.endsWith("/date-facts")),
    ).toHaveLength(1);
    expect(
      state.posts.find((p) => p.path.endsWith("/date-facts"))!.body,
    ).toMatchObject({
      eventCode: "delivered",
      expectedVersion: 1,
      rawValue: "2026-09-21T10:00",
      occurredAt: "2026-09-21T08:00:00.000Z",
      authoritySystem: "warehouse-receiving",
      location: {
        locationId: current.warehouseLocationId,
        timezone: current.timezone,
      },
      evidenceRefs: ["55555555-5555-4555-8555-555555555555"],
    });
  });
}

for (const change of ["warehouse", "timezone"]) {
  test(`UIPS-SP4-PROF-001 cleared draft rebinds and new-ID ${change} change still blocks dirty input`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    const time = page.getByLabel(/实际到仓时间/);
    const proof = page.getByLabel("POD、门岗或仓库签收证据");
    await time.fill("");
    await proof.fill("");
    await page
      .getByLabel("仓库地点 ID")
      .fill("88888888-8888-4888-8888-888888888888");
    await page.getByLabel("IANA 时区").fill("UTC");
    await page.getByRole("button", { name: "保存更正版本" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "指令已保存" }),
    ).toContainText("第 2 版");
    await time.fill("2026-09-21T10:00");
    await proof.fill("55555555-5555-4555-8555-555555555555");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "提交实际送仓复核" }),
    ).toBeEnabled();
    if (change === "warehouse")
      await page
        .getByLabel("仓库地点 ID")
        .fill("99999999-9999-4999-8999-999999999999");
    else await page.getByLabel("IANA 时区").fill("Europe/Madrid");
    const previousId = state.instructions.get(
      capabilityIds.containerA,
    )!.instructionId;
    await page.getByRole("button", { name: "保存更正版本" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "指令已保存" }),
    ).toContainText("第 3 版");
    expect(
      state.instructions.get(capabilityIds.containerA)!.instructionId,
    ).not.toBe(previousId);
    await expect(time).toHaveValue("2026-09-21T10:00");
    await expect(proof).toHaveValue("55555555-5555-4555-8555-555555555555");
    await expect(page.getByRole("alert")).toContainText("目的仓或时区已变化");
    await expect(
      page.getByRole("button", { name: "提交实际送仓复核" }),
    ).toBeDisabled();
    expect(state.posts.filter((p) => p.path.endsWith("/date-facts"))).toEqual(
      [],
    );
    await page.getByRole("button", { name: "核对新目的仓并重新录入" }).click();
    await expect(time).toHaveValue("");
    await expect(proof).toHaveValue("");
    await time.fill("2026-09-21T11:00");
    await proof.fill("55555555-5555-4555-8555-555555555555");
    await page.getByRole("button", { name: "提交实际送仓复核" }).click();
    await expect(
      page.getByText("实际送仓已保存，等待另一名复核人采信"),
    ).toBeVisible();
    const current = state.instructions.get(capabilityIds.containerA)!;
    expect(
      state.posts.filter((p) => p.path.endsWith("/date-facts")),
    ).toHaveLength(1);
    expect(
      state.posts.find((p) => p.path.endsWith("/date-facts"))!.body,
    ).toMatchObject({
      rawValue: "2026-09-21T11:00",
      location: {
        locationId: current.warehouseLocationId,
        timezone: current.timezone,
      },
    });
  });
}

test("UIPS-SP4-PROF-002 real queue A WMS to B defaults to POD until explicit WMS selection", async ({
  page,
}) => {
  const state = await installCapabilities(page);
  await gotoDelivery(
    page,
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await page
    .getByRole("button", { name: "仓库 / WMS 到场", exact: true })
    .click();
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:00");
  await page
    .getByLabel("仓库、WMS 或门岗权威证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await showDeliveryPane(page, "queue");
  await page.locator('[aria-label="送仓任务列表"] button').nth(1).click();
  await expect(page).toHaveURL(
    new RegExp(`containerId=${capabilityIds.containerB}`),
  );
  await showDeliveryPane(page, "context");
  await expect(page.getByLabel(/实际到仓时间/)).toBeEnabled();
  await expect(page.getByLabel(/实际到仓时间/)).toHaveValue("");
  await expect(page.getByLabel("POD、门岗或仓库签收证据")).toHaveValue("");
  await expect(page.locator('[aria-label="送仓完成依据"] .active')).toHaveText(
    "POD / 签收",
  );
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:30");
  await page
    .getByLabel("POD、门岗或仓库签收证据")
    .fill("55555555-5555-4555-8555-555555555555");
  await page.getByRole("button", { name: "提交实际送仓复核" }).click();
  await expect(
    page.getByText("实际送仓已保存，等待另一名复核人采信"),
  ).toBeVisible();
  const facts = () => state.posts.filter((p) => p.path.endsWith("/date-facts"));
  expect(facts()).toHaveLength(1);
  expect(facts()[0]).toMatchObject({
    path: `/api/containers/${capabilityIds.containerB}/date-facts`,
    body: { eventCode: "delivered", authoritySystem: "warehouse-receiving" },
  });
  await page
    .getByRole("button", { name: "仓库 / WMS 到场", exact: true })
    .click();
  await expect(page.getByLabel(/实际到仓时间/)).toHaveValue("");
  await expect(page.getByLabel("仓库、WMS 或门岗权威证据")).toHaveValue("");
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T11:00");
  await page
    .getByLabel("仓库、WMS 或门岗权威证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByRole("button", { name: "提交实际送仓复核" }).click();
  await expect.poll(() => facts().length).toBe(2);
  expect(facts()[1]).toMatchObject({
    path: `/api/containers/${capabilityIds.containerB}/date-facts`,
    body: {
      eventCode: "warehouse_arrival",
      authoritySystem: "warehouse-wms",
      expectedVersion: 2,
    },
  });
});

test("delivery task context candidate, exact refs, dirty modes and real claim transition", async ({
  page,
}, testInfo) => {
  const state = await installCapabilities(page);
  await gotoDelivery(
    page,
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await fillCapabilityDraft(page);
  const field = page.getByLabel("POD、门岗或仓库签收证据");
  await field.focus();
  const original = await field.elementHandle();
  for (const mode of ["档案", "协作", "AI 辅助", "办理"])
    await page
      .getByRole("navigation", { name: "任务上下文模式", exact: true })
      .getByRole("button", { name: mode, exact: true })
      .click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("55555555-5555-4555-8555-555555555555");
  expect(
    await field.evaluate((element, before) => element === before, original),
  ).toBe(true);
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await expect(
    page.getByText("未采信，不改变任务状态", { exact: true }),
  ).toBeVisible();
  expect(
    state.posts.filter((p) => p.path.endsWith("/action-candidates")),
  ).toEqual([
    {
      path: `/api/node-tasks/${capabilityIds.taskA}/ai/action-candidates`,
      body: {
        contractVersion: "task-action-candidate-generate.v1",
        subjectRef: { kind: "container", id: capabilityIds.containerA },
        workRef: { kind: "node_task", id: capabilityIds.taskA },
      },
    },
  ]);
  expect(
    state.reads.some((url) =>
      url.includes(`/containers/${capabilityIds.containerA}/activities`),
    ),
  ).toBe(true);
  expect(
    state.reads.some((url) =>
      url.includes(
        `/node-tasks/${capabilityIds.taskA}/collaboration?subjectKind=container&subjectId=${capabilityIds.containerA}`,
      ),
    ),
  ).toBe(true);
  await page.locator('[data-ai-spine-step="source"]').scrollIntoViewIfNeeded();
  await page.locator('[data-ai-spine-step="source"]').evaluate((source) => {
    for (let owner = source.parentElement; owner; owner = owner.parentElement) {
      if (
        /^(auto|scroll)$/.test(getComputedStyle(owner).overflowY) &&
        owner.scrollHeight > owner.clientHeight
      ) {
        owner.scrollTop +=
          source.getBoundingClientRect().top -
          owner.getBoundingClientRect().top -
          50;
        break;
      }
    }
  });
  await expect(
    page.getByText("未采信，不改变任务状态", { exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByText("风险等级：低", { exact: true }),
  ).toBeInViewport();
  await expect(page.getByText("影响与风险", { exact: true })).toBeVisible();
  await evidence(page, testInfo, "delivery-task-context");
  const structure = await page.locator(".task-context").evaluate((root) => {
    const owners = [
      ...root.querySelectorAll<HTMLElement>("*"),
      root as HTMLElement,
    ].filter(
      (el) =>
        /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) &&
        el.scrollHeight > el.clientHeight + 1,
    );
    return { innerScrollOwners: owners.map((el) => el.className) };
  });
  expect(structure.innerScrollOwners).toEqual([]);
  await writeFile(
    testInfo.outputPath("delivery-task-context-scroll.json"),
    JSON.stringify(structure, null, 2),
  );
  // Standard geometry has five active baselines below; B2's stacked images
  // remain historical evidence. Keep this entire business path running.
  await page.getByTestId("ai-confirm").click();
  await expect(
    page.getByRole("button", { name: "AI 辅助", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "送仓工单领取回执", exact: true }),
  ).toContainText(capabilityIds.workA);
  await expect(
    page.getByRole("region", { name: "送仓工单领取回执", exact: true }),
  ).toContainText("仅证明工单领取");
  await expect(field).toHaveValue("55555555-5555-4555-8555-555555555555");
  await expect(
    page.getByRole("button", { name: "完成送仓工单", exact: true }),
  ).toBeVisible();
  expect(state.tasks[0]!.nextAction?.actionCode).toBe(
    "work_execution.complete_work_order",
  );
  expect(state.posts.filter((p) => p.path.endsWith("/date-facts"))).toEqual([]);
});

test("delivery direct claim failure retries original key then completes exact work order", async ({
  page,
}) => {
  const state = await installCapabilities(page);
  state.failClaim = true;
  await gotoDelivery(
    page,
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await page.getByRole("button", { name: "领取送仓任务", exact: true }).click();
  await page
    .getByRole("button", { name: "使用原编号重试", exact: true })
    .click();
  await page.getByRole("button", { name: "完成送仓工单", exact: true }).click();
  await expect(page.getByText("送仓工单已完成", { exact: true })).toBeVisible();
  expect(state.posts.map((p) => p.path)).toEqual([
    `/api/work-orders/${capabilityIds.workA}/claim`,
    `/api/work-orders/${capabilityIds.workA}/claim`,
    `/api/work-orders/${capabilityIds.workA}/complete`,
  ]);
  expect(state.posts[0]!.body).toEqual(state.posts[1]!.body);
  expect(state.posts[2]!.body.idempotencyKey).not.toBe(
    state.posts[0]!.body.idempotencyKey,
  );
  expect(state.posts[2]!.body).not.toHaveProperty("evidenceRefs");
});

for (const choice of [
  "none",
  "work",
  "work-click",
  "work-space",
  "archive",
  "collaboration",
] as const) {
  test(`delivery held refresh respects real ${choice} mode intent`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    state.conflict = true;
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(page.getByTestId("ai-confirm")).toBeEnabled();
    state.holdSelection = deferred();
    state.holdQueue = deferred();
    await page.getByTestId("ai-confirm").click();
    await state.selectionStarted.promise;
    const work = page.locator('[data-mode-control="work"]');
    await expect(work).toHaveAttribute("aria-pressed", "true");
    if (
      choice === "work" ||
      choice === "work-click" ||
      choice === "work-space"
    ) {
      await work.focus();
      if (choice === "work-click") await work.click();
      else await work.press(choice === "work-space" ? "Space" : "Enter");
    }
    state.holdSelection.resolve();
    if (choice === "archive" || choice === "collaboration")
      await page.locator(`[data-mode-control="${choice}"]`).click();
    state.holdQueue.resolve();
    // Observe completion inside the hidden AI panel without changing user mode.
    await expect(
      page.getByText("建议已发生冲突，已重新读取当前候选和任务。", {
        exact: true,
      }),
    ).toBeAttached();
    await expect(
      page.locator(
        `[data-mode-control="${choice === "none" ? "ai" : choice.startsWith("work") ? "work" : choice}"]`,
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(state.posts.filter((p) => p.path.endsWith("/date-facts"))).toEqual(
      [],
    );
  });
}

for (const choices of [
  [],
  ["work"],
  ["archive"],
  ["collaboration"],
  ["archive", "collaboration"],
  ["collaboration", "archive"],
] as const) {
  test(`delivery held confirmation POST preserves ${choices.join(" then ") || "normal AI return"}`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    state.conflict = true;
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    const form = await page
      .locator('[aria-label="送仓操作区"][data-dirty]')
      .elementHandle();
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(page.getByTestId("ai-confirm")).toBeEnabled();
    state.holdConfirm = deferred();
    state.holdSelection = deferred();
    state.holdQueue = deferred();
    const reads = state.reads.filter((url) =>
      url.includes("/date-facts"),
    ).length;
    await page.getByTestId("ai-confirm").click();
    await state.confirmStarted.promise;
    for (const choice of choices)
      await page.locator(`[data-mode-control="${choice}"]`).click();
    expect(
      state.reads.filter((url) => url.includes("/date-facts")),
    ).toHaveLength(reads);
    state.holdConfirm.resolve();
    await state.selectionStarted.promise;
    await expect(page.locator('[data-mode-control="work"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    state.holdSelection.resolve();
    await expect(
      page.getByRole("status").filter({ hasText: "事实已同步；本地输入保留" }),
    ).toBeVisible();
    state.holdQueue.resolve();
    await expect(
      page.getByText("建议已发生冲突，已重新读取当前候选和任务。", {
        exact: true,
      }),
    ).toBeAttached();
    await expect(
      page.locator(`[data-mode-control="${choices.at(-1) ?? "ai"}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await form?.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.getByLabel("POD、门岗或仓库签收证据")).toHaveValue(
      "55555555-5555-4555-8555-555555555555",
    );
    expect(
      state.posts.filter(
        (p) => p.path.endsWith("/date-facts") || /\/work-orders\//.test(p.path),
      ),
    ).toEqual([]);
  });
}

for (const sameContainer of [true, false]) {
  test(`delivery real queue late confirm isolates ${sameContainer ? "same-container task" : "container"} switch`, async ({
    page,
  }) => {
    const state = await installCapabilities(page, { sameContainer });
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(page.getByTestId("ai-confirm")).toBeEnabled();
    await page.getByLabel("拒绝原因（可选）").fill("unsent A reason");
    state.holdConfirm = deferred();
    await page.getByTestId("ai-confirm").click();
    await state.confirmStarted.promise;
    const bButton = page.locator('[aria-label="送仓任务列表"] button').nth(1);
    await showDeliveryPane(page, "queue");
    await bButton.click();
    await expect(page).toHaveURL(new RegExp(`taskId=${capabilityIds.taskB}`));
    await expect(page.locator('[data-mode-control="work"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // B's initial reads must settle before measuring reads caused by late A.
    await showDeliveryPane(page, "context");
    await page.getByRole("button", { name: "协作", exact: true }).click();
    await expect(page.getByTestId("collaboration-empty")).toBeVisible();
    await page.locator('[data-mode-control="work"]').click();
    const readCount = state.reads.length;
    state.holdConfirm.resolve();
    await state.confirmFinished.promise;
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(
      page.getByText(`当前领取工单 ${capabilityIds.workB}`),
    ).toBeVisible();
    await expect(page.getByLabel("拒绝原因（可选）")).toHaveValue("");
    await expect(
      page.getByRole("region", { name: "送仓工单领取回执", exact: true }),
    ).toHaveCount(0);
    expect(
      state.reads
        .slice(readCount)
        .filter(
          (url) =>
            !url.includes("/ai/action-candidates") &&
            !url.includes("/activities"),
        ),
    ).toEqual([]);
    await page.locator('[data-mode-control="work"]').click();
    await expect(page.getByLabel("POD、门岗或仓库签收证据")).toHaveValue(
      sameContainer ? "55555555-5555-4555-8555-555555555555" : "",
    );
    expect(
      state.posts.filter(
        (p) =>
          p.path.endsWith("/date-facts") || p.path.includes("/work-orders/"),
      ),
    ).toEqual([]);
  });
}

test("delivery capability gates preserve independent professional entry and make zero task writes", async ({
  page,
}) => {
  for (const variant of [
    "no-action",
    "ambiguous",
    "unknown",
    "mismatch",
    "wrong-container",
    "wrong-node",
    "wrong-route",
  ]) {
    await page.unrouteAll({ behavior: "wait" });
    const state = await installCapabilities(page, { variant });
    await gotoDelivery(
      page,
      `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${variant === "wrong-route" ? "missing" : capabilityIds.taskA}`,
    );
    await expect(page.getByLabel("UN/LOCODE（可选）")).toBeVisible();
    await expect(page.locator("[data-mode-control]")).toHaveCount(
      variant === "no-action" ? 3 : 1,
    );
    await expect(
      page
        .getByRole("region", { name: "送仓工单操作", exact: true })
        .getByRole("button"),
    ).toHaveCount(0);
    expect(state.posts).toEqual([]);
  }
});

test("delivery standard geometry keeps pane navigation, drawers and async recovery", async ({
  page,
}, testInfo) => {
  const state = await installCapabilities(page);
  const width = page.viewportSize()!.width;
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await expect(
    page.locator(".workbench-layout--stacked-responsive"),
  ).toHaveCount(0);
  if (width === 390) {
    await expectMobilePane(page, "queue");
    await expect(page.getByTestId("delivery-mobile-breadcrumb")).toHaveText(
      "DELIVERY-A · 送仓任务 · 办理",
    );
    await geometryScreenshot(page, testInfo, "mobile-queue-chromium");
  }
  if (width === 1024) {
    const trigger = page.locator(".workbench-layout__narrow-queue");
    expect((await trigger.boundingBox())!.width).toBe(48);
    await expect(trigger.getByTestId("delivery-queue-rail")).toHaveText(
      "送仓2 项",
    );
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
      .getByRole("button", { name: "关闭任务队列抽屉", exact: true })
      .click({ position: { x: 700, y: 20 } });
    await expect(trigger).toBeFocused();
  }
  await showDeliveryPane(page, "queue");
  await page
    .getByLabel("送仓任务列表")
    .getByRole("button", { name: /DELIVERY-A/ })
    .click();
  if (width === 390) {
    await expectMobilePane(page, "detail");
    await geometryScreenshot(page, testInfo, "mobile-detail-chromium");
  } else if (width === 1024) {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".workbench-layout__narrow-queue")).toBeFocused();
  }
  await fillCapabilityDraft(page);
  const field = page.getByLabel("POD、门岗或仓库签收证据");
  const original = await field.elementHandle();
  await field.focus();
  const scroll = await scrollPositions(page);

  if (width === 390) {
    // Keyboard activation preserves the page position at navigation time;
    // clicking a distant nav first scrolls to that nav before memory capture.
    for (const screen of ["detail", "queue", "context"]) {
      await page
        .locator(`[data-mobile-target="${screen}"]`)
        .evaluate((element) =>
          (element as HTMLElement).focus({ preventScroll: true }),
        );
      await page.keyboard.press("Enter");
    }
    await expect(field).toBeFocused();
    await expect.poll(() => scrollPositions(page)).toEqual(scroll);
    for (const target of await page.locator("[data-mobile-target]").all()) {
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  } else if (width === 1440) {
    await page
      .getByRole("button", { name: "折叠送仓办理", exact: true })
      .click();
    await page
      .getByRole("button", { name: "展开送仓办理", exact: true })
      .click();

    await expect(field).toBeFocused();
  }
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  const risk = page.getByText("影响与风险", { exact: true });
  await risk.scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-ai-spine-step="source"] .task-ai__reference'),
  ).toBeInViewport();
  await expect(
    page.getByText("未采信，不改变任务状态", { exact: true }),
  ).toBeInViewport();
  if (width === 390) await expectMobilePane(page, "context");
  else {
    const boxes = await Promise.all(
      ["detail", "context"].map((pane) =>
        page.locator(`[data-workbench-pane="${pane}"]`).boundingBox(),
      ),
    );
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
    expect(boxes[0]!.height).toBe(boxes[1]!.height);
    expect(boxes[0]!.height).toBeGreaterThan(0);
    const workspace = (await page
      .locator(".workbench-layout__workspace")
      .boundingBox())!;
    expect(boxes[0]!.height).toBe(workspace.height);
    if (width === 1440) {
      const queue = (await page
        .locator('[data-workbench-pane="queue"]')
        .boundingBox())!;
      expect(queue.y).toBe(boxes[0]!.y);
      expect(queue.x + queue.width).toBeLessThan(boxes[0]!.x);
      expect(queue.height).toBe(workspace.height);
    } else
      await expect(page.locator('[data-workbench-pane="queue"]')).toBeHidden();
  }
  await geometryScreenshot(
    page,
    testInfo,
    width === 390 ? "mobile-context-chromium" : undefined,
  );
  await page.locator('[data-mode-control="work"]').click();
  await expect(field).toHaveValue("55555555-5555-4555-8555-555555555555");
  expect(
    await field.evaluate((element, before) => element === before, original),
  ).toBe(true);
  await expect(page.locator('[data-dirty="true"]')).toHaveCount(2);
  if (width === 390) {
    state.conflict = true;
    state.holdConfirm = deferred();
    state.holdSelection = deferred();
    state.holdQueue = deferred();
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await page.getByTestId("ai-confirm").click();
    await state.confirmStarted.promise;
    await showDeliveryPane(page, "detail");
    state.holdConfirm.resolve();
    await state.selectionStarted.promise;
    await showDeliveryPane(page, "queue");
    const focused = await page.locator(":focus").elementHandle();
    const paneScroll = await scrollPositions(page);
    state.holdSelection.resolve();
    await expect(page.getByRole("status")).toContainText("事实已同步");
    state.holdQueue.resolve();
    await expect(
      page.getByText("建议已发生冲突，已重新读取当前候选和任务。", {
        exact: true,
      }),
    ).toBeAttached();
    await expectMobilePane(page, "queue");
    expect(
      await focused?.evaluate((element) => document.activeElement === element),
    ).toBe(true);
    expect(await scrollPositions(page)).toEqual(paneScroll);
    await showDeliveryPane(page, "context");
    await expect(page.locator('[data-mode-control="ai"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  expect(
    state.posts.filter(
      (p) => p.path.endsWith("/date-facts") || p.path.includes("/work-orders/"),
    ),
  ).toEqual([]);
});

test("delivery standard panes isolate inactive keyboard targets at mobile width", async ({
  page,
}, testInfo) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile recovery only");
  await installCapabilities(page);
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  const queue = page.locator('[data-workbench-pane="queue"]');
  const firstTask = page
    .getByLabel("送仓任务列表")
    .getByRole("button", { name: /DELIVERY-A/ });
  await expect(firstTask).toHaveCount(1);
  await firstTask.click();
  await expect(page.locator('[data-mobile-target="detail"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(queue).toHaveAttribute("inert", "");
  await expectLegalDeliveryFocus(page);
  await expect(page.locator('[data-workbench-pane="detail"]')).toBeFocused();
  const selectedUrl = page.url();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () =>
        document.activeElement?.closest('[data-workbench-pane="queue"]') !==
        null,
    ),
  ).toBe(false);
  await page.keyboard.press("Enter");
  expect(page.url()).toBe(selectedUrl);
  await expect(firstTask).not.toBeFocused();
  await page.locator('[data-mobile-target="queue"]').click();
  await expect(firstTask).toBeFocused();
  await firstTask.press("Enter");
  await expectLegalDeliveryFocus(page);
  await evidence(page, testInfo, "delivery-native-keyboard");
});

test("delivery standard collapse preference survives a real mobile breakpoint", async ({
  page,
}, testInfo) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "desktop breakpoint recovery only",
  );
  await installCapabilities(page);
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await fillCapabilityDraft(page);
  const field = page.getByLabel("POD、门岗或仓库签收证据");
  const original = await field.elementHandle();
  await page
    .getByRole("button", { name: "折叠岗位任务池", exact: true })
    .click();
  await page.getByRole("button", { name: "折叠送仓办理", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalDeliveryFocus(page);
  await evidence(page, testInfo, "delivery-collapse-mobile-before-click");
  await page.locator('[data-mobile-target="detail"]').click();
  await page.locator('[data-mobile-target="context"]').click();
  await expect(field).toHaveValue("55555555-5555-4555-8555-555555555555");
  expect(
    await field.evaluate((element, before) => element === before, original),
  ).toBe(true);
  await expect(
    page.locator('[data-workbench-pane="context"]'),
  ).not.toHaveAttribute("inert");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectLegalDeliveryFocus(page);
  await evidence(page, testInfo, "delivery-collapse-desktop-before-click");
  await expect(
    page.getByRole("button", { name: "展开岗位任务池", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "展开送仓办理", exact: true }),
  ).toBeVisible();
});

test("delivery narrow drawer clears its modal state before mobile navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    page.viewportSize()?.width !== 1024,
    "narrow breakpoint recovery only",
  );
  await installCapabilities(page);
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  const trigger = page.locator(".workbench-layout__narrow-queue");
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("送仓任务列表")
    .getByRole("button", { name: /DELIVERY-A/ })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalDeliveryFocus(page);
  await evidence(page, testInfo, "delivery-drawer-mobile-before-click");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".workbench-layout__narrow-backdrop")).toHaveCount(
    0,
  );
  await page.locator('[data-mobile-target="context"]').click();
  await expect(
    page.locator('[data-workbench-pane="context"]'),
  ).not.toHaveAttribute("inert");
  await expect(page.getByLabel("UN/LOCODE（可选）")).toBeVisible();
});

test("delivery breakpoint recovers hidden focus before click (REVIEW-001)", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCapabilities(page);
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await page
    .getByLabel("送仓任务列表")
    .getByRole("button", { name: /DELIVERY-A/ })
    .click();
  await fillCapabilityDraft(page);
  await page.getByLabel("UN/LOCODE（可选）").focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalDeliveryFocus(page);
  await expect(page.locator('[data-workbench-pane="detail"]')).toBeFocused();
  await evidence(page, testInfo, "resize-before-click");
});

test("delivery derived collapse preserves valid detail focus (REVIEW-002)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCapabilities(page);
  await page.goto(
    `/workspaces/delivery?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await expect(
    page.getByRole("button", { name: "折叠岗位任务池", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "折叠岗位任务池", exact: true })
    .click();
  await page.getByRole("button", { name: "折叠送仓办理", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalDeliveryFocus(page);
  await page.locator('[data-mobile-target="detail"]').click();
  const detail = page.locator('[data-workbench-pane="detail"]');
  await expect(detail).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(detail).toBeFocused();
  await expect(
    page.getByRole("button", { name: "展开岗位任务池", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "展开送仓办理", exact: true }),
  ).toBeVisible();
});

async function expectLegalDeliveryFocus(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.closest("[inert], [hidden]"))
          return false;
        const rect = el.getBoundingClientRect();
        return el.checkVisibility() && rect.width > 1 && rect.height > 1;
      }),
    )
    .toBe(true);
}

async function gotoDelivery(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "送仓", exact: true }),
  ).toBeVisible();
  if (url.includes("containerId=")) await showDeliveryPane(page, "context");
}

async function showDeliveryPane(
  page: Page,
  screen: "queue" | "detail" | "context",
) {
  if (page.viewportSize()?.width === 390)
    await page.locator(`[data-mobile-target="${screen}"]`).click();
  else if (page.viewportSize()?.width === 1024 && screen === "queue") {
    const trigger = page.locator(".workbench-layout__narrow-queue");
    if ((await trigger.getAttribute("aria-expanded")) === "false")
      await trigger.click();
  }
}

async function expectMobilePane(page: Page, screen: string) {
  await expect(
    page.locator('[data-workbench-pane][data-mobile-active="true"]'),
  ).toHaveCount(1);
  await expect(
    page.locator(`[data-workbench-pane="${screen}"]`),
  ).toHaveAttribute("data-mobile-active", "true");
  for (const pane of ["queue", "detail", "context"])
    if (pane !== screen)
      await expect(page.locator(`[data-workbench-pane="${pane}"]`)).toHaveCSS(
        "width",
        "1px",
      );
}

async function geometryScreenshot(
  page: Page,
  testInfo: TestInfo,
  projectName?: string,
) {
  const geometry = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    panes: Array.from(
      document.querySelectorAll<HTMLElement>("[data-workbench-pane]"),
    ).map((el) => ({
      pane: el.dataset.workbenchPane,
      client: el.clientWidth,
      scroll: el.scrollWidth,
    })),
    innerScrollOwners: Array.from(
      document.querySelectorAll<HTMLElement>(".task-context, .task-context *"),
    )
      .filter(
        (el) =>
          /auto|scroll/.test(getComputedStyle(el).overflowY) &&
          el.scrollHeight > el.clientHeight + 1,
      )
      .map((el) => el.className),
  }));
  const data = {
    ...geometry,
    focus: await focusData(page),
    scrollPositions: await scrollPositions(page),
  };
  expect(data.scroll).toBeLessThanOrEqual(data.client);
  expect(data.innerScrollOwners).toEqual([]);
  for (const pane of data.panes)
    if (pane.client > 1) expect(pane.scroll).toBeLessThanOrEqual(pane.client);
  await writeFile(
    testInfo.outputPath(
      `geometry-${projectName ?? testInfo.project.name}.json`,
    ),
    JSON.stringify(data, null, 2),
  );
  const project = testInfo.project as { name: string };
  const original = project.name;
  if (projectName) project.name = projectName;
  try {
    // Default "missing" creates expected files. Require explicit update first;
    // --update-snapshots=none still reaches the real comparison for a RED run.
    if (testInfo.config.updateSnapshots === "missing")
      expect(
        existsSync(testInfo.snapshotPath("delivery-standard-geometry.png")),
        "Create the five baselines with an explicit --update-snapshots=all run",
      ).toBe(true);
    await expect(page).toHaveScreenshot("delivery-standard-geometry.png", {
      animations: "disabled",
      scale: "css",
    });
  } finally {
    project.name = original;
  }
}

async function fillCapabilityDraft(page: Page) {
  await showDeliveryPane(page, "context");
  await page
    .getByLabel("调度指令证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:00");
  await page
    .getByLabel("POD、门岗或仓库签收证据")
    .fill("55555555-5555-4555-8555-555555555555");
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function scrollPositions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((element) => element.scrollTop > 0)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        top: element.scrollTop,
      })),
  );
}
async function focusData(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      pane:
        element.closest<HTMLElement>("[data-workbench-pane]")?.dataset
          .workbenchPane ?? null,
      mode:
        element.closest<HTMLElement>("[data-context-mode]")?.dataset
          .contextMode ?? null,
      mobileTarget: element.dataset.mobileTarget ?? null,
      inertOrHidden: Boolean(element.closest("[inert], [hidden]")),
      visible: element.checkVisibility(),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
}
async function evidence(page: Page, testInfo: TestInfo, name: string) {
  const widths = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await writeFile(
    testInfo.outputPath(`${name}-overflow.json`),
    JSON.stringify(
      {
        ...widths,
        focus: await focusData(page),
        scrollPositions: await scrollPositions(page),
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}
