import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "shipment-lifecycle-orchestration",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "document-records",
    "identity",
    "lifecycle-control",
    "shipment-registry",
  ],
  permissions: ["container.operate"],
  publicPorts: [],
});
