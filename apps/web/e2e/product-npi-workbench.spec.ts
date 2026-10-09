import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const E1_VIEWPORT_EVIDENCE = resolve(
  process.cwd(),
  "../../.tmp/e1-three-viewport-evidence-20261009",
);

/**
 * 3 号节点「产品开发与 NPI 工作台」的岗位动线：
 * 看见选品交过来的立项 → 看懂它为什么值得做 → 接到自己名下。
 *
 * 断言的是**业务结果**（这一票有没有人负责），不是接口被调过没有。
 */
test("NPI owner sees the handed-off initiative and takes it", async ({
  page,
}) => {
  let claimed = false;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/product-initiative-npi/queue") {
      await route.fulfill({ json: queue(claimed) });
      return;
    }
    if (
      path === "/api/product-initiative-npi/handoff-1/claim" &&
      request.method() === "POST"
    ) {
      claimed = true;
      await route.fulfill({ json: queue(true).items[0] });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  await page.goto("/workspaces/product-npi");

  // 首屏先回答"为什么现在处理"：这一票还没有人接。
  await expect(page.getByText("等我接手")).toBeVisible();
  await expect(page.getByText("还没有人接 —— 接了就是你")).toBeVisible();

  await page.getByRole("button", { name: /宠物出行品类/ }).click();

  // 看懂它为什么值得做：立项快照只读带出，含四项结论。
  await expect(page.getByText("目标用户与市场")).toBeVisible();
  await expect(page.getByText("本岗位只读")).toBeVisible();
  await expect(page.getByText("五类适用风险（冻结，只读）")).toBeVisible();
  await expect(page.getByText("合规").last()).toBeVisible();
  await expect(page.getByText("支持投入 · 合规支持投入").last()).toBeVisible();
  await expect(
    page.getByText("不适用：本机会采用本地自提，不涉及退货"),
  ).toBeVisible();
  await expect(page.locator(".npi-detail")).not.toContainText(
    /risk\.|supports_investment|not_applicable/,
  );

  await page.getByRole("button", { name: "领取此立项" }).click();

  // 接到自己名下：回执 + 分组跟着变，并且右栏**从"领取"换成"推进"** ——
  // 接住了就该看见下一步做什么，而不是停在一条"已由某人负责"的回执上。
  await expect(page.getByText(/已接到你名下/)).toBeVisible();
  await expect(page.getByText("我负责的")).toBeVisible();
  await expect(page.getByText("推进产品定义")).toBeVisible();
  await expect(page.getByRole("button", { name: "领取此立项" })).toHaveCount(0);
});

/**
 * 领取之后把这一票推进到发布：登记规格与阶段结论 → 前进 → 发布。
 * 断言的是**业务结果**（产品设计有没有交出去），不是接口被调过没有。
 */
