import type { LifecycleEventItem } from "../api/lifecycleEvents";
import type { EventRow } from "./sample";

export const EVENT_CODE_LABELS: Record<string, string> = {
  cargo_ready: "备货完成",
  empty_picked_up: "提空箱",
  stuffed: "装箱完成",
  loaded: "装船/装车",
  departed: "离港/离站",
  sailing: "在途航行",
  gate_in: "进港/进场",
  transit_arrived: "中转抵港",
  transit_departed: "中转离港",
  arrived: "抵港",
  berthed: "靠泊",
  discharged: "卸船",
  available: "可提货",
  release: "放行",
  hold: "扣留/滞留",
  hold_released: "扣留解除",
  customs_filed: "舱单/申报",
  inspection: "查验",
  container_customs_completed: "货柜清关完成",
  rail_handover: "海铁交接完成",
  gate_out: "提柜/出场",
  delivered: "送仓/送达",
  warehouse_arrival: "到仓入库",
  unloaded: "卸柜",
  unstuffed: "卸空",
  returned_empty: "还箱",
  dumped: "甩柜",
  rolled: "漏装/改配",
  cancelled: "取消",
  changed: "变更",
  delay: "延误",
  overdue: "超期",
};

export function toLiveEvent(item: LifecycleEventItem): EventRow {
  return {
    eventCode: item.eventCode,
    label: EVENT_CODE_LABELS[item.eventCode] ?? item.eventCode,
    actual: item.occurredAt,
    evidence:
      item.evidenceRefs.length > 0 ? `${item.evidenceRefs.length} 条引用` : "—",
    eventRef: item.id,
  };
}
