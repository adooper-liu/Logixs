import type { ProductInitiativeReviewPointCodeV1 } from "@logix/contracts";

/**
 * 评审要点方案 A：UI 用档位单选，落库仍是规范化短句（契约不改枚举）。
 * 补充说明另写，拼接在短句后，不发明新 wire 字段。
 */
export interface ReviewPointOption {
  readonly id: string;
  readonly label: string;
  /** 写入 conclusion 的权威短句。 */
  readonly sentence: string;
}

const OPTIONS: Record<
  ProductInitiativeReviewPointCodeV1,
  readonly ReviewPointOption[]
> = {
  target_user_and_market: [
    { id: "clear", label: "清晰可定位", sentence: "目标用户与市场清晰可定位" },
    {
      id: "partial",
      label: "方向明确待细化",
      sentence: "目标方向明确，细节待细化",
    },
    { id: "vague", label: "仍偏模糊", sentence: "目标用户与市场仍偏模糊" },
  ],
  competitive_supply: [
    { id: "concentrated", label: "头部集中", sentence: "头部集中" },
    { id: "moderate", label: "中等分散", sentence: "竞争中等分散" },
    { id: "long_tail", label: "长尾分散", sentence: "供给长尾分散" },
    { id: "unclear", label: "尚难判断", sentence: "竞争格局尚难判断" },
  ],
  price_band_and_margin: [
    { id: "healthy", label: "利润可接受", sentence: "价格带与利润可接受" },
    { id: "tight", label: "利润偏紧", sentence: "价格带可做但利润偏紧" },
    { id: "poor", label: "利润难支撑", sentence: "价格带与利润难支撑" },
  ],
  compliance_risk: [
    { id: "low", label: "风险可控", sentence: "合规风险可控" },
    { id: "watch", label: "需跟进认证", sentence: "合规需跟进关键认证" },
    { id: "high", label: "风险偏高", sentence: "合规风险偏高" },
  ],
  customer_feedback: [
    { id: "strong", label: "痛点明确", sentence: "客户痛点明确且可产品化" },
    { id: "mixed", label: "信号混杂", sentence: "客户反馈有信号但尚混杂" },
    { id: "weak", label: "依据不足", sentence: "客户反馈依据不足" },
  ],
};

export function reviewPointOptions(
  code: ProductInitiativeReviewPointCodeV1,
): readonly ReviewPointOption[] {
  return OPTIONS[code];
}

/** 从已落库结论反推档位；自定义/旧自由文本则无匹配。 */
export function matchReviewOptionId(
  code: ProductInitiativeReviewPointCodeV1,
  conclusion: string,
): string | null {
  const trimmed = conclusion.trim();
  if (!trimmed) return null;
  for (const option of OPTIONS[code]) {
    if (
      trimmed === option.sentence ||
      trimmed.startsWith(`${option.sentence}；`)
    ) {
      return option.id;
    }
  }
  return null;
}

/** 档位短句 + 可选补充说明 → 落库 conclusion。 */
export function composeReviewConclusion(
  sentence: string,
  supplement: string,
): string {
  const base = sentence.trim();
  const note = supplement.trim();
  if (!base) return note;
  if (!note) return base;
  return `${base}；${note}`;
}

/** 从落库结论拆出补充说明（去掉已知短句前缀）。 */
export function extractReviewSupplement(
  code: ProductInitiativeReviewPointCodeV1,
  conclusion: string,
): string {
  const trimmed = conclusion.trim();
  if (!trimmed) return "";
  for (const option of OPTIONS[code]) {
    if (trimmed === option.sentence) return "";
    const prefix = `${option.sentence}；`;
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return trimmed;
}