test("NPI owner advances a claimed initiative and releases the product design", async ({
  page,
}) => {
  let definition: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/product-initiative-npi/queue") {
      await route.fulfill({ json: queue(true) });
      return;
    }
    if (path === "/api/product-definitions/handoff-1") {
      await route.fulfill({ json: definition });
      return;
    }
    if (
      path === "/api/product-definitions/handoff-1/writes" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      definition = productDefinition({
        version: Number(definition?.version ?? 0) + 1,
        specification: String(body.specification),
        complianceAssumptions: body.complianceAssumptions as string[],
        npiStage: body.advanceStage ? "dvt" : "evt",
        stageOutcomes: body.conclusion
          ? [
              {
                stage: "evt",
                conclusion: (body.conclusion as { text: string }).text,
                evidenceRefs: [],
                recordedBy: "dev-operator",
                recordedAt: "2026-09-27T11:30:00.000Z",
              },
            ]
          : [],
        pendingFieldCodes: [],
      });
      await route.fulfill({ json: definition });
      return;
    }
    if (
      path === "/api/product-definitions/handoff-1/releases" &&
      request.method() === "POST"
    ) {
      definition = productDefinition({
        ...(definition as Record<string, unknown>),
        releaseState: "released",
        npiStage: "mp",
      });
      await route.fulfill({ json: definition });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  await page.goto("/workspaces/product-npi");

  // 领取之后才轮到推进。
  await page.getByRole("button", { name: /宠物出行品类/ }).click();
  await expect(page.getByText("推进产品定义")).toBeVisible();
  await expect(
    page.getByText("工程验证（EVT）", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("产品规格").fill("40HC 折叠宠物推车，承重 25kg");
  await page.getByLabel("本阶段结论").fill("功能样机通过，关键料有替代来源");
  await page.getByRole("button", { name: /保存并前进到/ }).click();

  // 前进到 DVT，并且这一段的结论进了记录。
  await expect(
    page.getByText("设计验证（DVT）", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("功能样机通过，关键料有替代来源")).toBeVisible();

  await page.getByRole("button", { name: "发布", exact: true }).click();

  await expect(page.getByText("已发布，交给主数据侧建档")).toBeVisible();
});

test("NPI return hands the current queue item back as a new handoff", async ({
  page,
}, testInfo) => {
  let phase: "old" | "returned" | "new" = "old";
  let selectionDecisionRequested = false;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/product-initiative-npi/queue") {
      await route.fulfill({ json: npiQueueFor(phase) });
      return;
    }
    if (path === "/api/product-definitions/handoff-1") {
      await route.fulfill({ status: 200, json: null });
      return;
    }
    if (path === "/api/product-definitions/handoff-2") {
      await route.fulfill({ status: 200, json: null });
      return;
    }
    if (
      path === "/api/product-initiative-npi/handoff-1/return-to-selection" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        contractVersion: "product-initiative-npi-return.v1",
        expectedInitiativeVersion: 1,
        returnReason: "工程验证发现结构方案需要重判",
      });
      phase = "returned";
      await route.fulfill({
        json: returnedInitiative(),
      });
      return;
    }
    if (path === "/api/product-opportunities") {
      await route.fulfill({ json: productOpportunityPage() });
      return;
    }
    if (path === "/api/product-initiatives") {
      await route.fulfill({ json: productInitiativeQueueFor(phase) });
      return;
    }
    if (path === "/api/product-initiatives/handoff-1") {
      await route.fulfill({
        json: productInitiativeDetail(
          phase === "new" ? approvedInitiative() : returnedInitiative(),
        ),
      });
      return;
    }
    if (
      path === "/api/product-initiatives/handoff-1/decisions" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        contractVersion: "product-initiative-decision.v1",
        outcome: "approve",
        expectedInitiativeVersion: 2,
        objective: "重判结构方案后继续交给 NPI",
        acceptResponsibility: true,
        receivingTeamOrRole: "产品开发 / NPI",
        resourceDescription: "结构工程重新评估，采购同步验证替代结构件",
        targetDate: "2026-11-15",
        nextDecisionDate: "2026-10-20",
        nextDecisionQuestion: "结构方案是否可以进入 EVT",
      });
      expect(body.businessCaseDraft).toEqual(
        expect.arrayContaining(
          BUSINESS_CASE_CODES.map((dimensionCode) =>
            expect.objectContaining({
              dimensionCode,
              decision: "supports_investment",
              evidenceRefs: [SELECTION_EVIDENCE_ID],
            }),
          ),
        ),
      );
      expect(body.riskAssessmentDraft).toEqual(
        expect.arrayContaining(
          RISK_CODES.map((riskCode) =>
            expect.objectContaining({
              riskCode,
              applicability: "applicable",
              investmentDecision: "supports_investment",
              evidenceRefs: [SELECTION_EVIDENCE_ID],
            }),
          ),
        ),
      );
      expect(body.unitEconomicsDraft).toMatchObject({
        currencyCode: "CAD",
        channelCode: "Amazon CA",
      });
      phase = "new";
      selectionDecisionRequested = true;
      await route.fulfill({ json: approvedInitiative() });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  await page.goto("/workspaces/product-npi");
  await page.getByRole("button", { name: /宠物出行品类/ }).click();
  await page.getByRole("button", { name: "退回选品" }).click();
  await page.getByLabel("退回选品理由").fill("工程验证发现结构方案需要重判");
  await page.getByRole("button", { name: "确认退回选品" }).click();

  await expect(page.getByRole("status")).toContainText("已退回选品");
  await expect(page.getByRole("status")).toContainText(
    "工程验证发现结构方案需要重判",
  );
  await expect(
    page.getByRole("button", { name: /宠物出行品类（新版交接）/ }),
  ).toHaveCount(0);
  await mkdir(E1_VIEWPORT_EVIDENCE, { recursive: true });
  await page.screenshot({
    path: resolve(
      E1_VIEWPORT_EVIDENCE,
      `${testInfo.project.name}-return-receipt.png`,
    ),
    fullPage: true,
  });

  await page.goto("/workspaces/product-selection");
  await expect(page.getByText("NPI 退回，需再判断")).toBeVisible();
  await expect(page.getByText("NPI 退回原因：")).toBeVisible();
  await expect(page.getByText("工程验证发现结构方案需要重判")).toBeVisible();
  await page.getByRole("button", { name: "立项并交给产品开发" }).click();
  await expect(page.getByText("已立项 · 已交 NPI")).toBeVisible();
  expect(selectionDecisionRequested).toBe(true);

  await page.goto("/workspaces/product-npi");
  await expect(
    page.getByRole("button", { name: /宠物出行品类（新版交接）/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "宠物出行品类", exact: true }),
  ).toHaveCount(0);

  const widths = await page.evaluate(() => ({
    pageClient: document.documentElement.clientWidth,
    pageScroll: document.documentElement.scrollWidth,
    contentClient:
      document.querySelector<HTMLElement>(".app-content")?.clientWidth ?? 0,
    contentScroll:
      document.querySelector<HTMLElement>(".app-content")?.scrollWidth ?? 0,
  }));
  expect(widths.pageScroll).toBeLessThanOrEqual(widths.pageClient + 1);
  expect(widths.contentScroll).toBeLessThanOrEqual(widths.contentClient + 1);

  await page.screenshot({
    path: resolve(
      E1_VIEWPORT_EVIDENCE,
      `${testInfo.project.name}-return-to-new-handoff.png`,
    ),
    fullPage: true,
  });
});

