import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "document-records",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["evidence.read", "evidence.submit", "evidence.review"],
});
