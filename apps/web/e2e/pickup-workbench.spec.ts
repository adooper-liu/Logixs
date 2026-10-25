import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

for (const selection of ["exact", "invalid"] as const) {
  test(`pickup ${selection} task keeps professional facts and exact work binding`, async ({
    page,
  }, testInfo) => {
    const workWrites: string[] = [];
    const factWrites: string[] = [];
    const facts: Record<string, unknown>[] = [];
    const reloadHold = deferred();
    await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && path.includes("/work-orders/")) {
        workWrites.push(path);
        await route.fulfill({
          status: 200,
          json: { commitState: "committed", workOrderState: "in_progress" },
        });
        return;
      }
      if (path === "/api/containers/container-1/date-facts") {
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          factWrites.push(`${path}:${body.eventCode}`);
          const fact = savedFact(body, facts.length + 1);
          facts.push(fact);
          await route.fulfill({
            status: 200,
            json: receiptFor(fact),
          });
        } else {
          if (selection === "invalid" && facts.length === 1)
            await reloadHold.promise;
          await route.fulfill({
            status: 200,
            json: {
              items: [arrivalFact, customsFact, ...facts],
              projectionVersion: facts.length,
              asOf: "2026-09-21T05:10:00Z",
            },
          });
        }
        return;
      }
      await route.fulfill({ status: 200, json: responseFor(path) });
    });
    await gotoPickup(
      page,
      `/workspaces/pickup?containerId=container-1&taskId=${selection === "exact" ? "task-1" : "missing-task"}`,
    );
    const taskAction = page.getByRole("region", {
      name: "提柜工单操作",
      exact: true,
    });
    await expect(
      page.getByRole("heading", { name: "提柜", exact: true }),
    ).toBeVisible();
    await expect(taskAction).toBeVisible();
    if (selection === "exact") {
      await expect(
        taskAction.getByRole("button", { name: "领取提柜任务", exact: true }),
      ).toBeVisible();
    } else {
      await expect(taskAction.getByRole("button")).toHaveCount(0);
      await expect(
        taskAction.getByText("当前没有可执行动作", { exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("region", { name: "提柜事实总览", exact: true }),
    ).toBeVisible();
    await showPickupPane(page, "detail");
    await page.screenshot({
      path: testInfo.outputPath(`pickup-${selection}-task.png`),
      fullPage: true,
    });
    await showPickupPane(page, "context");
    await page.getByLabel("UN/LOCODE").fill("USLAX");
    await page.getByLabel("IANA 时区").fill("America/Los_Angeles");
    await page.getByLabel("可提实际时间").fill("2026-09-21T09:00");
    await page
      .getByLabel("码头可提证据")
      .fill("44444444-4444-4444-8444-444444444444");
    await page.getByLabel("实际出场时间").fill("2026-09-21T10:00");
    await page
      .getByLabel("EIR / 出场证据")
      .fill("55555555-5555-4555-8555-555555555555");
    await expect(
      page.getByRole("button", { name: "提交可提复核", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "提交 Gate Out 复核", exact: true }),
    ).toBeEnabled();
    const widths = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    const viewportPath = testInfo.outputPath("viewport-evidence.json");
    await writeFile(viewportPath, JSON.stringify(widths, null, 2));
    await testInfo.attach("viewport-evidence", {
      path: viewportPath,
      contentType: "application/json",
    });
    await taskAction.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`pickup-${selection}-actions.png`),
      fullPage: true,
    });
    if (selection === "exact") {
      await taskAction
        .getByRole("button", { name: "领取提柜任务", exact: true })
        .click();
      await expect
        .poll(() => workWrites)
        .toEqual(["/api/work-orders/work-1/claim"]);
    } else {
      await page
        .getByRole("button", { name: "提交可提复核", exact: true })
        .click();
      await expect
        .poll(() => factWrites)
        .toEqual(["/api/containers/container-1/date-facts:available"]);
      const gateInput = page.getByLabel("EIR / 出场证据");
      await gateInput.focus();
      const before = await gateInput.elementHandle();
      const scrollBefore = await scrollPositions(page);
      await expect(
        page.getByRole("button", { name: "提交 Gate Out 复核", exact: true }),
      ).toBeDisabled();
      reloadHold.resolve();
      await expect(
        page.getByText("事实已保存，等待复核或门禁条件满足", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "提交 Gate Out 复核", exact: true }),
      ).toBeEnabled();
      expect(
        await gateInput.evaluate((element, old) => element === old, before),
      ).toBe(true);
      await expect(gateInput).toBeFocused();
      expect(await scrollPositions(page)).toEqual(scrollBefore);
      await expect(gateInput).toHaveValue(
        "55555555-5555-4555-8555-555555555555",
      );
      await expect(page.getByLabel("实际出场时间")).toHaveValue(
        "2026-09-21T10:00",
      );
      await expect(page.getByLabel("UN/LOCODE")).toHaveValue("USLAX");
      await expect(
        page
          .getByRole("region", { name: "提柜事实总览", exact: true })
          .getByText("待复核", { exact: true }),
      ).toBeVisible();
      await evidence(page, testInfo, "pickup-same-container-draft");
      await page
        .getByRole("button", { name: "提交 Gate Out 复核", exact: true })
        .click();
      await expect
        .poll(() => factWrites)
        .toEqual([
          "/api/containers/container-1/date-facts:available",
          "/api/containers/container-1/date-facts:gate_out",
        ]);
      expect(workWrites).toEqual([]);
    }
    await expect(
      page.getByRole("button", {
        name:
          selection === "invalid" ? "提交 Gate Out 更正" : "提交 Gate Out 复核",
        exact: true,
      }),
    ).toBeVisible();
  });
}

