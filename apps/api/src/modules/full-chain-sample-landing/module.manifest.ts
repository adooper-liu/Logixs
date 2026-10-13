import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "full-chain-sample-landing",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["import.read", "import.execute"],
  publicPorts: [],
});
