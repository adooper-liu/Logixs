import { expect, test, type Page, type Route } from "@playwright/test";

const HANDOFF = "44444444-4444-4444-8444-444444444444";
const OTHER_HANDOFF = "55555555-5555-4555-8555-555555555555";
const CONTAINER = "66666666-6666-4666-8666-666666666666";
const TASK = "77777777-7777-4777-8777-777777777777";
const SELECTION_SESSION = "88888888-8888-4888-8888-888888888888";
const STUFFING_SESSION = "99999999-9999-4999-8999-999999999999";

for (const target of ["product-selection", "stuffing"] as const) {
  test(`${target} renders truthful recoverable-session UI without overflow`, async ({
    page,
  }, testInfo) => {
    await mockRecoverableSessions(page);
    await page.goto(
      target === "product-selection"
        ? `/workspaces/product-selection?handoffId=${HANDOFF}`
        : `/workspaces/stuffing?containerId=${CONTAINER}&taskId=${TASK}`,
    );
    await expect(
      page.getByRole("button", { name: "切换工作现场" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "切换工作现场" }).click();
    await expect(
      page.getByRole("dialog", { name: "工作现场切换" }),
    ).toBeVisible();
    await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByText("当前", { exact: true })).toBeVisible();
    await expect(page.getByText("待续办", { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await expect(page).toHaveScreenshot(
      `${target}-${testInfo.project.name}-session-menu.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.03, threshold: 0.3 },
    );
  });
}

test("product selection dirty input offers typed draft choices", async ({
  page,
}) => {
  await mockRecoverableSessions(page);
  await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);
  if ((page.viewportSize()?.width ?? 0) < 681) {
    await page.getByRole("button", { name: "编辑", exact: true }).click();
  }
  const objective = page.getByLabel("目标结果");
  await objective.fill("尚未保存的目标结果");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.getByRole("button", { name: /装箱 · KOCU4960726/ }).click();
  await expect(page.getByText("保存领域草稿并切换")).toBeVisible();
  await expect(page.getByText("放弃本地改动并切换")).toBeVisible();
  await expect(page.getByText("留在当前页")).toBeVisible();
  await expect(page.getByText("在新标签页打开目标")).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "工作现场切换" })
      .locator('[aria-current="true"]'),
  ).toContainText("选品");
});

test("stuffing dirty input never claims a server draft", async ({ page }) => {
  await mockRecoverableSessions(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${CONTAINER}&taskId=${TASK}`,
  );
  const seal = page.getByLabel("封号");
  await seal.fill("NEW-SEAL");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.getByRole("button", { name: /选品 · 宠物出行品类/ }).click();
  await expect(page.getByText("放弃本地改动并切换")).toBeVisible();
  await expect(page.getByText("在新标签页打开目标")).toBeVisible();
  await expect(page.getByText("留在当前页")).toBeVisible();
  await expect(page.getByText("保存领域草稿并切换")).toHaveCount(0);

  const popupPromise = page.waitForEvent("popup");
  await page.getByText("在新标签页打开目标", { exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(
    new RegExp(`/workspaces/product-selection\\?handoffId=${HANDOFF}$`),
  );
  expect(page.url()).toContain("/workspaces/stuffing");
  await expect(seal).toHaveValue("NEW-SEAL");
  expect(popup.url()).toContain(
    `/workspaces/product-selection?handoffId=${HANDOFF}`,
  );
  await popup.close();
});

async function mockRecoverableSessions(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/work-sessions") {
      await route.fulfill({
        json: sessionPage(page.url().includes("stuffing")),
      });
      return;
    }
    if (path === "/api/work-sessions/open") {
      const body = request.postDataJSON();
      await route.fulfill({ json: sessionFor(body.workbenchCode) });
      return;
    }
    if (/^\/api\/work-sessions\/[^/]+\/activate$/.test(path)) {
      const target = path.includes(STUFFING_SESSION)
        ? "stuffing"
        : "product_selection";
      await route.fulfill({ json: sessionFor(target) });
      return;
    }
    if (/^\/api\/work-sessions\/[^/]+\/pointer$/.test(path)) {
      await route.fulfill({
        json: sessionFor(
          page.url().includes("stuffing") ? "stuffing" : "product_selection",
        ),
      });
      return;
    }
    if (path === "/api/product-opportunities") {
      await route.fulfill({ json: opportunityPage() });
      return;
    }
    if (path === "/api/product-initiatives") {
      await route.fulfill({ json: initiativeQueue() });
      return;
    }
    if (
      path === `/api/product-initiatives/${HANDOFF}` ||
      path === `/api/product-initiatives/${OTHER_HANDOFF}`
    ) {
      await route.fulfill({ json: initiativeDetail() });
      return;
    }
    if (path === "/api/containers") {
      await route.fulfill({ json: containerPage() });
      return;
    }
    if (path === "/api/node-tasks") {
      await route.fulfill({ json: taskPage() });
      return;
    }
    if (path === `/api/containers/${CONTAINER}`) {
      await route.fulfill({ json: container() });
      return;
    }
    if (path === `/api/containers/${CONTAINER}/cargo`) {
      await route.fulfill({ json: cargo() });
      return;
    }
    if (path === `/api/containers/${CONTAINER}/lifecycle-nodes`) {
      await route.fulfill({ json: lifecycleNodes() });
      return;
    }
    if (path === `/api/containers/${CONTAINER}/stuffing-snapshot`) {
      await route.fulfill({ json: null });
      return;
    }
    if (path === `/api/containers/${CONTAINER}/date-facts`) {
      await route.fulfill({
        json: {
          items: [],
          projectionVersion: 0,
          asOf: "2026-10-14T08:00:00.000Z",
        },
      });
      return;
    }
    await continueStatic(route);
  });
}

async function continueStatic(route: Route): Promise<void> {
  if (new URL(route.request().url()).pathname.startsWith("/api/")) {
    await route.fulfill({
      status: 404,
      json: { message: "UNHANDLED_TEST_API" },
    });
  } else await route.continue();
}

function sessionPage(stuffingCurrent: boolean) {
  return {
    contractVersion: "work-session-page.v1",
    items: [
      session(
        SELECTION_SESSION,
        stuffingCurrent ? "resumable" : "current",
        "product_selection",
      ),
      session(
        STUFFING_SESSION,
        stuffingCurrent ? "current" : "resumable",
        "stuffing",
      ),
    ],
    pageSize: 50,
    nextCursor: null,
  };
}

function session(
  id: string,
  status: string,
  kind: "product_selection" | "stuffing",
) {
  const product = kind === "product_selection";
  return {
    contractVersion: "work-session.v1",
    sessionId: id,
    version: 1,
    status,
    workbenchCode: kind,
    contextKey: product
      ? `product_selection|product_initiative_handoff:${HANDOFF}`
      : `stuffing|container:${CONTAINER}|task:${TASK}`,
    routeContext: product
      ? { kind: "product_selection.v1", handoffId: HANDOFF }
      : { kind: "stuffing.v1", containerId: CONTAINER, taskId: TASK },
    subjectRef: product
      ? { kind: "product_initiative_handoff", id: HANDOFF }
      : { kind: "container", id: CONTAINER },
    taskRef: product ? null : { kind: "node_task", id: TASK },
    domainVersionSeen: 0,
    activeItemKey: product ? "objective" : "stuffing-snapshot",
    contextMode: product ? "context" : "edit_snapshot",
    displaySummary: product ? "选品 · 宠物出行品类" : "装箱 · KOCU4960726",
    lastOpenedAt: "2026-10-14T08:00:00.000Z",
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}

function sessionFor(kind: string) {
  return kind === "stuffing"
    ? session(STUFFING_SESSION, "current", "stuffing")
    : session(SELECTION_SESSION, "current", "product_selection");
}

function opportunityPage() {
  return {
    contractVersion: "product-opportunity-page.v1",
    items: [
      {
        handoff: {
          contractVersion: "market_opportunity_handoff.v1",
          handoffId: HANDOFF,
          version: 1,
          signalId: OTHER_HANDOFF,
          signalVersion: 1,
          title: "宠物出行品类",
          recipientQueueCode: "product_selection",
          marketCode: "CA",
          channelCode: "Amazon CA",
          categoryRef: "pet-travel",
          observedFactSummary: "需求增长",
          evidenceRefs: [],
          hypothesis: "可形成机会",
          opportunityStatement: "评估是否立项",
          judgmentNote: null,
          pendingFieldCodes: [],
          createdBy: "market-owner",
          createdAt: "2026-10-14T08:00:00.000Z",
          idempotencyKey: "handoff-1",
        },
        intakeState: "accepted",
        intakeVersion: 1,
        assignedActorId: "dev-operator",
        supplementedFieldCodes: [],
        responsibility: {
          status: "transferred_to_selection",
          responsibleTeamCode: "product_selection",
        },
        latestSelectionDecision: null,
      },
    ],
    pageSize: 100,
    nextCursor: null,
  };
}
function initiativeQueue() {
  return {
    contractVersion: "product-initiative-queue.v1",
    items: [],
    pageSize: 200,
    nextCursor: null,
  };
}
function initiativeDetail() {
  return {
    handoffId: HANDOFF,
    initiative: null,
    decisionDraft: null,
    evidenceCandidates: [],
    currencyOptions: [],
  };
}
function container() {
  return {
    id: CONTAINER,
    orderNumber: "26DSS00033",
    containerNumber: "KOCU4960726",
    currentStatus: "not_shipped",
    updatedAt: "2026-10-14T08:00:00.000Z",
  };
}
function containerPage() {
  return {
    items: [container()],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-14T08:00:00.000Z",
    projectionVersion: 1,
  };
}
function taskPage() {
  return {
    items: [
      {
        id: TASK,
        flowInstanceId: OTHER_HANDOFF,
        nodeInstanceId: HANDOFF,
        nodeCode: "container_stuffing",
        containerId: CONTAINER,
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
          workOrderId: OTHER_HANDOFF,
          workOrderDefinitionKey: "stuffing",
          assignmentState: "pool",
          assigneeId: null,
          dueAt: null,
        },
      },
    ],
  };
}
function cargo() {
  return {
    containerRecordId: CONTAINER,
    allocationSetId: HANDOFF,
    allocationSetVersion: 1,
    items: [
      {
        replenishmentOrderLineId: OTHER_HANDOFF,
        productSkuId: null,
        productNumber: "833-066V00BK",
        allocatedQuantity: "50",
        quantityUnit: "carton",
      },
    ],
  };
}
function lifecycleNodes() {
  return {
    flow: { id: OTHER_HANDOFF },
    nodes: [
      {
        nodeInstanceId: HANDOFF,
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
  };
}

async function expectNoOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
}
