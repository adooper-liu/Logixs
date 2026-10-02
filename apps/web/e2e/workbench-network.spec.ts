import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCommandV1,
  MarketSignalV1,
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

test("the business-workbench directory opens live and framework stages honestly", async ({
  page,
}) => {
  await page.goto("/workspaces");

  await expect(
    page.getByRole("heading", { name: "业务工作台", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("main-workbench-stage")).toHaveCount(18);
  await expect(page.locator('[data-implementation="live"]')).toHaveCount(12);
  await expect(page.locator('[data-implementation="prototype"]')).toHaveCount(
    0,
  );
  await expect(
    page
      .getByTestId("main-workbench-stage")
      .filter({ hasText: "出运工作台" })
      .getByRole("link"),
  ).toHaveAttribute("href", "/workspaces/dispatch");

  await page.getByRole("link", { name: /采购履约工作台/ }).click();
  await expect(
    page.getByRole("heading", { name: "采购履约工作台", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("框架已建立，业务能力待接通")).toBeVisible();
  await expect(page.locator(".planned-page button")).toHaveCount(0);
  const flowContext = page.getByRole("region", { name: "当前责任与交接" });
  await expect(flowContext.getByText("补货决策交接")).toBeVisible();
  await expect(flowContext.getByText("采购承诺交接")).toBeVisible();
});

test("a market owner can hand off a signal for a selector to claim, accept and take a decision", async ({
  page,
}) => {
  const { decisions } = await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");

  await expect(
    page.getByRole("heading", { name: "市场与经营信号", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }).click();
  await page.getByRole("radio", { name: /交给选品评估/ }).check();
  await page
    .getByLabel("机会说明")
    .fill("验证加拿大站宠物出行需求是否值得形成新品立项。");
  await page.getByRole("button", { name: "交给选品评估", exact: true }).click();

  await expect(page.getByRole("status")).toContainText("已交给选品团队队列");
  await expect(page.getByRole("status")).toContainText(
    "下一责任选品团队（待领取）",
  );
  await expect(
    page.getByRole("heading", {
      name: "美国站庭院收纳需求连续三周上升",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "查看选品队列" }).click();
  await expect(
    page.getByRole("heading", { name: "选品立项", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "合并信号后补后仍缺这些；不阻止领取和评估。已后补项不会出现在此。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "领取此机会" }).click();
  await expect(page.getByRole("status")).toContainText("已领取");
  await page.getByRole("button", { name: "接受并进入立项判断" }).click();
  await expect(page.getByRole("status")).toContainText("已接受经营机会");

  // 接受之后主动作换成立项结论：先被缺口挡住，并说清还差几项。
  const submit = page.locator(".outcome-submit");
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText("还差 5 项才能立项");

  await page.getByLabel("目标结果").fill("把折叠宠物出行包做成可发布版本");
  for (const label of [
    "目标用户与市场",
    "竞争供给",
    "价格带与利润",
    "合规风险",
  ]) {
    const point = page.locator(".review-point").filter({ hasText: label });
    await point.getByRole("button", { name: /从已登记证据中引用/ }).click();
    await point.getByRole("checkbox").check();
    await point.getByLabel(`${label}结论`).fill(`${label} 的判断`);
  }

  await expect(submit).toBeEnabled();
  await expect(submit).toContainText("立项并交给产品开发");
  await submit.click();

  await expect(page.locator(".feedback")).toContainText("已立项");
  // 成功后从服务端重读：终态由服务端返回的 currentDestination 决定，不是前端猜的。
  await expect(page.locator(".conclusion-strip")).toContainText("已立项");
  await expect(page.locator(".product-initiative-outcome")).toHaveCount(0);
  await expect(page.locator(".destination")).toHaveCount(0);
  // 评审要点只读：系统不会再接受改动，就不该继续摆出写入口。
  await expect(page.locator(".review-point textarea").first()).toHaveAttribute(
    "readonly",
    "",
  );
  // 桩不校验版本，所以只能在这里断言"发出去的版本正确"：首次立项必须是 0。
  expect(decisions).toHaveLength(1);
  expect(decisions[0]?.expectedInitiativeVersion).toBe(0);
  expect(decisions[0]?.contractVersion).toBe("product-initiative-decision.v1");
  expect(decisions[0]?.outcome).toBe("approve");
  // 队列上的立项标记来自服务端投影：立项后这一条不再看起来像没处理过。
  await expect(page.locator(".queue-item").first()).toContainText("已立项");

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
});

test("a market owner can register a title first and leave details for later", async ({
  page,
}) => {
  await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");

  await page.getByRole("button", { name: "登记信号" }).click();
  await expect(page.getByLabel("市场 可后补")).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByLabel("信号标题 用于识别").fill("法国站出现新的户外用餐场景");
  await page.getByRole("button", { name: "加入待判断" }).click();

  await expect(
    page.getByRole("heading", {
      name: "法国站出现新的户外用餐场景 · 依据与判断",
    }),
  ).toBeVisible();
  await expect(page.getByText("尚未登记观察事实。")).toBeVisible();
  await expect(page.getByText("尚无来源证据")).toBeVisible();
  await expect(page.getByLabel("依据完备度")).toBeVisible();
  await page.getByRole("button", { name: /尚无来源证据/ }).click();
  await expect(page.getByLabel("证据推荐")).toContainText("还没有来源证据");
});

test("a market owner can open a gap form and save the missing fact in place", async ({
  page,
}) => {
  await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");

  await page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }).click();
  await page.getByRole("button", { name: "选择渠道" }).click();
  await page.getByRole("textbox", { name: "渠道" }).fill("Aosom.ca");
  await page.getByRole("button", { name: "保存补充" }).click();

  await expect(page.getByText("Aosom.ca", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择渠道" })).toHaveCount(0);
});

test("market validation: a synthetic signal gets one resumable self-owned commitment", async ({
  page,
}) => {
  await mockMarketOpportunityApis(page);
  await page.setViewportSize({ width: 680, height: 900 });
  await page.goto("/workspaces/market-signals");

  await page
    .getByRole("button", { name: /美国站庭院收纳需求连续三周上升/ })
    .click();
  await page.getByRole("radio", { name: /安排下一项验证/ }).check();
  await page.getByLabel("这次要验证什么").fill("确认趋势是否持续两周");
  await page.getByLabel("当前在等什么").fill("等待第二客服队列");
  await page.locator('input[type="date"]').fill("2026-02-12");
  await page
    .getByRole("button", { name: "由我负责并安排验证", exact: true })
    .click();

  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("负责人：我");
  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("确认趋势是否持续两周");
  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("等待第二客服队列");
  await expect(page.getByRole("status")).toContainText("已安排下一项验证");
  await expect(page.locator(".market-workbench")).not.toContainText(
    "机会已证明",
  );

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
});

test("the workbench network stays within the viewport", async ({ page }) => {
  await page.goto("/workspaces");
  await expect(
    page.getByRole("heading", { name: "业务工作台", exact: true }),
  ).toBeVisible();

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
});

const firstSignalId = "11111111-1111-4111-8111-111111111111";
const secondSignalId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "33333333-3333-4333-8333-333333333333";
const handoffId = "44444444-4444-4444-8444-444444444444";

async function mockMarketOpportunityApis(page: Page): Promise<{
  decisions: ProductInitiativeDecisionCommandV1[];
}> {
  const signals = new Map<string, MarketSignalV1>([
    [
      firstSignalId,
      signal({
        signalId: firstSignalId,
        title: "美国站庭院收纳需求连续三周上升",
        marketCode: "US",
        channelCode: "Amazon US",
        categoryRef: "庭院收纳",
        observedFactSummary: "搜索量连续三周增长。",
        hypothesis: "紧凑型产品可能存在供给缺口。",
        evidenceRefs: [evidenceId],
        pendingFieldCodes: [],
      }),
    ],
    [
      secondSignalId,
      signal({
        signalId: secondSignalId,
        title: "加拿大站宠物出行需求上升",
        marketCode: "CA",
        pendingFieldCodes: [
          "channel_code",
          "category_ref",
          "observed_fact_summary",
          "hypothesis",
          "evidence_refs",
        ],
      }),
    ],
  ]);
  let opportunity: ProductOpportunityV1 | null = null;
  let initiative: ProductInitiativeV1 | null = null;
  /** 前端实际发出去的决策命令：版本这类字段桩不会校验，只能断言发出去的值。 */
  const decisions: ProductInitiativeDecisionCommandV1[] = [];

  await page.route("**/api/market-signals**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const segments = url.pathname.split("/").filter(Boolean);
    const signalId = segments[segments.indexOf("market-signals") + 1];

    if (!signalId && request.method() === "GET") {
      const destination = url.searchParams.get("destination");
      const items = [...signals.values()].filter(
        (item) => item.currentDestination === destination,
      );
      await json(route, {
        contractVersion: "market-signal-page.v1",
        items,
        pageSize: 50,
        totalCount: items.length,
        nextCursor: null,
      });
      return;
    }
    if (!signalId && request.method() === "POST") {
      const body = request.postDataJSON() as {
        requestId: string;
        title: string;
      };
      const created = signal({ signalId: body.requestId, title: body.title });
      signals.set(created.signalId, created);
      await json(route, created);
      return;
    }
    const current = signalId ? signals.get(signalId) : undefined;
    if (!current) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    if (segments.at(-1) === "decisions" && request.method() === "POST") {
      const body = request.postDataJSON() as MarketSignalDecisionCommandV1;
      if (body.decisionType === "watch") {
        const watched = {
          ...current,
          currentDestination: "watching" as const,
          activeValidation: {
            responsibleActorId: "dev-operator",
            nextReviewDate: body.nextReviewDate!,
            watchFocus: body.watchFocus!,
            waitingReason: body.waitingReason ?? null,
          },
          version: current.version + 1,
        };
        signals.set(current.signalId, watched);
        await json(route, {
          contractVersion: "market-signal-decision-result.v1",
          status: "saved",
          signal: watched,
          decisionId: "66666666-6666-4666-8666-666666666667",
          decisionVersion: 1,
          completion: "completed",
          handoff: null,
        });
        return;
      }
      const handedOff = {
        ...current,
        currentDestination: "handed_off" as const,
        version: current.version + 1,
      };
      signals.set(current.signalId, handedOff);
      const snapshot = handoff(handedOff, body.opportunityStatement ?? null);
      opportunity = {
        handoff: snapshot,
        intakeState: "queued",
        intakeVersion: 1,
        assignedActorId: null,
        supplementedFieldCodes: [],
      };
      await json(route, {
        contractVersion: "market-signal-decision-result.v1",
        status: "saved",
        signal: handedOff,
        decisionId: "66666666-6666-4666-8666-666666666666",
        decisionVersion: 1,
        completion: "completed",
        handoff: snapshot,
      });
      return;
    }
    if (request.method() === "PATCH") {
      const body = request.postDataJSON() as { channelCode?: string };
      const updated = {
        ...current,
        channelCode: body.channelCode ?? current.channelCode,
        version: current.version + 1,
        pendingFieldCodes: current.pendingFieldCodes.filter(
          (code) => code !== "channel_code",
        ),
      };
      signals.set(current.signalId, updated);
      await json(route, updated);
      return;
    }
    await json(route, {
      signal: current,
      evidence:
        current.signalId === firstSignalId
          ? [
              {
                evidenceId,
                sourceName: "美国站周度搜索报告",
                summary: "搜索量连续三周增长。",
                contentRef: "https://example.com/source-report",
                recordedAt: "2026-09-25T01:00:00.000Z",
                verificationState: "verified",
              },
            ]
          : [],
    });
  });

  await page.route("**/api/product-opportunities**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await json(route, {
        contractVersion: "product-opportunity-page.v1",
        items: opportunity ? [opportunity] : [],
        pageSize: 100,
        nextCursor: null,
      });
      return;
    }
    if (!opportunity) {
      await route.fulfill({ status: 404, body: "not found" });
      return;
    }
    const body = request.postDataJSON() as { action: "claim" | "accept" };
    opportunity = {
      ...opportunity,
      intakeState: body.action === "claim" ? "claimed" : "accepted",
      intakeVersion: opportunity.intakeVersion + 1,
      assignedActorId: "dev-operator",
    };
    await json(route, opportunity);
  });

  await page.route("**/api/product-initiatives**", async (route) => {
    const request = route.request();
    const segments = new URL(request.url()).pathname.split("/").filter(Boolean);
    const detailHandoffId =
      segments[segments.indexOf("product-initiatives") + 1];

    if (request.method() === "GET" && !detailHandoffId) {
      // 队列投影：没有条目的机会就是"还没看过"。
      await json(route, {
        contractVersion: "product-initiative-queue.v1",
        items: initiative
          ? [
              {
                handoffId,
                outcome: initiative.outcome,
                currentDestination: initiative.currentDestination,
                pendingFieldCodes: initiative.pendingFieldCodes,
                updatedAt: initiative.updatedAt,
              },
            ]
          : [],
        pageSize: 200,
        nextCursor: null,
      });
      return;
    }

    if (request.method() === "GET") {
      await json(route, {
        handoffId,
        initiative,
        // 证据挂在来源信号上，立项只引用，所以候选来自信号已登记的证据。
        evidenceCandidates: [
          {
            evidenceId,
            sourceName: "美国站周度搜索报告",
            summary: "搜索量连续三周增长。",
            contentRef: "https://example.com/source-report",
            recordedAt: "2026-09-25T01:00:00.000Z",
          },
        ],
      });
      return;
    }
    // 本用例只走"立项"这一条去向，所以只造这一种结果；其余三个去向的关闭规则
    // 由服务端集成测试覆盖，不在这里复制一份状态机（复制出来的会悄悄漂移）。
    decisions.push(
      request.postDataJSON() as ProductInitiativeDecisionCommandV1,
    );
    initiative = {
      initiativeId: "66666666-6666-4666-8666-666666666666",
      outcome: "approve",
      completion: "completed",
      currentDestination: "handed_off",
      responsibleActorId: "dev-operator",
      objective: "把折叠宠物出行包做成可发布版本",
      reviewPoints: [],
      reason: null,
      pendingFieldCodes: [],
      version: (initiative?.version ?? 0) + 1,
      createdAt: "2026-09-27T00:00:00.000Z",
      updatedAt: "2026-09-27T00:00:00.000Z",
    };
    await json(route, initiative);
  });

  return { decisions };
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function signal(
  overrides: Partial<MarketSignalV1> &
    Pick<MarketSignalV1, "signalId" | "title">,
): MarketSignalV1 {
  const { signalId, title, ...optionalOverrides } = overrides;
  return {
    signalId,
    title,
    marketCode: null,
    channelCode: null,
    categoryRef: null,
    observedFactSummary: null,
    hypothesis: null,
    evidenceRefs: [],
    currentDestination: "needs_decision",
    ownerTeamCode: "market_intelligence",
    version: 1,
    pendingFieldCodes: [
      "market_code",
      "channel_code",
      "category_ref",
      "observed_fact_summary",
      "hypothesis",
      "evidence_refs",
    ],
    createdAt: "2026-09-25T00:00:00.000Z",
    updatedAt: "2026-09-25T00:00:00.000Z",
    ...optionalOverrides,
  };
}

function handoff(
  source: MarketSignalV1,
  opportunityStatement: string | null,
): MarketOpportunityHandoffV1 {
  return {
    contractVersion: "market_opportunity_handoff.v1",
    handoffId,
    version: 1,
    signalId: source.signalId,
    signalVersion: source.version,
    title: source.title,
    recipientQueueCode: "product_selection",
    marketCode: source.marketCode,
    channelCode: source.channelCode,
    categoryRef: source.categoryRef,
    observedFactSummary: source.observedFactSummary,
    evidenceRefs: source.evidenceRefs,
    hypothesis: source.hypothesis,
    opportunityStatement,
    judgmentNote: null,
    pendingFieldCodes: source.pendingFieldCodes,
    createdBy: "market-owner",
    createdAt: "2026-09-25T02:00:00.000Z",
    idempotencyKey: "handoff-e2e",
  };
}
