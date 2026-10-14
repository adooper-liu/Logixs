import { expect, test } from "@playwright/test";
import { workbenchPurposeByCode } from "../src/data/workbenchPurposes.generated";

const purpose = workbenchPurposeByCode.product_selection.businessPurpose;
const handoffId = "44444444-4444-4444-8444-444444444444";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    if (
      path !== "/api/product-opportunities" &&
      path !== "/api/product-initiatives" &&
      path !== `/api/product-initiatives/${handoffId}` &&
      path !== "/api/work-sessions" &&
      path !== "/api/work-sessions/open"
    ) {
      await route.continue();
      return;
    }
    const state =
      requestUrl.searchParams.get("state") ??
      new URL(page.url()).searchParams.get("state") ??
      "frozen";

    if (path === "/api/work-sessions") {
      await route.fulfill({
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
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          contractVersion: "work-session.v1",
          sessionId: "88888888-8888-4888-8888-888888888888",
          version: 1,
          status: "current",
          workbenchCode: body.workbenchCode,
          contextKey: `product_selection|product_initiative_handoff:${handoffId}`,
          routeContext: body.routeContext,
          subjectRef: body.subjectRef,
          domainVersionSeen: 0,
          activeItemKey: body.activeItemKey,
          contextMode: body.contextMode,
          displaySummary: body.displaySummary,
          lastOpenedAt: "2026-10-09T09:30:00.000Z",
          createdAt: "2026-10-09T09:30:00.000Z",
          updatedAt: "2026-10-09T09:30:00.000Z",
        },
      });
      return;
    }
    if (path === "/api/product-opportunities") {
      await route.fulfill({ json: opportunityPage() });
      return;
    }
    if (path === "/api/product-initiatives") {
      await route.fulfill({ json: initiativeQueue(state) });
      return;
    }
    if (path === `/api/product-initiatives/${handoffId}`) {
      await route.fulfill({ json: initiativeDetail(state) });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });
});

test("uses the shared shell with real N/5 progress and right-side review editing", async ({
  page,
}, testInfo) => {
  await page.goto(
    `/workspaces/product-selection?handoffId=${handoffId}&state=working`,
  );
  await expect(
    page.getByRole("region", { name: "岗位、对象与责任上下文" }),
  ).toBeVisible();
  const decision = page.getByRole("region", { name: "当前结论与办理缺口" });
  await expect(decision).toContainText("0/5");
  await expect(decision).not.toContainText("/8");
  await expect(page.locator("[data-workbench-pane]")).toHaveCount(3);
  await decision.getByRole("button", { name: /评审依据/ }).click();
  await expect(
    page
      .getByRole("region", { name: "当前事项操作上下文" })
      .getByRole("region", { name: "五面商业论证" }),
  ).toBeVisible();
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  const screenshotPath = testInfo.outputPath("product-selection-working.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("product-selection-working", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("keeps the generated purpose through historical, return-pending, and frozen states", async ({
  page,
}, testInfo) => {
  for (const [state, stateText] of [
    ["legacy", "历史记录只读"],
    ["return", "等待市场接回"],
    ["frozen", "结论已冻结"],
  ] as const) {
    await page.goto(
      `/workspaces/product-selection?handoffId=${handoffId}&state=${state}`,
    );
    await expect(page.getByText(purpose, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: stateText, exact: true }),
    ).toBeVisible();
    if (state === "frozen") {
      const screenshotPath = testInfo.outputPath(
        "product-selection-frozen.png",
      );
      await page.screenshot({ path: screenshotPath });
      await testInfo.attach("product-selection-frozen", {
        path: screenshotPath,
        contentType: "image/png",
      });
    }
  }
});

test("keeps the result purpose visible at 390px across result states", async ({
  page,
}, testInfo) => {
  test.skip(page.viewportSize()?.width !== 390, "390px evidence only");

  for (const state of ["legacy", "return", "frozen"] as const) {
    await page.goto(
      `/workspaces/product-selection?handoffId=${handoffId}&state=${state}`,
    );
    const purposeLocator = page.getByText(purpose, { exact: true });
    await expect(purposeLocator).toBeVisible();
    const bounds = await purposeLocator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(0);
    expect(bounds!.height).toBeGreaterThan(0);
    await testInfo.attach(`purpose-bounds-${state}`, {
      body: JSON.stringify(bounds),
      contentType: "application/json",
    });
  }
});

