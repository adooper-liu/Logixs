import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "customs-lifecycle-orchestration",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "customs-compliance",
    "document-records",
    "identity",
    "lifecycle-control",
  ],
  permissions: ["container.operate"],
});
