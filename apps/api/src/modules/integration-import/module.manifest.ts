import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "integration-import",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "identity",
    "ai-governance",
    "shipment-registry",
    "lifecycle-control",
    "shipment-lifecycle-orchestration",
    "master-data",
    "document-records",
  ],
  permissions: ["import.read", "import.operate", "import.execute"],
});
