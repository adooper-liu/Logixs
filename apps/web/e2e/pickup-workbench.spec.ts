import { expect, test } from "@playwright/test";

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

  await page.goto("/workspaces/pickup");
  await expect(page.getByRole("heading", { name: "提柜工作台" })).toBeVisible();
  await page.getByRole("button", { name: /KOCU4960726.*领取提柜任务/ }).click();
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
  if (path === "/api/containers") return containerPage;
  if (path === "/api/node-tasks") return taskPage;
  if (path === "/api/containers/container-1") return container;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  throw new Error(`Unhandled API path in pickup E2E: ${path}`);
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
      workOrders: [],
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
      isCurrent: true,
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
