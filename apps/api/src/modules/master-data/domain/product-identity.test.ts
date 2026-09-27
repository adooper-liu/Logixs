import { describe, expect, it } from "vitest";
import type {
  ProductAttributesV1,
  ProductIdentityDraftCommandV1,
  ProductSkuAttributesV1,
  SellableSkuReleaseCommandV1,
} from "@logix/contracts";
import {
  prepareProductIdentityDraft,
  prepareSellableSkuRelease,
  productIdentityPendingFieldCodes,
  ProductIdentityConflictError,
  ProductIdentityValidationError,
  productNumberFor,
  type CurrentProductIdentity,
} from "./product-identity";

const HANDOFF = "aaaaaaaa-0000-4000-8000-000000000001";

const EMPTY: CurrentProductIdentity = {
  version: 0,
  productNumber: null,
  skuCount: 0,
  attributes: null,
};

function attributes(
  overrides: Partial<ProductAttributesV1> = {},
): ProductAttributesV1 {
  return {
    categoryCode: null,
    brandName: null,
    subBrandName: null,
    modelNumber: null,
    functionalName: null,
    countryOfOrigin: null,
    hsCode: null,
    targetCountries: [],
    certifications: [],
    temperature: null,
    dangerousGoods: null,
    orderConditions: {
      leadTimeDays: null,
      minOrderQuantity: null,
      maxOrderQuantity: null,
      orderSizingFactor: null,
      orderMultiple: null,
    },
    ...overrides,
  };
}

function skuAttributes(): ProductSkuAttributesV1 {
  return {
    colorCode: null,
    sizeDescription: null,
    netContent: null,
    grossWeight: null,
    dimensions: null,
    packaging: {
      itemsPerLayer: null,
      completedLayers: null,
      itemsPerConsumerUnit: null,
      consumerUnitsPerInnerPack: null,
    },
    stackingFactor: null,
    maxStackingWeight: null,
    barcode: null,
    battery: null,
  };
}

function draft(
  overrides: Partial<ProductIdentityDraftCommandV1> = {},
): ProductIdentityDraftCommandV1 {
  return {
    contractVersion: "product-identity-draft.v1",
    expectedVersion: 0,
    attributes: attributes(),
    skus: [{ skuCode: "SKU-1", attributes: skuAttributes() }],
    idempotencyKey: "draft-1",
    ...overrides,
  };
}

describe("productNumberFor", () => {
  it("同一份发布设计生成的对外编号稳定不变", () => {
    expect(productNumberFor(HANDOFF)).toBe(productNumberFor(HANDOFF));
    expect(productNumberFor(HANDOFF)).toMatch(/^P-[0-9A-F]{8}$/);
  });

  it("不同来源生成不同编号", () => {
    expect(productNumberFor(HANDOFF)).not.toBe(
      productNumberFor("bbbbbbbb-0000-4000-8000-000000000002"),
    );
  });
});

describe("prepareProductIdentityDraft 边界", () => {
  it("拒绝别的契约版本", () => {
    expect(() =>
      prepareProductIdentityDraft(EMPTY, HANDOFF, {
        ...draft(),
        contractVersion: "nope" as never,
      }),
    ).toThrow(ProductIdentityValidationError);
  });

  it("期望版本与当前不符时冲突，不覆盖别人刚建的", () => {
    expect(() =>
      prepareProductIdentityDraft({ ...EMPTY, version: 3 }, HANDOFF, draft()),
    ).toThrow(ProductIdentityConflictError);
  });

  it("一个 SKU 都没有时明确失败，不给一个没有身份的产品建档", () => {
    // 契约已要求至少一个 SKU；领域这条是第二道，故意用不合契约的输入试它。
    expect(() =>
      prepareProductIdentityDraft(EMPTY, HANDOFF, draft({ skus: [] as never })),
    ).toThrow(ProductIdentityValidationError);
  });

  it("同一产品下 SKU 编号重复时明确失败", () => {
    expect(() =>
      prepareProductIdentityDraft(
        EMPTY,
        HANDOFF,
        draft({
          skus: [
            { skuCode: "SKU-1", attributes: skuAttributes() },
            { skuCode: "SKU-1", attributes: skuAttributes() },
          ],
        }),
      ),
    ).toThrow(ProductIdentityValidationError);
  });

  it("HS 编码格式不对时明确失败，不静默存下", () => {
    expect(() =>
      prepareProductIdentityDraft(
        EMPTY,
        HANDOFF,
        draft({ attributes: attributes({ hsCode: "ABC" }) }),
      ),
    ).toThrow(ProductIdentityValidationError);
  });

  it("原产国不是两位大写国别码时明确失败", () => {
    expect(() =>
      prepareProductIdentityDraft(
        EMPTY,
        HANDOFF,
        draft({ attributes: attributes({ countryOfOrigin: "chn" }) }),
      ),
    ).toThrow(ProductIdentityValidationError);
  });
});

