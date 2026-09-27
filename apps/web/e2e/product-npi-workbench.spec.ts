import { expect, test } from "@playwright/test";

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

  await page.getByRole("button", { name: "领取此立项" }).click();

  // 接到自己名下：回执 + 队列分组跟着变。
  await expect(page.getByText(/已接到你名下/)).toBeVisible();
  await expect(page.getByText("我负责的")).toBeVisible();
  await expect(page.getByText("已由 dev-operator 负责")).toBeVisible();
});

function queue(claimed: boolean) {
  return {
    contractVersion: "product-initiative-npi-queue.v1",
    items: [
      {
        handoff: {
          contractVersion: "product_initiative_handoff.v1",
          handoffId: "handoff-1",
          version: 1,
          initiativeId: "11111111-1111-4111-8111-111111111111",
          signalId: "22222222-2222-4222-8222-222222222222",
          marketCode: "CA",
          userProblem: "宠物出行用品在加拿大复购低",
          objective: "宠物出行品类",
          responsibleActorId: "selector-1",
          reviewPoints: [
            {
              code: "target_user_and_market",
              evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
              conclusion: "加拿大养宠家庭",
            },
          ],
          evidenceRefs: [],
          createdAt: "2026-09-27T10:00:00.000Z",
          idempotencyKey: "handoff-1",
        },
        claim: claimed
          ? {
              claimId: "44444444-4444-4444-8444-444444444444",
              handoffId: "handoff-1",
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
