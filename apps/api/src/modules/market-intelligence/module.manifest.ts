import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "market-intelligence",
  kind: "incremental",
  version: "1.0.0",
  depends: ["document-records", "identity"],
  permissions: ["planning.read", "planning.draft"],
  publicPorts: ["market_opportunity_handoff.v1", "APPLY_SELECTION_RETURN"],
});
