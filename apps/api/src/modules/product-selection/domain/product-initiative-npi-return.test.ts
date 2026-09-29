import { describe, expect, it } from "vitest";
import { ProductInitiativeConflictError } from "./product-initiative";
import { prepareProductInitiativeNpiReturn } from "./product-initiative-npi-return";

describe("prepareProductInitiativeNpiReturn", () => {
  it("理由齐且本人已领时准备退回", () => {
    const prepared = prepareProductInitiativeNpiReturn(
      {
        version: 2,
        currentDestination: "handed_off",
        productOwnerActorId: "dev-operator",
      },
      "dev-operator",
      {
        contractVersion: "product-initiative-npi-return.v1",
        expectedInitiativeVersion: 2,
        returnReason: "立项范围与工厂能力不匹配",
        idempotencyKey: "npi-return-1",
      },
    );
    expect(prepared).toMatchObject({
      outcome: "returned_from_npi",
      nextDestination: "returned_from_npi",
      reason: "立项范围与工厂能力不匹配",
      version: 3,
    });
  });

  it("缺理由明确失败，不回推选品", () => {
    expect(() =>
      prepareProductInitiativeNpiReturn(
        {
          version: 2,
          currentDestination: "handed_off",
          productOwnerActorId: "dev-operator",
        },
        "dev-operator",
        {
          contractVersion: "product-initiative-npi-return.v1",
          expectedInitiativeVersion: 2,
          returnReason: "  ",
          idempotencyKey: "npi-return-2",
        },
      ),
    ).toThrow(/returnReason/);
  });

  it("非领取人不能退回", () => {
    expect(() =>
      prepareProductInitiativeNpiReturn(
        {
          version: 2,
          currentDestination: "handed_off",
          productOwnerActorId: "other",
        },
        "dev-operator",
        {
          contractVersion: "product-initiative-npi-return.v1",
          expectedInitiativeVersion: 2,
          returnReason: "范围不对",
          idempotencyKey: "npi-return-3",
        },
      ),
    ).toThrow(ProductInitiativeConflictError);
  });
});