function opportunityPage() {
  return {
    contractVersion: "product-opportunity-page.v1",
    items: [
      {
        handoff: {
          contractVersion: "market_opportunity_handoff.v1",
          handoffId,
          version: 1,
          signalId: "22222222-2222-4222-8222-222222222222",
          signalVersion: 2,
          title: "宠物出行品类",
          recipientQueueCode: "product_selection",
          marketCode: "CA",
          channelCode: "Amazon CA",
          categoryRef: "pet-travel",
          observedFactSummary: "加拿大养宠家庭出行用品搜索增长。",
          evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
          hypothesis: "结构方案调整后仍可能形成折叠宠物推车机会。",
          opportunityStatement: "重判结构方案是否值得继续交给 NPI。",
          judgmentNote: null,
          pendingFieldCodes: [],
          createdBy: "market-owner",
          createdAt: "2026-09-25T02:00:00.000Z",
          idempotencyKey: handoffId,
        },
        intakeState: "accepted",
        intakeVersion: 3,
        assignedActorId: "dev-operator",
        supplementedFieldCodes: [],
        responsibility: {
          status: "transferred_to_selection",
          responsibleTeamCode: "product_selection",
          handedOffAt: "2026-09-25T02:00:00.000Z",
          assignedActorId: "dev-operator",
          claimedAt: "2026-09-25T02:10:00.000Z",
          acceptedAt: "2026-09-25T02:20:00.000Z",
        },
        latestSelectionDecision: null,
      },
    ],
    pageSize: 100,
    nextCursor: null,
  };
}

function initiativeQueue(state: string) {
  const currentDestination =
    state === "working"
      ? "needs_decision"
      : state === "legacy"
        ? "deferred"
        : state === "return"
          ? "return_requested"
          : "handed_off";
  return {
    contractVersion: "product-initiative-queue.v1",
    items: [
      {
        handoffId,
        outcome:
          state === "working" ? null : state === "legacy" ? "defer" : "approve",
        currentDestination,
        pendingFieldCodes: [],
        queueGroup: "standard",
        updatedAt: "2026-10-09T09:30:00.000Z",
      },
    ],
    pageSize: 200,
    nextCursor: null,
  };
}

function initiativeDetail(state: string) {
  const working = state === "working";
  const legacy = state === "legacy";
  const currentDestination = working
    ? "needs_decision"
    : legacy
      ? "deferred"
      : state === "return"
        ? "return_requested"
        : "handed_off";
  return {
    handoffId,
    initiative: working
      ? null
      : {
          contractVersion: "product-initiative.v1",
          initiativeId: "55555555-5555-4555-8555-555555555555",
          outcome: legacy ? "defer" : "approve",
          completion: "completed",
          currentDestination,
          responsibleActorId: "dev-operator",
          objective: "重判结构方案后继续交给 NPI",
          reviewPoints: [],
          businessCaseDraft: [],
          businessCaseSnapshot: null,
          riskAssessmentDraft: legacy ? [] : [{ riskCode: "compliance" }],
          riskAssessmentSnapshot: legacy ? null : {},
          responsibilityAccepted: true,
          receivingTeamOrRole: "产品开发 / NPI",
          resourceDescription: "结构工程重新评估",
          targetDate: "2026-11-15",
          nextDecisionDate: "2026-10-20",
          nextDecisionQuestion: "结构方案是否可以进入 EVT",
          validationFocus: null,
          reconsiderationDate: null,
          unitEconomicsDraft: null,
          unitEconomicsSnapshot: null,
          negativeConservativeReason: null,
          reason: legacy ? "等待后续重判" : null,
          pendingFieldCodes: [],
          version: 2,
          createdAt: "2026-09-27T00:00:00.000Z",
          updatedAt: "2026-10-09T09:30:00.000Z",
        },
    evidenceCandidates: [],
    currencyOptions: [{ code: "CAD", name: "Canadian Dollar", minorUnit: 2 }],
  };
}
