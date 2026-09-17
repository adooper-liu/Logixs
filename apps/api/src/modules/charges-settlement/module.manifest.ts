import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "charges-settlement",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["charges.read", "charges.manage"],
});
