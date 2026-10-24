import type { WorkSessionStatusV1, WorkSessionV1 } from "@logix/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const HANDOFF = "44444444-4444-4444-8444-444444444444";
const OTHER_HANDOFF = "55555555-5555-4555-8555-555555555555";
const CONTAINER = "66666666-6666-4666-8666-666666666666";
const TASK = "77777777-7777-4777-8777-777777777777";
const SELECTION_SESSION = "88888888-8888-4888-8888-888888888888";
const STUFFING_SESSION = "99999999-9999-4999-8999-999999999999";
const FORMAL_REVIEW_POINT = "正式评审要点 A";
const DRAFT_REVIEW_POINT = "服务端草稿评审要点 B";

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
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();
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
  if ((page.viewportSize()?.width ?? 0) < 681) {
    await page.locator('[data-mobile-target="detail"]').click();
    await page.locator('[data-mobile-target="context"]').click();
  }
  const seal = page.getByLabel("封号");
  await seal.fill("NEW-SEAL");
  await expect(seal).toHaveValue("NEW-SEAL");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${SELECTION_SESSION}"]`).click();
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

for (const status of [403, 404, 409] as const) {
  test(`target read ${status} keeps the source current and typed input`, async ({
    page,
  }) => {
    const evidence = await mockRecoverableSessions(page, {
      targetReadStatus: status,
    });
    const originalUrl = await openDirtyProductSelection(page);
    const before = await productSelectionHoldState(page);

    await chooseStuffingAndSave(page);

    await expect(
      page.getByRole("dialog", { name: "工作现场切换" }).getByRole("alert"),
    ).toContainText(String(status));
    await expectProductSelectionHoldState(page, before);
    await expect(page).toHaveURL(originalUrl);
    await expectUniqueCurrent(page, SELECTION_SESSION);
    expect(evidence.draftSaveCalls).toBe(1);
    expect(evidence.targetReadCalls).toBe(1);
    expect(evidence.activateCalls).toBe(0);
  });
}

for (const status of [500, 409] as const) {
  test(`typed draft save ${status} keeps the source current and typed input`, async ({
    page,
  }) => {
    const evidence = await mockRecoverableSessions(page, {
      draftSaveStatus: status,
    });
    const originalUrl = await openDirtyProductSelection(page);
    const before = await productSelectionHoldState(page);

    await chooseStuffingAndSave(page);

    await expect(
      page.getByRole("dialog", { name: "工作现场切换" }).getByRole("alert"),
    ).toContainText(String(status));
    await expectProductSelectionHoldState(page, before);
    await expect(page).toHaveURL(originalUrl);
    await expectUniqueCurrent(page, SELECTION_SESSION);
    expect(evidence.draftSaveCalls).toBe(1);
    expect(evidence.targetReadCalls).toBe(0);
    expect(evidence.activateCalls).toBe(0);
  });
}

test("activate 409 keeps the source current, route, pointer, and typed input", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page, { activateStatus: 409 });
  const originalUrl = await openDirtyProductSelection(page);
  const before = await productSelectionHoldState(page);

  await chooseStuffingAndSave(page);

  await expect(page.getByRole("alert")).toContainText("409");
  await expectProductSelectionHoldState(page, before);
  await expect(page).toHaveURL(originalUrl);
  await expectUniqueCurrent(page, SELECTION_SESSION);
  expect(evidence.draftSaveCalls).toBe(1);
  expect(evidence.targetReadCalls).toBe(1);
  expect(evidence.activateCalls).toBe(1);
});

test("successful typed draft switch exposes draft_saved through the session API state", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page);
  await openDirtyProductSelection(page);

  await chooseStuffingAndSave(page);

  await expect(page).toHaveURL(
    new RegExp(
      `/workspaces/stuffing\\?containerId=${CONTAINER}&taskId=${TASK}$`,
    ),
  );
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await expectUniqueCurrent(page, STUFFING_SESSION);
  await expect(
    page.locator(`[data-session="${SELECTION_SESSION}"]`),
  ).toContainText("领域草稿已保存");
  expect(evidence.activateCalls).toBe(1);
});

