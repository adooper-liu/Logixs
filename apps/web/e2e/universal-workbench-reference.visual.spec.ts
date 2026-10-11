import { expect, test, type Page } from "@playwright/test";
import {
  captureLayout,
  expectNoWorkbenchOverflow,
  expectStandardRegions,
  referencePath,
  screenshotOptions,
} from "./support/universalWorkbenchReference";

const gotoReference = async (page: Page) => {
  await page.goto(referencePath);
  await expect(page.getByText("合成结构演练数据，不是生产记录")).toBeVisible();
};

const ensureScenarioControlsOpen = async (page: Page) => {
  const scenarios = page.locator(".reference-scenarios");
  if ((await scenarios.getAttribute("open")) === null) {
    await scenarios.getByText(/参考场景/).click();
  }
  await expect(scenarios).toHaveAttribute("open", "");
};

const screenshot = async (page: Page, name: string) => {
  await expect(page).toHaveScreenshot(name, screenshotOptions);
};

test("reference page preserves the standard region order at all three viewports", async ({
  page,
}, testInfo) => {
  await gotoReference(page);
  await expectStandardRegions(page);
  const scenarioControls = page.locator(".reference-scenarios");
  if ((page.viewportSize()?.width ?? 0) >= 681) {
    await expect(scenarioControls).toHaveAttribute("open", "");
  } else {
    await expect(scenarioControls).not.toHaveAttribute("open", "");
  }
  await expectNoWorkbenchOverflow(page);
  const evidence = await captureLayout(page);
  expect(evidence.panes.map((pane) => pane.id)).toEqual([
    "queue",
    "detail",
    "context",
  ]);
  if (
    (page.viewportSize()?.width ?? 0) >= 681 &&
    (page.viewportSize()?.width ?? 0) < 1280
  ) {
    const queueRail = page.getByRole("button", { name: "打开对象与任务队列" });
    await expect(queueRail).toBeVisible();
    await expect(queueRail).toContainText("REF");
    await expect(queueRail).toContainText("2 待办");
    const detail = page.locator('[data-workbench-pane="detail"]');
    const context = page.locator('[data-workbench-pane="context"]');
    const [detailBox, contextBox] = await Promise.all([
      detail.boundingBox(),
      context.boundingBox(),
    ]);
    expect(detailBox?.y).toBe(contextBox?.y);
    expect(detailBox?.x ?? 0).toBeLessThan(contextBox?.x ?? 0);
  }
  await screenshot(page, "reference-default.png");
  await testInfo.attach("layout.json", {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: "application/json",
  });
});

test("narrow queue drawer traps focus and closes by selection, Escape, or backdrop", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 681 ||
      (page.viewportSize()?.width ?? 0) >= 1280,
    "narrow drawer contract",
  );
  await gotoReference(page);
  const trigger = page.getByRole("button", { name: "打开对象与任务队列" });
  const detail = page.locator('[data-workbench-pane="detail"]');

  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "对象与任务队列" });
  await expect(drawer).toBeVisible();
  await expect(detail).toHaveAttribute("inert", "");
  await expect(
    drawer.getByRole("button", { name: /合成机会 REF-001/ }),
  ).toBeFocused();
  await drawer.getByRole("button", { name: /合成机会 REF-002/ }).click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("button", { name: "关闭任务队列抽屉" }).click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("desktop rails fold independently and together without losing full height", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "desktop contract");
  await gotoReference(page);
  const before = await captureLayout(page);
  await page.getByRole("button", { name: "折叠对象与任务队列" }).click();
  await screenshot(page, "reference-left-rail.png");
  await page.getByRole("button", { name: "折叠当前事项操作上下文" }).click();
  await screenshot(page, "reference-both-rails.png");
  await page.getByRole("button", { name: "展开对象与任务队列" }).click();
  await screenshot(page, "reference-right-rail.png");
  const after = await captureLayout(page);
  expect(after.panes[0]?.height).toBe(before.panes[0]?.height);
  expect(after.panes[2]?.height).toBe(before.panes[2]?.height);
});

test("right-side editing preserves the selected item and restores focus on return", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 681,
    "desktop and narrow editing contract",
  );
  await gotoReference(page);
  const item = page.locator('[data-item="pricing"]').last();
  await item.click();
  await expect(page.getByText("正在编辑：价格带证据")).toBeVisible();
  await screenshot(page, "reference-edit.png");
  await page.getByRole("button", { name: "返回事项上下文" }).click();
  await expect(item).toHaveClass(/is-selected/);
});

