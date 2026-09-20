import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "master-data",
  kind: "base",
  version: "1.0.0",
  depends: [],
  permissions: [],
  publicPorts: [
    "GET_PRODUCT_COMPLIANCE_PROFILE",
    "GET_PRODUCT_SKU",
    "REGISTER_PRODUCT_SKU",
    "REPLACE_PRODUCT_COMPLIANCE_PROFILE",
  ],
});