test("typed decision draft and pointer survive switch-back and an explicit reload", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  const evidence = await mockRecoverableSessions(page, {
    richDraftRefresh: true,
  });
  await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);

  await page.getByLabel("目标结果").fill("刷新后仍在的 typed 目标");
  await page.getByRole("button", { name: /评审依据/ }).click();
  const reviewPanel = page.locator(".review-panel");
  const businessEditor = reviewPanel.locator(".business-case__editor");
  await businessEditor
    .getByRole("radio", { name: "支持投入", exact: true })
    .check();
  await businessEditor.locator("textarea").first().fill("客户需求结论可恢复");
  await businessEditor.getByText(/引用来源信号证据/).click();
  await businessEditor.getByLabel(/站点类目周报/).check();

  await reviewPanel
    .locator(".risk-summary")
    .getByRole("button", {
      name: /合规/,
    })
    .click();
  const riskEditor = reviewPanel.locator(".risk-editor");
  await riskEditor.getByRole("radio", { name: "适用", exact: true }).check();
  await riskEditor
    .getByRole("radio", { name: "支持投入", exact: true })
    .check();
  await riskEditor.locator("textarea").first().fill("合规风险结论可恢复");
  await riskEditor.getByText(/引用来源信号证据/).click();
  await riskEditor.getByLabel(/站点类目周报/).check();

  await page.getByRole("button", { name: /单位经济/ }).click();
  await page.getByLabel("单位经济币种").selectOption("CAD");
  await page.getByText("填写基准情景金额与依据", { exact: true }).click();
  await page.getByLabel("基准情景 销售价 最低值").fill("49.90");
  await page.getByLabel("基准情景 销售价 最高值").fill("59.90");
  await page.getByLabel("基准情景 销售价 依据类型").selectOption("assumption");

  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();
  await page.getByText("保存领域草稿并切换", { exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/workspaces/stuffing\\?containerId=${CONTAINER}&taskId=${TASK}$`,
    ),
  );

  await page.getByRole("button", { name: "切换工作现场" }).click();
  const selectionSession = page.locator(
    `[data-session="${SELECTION_SESSION}"]`,
  );
  await selectionSession.focus();
  await selectionSession.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/product-selection\\?handoffId=${HANDOFF}$`),
  );
  await page.reload();

  await expect(page.getByLabel("目标结果")).toHaveValue(
    "刷新后仍在的 typed 目标",
  );
  await expect(page.getByRole("button", { name: /单位经济/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByLabel("单位经济币种")).toHaveValue("CAD");
  await page.getByText("填写基准情景金额与依据", { exact: true }).click();
  await expect(page.getByLabel("基准情景 销售价 最低值")).toHaveValue("49.90");
  await expect(page.getByLabel("基准情景 销售价 最高值")).toHaveValue("59.90");
  await expect(page.getByLabel("基准情景 销售价 依据类型")).toHaveValue(
    "assumption",
  );

  await page.getByRole("button", { name: /评审依据/ }).click();
  await expect(
    page.locator(".business-case__editor textarea").first(),
  ).toHaveValue("客户需求结论可恢复");
  await expect(
    page.locator(".risk-summary").getByRole("button", {
      name: /合规/,
    }),
  ).toContainText("适用 · 支持投入");
  await page
    .locator(".risk-summary")
    .getByRole("button", {
      name: /合规/,
    })
    .click();
  await expect(page.locator(".risk-editor textarea").first()).toHaveValue(
    "合规风险结论可恢复",
  );

  const detail = await page.evaluate(async (handoffId) => {
    const response = await fetch(`/api/product-initiatives/${handoffId}`);
    return response.json();
  }, HANDOFF);
  expect(detail.decisionDraft).toMatchObject({
    objective: "刷新后仍在的 typed 目标",
    reviewPoints: expect.arrayContaining([
      expect.objectContaining({
        code: "target_user_and_market",
        conclusion: DRAFT_REVIEW_POINT,
      }),
    ]),
    businessCaseDraft: expect.arrayContaining([
      expect.objectContaining({
        dimensionCode: "customer_need",
        decision: "supports_investment",
        conclusion: "客户需求结论可恢复",
      }),
    ]),
    riskAssessmentDraft: expect.arrayContaining([
      expect.objectContaining({
        riskCode: "compliance",
        applicability: "applicable",
        investmentDecision: "supports_investment",
        conclusion: "合规风险结论可恢复",
      }),
    ]),
    unitEconomicsDraft: {
      currencyCode: "CAD",
      scenarios: {
        baseline: {
          salePrice: {
            min: "49.90",
            max: "59.90",
            basis: "assumption",
          },
        },
      },
    },
  });
  expect(detail.initiative).toMatchObject({
    outcome: "approve",
    currentDestination: "needs_decision",
    responsibleActorId: "formal-owner",
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    reconsiderationDate: null,
    reviewPoints: expect.arrayContaining([
      expect.objectContaining({
        code: "target_user_and_market",
        conclusion: FORMAL_REVIEW_POINT,
      }),
    ]),
  });
  await page.getByText("历史四项评审（只读，不作为五面判断）").click();
  await expect(
    page.getByText(FORMAL_REVIEW_POINT, { exact: false }),
  ).toBeVisible();
  expect(evidence.draftSaveCalls).toBe(1);
  expect(evidence.lastDraftCommand).toMatchObject({
    objective: "刷新后仍在的 typed 目标",
  });
});

