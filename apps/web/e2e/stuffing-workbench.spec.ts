import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Synthetic, controlled E2E fixture data. It is not a real business sample.
const contextFixture = {
  actorId: "99999999-9999-4999-8999-999999999999",
  containerA: "11111111-1111-4111-8111-111111111111",
  taskA: "21111111-1111-4111-8111-111111111111",
  workOrderA: "31111111-1111-4111-8111-111111111111",
  candidateA: "41111111-1111-4111-8111-111111111111",
  containerB: "12222222-2222-4222-8222-222222222222",
  taskB: "22222222-2222-4222-8222-222222222222",
  workOrderB: "32222222-2222-4222-8222-222222222222",
  candidateB: "42222222-2222-4222-8222-222222222222",
  containerC: "13333333-3333-4333-8333-333333333333",
  taskC: "23333333-3333-4333-8333-333333333333",
  workOrderC: "33333333-3333-4333-8333-333333333333",
  containerD: "14444444-4444-4444-8444-444444444444",
  containerE: "15555555-5555-4555-8555-555555555555",
  containerF: "16666666-6666-4666-8666-666666666666",
  taskF: "26666666-6666-4666-8666-666666666666",
  workOrderF: "36666666-6666-4666-8666-666666666666",
  containerG: "17777777-7777-4777-8777-777777777777",
  taskG: "27777777-7777-4777-8777-777777777777",
  workOrderG: "37777777-7777-4777-8777-777777777777",
} as const;

const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
  threshold: 0.3,
};

interface ContextFixtureControl {
  archiveRequests: Array<{ containerId: string }>;
  collaborationRequests: Array<{
    taskId: string;
    subjectKind: string | null;
    subjectId: string | null;
  }>;
  aiRequests: Array<{ taskId: string; body: Record<string, unknown> }>;
  confirmations: Record<string, unknown>[];
  directClaims: number;
  directCompletions: number;
  directActions: Array<{
    action: "claim" | "complete";
    workOrderId: string;
    body: Record<string, unknown>;
  }>;
  snapshotPosts: number;
  dateFactPosts: number;
  holdNextContainerA(): void;
  waitForHeldContainerA(): Promise<void>;
  releaseContainerA(): void;
}

