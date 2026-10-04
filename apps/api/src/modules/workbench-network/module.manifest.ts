import { defineModuleManifest } from "../../module-plugin/module-manifest";

export const moduleManifest = defineModuleManifest({
  id: "workbench-network",
  kind: "incremental",
  version: "1.0.0",
  // 只读汇总市场、选品、寻源已落库的责任事实，不写入这三台。
  depends: ["identity", "market-intelligence", "product-selection", "sourcing"],
  permissions: ["planning.read"],
  publicPorts: ["workbench network volume"],
});