test("pickup real queue switch isolates a held A reload and starts B clean", async ({
  page,
}, testInfo) => {
  const b = { ...container, id: "container-b", containerNumber: "B-CLEAN" };
  const originalTask = taskPage.items[0]!;
  const taskB = {
    ...originalTask,
    id: "task-b",
    containerId: b.id,
    workOrders: [{ ...originalTask.workOrders[0]!, id: "work-b" }],
    nextAction: { ...originalTask.nextAction, workOrderId: "work-b" },
  };
  const holdA = deferred();
  const holdB = deferred();
  const aReloadStarted = deferred();
  const bSelectionStarted = deferred();
  const facts: Record<string, unknown>[] = [];
  const writes: string[] = [];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      writes.push(path);
      const fact = savedFact(request.postDataJSON(), 1);
      facts.push(fact);
      await route.fulfill({ json: receiptFor(fact) });
      return;
    }
    if (path.endsWith("/date-facts")) {
      if (path.includes("container-1") && facts.length) {
        aReloadStarted.resolve();
        await holdA.promise;
      }
      await route.fulfill({
        json: {
          items: path.includes("container-1")
            ? [arrivalFact, customsFact, ...facts]
            : [],
          projectionVersion: facts.length,
          asOf: "2026-09-21T05:10:00Z",
        },
      });
      return;
    }
    if (path === "/api/containers/container-b") {
      bSelectionStarted.resolve();
      await holdB.promise;
      await route.fulfill({ json: b });
      return;
    }
    if (path.endsWith("/lifecycle-nodes")) {
      await route.fulfill({ json: lifecycleNodes });
      return;
    }
    if (path === "/api/containers") {
      await route.fulfill({
        json: { ...containerPage, items: [container, b] },
      });
      return;
    }
    if (path === "/api/node-tasks") {
      await route.fulfill({
        json: { ...taskPage, items: [originalTask, taskB] },
      });
      return;
    }
    await route.fulfill({ json: responseFor(path) });
  });
  await gotoPickup(
    page,
    "/workspaces/pickup?containerId=container-1&taskId=task-1",
  );
  await page.getByLabel("UN/LOCODE").fill("USLAX");
  await page.getByLabel("IANA 时区").fill("America/Los_Angeles");
  await page.getByLabel("可提实际时间").fill("2026-09-21T09:00");
  await page
    .getByLabel("码头可提证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByLabel("实际出场时间").fill("2026-09-21T10:00");
  await page
    .getByLabel("EIR / 出场证据")
    .fill("55555555-5555-4555-8555-555555555555");
  const app = await page.locator(".role-workbench").elementHandle();
  await page.getByRole("button", { name: "提交可提复核", exact: true }).click();
  await aReloadStarted.promise;
  await expect(page.getByLabel("EIR / 出场证据")).toHaveValue(
    "55555555-5555-4555-8555-555555555555",
  );
  await expect(
    page
      .getByRole("region", { name: "提柜工单操作", exact: true })
      .getByRole("button"),
  ).toHaveCount(0);
  await showPickupPane(page, "queue");
  await page.getByRole("button", { name: /B-CLEAN.*领取提柜任务/ }).click();
  await bSelectionStarted.promise;
  await expect(page).toHaveURL(/containerId=container-b/);
  await expect(page.getByLabel("EIR / 出场证据")).toHaveCount(0);
  holdB.resolve();
  await showPickupPane(page, "context");
  await expect(page.getByLabel("UN/LOCODE")).toHaveValue("");
  await expect(page.getByLabel("可提实际时间")).toHaveValue("");
  await expect(page.getByLabel("实际出场时间")).toHaveValue("");
  await expect(page.getByLabel("码头可提证据")).toHaveValue("");
  await expect(page.getByLabel("EIR / 出场证据")).toHaveValue("");
  await expect(
    page.getByText("事实已保存，等待复核或门禁条件满足", { exact: true }),
  ).toHaveCount(0);
  const bReads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("container-b")) bReads.push(request.url());
  });
  const lateResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      "/api/containers/container-1/date-facts",
  );
  holdA.resolve();
  await (await lateResponse).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  // Wait for the held network response and Vue's render, without a timer.
  await expect(page.getByRole("status")).toContainText("事实已同步");
  expect(
    await page
      .locator(".role-workbench")
      .evaluate((element, old) => element === old, app),
  ).toBe(true);
  await expect(page.getByLabel("EIR / 出场证据")).toHaveValue("");
  await expect(
    page.getByText("事实已保存，等待复核或门禁条件满足", { exact: true }),
  ).toHaveCount(0);
  expect(bReads).toEqual([]);
  expect(writes).toEqual(["/api/containers/container-1/date-facts"]);
  await page.getByLabel("UN/LOCODE").scrollIntoViewIfNeeded();
  await evidence(page, testInfo, "pickup-switched-b-location");
  await page
    .getByRole("region", { name: "提柜工单操作", exact: true })
    .scrollIntoViewIfNeeded();
  await evidence(page, testInfo, "pickup-switched-b-clean");
});

