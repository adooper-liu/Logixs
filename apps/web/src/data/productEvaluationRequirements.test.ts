import { describe, expect, it } from "vitest";
import {
  productEvaluationContextFor,
  productEvaluationRequirements,
} from "./productEvaluationRequirements";

describe("productEvaluationRequirements", () => {
  it("任何阶段只提供静态证据提示，不生成适用性结论", () => {
    const result = productEvaluationRequirements({
      categoryRef: null,
      evaluationStarted: false,
    });

    expect(result.requirements.map((item) => item.code)).toEqual([
      "competitive_supply_evidence",
      "price_band",
      "after_sales_voice",
    ]);
    expect(result.withheld).toEqual([]);
    expect(
      result.requirements.every((item) => item.rationale.includes("不表示")),
    ).toBe(true);
  });

  it("对空白商品范围按未选定处理", () => {
    const result = productEvaluationRequirements({
      categoryRef: "   ",
      evaluationStarted: false,
    });

    expect(result.requirements).toHaveLength(3);
    expect(result.withheld).toEqual([]);
  });

  it("商品范围不会改变静态证据提示集合", () => {
    const result = productEvaluationRequirements({
      categoryRef: "庭院收纳",
      evaluationStarted: false,
    });

    expect(result.requirements.map((item) => item.code)).toEqual([
      "competitive_supply_evidence",
      "price_band",
      "after_sales_voice",
    ]);
    expect(result.requirements).toHaveLength(3);
    expect(
      result.requirements.every((item) => item.placeholder.length > 0),
    ).toBe(true);
    expect(result.withheld).toEqual([]);
  });

  it("进入评估动作不会生成新的适用性判断", () => {
    const result = productEvaluationRequirements({
      categoryRef: null,
      evaluationStarted: true,
    });

    expect(result.requirements).toHaveLength(3);
    expect(result.withheld).toEqual([]);
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
