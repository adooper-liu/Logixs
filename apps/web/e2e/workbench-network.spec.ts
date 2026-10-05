import type {
  MarketOpportunityHandoffV1,
  MarketSignalDecisionCommandV1,
  MarketSignalV1,
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
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
  await expect(page.getByTestId("main-workbench-stage")).toHaveCount(20);
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

test("a counted market card opens the market workbench", async ({ page }) => {
  await page.route("**/api/workbench-network/volume", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contractVersion: "workbench-network-volume.v1",
        weekStart: "2026-09-28T00:00:00.000Z",
        currentPhase: null,
        global: {
          open: { state: "count", count: 4 },
          weeklyFlow: { state: "not_connected" },
          blocked: { state: "undefined" },
        },
        workbenches: [
          {
            code: "market_signals",
            open: { state: "count", count: 4 },
            weeklyFlow: { state: "count", count: 1 },
            blocked: { state: "undefined" },
          },
          {
            code: "product_selection",
            open: { state: "count", count: 0 },
            weeklyFlow: { state: "not_connected" },
            blocked: { state: "undefined" },
          },
          {
            code: "sourcing",
            open: { state: "count", count: 0 },
            weeklyFlow: { state: "not_connected" },
            blocked: { state: "undefined" },
          },
        ],
        connections: [
          {
            fromCode: "market_signals",
            toCode: "product_selection",
            pendingAcceptance: { state: "count", count: 1 },
            overdue: { state: "undefined" },
          },
        ],
      }),
    });
  });

  await page.goto("/workspaces");
  const market = page
    .getByTestId("main-workbench-stage")
    .filter({ hasText: "市场与经营信号" });
  await expect(market).toContainText("在办 4");
  await market.getByRole("link").click();
  await expect(page).toHaveURL(/\/workspaces\/market-signals$/);
});

test("catalog stubs stay read-only and dispatch shows all inbound dependencies", async ({
  page,
}) => {
  for (const [path, title] of [
    ["/workspaces/booking", "订舱"],
    ["/workspaces/export-customs", "出口报关"],
    ["/workspaces/compliance-operations", "合规运营"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".planned-page")
        .locator("button, form, input, textarea, select"),
    ).toHaveCount(0);
  }

  await page.goto("/workspaces/dispatch");
  for (const label of ["订舱", "装箱", "出口报关"]) {
    await expect(
      page.getByTestId("inbound-relation").filter({ hasText: label }),
    ).toBeVisible();
  }
});

test("catalog topology is keyboard navigable", async ({ page }) => {
  await page.goto("/workspaces");
  const booking = page.locator('a.stage-link[href="/workspaces/booking"]');

  await expect(booking).toHaveCount(1);

  await booking.focus();
  await expect(booking).toBeFocused();
  await booking.press("Enter");
  await expect(page).toHaveURL(/\/workspaces\/booking$/);
  await expect(
    page.getByRole("heading", { name: "订舱", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "当前责任与交接" }),
  ).toContainText("出运计划提供获批订舱边界");
});

