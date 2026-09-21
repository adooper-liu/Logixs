import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "compliance-management",
  kind: "incremental",
  version: "1.0.0",
  depends: ["document-records", "identity", "master-data", "shipment-registry"],
  permissions: [
    "compliance.read",
    "compliance.review",
    "compliance.rule.manage",
  ],
  publicPorts: [
    "ASSESS_CARGO_READY_COMPLIANCE",
    "DECIDE_CARGO_READY_COMPLIANCE",
    "EVALUATE_CARGO_READY_COMPLIANCE",
    "GET_CARGO_READY_COMPLIANCE_ASSESSMENT",
    "PUBLISH_COMPLIANCE_RULE_VERSION",
  ],
});
