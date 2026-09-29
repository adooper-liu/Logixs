import { describe, expect, it } from "vitest";
import {
  composeReviewConclusion,
  extractReviewSupplement,
  matchReviewOptionId,
  reviewPointOptions,
} from "./productInitiativeReviewOptions";

describe("productInitiativeReviewOptions", () => {
  it("每条要点都有可扫读的档位选项", () => {
    expect(reviewPointOptions("competitive_supply").length).toBeGreaterThan(1);
    expect(reviewPointOptions("compliance_risk")[0]?.sentence).toBeTruthy();
  });

  it("已知短句能反推档位；自由文本不瞎匹配", () => {
    expect(matchReviewOptionId("competitive_supply", "头部集中")).toBe(
      "concentrated",
    );
    expect(matchReviewOptionId("competitive_supply", "自由发挥一大段")).toBe(
      null,
    );
  });

  it("档位短句与补充说明可拼可拆", () => {
    const composed = composeReviewConclusion("头部集中", "头部占六成");
    expect(composed).toBe("头部集中；头部占六成");
    expect(extractReviewSupplement("competitive_supply", composed)).toBe(
      "头部占六成",
    );
    expect(extractReviewSupplement("competitive_supply", "头部集中")).toBe("");
  });
});
