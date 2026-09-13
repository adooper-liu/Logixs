import type { LifecycleNodeCode } from "@logix/contracts";

// 运行时校验用。权威枚举：packages/contracts/schemas/v1/common.schema.json#LifecycleNodeCode。
export const LIFECYCLE_NODE_CODES: readonly LifecycleNodeCode[] = [
  "cargo_ready",
  "container_stuffing",
  "shipment_dispatch",
  "origin_departure",
  "ocean_transit",
  "transshipment",
  "customs_clearance",
  "destination_arrival",
  "rail_transfer",
  "container_pickup",
  "warehouse_delivery",
  "container_unloading",
  "container_unstuffing",
  "empty_return",
];

export function isLifecycleNodeCode(value: string): value is LifecycleNodeCode {
  return (LIFECYCLE_NODE_CODES as readonly string[]).includes(value);
}
