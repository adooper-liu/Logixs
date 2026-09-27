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
