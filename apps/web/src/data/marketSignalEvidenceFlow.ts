import type {
  MarketSignalGapCode,
  MarketSignalScenario,
} from "./marketSignalScenarios";

/** 按钮/就近动作：状态文案不得出现在按钮上。 */
export function marketSignalGapActionVerb(code: MarketSignalGapCode): string {
  switch (code) {
    case "market":
      return "填写市场";
    case "channel":
      return "选择渠道";
    case "category":
      return "选择商品范围";
    case "observed_fact":
      return "添加事实";
    case "hypothesis":
      return "填写经营判断";
    case "source_evidence":
      return "添加证据";
    case "source_name":
      return "填写来源名称";
  }
}

const SITE_MARKET_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/美国站/, "美国"],
  [/加拿大站/, "加拿大"],
  [/法国站/, "法国"],
  [/英国站/, "英国"],
  [/德国站/, "德国"],
  [/日本站/, "日本"],
  [/澳洲站|澳大利亚站/, "澳大利亚"],
];

export interface MarketSignalPrefillSuggestion {
  readonly market?: string;
  readonly channel?: string;
  readonly category?: string;
}

/** 从标题做弱推导；不可靠则返回空，不强行假填。 */
export function deriveMarketSignalPrefill(
  title: string,
): MarketSignalPrefillSuggestion {
  const suggestion: {
    market?: string;
    channel?: string;
    category?: string;
  } = {};
  for (const [pattern, market] of SITE_MARKET_HINTS) {
    if (pattern.test(title)) {
      suggestion.market = market;
      break;
    }
  }
  return suggestion;
}

export function marketSignalEvidenceCompleteness(
  signal: MarketSignalScenario,
): {
  filled: number;
  total: number;
  remaining: number;
} {
  const checks = [
    Boolean(signal.market),
    Boolean(signal.channel),
    Boolean(signal.category),
    signal.observedFacts.length > 0,
    Boolean(signal.hypothesis),
    signal.evidence.length > 0,
  ];
  const filled = checks.filter(Boolean).length;
  return {
    filled,
    total: checks.length,
    remaining: signal.gaps.length,
  };
}

/** 事实未齐时锁定经营判断：至少一条观察事实。 */
export function marketSignalFactsReady(signal: MarketSignalScenario): boolean {
  return signal.observedFacts.length > 0;
}

export function marketSignalEvidenceHeading(title: string): string {
  const short = title.trim();
  return short ? `${short} · 依据与判断` : "依据与判断";
}
