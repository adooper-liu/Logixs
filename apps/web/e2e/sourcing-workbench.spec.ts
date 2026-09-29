import { expect, test } from "@playwright/test";

/**
 * 5 号节点「寻源与供应商定点」的岗位动线：
 * 看见待寻源的可售 SKU → 登记供应商 → 录入报价 → 定点交给需求与补货侧。
 *
 * 断言的是**业务结果**（这一件定给谁了），不是接口被调过没有。
 */
test("sourcing owner collects a quotation and nominates the supplier", async ({
  page,
}) => {
  const suppliers: Record<string, unknown>[] = [];
  const quotations: Record<string, unknown>[] = [];
  let nominated: Record<string, unknown> | null = null;

  await page.route(/^http:\/\/localhost:5173\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/sourcing/queue") {
      await route.fulfill({
        json: {
          suppliers,
          entries: [entry({ suppliers, quotations, nominated })],
        },
      });
      return;
    }
    if (path === "/api/sourcing/suppliers" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      suppliers.push(
        supplier({
          name: String(body.name),
          admissionState: "pending",
          version: 1,
        }),
      );
      await route.fulfill({ json: suppliers[0] });
      return;
    }
    if (path.endsWith("/admit") && request.method() === "POST") {
      const current = suppliers[0];
      if (!current) {
        await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
        return;
      }
      current.admissionState = "admitted";
      current.version = Number(current.version) + 1;
      await route.fulfill({ json: current });
      return;
    }
    if (path.endsWith("/quotations") && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      quotations.push(
        quotation({
          priceTiers: body.priceTiers as { unitPrice: string }[],
          incoterms: String(body.incoterms),
          keyMaterials: body.keyMaterials as unknown[],
          exclusions: (body.exclusions as string | null) ?? null,
        }),
      );
      await route.fulfill({ json: quotations[0] });
      return;
    }
    if (path === "/api/sourcing/nominations" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      nominated = nomination({
        sampleConclusion: String(body.sampleConclusion),
        capacityConstraint: String(body.capacityConstraint),
      });
      await route.fulfill({ json: nominated });
      return;
    }
    await route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
  });

  await page.goto("/workspaces/sourcing");

  // 首屏先回答"为什么现在处理"：这一件还没人报价。
  // 面板标题是 h2「待寻源的可售 SKU」、分组标题是 h3「待寻源 N」——
  // 用标题层级分开，别靠文字（分组标题带着计数）。
  await expect(
    page.getByRole("heading", { level: 3, name: /待寻源/ }),
  ).toBeVisible();
  // 默认落在待寻源的第一件上，右栏把头也换成它。
  await expect(
    page.getByRole("heading", { name: "SKU-PET-01-RED" }),
  ).toBeVisible();
  // 同一句话在"本次结果"和右栏提示里各有一处，所以定位到提示那一处。
  await expect(
    page.getByText("还没有人报价。先在右栏登记供应商"),
  ).toBeVisible();

  // 登记供应商：默认待准入，国别必须手填。
  await page.getByLabel("供应商名称").fill("宁波某某塑胶");
  await page.getByLabel("供应商国别").fill("CN");
  await page.getByRole("button", { name: "登记", exact: true }).click();
  await expect(page.getByText(/已登记供应商（待准入）/)).toBeVisible();

  // 准入是独立动作；未准入不能定点。
  await page.getByRole("button", { name: "准入 宁波某某塑胶" }).click();
  await expect(page.getByText(/已准入供应商/)).toBeVisible();

  // 录入报价：十项 + **由供应商带入的关键物料**；币种/起订量/术语不预填。
  await page.getByLabel("报价的供应商").selectOption({ index: 1 });
  await page.getByLabel("单价").fill("18.5000");
  await page.getByLabel("币种").fill("USD");
  await page.getByLabel("起订量").fill("500");
  await page.getByLabel("贸易术语").fill("FOB Ningbo / Incoterms 2020");
  await page.getByLabel("模具费").fill("1200");
  await page.getByLabel("交期").fill("35");
  await page.getByLabel("关键物料名称").fill("改性 PP 粒子");
  await page.getByLabel("单件用量").fill("0.42");
  await page.getByLabel("损耗率").fill("3");
  await page.getByLabel("排除项").fill("不含目的港费用");
  await page.getByRole("button", { name: "录入这一家的报价" }).click();

  await expect(page.getByText(/已录入报价/)).toBeVisible();
  await expect(page.getByText("18.5000 USD")).toBeVisible();
  await expect(page.getByText(/关键物料 1 项/)).toBeVisible();

  // 定点：必须写样品结论与产能约束。
  await page.getByRole("button", { name: "定点给他" }).click();
  await page.getByLabel("样品结论").fill("确认样与图纸一致");
  await page.getByLabel("产能约束").fill("月产能约 3 万件");
  await page.getByRole("button", { name: "确认定点" }).click();

  await expect(page.getByText(/已定点，交接已交给需求与补货侧/)).toBeVisible();
  // 同样是两处同名：队列分组标题与"本次结果"。定位到分组标题。
  await expect(
    page.getByRole("heading", { level: 3, name: /已定点/ }),
  ).toBeVisible();
  // 插值前后各有一个空格，所以要按"定点给 + 空白 + 名称"匹配。
  await expect(page.getByText(/定点给\s*宁波某某塑胶/)).toBeVisible();
});

