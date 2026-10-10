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
      path !== `/api/product-initiatives/${handoffId}`
    ) {
      await route.continue();
      return;
    }
    const state =
      requestUrl.searchParams.get("state") ??
      new URL(page.url()).searchParams.get("state") ??
      "frozen";

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

test("keeps the generated purpose through historical, return-pending, and frozen states", async ({
  page,
}) => {
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
    state === "legacy"
      ? "deferred"
      : state === "return"
        ? "return_requested"
        : "handed_off";
  return {
    contractVersion: "product-initiative-queue.v1",
    items: [
      {
        handoffId,
        outcome: state === "legacy" ? "defer" : "approve",
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
  const legacy = state === "legacy";
  const currentDestination = legacy
    ? "deferred"
    : state === "return"
      ? "return_requested"
      : "handed_off";
  return {
    handoffId,
    initiative: {
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
