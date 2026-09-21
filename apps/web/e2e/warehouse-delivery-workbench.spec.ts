import { expect, test } from "@playwright/test";

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
          instructionId: "66666666-6666-4666-8666-666666666666",
          containerRecordId: "container-1",
          version: 1,
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
  await expect(page.getByRole("heading", { name: "送仓工作台" })).toBeVisible();
  await page.getByRole("button", { name: /KOCU4960726.*领取送仓任务/ }).click();
  await expect(page.getByText("先锁定本柜本次目的仓")).toBeVisible();

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
  await expect(
    page.getByText("VLS · Barcelona VLS", { exact: true }),
  ).toBeVisible();

  await page.getByLabel(/实际到仓时间/).fill("2026-09-21T10:30");
  await page
    .getByLabel("POD、门岗或仓库签收证据")
    .fill("55555555-5555-4555-8555-555555555555");
  await page.getByRole("button", { name: "提交实际送仓复核" }).click();

  await expect(
    page.getByText("实际送仓已保存，等待另一名复核人采信"),
  ).toBeVisible();
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
    location: {
      locationType: "warehouse",
      locationId: "33333333-3333-4333-8333-333333333333",
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
      workOrders: [],
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
