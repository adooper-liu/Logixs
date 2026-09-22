import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "work-execution",
  kind: "base",
  version: "1.0.0",
  depends: ["identity", "document-records", "shipment-registry"],
  permissions: ["task.read", "task.execute"],
  publicPorts: [
    "CREATE_NODE_TASK",
    "LIST_OBJECT_TASK_ACTIVITY",
    "PROJECT_EXTERNAL_WORK_ITEMS",
    "RECONCILE_APPLIED_LIFECYCLE_FACT",
  ],
});