test("stuffing reuses the shared four-mode context without losing its professional draft", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "context baseline runs once");
  const control = await installTaskContextFixture(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerA}&taskId=${contextFixture.taskA}`,
  );
  await expect(
    page.getByRole("heading", { name: "装箱", exact: true }),
  ).toBeVisible();
  const modeNav = page.getByLabel("任务上下文模式");
  await expect(modeNav.getByRole("button")).toHaveText([
    "办理",
    "档案",
    "协作",
    "AI 辅助",
  ]);
  await expect(page.getByLabel("当前装箱任务上下文")).toContainText(
    "CTX-STUFF-A",
  );
  await expect(page.getByLabel("当前装箱任务上下文")).toContainText("装箱任务");
  await expect(page.getByLabel("当前装箱任务上下文")).toContainText("待领取");

  const sealNumber = page.getByLabel("封号");
  await sealNumber.fill("DIRTY-SEAL-A");
  await sealNumber.focus();
  const contextScrollOwner = page
    .locator('[data-workbench-pane="context"]')
    .locator(".workbench-pane__scroll--independent");
  const workScroll = await contextScrollOwner.evaluate((element) => {
    const target = element as HTMLElement;
    target.scrollTop = Math.min(72, target.scrollHeight - target.clientHeight);
    return target.scrollTop;
  });

  for (const mode of ["档案", "协作", "AI 辅助"] as const) {
    const button = page.getByRole("button", { name: mode, exact: true });
    await button.dispatchEvent("pointerdown");
    await button.click();
  }
  await expect(page.getByText("建议领取当前装箱工单")).toBeVisible();
  await expect(page.getByText("未采信，不改变任务状态")).toBeVisible();
  await expect(
    page
      .locator('[data-ai-spine-step="source"]')
      .locator(".task-ai__reference"),
  ).toHaveText("task.claim-assistance / v1");
  await expect(page.getByText("影响与风险", { exact: true })).toBeVisible();
  await expect(
    page.getByText("领取不会生成装箱快照、VGM、实际完成或生命周期过站。"),
  ).toBeVisible();
  await expect(page.getByText("风险等级：低", { exact: true })).toBeVisible();
  await expect(
    page.getByText(`当前领取工单 ${contextFixture.workOrderA}`),
  ).toBeVisible();
  expect(control.directClaims).toBe(0);
  expect(control.archiveRequests).toContainEqual({
    containerId: contextFixture.containerA,
  });
  expect(control.collaborationRequests).toContainEqual({
    taskId: contextFixture.taskA,
    subjectKind: "container",
    subjectId: contextFixture.containerA,
  });
  expect(control.aiRequests.at(-1)).toEqual({
    taskId: contextFixture.taskA,
    body: {
      contractVersion: "task-action-candidate-generate.v1",
      subjectRef: { kind: "container", id: contextFixture.containerA },
      workRef: { kind: "node_task", id: contextFixture.taskA },
    },
  });

  await expectViewportStructure(page);
  await expectNoContextOverflow(page);
  await alignContextForScreenshot(page);
  await contextScrollOwner.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page).toHaveScreenshot("stuffing-task-context.png", {
    ...screenshotOptions,
  });

  await page.getByRole("button", { name: "办理", exact: true }).click();
  await expect(sealNumber).toHaveValue("DIRTY-SEAL-A");
  await expect(sealNumber).toBeFocused();
  if (workScroll > 0) {
    await expect
      .poll(() => contextScrollOwner.evaluate((element) => element.scrollTop))
      .toBe(workScroll);
  }

  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await page.getByTestId("ai-confirm").click();
  await expect(
    page.getByRole("button", { name: "办理", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(modeNav.getByRole("button")).toHaveText([
    "办理",
    "档案",
    "协作",
  ]);
  await expect(page.getByText("装箱办理", { exact: true })).toBeVisible();
  await expect(
    page.getByText("任务上下文 · AI 辅助", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("装箱工单领取回执")).toContainText(
    "WorkOrder 领取回执",
  );
  await expect(page.getByLabel("装箱工单领取回执")).toContainText(
    "不代表装箱快照、VGM、实际装箱或生命周期进度",
  );
  expect(control.confirmations).toHaveLength(1);
  expect(control.directClaims).toBe(0);
  await expect(sealNumber).toHaveValue("DIRTY-SEAL-A");
});

test("stuffing task context switches exact refs and fails closed at every boundary", async ({
  page,
}) => {
  test.skip(page.viewportSize()?.width !== 1440, "boundary matrix runs once");
  const control = await installTaskContextFixture(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerA}&taskId=${contextFixture.taskA}`,
  );
  await page.getByLabel("封号").fill("A-DRAFT-MUST-DISAPPEAR");
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await expect(
    page.getByText(`当前领取工单 ${contextFixture.workOrderA}`),
  ).toBeVisible();

  control.holdNextContainerA();
  await page.getByTestId("ai-confirm").click();
  await control.waitForHeldContainerA();
  await page
    .getByLabel("装箱任务列表")
    .locator("button.queue-item")
    .filter({ hasText: "CTX-STUFF-B" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${contextFixture.containerB}.*taskId=${contextFixture.taskB}`,
    ),
  );
  await expect(page.getByText("A-DRAFT-MUST-DISAPPEAR")).toHaveCount(0);
  await expect(page.getByLabel("当前装箱任务上下文")).toContainText(
    "CTX-STUFF-B",
  );
  control.releaseContainerA();
  await expect(
    page.getByRole("button", { name: "办理", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(`当前领取工单 ${contextFixture.workOrderA}`),
  ).toHaveCount(0);
  expect(control.snapshotPosts).toBe(0);
  expect(control.dateFactPosts).toBe(0);
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await expect(
    page.getByText(`当前领取工单 ${contextFixture.workOrderB}`),
  ).toBeVisible();
  expect(control.aiRequests.at(-1)).toMatchObject({
    taskId: contextFixture.taskB,
    body: {
      subjectRef: { kind: "container", id: contextFixture.containerB },
      workRef: { kind: "node_task", id: contextFixture.taskB },
    },
  });

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerA}&taskId=aaaaaaaa-0000-4000-8000-000000000000`,
  );
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveText(["办理"]);
  await expect(page.locator(".task-archive")).toHaveCount(0);

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerC}&taskId=${contextFixture.taskC}`,
  );
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveText(["办理", "档案", "协作"]);
  await expect(page.getByRole("button", { name: "AI 辅助" })).toHaveCount(0);

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerD}`,
  );
  await expect(page.getByText("历史事实只读", { exact: true })).toBeVisible();
  await expect(page.getByLabel("任务上下文模式")).toHaveCount(0);

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerE}`,
  );
  await expect(page.getByLabel("装箱结果表单")).toBeVisible();
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveText(["办理"]);
  await expect(page.locator(".task-archive")).toHaveCount(0);
});

test("stuffing direct work-order actions use exact endpoints, receipts, and retry identity", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()?.width !== 1440,
    "direct action matrix runs once",
  );
  const control = await installTaskContextFixture(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerB}&taskId=${contextFixture.taskB}`,
  );

  await page.getByRole("button", { name: "领取", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "使用原编号重试" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "使用原编号重试" }).click();
  await expect(page.getByLabel("本次操作记录")).toContainText("已领取");
  expect(control.directClaims).toBe(2);
  expect(
    control.directActions.slice(0, 2).map(({ workOrderId }) => workOrderId),
  ).toEqual([contextFixture.workOrderB, contextFixture.workOrderB]);
  expect(control.directActions[0]?.body.idempotencyKey).toBeTruthy();
  expect(control.directActions[1]?.body.idempotencyKey).toBe(
    control.directActions[0]?.body.idempotencyKey,
  );

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerC}&taskId=${contextFixture.taskC}`,
  );
  await page.getByRole("button", { name: "完成工单", exact: true }).click();
  await expect(page.getByLabel("本次操作记录")).toContainText("已入账");
  await expect(page.getByText("工单已落账。", { exact: true })).toBeVisible();
  expect(control.directCompletions).toBe(1);
  expect(control.directActions.at(-1)).toMatchObject({
    action: "complete",
    workOrderId: contextFixture.workOrderC,
    body: { evidenceRefs: ["synthetic-evidence-c"] },
  });
  expect(control.snapshotPosts).toBe(0);
  expect(control.dateFactPosts).toBe(0);

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerF}&taskId=${contextFixture.taskF}`,
  );
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveText(["办理", "档案", "协作"]);
  await expect(page.getByText("当前没有服务端允许的工单动作。")).toBeVisible();

  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerG}&taskId=${contextFixture.taskG}`,
  );
  await expect(
    page.getByLabel("任务上下文模式").getByRole("button"),
  ).toHaveText(["办理", "档案", "协作"]);
  await expect(page.getByText("当前没有服务端允许的工单动作。")).toBeVisible();
  await expect(page.locator(".task-command .task-action")).toHaveCount(0);
  expect(control.directActions).toHaveLength(3);
});

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
  await selectStandardConsumerTask(page);
  if (page.viewportSize()?.width === 390) {
    await page.locator('[data-mobile-target="context"]').click();
  }
  await expect(
    page.getByRole("heading", { name: "装箱", exact: true }),
  ).toBeVisible();
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
  if (page.viewportSize()?.width === 1024) {
    await expect(page.locator(".workbench-layout__narrow-queue")).toBeVisible();
    return;
  }
  await expect(page.locator(".queue-list")).toBeVisible();
  await expectSharedQueueScrollOwnership(page);
});

test("stuffing standard geometry keeps the desktop and narrow pane contract", async ({
  page,
}) => {
  const width = page.viewportSize()?.width;
  await installTaskContextFixture(page);

  test.skip(width === 390, "desktop and narrow geometry only");
  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerA}&taskId=${contextFixture.taskA}`,
  );
  await openAiProposal(page);
  await positionAiEvidenceForScreenshot(page);
  if (width === 1440) {
    await expectStandardDesktopGeometry(page);
    await expect(page).toHaveScreenshot("stuffing-standard-geometry.png", {
      animations: "disabled",
      scale: "css",
    });
    return;
  }

  expect(width).toBe(1024);
  await expectStandardNarrowGeometry(page);
  await expect(page).toHaveScreenshot("stuffing-standard-geometry.png", {
    animations: "disabled",
    scale: "css",
  });
});

