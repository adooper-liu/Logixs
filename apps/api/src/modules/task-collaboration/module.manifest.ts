import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "task-collaboration",
  kind: "incremental",
  version: "1.0.0",
  depends: ["identity", "work-execution", "document-records"],
  permissions: ["task.read", "task.collaborate"],
});
