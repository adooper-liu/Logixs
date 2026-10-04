import type { ProductOpportunityV1 } from "@logix/contracts";
import { describe, expect, it } from "vitest";
import {
  applyHandoffToObjective,
  buildObjectiveFromHandoff,
} from "./productInitiativeApplyHandoff";

function opportunity(
  overrides: Partial<ProductOpportunityV1["handoff"]> = {},
): ProductOpportunityV1 {
  return {
    handoff: {
      contractVersion: "market_opportunity_handoff.v1",
      handoffId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      signalId: "22222222-2222-4222-8222-222222222222",
      signalVersion: 1,
      title: "美国站庭院收纳",
      recipientQueueCode: "product_selection",
      marketCode: "美国",
      channelCode: "Amazon",
      categoryRef: "庭院收纳",
      opportunityStatement: "需求连续三周上升",
      observedFactSummary: "搜索量上升",
      hypothesis: "可做折叠款",
      evidenceRefs: [],
      pendingFieldCodes: [],
      createdBy: "market-owner",
      createdAt: "2026-09-27T00:00:00.000Z",
      idempotencyKey: "handoff-apply-test-1",
      ...overrides,
    },
    intakeState: "accepted",
    intakeVersion: 1,
    assignedActorId: "selector",
    supplementedFieldCodes: [],
    responsibility: {
      status: "transferred_to_selection",
      responsibleTeamCode: "product_selection",
      handedOffAt: "2026-09-27T00:00:00.000Z",
      assignedActorId: "selector",
      claimedAt: "2026-09-27T00:05:00.000Z",
      acceptedAt: "2026-09-27T00:10:00.000Z",
    },
    latestSelectionDecision: null,
  };
}

describe("productInitiativeApplyHandoff", () => {
  it("从合并视图拼目标结果草稿", () => {
    expect(buildObjectiveFromHandoff(opportunity())).toContain("市场：美国");
    expect(buildObjectiveFromHandoff(opportunity())).toContain("可做折叠款");
  });

  it("已有目标结果时不覆盖", () => {
    const result = applyHandoffToObjective({
      current: "已有人手写",
      item: opportunity(),
    });
    expect(result).toEqual({ next: "已有人手写", applied: false });
  });

  it("空目标结果时带入", () => {
    const result = applyHandoffToObjective({
      current: "  ",
      item: opportunity(),
    });
    expect(result.applied).toBe(true);
    expect(result.next).toContain("需求连续三周上升");
  });
});
