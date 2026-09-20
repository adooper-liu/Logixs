import { describe, expect, it } from "vitest";
import {
  normalizeBindReplenishmentLineProductSkuCommand,
  ReplenishmentLineSkuBindingValidationError,
} from "./replenishment-line-sku-binding";

const command = {
  tenantId: "tenant-a",
  replenishmentOrderLineId: "11111111-1111-4111-8111-111111111111",
  productSkuId: "22222222-2222-4222-8222-222222222222",
  productNumber: "SKU-1",
  expectedVersion: 1,
};

describe("replenishment line SKU binding", () => {
  it("保留明确商品号并规范 UUID 大小写", () => {
    expect(
      normalizeBindReplenishmentLineProductSkuCommand({
        ...command,
        productSkuId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      }),
    ).toMatchObject({
      productSkuId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      productNumber: "SKU-1",
    });
  });

  it.each([
    { ...command, productNumber: " SKU-1" },
    { ...command, productNumber: "SKU\n1" },
    { ...command, productSkuId: "bad" },
    { ...command, replenishmentOrderLineId: "bad" },
    { ...command, expectedVersion: 0 },
  ])("拒绝非法绑定命令", (input) => {
    expect(() =>
      normalizeBindReplenishmentLineProductSkuCommand(input),
    ).toThrow(ReplenishmentLineSkuBindingValidationError);
  });
});