test("version mismatch records and exposes conflict without activation", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page, {
    targetDomainVersion: 2,
  });
  await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();

  await expect(page.getByRole("alert")).toContainText(
    "目标现场版本已从 0 更新为 2",
  );
  await expectUniqueCurrent(page, SELECTION_SESSION);
  await expect(
    page.locator(`[data-session="${STUFFING_SESSION}"]`),
  ).toContainText("冲突");
  expect(evidence.pointerCalls).toBe(1);
  expect(evidence.activateCalls).toBe(0);
});

test("close uses the close endpoint and moves the session into collapsed inspection", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page);
  await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page
    .getByRole("button", { name: "关闭此工作现场：装箱 · KOCU4960726" })
    .click();

  await expect(page.getByText("已关闭工作现场（1）")).toBeVisible();
  await page.getByText("已关闭工作现场（1）").click();
  await expect(page.getByText("工作现场已关闭", { exact: true })).toBeVisible();
  await expect(
    page.getByText("关闭现场不等于业务完成、延期或责任转移。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("重新进入该对象会建立新的受控现场，并重新授权和重读。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(`[data-session="${STUFFING_SESSION}"]`),
  ).toHaveCount(0);
  await expectUniqueCurrent(page, SELECTION_SESSION);
  expect(evidence.closeCalls).toBe(1);
});

test("close failure preserves the current session, route, and local input", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page, { closeStatus: 409 });
  const originalUrl = await openDirtyProductSelection(page);
  await page
    .getByRole("button", { name: "关闭此工作现场：装箱 · KOCU4960726" })
    .click();

  await expect(page).toHaveURL(originalUrl);
  await expect(page.getByLabel("目标结果")).toHaveValue("尚未保存的目标结果");
  await expectUniqueCurrent(page, SELECTION_SESSION);
  await expect(page.getByRole("alert")).toContainText("409");
  expect(evidence.closeCalls).toBe(1);
});