test("pickup operator records terminal availability and laden gate-out for review", async ({
  page,
}) => {
  const facts: Record<string, unknown>[] = [];
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        const eventCode = String(body.eventCode);
        const factId =
          eventCode === "available"
            ? "77777777-7777-4777-8777-777777777777"
            : "88888888-8888-4888-8888-888888888888";
        facts.push({
          factId,
          nodeCode: "container_pickup",
          eventCode,
          timeKind: "actual",
          occurredAt: body.occurredAt,
          rawValue: body.rawValue,
          sourceUtcOffset: body.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "terminal-operator",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: null,
          location: body.location,
          evidenceRefs: body.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: facts.length + 1,
          recordedAt: "2026-09-21T05:10:00Z",
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId,
            recordState: "recorded",
            applicationState: "review_required",
            reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
            canonicalEventId: null,
            projectionVersion: facts.length,
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            items: [arrivalFact, customsFact, ...facts],
            projectionVersion: facts.length,
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

  await gotoPickup(page, "/workspaces/pickup");
  await expect(
    page.getByRole("heading", { name: "提柜", exact: true }),
  ).toBeVisible();
  await showPickupPane(page, "queue");
  await page.getByRole("button", { name: /KOCU4960726.*领取提柜任务/ }).click();
  await showPickupPane(page, "context");
  await page.getByLabel("UN/LOCODE").fill("USLAX");
  await page.getByLabel("IANA 时区").fill("America/Los_Angeles");

  await page.getByLabel("可提实际时间").fill("2026-09-21T09:00");
  await page
    .getByLabel("码头可提证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByRole("button", { name: "提交可提复核" }).click();
  await expect(page.getByText("码头可提", { exact: true })).toBeVisible();
  await expect(page.getByText("待复核", { exact: true })).toBeVisible();

  await page.getByLabel("实际出场时间").fill("2026-09-21T10:00");
  await page
    .getByLabel("EIR / 出场证据")
    .fill("55555555-5555-4555-8555-555555555555");
  await page.getByRole("button", { name: "提交 Gate Out 复核" }).click();
  await expect(page.getByText("重柜 Gate Out", { exact: true })).toBeVisible();
  await expect(page.getByText("待复核", { exact: true })).toHaveCount(2);
  expect(facts.map((fact) => fact.eventCode)).toEqual([
    "available",
    "gate_out",
  ]);

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
  const collaboration = path.match(/\/node-tasks\/([^/]+)\/collaboration$/);
  if (collaboration) return collaborationPage(collaboration[1]!, "container-1");
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/container-1") return container;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  throw new Error(`Unhandled API path in pickup E2E: ${path}`);
}

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
    title: "建议领取当前提柜工单",
    rationale: "合成演练：领取建立工单责任。",
    impact: "领取不证明可提、Gate Out、计划或交接。",
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
              containerNumber: "PICKUP-A",
            },
            {
              ...container,
              id: capabilityIds.containerB,
              containerNumber: "PICKUP-B",
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
    if (path.endsWith("/date-facts")) {
      if (state.holdSelection) {
        state.selectionStarted.resolve();
        await state.holdSelection.promise;
      }
      await route.fulfill({
        json: { items: [], projectionVersion: 1, asOf: "2026-10-21T08:00:00Z" },
      });
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
            id === capabilityIds.containerA ? "PICKUP-A" : "PICKUP-B",
        },
      });
      return;
    }
    throw new Error(`Unhandled capability fixture: ${path}`);
  });
  return state;
}

