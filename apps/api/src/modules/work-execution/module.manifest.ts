import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "work-execution",
  kind: "base",
  version: "1.0.0",
  depends: [
    "identity",
    "document-records",
    "shipment-registry",
    "lifecycle-control",
  ],
  permissions: ["task.read", "task.execute"],
});
