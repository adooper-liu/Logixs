import type { ProductOpportunityV1 } from "@logix/contracts";

/**
 * 从机会合并视图（含后补）拼可带入的目标结果草稿。
 * 只填空位：已有人手写的 objective 不覆盖。
 */
export function buildObjectiveFromHandoff(item: ProductOpportunityV1): string {
  const h = item.handoff;
  const bits = [
    h.marketCode && `市场：${h.marketCode}`,
    h.channelCode && `渠道：${h.channelCode}`,
    h.categoryRef && `范围：${h.categoryRef}`,
    h.opportunityStatement?.trim(),
    h.hypothesis?.trim() && `经营判断：${h.hypothesis.trim()}`,
  ].filter(Boolean);
  return bits.join("。").slice(0, 4000);
}

export function applyHandoffToObjective(options: {
  current: string;
  item: ProductOpportunityV1;
}): { next: string; applied: boolean } {
  if (options.current.trim()) {
    return { next: options.current, applied: false };
  }
  const next = buildObjectiveFromHandoff(options.item);
  return { next, applied: Boolean(next) };
}