test("pickup task context candidate, exact refs, dirty modes and real claim transition", async ({
  page,
}, testInfo) => {
  const state = await installCapabilities(page);
  await gotoPickup(
    page,
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await fillCapabilityDraft(page);
  const field = page.getByLabel("EIR / 出场证据");
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
  await evidence(page, testInfo, "pickup-task-context");
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
    testInfo.outputPath("pickup-task-context-scroll.json"),
    JSON.stringify(structure, null, 2),
  );
  // Standard geometry has five active baselines below; B2's stacked images
  // remain historical evidence. Keep this entire business path running.
  await page.getByTestId("ai-confirm").click();
  await expect(
    page.getByRole("button", { name: "AI 辅助", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "提柜工单领取回执", exact: true }),
  ).toContainText(capabilityIds.workA);
  await expect(
    page.getByRole("region", { name: "提柜工单领取回执", exact: true }),
  ).toContainText("仅证明工单领取");
  await expect(field).toHaveValue("55555555-5555-4555-8555-555555555555");
  await expect(
    page.getByRole("button", { name: "完成提柜工单", exact: true }),
  ).toBeVisible();
  expect(state.tasks[0]!.nextAction?.actionCode).toBe(
    "work_execution.complete_work_order",
  );
  expect(state.posts.filter((p) => p.path.endsWith("/date-facts"))).toEqual([]);
});

