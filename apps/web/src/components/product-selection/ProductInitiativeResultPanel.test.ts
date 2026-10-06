import type {
  ProductInitiativeDetailV1,
  ProductInitiativeEvidenceCandidateV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
} from "@logix/contracts";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ProductInitiativeReviewPointView } from "../../composables/useProductInitiativeDecision";
import ProductInitiativeResultPanel from "./ProductInitiativeResultPanel.vue";

type ProductInitiative = NonNullable<ProductInitiativeDetailV1["initiative"]>;

describe("ProductInitiativeResultPanel", () => {
  it("按投资结论摘要展示已立项事实", () => {
    const wrapper = mountPanel();
    const text = wrapper.text();

    expect(text).toContain("已立项 · 已交 NPI");
    expect(text).toContain("立项责任selector-1");
    expect(text).toContain("NPI 承接产品开发 / NPI");
    expect(text).toContain("资源说明结构工程 1 人，采购验证 1 人");
    expect(text).toContain("目标日期2026-11-15");
    expect(text).toContain("下一决策日期2026-10-20");
    expect(text).toContain("下一决策问题是否进入 EVT 打样");
    expect(text).toContain("CA · Amazon CA · 宠物出行");
    expect(text).toContain("含后补事实");
    expect(text.indexOf("经营机会")).toBeLessThan(text.indexOf("投资结论"));
    expect(text.indexOf("投资结论")).toBeLessThan(text.indexOf("评审依据"));
    expect(wrapper.findAll(".initiative-result__block")).toHaveLength(3);
    expect(wrapper.findAll(".initiative-result__facts")).toHaveLength(0);
    expect(wrapper.find("input, select, textarea").exists()).toBe(false);
  });

  it("legacy 缺失字段如实标为历史未记录，不显示待补", () => {
    const wrapper = mountPanel({
      initiative: initiative({
        receivingTeamOrRole: null,
        resourceDescription: null,
        targetDate: null,
        nextDecisionDate: null,
        nextDecisionQuestion: null,
      }),
      unitEconomicsSnapshot: null,
    });

    expect(wrapper.text()).toContain("历史缺失 2 类");
    expect(wrapper.text()).toContain("历史立项未记录");
    expect(wrapper.text()).not.toContain("待补");
  });

  it("缺少商品范围时仍如实显示三段机会范围", () => {
    const wrapper = mountPanel({ categoryRef: null });

    expect(wrapper.text()).toContain("CA · Amazon CA · 商品范围历史未记录");
  });

  it("展开评审项才展示引用证据与备注", async () => {
    const wrapper = mountPanel({
      points: [
        point({
          evidenceRefs: [EVIDENCE_ID],
          conclusion: "头部集中；头部约占六成",
        }),
      ],
    });

    const review = wrapper.get(".initiative-result__reviews details");
    expect(review.get("summary").text()).toContain("头部集中");
    await review.get("summary").trigger("click");
    expect(review.attributes("open")).toBeDefined();
    expect(review.text()).toContain("头部约占六成");
    expect(review.text()).toContain("在售同款 320 个");
  });
});

function mountPanel(
  overrides: {
    initiative?: ProductInitiative;
    points?: ProductInitiativeReviewPointView[];
    unitEconomicsSnapshot?: ProductInitiativeUnitEconomicsSnapshotV1 | null;
    categoryRef?: string | null;
  } = {},
) {
  return mount(ProductInitiativeResultPanel, {
    props: {
      title: "加拿大站宠物出行需求上升",
      marketCode: "CA",
      channelCode: "Amazon CA",
      categoryRef:
        overrides.categoryRef === undefined
          ? "宠物出行"
          : overrides.categoryRef,
      opportunityStatement: "验证加拿大站宠物出行需求是否值得形成新品立项。",
      observedFactSummary: "站内搜索量上升。",
      hypothesis: "可能存在折叠出行产品机会。",
      supplementedFactCount: 2,
      historicalMissingCategoryCount: 2,
      initiative: overrides.initiative ?? initiative(),
      points: overrides.points ?? [point()],
      candidates: [candidate()],
      unitEconomicsSnapshot:
        overrides.unitEconomicsSnapshot === undefined
          ? snapshot()
          : overrides.unitEconomicsSnapshot,
    },
  });
}

function initiative(
  overrides: Partial<ProductInitiative> = {},
): ProductInitiative {
  return {
    initiativeId: "55555555-5555-4555-8555-555555555555",
    outcome: "approve",
    completion: "completed",
    currentDestination: "handed_off",
    responsibleActorId: "selector-1",
    responsibilityAccepted: true,
    receivingTeamOrRole: "产品开发 / NPI",
    resourceDescription: "结构工程 1 人，采购验证 1 人",
    targetDate: "2026-11-15",
    nextDecisionDate: "2026-10-20",
    nextDecisionQuestion: "是否进入 EVT 打样",
    validationFocus: null,
    reconsiderationDate: null,
    unitEconomicsDraft: null,
    unitEconomicsSnapshot: null,
    negativeConservativeReason: null,
    objective: "把折叠宠物出行包做成可发布版本",
    reviewPoints: [],
    reason: null,
    returnBasis: null,
    pendingFieldCodes: [],
    version: 1,
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
    ...overrides,
  };
}

function point(
  overrides: Partial<ProductInitiativeReviewPointView> = {},
): ProductInitiativeReviewPointView {
  return {
    code: "competitive_supply",
    label: "竞争供给",
    evidenceRefs: [EVIDENCE_ID],
    conclusion: "头部集中",
    missing: false,
    gating: true,
    ...overrides,
  };
}

function candidate(): ProductInitiativeEvidenceCandidateV1 {
  return {
    evidenceId: EVIDENCE_ID,
    sourceName: "站点类目周报",
    summary: "在售同款 320 个",
    contentRef: "https://example.test/report",
    recordedAt: "2026-09-27T00:00:00.000Z",
  };
}

function snapshot(): ProductInitiativeUnitEconomicsSnapshotV1 {
  return {
    marketCode: "CA",
    channelCode: "Amazon CA",
    currencyCode: "CAD",
    scenarios: {
      baseline: { contribution: { min: "12.00", max: "18.00" } },
      conservative: { contribution: { min: "4.00", max: "8.00" } },
    },
  } as ProductInitiativeUnitEconomicsSnapshotV1;
}

const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";
