import { expect, test } from "@playwright/test";

test("container detail never links to a task owned by another container", async ({
  page,
}) => {
  await page.goto("/container/cr_01J9LAX7K2D4");
  await page.getByRole("button", { name: /卸柜/ }).click();
  await expect(page.getByText("当前节点无可执行任务")).toBeVisible();

  await page.goto("/container/cr_01J9LAX8M5Q7");
  await page.getByRole("button", { name: /卸柜/ }).click();
  await page.getByRole("link", { name: "进入关联任务" }).click();
  await expect(page).toHaveURL(/task=task_1026/);
  await expect(page.getByText("TRLU-9912034", { exact: true })).toBeVisible();
});

test("employee completes unload and sees the container fact advance", async ({
  page,
}) => {
  await page.goto("/tasks?task=task_1026");
  await page.getByRole("button", { name: "领取任务" }).click();
  await page.getByRole("button", { name: "确认已领取" }).click();
  await page.getByPlaceholder(/输入或扫描/).fill("TRLU9912034");
  await page.getByTitle("核对扫描结果").click();
  await page.getByRole("button", { name: "确认完成" }).click();
  await page.getByRole("button", { name: "提交卸柜结果" }).click();
  await page.getByRole("button", { name: "确认执行" }).click();

  await expect(
    page.getByText("业务事件 unloaded 已落账，任务完成"),
  ).toBeVisible();
  const receipt = page.getByTestId("submission-progress");
  await expect(receipt).toContainText("服务器已收到");
  await expect(receipt).toContainText("业务已接受");
  await expect(receipt).toContainText("结果已落账");
  await expect(receipt).toContainText("提交卸柜结果");
  await receipt.getByRole("button", { name: "了解操作记录" }).click();
  await expect(page.getByRole("tooltip")).toContainText(
    "candidate_submit_unload_result",
  );
  await page.getByRole("link", { name: "查看一柜一档" }).click();
  await expect(
    page
      .getByRole("region", { name: "当前货柜上下文" })
      .getByText("已卸柜", { exact: true }),
  ).toBeVisible();
});