function entry(input: {
  suppliers: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
  nominated: Record<string, unknown> | null;
}) {
  return {
    skuReleaseId: "release-1",
    skuId: "sku-1",
    skuCode: "SKU-PET-01-RED",
    productNumber: "PET-01",
    suppliers: input.suppliers,
    quotations: input.quotations,
    nominated: input.nominated,
  };
}

function supplier(overrides: {
  name: string;
  admissionState: string;
  version?: number;
}) {
  return {
    contractVersion: "supplier.v1",
    supplierId: "supplier-1",
    name: overrides.name,
    countryCode: "CN",
    contactName: null,
    contactEmail: null,
    admissionState: overrides.admissionState,
    version: overrides.version ?? 1,
    createdAt: "2026-09-28T10:00:00.000Z",
    updatedAt: "2026-09-28T10:00:00.000Z",
  };
}

function quotation(overrides: {
  priceTiers: { unitPrice: string }[];
  incoterms: string;
  keyMaterials: unknown[];
  exclusions: string | null;
}) {
  const tier = overrides.priceTiers[0]!;
  return {
    contractVersion: "supplier-quotation.v1",
    quotationId: "quotation-1",
    supplierId: "supplier-1",
    skuReleaseId: "release-1",
    skuId: "sku-1",
    version: 1,
    priceTiers: [
      { minQuantity: 500, unitPrice: tier.unitPrice, currency: "USD" },
    ],
    incoterms: overrides.incoterms,
    minimumOrderQuantity: null,
    toolingCost: { value: 1200, unit: "each" },
    sampleCost: null,
    sampleRefundable: null,
    leadTimeDays: 35,
    packagingSpec: null,
    paymentTerms: null,
    qualityTerms: null,
    validUntil: null,
    keyMaterials: overrides.keyMaterials,
    exclusions: overrides.exclusions,
    quotedBy: "dev-operator",
    quotedAt: "2026-09-28T11:00:00.000Z",
    createdAt: "2026-09-28T11:00:00.000Z",
    updatedAt: "2026-09-28T11:00:00.000Z",
  };
}

function nomination(overrides: {
  sampleConclusion: string;
  capacityConstraint: string;
}) {
  return {
    contractVersion: "supplier_nomination.v1",
    handoffId: "nomination-1",
    version: 1,
    skuReleaseId: "release-1",
    skuId: "sku-1",
    supplierId: "supplier-1",
    supplierName: "宁波某某塑胶",
    supplierCountryCode: "CN",
    quotationId: "quotation-1",
    quotationVersion: 1,
    incoterms: "FOB Ningbo / Incoterms 2020",
    priceTiers: [{ minQuantity: 500, unitPrice: "18.5000", currency: "USD" }],
    leadTimeDays: 35,
    minimumOrderQuantity: null,
    sampleConclusion: overrides.sampleConclusion,
    capacityConstraint: overrides.capacityConstraint,
    nominatedBy: "dev-operator",
    nominatedAt: "2026-09-28T12:00:00.000Z",
    idempotencyKey: "nominate-1",
  };
}