test("stuffing standard geometry keeps the mobile queue screen", async ({
  page,
}, testInfo) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile geometry only");
  await installTaskContextFixture(page);
  await page.goto("/workspaces/stuffing");
  await expectMobileScreen(page, "queue");
  await expectGeometryScreenshot(page, testInfo, "mobile-queue-chromium");
});

test("stuffing standard geometry keeps the mobile detail screen", async ({
  page,
}, testInfo) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile geometry only");
  await installTaskContextFixture(page);
  await page.goto("/workspaces/stuffing");
  await page
    .getByLabel("装箱任务列表")
    .locator("button.queue-item")
    .filter({ hasText: "CTX-STUFF-A" })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `containerId=${contextFixture.containerA}.*taskId=${contextFixture.taskA}`,
    ),
  );
  await expectMobileScreen(page, "detail");
  await expectGeometryScreenshot(page, testInfo, "mobile-detail-chromium");
});

test("stuffing standard geometry keeps the mobile AI context screen", async ({
  page,
}, testInfo) => {
  test.skip(page.viewportSize()?.width !== 390, "mobile geometry only");
  const control = await installTaskContextFixture(page);
  await page.goto(
    `/workspaces/stuffing?containerId=${contextFixture.containerA}&taskId=${contextFixture.taskA}`,
  );
  await page.locator('[data-mobile-target="context"]').click();
  await expectMobileScreen(page, "context");
  await openAiProposal(page);
  await positionAiEvidenceForScreenshot(page);
  await expectGeometryScreenshot(page, testInfo, "mobile-context-chromium");
  expect(control.directClaims).toBe(0);
});

