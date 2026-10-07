import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { BUSINESS_CASE_DIMENSIONS } from "../../composables/useProductInitiativeDecision";
import ProductInitiativeReviewPanel from "./ProductInitiativeReviewPanel.vue";

const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";

function mountPanel() {
  return mount(ProductInitiativeReviewPanel, {
    props: {
      dimensions: BUSINESS_CASE_DIMENSIONS.map(({ code, label }) => ({
        code,
        label,
        decision: "" as const,
        conclusion: "",
        evidenceRefs: [] as string[],
        criticalUnknown: "",
        missing: true,
      })),
      legacyPoints: [
        {
          code: "competitive_supply" as const,
          conclusion: "历史结论",
          evidenceRefs: [EVIDENCE_ID],
        },
      ],
      candidates: [
        {
          evidenceId: EVIDENCE_ID,
          sourceName: "来源",
          summary: "样本依据",
          contentRef: "https://example.test",
          recordedAt: "2026-10-06T00:00:00.000Z",
        },
      ],
      busy: false,
      addEvidence: vi.fn().mockResolvedValue(true),
    },
  });
}

describe("ProductInitiativeReviewPanel", () => {
  it("五行摘要只编辑当前一面，历史结论只读保留", async () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll(".business-case__summary li")).toHaveLength(5);
    expect(wrapper.get(".business-case__editor h4").text()).toContain(
      "客户与需求",
    );
    await wrapper
      .findAll(".business-case__summary button")[1]!
      .trigger("click");
    expect(wrapper.get(".business-case__editor h4").text()).toContain(
      "价值与差异",
    );
    expect(wrapper.get(".business-case__legacy").text()).toContain("历史结论");
    expect(wrapper.get(".business-case__legacy").find("input").exists()).toBe(
      false,
    );
  });

  it("明确发送三态判断，关键未知只在验证态编辑", async () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll(".business-case__editor textarea")).toHaveLength(1);
    await wrapper
      .get('input[value="validate_before_investment"]')
      .trigger("change");
    expect(wrapper.emitted("updateDecision")?.[0]).toEqual([
      "customer_need",
      "validate_before_investment",
    ]);
    await wrapper.setProps({
      dimensions: BUSINESS_CASE_DIMENSIONS.map(({ code, label }) => ({
        code,
        label,
        decision:
          code === "customer_need"
            ? ("validate_before_investment" as const)
            : ("" as const),
        conclusion: "",
        evidenceRefs: [],
        criticalUnknown: "",
        missing: true,
      })),
    });
    expect(wrapper.findAll(".business-case__editor textarea")).toHaveLength(2);
  });
});
