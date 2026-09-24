import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "shipment-registry",
  kind: "base",
  version: "1.0.0",
  depends: ["identity", "master-data"],
  permissions: ["container.read", "container.operate"],
  publicPorts: [
    "ASSERT_CONTAINER_TENANT",
    "LIST_CONTAINER_TASK_FACTS",
    "GET_CONTAINER_SUMMARY",
    "RESOLVE_CONTAINER_BY_NUMBER",
    "RESOLVE_REPLENISHMENT_ORDER_LINES",
    "BIND_REPLENISHMENT_LINE_PRODUCT_SKU",
    "REPLACE_CONTAINER_CARGO_ALLOCATIONS",
    "GET_CONTAINER_CARGO_COMPLIANCE_SCOPE",
    "GET_CONTAINER_STUFFING_READINESS",
    "REPLACE_CONTAINER_STUFFING_SNAPSHOT",
    "GET_CONTAINER_DISPATCH_READINESS",
    "REPLACE_CONTAINER_DISPATCH_SNAPSHOT",
    "INTERNAL_SHIPMENT_HANDOFF_SOURCE",
  ],
});