async function selectStandardConsumerTask(page: Page): Promise<void> {
  const width = page.viewportSize()?.width;
  if (width === 1024) {
    await page.locator(".workbench-layout__narrow-queue").click();
  }
  await page
    .getByLabel("装箱任务列表")
    .locator("button.queue-item")
    .first()
    .click();
}

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
  const width = page.viewportSize()?.width;
  if (width === 1024) {
    await page.locator(".workbench-layout__narrow-queue").click();
  }
  await page
    .getByLabel("装箱任务列表")
    .locator("button.queue-item")
    .first()
    .click();
  if (width === 390) {
    await page.locator('[data-mobile-target="context"]').click();
  }
  await expect(page.getByText("历史事实只读", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/来源：full-chain-sample · file_import/),
  ).toBeVisible();
  await expect(page.getByText("未创建装箱工单", { exact: true })).toBeVisible();
  if (width === 390) {
    await page.locator('[data-mobile-target="detail"]').click();
  }
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
  if (path === "/api/node-tasks/task-1/collaboration")
    return contextCollaborationPage("task-1", "container-1");
  if (path === "/api/containers/container-1/cargo") return cargo;
  if (path === "/api/containers/container-1/lifecycle-nodes")
    return lifecycleNodes;
  if (path === "/api/containers/container-1/activities")
    return contextActivityPage("container-1");
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
      workOrders: [
        {
          id: "work-1",
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

async function installTaskContextFixture(
  page: Page,
): Promise<ContextFixtureControl> {
  const taskStages: Record<string, ContextTaskStage> = {
    [contextFixture.taskA]: "claim",
    [contextFixture.taskB]: "claim",
    [contextFixture.taskC]: "complete",
    [contextFixture.taskF]: "no_action",
    [contextFixture.taskG]: "unknown",
  };
  let holdContainerA = false;
  let notifyContainerAHeld!: () => void;
  let releaseContainerA!: () => void;
  let containerAHeld = new Promise<void>((resolve) => {
    notifyContainerAHeld = resolve;
  });
  let containerARelease = new Promise<void>((resolve) => {
    releaseContainerA = resolve;
  });
  const control: ContextFixtureControl = {
    archiveRequests: [],
    collaborationRequests: [],
    aiRequests: [],
    confirmations: [],
    directClaims: 0,
    directCompletions: 0,
    directActions: [],
    snapshotPosts: 0,
    dateFactPosts: 0,
    holdNextContainerA() {
      holdContainerA = true;
      containerAHeld = new Promise<void>((resolve) => {
        notifyContainerAHeld = resolve;
      });
      containerARelease = new Promise<void>((resolve) => {
        releaseContainerA = resolve;
      });
    },
    waitForHeldContainerA: () => containerAHeld,
    releaseContainerA: () => releaseContainerA(),
  };

  await page.route(
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\//,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;

      if (path === "/api/containers") {
        await route.fulfill({
          json:
            url.searchParams.get("scope") === "active_stuffing_snapshot"
              ? contextContainerPage([contextFixture.containerD])
              : contextContainerPage([
                  contextFixture.containerA,
                  contextFixture.containerB,
                  contextFixture.containerC,
                  contextFixture.containerD,
                  contextFixture.containerE,
                  contextFixture.containerF,
                  contextFixture.containerG,
                ]),
        });
        return;
      }
      if (path === "/api/node-tasks") {
        await route.fulfill({
          json: contextTaskPage(
            taskStages,
            url.searchParams.get("containerId"),
          ),
        });
        return;
      }
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
        const body = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          json: {
            contractVersion: "work-session.v1",
            sessionId: "88888888-8888-4888-8888-888888888888",
            version: 1,
            status: "current",
            workbenchCode: body.workbenchCode,
            contextKey: "synthetic-stuffing-context",
            routeContext: body.routeContext,
            subjectRef: body.subjectRef,
            taskRef: body.taskRef,
            domainVersionSeen: body.domainVersionSeen,
            activeItemKey: body.activeItemKey,
            contextMode: body.contextMode,
            displaySummary: body.displaySummary,
            lastOpenedAt: "2026-10-21T08:00:00.000Z",
            createdAt: "2026-10-21T08:00:00.000Z",
            updatedAt: "2026-10-21T08:00:00.000Z",
          },
        });
        return;
      }

      const collaborationMatch = path.match(
        /^\/api\/node-tasks\/([^/]+)\/collaboration$/,
      );
      if (collaborationMatch?.[1]) {
        const taskId = decodeURIComponent(collaborationMatch[1]);
        const containerId = containerForContextTask(taskId);
        control.collaborationRequests.push({
          taskId,
          subjectKind: url.searchParams.get("subjectKind"),
          subjectId: url.searchParams.get("subjectId"),
        });
        await route.fulfill({
          json: contextCollaborationPage(taskId, containerId),
        });
        return;
      }

      const candidateMatch = path.match(
        /^\/api\/node-tasks\/([^/]+)\/ai\/action-candidates(?:\/([^/]+)\/confirmations)?$/,
      );
      if (candidateMatch?.[1]) {
        const taskId = decodeURIComponent(candidateMatch[1]);
        if (candidateMatch[2]) {
          const body = request.postDataJSON() as Record<string, unknown>;
          control.confirmations.push(body);
          taskStages[taskId] = "complete";
          await route.fulfill({
            json: contextConfirmResult(taskId, body),
          });
        } else {
          const body = request.postDataJSON() as Record<string, unknown>;
          control.aiRequests.push({ taskId, body });
          await route.fulfill({ json: contextCandidate(taskId, "proposed") });
        }
        return;
      }

      const directActionMatch = path.match(
        /^\/api\/work-orders\/([^/]+)\/(claim|complete)$/,
      );
      if (directActionMatch?.[1] && directActionMatch[2]) {
        const workOrderId = decodeURIComponent(directActionMatch[1]);
        const action = directActionMatch[2] as "claim" | "complete";
        const body = request.postDataJSON() as Record<string, unknown>;
        control.directActions.push({ action, workOrderId, body });
        if (action === "claim") {
          control.directClaims += 1;
          if (
            workOrderId === contextFixture.workOrderB &&
            control.directClaims === 1
          ) {
            await route.fulfill({
              status: 503,
              json: {
                code: "SYNTHETIC_TRANSIENT_FAILURE",
                message: "SYNTHETIC_TRANSIENT_FAILURE: retry this claim",
                retryable: true,
              },
            });
            return;
          }
          taskStages[contextFixture.taskB] = "complete";
          await route.fulfill({
            json: contextClaimResult(workOrderId, contextFixture.taskB, body),
          });
          return;
        }
        control.directCompletions += 1;
        taskStages[contextFixture.taskC] = "completed";
        await route.fulfill({
          json: contextCompleteResult(workOrderId, contextFixture.taskC, body),
        });
        return;
      }

      const containerId = contextContainerIdFrom(path);
      if (!containerId) {
        throw new Error(`Unhandled synthetic Stuffing API path: ${path}`);
      }
      if (path === `/api/containers/${containerId}`) {
        if (containerId === contextFixture.containerA && holdContainerA) {
          holdContainerA = false;
          notifyContainerAHeld();
          await containerARelease;
        }
        await route.fulfill({ json: contextContainer(containerId) });
        return;
      }
      if (path.endsWith("/cargo")) {
        await route.fulfill({ json: contextCargo(containerId) });
        return;
      }
      if (path.endsWith("/lifecycle-nodes")) {
        await route.fulfill({ json: contextLifecyclePage(containerId) });
        return;
      }
      if (path.endsWith("/stuffing-snapshot")) {
        if (request.method() === "POST") control.snapshotPosts += 1;
        await route.fulfill({
          json:
            containerId === contextFixture.containerD
              ? contextHistoricalSnapshot()
              : containerId === contextFixture.containerC
                ? contextCompletionSnapshot()
                : null,
        });
        return;
      }
      if (path.endsWith("/date-facts")) {
        if (request.method() === "POST") control.dateFactPosts += 1;
        await route.fulfill({
          json: {
            items: [],
            projectionVersion: 0,
            asOf: "2026-10-21T08:00:00.000Z",
          },
        });
        return;
      }
      if (path.endsWith("/activities")) {
        control.archiveRequests.push({ containerId });
        await route.fulfill({ json: contextActivityPage(containerId) });
        return;
      }
      throw new Error(`Unhandled synthetic Stuffing API path: ${path}`);
    },
  );
  return control;
}

