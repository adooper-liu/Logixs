import type { SupplierQuotationV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import {
  entryKey,
  parseEntryKey,
  priceTierLabels,
} from "./useSourcingWorkbench";

describe("队列条目的键：一份发布里的一个 SKU", () => {
  it("同一份发布下的两个 SKU 是两个条目，不是一个", () => {
    const releaseId = "release-1";
    const first = entryKey({ skuReleaseId: releaseId, skuId: "sku-a" });
    const second = entryKey({ skuReleaseId: releaseId, skuId: "sku-b" });

    expect(first).not.toBe(second);
  });

  it("键能原样解回两段，寻址不会串到别件上", () => {
    const key = entryKey({ skuReleaseId: "release-1", skuId: "sku-a" });

    expect(parseEntryKey(key)).toEqual({
      skuReleaseId: "release-1",
      skuId: "sku-a",
    });
  });
});

describe("报价价格档：原样列出，前端不比大小", () => {
  it("按录入顺序列出全部价格档，不重排、不换算金额", () => {
    const quotation = {
      priceTiers: [
        { minQuantity: 100, unitPrice: "100.0000", currency: "USD" },
        { minQuantity: 1000, unitPrice: "9.5000", currency: "USD" },
      ],
    } as unknown as SupplierQuotationV1;

    expect(priceTierLabels(quotation)).toEqual([
      "100 起 100.0000 USD",
      "1000 起 9.5000 USD",
    ]);
  });

  it("没有价格档时不编造价格", () => {
    const quotation = { priceTiers: [] } as unknown as SupplierQuotationV1;

    expect(priceTierLabels(quotation)).toEqual([]);
  });
});
