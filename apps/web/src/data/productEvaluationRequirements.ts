// 选品评估阶段的专业证据要求。
//
// 这些要求只在“已选定商品范围”或“已进入具体评估动作”后由适用规则生成，
// 不进入市场信号的登记阶段，也不冒充市场信号的通用待补缺口。每条要求都
// 必须能说明自己为什么适用，并落到一个可直接执行的“添加证据”动作上。

export type ProductEvaluationRequirementCode =
  "competitive_supply_evidence" | "price_band" | "after_sales_voice";

export interface ProductEvaluationRequirement {
  code: ProductEvaluationRequirementCode;
  /** 面向业务人员的短标签，例如“价格带”。 */
  label: string;
  /** 补录表单的字段名。 */
  fieldLabel: string;
  placeholder: string;
  /** 这条要求为什么适用于当前机会；用于说明适用依据，不代替业务判断。 */
  rationale: string;
}

export interface ProductEvaluationContext {
  /** 已选定商品范围（业务可识别的商品范围引用）。 */
  categoryRef: string | null | undefined;
  /** 已进入具体评估动作（接受经营机会、进入立项判断）。 */
  evaluationStarted: boolean;
}

export interface ProductEvaluationEvidenceDraft {
  requirementCode: ProductEvaluationRequirementCode;
  content: string;
  sourceName: string;
  sourceUrl: string;
}

/**
 * 因前置条件未满足、暂时生成不了的要求。
 *
 * 存在的意义是把两种在界面上长得一样的情况分开：
 * - **不适用** —— 这条机会本来就不需要它，不会出现在这里；
 * - **还判断不了** —— 缺前置条件，出现在这里并说明缺什么。
 *
 * 不这样做的话，两者都表现为"没有这条要求"，业务人员分不出来。
 */
export interface ProductEvaluationWithheld {
  code: ProductEvaluationRequirementCode;
  label: string;
  /** 缺什么才能生成它，用业务人员能补的动作表述。 */
  missing: string;
}

export interface ProductEvaluationRequirementSet {
  requirements: readonly ProductEvaluationRequirement[];
  withheld: readonly ProductEvaluationWithheld[];
}

export function productEvaluationContextFor(opportunity: {
  handoff: { categoryRef?: string | null };
  intakeState: string;
}): ProductEvaluationContext {
  return {
    categoryRef: opportunity.handoff.categoryRef,
    evaluationStarted: opportunity.intakeState === "accepted",
  };
}

/**
 * 按适用规则生成专业要求：
 *
 * - 登记阶段和尚未进入评估的机会不产生任何专业要求。
 * - 选定商品范围后，才需要围绕该范围核对竞争供给和目标价格带。
 * - 进入评估动作后，才需要核对售后原声。
 *
 * 不适用这条机会的要求不会出现在 requirements 里；缺前置条件、暂时生成不了的
 * 进入 withheld 并说明缺什么 —— 两者必须能分开，否则业务人员只看到"没有要求"。
 */
export function productEvaluationRequirements(
  context: ProductEvaluationContext,
): ProductEvaluationRequirementSet {
  const scope = context.categoryRef?.trim() ? context.categoryRef.trim() : null;
  const requirements: ProductEvaluationRequirement[] = [];
  const withheld: ProductEvaluationWithheld[] = [];

  if (scope) {
    requirements.push({
      code: "competitive_supply_evidence",
      label: "竞争供给证据",
      fieldLabel: "竞争供给证据",
      placeholder: "摘录竞争商品数量、销量分布或供给饱和程度的关键事实",
      rationale: `已选定商品范围「${scope}」，需要竞争供给事实判断该范围是否已有稳定或饱和的供给。`,
    });
    requirements.push({
      code: "price_band",
      label: "目标价格带",
      fieldLabel: "目标价格带",
      placeholder: "填写主流成交价格区间、币种和观察结论",
      rationale: `已选定商品范围「${scope}」，价格带决定目标定位、利润空间和竞争落点。`,
    });
  } else {
    withheld.push(
      {
        code: "competitive_supply_evidence",
        label: "竞争供给证据",
        missing: "尚未选定商品范围",
      },
      {
        code: "price_band",
        label: "目标价格带",
        missing: "尚未选定商品范围",
      },
    );
  }

  if (context.evaluationStarted) {
    requirements.push({
      code: "after_sales_voice",
      label: "售后原声",
      fieldLabel: "售后原声样本",
      placeholder: "摘录能说明真实退货、评价或使用问题的原声样本",
      rationale:
        "已进入选品评估，需要售后原声判断真实使用问题、退货风险和可改进点。",
    });
  } else {
    withheld.push({
      code: "after_sales_voice",
      label: "售后原声",
      missing: "尚未进入选品评估",
    });
  }

  return { requirements, withheld };
}