function contextContainerIdFrom(path: string): string | null {
  const match = path.match(/^\/api\/containers\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function contextContainerPage(ids: readonly string[]) {
  return {
    items: ids.map(contextContainer),
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-21T08:00:00.000Z",
    projectionVersion: 1,
  };
}

function contextContainer(id: string) {
  const numbers: Record<string, string> = {
    [contextFixture.containerA]: "CTX-STUFF-A",
    [contextFixture.containerB]: "CTX-STUFF-B",
    [contextFixture.containerC]: "CTX-STUFF-C",
    [contextFixture.containerD]: "CTX-STUFF-D",
    [contextFixture.containerE]: "CTX-STUFF-E",
    [contextFixture.containerF]: "CTX-STUFF-F",
    [contextFixture.containerG]: "CTX-STUFF-G",
  };
  return {
    id,
    orderNumber: `SYNTHETIC-${numbers[id]}`,
    containerNumber: numbers[id],
    currentStatus: "not_shipped",
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
}

type ContextTaskStage =
  "claim" | "complete" | "completed" | "no_action" | "unknown";

function contextTaskPage(
  stages: Record<string, ContextTaskStage>,
  containerId: string | null,
) {
  const tasks = [
    contextTask(
      contextFixture.taskA,
      contextFixture.containerA,
      contextFixture.workOrderA,
      stages[contextFixture.taskA] ?? "claim",
    ),
    contextTask(
      contextFixture.taskB,
      contextFixture.containerB,
      contextFixture.workOrderB,
      stages[contextFixture.taskB] ?? "claim",
    ),
    contextTask(
      contextFixture.taskC,
      contextFixture.containerC,
      contextFixture.workOrderC,
      stages[contextFixture.taskC] ?? "complete",
    ),
    contextTask(
      contextFixture.taskF,
      contextFixture.containerF,
      contextFixture.workOrderF,
      stages[contextFixture.taskF] ?? "no_action",
    ),
    contextTask(
      contextFixture.taskG,
      contextFixture.containerG,
      contextFixture.workOrderG,
      stages[contextFixture.taskG] ?? "unknown",
    ),
  ];
  return {
    items: containerId
      ? tasks.filter((task) => task.containerId === containerId)
      : tasks,
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 100 },
    asOf: "2026-10-21T08:00:00.000Z",
    projectionVersion: 1,
  };
}

function contextTask(
  id: string,
  containerId: string,
  workOrderId: string,
  stage: ContextTaskStage,
) {
  const assigned = stage === "complete" || stage === "completed";
  const completed = stage === "completed";
  const actionCode =
    stage === "claim"
      ? "work_execution.claim_work_order"
      : stage === "complete"
        ? "work_execution.complete_work_order"
        : stage === "unknown"
          ? "work_execution.synthetic_unknown"
          : null;
  return {
    id,
    flowInstanceId: `${id}-flow`,
    nodeInstanceId: `${id}-node`,
    nodeCode: "container_stuffing",
    containerId,
    taskDefinitionKey: "node-container_stuffing",
    state: completed ? "completed" : assigned ? "in_progress" : "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [
      {
        id: workOrderId,
        workOrderDefinitionKey: "stuffing",
        state: completed ? "completed" : assigned ? "in_progress" : "available",
        assignmentState: assigned ? "assigned" : "pool",
        assigneeId: assigned ? contextFixture.actorId : null,
        dueAt: "2026-10-22T08:00:00.000Z",
        completedAt: completed ? "2026-10-21T08:03:00.000Z" : null,
      },
    ],
    outcome: null,
    nextAction: actionCode
      ? {
          actionCode,
          workOrderId,
          workOrderDefinitionKey: "stuffing",
          assignmentState: assigned ? "assigned" : "pool",
          assigneeId: assigned ? contextFixture.actorId : null,
          dueAt: "2026-10-22T08:00:00.000Z",
        }
      : null,
  };
}

function containerForContextTask(taskId: string): string {
  if (taskId === contextFixture.taskA) return contextFixture.containerA;
  if (taskId === contextFixture.taskB) return contextFixture.containerB;
  if (taskId === contextFixture.taskC) return contextFixture.containerC;
  if (taskId === contextFixture.taskF) return contextFixture.containerF;
  if (taskId === contextFixture.taskG) return contextFixture.containerG;
  throw new Error(`Unknown synthetic Stuffing task: ${taskId}`);
}

function workOrderForContextTask(taskId: string): string {
  if (taskId === contextFixture.taskA) return contextFixture.workOrderA;
  if (taskId === contextFixture.taskB) return contextFixture.workOrderB;
  if (taskId === contextFixture.taskC) return contextFixture.workOrderC;
  if (taskId === contextFixture.taskF) return contextFixture.workOrderF;
  if (taskId === contextFixture.taskG) return contextFixture.workOrderG;
  throw new Error(`Unknown synthetic Stuffing task: ${taskId}`);
}

function candidateForContextTask(taskId: string): string {
  return taskId === contextFixture.taskB
    ? contextFixture.candidateB
    : contextFixture.candidateA;
}

function contextCandidate(taskId: string, status: "proposed" | "accepted") {
  const containerId = containerForContextTask(taskId);
  const workOrderId = workOrderForContextTask(taskId);
  return {
    candidateId: candidateForContextTask(taskId),
    candidateHash: `synthetic-candidate-${taskId}`,
    context: {
      subjectRef: { kind: "container", id: containerId },
      workRef: { kind: "node_task", id: taskId },
    },
    workOrderId,
    actionCode: "work_execution.claim_work_order",
    actionVersion: 1,
    title: "建议领取当前装箱工单",
    rationale: "当前装箱任务处于共享池，领取后只建立工单责任。",
    impact: "领取不会生成装箱快照、VGM、实际完成或生命周期过站。",
    riskLevel: "low",
    warningCodes: [],
    status,
    source: {
      kind: "rule",
      capabilityId: "task.claim-assistance",
      capabilityVersion: 1,
      schemaVersion: 1,
      promptVersion: null,
      modelId: null,
      inputSnapshotHash: `synthetic-snapshot-${taskId}`,
      inputRefs: [
        { kind: "container", id: containerId, version: 1 },
        { kind: "node_task", id: taskId, version: 1 },
      ],
      generatedAt: "2026-10-21T08:00:00.000Z",
    },
  };
}

function contextConfirmResult(
  taskId: string,
  command: Record<string, unknown>,
) {
  const candidateId = candidateForContextTask(taskId);
  const workOrderId = workOrderForContextTask(taskId);
  return {
    contractVersion: "task-action-candidate-confirm-result.v1",
    candidate: contextCandidate(taskId, "accepted"),
    decision: {
      decisionId: "51111111-1111-4111-8111-111111111111",
      candidateId,
      decidedByActorId: contextFixture.actorId,
      decision: "accepted",
      reason: null,
      idempotencyKey: command.idempotencyKey,
      decidedAt: "2026-10-21T08:01:00.000Z",
      clientOperationId: `synthetic-operation-${taskId}`,
      traceId: `synthetic-trace-${taskId}`,
      executionState: "applied",
      resultRefs: [],
    },
    claimWorkOrderResult: {
      workOrderId,
      workOrderState: "in_progress",
      assignmentState: "assigned",
      assigneeId: contextFixture.actorId,
      taskId,
      taskState: "in_progress",
      applied: true,
      clientOperationId: `synthetic-operation-${taskId}`,
      receptionState: "received",
      businessDecisionState: "accepted",
      commitState: "committed",
      rejectionReasonCode: null,
    },
    idempotencyReplay: false,
  };
}

function contextClaimResult(
  workOrderId: string,
  taskId: string,
  command: Record<string, unknown>,
) {
  return {
    workOrderId,
    workOrderState: "in_progress",
    assignmentState: "assigned",
    assigneeId: contextFixture.actorId,
    taskId,
    taskState: "in_progress",
    applied: true,
    clientOperationId: String(command.idempotencyKey),
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
  };
}

function contextCompleteResult(
  workOrderId: string,
  taskId: string,
  command: Record<string, unknown>,
) {
  return {
    workOrderId,
    workOrderState: "completed",
    taskId,
    taskState: "completed",
    applied: true,
    outcomeRecorded: true,
    lifecycleApply: "applied",
    lifecycleEventCode: "stuffed",
    lifecycleDetail: "synthetic completion",
    activatedNodeCode: null,
    activatedNodeTaskId: null,
    clientOperationId: String(command.idempotencyKey),
    receptionState: "received",
    businessDecisionState: "accepted",
    commitState: "committed",
    rejectionReasonCode: null,
  };
}

function contextActivityPage(containerId: string) {
  const taskId =
    containerId === contextFixture.containerB
      ? contextFixture.taskB
      : containerId === contextFixture.containerC
        ? contextFixture.taskC
        : contextFixture.taskA;
  const workOrderId = workOrderForContextTask(taskId);
  return {
    items: [
      {
        id: `synthetic-activity-${containerId}`,
        activityCode: "work_order_available",
        sourceType: "work_order",
        sourceId: workOrderId,
        occurredAt: "2026-10-21T07:59:00.000Z",
        recordedAt: "2026-10-21T08:00:00.000Z",
        containerId,
        taskId,
        workOrderId,
        actorId: null,
        nodeCode: "container_stuffing",
        title: "装箱工单进入共享池",
        detail: "合成演练档案，不代表真实业务记录。",
        severity: "info",
        targetPath: `/workspaces/stuffing?containerId=${containerId}&taskId=${taskId}`,
      },
    ],
    nextActions: [],
    pageInfo: { nextCursor: null, hasNextPage: false, pageSize: 25 },
    asOf: "2026-10-21T08:00:00.000Z",
    projectionVersion: 1,
  };
}

function contextCollaborationPage(taskId: string, containerId: string) {
  return {
    contractVersion: "task-collaboration-page.v1",
    thread: null,
    subjectRef: { kind: "container", id: containerId },
    workRef: { kind: "node_task", id: taskId },
    visibility: "task_scope",
    visibilityLabel: "当前任务参与者",
    messages: [
      {
        contractVersion: "task-collaboration-message.v1",
        messageId:
          taskId === contextFixture.taskB
            ? "62222222-2222-4222-8222-222222222222"
            : "61111111-1111-4111-8111-111111111111",
        threadId: "69999999-9999-4999-8999-999999999999",
        author: {
          kind: "actor",
          id: contextFixture.actorId,
          displayName: "装箱经办",
        },
        body:
          taskId === contextFixture.taskB
            ? "合成演练：货柜 B 当前协作消息"
            : "合成演练：货柜 A 当前协作消息",
        parentMessageId: null,
        mentions: [],
        evidenceRefs: [],
        sourceRefs: [],
        occurredAt: "2026-10-21T08:00:00.000Z",
        recordedAt: "2026-10-21T08:00:01.000Z",
      },
    ],
    asOf: "2026-10-21T08:00:01.000Z",
    pageSize: 25,
    nextCursor: null,
    canPost: true,
    postDisabledReason: null,
    mentionOptions: [],
    evidenceOptions: [],
  };
}

function contextCargo(containerId: string) {
  return {
    containerRecordId: containerId,
    allocationSetId: `synthetic-allocation-${containerId}`,
    allocationSetVersion: 1,
    items: [
      {
        replenishmentOrderLineId: `synthetic-line-${containerId}`,
        productSkuId: `synthetic-sku-${containerId}`,
        productNumber: "SYNTHETIC-SKU-01",
        allocatedQuantity: "10",
        quantityUnit: "carton",
      },
    ],
  };
}

function contextLifecyclePage(containerId: string) {
  return {
    flow: {
      id: `synthetic-flow-${containerId}`,
      state: "active",
      currentNodeCode: "container_stuffing",
      version: 1,
    },
    nodes: [
      {
        nodeInstanceId: `synthetic-node-${containerId}`,
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
    asOf: "2026-10-21T08:00:00.000Z",
    projectionVersion: 1,
  };
}

function contextHistoricalSnapshot() {
  return {
    snapshotId: "74444444-4444-4444-8444-444444444444",
    containerRecordId: contextFixture.containerD,
    version: 1,
    allocationSetId: `synthetic-allocation-${contextFixture.containerD}`,
    allocationSetVersion: 1,
    containerNumber: "CTX-STUFF-D",
    sealNumber: "SYNTHETIC-D",
    packageCount: 10,
    grossWeight: "1000",
    grossWeightUnit: "KGM",
    netWeight: null,
    volume: "10",
    volumeUnit: "MTQ",
    vgm: null,
    ingestionChannel: "manual_ui",
    sourceSystem: "synthetic-e2e",
    evidenceRefs: [],
    actorId: contextFixture.actorId,
    reasonCode: "historical_stuffing_imported",
    createdAt: "2026-10-21T08:00:00.000Z",
    duplicate: false,
  };
}

function contextCompletionSnapshot() {
  return {
    ...contextHistoricalSnapshot(),
    snapshotId: "73333333-3333-4333-8333-333333333333",
    containerRecordId: contextFixture.containerC,
    containerNumber: "CTX-STUFF-C",
    sealNumber: "SYNTHETIC-C",
    evidenceRefs: ["synthetic-evidence-c"],
    reasonCode: "stuffing_confirmed",
  };
}

async function expectViewportStructure(page: Page): Promise<void> {
  await expect(page.locator('[data-workbench-pane="detail"]')).toBeAttached();
  await expect(page.locator('[data-workbench-pane="context"]')).toBeAttached();
  const panes = await page
    .locator("[data-workbench-pane]")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return {
          id: (item as HTMLElement).dataset.workbenchPane,
          x: Math.round(box.x),
          y: Math.round(box.y),
        };
      }),
    );
  const queue = panes.find(({ id }) => id === "queue")!;
  const detail = panes.find(({ id }) => id === "detail")!;
  const context = panes.find(({ id }) => id === "context")!;
  const width = page.viewportSize()?.width;
  if (width === 1440) {
    expect(queue.y).toBe(detail.y);
    expect(detail.y).toBe(context.y);
    expect(queue.x).toBeLessThan(detail.x);
    expect(detail.x).toBeLessThan(context.x);
  } else if (width === 1024) {
    await expect(page.locator(".workbench-layout__narrow-queue")).toBeVisible();
    expect(detail.y).toBe(context.y);
    expect(detail.x).toBeLessThan(context.x);
  } else {
    await expect(
      page.locator('[data-workbench-pane][data-mobile-active="true"]'),
    ).toHaveCount(1);
  }
}

