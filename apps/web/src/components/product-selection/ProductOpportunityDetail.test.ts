import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ProductOpportunityV1 } from "@logix/contracts";
import ProductOpportunityDetail from "./ProductOpportunityDetail.vue";

describe("ProductOpportunityDetail", () => {
  it("combines opportunity facts and keeps handoff gaps in one tooltip status", () => {
    const wrapper = mount(ProductOpportunityDetail, {
      props: { item: opportunity() },
    });

    expect(wrapper.get(".opportunity-facts").text()).toContain("经营范围");
    expect(wrapper.get(".opportunity-facts").text()).toContain("验证目标");
    expect(wrapper.get(".opportunity-facts").text()).toContain("事实");
    expect(wrapper.get(".opportunity-facts").text()).toContain("经营判断");
    expect(wrapper.get(".opportunity-facts").text()).toContain("证据");
    expect(wrapper.get(".opportunity-status").text()).toContain(
      "交接缺失 3 项",
    );
    expect(wrapper.findAll('[aria-label="查看交接缺失字段"]')).toHaveLength(1);
    expect(wrapper.text()).not.toContain("经营团队交来了什么");
    expect(wrapper.text()).not.toContain("希望选品验证");
    expect(wrapper.text()).not.toContain("交接时未填");
  });
});

function opportunity(): ProductOpportunityV1 {
  return {
    handoff: {
      contractVersion: "market_opportunity_handoff.v1",
      handoffId: "44444444-4444-4444-8444-444444444444",
      version: 1,
      signalId: "22222222-2222-4222-8222-222222222222",
      signalVersion: 2,
      title: "加拿大站宠物出行需求上升",
      recipientQueueCode: "product_selection",
      marketCode: "CA",
      channelCode: null,
      categoryRef: null,
      observedFactSummary: "站内搜索量上升。",
      evidenceRefs: [],
      hypothesis: "可能存在折叠出行产品机会。",
      opportunityStatement: "验证宠物出行机会是否值得立项。",
      judgmentNote: null,
      pendingFieldCodes: ["channel_code", "category_ref", "evidence_refs"],
      createdBy: "market-owner",
      createdAt: "2026-09-25T02:00:00.000Z",
      idempotencyKey: "handoff-test",
    },
    intakeState: "queued",
    intakeVersion: 1,
    assignedActorId: null,
    supplementedFieldCodes: [],
    responsibility: {
      status: "retained_by_market",
      responsibleTeamCode: "market_intelligence",
      handedOffAt: "2026-09-25T02:00:00.000Z",
      assignedActorId: null,
      claimedAt: null,
      acceptedAt: null,
    },
    latestSelectionDecision: null,
  };
}
