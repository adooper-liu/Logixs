import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import { NODE_SEQUENCE, nextLifecycleNode } from "./node-status";

// 权威：packages/contracts/catalogs/v1/lifecycle-nodes.json 的 applicability。
export const OPTIONAL_NODE_CODES: readonly LifecycleNodeCode[] = [
  "transshipment",
  "rail_transfer",
];

export function isOptionalNode(nodeCode: LifecycleNodeCode): boolean {
  return OPTIONAL_NODE_CODES.includes(nodeCode);
}

export function defaultApplicability(
  nodeCode: LifecycleNodeCode,
): NodeApplicability {
  return isOptionalNode(nodeCode) ? "optional_applicable" : "required";
}

export function nextApplicableNode(
  from: LifecycleNodeCode,
  applicabilityOf: (nodeCode: LifecycleNodeCode) => NodeApplicability,
): LifecycleNodeCode | null {
  let next = nextLifecycleNode(from);
  while (next) {
    if (applicabilityOf(next) !== "optional_not_applicable") return next;
    next = nextLifecycleNode(next);
  }
  return null;
}

export type SetApplicabilityDecision =
  { kind: "apply" } | { kind: "reject"; code: string; message: string };

export function decideSetNodeApplicability(input: {
  nodeCode: LifecycleNodeCode;
  nodeState: string | null;
  laterNodes: Array<{ nodeCode: LifecycleNodeCode; state: string }>;
}): SetApplicabilityDecision {
  if (!isOptionalNode(input.nodeCode)) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "required 节点不得修改适用性",
    };
  }
  if (input.nodeState === "active" || input.nodeState === "completed") {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "节点已激活或完成，须走人工纠偏",
    };
  }
  const currentSequence = NODE_SEQUENCE[input.nodeCode];
  const laterAdvanced = input.laterNodes.some(
    (node) =>
      NODE_SEQUENCE[node.nodeCode] > currentSequence &&
      (node.state === "active" || node.state === "completed"),
  );
  if (laterAdvanced) {
    return {
      kind: "reject",
      code: "BUSINESS_STATE_VIOLATION",
      message: "后序节点已推进，须走人工纠偏",
    };
  }
  return { kind: "apply" };
}
