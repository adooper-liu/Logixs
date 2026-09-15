import type { LifecycleNodeCode } from "./uiCopyCatalog";

// 与 work-execution resultPolicyForNode 的 emit_canonical_event 对齐：
// 装箱/出运/离港完成会发规范事件，必须带合格 evidenceRefs。
const COMPLETION_EVIDENCE_NODES = new Set<LifecycleNodeCode>([
  "container_stuffing",
  "shipment_dispatch",
  "origin_departure",
]);

export function completionRequiresEvidence(nodeCode: string): boolean {
  return COMPLETION_EVIDENCE_NODES.has(nodeCode as LifecycleNodeCode);
}