for (const width of [320, 375, 1440]) {
  test(`catalog stub and live dispatch avoid horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/workspaces/booking",
      "/workspaces/export-customs",
      "/workspaces/compliance-operations",
      "/workspaces/dispatch",
    ]) {
      await page.goto(path);
      if (path === "/workspaces/dispatch") {
        await expect(page.getByTestId("inbound-relation")).toHaveCount(3);
      } else {
        await expect(page.locator(".planned-page")).toBeVisible();
        await expect(
          page
            .locator(".planned-page")
            .locator("button, form, input, textarea, select"),
        ).toHaveCount(0);
      }

      const widths = await page.evaluate(() => ({
        pageClient: document.documentElement.clientWidth,
        pageScroll: document.documentElement.scrollWidth,
        contentClient:
          document.querySelector<HTMLElement>(".app-content")?.clientWidth ?? 0,
        contentScroll:
          document.querySelector<HTMLElement>(".app-content")?.scrollWidth ?? 0,
      }));
      expect(widths.pageScroll).toBeLessThanOrEqual(widths.pageClient + 1);
      expect(widths.contentScroll).toBeLessThanOrEqual(
        widths.contentClient + 1,
      );
    }
  });
}

test("a market owner can hand off a signal for a selector to claim, accept and take a decision", async ({
  page,
}) => {
  const { decisions, supplementSecondSignalScope } =
    await mockMarketOpportunityApis(page, {
      secondMarketCode: null,
      secondChannelCode: null,
    });
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
  await expect(page.getByRole("status")).toContainText("尚未填写");
  supplementSecondSignalScope();
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
      "这些项来自交接快照，选品不在此处补录；信号侧已后补项不会出现在此。",
    ),
  ).toBeVisible();
  await expect(page.locator(".opportunity-queue")).toContainText("Amazon CA");
  await page.getByRole("button", { name: "领取此机会" }).click();
  await expect(page.getByRole("status")).toContainText("已领取");
  await page.getByRole("button", { name: "接受并进入立项判断" }).click();
  await expect(page.getByRole("status")).toContainText("已接受经营机会");

  // 接受之后主动作换成立项结论：先被缺口挡住，并说清还差几项。
  const submit = page.locator(".outcome-submit");
  await expect(submit).toBeDisabled();
  await expect(submit).toContainText("还差 60 项才能立项");
  await expect(page.locator(".progress-head")).toContainText(
    "必填剩 60 · 已齐 2/62",
  );
  await expect(page.getByRole("group", { name: "责任与资源" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "时间与下一决策" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "单位经济" })).toBeVisible();
  await expect(submit).toHaveCount(1);
  await expect(submit).toBeInViewport();

  const viewport = page.viewportSize();
  const submitBox = await submit.boundingBox();
  expect(submitBox).not.toBeNull();
  expect(submitBox!.y).toBeGreaterThanOrEqual(0);
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(
    viewport?.height ?? 0,
  );
  const persistentAction = await page.evaluate(() => ({
    pane: getComputedStyle(
      document.querySelector<HTMLElement>(".pane--action")!,
    ).position,
    bar: getComputedStyle(
      document.querySelector<HTMLElement>(".outcome-action")!,
    ).position,
  }));
  if ((viewport?.width ?? 0) > 1100) {
    expect(persistentAction.pane).toBe("sticky");
  } else {
    expect(["sticky", "fixed"]).toContain(persistentAction.bar);
  }

  await page.getByRole("checkbox", { name: "由我对此立项负责" }).check();
  await page.getByLabel("目标结果").fill("把折叠宠物出行包做成可发布版本");
  await page.getByLabel("承接团队或岗位").fill("产品开发 / NPI");
  await page.getByLabel("资源说明").fill("结构工程 1 人，采购验证 1 人");
  await page.getByLabel("目标日期").fill("2026-11-15");
  await page.getByLabel("下一决策日期").fill("2026-10-20");
  await page.getByLabel("下一决策问题").fill("是否进入 EVT 打样");
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

  await page.getByLabel("单位经济币种").selectOption("CAD");
  for (const scenario of ["基准情景", "保守情景"]) {
    for (const field of [
      "销售价",
      "落地成本",
      "平台费",
      "履约费",
      "广告成本",
      "退货成本",
    ]) {
      const minimum = field === "销售价" ? "100.00" : "5.00";
      const maximum = field === "销售价" ? "120.00" : "10.00";
      await page.getByLabel(scenario + " " + field + " 最低值").fill(minimum);
      await page.getByLabel(scenario + " " + field + " 最高值").fill(maximum);
      await page
        .getByLabel(scenario + " " + field + " 依据类型")
        .selectOption("assumption");
    }
  }

  await expect(submit).toBeEnabled();
  await expect(submit).toContainText("立项并交给产品开发");
  const editingWidths = await page.evaluate(() => ({
    pageClient: document.documentElement.clientWidth,
    pageScroll: document.documentElement.scrollWidth,
    actionClient:
      document.querySelector<HTMLElement>(".pane--action")?.clientWidth ?? 0,
    actionScroll:
      document.querySelector<HTMLElement>(".pane--action")?.scrollWidth ?? 0,
  }));
  expect(editingWidths.pageScroll).toBeLessThanOrEqual(
    editingWidths.pageClient + 1,
  );
  expect(editingWidths.actionScroll).toBeLessThanOrEqual(
    editingWidths.actionClient + 1,
  );
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
  expect(decisions[0]?.acceptResponsibility).toBe(true);
  expect(decisions[0]?.receivingTeamOrRole).toBe("产品开发 / NPI");
  expect(decisions[0]?.unitEconomicsDraft).toMatchObject({
    channelCode: "Amazon CA",
    currencyCode: "CAD",
  });
  expect(decisions[0]?.unitEconomicsDraft).not.toHaveProperty("marketCode");
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

  await page.goto("/workspaces/product-npi");
  await expect(page.getByText("单位经济快照（只读）")).toBeVisible();
  await expect(page.getByText("基准情景", { exact: true })).toBeVisible();
  await expect(page.getByText("保守情景", { exact: true })).toBeVisible();
  await expect(page.getByText("50.00～95.00 CAD").first()).toBeVisible();
  const npiWidths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(npiWidths.scroll).toBeLessThanOrEqual(npiWidths.client + 1);
});

test("market keeps claimed handoffs until selection accepts and then shows feedback", async ({
  page,
}) => {
  await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");
  await page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }).click();
  await page.getByRole("radio", { name: /交给选品评估/ }).check();
  await page.getByLabel("机会说明").fill("请选品确认是否接受这份机会包。");
  await page.getByRole("button", { name: "交给选品评估", exact: true }).click();

  await page.goto(`/workspaces/market-signals?signalId=${secondSignalId}`);
  await page.getByRole("tab", { name: /已交选品·待接受/ }).click();
  await expect(
    page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }),
  ).toContainText("选品尚未领取");
  await expect(page.locator(".work-context")).toContainText(
    "当前责任经营与市场团队",
  );

  await page.goto("/workspaces/product-selection");
  await page.getByRole("button", { name: "领取此机会" }).click();
  await page.goto(`/workspaces/market-signals?signalId=${secondSignalId}`);
  await page.getByRole("tab", { name: /已交选品·待接受/ }).click();
  await expect(
    page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }),
  ).toContainText("dev-operator 于");
  await expect(page.locator(".selection-feedback")).toContainText(
    "结果责任仍在经营与市场团队",
  );

  await page.goto("/workspaces/product-selection");
  await page.getByRole("button", { name: "接受并进入立项判断" }).click();
  await page.goto(`/workspaces/market-signals?signalId=${secondSignalId}`);
  await expect(
    page.getByRole("tab", { name: /已交选品·待接受/ }),
  ).toContainText("0");
  await expect(page.locator(".selection-feedback")).toContainText("选品已接受");
  await expect(page.locator(".work-context")).toContainText("当前责任选品团队");
});

test("selection requests a return, market takes it back, then hands off a new version", async ({
  page,
}) => {
  const backend = await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");
  await page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }).click();
  await page.getByRole("radio", { name: /交给选品评估/ }).check();
  await page.getByLabel("机会说明").fill("请选品核对加拿大站机会方向。");
  await page.getByRole("button", { name: "交给选品评估", exact: true }).click();

  await page.getByRole("link", { name: "查看选品队列" }).click();
  await page.getByRole("button", { name: "领取此机会" }).click();
  await page.getByRole("button", { name: "接受并进入立项判断" }).click();
  await page.getByRole("radio", { name: /退回经营团队/ }).check();
  await page.getByLabel("退回依据").selectOption("wrong_direction");
  await page.getByLabel("市场需要补什么").fill("重新核对目标市场与渠道证据。");
  await page.getByRole("button", { name: "请求退回市场" }).click();
  await expect(page.getByText("等待市场接回", { exact: true })).toBeVisible();
  await expect(page.locator(".conclusion-strip")).toContainText(
    "已请求退回市场，等待市场接回",
  );
  await expect(page.locator(".conclusion-strip")).not.toContainText("已立项");

  await page.goto("/workspaces/market-signals");
  await page.getByRole("tab", { name: /选品请求退回/ }).click();
  await page.getByRole("button", { name: /加拿大站宠物出行需求上升/ }).click();
  await expect(page.getByText("方向错误", { exact: true })).toBeVisible();
  await expect(
    page.getByText("重新核对目标市场与渠道证据。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "接回", exact: true }).click();
  await expect(page.locator(".takeback-receipt")).toContainText("已接回");

  await page.getByRole("radio", { name: /交给选品评估/ }).check();
  await page.getByLabel("机会说明").fill("已补充方向证据，请重新评估。");
  await page.getByRole("button", { name: "交给选品评估", exact: true }).click();
  expect(backend.marketHandoffs()).toBe(2);
  expect(backend.decisions[0]).toMatchObject({
    outcome: "return_to_market",
    returnBasis: "wrong_direction",
    returnReason: "重新核对目标市场与渠道证据。",
  });
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

test("market validation restores a cross-actor 409 and keeps the attempted focus", async ({
  page,
}) => {
  const { signals, detailReads } = await mockMarketOpportunityApis(page);
  const owned = signal({
    ...signals.get(firstSignalId)!,
    currentDestination: "watching",
    activeValidation: {
      responsibleActorId: "dev-operator",
      nextReviewDate: "2026-02-12",
      watchFocus: "原验证重点",
      waitingReason: null,
    },
  });
  signals.set(firstSignalId, owned);
  await page.goto(`/workspaces/market-signals?signalId=${firstSignalId}`);
  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("原验证重点");
  const readsBeforeSubmit = detailReads();
  await page.getByRole("radio", { name: /安排下一项验证/ }).check();
  await page.getByLabel("这次要验证什么").fill("改期后的验证重点");
  await page.locator('input[type="date"]').fill("2026-02-20");

  signals.set(firstSignalId, {
    ...owned,
    activeValidation: {
      ...owned.activeValidation!,
      responsibleActorId: "market-colleague",
    },
  });
  await page.route("**/api/market-signals/*/decisions", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        message: "MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT",
      }),
    });
  });
  await page.getByRole("button", { name: "更新我的验证承诺" }).click();

  await expect(page.locator(".operation-error")).toContainText(
    "MARKET_SIGNAL_VALIDATION_OWNER_CONFLICT",
  );
  await expect(page.getByLabel("这次要验证什么")).toHaveValue(
    "改期后的验证重点",
  );
  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("market-colleague");
  expect(detailReads()).toBe(readsBeforeSubmit + 1);
  expect(signals.get(firstSignalId)?.activeValidation?.responsibleActorId).toBe(
    "market-colleague",
  );
});

test("market validation current owner can complete an exit and clear the projection", async ({
  page,
}) => {
  const { signals } = await mockMarketOpportunityApis(page);
  signals.set(
    firstSignalId,
    signal({
      ...signals.get(firstSignalId)!,
      currentDestination: "watching",
      activeValidation: {
        responsibleActorId: "dev-operator",
        nextReviewDate: "2026-02-12",
        watchFocus: "确认趋势",
        waitingReason: null,
      },
    }),
  );
  await page.goto(`/workspaces/market-signals?signalId=${firstSignalId}`);
  await page.getByRole("radio", { name: /不采纳/ }).check();
  await page.locator(".decision-fields select").selectOption("证据不足");
  await page.getByRole("button", { name: "记录不采纳" }).click();

  expect(signals.get(firstSignalId)?.activeValidation).toBeNull();
  expect(signals.get(firstSignalId)?.currentDestination).toBe("dismissed");
  await expect(page.getByRole("status", { name: "处理结果" })).toContainText(
    "已记录不采纳",
  );
  await expect(
    page.getByRole("heading", { name: /美国站庭院收纳需求连续三周上升/ }),
  ).toHaveCount(0);
});

test("market validation negative rehearsal blocks takeover without inventing a score", async ({
  page,
}) => {
  await mockMarketOpportunityApis(page);
  await page.goto(`/workspaces/market-signals?signalId=${negativeSignalId}`);

  await expect(
    page.getByRole("heading", {
      name: /\[合成演练\] 短期高热的便携降温设备/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "当前验证承诺" }),
  ).toContainText("market-colleague");
  await page.getByRole("radio", { name: /安排下一项验证/ }).check();
  await expect(page.locator(".validation-owner-conflict")).toContainText(
    "不支持静默接管或转派",
  );
  await expect(
    page.getByRole("button", { name: "当前验证由其他负责人承担" }),
  ).toBeDisabled();
  await expect(page.locator(".market-workbench")).not.toContainText("总分");
  await expect(page.locator(".market-workbench")).not.toContainText(
    "机会已证明",
  );
});

for (const width of [320, 375]) {
  test(`market validation long text fits a ${width}px viewport`, async ({
    page,
  }) => {
    await mockMarketOpportunityApis(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/workspaces/market-signals?signalId=${negativeSignalId}`);
    await expect(
      page
        .getByRole("region", { name: "当前验证承诺" })
        .getByText(/等待热浪后两周数据/),
    ).toBeVisible();

    const bounds = await page.evaluate(() => {
      const selectors = [
        ".queue-item.selected",
        ".active-validation",
        ".validation-owner-conflict",
        ".primary-action",
      ];
      return {
        viewport: document.documentElement.clientWidth,
        pageScroll: document.documentElement.scrollWidth,
        boxes: selectors.flatMap((selector) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return [];
          const rect = element.getBoundingClientRect();
          return [
            {
              selector,
              left: rect.left,
              right: rect.right,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            },
          ];
        }),
      };
    });
    expect(bounds.pageScroll).toBeLessThanOrEqual(bounds.viewport + 1);
    for (const box of bounds.boxes) {
      expect(box.left, box.selector).toBeGreaterThanOrEqual(-1);
      expect(box.right, box.selector).toBeLessThanOrEqual(bounds.viewport + 1);
      expect(box.scrollWidth, box.selector).toBeLessThanOrEqual(
        box.clientWidth + 1,
      );
    }
  });
}

