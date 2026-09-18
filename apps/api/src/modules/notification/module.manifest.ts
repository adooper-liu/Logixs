import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "notification",
  kind: "base",
  version: "1.0.0",
  depends: ["identity", "ai-governance"],
  permissions: ["notification.read"],
  publicPorts: ["POST_NOTIFICATION", "LIST_OBJECT_NOTIFICATIONS"],
  webNavContribution: true,
});