async function expectStandardDesktopGeometry(page: Page): Promise<void> {
  await expectViewportStructure(page);
  const activePanes = await page
    .locator("[data-workbench-pane]")
    .evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        return {
          id: (item as HTMLElement).dataset.workbenchPane,
          x: Math.round(box.x),
          y: Math.round(box.y),
          height: Math.round(box.height),
        };
      }),
    );
  expect(activePanes.map(({ id }) => id)).toEqual([
    "queue",
    "detail",
    "context",
  ]);
  expect(new Set(activePanes.map(({ y }) => y)).size).toBe(1);
  expect(new Set(activePanes.map(({ height }) => height)).size).toBe(1);
}

async function expectStandardNarrowGeometry(page: Page): Promise<void> {
  await expectViewportStructure(page);
  await expect(page.locator('[data-workbench-pane="queue"]')).toBeHidden();
  await expect(page.locator('[data-workbench-pane="detail"]')).toBeVisible();
  await expect(page.locator('[data-workbench-pane="context"]')).toBeVisible();
  await expectNoContextOverflow(page);
}

async function expectMobileScreen(
  page: Page,
  screen: "queue" | "detail" | "context",
): Promise<void> {
  await expect(
    page.locator(
      `[data-workbench-pane="${screen}"][data-mobile-active="true"]`,
    ),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-workbench-pane][data-mobile-active="true"]'),
  ).toHaveCount(1);
  await expect(page.getByTestId("stuffing-mobile-breadcrumb")).toContainText(
    "装箱任务",
  );
}

