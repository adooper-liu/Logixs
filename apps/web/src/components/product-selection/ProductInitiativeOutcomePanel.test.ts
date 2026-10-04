import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { ProductInitiativeReturnBasisV1 } from "@logix/contracts";
import type {
  ProductInitiativeGap,
  ProductInitiativeOutcome,
} from "../../composables/useProductInitiativeDecision";
import ProductInitiativeOutcomePanel from "./ProductInitiativeOutcomePanel.vue";

interface PanelProps {
  outcome: ProductInitiativeOutcome;
  objective: string;
  acceptResponsibility: boolean;
  receivingTeamOrRole: string;
  resourceDescription: string;
  targetDate: string;
  nextDecisionDate: string;
  nextDecisionQuestion: string;
  reconsiderationDate: string;
  reason: string;
  returnBasis: ProductInitiativeReturnBasisV1 | "";
  gaps: ProductInitiativeGap[];
  busy: boolean;
  decided: boolean;
}

describe("ProductInitiativeOutcomePanel", () => {
  it("四个去向都列出，切换去向把选择交给上层", async () => {
    const wrapper = mountPanel();

    const options = wrapper.findAll(".destination");
    expect(options.map((node) => node.get("b").text())).toEqual([
      "立项",
      "暂缓",
      "不立项",
      "退回经营团队",
    ]);

    await options[1]!.get("input").setValue(true);

    expect(wrapper.emitted("changeOutcome")).toEqual([["defer"]]);
  });

  it("立项时显示目标结果与缺口清单，暂缓时改成写原因", () => {
    const approving = mountPanel({
      outcome: "approve",
      gaps: [gap("合规风险")],
    });
    expect(approving.find('textarea[aria-label="目标结果"]').exists()).toBe(
      true,
    );
    expect(approving.find(".gap-list").exists()).toBe(true);
    expect(approving.find('textarea[aria-label="暂缓原因"]').exists()).toBe(
      false,
    );

    const deferring = mountPanel({ outcome: "defer" });
    expect(deferring.find('textarea[aria-label="目标结果"]').exists()).toBe(
      false,
    );
    expect(deferring.find(".gap-list").exists()).toBe(false);
    expect(
      deferring.find('textarea[aria-label="这次要验证什么"]').exists(),
    ).toBe(true);
    expect(deferring.find('input[aria-label="哪天重判"]').exists()).toBe(true);
  });

  it("把立项承诺按责任资源与时间决策分组，不增加第二套输入", () => {
    const wrapper = mountPanel({ outcome: "approve" });
    const groups = wrapper.findAll(".commitment-group");

    expect(groups.map((group) => group.get("legend").text())).toEqual([
      "责任与资源",
      "时间与下一决策",
    ]);
    expect(groups[0]!.text()).toContain("谁负责、由谁承接、投入什么资源");
    expect(
      groups[0]!.findAll('input[aria-label="承接团队或岗位"]'),
    ).toHaveLength(1);
    expect(groups[0]!.findAll('textarea[aria-label="资源说明"]')).toHaveLength(
      1,
    );
    expect(groups[1]!.text()).toContain("什么时候拿到结果、下一次决定什么");
    expect(groups[1]!.findAll('input[aria-label="目标日期"]')).toHaveLength(1);
    expect(groups[1]!.findAll('input[aria-label="下一决策日期"]')).toHaveLength(
      1,
    );
    expect(
      groups[1]!.findAll('textarea[aria-label="下一决策问题"]'),
    ).toHaveLength(1);
    expect(wrapper.findAll('textarea[aria-label="目标结果"]')).toHaveLength(1);
  });

  it("要点没齐时不能立项，主按钮说明还差几项而不是静默失败", async () => {
    const wrapper = mountPanel({
      outcome: "approve",
      gaps: [gap("目标结果"), gap("合规风险"), gap("价格带与利润")],
    });

    const button = wrapper.get(".outcome-submit");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.text()).toContain("还差 3 项才能立项");
    expect(wrapper.findAll(".gap-list li").map((node) => node.text())).toEqual([
      "目标结果在上面的「目标结果」里补",
      "合规风险在评审要点面板里补",
      "价格带与利润在评审要点面板里补",
    ]);
    await button.trigger("click");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("缺口逐项说清在哪补 —— 目标结果与评审要点不在同一个面板", () => {
    const wrapper = mountPanel({
      outcome: "approve",
      gaps: [gap("目标结果"), gap("合规风险")],
    });

    expect(wrapper.findAll(".gap-list li").map((node) => node.text())).toEqual([
      "目标结果在上面的「目标结果」里补",
      "合规风险在评审要点面板里补",
    ]);
  });

  it("要点齐备时主按钮可用且说明可以立项", () => {
    const wrapper = mountPanel({ outcome: "approve", gaps: [] });

    expect(wrapper.get(".outcome-hint").text()).toContain("可以立项");
    expect(
      wrapper.get(".outcome-submit").attributes("disabled"),
    ).toBeUndefined();
  });

  it.each([
    ["全缺", "", ""],
    ["只填验证重点", "核实大促后的真实转化", ""],
    ["只填日期", "", "2026-10-20"],
  ])(
    "暂缓%s时仍可保存，但提示与 CTA 都明确待补",
    async (_case, reason, reconsiderationDate) => {
      const wrapper = mountPanel({
        outcome: "defer",
        gaps: [gap("合规风险")],
        reason,
        reconsiderationDate,
      });

      const button = wrapper.get(".outcome-submit");
      expect(button.attributes("disabled")).toBeUndefined();
      expect(button.text()).toBe("保存为待补");
      expect(wrapper.get(".outcome-hint").text()).toContain("待补");
      expect(wrapper.get(".outcome-hint").text()).toContain("不会关闭");

      await button.trigger("click");
      expect(wrapper.emitted("submit")).toEqual([["defer"]]);
    },
  );

  it("暂缓验证重点与重判日期齐全时才提示提交后关闭", () => {
    const wrapper = mountPanel({
      outcome: "defer",
      reason: "核实大促后的真实转化",
      reconsiderationDate: "2026-10-20",
    });

    expect(wrapper.get(".outcome-hint").text()).toContain(
      "提交后本次判断会关闭",
    );
    expect(wrapper.get(".outcome-submit").text()).toBe("暂缓此机会");
  });

  it("退回没选依据时不能提交，即使已经写了原因", async () => {
    const wrapper = mountPanel({
      outcome: "return_to_market",
      reason: "证据不足以判断是否存在需求",
    });

    const button = wrapper.get(".outcome-submit");
    expect(wrapper.get(".outcome-hint").text()).toContain("请选择退回依据");
    expect(button.text()).toContain("请选择退回依据");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("选了依据并写了原因后，说明本次退回请求会关闭", () => {
    const wrapper = mountPanel({
      outcome: "return_to_market",
      reason: "需要补渠道销量",
      returnBasis: "insufficient_evidence",
    });

    expect(wrapper.get(".outcome-hint").text()).toContain("关闭");
    expect(wrapper.get(".outcome-submit").text()).toContain("请求退回市场");
    expect(
      wrapper.get(".outcome-submit").attributes("disabled"),
    ).toBeUndefined();
  });

  it("目标结果与原因都由上层持有，组件只透传输入", async () => {
    const approving = mountPanel({ outcome: "approve" });
    await approving
      .get('textarea[aria-label="目标结果"]')
      .setValue("做成可发布版本");
    expect(approving.emitted("updateObjective")).toEqual([["做成可发布版本"]]);

    const rejecting = mountPanel({ outcome: "reject" });
    await rejecting
      .get('textarea[aria-label="不立项原因"]')
      .setValue("利润太薄");
    expect(rejecting.emitted("updateReason")).toEqual([["利润太薄"]]);
  });

  it("输入长度上限与服务端契约一致，不让人写完才被 400 拒绝", () => {
    const approving = mountPanel({ outcome: "approve" });
    expect(
      approving.get('textarea[aria-label="目标结果"]').attributes("maxlength"),
    ).toBe("4000");

    const deferring = mountPanel({ outcome: "defer" });
    expect(
      deferring
        .get('textarea[aria-label="这次要验证什么"]')
        .attributes("maxlength"),
    ).toBe("2000");
  });

  it("已立项是终态，不再提供任何判断动作", () => {
    const wrapper = mountPanel({
      outcome: "approve",
      gaps: [],
      decided: true,
    });

    expect(wrapper.find(".destination").exists()).toBe(false);
    expect(wrapper.find(".outcome-submit").exists()).toBe(false);
    expect(wrapper.text()).toContain("已立项");
  });
});

/**
 * 缺口带"在哪补"。缺的两类东西在两个不同的面板里 —— 只说"还差 N 项"、
 * 或一句话把全部缺口指去同一个面板，人就会在错的地方找。
 */
function gap(label: string): ProductInitiativeGap {
  return {
    label,
    panel: label === "目标结果" ? "objective" : "review_points",
  };
}

function mountPanel(overrides: Partial<PanelProps> = {}) {
  return mount(ProductInitiativeOutcomePanel, {
    props: { ...defaultProps(), ...overrides },
  });
}

function defaultProps(): PanelProps {
  return {
    outcome: "approve",
    objective: "",
    acceptResponsibility: false,
    receivingTeamOrRole: "",
    resourceDescription: "",
    targetDate: "",
    nextDecisionDate: "",
    nextDecisionQuestion: "",
    reconsiderationDate: "",
    reason: "",
    returnBasis: "",
    gaps: [],
    busy: false,
    decided: false,
  };
}
