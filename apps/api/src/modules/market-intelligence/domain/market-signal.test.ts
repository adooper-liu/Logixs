import { describe, expect, it } from "vitest";
import {
  assertNoPendingSelectionReturn,
  MarketSignalConflictError,
  MarketSignalValidationError,
  normalizeMarketSignalCreate,
  normalizeMarketSignalUpdate,
  prepareMarketSignalDecision,
  prepareSelectionReturnRequestDecision,
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
  it("rejects a new market decision while selection return is pending", () => {
    expect(() =>
      assertNoPendingSelectionReturn("selection_return_requested"),
    ).toThrowError(
      new MarketSignalConflictError("MARKET_SIGNAL_SELECTION_RETURN_PENDING"),
    );
    expect(() =>
      assertNoPendingSelectionReturn("needs_decision"),
    ).not.toThrow();
  });

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

  it("requires date and focus before watch becomes a current validation commitment", () => {
    const complete = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      nextReviewDate: "2026-02-12",
      watchFocus: "确认趋势是否持续两周",
      waitingReason: "等待第二客服队列",
      idempotencyKey: "watch-complete",
    });
    const missingFocus = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      nextReviewDate: "2026-02-12",
      idempotencyKey: "watch-no-focus",
    });
    const missingDate = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "watch",
      watchFocus: "确认趋势是否持续两周",
      idempotencyKey: "watch-no-date",
    });

    expect(complete).toMatchObject({
      completion: "completed",
      nextDestination: "watching",
      nextReviewDate: "2026-02-12",
      watchFocus: "确认趋势是否持续两周",
      waitingReason: "等待第二客服队列",
    });
    expect(complete.pendingFieldCodes).not.toContain("watch_focus");
    expect(missingFocus.completion).toBe("pending_completion");
    expect(missingFocus.pendingFieldCodes).toContain("watch_focus");
    expect(missingDate.completion).toBe("pending_completion");
    expect(missingDate.pendingFieldCodes).toContain("next_review_date");
  });

  it.each([
    ["blank waiting reason", "   "],
    ["control character", "等待\u0007审批"],
    ["over 500", "x".repeat(501)],
  ])("rejects %s", (_name, waitingReason) => {
    expect(() =>
      prepareMarketSignalDecision(facts(), {
        contractVersion: "market-signal-decision.v1",
        expectedSignalVersion: 1,
        decisionType: "watch",
        nextReviewDate: "2026-02-12",
        watchFocus: "验证持续性",
        waitingReason,
        idempotencyKey: `watch-${_name}`,
      }),
    ).toThrow(MarketSignalValidationError);
  });

  it("drops waiting reason from non-watch decisions", () => {
    const decision = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "handoff",
      waitingReason: "不得保存",
      idempotencyKey: "handoff-waiting",
    });

    expect(decision.waitingReason).toBeNull();
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

  it("prepares a completed selection return request with basis and reason", () => {
    const decision = prepareSelectionReturnRequestDecision({
      expectedSignalVersion: 2,
      returnReason: "  机会陈述与当前类目不对齐  ",
      returnBasis: "wrong_direction",
      idempotencyKey: "selection-return:initiative-1",
    });

    expect(decision).toMatchObject({
      decisionType: "selection_return_request",
      completion: "completed",
      nextDestination: "selection_return_requested",
      judgmentNote: "机会陈述与当前类目不对齐",
      dismissReason: null,
      pendingFieldCodes: [],
    });
    expect(decision.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps void and archive open until close reason exists", () => {
    const pending = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "void",
      idempotencyKey: "void-pending-1",
    });
    const completed = prepareMarketSignalDecision(facts(), {
      contractVersion: "market-signal-decision.v1",
      expectedSignalVersion: 1,
      decisionType: "archive",
      judgmentNote: "  观察结束，结案保留  ",
      idempotencyKey: "archive-1",
    });

    expect(pending).toMatchObject({
      completion: "pending_completion",
      nextDestination: "needs_decision",
    });
    expect(pending.pendingFieldCodes).toContain("close_reason");
    expect(completed).toMatchObject({
      completion: "completed",
      nextDestination: "archived",
      judgmentNote: "观察结束，结案保留",
    });
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
        prepareSelectionReturnRequestDecision({
          expectedSignalVersion: 2,
          returnReason: "  ",
          returnBasis: "insufficient_evidence",
          idempotencyKey: "selection-return:blank",
        }),
    ],
  ])("rejects %s", (_name, action) => {
    expect(action).toThrow(MarketSignalValidationError);
  });
});
