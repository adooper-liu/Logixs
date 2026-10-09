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
      risks: [
        "compliance",
        "intellectual_property",
        "packaging_logistics",
        "returns",
        "platform_restrictions",
      ].map((riskCode) => ({
        riskCode: riskCode as never,
        applicability: "undetermined" as const,
        applicabilityReason: null,
        investmentDecision: null,
        conclusion: null,
        evidenceRefs: [],
        criticalUnknown: "",
        label: riskCode,
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

  it("把五面和风险摘要接到同一个当前编辑区", async () => {
    const wrapper = mountPanel();
    expect(
      wrapper.findAll(".business-case__editor, .risk-editor"),
    ).toHaveLength(1);
    expect(wrapper.get(".active-editor").element.previousElementSibling).toBe(
      wrapper.get(".risk-assessment").element,
    );
    await wrapper.get(".risk-summary button").trigger("click");
    expect(wrapper.find(".business-case__editor").exists()).toBe(false);
    expect(wrapper.find(".risk-editor").exists()).toBe(true);
    expect(
      wrapper.findAll(".business-case__editor, .risk-editor"),
    ).toHaveLength(1);
  });

  it("尚不能判断时可编辑关键未知，并把适用但未判断明确显示为缺失结论", async () => {
    const wrapper = mountPanel();
    await wrapper.get(".risk-summary button").trigger("click");

    expect(wrapper.get(".risk-editor").text()).toContain("关键未知");
    await wrapper.get(".risk-editor textarea").setValue("等待平台限制清单");
    expect(wrapper.emitted("updateRisk")?.at(-1)).toEqual([
      "compliance",
      { criticalUnknown: "等待平台限制清单" },
    ]);

    await wrapper.setProps({
      risks: [
        {
          riskCode: "compliance",
          applicability: "applicable",
          applicabilityReason: null,
          investmentDecision: null,
          conclusion: null,
          evidenceRefs: [],
          criticalUnknown: null,
          label: "合规",
          missing: true,
        },
      ],
    });

    expect(wrapper.get(".risk-summary button").text()).toContain(
      "尚未判断投资结论",
    );
    expect(wrapper.get(".risk-summary button").text()).not.toContain(
      "不支持投入",
    );
  });
});
