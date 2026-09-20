import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "shipment-registry",
  kind: "base",
  version: "1.0.0",
  depends: ["identity", "master-data"],
  permissions: ["container.read"],
  publicPorts: [
    "ASSERT_CONTAINER_TENANT",
    "LIST_CONTAINER_TASK_FACTS",
    "GET_CONTAINER_SUMMARY",
    "RESOLVE_CONTAINER_BY_NUMBER",
    "BIND_REPLENISHMENT_LINE_PRODUCT_SKU",
    "REPLACE_CONTAINER_CARGO_ALLOCATIONS",
  ],
});