describe("prepareProductIdentityDraft 成功路径", () => {
  it("留空产品号时按来源派生，并逐项保留「还没查」为 null", () => {
    const prepared = prepareProductIdentityDraft(EMPTY, HANDOFF, draft());

    expect(prepared.version).toBe(1);
    expect(prepared.productNumber).toBe(productNumberFor(HANDOFF));
    expect(prepared.attributes.categoryCode).toBeNull();
  });

  it("给了产品号就用给的 —— 对外编号可改，不必是生成的", () => {
    const prepared = prepareProductIdentityDraft(
      EMPTY,
      HANDOFF,
      draft({ productNumber: "PET-STROLLER-01" }),
    );

    expect(prepared.productNumber).toBe("PET-STROLLER-01");
  });

  it("缺口恒为 BOM 与 Listing —— 本片不产这两样，如实带着", () => {
    const prepared = prepareProductIdentityDraft(EMPTY, HANDOFF, draft());

    expect(prepared.pendingFieldCodes).toEqual(["bom", "listing"]);
    expect(productIdentityPendingFieldCodes()).toEqual(["bom", "listing"]);
  });

  it("用户自带的 skuId 原样保留，没有的留给落库补", () => {
    const prepared = prepareProductIdentityDraft(
      EMPTY,
      HANDOFF,
      draft({
        skus: [
          {
            skuId: "cccccccc-0000-4000-8000-000000000001",
            skuCode: "SKU-1",
            attributes: skuAttributes(),
          },
          { skuCode: "SKU-2", attributes: skuAttributes() },
        ],
      }),
    );

    expect(prepared.skus.map((sku) => sku.skuId)).toEqual([
      "cccccccc-0000-4000-8000-000000000001",
      null,
    ]);
  });
});

describe("prepareSellableSkuRelease 发布门槛", () => {
  const RELEASE: SellableSkuReleaseCommandV1 = {
    contractVersion: "sellable-sku-release.v1",
    expectedVersion: 1,
    idempotencyKey: "release-1",
  };

  const READY: ProductAttributesV1 = attributes({
    categoryCode: "pet_travel",
    functionalName: "折叠宠物推车",
    countryOfOrigin: "CN",
    hsCode: "8716800000",
    targetCountries: ["US", "CA"],
  });

  it("身份与属性没齐时明确失败，并逐项说明差什么", () => {
    try {
      prepareSellableSkuRelease(
        {
          version: 1,
          productNumber: "P-1",
          skuCount: 1,
          attributes: attributes(),
        },
        RELEASE,
      );
      throw new Error("应当失败");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductIdentityValidationError);
      expect((error as Error).message).toContain("hsCode");
      expect((error as Error).message).toContain("countryOfOrigin");
      expect((error as Error).message).toContain("categoryCode");
      expect((error as Error).message).toContain("targetCountries");
    }
  });

  it("一个 SKU 都没有时不许发布", () => {
    expect(() =>
      prepareSellableSkuRelease(
        {
          version: 1,
          productNumber: "P-1",
          skuCount: 0,
          attributes: READY,
        },
        RELEASE,
      ),
    ).toThrow(/skus/);
  });

  it("齐备时发布，缺口仍是 BOM 与 Listing —— 它们不阻断发布", () => {
    const prepared = prepareSellableSkuRelease(
      { version: 1, productNumber: "P-1", skuCount: 1, attributes: READY },
      RELEASE,
    );

    expect(prepared.version).toBe(2);
    expect(prepared.pendingFieldCodes).toEqual(["bom", "listing"]);
  });

  it("版本不符时冲突，不覆盖别人的发布", () => {
    expect(() =>
      prepareSellableSkuRelease(
        { version: 5, productNumber: "P-1", skuCount: 1, attributes: READY },
        RELEASE,
      ),
    ).toThrow(ProductIdentityConflictError);
  });
});