function productDefinition(overrides: Record<string, unknown>) {
  return {
    contractVersion: "product-definition.v1",
    definitionId: "dddddddd-0000-4000-8000-000000000001",
    initiativeHandoffId: "handoff-1",
    productOwnerActorId: "dev-operator",
    npiStage: "evt",
    version: 1,
    releaseState: "in_progress",
    specification: "",
    complianceAssumptions: ["CE"],
    stageOutcomes: [],
    pendingFieldCodes: ["evt_conclusion"],
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:00:00.000Z",
    ...overrides,
  };
}

function queue(claimed: boolean, phase: "old" | "new" = "old") {
  const handoffId = phase === "old" ? "handoff-1" : "handoff-2";
  const objective =
    phase === "old" ? "宠物出行品类" : "宠物出行品类（新版交接）";
  return {
    contractVersion: "product-initiative-npi-queue.v1",
    items: [
      {
        handoff: {
          contractVersion: "product_initiative_handoff.v1",
          handoffId,
          version: phase === "old" ? 1 : 2,
          initiativeId: "11111111-1111-4111-8111-111111111111",
          signalId: "22222222-2222-4222-8222-222222222222",
          marketCode: "CA",
          userProblem: "宠物出行用品在加拿大复购低",
          objective,
          responsibleActorId: "selector-1",
          reviewPoints: [
            {
              code: "target_user_and_market",
              evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
              conclusion: "加拿大养宠家庭",
            },
          ],
          riskAssessmentSnapshot: riskSnapshot(),
          evidenceRefs: [],
          createdAt: "2026-09-27T10:00:00.000Z",
          idempotencyKey: handoffId,
        },
        initiativeVersion: phase === "old" ? 1 : 3,
        claim: claimed
          ? {
              claimId: "44444444-4444-4444-8444-444444444444",
              handoffId,
              claimVersion: 1,
              productOwnerActorId: "dev-operator",
              claimedAt: "2026-09-27T11:00:00.000Z",
            }
          : null,
      },
    ],
    pageSize: 200,
    nextCursor: null,
  };
}

const INITIATIVE_ID = "11111111-1111-4111-8111-111111111111";
const SIGNAL_ID = "22222222-2222-4222-8222-222222222222";
const SELECTION_EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";
const BUSINESS_CASE_CODES = [
  "customer_need",
  "value_differentiation",
  "commercial_viability",
  "supply_technical_feasibility",
  "strategy_portfolio",
] as const;
const RISK_CODES = [
  "compliance",
  "intellectual_property",
  "packaging_logistics",
  "returns",
  "platform_restrictions",
] as const;

function npiQueueFor(phase: "old" | "returned" | "new") {
  if (phase === "returned") {
    return {
      contractVersion: "product-initiative-npi-queue.v1",
      items: [],
      pageSize: 200,
      nextCursor: null,
    };
  }
  return queue(phase === "old", phase);
}

