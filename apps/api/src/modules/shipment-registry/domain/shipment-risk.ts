/**
 * Shipment 风险：一票为什么现在需要处理，以及它在队列里该排多前。
 *
 * 纯规则，不依赖 Web/ORM。**本片只接真实的截止来源**：
 * - `eta` —— Shipment 的预计到港（`Shipment.etaAt`，真实列）
 * - `task_due` —— 当前环节工单的截止（工单 `dueAt`，真实）
 *
 * **不接免用箱期**（负责人 2026-09-27 定）：它不是可直接查的事实，而是
 * `charges-settlement` 的滞期引擎按标准与事实推导出来的，跨域且成本高。
 * 枚举里留了位置，但对外不可选、不可显示 —— 不得让人以为系统在盯免箱期。
 *
 * 另外**不设"临期"阈值**：几小时算临期是业务政策，不是这里该发明的数。
 * 紧迫度由"离截止还有多久"和排序直接表达，逾期即为负。
 */

/** 截止来源。`free_time` 预留未启用，见文件头。 */
export const SHIPMENT_DEADLINE_KINDS = [
  "eta",
  "task_due",
  "free_time",
] as const;
export type ShipmentDeadlineKind = (typeof SHIPMENT_DEADLINE_KINDS)[number];

/** 本片真正参与排序的截止来源（`free_time` 不在其中）。 */
export const ACTIVE_DEADLINE_KINDS = ["eta", "task_due"] as const;

/**
 * 「未解决」的异常案件状态。异常案件落库后一直保留，只有这两种状态表示
 * 还没处理完；统计在办异常必须按它过滤，否则已解决的也会被算成风险。
 *
 * 与 `prisma-container-operational-view.repository.ts` 里柜级视图的过滤口径相同。
 */
export const OPEN_EXCEPTION_STATUSES = ["open", "investigating"] as const;

export interface ShipmentDeadline {
  kind: ShipmentDeadlineKind;
  at: Date;
}

export interface ShipmentRiskInput {
  deadlines: readonly ShipmentDeadline[];
  /** 待补项数。**待补不是阻断**（普通缺失可继续），所以只作为理由之一。 */
  pendingGapCount: number;
  /** 该 Shipment 上未解决的异常案件数。 */
  openExceptionCount: number;
  /**
   * `shipmentId` 为空、不归属任何 Shipment 的未解决案件数。
   * 单独计数：这些在 Shipment 队列里看不见，必须说明，不得当成"没有异常"。
   */
  unassignedExceptionCount: number;
}

/** 理由按紧迫度排列，界面可照此顺序呈现。 */
export const SHIPMENT_RISK_REASONS = [
  "overdue_deadline",
  "open_exceptions",
  "unassigned_exceptions",
  "pending_gaps",
] as const;
export type ShipmentRiskReason = (typeof SHIPMENT_RISK_REASONS)[number];

export interface ShipmentRisk {
  nearestDeadline: ShipmentDeadline | null;
  overdue: boolean;
  reasons: readonly ShipmentRiskReason[];
}

export function shipmentRisk(
  input: ShipmentRiskInput,
  now: Date,
): ShipmentRisk {
  const nearestDeadline = nearestOf(input.deadlines);
  const overdue = nearestDeadline !== null && nearestDeadline.at < now;

  const reasons: ShipmentRiskReason[] = [];
  if (overdue) reasons.push("overdue_deadline");
  if (input.openExceptionCount > 0) reasons.push("open_exceptions");
  if (input.unassignedExceptionCount > 0) {
    reasons.push("unassigned_exceptions");
  }
  if (input.pendingGapCount > 0) reasons.push("pending_gaps");

  return { nearestDeadline, overdue, reasons };
}

/**
 * 队列排序值：最近的截止时刻；**没有截止返回正无穷**。
 *
 * 这条是排序正确性的关键：没有时限的票不能被当成"最紧急"排到前面，
 * 否则队列会先显示一批根本不急的，真正快到期的被压到后面。
 */
export function shipmentRiskSortValue(risk: ShipmentRisk): number {
  return risk.nearestDeadline?.at.getTime() ?? Number.POSITIVE_INFINITY;
}

function nearestOf(
  deadlines: readonly ShipmentDeadline[],
): ShipmentDeadline | null {
  let nearest: ShipmentDeadline | null = null;
  for (const candidate of deadlines) {
    if (nearest === null || candidate.at < nearest.at) nearest = candidate;
  }
  return nearest;
}
