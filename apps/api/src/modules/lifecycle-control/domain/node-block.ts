import type { LifecycleDateFactRecord } from "./lifecycle-date-fact";

export type NodeBlockDecision =
  { kind: "apply" } | { kind: "reject"; code: string; message: string };

export function decideNodeBlock(input: {
  flowState: string;
  currentNodeCode: string;
  nodeCode: string;
  nodeState: string;
}): NodeBlockDecision {
  if (input.flowState !== "active") {
    return reject("LIFECYCLE_FLOW_NOT_ACTIVE", "流程不是进行中状态");
  }
  if (input.currentNodeCode !== input.nodeCode) {
    return reject("LIFECYCLE_NODE_NOT_CURRENT", "只能阻断当前节点");
  }
  if (input.nodeState !== "active" && input.nodeState !== "blocked") {
    return reject("LIFECYCLE_NODE_NOT_BLOCKABLE", "节点当前不可阻断");
  }
  return { kind: "apply" };
}

export function decideNodeBlockSourceFact(input: {
  fact: LifecycleDateFactRecord | null;
  tenantId: string;
  containerId: string;
  nodeCode: string;
  blockType: string;
  occurredAt: Date;
  eventRole: string | null;
}): NodeBlockDecision {
  const fact = input.fact;
  if (!fact) {
    return reject("NODE_BLOCK_SOURCE_FACT_NOT_FOUND", "阻断来源事实不存在");
  }
  if (fact.tenantId !== input.tenantId) {
    return reject("AUTHORIZATION_SCOPE_DENIED", "阻断来源事实租户不匹配");
  }
  if (
    fact.containerId !== input.containerId ||
    fact.nodeCode !== input.nodeCode
  ) {
    return reject("NODE_BLOCK_SOURCE_FACT_MISMATCH", "阻断来源事实对象不匹配");
  }
  if (
    fact.timeKind !== "actual" ||
    fact.verificationState !== "verified" ||
    fact.confidenceState !== "confirmed" ||
    fact.validity !== "effective" ||
    !fact.isCurrent ||
    !fact.authorityPolicyRef
  ) {
    return reject(
      "NODE_BLOCK_SOURCE_FACT_NOT_QUALIFIED",
      "阻断来源事实尚未满足权威与核验要求",
    );
  }
  if (input.eventRole !== "exception") {
    return reject(
      "NODE_BLOCK_SOURCE_FACT_NOT_EXCEPTION",
      "只有异常类事实可以建立节点阻断",
    );
  }
  if (input.blockType !== fact.eventCode) {
    return reject(
      "NODE_BLOCK_TYPE_SOURCE_MISMATCH",
      "阻断类型必须使用来源异常事实的规范事件码",
    );
  }
  if (fact.occurredAt.getTime() !== input.occurredAt.getTime()) {
    return reject(
      "NODE_BLOCK_SOURCE_TIME_MISMATCH",
      "阻断发生时间必须来自来源事实",
    );
  }
  return { kind: "apply" };
}

export function decideNodeBlockResolution(input: {
  blockOccurredAt: Date;
  resolvedAt: Date;
}): NodeBlockDecision {
  if (input.resolvedAt.getTime() < input.blockOccurredAt.getTime()) {
    return reject(
      "NODE_BLOCK_RESOLUTION_TIME_CONFLICT",
      "解除时间早于阻断时间",
    );
  }
  return { kind: "apply" };
}

function reject(code: string, message: string): NodeBlockDecision {
  return { kind: "reject", code, message };
}
