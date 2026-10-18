import { expect, test, type Page } from "@playwright/test";

test("stuffing operator records a versioned snapshot and submits the actual time", async ({
  page,
}) => {
  let snapshot: Record<string, unknown> | null = null;
  let actualFact: Record<string, unknown> | null = null;
  await page.route(
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\//,
    async (route) => {
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
            ingestionChannel: "manual_ui",
            sourceSystem: "logix.web",
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
      if (path === "/api/work-sessions") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            contractVersion: "work-session-page.v1",
            items: [],
            pageSize: 50,
            nextCursor: null,
          },
        });
        return;
      }
      if (path === "/api/work-sessions/open") {
        const body = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          json: {
            contractVersion: "work-session.v1",
            sessionId: "88888888-8888-4888-8888-888888888888",
            version: 1,
            status: "current",
            workbenchCode: body.workbenchCode,
            contextKey: "stuffing|container:container-1|task:task-1",
            routeContext: body.routeContext,
            subjectRef: body.subjectRef,
            taskRef: body.taskRef,
            domainVersionSeen: 0,
            activeItemKey: body.activeItemKey,
            contextMode: body.contextMode,
            displaySummary: body.displaySummary,
            lastOpenedAt: "2026-09-21T00:00:00.000Z",
            createdAt: "2026-09-21T00:00:00.000Z",
            updatedAt: "2026-09-21T00:00:00.000Z",
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: responseFor(path),
      });
    },
  );

  await page.goto("/workspaces/stuffing");
  await expect(page.getByRole("heading", { name: "装箱" })).toBeVisible();
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

test("stuffing queue delegates vertical scrolling to the shared shell", async ({
  page,
}) => {
  await page.route(
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\//,
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: historicalResponseFor(path),
      });
    },
  );

  await page.goto("/workspaces/stuffing");
  await expect(page.locator(".queue-list")).toBeVisible();
  await expectSharedQueueScrollOwnership(page);
});

async function expectSharedQueueScrollOwnership(page: Page): Promise<void> {
  const queueList = page.locator(".queue-list");
  const listStyle = await queueList.evaluate((element) => {
    const style = getComputedStyle(element);
    return { maxHeight: style.maxHeight, overflowY: style.overflowY };
  });
  expect(listStyle.maxHeight).not.toBe("680px");
  expect(listStyle.overflowY).not.toMatch(/auto|scroll/);

  await queueList.evaluate((element) => {
    (element as HTMLElement).style.minHeight = "1400px";
  });
  const paneOwner = page.locator(
    '[data-workbench-pane="queue"] .workbench-pane__scroll--independent',
  );
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 1101) {
    const result = await paneOwner.evaluate((element) => {
      const owner = element as HTMLElement;
      const maxScroll = owner.scrollHeight - owner.clientHeight;
      owner.scrollTop = Math.min(73, maxScroll);
      return { maxScroll, scrollTop: owner.scrollTop };
    });
    expect(result.maxScroll).toBeGreaterThan(0);
    expect(result.scrollTop).toBeGreaterThan(0);
  } else {
    const paneDimensions = await paneOwner.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(paneDimensions.scrollHeight).toBeLessThanOrEqual(
      paneDimensions.clientHeight + 1,
    );
    const pageScroll = await page
      .locator(".workbench-layout__workspace")
      .evaluate((workspace) => {
        let candidate: HTMLElement | null = workspace.parentElement;
        while (candidate) {
          const style = getComputedStyle(candidate);
          if (
            /(auto|scroll)/.test(`${style.overflow} ${style.overflowY}`) &&
            candidate.scrollHeight > candidate.clientHeight + 1
          ) {
            break;
          }
          candidate = candidate.parentElement;
        }
        const owner = candidate ?? document.scrollingElement;
        if (!(owner instanceof HTMLElement)) {
          return { maxScroll: 0, scrollTop: 0 };
        }
        const maxScroll = owner.scrollHeight - owner.clientHeight;
        owner.scrollTop = Math.min(73, maxScroll);
        return { maxScroll, scrollTop: owner.scrollTop };
      });
    expect(pageScroll.maxScroll).toBeGreaterThan(0);
    expect(pageScroll.scrollTop).toBeGreaterThan(0);
  }

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}

