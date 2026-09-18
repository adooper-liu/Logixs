import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "ops-assistant",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "identity",
    "notification",
    "ai-governance",
    "shipment-registry",
    "lifecycle-control",
    "work-execution",
  ],
  permissions: ["notification.read"],
});
