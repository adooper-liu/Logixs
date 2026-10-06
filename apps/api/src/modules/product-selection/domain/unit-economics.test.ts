import { describe, expect, it } from "vitest";
import type { ProductInitiativeUnitEconomicsDraftV1 } from "@logix/contracts";
import {
  prepareProductInitiativeUnitEconomics,
  requestedUnitEconomicsCurrencyCode,
} from "./unit-economics";

const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";

describe("product initiative unit economics", () => {
  it("normalizes fixed-point inputs and calculates both contribution bounds", () => {
    const result = prepareProductInitiativeUnitEconomics({
      draft: completeDraft(),
      negativeConservativeReason: undefined,
      context: activeContext(),
    });

    expect(result.pendingFieldCodes).toEqual([]);
    expect(result.snapshot?.scenarios.baseline).toMatchObject({
      salePrice: { min: "100", max: "120" },
      landedCost: { min: "40", max: "45.5" },
      contribution: { min: "29.5", max: "65" },
    });
    expect(result.snapshot?.scenarios.conservative.contribution).toEqual({
      min: "9.5",
      max: "45",
    });
    expect(result.evidenceRefs).toEqual([EVIDENCE_ID]);
  });

  it.each(["-1", "+1", "1e2", "1,000", "1000000000000", "1.00001"])(
    "rejects non-canonical input %s",
    (value) => {
      const draft = completeDraft();
      draft.scenarios!.baseline!.salePrice!.min = value;

      expect(() =>
        prepareProductInitiativeUnitEconomics({
          draft,
          negativeConservativeReason: undefined,
          context: activeContext(),
        }),
      ).toThrow(
        `VALIDATION_FORMAT: unitEconomics.scenarios.baseline.salePrice.min`,
      );
    },
  );

  it("lists every missing path in stable scenario, amount and attribute order", () => {
    const result = prepareProductInitiativeUnitEconomics({
      draft: {
        currencyCode: "USD",
        scenarios: { baseline: { salePrice: { min: "1" } } },
      },
      negativeConservativeReason: undefined,
      context: activeContext(),
    });

    expect(result.snapshot).toBeNull();
    expect(result.pendingFieldCodes.slice(0, 5)).toEqual([
      "unitEconomics.scenarios.baseline.salePrice.max",
      "unitEconomics.scenarios.baseline.salePrice.basis",
      "unitEconomics.scenarios.baseline.salePrice.evidenceRefs",
      "unitEconomics.scenarios.baseline.landedCost.min",
      "unitEconomics.scenarios.baseline.landedCost.max",
    ]);
    expect(result.pendingFieldCodes.at(-1)).toBe(
      "unitEconomics.scenarios.conservative.returnCost.evidenceRefs",
    );
  });

  it("keeps an empty partial draft contract-valid and rejects a reason before a negative result exists", () => {
    const partial = prepareProductInitiativeUnitEconomics({
      draft: {},
      negativeConservativeReason: undefined,
      context: {
        marketCode: null,
        channelCode: null,
        currencyResolution: null,
      },
    });
    expect(partial.draft).toEqual({});
    expect(partial.draft).not.toHaveProperty("marketCode");

    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: {},
        negativeConservativeReason: "尚无保守贡献结果",
        context: activeContext(),
      }),
    ).toThrow("VALIDATION_FORMAT: negativeConservativeReason");
  });

  it("requires a reason only when the conservative lower contribution is negative", () => {
    const negative = completeDraft();
    negative.scenarios!.conservative!.salePrice = assumption("20", "20");

    const missing = prepareProductInitiativeUnitEconomics({
      draft: negative,
      negativeConservativeReason: undefined,
      context: activeContext(),
    });
    expect(missing.snapshot?.scenarios.conservative.contribution.min).toBe(
      "-50.5",
    );
    expect(missing.pendingFieldCodes).toEqual(["negativeConservativeReason"]);

    expect(
      prepareProductInitiativeUnitEconomics({
        draft: negative,
        negativeConservativeReason: "仍需验证战略品类入口",
        context: activeContext(),
      }).negativeConservativeReason,
    ).toBe("仍需验证战略品类入口");

    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: completeDraft(),
        negativeConservativeReason: "没有负值却填写理由",
        context: activeContext(),
      }),
    ).toThrow("VALIDATION_FORMAT: negativeConservativeReason");
  });

  it("keeps assumptions evidence-free and evidence-backed ranges nonempty", () => {
    const invalid = completeDraft();
    invalid.scenarios!.baseline!.landedCost = {
      ...assumption("40", "45"),
      evidenceRefs: [EVIDENCE_ID],
    };
    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: invalid,
        negativeConservativeReason: undefined,
        context: activeContext(),
      }),
    ).toThrow(
      "VALIDATION_FORMAT: unitEconomics.scenarios.baseline.landedCost.evidenceRefs",
    );

    const incomplete = completeDraft();
    incomplete.scenarios!.baseline!.salePrice!.evidenceRefs = [];
    expect(
      prepareProductInitiativeUnitEconomics({
        draft: incomplete,
        negativeConservativeReason: undefined,
        context: activeContext(),
      }).pendingFieldCodes,
    ).toContain("unitEconomics.scenarios.baseline.salePrice.evidenceRefs");
  });

  it("does not allow the command to rewrite market/channel or use unknown currency", () => {
    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: { ...completeDraft(), marketCode: "US" },
        negativeConservativeReason: undefined,
        context: activeContext(),
      }),
    ).toThrow("VALIDATION_FORMAT: unitEconomics.marketCode");
    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: { ...completeDraft(), channelCode: "retail" },
        negativeConservativeReason: undefined,
        context: activeContext(),
      }),
    ).toThrow("PRODUCT_INITIATIVE_UNIT_ECONOMICS_CHANNEL_MISMATCH");
    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: completeDraft(),
        negativeConservativeReason: undefined,
        context: { ...activeContext(), currencyResolution: "unknown" },
      }),
    ).toThrow("CURRENCY_UNKNOWN: USD");
    expect(requestedUnitEconomicsCurrencyCode({ currencyCode: "USD" })).toBe(
      "USD",
    );
  });

  it("rejects an unavailable currency reference directory", () => {
    expect(() =>
      prepareProductInitiativeUnitEconomics({
        draft: completeDraft(),
        negativeConservativeReason: undefined,
        context: { ...activeContext(), currencyResolution: "unavailable" },
      }),
    ).toThrow("REFERENCE_CURRENCY_RELEASE_UNAVAILABLE");
  });
});

function completeDraft(): ProductInitiativeUnitEconomicsDraftV1 {
  return {
    channelCode: "amazon",
    currencyCode: "USD",
    scenarios: {
      baseline: scenario("100", "120"),
      conservative: scenario("80", "100"),
    },
  };
}

function scenario(saleMin: string, saleMax: string) {
  return {
    salePrice: {
      min: saleMin,
      max: saleMax,
      basis: "evidence" as const,
      evidenceRefs: [EVIDENCE_ID],
    },
    landedCost: assumption("40", "45.5000"),
    platformFee: assumption("5", "5"),
    fulfillmentFee: assumption("5", "5"),
    advertisingCost: assumption("3", "5"),
    returnCost: assumption("2", "10"),
  };
}

function assumption(min: string, max: string) {
  return { min, max, basis: "assumption" as const, evidenceRefs: [] };
}

function activeContext() {
  return {
    marketCode: "US",
    channelCode: "amazon",
    currencyResolution: "active" as const,
  };
}
