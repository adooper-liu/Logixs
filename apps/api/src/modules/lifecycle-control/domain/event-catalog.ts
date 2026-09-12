import type {
  CanonicalEventCode,
  ContainerLifecycleState,
  LifecycleNodeCode,
} from "@logix/contracts";

// 事件 → 可完成节点 的映射（来源：packages/contracts/catalogs/v1/canonical-events.json
// 的 completionEligibleNodeCodes，单一权威）。未列出的事件 = 不完成任何节点（如 sailing/hold）。
export const EVENT_TO_COMPLETION_NODES: Record<
  CanonicalEventCode,
  LifecycleNodeCode[]
> = {
  cargo_ready: ["cargo_ready"],
  empty_picked_up: [],
  stuffed: ["container_stuffing"],
  loaded: ["shipment_dispatch"],
  departed: ["origin_departure"],
  sailing: [],
  gate_in: [],
  transit_arrived: ["ocean_transit"],
  transit_departed: ["transshipment"],
  arrived: ["ocean_transit", "destination_arrival"],
  berthed: [],
  discharged: [],
  available: [],
  release: [],
  hold: [],
  hold_released: [],
  customs_filed: [],
  inspection: [],
  container_customs_completed: ["customs_clearance"],
  rail_handover: ["rail_transfer"],
  gate_out: ["container_pickup"],
  delivered: ["warehouse_delivery"],
  warehouse_arrival: ["warehouse_delivery"],
  unloaded: ["container_unloading"],
  unstuffed: ["container_unstuffing"],
  returned_empty: ["empty_return"],
  dumped: [],
  rolled: [],
  cancelled: [],
  changed: [],
  delay: [],
  overdue: [],
};

// 事件 → 容器 8 态 的推进映射（来源：CONTAINER_STATUS_MODEL 合法转换表，单一权威）。
// 未列出的事件不推进 currentStatus（如 stuffed/cargo_ready 只完成节点不改 8 态）。
export const EVENT_TO_CONTAINER_STATUS: Partial<
  Record<CanonicalEventCode, ContainerLifecycleState>
> = {
  loaded: "shipped",
  departed: "shipped",
  sailing: "in_transit",
  arrived: "at_port",
  gate_out: "picked_up",
  unloaded: "unloaded",
  returned_empty: "returned_empty",
};