test("snapshot-backed history stays read-only and inspectable without inventing a task", async ({
  page,
}, testInfo) => {
  await page.route(
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\//,
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: historicalResponseFor(path),
      });
    },
  );

  await page.goto("/workspaces/stuffing");
  await page.getByRole("button", { name: /查看历史装箱事实/ }).click();
  await expect(page.getByText("历史事实只读", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/来源：full-chain-sample · file_import/),
  ).toBeVisible();
  await expect(page.getByText("未创建装箱工单", { exact: true })).toBeVisible();
  const snapshotFacts = page.getByRole("region", { name: "当前装箱记录" });
  await expect(
    snapshotFacts.getByText("HMMU4956442", { exact: true }),
  ).toBeVisible();
  await expect(
    snapshotFacts.getByText("26H0407525", { exact: true }),
  ).toBeVisible();
  await expect(
    snapshotFacts.getByText("7723 kg", { exact: true }),
  ).toBeVisible();
  await expect(
    snapshotFacts.getByText("67.25 m³", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("未建立 stuffed 结论", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("未记录、未接受", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /15 个 SKU 明细/ }),
  ).toBeVisible();
  await expect(page.getByText("311-013GY", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath(`historical-${testInfo.project.name}.png`),
    fullPage: false,
  });
  await page.getByRole("button", { name: /15 个 SKU 明细/ }).click();
  await expect(page.getByText("311-013GY", { exact: true })).toBeVisible();
  await expect(page.getByText("350-172V80PK", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存装箱记录" })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("实际装箱时间表单")).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

function historicalResponseFor(path: string): unknown {
  if (path === "/api/containers") return historicalContainerPage;
  if (path === "/api/node-tasks") return historicalTaskPage;
  if (path === "/api/containers/historical-container/cargo")
    return historicalCargo;
  if (path === "/api/containers/historical-container/lifecycle-nodes")
    return {
      flow: null,
      nodes: [],
      asOf: "2026-10-15T08:00:00.000Z",
      projectionVersion: 0,
    };
  if (path === "/api/containers/historical-container/stuffing-snapshot")
    return historicalSnapshot;
  if (path === "/api/containers/historical-container/date-facts")
    return {
      items: [],
      projectionVersion: 0,
      asOf: "2026-10-15T08:00:00.000Z",
    };
  if (path === "/api/containers/historical-container")
    return historicalContainer;
  if (path === "/api/work-sessions")
    return {
      contractVersion: "work-session-page.v1",
      items: [],
      pageSize: 50,
      nextCursor: null,
    };
  throw new Error(`Unhandled historical stuffing API path: ${path}`);
}

const historicalContainer = {
  id: "historical-container",
  orderNumber: "26DSC01812",
  containerNumber: "HMMU4956442",
  currentStatus: "shipped",
  updatedAt: "2026-10-15T08:00:00.000Z",
};
const historicalContainerPage = {
  items: [historicalContainer],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-10-15T08:00:00.000Z",
  projectionVersion: 1,
};
const historicalTaskPage = {
  items: [],
  pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
  asOf: "2026-10-15T08:00:00.000Z",
  projectionVersion: 1,
};
const historicalCargo = {
  containerRecordId: historicalContainer.id,
  allocationSetId: "allocation-history-1",
  allocationSetVersion: 1,
  items: [
    "311-013GY",
    "311-023V01CW",
    "311-053V00PK",
    "311-094V80WT",
    "312-103V80WT",
    "316-031V80PK",
    "316-031V80WT",
    "331-011",
    "331-015",
    "331-054V00OG",
    "331-054V00YL",
    "331-085V00PK",
    "331-088V00YL",
    "331-113V00YL",
    "350-172V80PK",
  ].map((productNumber, index) => ({
    replenishmentOrderLineId: `line-${index}`,
    productSkuId: `sku-${index}`,
    productNumber,
    allocatedQuantity: index === 14 ? "490" : "1",
    quantityUnit: index >= 4 && index <= 6 ? "set" : "piece",
  })),
};
const historicalSnapshot = {
  snapshotId: "snapshot-history-1",
  containerRecordId: historicalContainer.id,
  version: 1,
  allocationSetId: "allocation-history-1",
  allocationSetVersion: 1,
  containerNumber: "HMMU4956442",
  sealNumber: "26H0407525",
  packageCount: 504,
  grossWeight: "7723",
  grossWeightUnit: "KGM",
  netWeight: null,
  volume: "67.25",
  volumeUnit: "MTQ",
  vgm: null,
  ingestionChannel: "file_import",
  sourceSystem: "full-chain-sample",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  actorId: "source-import-service",
  reasonCode: "historical_stuffing_imported",
  createdAt: "2026-10-15T08:00:00.000Z",
  duplicate: false,
};

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
      blockedReasonRefs: [],
      isCurrent: true,
      times: { plannedAt: null, estimatedAt: null, actualAt: null },
    },
  ],
  asOf: "2026-09-21T00:00:00.000Z",
  projectionVersion: 2,
};
