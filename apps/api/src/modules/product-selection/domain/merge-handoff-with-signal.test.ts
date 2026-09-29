import { describe, expect, it } from "vitest";
import type { MarketOpportunityHandoffV1 } from "@logix/contracts";
import { mergeHandoffWithSignalLive } from "./merge-handoff-with-signal";

const baseHandoff: MarketOpportunityHandoffV1 = {
  contractVersion: "market_opportunity_handoff.v1",
  handoffId: "aaaaaaaa-0000-4000-8000-000000000001",
  version: 1,
  signalId: "bbbbbbbb-0000-4000-8000-000000000001",
  signalVersion: 1,
  title: "美国站折叠宠物推车需求上升",
  recipientQueueCode: "product_selection",
  marketCode: null,
  channelCode: null,
  categoryRef: null,
  observedFactSummary: null,
  evidenceRefs: [],
  hypothesis: null,
  opportunityStatement: "验证是否立项",
  judgmentNote: null,
  pendingFieldCodes: [
    "market_code",
    "channel_code",
    "category_ref",
    "observed_fact_summary",
    "hypothesis",
    "evidence_refs",
  ],
  createdBy: "market-owner",
  createdAt: "2026-09-28T00:00:00.000Z",
  idempotencyKey: "handoff:1",
};

describe("mergeHandoffWithSignalLive", () => {
  it("keeps snapshot when signal has no later fills", () => {
    const merged = mergeHandoffWithSignalLive(baseHandoff, {
      marketCode: null,
      channelCode: null,
      categoryRef: null,
      observedFactSummary: null,
      hypothesis: null,
      evidenceRefs: [],
    });
    expect(merged.display.marketCode).toBeNull();
    expect(merged.supplementedFieldCodes).toEqual([]);
    expect(merged.display.pendingFieldCodes).toEqual(
      baseHandoff.pendingFieldCodes,
    );
  });

  it("fills empty snapshot fields from live signal and marks supplemented", () => {
    const merged = mergeHandoffWithSignalLive(baseHandoff, {
      marketCode: "美国",
      channelCode: "Aosom.US",
      categoryRef: "宠物推车",
      observedFactSummary: "搜索量上升",
      hypothesis: "值得验证",
      evidenceRefs: ["cccccccc-0000-4000-8000-000000000001"],
    });
    expect(merged.display.marketCode).toBe("美国");
    expect(merged.display.channelCode).toBe("Aosom.US");
    expect(merged.display.categoryRef).toBe("宠物推车");
    expect(merged.display.observedFactSummary).toBe("搜索量上升");
    expect(merged.display.hypothesis).toBe("值得验证");
    expect(merged.display.evidenceRefs).toEqual([
      "cccccccc-0000-4000-8000-000000000001",
    ]);
    expect(merged.supplementedFieldCodes).toEqual([
      "market_code",
      "channel_code",
      "category_ref",
      "observed_fact_summary",
      "hypothesis",
      "evidence_refs",
    ]);
    expect(merged.display.pendingFieldCodes).toEqual([]);
  });

  it("does not overwrite snapshot values that already exist", () => {
    const handed: MarketOpportunityHandoffV1 = {
      ...baseHandoff,
      marketCode: "CA",
      pendingFieldCodes: ["channel_code"],
    };
    const merged = mergeHandoffWithSignalLive(handed, {
      marketCode: "美国",
      channelCode: "Aosom.ca",
      categoryRef: null,
      observedFactSummary: null,
      hypothesis: null,
      evidenceRefs: [],
    });
    expect(merged.display.marketCode).toBe("CA");
    expect(merged.display.channelCode).toBe("Aosom.ca");
    expect(merged.supplementedFieldCodes).toEqual(["channel_code"]);
    expect(merged.display.pendingFieldCodes).toEqual([]);
  });

  it("returns snapshot unchanged when live signal is missing", () => {
    const merged = mergeHandoffWithSignalLive(baseHandoff, null);
    expect(merged.display).toEqual(baseHandoff);
    expect(merged.supplementedFieldCodes).toEqual([]);
  });
});
