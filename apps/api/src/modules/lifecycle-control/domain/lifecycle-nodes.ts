import type { LifecycleNodeCode, NodeApplicability } from "@logix/contracts";
import type { FlowWithNodes } from "./lifecycle.repository";
import { NODE_SEQUENCE } from "./node-status";

export interface LifecycleNodeProjection {
  nodeInstanceId: string;
  nodeCode: LifecycleNodeCode;
  sequence: number;
  state: string;
  applicability: NodeApplicability;
  completedAt: Date | null;
  blockedReasonRefs: string[];
  isCurrent: boolean;
}

export interface LifecycleNodesView {
  flow: {
    id: string;
    state: string;
    currentNodeCode: string;
    version: number;
  } | null;
  nodes: LifecycleNodeProjection[];
}

function sequenceOf(nodeCode: LifecycleNodeCode): number {
  return NODE_SEQUENCE[nodeCode] ?? Number.MAX_SAFE_INTEGER;
}

export function projectLifecycleNodes(
  flow: FlowWithNodes | null,
): LifecycleNodesView {
  if (!flow) {
    return { flow: null, nodes: [] };
  }

  const nodes = flow.nodes
    .map((node) => ({
      nodeInstanceId: node.id,
      nodeCode: node.nodeCode,
      sequence: sequenceOf(node.nodeCode),
      state: node.state,
      applicability: node.applicability,
      completedAt: node.completedAt,
      blockedReasonRefs: node.blockedReasonRefs ?? [],
      isCurrent: node.nodeCode === flow.flow.currentNodeCode,
    }))
    .sort((left, right) => {
      if (left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return left.nodeInstanceId.localeCompare(right.nodeInstanceId);
    });

  return {
    flow: {
      id: flow.flow.id,
      state: flow.flow.state,
      currentNodeCode: flow.flow.currentNodeCode,
      version: flow.flow.version,
    },
    nodes,
  };
}
