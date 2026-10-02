import { describe, expect, it } from "vitest";
import {
  deriveMarketSignalPrefill,
  marketSignalEvidenceCompleteness,
  marketSignalEvidenceHeading,
  marketSignalFactsReady,
  marketSignalGapActionVerb,
} from "./marketSignalEvidenceFlow";
import type { MarketSignalScenario } from "./marketSignalScenarios";

function scenario(
  overrides: Partial<MarketSignalScenario> = {},
): MarketSignalScenario {
  return {
    id: "s1",
    version: 1,
    title: "加拿大站宠物出行需求上升",
    workReason: "需要判断下一步去向",
    urgency: "normal",
    urgencyLabel: "本周内看",
    market: null,
    channel: null,
    category: null,
    owner: "经营与市场负责人",
    activeValidation: null,
    observedFacts: [],
    hypothesis: null,
    evidence: [],
    supplements: [],
    gaps: [],
    initialState: "needs_decision",
    ...overrides,
  };
}

describe("marketSignalEvidenceFlow", () => {
  it("maps gap codes to verb actions", () => {
    expect(marketSignalGapActionVerb("market")).toBe("填写市场");
    expect(marketSignalGapActionVerb("channel")).toBe("选择渠道");
    expect(marketSignalGapActionVerb("observed_fact")).toBe("添加事实");
    expect(marketSignalGapActionVerb("hypothesis")).toBe("填写经营判断");
  });

  it("derives market from站 title hints without inventing channel", () => {
    expect(deriveMarketSignalPrefill("法国站出现新的户外用餐场景")).toEqual({
      market: "法国",
    });
    expect(deriveMarketSignalPrefill("无明显站点线索的标题")).toEqual({});
  });

  it("locks judgment until at least one observed fact exists", () => {
    expect(marketSignalFactsReady(scenario())).toBe(false);
    expect(
      marketSignalFactsReady(scenario({ observedFacts: ["搜索量上升"] })),
    ).toBe(true);
  });

  it("counts completeness against six basis slots", () => {
    expect(marketSignalEvidenceCompleteness(scenario()).filled).toBe(0);
    expect(
      marketSignalEvidenceCompleteness(
        scenario({
          market: "加拿大",
          channel: "Aosom.ca",
          category: "宠物出行",
          observedFacts: ["搜索上升"],
          hypothesis: "值得验证",
          evidence: [
            {
              id: "e1",
              sourceName: "周报",
              observedAt: "2026-09-28",
              detail: "d",
              previewText: "p",
              sourceUrl: null,
              attachmentName: null,
            },
          ],
          gaps: [],
        }),
      ),
    ).toEqual({ filled: 6, total: 6, remaining: 0 });
  });

  it("uses a statement heading with the object name", () => {
    expect(marketSignalEvidenceHeading("加拿大站宠物出行需求上升")).toBe(
      "加拿大站宠物出行需求上升 · 依据与判断",
    );
  });
});
