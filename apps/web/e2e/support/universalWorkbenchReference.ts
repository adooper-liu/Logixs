import { expect, type Page } from "@playwright/test";

export const referencePath = "/__reference/universal-workbench";
export const screenshotOptions = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.03,
  scale: "css" as const,
};

export interface LayoutEvidence {
  page: { client: number; scroll: number };
  content: { client: number; scroll: number };
  panes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    client: number;
    scroll: number;
  }>;
}

export async function captureLayout(page: Page): Promise<LayoutEvidence> {
  return page.evaluate(() => {
    const appContent = document.querySelector<HTMLElement>(".app-content");
    const panes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-workbench-pane]"),
    ).map((pane) => {
      const box = pane.getBoundingClientRect();
      return {
        id: pane.dataset.workbenchPane ?? "",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        client: pane.clientWidth,
        scroll: pane.scrollWidth,
      };
    });
    return {
      page: {
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      },
      content: {
        client: appContent?.clientWidth ?? 0,
        scroll: appContent?.scrollWidth ?? 0,
      },
      panes,
    };
  });
}

export async function expectNoWorkbenchOverflow(page: Page): Promise<void> {
  const evidence = await captureLayout(page);
  expect(evidence.page.scroll).toBeLessThanOrEqual(evidence.page.client + 1);
  expect(evidence.content.scroll).toBeLessThanOrEqual(
    evidence.content.client + 1,
  );
  for (const pane of evidence.panes) {
    expect(pane.scroll, `${pane.id} overflow`).toBeLessThanOrEqual(
      pane.client + 1,
    );
  }
}

export async function expectStandardRegions(page: Page): Promise<void> {
  for (const label of [
    "岗位、对象与责任上下文",
    "当前结论与办理缺口",
    "对象与任务队列",
    "事实、缺口与推进任务",
    "当前事项操作上下文",
  ]) {
    await expect(page.locator(`[aria-label="${label}"]`)).toHaveCount(1);
  }
}
