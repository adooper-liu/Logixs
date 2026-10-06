import type { ProductInitiativeUnitEconomicsSnapshotV1 } from "@logix/contracts";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { UnitEconomicsDraftState } from "../../composables/useProductInitiativeDecision";
import ProductInitiativeUnitEconomicsPanel from "./ProductInitiativeUnitEconomicsPanel.vue";

describe("ProductInitiativeUnitEconomicsPanel", () => {
  it("没有 active 币种时明确显示未接通，不能用默认值冒充", () => {
    const wrapper = mountPanel({ currencyOptions: [] });

    expect(wrapper.text()).toContain("币种参考数据未接通");
    expect(
      wrapper.get('[aria-label="单位经济币种"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.get('[aria-label="单位经济币种"]').element).toHaveProperty(
      "value",
      "",
    );
  });

  it("编辑中只提示保存后由服务端计算，不在浏览器生成贡献", () => {
    const wrapper = mountPanel();

    expect(wrapper.findAll(".unit-economics__pending")).toHaveLength(2);
    expect(wrapper.text()).not.toContain("单件贡献");
  });

  it("默认收起两种情景的精确字段，按需展开后才显示", async () => {
    const wrapper = mountPanel();

    expect(wrapper.findAll(".unit-economics__scenario-details")).toHaveLength(
      2,
    );
    expect(
      wrapper.findAll(".unit-economics__scenario-details[open]"),
    ).toHaveLength(0);
    expect(
      wrapper.get('[aria-label="基准情景 销售价 最低值"]').isVisible(),
    ).toBe(false);

    await wrapper
      .get(".unit-economics__scenario-details summary")
      .trigger("click");

    expect(
      wrapper.get('[aria-label="基准情景 销售价 最低值"]').isVisible(),
    ).toBe(true);
  });

  it("有服务端快照时原样显示两情景贡献", () => {
    const wrapper = mountPanel({ snapshot: snapshot() });

    expect(wrapper.findAll(".unit-economics__contribution")).toHaveLength(2);
    expect(wrapper.text()).toContain("50.00～95.00");
    expect(wrapper.text()).not.toContain("保存后由服务端计算");
  });

  it("有证据时列出当前合法候选，假设模式不显示伪证据入口", () => {
    const evidenceDraft = draft();
    evidenceDraft.scenarios.baseline.salePrice.basis = "evidence";
    const withEvidence = mountPanel({ draft: evidenceDraft });
    expect(withEvidence.text()).toContain("站点周报");

    const assumptionDraft = draft();
    assumptionDraft.scenarios.baseline.salePrice.basis = "assumption";
    const assumption = mountPanel({ draft: assumptionDraft });
    expect(assumption.find(".unit-economics__evidence").exists()).toBe(false);
  });

  it("服务端确认负贡献后显示理由输入并把内容交回上层", async () => {
    const wrapper = mountPanel({ negativeContributionNeedsReason: true });

    const reason = wrapper.get('textarea[aria-label="仍要投入的理由"]');
    await reason.setValue("战略品类入口仍需验证");

    expect(wrapper.emitted("updateNegativeReason")).toEqual([
      ["战略品类入口仍需验证"],
    ]);
  });
});

function mountPanel(
  overrides: Partial<{
    currencyOptions: { code: string; name: string; minorUnit: number | null }[];
    draft: UnitEconomicsDraftState;
    snapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
    negativeContributionNeedsReason: boolean;
  }> = {},
) {
  return mount(ProductInitiativeUnitEconomicsPanel, {
    props: {
      marketCode: "CA",
      channelCode: "Amazon CA",
      currencyOptions: [{ code: "CAD", name: "Canadian Dollar", minorUnit: 2 }],
      draft: draft(),
      snapshot: null,
      evidenceCandidates: [
        {
          evidenceId: "00000000-0000-4000-8000-000000000001",
          sourceName: "站点周报",
          summary: "过去四周成交价格",
          contentRef: "https://example.test/report",
          recordedAt: "2026-10-05T00:00:00.000Z",
        },
      ],
      negativeContributionNeedsReason: false,
      negativeConservativeReason: "",
      busy: false,
      ...overrides,
    },
  });
}

function draft(): UnitEconomicsDraftState {
  const range = () => ({
    min: "",
    max: "",
    basis: "" as const,
    evidenceRefs: [],
  });
  return {
    currencyCode: "",
    scenarios: {
      baseline: {
        salePrice: range(),
        landedCost: range(),
        platformFee: range(),
        fulfillmentFee: range(),
        advertisingCost: range(),
        returnCost: range(),
      },
      conservative: {
        salePrice: range(),
        landedCost: range(),
        platformFee: range(),
        fulfillmentFee: range(),
        advertisingCost: range(),
        returnCost: range(),
      },
    },
  };
}

function snapshot(): ProductInitiativeUnitEconomicsSnapshotV1 {
  const price = {
    min: "100.00",
    max: "120.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const cost = {
    min: "5.00",
    max: "10.00",
    basis: "assumption" as const,
    evidenceRefs: [],
  };
  const scenario = () => ({
    salePrice: { ...price },
    landedCost: { ...cost },
    platformFee: { ...cost },
    fulfillmentFee: { ...cost },
    advertisingCost: { ...cost },
    returnCost: { ...cost },
    contribution: { min: "50.00", max: "95.00" },
  });
  return {
    marketCode: "CA",
    channelCode: "Amazon CA",
    currencyCode: "CAD",
    scenarios: {
      baseline: scenario(),
      conservative: scenario(),
    },
  };
}