test("market validation tabs move real keyboard focus", async ({ page }) => {
  await mockMarketOpportunityApis(page);
  await page.goto("/workspaces/market-signals");
  const tabs = page.getByRole("tab");

  await tabs.first().focus();
  await tabs.first().press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await tabs.nth(1).press("End");
  await expect(tabs.last()).toBeFocused();
  await tabs.last().press("Home");
  await expect(tabs.first()).toBeFocused();
});

test("market validation archived mode stays read-only", async ({ page }) => {
  await mockMarketOpportunityApis(page);
  await page.goto(`/workspaces/market-signals?signalId=${archivedSignalId}`);

  await expect(
    page.getByRole("region", { name: "信号关闭结论" }),
  ).toContainText("已归档关闭");
  await expect(page.getByText("关闭时 3 项未补齐")).toBeVisible();
  await expect(page.getByRole("region", { name: "信号处理动作" })).toHaveCount(
    0,
  );
  await expect(page.locator(".gap-action")).toHaveCount(0);
  await expect(page.locator(".decision-panel")).toHaveCount(0);
  await expect(
    page.locator(
      '.workbench-pane--main input, .workbench-pane--main textarea, .workbench-pane--main select, .workbench-pane--main [role="radio"]',
    ),
  ).toHaveCount(0);
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
const negativeSignalId = "77777777-7777-4777-8777-777777777777";
const archivedSignalId = "88888888-8888-4888-8888-888888888888";
const evidenceId = "33333333-3333-4333-8333-333333333333";
const handoffId = "44444444-4444-4444-8444-444444444444";

async function mockMarketOpportunityApis(
  page: Page,
  options: {
    secondMarketCode?: string | null;
    secondChannelCode?: string | null;
  } = {},
): Promise<{
  decisions: ProductInitiativeDecisionCommandV1[];
  signals: Map<string, MarketSignalV1>;
  detailReads: () => number;
  marketHandoffs: () => number;
  supplementSecondSignalScope: () => void;
}> {
  let detailReads = 0;
  const longToken = "LONGVALIDATIONTOKEN".repeat(24);
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
        marketCode:
          options.secondMarketCode === undefined
            ? "CA"
            : options.secondMarketCode,
        channelCode:
          options.secondChannelCode === undefined
            ? null
            : options.secondChannelCode,
        pendingFieldCodes: [
          ...(options.secondMarketCode === null
            ? (["market_code"] as const)
            : []),
          ...(options.secondChannelCode ? [] : (["channel_code"] as const)),
          "category_ref",
          "observed_fact_summary",
          "hypothesis",
          "evidence_refs",
        ],
      }),
    ],
    [
      negativeSignalId,
      signal({
        signalId: negativeSignalId,
        title: "[合成演练] 短期高热的便携降温设备",
        marketCode: "US",
        observedFactSummary:
          "热浪期间搜索量快速上升，但热浪后回落且相似商品购买转化偏低。",
        hypothesis:
          "需要继续确认热度是否可持续，不能按关注度自动形成可信机会。",
        currentDestination: "watching",
        activeValidation: {
          responsibleActorId: "market-colleague",
          nextReviewDate: "2026-06-17",
          watchFocus: `确认热浪后需求是否仍然持续，并核对重复使用障碍 ${longToken}`,
          waitingReason: `等待热浪后两周数据 ${longToken}`,
        },
        pendingFieldCodes: [],
      }),
    ],
    [
      archivedSignalId,
      signal({
        signalId: archivedSignalId,
        title: "[合成演练] 已归档的旧观察信号",
        currentDestination: "archived",
        pendingFieldCodes: [
          "market_code",
          "channel_code",
          "observed_fact_summary",
        ],
      }),
    ],
  ]);
  let opportunity: ProductOpportunityV1 | null = null;
  let initiative: ProductInitiativeV1 | null = null;
  /** 前端实际发出去的决策命令：版本这类字段桩不会校验，只能断言发出去的值。 */
  const decisions: ProductInitiativeDecisionCommandV1[] = [];
  let marketHandoffs = 0;
  let selectionReturnBasis: "insufficient_evidence" | "wrong_direction" | null =
    null;
  let selectionReturnReason: string | null = null;
  const supplementSecondSignalScope = () => {
    const current = signals.get(secondSignalId);
    if (!current || !opportunity) {
      throw new Error("SECOND_SIGNAL_HANDOFF_NOT_READY");
    }
    const supplemented = {
      ...current,
      marketCode: "CA",
      channelCode: "Amazon CA",
      version: current.version + 1,
      pendingFieldCodes: current.pendingFieldCodes.filter(
        (code) => code !== "market_code" && code !== "channel_code",
      ),
    };
    signals.set(secondSignalId, supplemented);
    const handoffSnapshot = opportunity.handoffSnapshot ?? opportunity.handoff;
    opportunity = {
      ...opportunity,
      handoffSnapshot,
      handoff: {
        ...opportunity.handoff,
        marketCode: supplemented.marketCode,
        channelCode: supplemented.channelCode,
        pendingFieldCodes: opportunity.handoff.pendingFieldCodes.filter(
          (code) => code !== "market_code" && code !== "channel_code",
        ),
      },
      supplementedFieldCodes: ["market_code", "channel_code"],
    };
  };

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
    if (
      segments.at(-2) === "selection-return" &&
      segments.at(-1) === "takeback" &&
      request.method() === "POST"
    ) {
      const returned = {
        ...current,
        currentDestination: "returned_from_selection" as const,
        version: current.version + 1,
      };
      signals.set(current.signalId, returned);
      if (initiative) {
        initiative = {
          ...initiative,
          currentDestination: "returned_to_market",
          responsibleActorId: "dev-operator",
          version: initiative.version + 1,
        };
        if (opportunity) {
          opportunity = {
            ...opportunity,
            latestSelectionDecision: {
              outcome: initiative.outcome,
              completion: initiative.completion,
              currentDestination: initiative.currentDestination,
              responsibleActorId: initiative.responsibleActorId,
              reason: initiative.reason ?? null,
              returnBasis: initiative.returnBasis ?? null,
              decidedAt: "2026-09-27T00:10:00.000Z",
            },
          };
        }
      }
      await json(route, initiative);
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
      if (body.decisionType === "dismiss") {
        const dismissed = {
          ...current,
          currentDestination: "dismissed" as const,
          activeValidation: null,
          version: current.version + 1,
        };
        signals.set(current.signalId, dismissed);
        await json(route, {
          contractVersion: "market-signal-decision-result.v1",
          status: "saved",
          signal: dismissed,
          decisionId: "66666666-6666-4666-8666-666666666668",
          decisionVersion: 2,
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
      marketHandoffs += 1;
      const snapshot = handoff(handedOff, body.opportunityStatement ?? null);
      opportunity = {
        handoff: snapshot,
        intakeState: "queued",
        intakeVersion: 1,
        assignedActorId: null,
        supplementedFieldCodes: [],
        responsibility: {
          status: "retained_by_market",
          responsibleTeamCode: "market_intelligence",
          handedOffAt: snapshot.createdAt,
          assignedActorId: null,
          claimedAt: null,
          acceptedAt: null,
        },
        latestSelectionDecision: null,
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
    detailReads += 1;
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
      selectionReturnBasis,
      selectionReturnReason,
    });
  });

  await page.route("**/api/product-opportunities**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      const url = new URL(request.url());
      const requestedSignalId = url.searchParams.get("signalId");
      const responsibilityStatus = url.searchParams.get("responsibilityStatus");
      const visible =
        opportunity &&
        (!requestedSignalId ||
          opportunity.handoff.signalId === requestedSignalId) &&
        (!responsibilityStatus ||
          opportunity.responsibility.status === responsibilityStatus)
          ? [opportunity]
          : [];
      await json(route, {
        contractVersion: "product-opportunity-page.v1",
        items: visible,
        pageSize: Number(url.searchParams.get("pageSize") ?? 100),
        totalCount: visible.length,
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
      responsibility: {
        ...opportunity.responsibility,
        status:
          body.action === "claim"
            ? "retained_by_market"
            : "transferred_to_selection",
        responsibleTeamCode:
          body.action === "claim" ? "market_intelligence" : "product_selection",
        assignedActorId: "dev-operator",
        claimedAt:
          opportunity.responsibility.claimedAt ?? "2026-09-25T02:10:00.000Z",
        acceptedAt:
          body.action === "accept" ? "2026-09-25T02:20:00.000Z" : null,
      },
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
        currencyOptions: [
          { code: "CAD", name: "Canadian Dollar", minorUnit: 2 },
          { code: "USD", name: "US Dollar", minorUnit: 2 },
        ],
      });
      return;
    }
    const body = request.postDataJSON() as ProductInitiativeDecisionCommandV1;
    decisions.push(body);
    if (body.outcome === "return_to_market") {
      selectionReturnBasis = body.returnBasis ?? null;
      selectionReturnReason = body.returnReason ?? null;
      const sourceId = opportunity?.handoff.signalId;
      const source = sourceId ? signals.get(sourceId) : null;
      if (source) {
        signals.set(source.signalId, {
          ...source,
          currentDestination: "selection_return_requested",
          version: source.version + 1,
        });
      }
      initiative = {
        initiativeId: "66666666-6666-4666-8666-666666666666",
        outcome: "return_to_market",
        completion: "completed",
        currentDestination: "return_requested",
        responsibleActorId: "dev-operator",
        responsibilityAccepted: null,
        receivingTeamOrRole: null,
        resourceDescription: null,
        targetDate: null,
        nextDecisionDate: null,
        nextDecisionQuestion: null,
        validationFocus: null,
        reconsiderationDate: null,
        unitEconomicsDraft: body.unitEconomicsDraft ?? null,
        unitEconomicsSnapshot: null,
        negativeConservativeReason: null,
        objective: null,
        reviewPoints: [],
        reason: selectionReturnReason,
        returnBasis: selectionReturnBasis,
        pendingFieldCodes: [],
        version: (initiative?.version ?? 0) + 1,
        createdAt: "2026-09-27T00:00:00.000Z",
        updatedAt: "2026-09-27T00:00:00.000Z",
      };
      if (opportunity) {
        opportunity = {
          ...opportunity,
          latestSelectionDecision: {
            outcome: initiative.outcome,
            completion: initiative.completion,
            currentDestination: initiative.currentDestination,
            responsibleActorId: initiative.responsibleActorId,
            reason: initiative.reason ?? null,
            returnBasis: initiative.returnBasis ?? null,
            decidedAt: initiative.updatedAt,
          },
        };
      }
      await json(route, initiative);
      return;
    }
    initiative = {
      initiativeId: "66666666-6666-4666-8666-666666666666",
      outcome: "approve",
      completion: "completed",
      currentDestination: "handed_off",
      responsibleActorId: "dev-operator",
      responsibilityAccepted: true,
      receivingTeamOrRole: body.receivingTeamOrRole ?? null,
      resourceDescription: body.resourceDescription ?? null,
      targetDate: body.targetDate ?? null,
      nextDecisionDate: body.nextDecisionDate ?? null,
      nextDecisionQuestion: body.nextDecisionQuestion ?? null,
      validationFocus: null,
      reconsiderationDate: null,
      unitEconomicsDraft: body.unitEconomicsDraft ?? null,
      unitEconomicsSnapshot: completeUnitEconomicsSnapshot(),
      negativeConservativeReason: body.negativeConservativeReason ?? null,
      objective: "把折叠宠物出行包做成可发布版本",
      reviewPoints: [],
      reason: null,
      pendingFieldCodes: [],
      version: (initiative?.version ?? 0) + 1,
      createdAt: "2026-09-27T00:00:00.000Z",
      updatedAt: "2026-09-27T00:00:00.000Z",
    };
    if (opportunity) {
      opportunity = {
        ...opportunity,
        latestSelectionDecision: {
          outcome: initiative.outcome,
          completion: initiative.completion,
          currentDestination: initiative.currentDestination,
          responsibleActorId: initiative.responsibleActorId,
          reason: initiative.reason ?? null,
          returnBasis: null,
          decidedAt: initiative.updatedAt,
        },
      };
    }
    await json(route, initiative);
  });

  await page.route("**/api/product-initiative-npi/queue**", async (route) => {
    const visible =
      initiative?.currentDestination === "handed_off" && opportunity
        ? [
            {
              handoff: {
                contractVersion: "product_initiative_handoff.v1",
                handoffId,
                version: 1,
                initiativeId: initiative.initiativeId,
                signalId: opportunity.handoff.signalId,
                marketCode: opportunity.handoff.marketCode,
                userProblem:
                  opportunity.handoff.opportunityStatement ??
                  opportunity.handoff.observedFactSummary,
                objective: initiative.objective,
                responsibleActorId: initiative.responsibleActorId,
                responsibilityAccepted: initiative.responsibilityAccepted,
                receivingTeamOrRole: initiative.receivingTeamOrRole,
                resourceDescription: initiative.resourceDescription,
                targetDate: initiative.targetDate,
                nextDecisionDate: initiative.nextDecisionDate,
                nextDecisionQuestion: initiative.nextDecisionQuestion,
                unitEconomicsSnapshot: initiative.unitEconomicsSnapshot,
                negativeConservativeReason:
                  initiative.negativeConservativeReason,
                reviewPoints: initiative.reviewPoints,
                evidenceRefs: [evidenceId],
                createdAt: initiative.updatedAt,
                idempotencyKey: "e2e-unit-economics-handoff",
              },
              claim: null,
              initiativeVersion: initiative.version,
              initiativeDestination: initiative.currentDestination,
            },
          ]
        : [];
    await json(route, {
      contractVersion: "product-initiative-npi-queue.v1",
      items: visible,
      pageSize: 200,
      nextCursor: null,
    });
  });

  await page.route("**/api/product-definitions/**", async (route) => {
    await json(route, null);
  });

  return {
    decisions,
    signals,
    detailReads: () => detailReads,
    marketHandoffs: () => marketHandoffs,
    supplementSecondSignalScope,
  };
}

function completeUnitEconomicsSnapshot(): ProductInitiativeUnitEconomicsSnapshotV1 {
  const price = {
    min: "100.00",
    max: "120.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const cost = {
    min: "5.00",
    max: "10.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const scenario = () => ({
    salePrice: { ...price },
    landedCost: { ...cost },
    platformFee: { ...cost },
    fulfillmentFee: { ...cost },
    advertisingCost: { ...cost },
    returnCost: { ...cost },
    contribution: { min: "50.00", max: "95.00" },
  });
  return {
    marketCode: "CA",
    channelCode: "Amazon CA",
    currencyCode: "CAD",
    scenarios: {
      baseline: scenario(),
      conservative: scenario(),
    },
  };
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
