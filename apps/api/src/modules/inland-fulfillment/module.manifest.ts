import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "inland-fulfillment",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity", "shipment-registry", "charges-settlement"],
  permissions: ["planning.read", "planning.draft"],
  webNavContribution: true,
});