function productOpportunityPage() {
  return {
    contractVersion: "product-opportunity-page.v1",
    items: [
      {
        handoff: {
          contractVersion: "market_opportunity_handoff.v1",
          handoffId: "handoff-1",
          version: 1,
          signalId: SIGNAL_ID,
          signalVersion: 2,
          title: "宠物出行品类",
          recipientQueueCode: "product_selection",
          marketCode: "CA",
          channelCode: "Amazon CA",
          categoryRef: "pet-travel",
          observedFactSummary: "加拿大养宠家庭出行用品搜索增长。",
          evidenceRefs: [SELECTION_EVIDENCE_ID],
          hypothesis: "结构方案调整后仍可能形成折叠宠物推车机会。",
          opportunityStatement: "重判结构方案是否值得继续交给 NPI。",
          judgmentNote: null,
          pendingFieldCodes: [],
          createdBy: "market-owner",
          createdAt: "2026-09-25T02:00:00.000Z",
          idempotencyKey: "handoff-1",
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

function productInitiativeQueueFor(phase: "old" | "returned" | "new") {
  const initiative =
    phase === "new" ? approvedInitiative() : returnedInitiative();
  return {
    contractVersion: "product-initiative-queue.v1",
    items: [
      {
        handoffId: "handoff-1",
        outcome: initiative.outcome,
        currentDestination: initiative.currentDestination,
        pendingFieldCodes: initiative.pendingFieldCodes,
        queueGroup: "standard",
        updatedAt: initiative.updatedAt,
      },
    ],
    pageSize: 200,
    nextCursor: null,
  };
}

function productInitiativeDetail(initiative: Record<string, unknown>) {
  return {
    handoffId: "handoff-1",
    initiative,
    evidenceCandidates: [
      {
        evidenceId: SELECTION_EVIDENCE_ID,
        sourceName: "NPI 退回补充记录",
        summary: "结构方案需要重判。",
        contentRef: "market-signal/structure-redesign",
        recordedAt: "2026-10-09T09:10:00.000Z",
      },
    ],
    currencyOptions: [{ code: "CAD", name: "Canadian Dollar", minorUnit: 2 }],
  };
}

function returnedInitiative() {
  return {
    contractVersion: "product-initiative.v1",
    initiativeId: INITIATIVE_ID,
    outcome: "returned_from_npi",
    completion: "completed",
    currentDestination: "returned_from_npi",
    responsibleActorId: "dev-operator",
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程重新评估，采购同步验证替代结构件",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "结构方案是否可以进入 EVT",
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: completeUnitEconomicsDraft(),
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
    objective: "重判结构方案后继续交给 NPI",
    reviewPoints: [],
    businessCaseDraft: completeBusinessCase(),
    riskAssessmentDraft: completeRiskAssessment(),
    riskAssessmentSnapshot: null,
    reason: "工程验证发现结构方案需要重判",
    returnBasis: null,
    pendingFieldCodes: [],
    version: 2,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-10-09T09:10:00.000Z",
  };
}

function approvedInitiative() {
  return {
    ...returnedInitiative(),
    outcome: "approve",
    completion: "completed",
    currentDestination: "handed_off",
    version: 3,
    reason: null,
    updatedAt: "2026-10-09T09:30:00.000Z",
  };
}

function completeBusinessCase() {
  return BUSINESS_CASE_CODES.map((dimensionCode) => ({
    dimensionCode,
    decision: "supports_investment",
    conclusion: `${dimensionCode} 支持继续投入`,
    evidenceRefs: [SELECTION_EVIDENCE_ID],
    criticalUnknown: null,
  }));
}

function completeRiskAssessment() {
  return RISK_CODES.map((riskCode) => ({
    riskCode,
    applicability: "applicable",
    applicabilityReason: null,
    investmentDecision: "supports_investment",
    conclusion: `${riskCode} 支持继续投入`,
    evidenceRefs: [SELECTION_EVIDENCE_ID],
    criticalUnknown: null,
  }));
}

function completeUnitEconomicsDraft() {
  const amount = () => ({
    min: "10.00",
    max: "20.00",
    basis: "assumption",
    evidenceRefs: [],
  });
  return {
    currencyCode: "CAD",
    channelCode: "Amazon CA",
    scenarios: {
      baseline: {
        salePrice: amount(),
        landedCost: amount(),
        platformFee: amount(),
        fulfillmentFee: amount(),
        advertisingCost: amount(),
        returnCost: amount(),
      },
      conservative: {
        salePrice: amount(),
        landedCost: amount(),
        platformFee: amount(),
        fulfillmentFee: amount(),
        advertisingCost: amount(),
        returnCost: amount(),
      },
    },
  };
}

function riskSnapshot() {
  return [
    {
      riskCode: "compliance",
      applicability: "applicable",
      applicabilityReason: null,
      investmentDecision: "supports_investment",
      conclusion: "合规支持投入",
      evidenceRefs: [],
      criticalUnknown: null,
    },
    {
      riskCode: "intellectual_property",
      applicability: "applicable",
      applicabilityReason: null,
      investmentDecision: "supports_investment",
      conclusion: "知识产权支持投入",
      evidenceRefs: [],
      criticalUnknown: null,
    },
    {
      riskCode: "packaging_logistics",
      applicability: "applicable",
      applicabilityReason: null,
      investmentDecision: "supports_investment",
      conclusion: "包装物流支持投入",
      evidenceRefs: [],
      criticalUnknown: null,
    },
    {
      riskCode: "returns",
      applicability: "not_applicable",
      applicabilityReason: "本机会采用本地自提，不涉及退货",
      investmentDecision: null,
      conclusion: null,
      evidenceRefs: [],
      criticalUnknown: null,
    },
    {
      riskCode: "platform_restrictions",
      applicability: "applicable",
      applicabilityReason: null,
      investmentDecision: "supports_investment",
      conclusion: "平台限制支持投入",
      evidenceRefs: [],
      criticalUnknown: null,
    },
  ];
}
