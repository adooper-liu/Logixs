import type {
  ContainerLifecycleState,
  LifecycleNodeCode,
} from "@logix/contracts";

// 容器 8 态顺序（来源：CONTAINER_STATUS_MODEL 主链，单一权威）。用于 R2 状态单调校验。
export const CONTAINER_STATUS_ORDER: Record<ContainerLifecycleState, number> = {
  not_shipped: 0,
  shipped: 1,
  in_transit: 2,
  at_port: 3,
  picked_up: 4,
  unloaded: 5,
  returned_empty: 6,
  cancelled: 7,
};

// 节点顺序（来源：lifecycle-nodes.json 的 sequence，单一权威）。
export const NODE_SEQUENCE: Record<LifecycleNodeCode, number> = {
  cargo_ready: 1,
  container_stuffing: 2,
  shipment_dispatch: 3,
  origin_departure: 4,
  ocean_transit: 5,
  transshipment: 6,
  customs_clearance: 7,
  destination_arrival: 8,
  rail_transfer: 9,
  container_pickup: 10,
  warehouse_delivery: 11,
  container_unloading: 12,
  container_unstuffing: 13,
  empty_return: 14,
};

// 节点 → 容器 8 态 的映射（来源：CONTAINER_LIFECYCLE 14 节点表，单一权威）。
// 第一刀硬编码；后续若需数据驱动，升格为配置/Seed。
export const NODE_TO_CONTAINER_STATUS: Record<
  LifecycleNodeCode,
  ContainerLifecycleState
> = {
  cargo_ready: "not_shipped",
  container_stuffing: "not_shipped",
  shipment_dispatch: "shipped",
  origin_departure: "shipped",
  ocean_transit: "in_transit",
  transshipment: "in_transit",
  customs_clearance: "at_port",
  destination_arrival: "at_port",
  rail_transfer: "at_port",
  container_pickup: "picked_up",
  warehouse_delivery: "picked_up",
  container_unloading: "unloaded",
  container_unstuffing: "unloaded",
  empty_return: "returned_empty",
};