async function expectNoContextOverflow(page: Page): Promise<void> {
  const facts = await page.evaluate(() => {
    const measure = (element: Element | null) => {
      const target = element as HTMLElement | null;
      return {
        client: target?.clientWidth ?? 0,
        scroll: target?.scrollWidth ?? 0,
      };
    };
    const context = document.querySelector('[data-workbench-pane="context"]');
    const nestedOwners = context
      ? Array.from(context.querySelectorAll<HTMLElement>(".task-context *"))
          .filter((element) => {
            const style = getComputedStyle(element);
            return (
              /auto|scroll/.test(style.overflowY) &&
              element.scrollHeight > element.clientHeight + 1
            );
          })
          .map((element) => element.className || element.tagName.toLowerCase())
      : [];
    return {
      document: measure(document.documentElement),
      app: measure(document.querySelector(".app-content")),
      panes: Array.from(document.querySelectorAll("[data-workbench-pane]")).map(
        (pane) => ({
          id: (pane as HTMLElement).dataset.workbenchPane,
          ...measure(pane),
        }),
      ),
      nestedOwners,
    };
  });
  expect(facts.document.scroll).toBeLessThanOrEqual(facts.document.client + 1);
  expect(facts.app.scroll).toBeLessThanOrEqual(facts.app.client + 1);
  for (const pane of facts.panes) {
    expect(pane.scroll, `${pane.id} horizontal overflow`).toBeLessThanOrEqual(
      pane.client + 1,
    );
  }
  expect(facts.nestedOwners).toEqual([]);
}

