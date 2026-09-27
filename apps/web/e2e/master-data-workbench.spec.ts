import { expect, test } from "@playwright/test";

/**
 * 4 号节点「商品与物料主数据工作台」的岗位动线：
 * 看见待建档的产品设计 → 建立产品与 SKU 身份 → 发布交给寻源侧。
 *
 * 断言的是**业务结果**（下游能不能引用到它），不是接口被调过没有。
 */
test("master data owner builds a product identity and releases it", async ({
  page,
}) => {
  let identity: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/product-identities/queue") {
      await route.fulfill({
        json: {
          contractVersion: "product-identity-queue.v1",
          items: [
            {
              releaseId: "release-1",
              definitionId: "definition-1",
              specification: "40HC 折叠宠物推车",
              npiStage: "mp",
              releasedBy: "product-owner",
              releasedAt: "2026-09-27T10:00:00.000Z",
              productId: identity ? "product-1" : null,
              productNumber: identity ? "PET-01" : null,
            },
          ],
          pageSize: 200,
          nextCursor: null,
        },
      });
      return;
    }
    if (path === "/api/product-identities/release-1") {
      await route.fulfill({ json: identity });
      return;
    }
    if (
      path === "/api/product-identities/release-1/drafts" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      identity = {
        contractVersion: "product-identity.v1",
        productId: "product-1",
        productNumber: String(body.productNumber ?? "P-DEADBEEF"),
        sourceHandoffId: "release-1",
        version: 1,
        specification: "40HC 折叠宠物推车",
        attributes: body.attributes,
        skus: (body.skus as { skuCode: string; attributes: unknown }[]).map(
          (sku, index) => ({
            skuId: `sku-${index + 1}`,
            skuCode: sku.skuCode,
            attributes: sku.attributes,
          }),
        ),
        pendingFieldCodes: ["bom", "listing"],
        createdAt: "2026-09-28T10:00:00.000Z",
        updatedAt: "2026-09-28T10:00:00.000Z",
      };
      await route.fulfill({ json: identity });
      return;
    }
    if (
      path === "/api/product-identities/release-1/releases" &&
      request.method() === "POST"
    ) {
      identity = { ...(identity as object), version: 2 } as Record<
        string,
        unknown
      >;
      await route.fulfill({ json: identity });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  await page.goto("/workspaces/master-data");

  // 首屏先回答"为什么现在处理"：这一票还没建档。
  await expect(page.getByText("等我建档")).toBeVisible();
  // 默认落在待建档的第一条上，右栏把头也换成它。
  await expect(
    page.getByRole("heading", { name: "40HC 折叠宠物推车" }),
  ).toBeVisible();

  // 发布前差什么是**逐项**说的，不是一句"还不能发布"。
  await expect(page.getByText("发布前还差什么")).toBeVisible();
  await expect(page.locator(".pending li").first()).toBeVisible();

  await page.getByLabel("对外产品号").fill("PET-01");
  await page.getByLabel("品类").fill("pet_travel");
  await page.getByLabel("功能名").fill("折叠宠物推车");
  await page.getByLabel("原产国").fill("CN");
  await page.getByLabel("HS 编码").fill("8716800000");
  await page.getByLabel("目标销售国家").fill("US, CA");
  await page.getByLabel("SKU 编号 1").fill("SKU-PET-01-RED");

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(/已保存（第 1 版）/)).toBeVisible();

  await page.getByRole("button", { name: "发布可售 SKU" }).click();

  // 发布之后这一票归到"已建档"，并带上对外产品号。
  await expect(
    page.getByText(/已发布，产品与 SKU 身份已交给寻源侧/),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "已建档" })).toBeVisible();
  await expect(page.getByText("PET-01").first()).toBeVisible();
});
