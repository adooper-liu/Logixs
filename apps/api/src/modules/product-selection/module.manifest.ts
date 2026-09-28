import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "product-selection",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity", "market-intelligence"],
  permissions: ["planning.read", "planning.draft"],
  publicPorts: ["product opportunity queue intake"],
});