async function alignContextForScreenshot(page: Page): Promise<void> {
  if (page.viewportSize()?.width === 1440) return;
  await page.locator('[data-workbench-pane="context"]').evaluate((element) => {
    const owner = element.closest<HTMLElement>(".app-content");
    if (!owner) throw new Error("Missing app content scroll owner");
    owner.scrollTop +=
      element.getBoundingClientRect().top - owner.getBoundingClientRect().top;
  });
}

async function openAiProposal(page: Page): Promise<void> {
  await page.getByRole("button", { name: "AI 辅助", exact: true }).click();
  await expect(page.getByText("建议领取当前装箱工单")).toBeVisible();
  await expect(page.getByText("未采信，不改变任务状态")).toBeVisible();
  await expect(
    page.locator('[data-ai-spine-step="source"] .task-ai__reference'),
  ).toHaveText("task.claim-assistance / v1");
  await expect(page.getByText("影响与风险", { exact: true })).toBeVisible();
}

async function positionAiEvidenceForScreenshot(page: Page): Promise<void> {
  const unaccepted = page.getByText("未采信，不改变任务状态");
  const source = page.locator(
    '[data-ai-spine-step="source"] .task-ai__reference',
  );
  const risk = page.getByText("影响与风险", { exact: true });
  await risk.scrollIntoViewIfNeeded();
  await expect(unaccepted).toBeInViewport();
  await expect(source).toBeInViewport();
  await expect(risk).toBeInViewport();
}

async function expectGeometryScreenshot(
  page: Page,
  testInfo: TestInfo,
  snapshotProjectName: string,
): Promise<void> {
  // Playwright appends the project token; include the mobile state in that token
  // so the three required baselines keep their established filenames.
  const project = testInfo.project as { name: string };
  const projectName = project.name;
  project.name = snapshotProjectName;
  try {
    await expect(page).toHaveScreenshot("stuffing-standard-geometry.png", {
      animations: "disabled",
      scale: "css",
    });
  } finally {
    project.name = projectName;
  }
}
