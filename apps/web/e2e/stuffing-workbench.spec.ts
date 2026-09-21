import { expect, test } from "@playwright/test";

test("stuffing operator records a versioned snapshot and submits the actual time", async ({
  page,
}) => {
  let snapshot: Record<string, unknown> | null = null;
  let actualFact: Record<string, unknown> | null = null;
  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/containers/container-1/stuffing-snapshot") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        snapshot = {
          snapshotId: "snapshot-1",
          containerRecordId: "container-1",
          version: 1,
          allocationSetId: "allocation-1",
          allocationSetVersion: 2,
          containerNumber: body.containerNumber,
          sealNumber: body.sealNumber,
          packageCount: body.packageCount,
          grossWeight: body.grossWeight,
          grossWeightUnit: "KGM",
          netWeight: body.netWeight,
          volume: body.volume,
          volumeUnit: "MTQ",
          vgm: null,
          evidenceRefs: body.evidenceRefs,
          actorId: "dev-operator",
          reasonCode: body.reasonCode,
          createdAt: "2026-09-21T01:00:00.000Z",
          duplicate: false,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: snapshot,
      });
      return;
    }
    if (path === "/api/containers/container-1/date-facts") {
      if (request.method() === "POST") {
        actualFact = {
          factId: "fact-1",
          nodeCode: "container_stuffing",
          eventCode: "stuffed",
          timeKind: "actual",
          occurredAt: "2026-09-21T02:00:00.000Z",
          rawValue: "2026-09-21T10:00",
          sourceUtcOffset: "+08:00",
          ingestionChannel: "manual_ui",
          captureSource: "manual_backfill",
          sourceSystem: "logix.manual",
          authoritySystem: "ops-team",
          verificationState: "pending",
          confidenceState: "unknown",
          validity: "effective",
          authorityPolicyRef: null,
          evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
          applicationState: "review_required",
          applicationReasonCode: "SOURCE_AUTHORITY_REVIEW_REQUIRED",
          canonicalEventId: null,
          projectionVersion: 1,
          recordedAt: "2026-09-21T02:01:00.000Z",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            factId: "fact-1",
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
            items: actualFact ? [actualFact] : [],
            projectionVersion: actualFact ? 1 : 0,
            asOf: "2026-09-21T02:01:00.000Z",
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

  await page.goto("/workspaces/stuffing");
  await expect(page.getByRole("heading", { name: "装箱工作台" })).toBeVisible();
  await page.getByRole("button", { name: /完成装箱确认/ }).click();
  await expect(page.getByText("833-066V00BK", { exact: true })).toBeVisible();
  await expect(page.getByText("待记录装箱结果", { exact: true })).toBeVisible();

  await page.getByLabel("封号").fill("25H1059249");
  await page.getByLabel("包装数").fill("524");
  await page.getByLabel("毛重 (kg)").fill("8319");
  await page.getByLabel("净重 (kg)").fill("8000");
  await page.getByLabel("体积 (m³)").fill("66.74");
  await page
    .getByLabel("装箱证据")
    .fill("33333333-3333-4333-8333-333333333333");
  await page.getByRole("button", { name: "保存装箱记录" }).click();
  await expect(page.getByText("装箱记录第 1 版已保存")).toBeVisible();
  await expect(page.getByText("装箱记录齐备", { exact: true })).toBeVisible();

  await page.getByLabel("实际完成时间").fill("2026-09-21T10:00");
  await page.getByRole("button", { name: "提交实际装箱时间" }).click();
  await expect(page.getByText("已保存，等待来源与证据复核")).toBeVisible();
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
  if (path === "/api/containers/container-1/cargo") return cargo;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (path === "/api/containers/container-1") return container;
  throw new Error(`Unhandled API path in stuffing E2E: ${path}`);
}

const container = {
  id: "container-1",
  orderNumber: "26DSS00033",
  containerNumber: "KOCU4960726",
  currentStatus: "not_shipped",
  updatedAt: "2026-09-21T00:00:00.000Z",
};
const containerPage = {
  items: [container],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};
const taskPage = {
  items: [
    {
      id: "task-1",
      flowInstanceId: "flow-1",
      nodeInstanceId: "node-1",
      nodeCode: "container_stuffing",
      containerId: "container-1",
      taskDefinitionKey: "node-container_stuffing",
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
        workOrderDefinitionKey: "stuffing",
        assignmentState: "pool",
        assigneeId: null,
        dueAt: null,
      },
    },
  ],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 1,
};
const cargo = {
  containerRecordId: "container-1",
  allocationSetId: "allocation-1",
  allocationSetVersion: 2,
  items: [
    {
      replenishmentOrderLineId: "line-1",
      productSkuId: "sku-1",
      productNumber: "833-066V00BK",
      allocatedQuantity: "50",
      quantityUnit: "carton",
    },
  ],
};
const lifecycleNodes = {
  flow: {
    id: "flow-1",
    state: "active",
    currentNodeCode: "container_stuffing",
    version: 2,
  },
  nodes: [
    {
      nodeInstanceId: "node-1",
      nodeCode: "container_stuffing",
      sequence: 2,
      state: "active",
      applicability: "required",
      completedAt: null,
      isCurrent: true,
    },
  ],
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 2,
};
