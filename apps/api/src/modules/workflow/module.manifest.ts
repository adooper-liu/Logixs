import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "workflow",
  kind: "base",
  version: "1.0.0",
  depends: ["identity"],
  permissions: [],
});
