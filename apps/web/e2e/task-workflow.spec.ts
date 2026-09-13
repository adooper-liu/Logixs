import { expect, test } from "@playwright/test";

test("unknown container record does not invent a linked task", async ({
  page,
}) => {
  await page.goto("/container/missing-container");
  await expect(page.getByText("加载中…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/找不到这只货柜|货柜没能加载/)).toBeVisible();
  await expect(page.getByText("进入关联任务")).toHaveCount(0);
  await expect(page.getByText("确认实际离港时间")).toHaveCount(0);
});

test("task workbench loads from the live API without demo titles", async ({
  page,
}) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "我的任务" })).toBeVisible();
  await expect(page.getByText("加载中…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("确认实际离港时间")).toHaveCount(0);
  await expect(page.getByText("卸柜并核对实收数量")).toHaveCount(0);
  await expect(page.getByText("candidate_submit_unload_result")).toHaveCount(0);
});
