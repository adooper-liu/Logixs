import { describe, expect, it } from "vitest";
import type { SupplierQuotationV1 } from "@logix/contracts";
import { quotationsAreComparable } from "./sourcingQuotationCompare";

function quote(
  overrides: Partial<SupplierQuotationV1> & {
    currency?: string;
    minQuantity?: number;
    unitPrice?: string;
  } = {},
): SupplierQuotationV1 {
  const {
    currency = "USD",
    minQuantity = 500,
    unitPrice = "18.5000",
    ...rest
  } = overrides;
  return {
    contractVersion: "supplier-quotation.v1",
    quotationId: rest.quotationId ?? "q1",
    supplierId: rest.supplierId ?? "s1",
    skuReleaseId: "release-1",
    skuId: "sku-1",
    version: 1,
    priceTiers: [{ minQuantity, unitPrice, currency }],
    incoterms: rest.incoterms ?? "FOB Ningbo / Incoterms 2020",
    minimumOrderQuantity: null,
    toolingCost: null,
    sampleCost: null,
    sampleRefundable: null,
    leadTimeDays: 35,
    packagingSpec: null,
    paymentTerms: null,
    qualityTerms: null,
    validUntil: null,
    keyMaterials: [],
    exclusions: null,
    quotedBy: "buyer",
    quotedAt: "2026-09-29T00:00:00.000Z",
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    ...rest,
  };
}

describe("quotationsAreComparable", () => {
  it("单条报价视为可比", () => {
    expect(quotationsAreComparable([quote()])).toBe(true);
  });

  it("币种不同不可比", () => {
    expect(
      quotationsAreComparable([
        quote({ currency: "USD" }),
        quote({ quotationId: "q2", supplierId: "s2", currency: "CNY" }),
      ]),
    ).toBe(false);
  });

  it("贸易术语不同不可比", () => {
    expect(
      quotationsAreComparable([
        quote({ incoterms: "FOB Ningbo / Incoterms 2020" }),
        quote({
          quotationId: "q2",
          supplierId: "s2",
          incoterms: "CIF Los Angeles / Incoterms 2020",
        }),
      ]),
    ).toBe(false);
  });

  it("同币种同术语同起订量才可比", () => {
    expect(
      quotationsAreComparable([
        quote({ unitPrice: "18.5000" }),
        quote({
          quotationId: "q2",
          supplierId: "s2",
          unitPrice: "19.2000",
        }),
      ]),
    ).toBe(true);
  });
});