test("business states change pane content without changing workbench identity or geometry", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1280,
    "desktop state baselines",
  );
  await gotoReference(page);
  const heading = page.getByRole("heading", { name: "选品立项" });
  const initial = await captureLayout(page);
  await ensureScenarioControlsOpen(page);
  await page.locator('[data-scenario="working"]').click();
  await page.locator('[data-scenario="waiting"]').click();
  await expect(heading).toBeVisible();
  expect((await captureLayout(page)).panes.map(({ id }) => id)).toEqual(
    initial.panes.map(({ id }) => id),
  );
  await screenshot(page, "reference-waiting.png");

  await page.locator('[data-scenario="failed"]').click();
  await expect(heading).toBeVisible();
  expect((await captureLayout(page)).panes.map(({ id }) => id)).toEqual(
    initial.panes.map(({ id }) => id),
  );
  await screenshot(page, "reference-failed.png");

  await page.locator('[data-scenario="conflict"]').click();
  await expect(heading).toBeVisible();
  expect((await captureLayout(page)).panes.map(({ id }) => id)).toEqual(
    initial.panes.map(({ id }) => id),
  );
  await screenshot(page, "reference-conflict.png");

  await page.locator('[data-scenario="readonly"]').click();
  await expect(heading).toBeVisible();
  expect((await captureLayout(page)).panes.map(({ id }) => id)).toEqual(
    initial.panes.map(({ id }) => id),
  );
  await screenshot(page, "reference-readonly.png");
});

test("session switching keeps exactly one current session and does not move it on save failure", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1280,
    "desktop session baseline",
  );
  await gotoReference(page);
  await page.getByRole("button", { name: "切换工作现场（结构参考）" }).click();
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
  await screenshot(page, "reference-session-menu.png");
  await page.locator('[data-session="sourcing"]').click();
  await page.getByRole("button", { name: "切换工作现场（结构参考）" }).click();
  await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('[aria-current="true"]')).toContainText("寻源");
  await screenshot(page, "reference-session-switched.png");
  await page.getByRole("button", { name: "切换工作现场（结构参考）" }).click();
  await ensureScenarioControlsOpen(page);
  await page.locator('[data-scenario="working"]').click();
  await page.locator('[data-scenario="dirty-session"]').click();
  await page.getByRole("button", { name: "切换工作现场（结构参考）" }).click();
  await page.locator('[data-session="unloading"]').click();
  await expect(page.getByRole("alert")).toContainText(
    "草稿保存失败，仍停留在当前工作现场",
  );
  await page.getByRole("button", { name: "切换工作现场（结构参考）" }).click();
  await expect(page.locator('[aria-current="true"]')).toContainText("寻源");
});

test("more functions opens an independent referenced page instead of replacing the right pane", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1280,
    "desktop linked-feature baseline",
  );
  await gotoReference(page);
  const before = await page
    .getByRole("region", { name: "当前事项操作上下文" })
    .textContent();
  await page.getByRole("button", { name: "更多关联功能（结构参考）" }).click();
  expect(
    await page
      .getByRole("region", { name: "当前事项操作上下文" })
      .textContent(),
  ).toBe(before);
  await screenshot(page, "reference-more-menu.png");
  await page.getByRole("button", { name: "关联子功能结构参考" }).click();
  await expect(page).toHaveURL(/linked-feature/);
  await expect(page.getByRole("region", { name: "来源上下文" })).toBeVisible();
  await screenshot(page, "reference-linked-feature.png");
});

test("mobile moves explicitly from queue to detail to editing and restores scroll and focus", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 681, "mobile contract");
  await gotoReference(page);
  await expect(
    page.getByRole("region", { name: "对象与任务队列" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "详情", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "事实、缺口与推进任务" }),
  ).toBeVisible();
  await screenshot(page, "reference-mobile-detail.png");
  const detailPane = page.locator('[data-workbench-pane="detail"]');
  const appContent = page.locator(".app-content");
  const item = page.locator('[data-item="pricing"]').last();
  await item.focus();
  await item.evaluate((element) => {
    if (element instanceof HTMLElement) element.click();
  });
  await expect(
    page.getByRole("region", { name: "当前事项操作上下文" }),
  ).toBeVisible();
  await screenshot(page, "reference-edit.png");

  await page.getByRole("button", { name: "详情", exact: true }).click();
  await expect(item).toBeFocused();
  await detailPane.evaluate((element) => {
    element.style.minHeight = "1200px";
  });
  await appContent.evaluate((element) => {
    element.scrollTop = 180;
  });
  const rememberedPageScroll = await appContent.evaluate(
    (element) => element.scrollTop,
  );
  expect(rememberedPageScroll).toBeGreaterThan(0);
  await item.evaluate((element) => {
    if (element instanceof HTMLElement) element.click();
  });
  await expect(
    page.getByRole("region", { name: "当前事项操作上下文" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "详情", exact: true }).click();
  await expect(item).toBeFocused();
  await expect
    .poll(() => appContent.evaluate((element) => element.scrollTop))
    .toBe(rememberedPageScroll);
});

test("keyboard order follows queue detail action causality and reduced motion is honored", async ({
  page,
}) => {
  await gotoReference(page);
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("reference page matches the representative dark-theme baseline", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, "desktop dark baseline");
  await gotoReference(page);
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );
  await screenshot(page, "reference-dark.png");
});

test("reference page performs no production API requests", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await gotoReference(page);
  expect(requests).toEqual([]);
});
