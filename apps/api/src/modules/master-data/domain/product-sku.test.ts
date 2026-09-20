import { describe, expect, it } from "vitest";
import {
  normalizeRegisterProductSkuCommand,
  ProductSkuCommandError,
} from "./product-sku";

describe("ProductSku registration command", () => {
  it("保留明确的商品号大小写并生成稳定载荷哈希", () => {
    const first = normalizeRegisterProductSkuCommand({
      tenantId: "tenant-a",
      productNumber: "AbC-001",
      idempotencyKey: "import:batch-1:row-1",
    });
    const replay = normalizeRegisterProductSkuCommand({
      tenantId: "tenant-a",
      productNumber: "AbC-001",
      idempotencyKey: "import:batch-1:row-1",
    });

    expect(first.productNumber).toBe("AbC-001");
    expect(first.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(replay.payloadHash).toBe(first.payloadHash);
  });

  it.each([
    ["tenantId", { tenantId: " tenant-a", productNumber: "SKU-1" }],
    ["productNumber", { tenantId: "tenant-a", productNumber: " SKU-1" }],
    ["productNumber", { tenantId: "tenant-a", productNumber: "SKU\n1" }],
    ["idempotencyKey", { tenantId: "tenant-a", productNumber: "SKU-1" }],
  ])("拒绝非法 %s", (field, partial) => {
    expect(() =>
      normalizeRegisterProductSkuCommand({
        tenantId: partial.tenantId,
        productNumber: partial.productNumber,
        idempotencyKey:
          field === "idempotencyKey" ? "" : "import:batch-1:row-1",
      }),
    ).toThrow(ProductSkuCommandError);
  });

  it("租户参与载荷身份", () => {
    const left = normalizeRegisterProductSkuCommand({
      tenantId: "tenant-a",
      productNumber: "SKU-1",
      idempotencyKey: "same-key",
    });
    const right = normalizeRegisterProductSkuCommand({
      tenantId: "tenant-b",
      productNumber: "SKU-1",
      idempotencyKey: "same-key",
    });

    expect(left.payloadHash).not.toBe(right.payloadHash);
  });
});
