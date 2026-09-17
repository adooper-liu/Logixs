import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "audit",
  kind: "base",
  version: "1.0.0",
  depends: [],
  permissions: ["audit.read"],
});
