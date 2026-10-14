import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "work-session",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity"],
  permissions: ["work_session.manage"],
  publicPorts: [],
});