test("stuffing new-tab transition exposes browser_held through the session API state", async ({
  page,
}) => {
  const evidence = await mockRecoverableSessions(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${CONTAINER}&taskId=${TASK}`,
  );
  if ((page.viewportSize()?.width ?? 0) < 681) {
    await page.locator('[data-mobile-target="detail"]').click();
    await page.locator('[data-mobile-target="context"]').click();
  }
  const seal = page.getByLabel("封号");
  await seal.fill("NEW-SEAL");
  await expect(seal).toHaveValue("NEW-SEAL");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  await page.locator(`[data-session="${SELECTION_SESSION}"]`).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByText("在新标签页打开目标", { exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(
    new RegExp(`/workspaces/product-selection\\?handoffId=${HANDOFF}$`),
  );
  await popup.close();
  await page.getByRole("button", { name: "切换工作现场" }).click();

  await expect(
    page.locator(`[data-session="${STUFFING_SESSION}"]`),
  ).toContainText("仅此标签保留");
  await expect(
    page.getByRole("button", {
      name: "关闭此工作现场：装箱 · KOCU4960726",
    }),
  ).toHaveCount(0);
  expect(evidence.activateCalls).toBe(1);
});

for (const state of [
  {
    name: "draft-saved",
    status: "draft_saved",
    text: "领域草稿已保存",
  },
  { name: "conflict", status: "conflict", text: "冲突" },
  {
    name: "closed-inspection",
    status: "closed",
    text: "工作现场已关闭",
  },
  {
    name: "browser-held",
    status: "browser_held",
    text: "仅此标签保留",
  },
] as const) {
  test(`visual evidence keeps ${state.name} reachable without overflow`, async ({
    page,
  }, testInfo) => {
    await mockRecoverableSessions(page, {
      initialStuffingStatus: state.status,
    });
    await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);
    await page.getByRole("button", { name: "切换工作现场" }).click();
    if (state.status === "closed") {
      await page.getByText("已关闭工作现场（1）").click();
    }
    const stateText = page.getByText(state.text, { exact: true });
    await stateText.scrollIntoViewIfNeeded();
    await expect(stateText).toBeVisible();
    await expectSessionPanelFitsViewport(page);
    await expectNoOverflow(page);
    await expectUniqueCurrent(page, SELECTION_SESSION);
    if (testInfo.project.name === "desktop-chromium") {
      await expect(page).toHaveScreenshot(
        `product-selection-${state.name}.png`,
        { animations: "disabled", maxDiffPixelRatio: 0.03, threshold: 0.3 },
      );
    }
  });
}

test("visual evidence keeps a failed switch and recovery action reachable", async ({
  page,
}, testInfo) => {
  await mockRecoverableSessions(page, { draftSaveStatus: 500 });
  await openDirtyProductSelection(page);
  await chooseStuffingAndSave(page);
  await expect(
    page.getByRole("dialog", { name: "工作现场切换" }).getByRole("alert"),
  ).toContainText("500");
  const recovery = page.getByText("留在当前页", { exact: true });
  await recovery.scrollIntoViewIfNeeded();
  await expect(recovery).toBeVisible();
  await expectSessionPanelFitsViewport(page);
  await expectNoOverflow(page);
  await expectUniqueCurrent(page, SELECTION_SESSION);
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page).toHaveScreenshot("product-selection-failed-switch.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.03,
      threshold: 0.3,
    });
  }
});

interface MockScenario {
  readonly targetReadStatus?: 401 | 403 | 404 | 409;
  readonly draftSaveStatus?: 409 | 500;
  readonly activateStatus?: 409;
  readonly closeStatus?: 409 | 500;
  readonly targetDomainVersion?: number;
  readonly richDraftRefresh?: boolean;
  readonly initialStuffingStatus?: Exclude<WorkSessionStatusV1, "current">;
}

interface MockEvidence {
  draftSaveCalls: number;
  targetReadCalls: number;
  activateCalls: number;
  pointerCalls: number;
  closeCalls: number;
  lastDraftCommand: Record<string, unknown> | null;
}

async function mockRecoverableSessions(
  page: Page,
  scenario: MockScenario = {},
): Promise<MockEvidence> {
  const evidence: MockEvidence = {
    draftSaveCalls: 0,
    targetReadCalls: 0,
    activateCalls: 0,
    pointerCalls: 0,
    closeCalls: 0,
    lastDraftCommand: null,
  };
  let sessions: WorkSessionV1[] = [];
  let decisionDraft: ReturnType<typeof savedDraft> | null = null;

  function ensureSessions(): void {
    if (sessions.length) return;
    const stuffingCurrent = page.url().includes("stuffing");
    const selection = session(
      SELECTION_SESSION,
      stuffingCurrent ? "resumable" : "current",
      "product_selection",
    );
    if (scenario.richDraftRefresh) selection.domainVersionSeen = 3;
    sessions = [
      selection,
      session(
        STUFFING_SESSION,
        stuffingCurrent
          ? "current"
          : (scenario.initialStuffingStatus ?? "resumable"),
        "stuffing",
      ),
    ];
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    ensureSessions();
    if (path === "/api/work-sessions") {
      const includeClosed = url.searchParams.get("includeClosed") === "true";
      await route.fulfill({
        json: sessionPage(
          includeClosed
            ? sessions
            : sessions.filter(({ status }) => status !== "closed"),
        ),
      });
      return;
    }
    if (path === "/api/work-sessions/open") {
      const body = request.postDataJSON() as { workbenchCode: string };
      const opened = sessionFor(body.workbenchCode);
      const existing = sessions.find(
        ({ contextKey, status }) =>
          contextKey === opened.contextKey && status !== "closed",
      );
      if (!existing) sessions.unshift(opened);
      await route.fulfill({ json: existing ?? opened });
      return;
    }
    if (/^\/api\/work-sessions\/[^/]+\/activate$/.test(path)) {
      evidence.activateCalls += 1;
      if (scenario.activateStatus) {
        await route.fulfill({
          status: scenario.activateStatus,
          json: { code: "WORK_SESSION_VERSION_CONFLICT" },
        });
        return;
      }
      const body = request.postDataJSON() as {
        sourceSessionId: string;
        sourceStatus: Exclude<WorkSessionStatusV1, "current" | "closed">;
        sourceActiveItemKey?: string | null;
        sourceContextMode?: string | null;
      };
      const target = path.includes(STUFFING_SESSION)
        ? "stuffing"
        : "product_selection";
      sessions = sessions.map((item) =>
        item.sessionId === body.sourceSessionId
          ? {
              ...item,
              status: body.sourceStatus,
              version: item.version + 1,
              activeItemKey: body.sourceActiveItemKey ?? item.activeItemKey,
              contextMode: body.sourceContextMode ?? item.contextMode,
            }
          : item.sessionId === sessionFor(target).sessionId
            ? { ...item, status: "current", version: item.version + 1 }
            : item,
      );
      await route.fulfill({
        json: sessions.find(
          ({ sessionId }) => sessionId === sessionFor(target).sessionId,
        ),
      });
      return;
    }
    if (/^\/api\/work-sessions\/[^/]+\/pointer$/.test(path)) {
      evidence.pointerCalls += 1;
      const sessionId = path.split("/")[3]!;
      const body = request.postDataJSON() as {
        status?: WorkSessionStatusV1;
        domainVersionSeen?: number | null;
      };
      sessions = sessions.map((item) =>
        item.sessionId === sessionId
          ? {
              ...item,
              ...(body.status ? { status: body.status } : {}),
              ...(body.domainVersionSeen === undefined
                ? {}
                : { domainVersionSeen: body.domainVersionSeen }),
              version: item.version + 1,
            }
          : item,
      );
      await route.fulfill({
        json: sessions.find((item) => item.sessionId === sessionId),
      });
      return;
    }
    if (/^\/api\/work-sessions\/[^/]+\/close$/.test(path)) {
      evidence.closeCalls += 1;
      if (scenario.closeStatus) {
        await route.fulfill({
          status: scenario.closeStatus,
          json: { code: "WORK_SESSION_VERSION_CONFLICT" },
        });
        return;
      }
      const sessionId = path.split("/")[3]!;
      sessions = sessions.map((item) =>
        item.sessionId === sessionId
          ? { ...item, status: "closed", version: item.version + 1 }
          : item,
      );
      await route.fulfill({
        json: sessions.find((item) => item.sessionId === sessionId),
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
      await route.fulfill({
        json: initiativeDetail(decisionDraft, scenario.richDraftRefresh),
      });
      return;
    }
    if (path === `/api/product-initiatives/${HANDOFF}/drafts`) {
      evidence.draftSaveCalls += 1;
      if (scenario.draftSaveStatus) {
        await route.fulfill({
          status: scenario.draftSaveStatus,
          json: { code: "PRODUCT_INITIATIVE_DRAFT_VERSION_CONFLICT" },
        });
        return;
      }
      evidence.lastDraftCommand = request.postDataJSON() as Record<
        string,
        unknown
      >;
      decisionDraft = savedDraft(evidence.lastDraftCommand);
      if (scenario.richDraftRefresh) {
        decisionDraft = {
          ...decisionDraft,
          reviewPoints: [
            {
              code: "target_user_and_market",
              evidenceRefs: [],
              conclusion: DRAFT_REVIEW_POINT,
            },
          ],
        };
      }
      await route.fulfill({ json: decisionDraft });
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
      evidence.targetReadCalls += 1;
      if (scenario.targetReadStatus) {
        await route.fulfill({
          status: scenario.targetReadStatus,
          json: { code: "E2E_TARGET_READ_FAILED" },
        });
        return;
      }
      if (scenario.targetDomainVersion !== undefined) {
        await route.fulfill({
          json: { version: scenario.targetDomainVersion },
        });
        return;
      }
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
  return evidence;
}

async function continueStatic(route: Route): Promise<void> {
  if (new URL(route.request().url()).pathname.startsWith("/api/")) {
    await route.fulfill({
      status: 404,
      json: { message: "UNHANDLED_TEST_API" },
    });
  } else await route.continue();
}

function sessionPage(items: readonly WorkSessionV1[]) {
  return {
    contractVersion: "work-session-page.v1",
    items,
    pageSize: 50,
    nextCursor: null,
  };
}

function session(
  id: string,
  status: WorkSessionStatusV1,
  kind: "product_selection" | "stuffing",
): WorkSessionV1 {
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
function initiativeDetail(
  decisionDraft: ReturnType<typeof savedDraft> | null = null,
  richDraftRefresh = false,
) {
  return {
    handoffId: HANDOFF,
    initiative: richDraftRefresh ? formalInitiative() : null,
    decisionDraft,
    evidenceCandidates: richDraftRefresh
      ? [
          {
            evidenceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            sourceName: "站点类目周报",
            summary: "需求增长证据",
            contentRef: "https://example.test/evidence",
            recordedAt: "2026-10-14T08:00:00.000Z",
          },
        ]
      : [],
    currencyOptions: richDraftRefresh
      ? [{ code: "CAD", name: "Canadian Dollar", minorUnit: 2 }]
      : [],
  };
}

function formalInitiative() {
  return {
    initiativeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    outcome: "approve",
    completion: "pending_completion",
    currentDestination: "needs_decision",
    responsibleActorId: "formal-owner",
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "正式资源承诺",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
    objective: null,
    reviewPoints: [
      {
        code: "target_user_and_market",
        evidenceRefs: [],
        conclusion: FORMAL_REVIEW_POINT,
      },
    ],
    businessCaseDraft: [],
    businessCaseSnapshot: null,
    riskAssessmentDraft: [],
    riskAssessmentSnapshot: null,
    reason: null,
    returnBasis: null,
    pendingFieldCodes: [],
    version: 3,
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-18T08:00:00.000Z",
  };
}

function savedDraft(command: Record<string, unknown>) {
  return {
    contractVersion: "product-initiative-decision-draft.v1",
    draftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    handoffId: HANDOFF,
    draftVersion: 1,
    initiativeVersionSeen: 0,
    objective: command.objective ?? null,
    reviewPoints: command.reviewPoints ?? [],
    businessCaseDraft: command.businessCaseDraft ?? [],
    riskAssessmentDraft: command.riskAssessmentDraft ?? [],
    unitEconomicsDraft: command.unitEconomicsDraft ?? null,
    negativeConservativeReason: command.negativeConservativeReason ?? null,
    createdAt: "2026-10-14T08:00:00.000Z",
    updatedAt: "2026-10-14T08:00:00.000Z",
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
        workOrders: [
          {
            id: OTHER_HANDOFF,
            workOrderDefinitionKey: "stuffing",
            state: "available",
            assignmentState: "pool",
            assigneeId: null,
            dueAt: null,
            completedAt: null,
          },
        ],
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
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-14T08:00:00.000Z",
    projectionVersion: 1,
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

async function expectSessionPanelFitsViewport(page: Page): Promise<void> {
  const metrics = await page
    .getByRole("dialog", { name: "工作现场切换" })
    .evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      return {
        clientWidth: panel.clientWidth,
        scrollWidth: panel.scrollWidth,
        left: rect.left,
        right: rect.right,
        viewportWidth: window.innerWidth,
      };
    });
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

interface ProductSelectionHoldState {
  url: string;
  subjectRef: WorkSessionV1["subjectRef"];
  taskRef: WorkSessionV1["taskRef"];
  activeItemKey: string | null | undefined;
  contextMode: string | null | undefined;
  currentCount: number;
  currentSessionId: string;
  typedInput: string;
  objectText: string;
  activeItemText: string;
  visibleContextMode: string | null;
}

async function productSelectionHoldState(
  page: Page,
): Promise<ProductSelectionHoldState> {
  const server = await page.evaluate(async () => {
    const response = await fetch(
      "/api/work-sessions?pageSize=100&includeClosed=true",
    );
    return response.json();
  });
  const current = (server.items as WorkSessionV1[]).filter(
    ({ status }) => status === "current",
  );
  const source = current[0]!;
  return {
    url: page.url(),
    subjectRef: source.subjectRef,
    taskRef: source.taskRef,
    activeItemKey: source.activeItemKey,
    contextMode: source.contextMode,
    currentCount: current.length,
    currentSessionId: source.sessionId,
    typedInput: await page.getByLabel("目标结果").inputValue(),
    objectText: await page
      .getByRole("region", { name: "岗位、对象与责任上下文" })
      .innerText(),
    activeItemText: await page
      .getByRole("navigation", { name: "立项缺口导航" })
      .locator('[aria-current="step"]')
      .innerText(),
    visibleContextMode: await page
      .locator('.workbench-layout__mobile-nav [aria-current="step"]')
      .getAttribute("data-mobile-target"),
  };
}

async function expectProductSelectionHoldState(
  page: Page,
  before: ProductSelectionHoldState,
): Promise<void> {
  expect(await productSelectionHoldState(page)).toEqual(before);
  expect(before).toMatchObject({
    subjectRef: { kind: "product_initiative_handoff", id: HANDOFF },
    taskRef: null,
    activeItemKey: "objective",
    contextMode: "context",
    currentCount: 1,
    currentSessionId: SELECTION_SESSION,
    typedInput: "尚未保存的目标结果",
    visibleContextMode: "context",
  });
  expect(before.objectText).toContain("宠物出行品类");
  expect(before.activeItemText).toContain("责任与资源");
}

async function openDirtyProductSelection(page: Page): Promise<string> {
  await page.goto(`/workspaces/product-selection?handoffId=${HANDOFF}`);
  if ((page.viewportSize()?.width ?? 0) < 681) {
    await page.getByRole("button", { name: "编辑", exact: true }).click();
  }
  await page.getByLabel("目标结果").fill("尚未保存的目标结果");
  await page.getByRole("button", { name: "切换工作现场" }).click();
  return page.url();
}

async function chooseStuffingAndSave(page: Page): Promise<void> {
  await page.locator(`[data-session="${STUFFING_SESSION}"]`).click();
  await page.getByText("保存领域草稿并切换", { exact: true }).click();
}

async function expectUniqueCurrent(
  page: Page,
  sessionId: string,
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "工作现场切换" });
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(dialog.locator(`[data-session="${sessionId}"]`)).toHaveAttribute(
    "aria-current",
    "true",
  );
}
