import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "customs-compliance",
  kind: "incremental",
  version: "1.0.0",
  depends: ["shipment-registry", "identity"],
  permissions: ["container.read", "container.operate"],
});