test("pickup direct claim failure retries original key then completes exact work order", async ({
  page,
}) => {
  const state = await installCapabilities(page);
  state.failClaim = true;
  await gotoPickup(
    page,
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await page.getByRole("button", { name: "领取提柜任务", exact: true }).click();
  await page
    .getByRole("button", { name: "使用原编号重试", exact: true })
    .click();
  await page.getByRole("button", { name: "完成提柜工单", exact: true }).click();
  await expect(page.getByText("提柜工单已完成", { exact: true })).toBeVisible();
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
  test(`pickup held refresh respects real ${choice} mode intent`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    state.conflict = true;
    await gotoPickup(
      page,
      `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
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
  test(`pickup held confirmation POST preserves ${choices.join(" then ") || "normal AI return"}`, async ({
    page,
  }) => {
    const state = await installCapabilities(page);
    state.conflict = true;
    await gotoPickup(
      page,
      `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    const form = await page.locator("[data-dirty]").elementHandle();
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
    await expect(page.getByLabel("EIR / 出场证据")).toHaveValue(
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
  test(`pickup real queue late confirm isolates ${sameContainer ? "same-container task" : "container"} switch`, async ({
    page,
  }) => {
    const state = await installCapabilities(page, { sameContainer });
    await gotoPickup(
      page,
      `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
    );
    await fillCapabilityDraft(page);
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await expect(page.getByTestId("ai-confirm")).toBeEnabled();
    await page.getByLabel("拒绝原因（可选）").fill("unsent A reason");
    state.holdConfirm = deferred();
    await page.getByTestId("ai-confirm").click();
    await state.confirmStarted.promise;
    const bButton = page.locator('[aria-label="提柜任务列表"] button').nth(1);
    await showPickupPane(page, "queue");
    await bButton.click();
    await expect(page).toHaveURL(new RegExp(`taskId=${capabilityIds.taskB}`));
    await expect(page.locator('[data-mode-control="work"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // B's initial reads must settle before measuring reads caused by late A.
    await showPickupPane(page, "context");
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
      page.getByRole("region", { name: "提柜工单领取回执", exact: true }),
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
    await expect(page.getByLabel("EIR / 出场证据")).toHaveValue(
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

test("pickup capability gates preserve independent professional entry and make zero task writes", async ({
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
    await gotoPickup(
      page,
      `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${variant === "wrong-route" ? "missing" : capabilityIds.taskA}`,
    );
    await expect(page.getByLabel("UN/LOCODE")).toBeVisible();
    await expect(page.locator("[data-mode-control]")).toHaveCount(
      variant === "no-action" ? 3 : 1,
    );
    await expect(
      page
        .getByRole("region", { name: "提柜工单操作", exact: true })
        .getByRole("button"),
    ).toHaveCount(0);
    expect(state.posts).toEqual([]);
  }
});

test("pickup standard geometry keeps pane navigation, drawers and async recovery", async ({
  page,
}, testInfo) => {
  const state = await installCapabilities(page);
  const width = page.viewportSize()!.width;
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await expect(
    page.locator(".workbench-layout--stacked-responsive"),
  ).toHaveCount(0);
  if (width === 390) {
    await expectMobilePane(page, "queue");
    await expect(page.getByTestId("pickup-mobile-breadcrumb")).toHaveText(
      "PICKUP-A · 提柜任务 · 办理",
    );
    await geometryScreenshot(page, testInfo, "mobile-queue-chromium");
  }
  if (width === 1024) {
    const trigger = page.locator(".workbench-layout__narrow-queue");
    expect((await trigger.boundingBox())!.width).toBe(48);
    await expect(trigger.getByTestId("pickup-queue-rail")).toHaveText(
      "提柜2 项",
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
  await showPickupPane(page, "queue");
  await page
    .getByLabel("提柜任务列表")
    .getByRole("button", { name: /PICKUP-A/ })
    .click();
  if (width === 390) {
    await expectMobilePane(page, "detail");
    await geometryScreenshot(page, testInfo, "mobile-detail-chromium");
  } else if (width === 1024) {
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".workbench-layout__narrow-queue")).toBeFocused();
  }
  await fillCapabilityDraft(page);
  const field = page.getByLabel("EIR / 出场证据");
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
      .getByRole("button", { name: "折叠提柜办理", exact: true })
      .click();
    await page
      .getByRole("button", { name: "展开提柜办理", exact: true })
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
  await expect(page.locator('[data-dirty="true"]')).toHaveCount(1);
  if (width === 390) {
    state.conflict = true;
    state.holdConfirm = deferred();
    state.holdSelection = deferred();
    state.holdQueue = deferred();
    await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
    await page.getByTestId("ai-confirm").click();
    await state.confirmStarted.promise;
    await showPickupPane(page, "detail");
    state.holdConfirm.resolve();
    await state.selectionStarted.promise;
    await showPickupPane(page, "queue");
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
    await showPickupPane(page, "context");
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

test("pickup standard panes isolate inactive keyboard targets at mobile width", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile recovery only");
  await installCapabilities(page);
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  const queue = page.locator('[data-workbench-pane="queue"]');
  const firstTask = page
    .getByLabel("提柜任务列表")
    .getByRole("button", { name: /PICKUP-A/ });
  await expect(firstTask).toHaveCount(1);
  await firstTask.click();
  await expect(page.locator('[data-mobile-target="detail"]')).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(queue).toHaveAttribute("inert", "");
  await expectLegalPickupFocus(page);
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
  await expectLegalPickupFocus(page);
});

test("pickup standard collapse preference survives a real mobile breakpoint", async ({
  page,
}, testInfo) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "desktop breakpoint recovery only",
  );
  await installCapabilities(page);
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await fillCapabilityDraft(page);
  const field = page.getByLabel("EIR / 出场证据");
  const original = await field.elementHandle();
  await page
    .getByRole("button", { name: "折叠岗位任务池", exact: true })
    .click();
  await page.getByRole("button", { name: "折叠提柜办理", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalPickupFocus(page);
  await evidence(page, testInfo, "pickup-collapse-mobile-before-click");
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
  await expectLegalPickupFocus(page);
  await evidence(page, testInfo, "pickup-collapse-desktop-before-click");
  await expect(
    page.getByRole("button", { name: "展开岗位任务池", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "展开提柜办理", exact: true }),
  ).toBeVisible();
});

test("pickup narrow drawer clears its modal state before mobile navigation", async ({
  page,
}, testInfo) => {
  test.skip(
    page.viewportSize()?.width !== 1024,
    "narrow breakpoint recovery only",
  );
  await installCapabilities(page);
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  const trigger = page.locator(".workbench-layout__narrow-queue");
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("提柜任务列表")
    .getByRole("button", { name: /PICKUP-A/ })
    .click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalPickupFocus(page);
  await evidence(page, testInfo, "pickup-drawer-mobile-before-click");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".workbench-layout__narrow-backdrop")).toHaveCount(
    0,
  );
  await page.locator('[data-mobile-target="context"]').click();
  await expect(
    page.locator('[data-workbench-pane="context"]'),
  ).not.toHaveAttribute("inert");
  await expect(page.getByLabel("UN/LOCODE")).toBeVisible();
});

test("pickup breakpoint recovers hidden focus before click (REVIEW-001)", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCapabilities(page);
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await page
    .getByLabel("提柜任务列表")
    .getByRole("button", { name: /PICKUP-A/ })
    .click();
  await fillCapabilityDraft(page);
  await page.getByLabel("UN/LOCODE").focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalPickupFocus(page);
  await expect(page.locator('[data-workbench-pane="detail"]')).toBeFocused();
  await evidence(page, testInfo, "resize-before-click");
});

test("pickup derived collapse preserves valid detail focus (REVIEW-002)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installCapabilities(page);
  await page.goto(
    `/workspaces/pickup?containerId=${capabilityIds.containerA}&taskId=${capabilityIds.taskA}`,
  );
  await expect(
    page.getByRole("button", { name: "折叠岗位任务池", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "折叠岗位任务池", exact: true })
    .click();
  await page.getByRole("button", { name: "折叠提柜办理", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectLegalPickupFocus(page);
  await page.locator('[data-mobile-target="detail"]').click();
  const detail = page.locator('[data-workbench-pane="detail"]');
  await expect(detail).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(detail).toBeFocused();
  await expect(
    page.getByRole("button", { name: "展开岗位任务池", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "展开提柜办理", exact: true }),
  ).toBeVisible();
});

async function expectLegalPickupFocus(page: Page) {
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

async function gotoPickup(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "提柜", exact: true }),
  ).toBeVisible();
  if (url.includes("containerId=")) await showPickupPane(page, "context");
}

async function showPickupPane(
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
  const data = await page.evaluate(() => ({
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
        existsSync(testInfo.snapshotPath("pickup-standard-geometry.png")),
        "Create the five baselines with an explicit --update-snapshots=all run",
      ).toBe(true);
    await expect(page).toHaveScreenshot("pickup-standard-geometry.png", {
      animations: "disabled",
      scale: "css",
    });
  } finally {
    project.name = original;
  }
}

async function fillCapabilityDraft(page: Page) {
  await showPickupPane(page, "context");
  await page.getByLabel("UN/LOCODE").fill("USNYC");
  await page.getByLabel("IANA 时区").fill("America/New_York");
  await page.getByLabel("可提实际时间").fill("2026-09-21T09:00");
  await page
    .getByLabel("码头可提证据")
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByLabel("实际出场时间").fill("2026-09-21T10:00");
  await page
    .getByLabel("EIR / 出场证据")
    .fill("55555555-5555-4555-8555-555555555555");
}

function savedFact(
  body: Record<string, unknown>,
  version: number,
): Record<string, unknown> {
  return {
    factId:
      body.eventCode === "available"
        ? "77777777-7777-4777-8777-777777777777"
        : "88888888-8888-4888-8888-888888888888",
    nodeCode: "container_pickup",
    eventCode: body.eventCode,
    timeKind: "actual",
    occurredAt: body.occurredAt,
    rawValue: body.rawValue,
    sourceUtcOffset: body.sourceUtcOffset,
    ingestionChannel: "manual_ui",
    captureSource: "manual_backfill",
    sourceSystem: "logix.manual",
    authoritySystem: "terminal-operator",
    verificationState: "pending",
    confidenceState: "unknown",
    validity: "effective",
    authorityPolicyRef: null,
    location: body.location,
    evidenceRefs: body.evidenceRefs,
    applicationState: "review_required",
    applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: version,
    recordedAt: "2026-09-21T05:10:00Z",
  };
}
function receiptFor(fact: Record<string, unknown>) {
  return {
    factId: fact.factId,
    recordState: "recorded",
    applicationState: "review_required",
    reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
    canonicalEventId: null,
    projectionVersion: fact.projectionVersion,
  };
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
async function evidence(page: Page, testInfo: TestInfo, name: string) {
  const widths = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await writeFile(
    testInfo.outputPath(`${name}-overflow.json`),
    JSON.stringify(widths, null, 2),
  );
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "at_port",
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
      nodeCode: "container_pickup",
      containerId: "container-1",
      taskDefinitionKey: "node-container_pickup",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [
        {
          id: "work-1",
          workOrderDefinitionKey: "pickup",
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
        workOrderDefinitionKey: "pickup",
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
    currentNodeCode: "container_pickup",
    version: 9,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "container_pickup",
      sequence: 10,
      state: "active",
      applicability: "required",
      completedAt: null,
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 9,
};
const arrivalFact = {
  factId: "11111111-1111-4111-8111-111111111111",
  nodeCode: "destination_arrival",
  eventCode: "arrived",
  timeKind: "actual",
  occurredAt: "2026-09-20T22:58:00Z",
  validity: "effective",
  location: {
    locationType: "terminal",
    unlocode: "USLAX",
    timezone: "America/Los_Angeles",
  },
  evidenceRefs: [],
  applicationState: "applied",
  applicationReasonCode: null,
  projectionVersion: 1,
};
const customsFact = {
  ...arrivalFact,
  factId: "22222222-2222-4222-8222-222222222222",
  nodeCode: "customs_clearance",
  eventCode: "container_customs_completed",
  occurredAt: "2026-09-21T02:00:00Z",
};
