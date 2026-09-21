import { expect, test } from "@playwright/test";

test("customs operator saves release case and sends actual clearance for review", async ({
  page,
}) => {
  let clearanceCase: Record<string, unknown> | null = null;
  let customsFact: Record<string, unknown> | null = null;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/customs-clearance-case") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        clearanceCase = {
          caseId: "66666666-6666-4666-8666-666666666666",
          containerRecordId: "container-1",
          version: 1,
          jurisdictionCountryCode: body.jurisdictionCountryCode,
          customsBrokerPartyId: body.customsBrokerPartyId,
          declarationNumber: body.declarationNumber,
          filingState: body.filingState,
          decisionState: body.decisionState,
          activeHoldCodes: body.activeHoldCodes,
          evidenceRefs: body.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: body.reasonCode,
          createdAt: "2026-09-21T05:00:00Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: clearanceCase,
      });
      return;
    }
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        customsFact = {
          factId: "77777777-7777-4777-8777-777777777777",
          nodeCode: "customs_clearance",
          eventCode: "container_customs_completed",
          timeKind: "actual",
          occurredAt: body.occurredAt,
          rawValue: body.rawValue,
          sourceUtcOffset: body.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "customs-authority",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: null,
          evidenceRefs: body.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 1,
          recordedAt: "2026-09-21T05:10:00Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: "77777777-7777-4777-8777-777777777777",
            recordState: "recorded",
            applicationState: "review_required",
            reasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
            canonicalEventId: null,
            projectionVersion: 1,
          },
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            items: customsFact ? [arrivalFact, customsFact] : [arrivalFact],
            projectionVersion: customsFact ? 1 : 0,
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

  await page.goto("/workspaces/customs");
  await expect(page.getByRole("heading", { name: "清关工作台" })).toBeVisible();
  await page.getByRole("button", { name: /KOCU4960726.*领取清关任务/ }).click();
  await expect(page.getByText("尚未建立清关案件")).toBeVisible();

  await page.getByLabel("进口国/地区代码").fill("US");
  await page
    .getByLabel("清关行档案 ID")
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByLabel("申报编号").fill("ENTRY-001");
  await page.getByLabel("申报状态").selectOption("accepted");
  await page
    .getByRole("combobox", { name: "海关决定", exact: true })
    .selectOption("released");
  await page
    .getByLabel(/申报受理 \/ 海关决定证据/)
    .fill("44444444-4444-4444-8444-444444444444");
  await page.getByRole("button", { name: "建立清关案件" }).click();
  await expect(page.getByText("清关案件第 1 版已保存")).toBeVisible();
  await expect(page.getByText("海关已放行")).toBeVisible();

  await page.getByLabel("实际清关时间").fill("2026-09-21T13:00");
  await page.getByRole("button", { name: "提交复核" }).click();
  await expect(
    page.getByText("实际清关时间已提交，等待复核岗位核验。"),
  ).toBeVisible();

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
  throw new Error(`Unhandled API path in customs E2E: ${path}`);
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
      nodeCode: "customs_clearance",
      containerId: "container-1",
      taskDefinitionKey: "node-customs_clearance",
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
        workOrderDefinitionKey: "customs",
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
    currentNodeCode: "customs_clearance",
    version: 7,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
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
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 7,
};
const arrivalFact = {
  factId: "88888888-8888-4888-8888-888888888888",
  nodeCode: "destination_arrival",
  eventCode: "arrived",
  timeKind: "actual",
  occurredAt: "2026-09-20T22:58:00Z",
  rawValue: "2026-09-21 06:58",
  sourceUtcOffset: "+08:00",
  ingestionChannel: "api",
  captureSource: "external_evidence",
  sourceSystem: "carrier",
  authoritySystem: "terminal",
  verificationState: "verified",
  confidenceState: "confirmed",
  validity: "effective",
  authorityPolicyRef: "arrival:1",
  evidenceRefs: ["99999999-9999-4999-8999-999999999999"],
  applicationState: "pending_application",
  applicationReasonCode: "LIFECYCLE_EVENT_PENDING_PREDECESSOR",
  canonicalEventId: null,
  projectionVersion: 1,
  recordedAt: "2026-09-20T23:00:00Z",
};
