import type { ProductInitiativeEvidenceCandidateV1 } from "@logix/contracts";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { ProductInitiativeReviewPointView } from "../../composables/useProductInitiativeDecision";
import ProductInitiativeReviewPanel from "./ProductInitiativeReviewPanel.vue";

const EVIDENCE_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_EVIDENCE_ID = "00000000-0000-4000-8000-000000000002";

describe("ProductInitiativeReviewPanel", () => {
  it("四项要点以紧凑状态列出，只展开首个未齐项", async () => {
    const wrapper = mountPanel();

    const points = wrapper.findAll(".review-point");
    expect(points.map((node) => node.get("b").text())).toEqual([
      "目标用户与市场",
      "竞争供给",
      "价格带与利润",
      "合规风险",
    ]);
    expect(wrapper.findAll("button.add-evidence")).toHaveLength(1);
    expect(
      points[0]!.get(".review-point__toggle").attributes("aria-expanded"),
    ).toBe("true");
    expect(
      points[1]!.get(".review-point__toggle").attributes("aria-expanded"),
    ).toBe("false");
    expect(points[1]!.text()).toContain("缺证据");
    expect(points[1]!.text()).not.toContain("0 条证据");
  });

  it("切换要点后只显示当前项的详细编辑区", async () => {
    const wrapper = mountPanel();
    const points = wrapper.findAll(".review-point");

    await points[1]!.get(".review-point__toggle").trigger("click");

    expect(
      points[0]!.get(".review-point__toggle").attributes("aria-expanded"),
    ).toBe("false");
    expect(
      points[1]!.get(".review-point__toggle").attributes("aria-expanded"),
    ).toBe("true");
    expect(points[0]!.find("button.add-evidence").exists()).toBe(false);
    expect(points[1]!.find("button.add-evidence").exists()).toBe(true);
  });

  it("切换要点不会丢失未提交的证据草稿", async () => {
    const wrapper = mountPanel();
    const points = wrapper.findAll(".review-point");

    await points[0]!.get("button.add-evidence").trigger("click");
    await wrapper
      .get('textarea[aria-label="目标用户与市场证据内容"]')
      .setValue("目标市场搜索量连续三周上升。");
    await points[1]!.get(".review-point__toggle").trigger("click");
    await points[0]!.get(".review-point__toggle").trigger("click");

    expect(
      (
        wrapper.get('textarea[aria-label="目标用户与市场证据内容"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("目标市场搜索量连续三周上升。");
  });

  it("已引用的证据只读呈现当时事实，不给编辑入口", async () => {
    const wrapper = mountPanel({
      points: [
        point({
          code: "competitive_supply",
          label: "竞争供给",
          evidenceRefs: [EVIDENCE_ID],
          conclusion: "头部集中",
          missing: false,
        }),
      ],
    });

    const facts = wrapper.get(".review-point__facts");
    expect(facts.text()).toContain("证据");
    expect(facts.text()).toContain("站点类目周报");
    expect(facts.text()).toContain("在售同款 320 个");
    expect(facts.text()).toContain("https://example.test/report");
    // 事实来自证据区，要点里不能再写一份
    expect(facts.find("input, textarea").exists()).toBe(false);
  });

  it("没有引用证据时说明事实从哪来，不冒充已有结论", async () => {
    const wrapper = mountPanel();

    expect(wrapper.get(".review-point__facts").text()).toContain(
      "暂无已引用证据",
    );
  });

  it("勾选与取消引用已登记证据都发给上层，不在组件里自己改草稿", async () => {
    const wrapper = mountPanel();
    await wrapper.get(".picker-toggle").trigger("click");
    const box = wrapper.get(
      `input[type="checkbox"][value="${OTHER_EVIDENCE_ID}"]`,
    );

    await box.setValue(true);
    await box.setValue(false);

    expect(wrapper.emitted("toggleEvidence")).toEqual([
      ["target_user_and_market", OTHER_EVIDENCE_ID],
      ["target_user_and_market", OTHER_EVIDENCE_ID],
    ]);
  });

  it("判断强度单选落库为规范化短句", async () => {
    const wrapper = mountPanel({
      points: [
        point({
          code: "compliance_risk",
          label: "合规风险",
          evidenceRefs: [EVIDENCE_ID],
          conclusion: "",
          missing: true,
        }),
      ],
    });

    await wrapper.get('input[type="radio"][value="low"]').setValue(true);

    expect(wrapper.emitted("updateConclusion")).toEqual([
      ["compliance_risk", "合规风险可控"],
    ]);
  });

  it("缺证据或缺结论的要点标出缺口，齐备的不标；不写待补催办", () => {
    const wrapper = mountPanel({
      points: [
        point({
          code: "competitive_supply",
          label: "竞争供给",
          missing: false,
        }),
        point({
          code: "compliance_risk",
          label: "合规风险",
          evidenceRefs: [EVIDENCE_ID],
          conclusion: "",
          missing: true,
        }),
      ],
    });

    const points = wrapper.findAll(".review-point");
    expect(points[0]!.find(".review-point__gap").exists()).toBe(false);
    expect(points[1]!.get(".review-point__gap").text()).toContain("缺结论");
    expect(points[1]!.get(".review-point__gap").text()).not.toContain("待补");
  });

  it("登记新证据走既有证据链路，成功后收起表单", async () => {
    const addEvidence = vi.fn().mockResolvedValue(true);
    const wrapper = mountPanel({ addEvidence });

    await wrapper.findAll("button.add-evidence")[0]!.trigger("click");
    await wrapper
      .get('textarea[aria-label="目标用户与市场证据内容"]')
      .setValue("目标市场搜索量连续三周上升。");
    await wrapper
      .get('input[aria-label="目标用户与市场证据来源名称"]')
      .setValue("站点周报");
    await wrapper.get(".evidence-form").trigger("submit");
    await Promise.resolve();

    expect(addEvidence).toHaveBeenCalledWith({
      sourceName: "站点周报",
      sourceUrl: "",
      content: "目标市场搜索量连续三周上升。",
    });
    expect(wrapper.find(".evidence-form").exists()).toBe(false);
  });

  it("登记失败时保留已填内容，不假装保存成功", async () => {
    const addEvidence = vi.fn().mockResolvedValue(false);
    const wrapper = mountPanel({ addEvidence });

    await wrapper.findAll("button.add-evidence")[0]!.trigger("click");
    await wrapper
      .get('textarea[aria-label="目标用户与市场证据内容"]')
      .setValue("目标市场搜索量连续三周上升。");
    await wrapper.get(".evidence-form").trigger("submit");
    await Promise.resolve();

    expect(wrapper.find(".evidence-form").exists()).toBe(true);
    expect(
      (
        wrapper.get('textarea[aria-label="目标用户与市场证据内容"]')
          .element as HTMLTextAreaElement
      ).value,
    ).toBe("目标市场搜索量连续三周上升。");
  });

  it("引用的证据已不在候选里时不说“已成立”，而是说明引用要重做", () => {
    const wrapper = mountPanel({
      candidates: [otherCandidate()],
      points: [
        point({
          code: "competitive_supply",
          label: "竞争供给",
          evidenceRefs: [EVIDENCE_ID],
          conclusion: "头部集中",
          missing: false,
        }),
      ],
    });

    const node = wrapper.get(".review-point");
    expect(node.find(".review-point__ok").exists()).toBe(false);
    expect(node.get(".review-point__stale").text()).toContain("引用失效");
  });

  it("结论长度上限与服务端契约一致，不让人写完才被 400 拒绝", () => {
    const wrapper = mountPanel();

    expect(
      wrapper
        .get('textarea[aria-label="目标用户与市场结论"]')
        .attributes("maxlength"),
    ).toBe("4000");
  });

  it("只服务工作态，始终提供可编辑的评审输入", () => {
    const wrapper = mountPanel();

    expect(wrapper.find("textarea").attributes("readonly")).toBeUndefined();
    expect(
      wrapper.find('input[type="radio"]').attributes("disabled"),
    ).toBeUndefined();
  });
});

function mountPanel(
  overrides: {
    points?: ProductInitiativeReviewPointView[];
    candidates?: ProductInitiativeEvidenceCandidateV1[];
    addEvidence?: (draft: {
      sourceName: string;
      sourceUrl: string;
      content: string;
    }) => Promise<boolean>;
  } = {},
) {
  return mount(ProductInitiativeReviewPanel, {
    props: {
      points: overrides.points ?? [
        point({ code: "target_user_and_market", label: "目标用户与市场" }),
        point({ code: "competitive_supply", label: "竞争供给" }),
        point({ code: "price_band_and_margin", label: "价格带与利润" }),
        point({ code: "compliance_risk", label: "合规风险" }),
      ],
      candidates: overrides.candidates ?? [candidate(), otherCandidate()],
      busy: false,
      addEvidence: overrides.addEvidence ?? vi.fn().mockResolvedValue(true),
    },
  });
}

function point(
  overrides: Partial<ProductInitiativeReviewPointView> = {},
): ProductInitiativeReviewPointView {
  return {
    code: "target_user_and_market",
    label: "目标用户与市场",
    evidenceRefs: [],
    conclusion: "",
    missing: true,
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

function otherCandidate(): ProductInitiativeEvidenceCandidateV1 {
  return {
    evidenceId: OTHER_EVIDENCE_ID,
    sourceName: "售后原声导出",
    summary: "三个月内 41 条差评指向收纳",
    contentRef: "https://example.test/reviews",
    recordedAt: "2026-09-27T00:00:00.000Z",
  };
}
