import type { ProductInitiativeQueueEntryV1 } from "@logix/contracts";

/**
 * 队列上这一条机会的立项状态。
 *
 * 存在的意义是把两种在队列里长得一样的情况分开：**还没看过**（没有 entry）
 * 与**看过但先放着**（有 entry 且还没关闭）。没有它，暂缓过的机会和没动过的
 * 机会在队列上像素级相同，岗位会重复处理同一条。
 */
export interface ProductInitiativeQueueBadge {
  label: string;
  /** pending = 看过但先放着；closed = 本次判断已关闭；handed_off = 已交给产品侧 */
  state: "pending" | "closed" | "handed_off";
  /** 还缺几项才算完成这次判断；0 表示没有待补 */
  pendingCount: number;
}

export function initiativeQueueBadge(
  entry: ProductInitiativeQueueEntryV1 | undefined,
): ProductInitiativeQueueBadge | null {
  if (!entry) return null;
  const pendingCount = entry.pendingFieldCodes.length;
  if (entry.currentDestination === "needs_decision") {
    return { label: "看过，先放着", state: "pending", pendingCount };
  }
  if (entry.currentDestination === "handed_off") {
    return { label: "已立项", state: "handed_off", pendingCount };
  }
  if (entry.currentDestination === "returned_from_npi") {
    return { label: "NPI 退回", state: "pending", pendingCount };
  }
  return {
    label: DESTINATION_LABELS[entry.currentDestination],
    state: "closed",
    pendingCount,
  };
}

const DESTINATION_LABELS = {
  deferred: "已暂缓",
  rejected: "已记录不立项",
  return_requested: "等待市场接回",
  returned_to_market: "已退回经营团队",
} as const;
