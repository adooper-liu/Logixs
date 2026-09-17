import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "exception-management",
  kind: "base",
  version: "1.0.0",
  depends: [],
  permissions: ["reliability.read", "reliability.recover"],
});
