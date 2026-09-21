import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "inland-lifecycle-orchestration",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "document-records",
    "identity",
    "inland-fulfillment",
    "lifecycle-control",
  ],
  permissions: ["container.operate"],
});
