import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "lifecycle-control",
  kind: "base",
  version: "1.0.0",
  depends: [
    "identity",
    "notification",
    "document-records",
    "compliance-management",
    "shipment-registry",
    "work-execution",
  ],
  permissions: [
    "lifecycle.read",
    "lifecycle.operate",
    "reliability.read",
    "reliability.recover",
  ],
  publicPorts: [
    "LIST_CONTAINER_CURRENT_NODES",
    "RECORD_LIFECYCLE_DATE_FACT",
    "REPLAY_PENDING_LIFECYCLE_DATE_FACTS",
    "REPLACE_OCEAN_ROUTE",
  ],
});
