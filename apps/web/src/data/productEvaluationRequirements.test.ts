import { describe, expect, it } from "vitest";
import {
  productEvaluationContextFor,
  productEvaluationRequirements,
} from "./productEvaluationRequirements";

describe("productEvaluationRequirements", () => {
  it("登记阶段和未进入评估的机会不产生要求，但说明缺什么", () => {
    const result = productEvaluationRequirements({
      categoryRef: null,
      evaluationStarted: false,
    });

    expect(result.requirements).toEqual([]);
    // 关键：不能只给空数组 —— 那样"不适用"和"还判断不了"在界面上分不开。
    expect(result.withheld.map((item) => item.code)).toEqual([
      "competitive_supply_evidence",
      "price_band",
      "after_sales_voice",
    ]);
    for (const item of result.withheld) {
      expect(item.missing).not.toHaveLength(0);
    }
  });

  it("对空白商品范围按未选定处理", () => {
    const result = productEvaluationRequirements({
      categoryRef: "   ",
      evaluationStarted: false,
    });

    expect(result.requirements).toEqual([]);
    expect(result.withheld.map((item) => item.code)).toContain("price_band");
  });

  it("选定商品范围后生成竞争供给与价格带要求，并说明为什么适用", () => {
    const result = productEvaluationRequirements({
      categoryRef: "庭院收纳",
      evaluationStarted: false,
    });

    expect(result.requirements.map((item) => item.code)).toEqual([
      "competitive_supply_evidence",
      "price_band",
    ]);
    for (const requirement of result.requirements) {
      expect(requirement.rationale).toContain("庭院收纳");
      expect(requirement.placeholder).not.toHaveLength(0);
    }
    // 范围已定，只有"未进入评估"这一项被 withhold。
    expect(result.withheld.map((item) => item.code)).toEqual([
      "after_sales_voice",
    ]);
  });

  it("进入评估动作后单独生成售后原声要求", () => {
    const result = productEvaluationRequirements({
      categoryRef: null,
      evaluationStarted: true,
    });

    expect(result.requirements.map((item) => item.code)).toEqual([
      "after_sales_voice",
    ]);
    // 已进入评估但范围未定 —— 两项因缺商品范围而 withhold，并写明缺的是它。
    expect(result.withheld.map((item) => item.code)).toEqual([
      "competitive_supply_evidence",
      "price_band",
    ]);
    for (const item of result.withheld) {
      expect(item.missing).toContain("商品范围");
    }
  });

  it("范围与评估动作都成立时给出全部适用要求且不重复，没有 withhold", () => {
    const result = productEvaluationRequirements({
      categoryRef: "宠物出行",
      evaluationStarted: true,
    });
    const codes = result.requirements.map((item) => item.code);

    expect(codes).toEqual([
      "competitive_supply_evidence",
      "price_band",
      "after_sales_voice",
    ]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(result.withheld).toEqual([]);
  });

  it("从机会投影出评估上下文", () => {
    expect(
      productEvaluationContextFor({
        handoff: { categoryRef: "宠物出行" },
        intakeState: "accepted",
      }),
    ).toEqual({ categoryRef: "宠物出行", evaluationStarted: true });
    expect(
      productEvaluationContextFor({
        handoff: { categoryRef: null },
        intakeState: "queued",
      }),
    ).toEqual({ categoryRef: null, evaluationStarted: false });
  });
});
