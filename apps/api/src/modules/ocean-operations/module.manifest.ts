import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "ocean-operations",
  kind: "incremental",
  version: "1.0.0",
  depends: ["lifecycle-control", "shipment-registry", "ocean-port-visibility"],
  permissions: [],
});
