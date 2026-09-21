import { expect, test } from "@playwright/test";

test("warehouse operator records partial unloading then submits completed unloading for review", async ({
  page,
}) => {
  let report: Record<string, unknown> | null = null;
  let unloadingFact: Record<string, unknown> | null = null;
  const reportCommands: Record<string, unknown>[] = [];
  let factCommand: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/unloading-report") {
      if (request.method() === "POST") {
        const command = request.postDataJSON() as Record<string, unknown>;
        reportCommands.push(command);
        report = {
          reportId: `44444444-4444-4444-8444-44444444444${reportCommands.length}`,
          containerRecordId: "container-1",
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
    if (path === "/api/containers/container-1/date-facts") {
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

  await page.goto("/workspaces/unloading?containerId=container-1");
  await expect(page.getByRole("heading", { name: "卸柜工作台" })).toBeVisible();
  await expect(page.getByText("开始或部分卸货只更新进度")).toBeVisible();

  await page.getByRole("button", { name: "部分卸货" }).click();
  await page.getByLabel(/卸货开始时间/).fill("2026-04-23T08:00");
  await page.getByLabel("计划数量").fill("524");
  await page.getByLabel("已卸数量").fill("300");
  await page.getByLabel("剩余数量").fill("224");
  await page
    .getByLabel("卸货清单、照片或仓方确认")
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByRole("button", { name: "保存卸货进度" }).click();
  await expect(
    page
      .getByRole("region", { name: "卸货进度" })
      .getByText("部分卸货", { exact: true }),
  ).toBeVisible();
  expect(factCommand).toBeNull();

  await page.getByRole("button", { name: "卸柜完成" }).click();
  await page.getByLabel("实际卸完时间").fill("2026-04-23T10:30");
  await page.getByLabel("已卸数量").fill("524");
  await page.getByLabel("剩余数量").fill("0");
  await page.getByRole("button", { name: "保存完成并提交复核" }).click();

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

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

function responseFor(path: string): unknown {
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/container-1") return container;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (path === "/api/containers/container-1/delivery-instruction")
    return instruction;
  throw new Error(`Unhandled unloading E2E API path: ${path}`);
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
      nodeCode: "container_unloading",
      containerId: "container-1",
      taskDefinitionKey: "node-container_unloading",
      state: "pending",
      applicability: "required",
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: [],
      workOrders: [],
      outcome: null,
      nextAction: {
        actionCode: "work_execution.claim_work_order",
        workOrderId: "work-1",
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
  containerRecordId: "container-1",
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
