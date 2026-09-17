import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "shipment-registry",
  kind: "base",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["container.read"],
});
