import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "compliance-lifecycle-orchestration",
  kind: "incremental",
  version: "1.0.0",
  depends: [
    "compliance-management",
    "identity",
    "lifecycle-control",
    "work-execution",
  ],
  permissions: ["compliance.review"],
  publicPorts: [],
});
