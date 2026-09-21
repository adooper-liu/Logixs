import { expect, test } from "@playwright/test";

test("shipping operator saves handoff and sends actual loading for review", async ({
  page,
}) => {
  let dispatch: Record<string, unknown> | null = null;
  let loadedFact: Record<string, unknown> | null = null;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/dispatch-snapshot") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        dispatch = {
          snapshotId: "dispatch-1",
          containerRecordId: "container-1",
          version: 1,
          stuffingSnapshotId: "stuffing-1",
          stuffingSnapshotVersion: 2,
          bookingNumber: body.bookingNumber,
          carrierCode: body.carrierCode,
          vesselName: body.vesselName,
          voyageNumber: body.voyageNumber,
          masterBillNumber: body.masterBillNumber,
          houseBillNumber: body.houseBillNumber,
          vgmHandoffState: "accepted",
          evidenceRefs: body.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: body.reasonCode,
          createdAt: "2026-09-21T01:00:00Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: dispatch,
      });
      return;
    }
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        loadedFact = {
          factId: "loaded-fact-1",
          nodeCode: "shipment_dispatch",
          eventCode: body.eventCode,
          timeKind: "actual",
          occurredAt: body.occurredAt,
          rawValue: body.rawValue,
          sourceUtcOffset: body.sourceUtcOffset,
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "ops-team",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: "policy-1:1",
          evidenceRefs: body.evidenceRefs,
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 1,
          recordedAt: "2026-09-21T02:01:00Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: "loaded-fact-1",
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
            items: loadedFact ? [loadedFact] : [],
            projectionVersion: loadedFact ? 1 : 0,
            asOf: "2026-09-21T02:01:00Z",
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

  await page.goto("/workspaces/dispatch");
  await expect(page.getByRole("heading", { name: "出运工作台" })).toBeVisible();
  await page.getByRole("button", { name: /KOCU4960726.*领取出运任务/ }).click();
  await expect(page.getByText("8500 KGM", { exact: true })).toBeVisible();

  await page.getByLabel("订舱号").fill("BKG-2026-001");
  await page.getByLabel("船司代码").fill("HMM");
  await page.getByLabel("船名").fill("HMM LEAF");
  await page.getByLabel("航次").fill("0002W");
  await page
    .getByLabel(/订舱 \/ VGM 接收/)
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByRole("checkbox", { name: /VGM 已被/ }).check();
  await page.getByRole("button", { name: "保存出运交接" }).click();
  await expect(page.getByText("出运交接第 1 版已保存")).toBeVisible();
  await expect(
    page.getByText("HMM LEAF / 0002W", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("实际装船").fill("2026-09-21T10:00");
  await page.getByRole("button", { name: "确认实际装船" }).click();
  await expect(
    page.getByText(/SOURCE_AUTHORITY_REVIEW_REQUIRED/),
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
  if (path === "/api/containers/container-1/stuffing-snapshot") return stuffing;
  throw new Error(`Unhandled API path in dispatch E2E: ${path}`);
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "not_shipped",
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
      nodeCode: "shipment_dispatch",
      containerId: "container-1",
      taskDefinitionKey: "node-shipment_dispatch",
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
        workOrderDefinitionKey: "dispatch",
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
const stuffing = {
  snapshotId: "stuffing-1",
  containerRecordId: "container-1",
  version: 2,
  allocationSetId: "allocation-1",
  allocationSetVersion: 2,
  containerNumber: "KOCU4960726",
  sealNumber: "25H1059249",
  packageCount: 524,
  grossWeight: "8319",
  grossWeightUnit: "KGM",
  netWeight: null,
  volume: "66.74",
  volumeUnit: "MTQ",
  vgm: {
    weight: "8500",
    weightUnit: "KGM",
    method: "method_2",
    verifiedAt: "2026-09-20T01:00:00Z",
  },
  evidenceRefs: ["22222222-2222-4222-8222-222222222222"],
  actorId: "operator",
  reasonCode: "confirmed",
  createdAt: "2026-09-20T01:00:00Z",
  duplicate: false,
};
const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "shipment_dispatch",
    version: 3,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "shipment_dispatch",
      sequence: 3,
      state: "active",
      applicability: "required",
      completedAt: null,
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00Z",
  projectionVersion: 3,
};
