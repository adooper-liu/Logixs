import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "sourcing",
  kind: "incremental",
  version: "1.0.0",
  // 读 4 号发布的可售 SKU —— 挂在它下游，但只读它的发布快照。
  depends: ["identity", "master-data"],
  permissions: ["planning.read", "planning.draft"],
  publicPorts: ["supplier nomination handoff"],
});
