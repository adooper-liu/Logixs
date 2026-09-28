import { describe, expect, it } from "vitest";
import {
  MarketSignalValidationError,
  normalizeMarketSignalCreate,
  normalizeMarketSignalUpdate,
  prepareMarketSignalDecision,
  prepareSelectionReturnDecision,
  type MarketSignalFacts,
} from "./market-signal";

const SIGNAL_ID = "11111111-1111-4111-8111-111111111111";

function facts(overrides: Partial<MarketSignalFacts> = {}): MarketSignalFacts {
  return {
    title: "美国站庭院收纳需求连续上升",
    marketCode: null,
    channelCode: null,
    categoryRef: null,
    observedFactSummary: null,
    hypothesis: null,
    evidenceRefs: [],
    ...overrides,
  };
}

describe("market signal rules", () => {
  it("allows title-only registration and reports ordinary gaps", () => {
    const normalized = normalizeMarketSignalCreate({
      contractVersion: "market-signal-create.v1",
      requestId: SIGNAL_ID,
      title: "  美国站庭院收纳需求连续上升  ",
      idempotencyKey: "market-signal-create-1",
    });

    expect(normalized.title).toBe("美国站庭院收纳需求连续上升");
    expect(normalized.ownerTeamCode).toBe("market_intelligence");
    expect(normalized.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("completes a handoff while carrying ordinary gaps", () => {
    const decision = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "handoff",
      idempotencyKey: "market-handoff-1",
    });

    expect(decision.completion).toBe("completed");
    expect(decision.nextDestination).toBe("handed_off");
    expect(decision.pendingFieldCodes).toEqual([
      "market_code",
      "channel_code",
      "category_ref",
      "observed_fact_summary",
      "hypothesis",
      "evidence_refs",
      "opportunity_statement",
    ]);
  });

  it("keeps watch and dismissal open until their closing input exists", () => {
    const watch = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      idempotencyKey: "market-watch-1",
    });
    const dismiss = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "dismiss",
      idempotencyKey: "market-dismiss-1",
    });

    expect(watch).toMatchObject({
      completion: "pending_completion",
      nextDestination: "needs_decision",
    });
    expect(watch.pendingFieldCodes).toContain("next_review_date");
    expect(dismiss).toMatchObject({
      completion: "pending_completion",
      nextDestination: "needs_decision",
    });
    expect(dismiss.pendingFieldCodes).toContain("dismiss_reason");
  });

  it("normalizes a controlled one-field supplement", () => {
    const update = normalizeMarketSignalUpdate({
      contractVersion: "market-signal-update.v1",
      expectedSignalVersion: 2,
      categoryRef: "  庭院收纳  ",
      idempotencyKey: "signal-update-category-1",
    });

    expect(update.changes).toEqual({ categoryRef: "庭院收纳" });
  });

  it("prepares a completed selection return with reason in judgment note", () => {
    const decision = prepareSelectionReturnDecision({
      expectedSignalVersion: 2,
      returnReason: "  机会陈述与当前类目不对齐  ",
      idempotencyKey: "selection-return:initiative-1",
    });

    expect(decision).toMatchObject({
      decisionType: "selection_return",
      completion: "completed",
      nextDestination: "returned_from_selection",
      judgmentNote: "机会陈述与当前类目不对齐",
      dismissReason: null,
      pendingFieldCodes: [],
    });
    expect(decision.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [
      "empty title",
      () =>
        normalizeMarketSignalCreate({
          contractVersion: "market-signal-create.v1",
          requestId: SIGNAL_ID,
          title: " ",
          idempotencyKey: "create-1",
        }),
    ],
    [
      "empty update",
      () =>
        normalizeMarketSignalUpdate({
          contractVersion: "market-signal-update.v1",
          expectedSignalVersion: 1,
          idempotencyKey: "update-1",
        }),
    ],
    [
      "invalid date",
      () =>
        prepareMarketSignalDecision(facts(), {
          contractVersion: "market-signal-decision.v1",
          expectedSignalVersion: 1,
          decisionType: "watch",
          nextReviewDate: "2026-02-31",
          idempotencyKey: "watch-1",
        }),
    ],
    [
      "blank selection return reason",
      () =>
        prepareSelectionReturnDecision({
          expectedSignalVersion: 2,
          returnReason: "  ",
          idempotencyKey: "selection-return:blank",
        }),
    ],
  ])("rejects %s", (_name, action) => {
    expect(action).toThrow(MarketSignalValidationError);
  });
});
