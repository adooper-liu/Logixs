import { describe, expect, it } from "vitest";
import { entryKey, parseEntryKey } from "./useSourcingWorkbench";

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
